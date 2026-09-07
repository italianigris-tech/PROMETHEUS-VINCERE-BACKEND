"""BullMQ-compatible job queue (Redis) + worker, with persistent fallback and stalled-job watchdog.

Redis key layout mirrors BullMQ for a queue prefixed ``mini-run``:

    bull:mini-run:wait        list      (producers LPUSH)
    bull:mini-run:active      list      (worker BRPOPLPUSH)
    bull:mini-run:completed   zset      (score = finishedOn epoch ms)
    bull:mini-run:failed      zset      (score = finishedOn epoch ms)
    bull:mini-run:<jobId>     hash      (BullMQ job envelope JSON)
    bull:mini-run:<jobId>:lock string   (Worker lease heartbeat, with TTL)

Durability & Reliability Guarantees:
  1. Idempotent Enqueue: Submitting the same jobId or idempotency key returns the
     existing job immediately; prevents duplicate execution or queue bloat.
  2. Heartbeat / Lease: Active workers renew a lock lease every 15s.
  3. Stalled-Job Sweeper: If a worker crashes, loses power, or loses internet mid-render,
     the sweeper detects expired leases in ``active`` and safely reclaims the job
     back to ``wait`` (or marks it failed if max attempts exceeded).
  4. Local Queue Persistence: When REDIS_URL is not configured, the in-process queue
     writes to a local JSON WAL so jobs survive local process restarts and client reconnects.
"""

from __future__ import annotations

import json
import os
import queue
import tempfile
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

BULL_PREFIX = "bull:mini-run"
DEFAULT_LOCK_TTL_MS = 60_000         # 60 s lease for active workers
DEFAULT_HEARTBEAT_SEC = 15           # Renew lease every 15 s
DEFAULT_STALL_SWEEP_SEC = 30         # Stalled-job watchdog runs every 30 s


def _redis_url() -> Optional[str]:
    return os.getenv("REDIS_URL") or os.getenv("BULLMQ_REDIS_URL") or None


def _now_ms() -> int:
    return int(time.time() * 1000)


class QueueError(RuntimeError):
    pass


def _envelope(
    job_id: str, name: str, data: Dict[str, Any], opts: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    return {
        "id": job_id,
        "name": name,
        "data": data,
        "opts": opts or {"attempts": 3, "backoff": {"type": "exponential", "delay": 2000}},
        "timestamp": _now_ms(),
        "processedOn": None,
        "finishedOn": None,
        "returnvalue": None,
        "failedReason": None,
        "attemptsMade": 0,
        "stacktrace": [],
    }


# ---------------------------------------------------------------------------
# Redis-backed queue
# ---------------------------------------------------------------------------


class RedisJobQueue:
    """BullMQ-compatible Redis queue with lease heartbeats and stalled-job recovery."""

    def __init__(self, redis_url: Optional[str] = None, prefix: str = "mini-run") -> None:
        self.prefix = prefix
        self.redis_url = redis_url or _redis_url()
        if not self.redis_url:
            raise QueueError("RedisJobQueue requires REDIS_URL.")
        import redis as redis_lib

        self.redis = redis_lib.from_url(self.redis_url, decode_responses=True)

    def _key(self, suffix: str) -> str:
        return f"bull:{self.prefix}:{suffix}"

    def enqueue(
        self,
        name: str,
        data: Dict[str, Any],
        job_id: Optional[str] = None,
        opts: Optional[Dict[str, Any]] = None,
    ) -> str:
        job_id = job_id or uuid.uuid4().hex

        # Idempotency check: don't duplicate if already in wait, active, or completed
        existing = self.get(job_id)
        if existing is not None:
            state = existing.get("_state")
            if state in ("completed", "active", "waiting"):
                return job_id
            # If failed and attempts remain, allow re-enqueue
            max_attempts = int((existing.get("opts") or {}).get("attempts", 1))
            if existing.get("attemptsMade", 0) >= max_attempts:
                return job_id

        envelope = _envelope(job_id, name, data, opts)
        pipe = self.redis.pipeline()
        pipe.hset(self._key(job_id), mapping={"envelope": json.dumps(envelope)})
        pipe.lpush(self._key("wait"), job_id)
        pipe.execute()
        return job_id

    def get(self, job_id: str) -> Optional[Dict[str, Any]]:
        raw = self.redis.hget(self._key(job_id), "envelope")
        if not raw:
            return None
        envelope = json.loads(raw)
        if self.redis.zscore(self._key("completed"), job_id) is not None:
            envelope["_state"] = "completed"
        elif self.redis.zscore(self._key("failed"), job_id) is not None:
            envelope["_state"] = "failed"
        elif self.redis.lpos(self._key("active"), job_id) is not None:
            envelope["_state"] = "active"
        else:
            envelope["_state"] = "waiting"

        lock_val = self.redis.get(self._key(f"{job_id}:lock"))
        envelope["_hasActiveLock"] = lock_val is not None
        return envelope

    def _pop_active(self) -> Optional[str]:
        job_id = self.redis.brpoplpush(self._key("wait"), self._key("active"), timeout=2)
        if job_id:
            self.renew_lease(job_id)
        return job_id

    def renew_lease(self, job_id: str, ttl_ms: int = DEFAULT_LOCK_TTL_MS) -> bool:
        """Renew worker lock lease to prove liveness (heartbeat)."""
        lock_key = self._key(f"{job_id}:lock")
        return bool(self.redis.set(lock_key, "locked", px=ttl_ms))

    def release_lease(self, job_id: str) -> None:
        """Release worker lock lease upon completion or failure."""
        lock_key = self._key(f"{job_id}:lock")
        try:
            self.redis.delete(lock_key)
        except Exception:
            pass

    def sweep_stalled_jobs(self, lock_ttl_ms: int = DEFAULT_LOCK_TTL_MS) -> List[str]:
        """Examine 'active' list; reclaim any job whose worker lease expired."""
        active_ids = self.redis.lrange(self._key("active"), 0, -1)
        reclaimed: List[str] = []

        for job_id in active_ids:
            has_lock = self.redis.exists(self._key(f"{job_id}:lock"))
            if not has_lock:
                # Lock expired -> worker died, network severed, or process restarted
                raw = self.redis.hget(self._key(job_id), "envelope")
                if not raw:
                    self.redis.lrem(self._key("active"), 0, job_id)
                    continue

                envelope = json.loads(raw)
                attempts_made = envelope.get("attemptsMade", 0) + 1
                envelope["attemptsMade"] = attempts_made
                max_attempts = int((envelope.get("opts") or {}).get("attempts", 3))

                if attempts_made < max_attempts:
                    print(
                        f"[queue:stalled_watchdog] Reclaiming stalled job {job_id} "
                        f"(attempt {attempts_made}/{max_attempts}) back to wait queue.",
                        flush=True,
                    )
                    pipe = self.redis.pipeline()
                    pipe.hset(self._key(job_id), mapping={"envelope": json.dumps(envelope)})
                    pipe.lrem(self._key("active"), 0, job_id)
                    pipe.rpush(self._key("wait"), job_id)
                    pipe.execute()
                    reclaimed.append(job_id)
                else:
                    print(
                        f"[queue:stalled_watchdog] Failing stalled job {job_id}: "
                        f"exhausted all {max_attempts} attempts.",
                        flush=True,
                    )
                    now = _now_ms()
                    envelope["finishedOn"] = now
                    envelope["failedReason"] = "Job stalled: worker lease expired and attempts exhausted."
                    pipe = self.redis.pipeline()
                    pipe.hset(self._key(job_id), mapping={"envelope": json.dumps(envelope)})
                    pipe.lrem(self._key("active"), 0, job_id)
                    pipe.zadd(self._key("failed"), {job_id: now})
                    pipe.execute()

        return reclaimed

    def _complete(self, job_id: str, result: Dict[str, Any]) -> None:
        now = _now_ms()
        raw = self.redis.hget(self._key(job_id), "envelope")
        envelope = json.loads(raw) if raw else {}
        envelope["processedOn"] = envelope.get("processedOn") or now
        envelope["finishedOn"] = now
        envelope["returnvalue"] = result
        envelope["attemptsMade"] = envelope.get("attemptsMade", 0) + 1
        pipe = self.redis.pipeline()
        pipe.hset(self._key(job_id), mapping={"envelope": json.dumps(envelope)})
        pipe.lrem(self._key("active"), 0, job_id)
        pipe.zadd(self._key("completed"), {job_id: now})
        pipe.execute()
        self.release_lease(job_id)

    def _fail(self, job_id: str, reason: str, requeue: bool) -> None:
        now = _now_ms()
        raw = self.redis.hget(self._key(job_id), "envelope")
        envelope = json.loads(raw) if raw else {}
        envelope["failedReason"] = reason
        envelope["attemptsMade"] = envelope.get("attemptsMade", 0) + 1
        pipe = self.redis.pipeline()
        pipe.hset(self._key(job_id), mapping={"envelope": json.dumps(envelope)})
        pipe.lrem(self._key("active"), 0, job_id)
        if requeue:
            pipe.rpush(self._key("wait"), job_id)
        else:
            envelope["finishedOn"] = now
            pipe.hset(self._key(job_id), mapping={"envelope": json.dumps(envelope)})
            pipe.zadd(self._key("failed"), {job_id: now})
        pipe.execute()
        self.release_lease(job_id)


# ---------------------------------------------------------------------------
# In-process fallback queue (persistent WAL file backing for crash survival)
# ---------------------------------------------------------------------------


class LocalJobQueue:
    """Thread-safe queue with persistent JSON file store so jobs survive process restarts."""

    def __init__(self, persistence_file: Optional[Path] = None) -> None:
        self._wait: queue.Queue = queue.Queue()
        self._store: Dict[str, Dict[str, Any]] = {}
        self._active_leases: Dict[str, float] = {}
        self._lock = threading.Lock()
        default_file = Path(tempfile.gettempdir()) / "mini_run_local_queue_store.json"
        self._persistence_file = persistence_file or Path(os.getenv("MINI_RUN_QUEUE_FILE", str(default_file)))
        self._load_from_disk()

    def _load_from_disk(self) -> None:
        with self._lock:
            if self._persistence_file.exists():
                try:
                    data = json.loads(self._persistence_file.read_text("utf-8"))
                    self._store = data.get("jobs", {})
                    # Re-populate wait queue for any pending or interrupted jobs
                    for jid, env in self._store.items():
                        state = env.get("_state")
                        if state in ("waiting", "active"):
                            # If active on load, the process crashed -> recover to wait
                            env["_state"] = "waiting"
                            self._wait.put(jid)
                except Exception as e:
                    print(f"[queue:local] Warning loading queue persistence file: {e}", flush=True)

    def _save_to_disk(self) -> None:
        try:
            payload = json.dumps({"jobs": self._store}, indent=2)
            tmp = self._persistence_file.with_suffix(".tmp")
            tmp.parent.mkdir(parents=True, exist_ok=True)
            tmp.write_text(payload, encoding="utf-8")
            tmp.replace(self._persistence_file)
        except Exception:
            pass

    def enqueue(
        self,
        name: str,
        data: Dict[str, Any],
        job_id: Optional[str] = None,
        opts: Optional[Dict[str, Any]] = None,
    ) -> str:
        job_id = job_id or uuid.uuid4().hex

        with self._lock:
            existing = self._store.get(job_id)
            if existing is not None:
                state = existing.get("_state")
                if state in ("completed", "active", "waiting"):
                    return job_id

            envelope = _envelope(job_id, name, data, opts)
            envelope["_state"] = "waiting"
            self._store[job_id] = envelope
            self._save_to_disk()

        self._wait.put(job_id)
        return job_id

    def get(self, job_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            envelope = self._store.get(job_id)
            if not envelope:
                return None
            res = json.loads(json.dumps(envelope))
            res["_hasActiveLock"] = self._active_leases.get(job_id, 0) > time.time()
            return res

    def _pop_active(self) -> Optional[str]:
        try:
            job_id = self._wait.get(timeout=2)
            if job_id:
                with self._lock:
                    if job_id in self._store:
                        self._store[job_id]["_state"] = "active"
                        self._store[job_id]["processedOn"] = _now_ms()
                        self._save_to_disk()
                self.renew_lease(job_id)
            return job_id
        except queue.Empty:
            return None

    def renew_lease(self, job_id: str, ttl_ms: int = DEFAULT_LOCK_TTL_MS) -> bool:
        with self._lock:
            self._active_leases[job_id] = time.time() + (ttl_ms / 1000.0)
            return True

    def release_lease(self, job_id: str) -> None:
        with self._lock:
            self._active_leases.pop(job_id, None)

    def sweep_stalled_jobs(self, lock_ttl_ms: int = DEFAULT_LOCK_TTL_MS) -> List[str]:
        now = time.time()
        reclaimed: List[str] = []
        with self._lock:
            for jid, env in list(self._store.items()):
                if env.get("_state") == "active":
                    lease_end = self._active_leases.get(jid, 0)
                    if lease_end < now:
                        attempts = int((env.get("opts") or {}).get("attempts", 3))
                        attempts_made = env.get("attemptsMade", 0) + 1
                        env["attemptsMade"] = attempts_made
                        if attempts_made < attempts:
                            env["_state"] = "waiting"
                            self._wait.put(jid)
                            reclaimed.append(jid)
                        else:
                            env["_state"] = "failed"
                            env["finishedOn"] = _now_ms()
                            env["failedReason"] = "Job stalled: worker lease expired."
            if reclaimed:
                self._save_to_disk()
        return reclaimed

    def _complete(self, job_id: str, result: Dict[str, Any]) -> None:
        with self._lock:
            if job_id in self._store:
                envelope = self._store[job_id]
                envelope["processedOn"] = envelope.get("processedOn") or _now_ms()
                envelope["finishedOn"] = _now_ms()
                envelope["returnvalue"] = result
                envelope["attemptsMade"] = envelope.get("attemptsMade", 0) + 1
                envelope["_state"] = "completed"
                self._save_to_disk()
        self.release_lease(job_id)

    def _fail(self, job_id: str, reason: str, requeue: bool) -> None:
        with self._lock:
            if job_id in self._store:
                envelope = self._store[job_id]
                envelope["failedReason"] = reason
                envelope["attemptsMade"] = envelope.get("attemptsMade", 0) + 1
                if requeue:
                    envelope["_state"] = "waiting"
                else:
                    envelope["finishedOn"] = _now_ms()
                    envelope["_state"] = "failed"
                self._save_to_disk()
        if requeue:
            self._wait.put(job_id)
        self.release_lease(job_id)


# ---------------------------------------------------------------------------
# Worker thread with heartbeat and stalled-job watchdog
# ---------------------------------------------------------------------------

JobHandler = Callable[[str, Dict[str, Any]], Dict[str, Any]]


class _HeartbeatThread(threading.Thread):
    def __init__(self, backend: Any, job_id: str, interval_sec: int = DEFAULT_HEARTBEAT_SEC) -> None:
        super().__init__(daemon=True)
        self.backend = backend
        self.job_id = job_id
        self.interval_sec = interval_sec
        self._stop = threading.Event()

    def run(self) -> None:
        while not self._stop.wait(self.interval_sec):
            try:
                self.backend.renew_lease(self.job_id)
            except Exception:
                pass

    def stop(self) -> None:
        self._stop.set()


class JobWorker:
    """Drain ``wait`` -> run handler -> ``completed``/``failed`` with liveness heartbeats."""

    def __init__(
        self,
        handlers: Dict[str, JobHandler],
        concurrency: int = 2,
        queue_backend: Optional[Any] = None,
    ) -> None:
        self.handlers = handlers
        self.concurrency = max(1, concurrency)
        self.backend = queue_backend or create_job_queue()
        self._stop = threading.Event()
        self._threads: List[threading.Thread] = []
        self._sweeper_thread: Optional[threading.Thread] = None

    def start(self) -> None:
        if self._threads:
            return
        # Initial stall recovery on startup
        try:
            self.backend.sweep_stalled_jobs()
        except Exception:
            pass

        # Start stalled-job sweeper thread
        self._sweeper_thread = threading.Thread(target=self._run_sweeper, daemon=True)
        self._sweeper_thread.start()

        # Start execution workers
        for _ in range(self.concurrency):
            thread = threading.Thread(target=self._run, daemon=True)
            thread.start()
            self._threads.append(thread)

    def stop(self) -> None:
        self._stop.set()

    def _run_sweeper(self) -> None:
        while not self._stop.wait(DEFAULT_STALL_SWEEP_SEC):
            try:
                self.backend.sweep_stalled_jobs()
            except Exception:
                pass

    def _run(self) -> None:
        while not self._stop.is_set():
            job_id = self.backend._pop_active()
            if job_id is None:
                continue
            envelope = self.backend.get(job_id)
            if envelope is None:
                continue
            name = envelope.get("name", "")
            handler = self.handlers.get(name)
            if handler is None:
                self.backend._fail(
                    job_id, f"No handler registered for job name '{name}'.", requeue=False
                )
                continue

            heartbeat = _HeartbeatThread(self.backend, job_id)
            heartbeat.start()

            try:
                result = handler(job_id, envelope.get("data") or {})
                self.backend._complete(job_id, result)
            except Exception as error:  # noqa: BLE001 - queue boundary
                attempts = int((envelope.get("opts") or {}).get("attempts", 1))
                requeue = envelope.get("attemptsMade", 0) + 1 < attempts
                self.backend._fail(job_id, str(error), requeue=requeue)
            finally:
                heartbeat.stop()


def create_job_queue() -> Any:
    """Redis-backed queue when configured, else a shared persistent local queue singleton."""
    redis_url = _redis_url()
    if redis_url:
        try:
            return RedisJobQueue(redis_url)
        except Exception as e:
            print(f"[queue] Redis connection failed ({e}), falling back to persistent LocalJobQueue.", flush=True)
    return _LOCAL_QUEUE


_LOCAL_QUEUE = LocalJobQueue()
