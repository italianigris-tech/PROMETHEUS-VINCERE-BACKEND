"""BullMQ-compatible job queue (Redis) + worker, with inline fallback.

Redis key layout mirrors BullMQ for a queue prefixed ``mini-run``:

    bull:mini-run:wait        list      (producers LPUSH)
    bull:mini-run:active      list      (worker BRPOPLPUSH)
    bull:mini-run:completed   zset      (score = finishedOn epoch ms)
    bull:mini-run:failed      zset
    bull:mini-run:<jobId>     hash      (BullMQ job envelope JSON)

Job envelopes are BullMQ-shaped so a Node BullMQ consumer pointed at the same
queue can read them. When ``REDIS_URL`` is not configured the queue falls back
to an in-process threaded store so the studio still works standalone.
"""

from __future__ import annotations

import json
import queue
import threading
import time
import uuid
from typing import Any, Callable, Dict, List, Optional

BULL_PREFIX = "bull:mini-run"


def _redis_url() -> Optional[str]:
    import os

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
        "opts": opts or {"attempts": 1, "backoff": {"type": "exponential", "delay": 2000}},
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
    """BullMQ-compatible Redis queue."""

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
        return envelope

    def _pop_active(self) -> Optional[str]:
        return self.redis.brpoplpush(self._key("wait"), self._key("active"), timeout=2)

    def _complete(self, job_id: str, result: Dict[str, Any]) -> None:
        now = _now_ms()
        envelope = json.loads(self.redis.hget(self._key(job_id), "envelope"))
        envelope["processedOn"] = envelope.get("processedOn") or now
        envelope["finishedOn"] = now
        envelope["returnvalue"] = result
        envelope["attemptsMade"] = envelope.get("attemptsMade", 0) + 1
        pipe = self.redis.pipeline()
        pipe.hset(self._key(job_id), mapping={"envelope": json.dumps(envelope)})
        pipe.lrem(self._key("active"), 0, job_id)
        pipe.zadd(self._key("completed"), {job_id: now})
        pipe.execute()

    def _fail(self, job_id: str, reason: str, requeue: bool) -> None:
        now = _now_ms()
        envelope = json.loads(self.redis.hget(self._key(job_id), "envelope"))
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

# ---------------------------------------------------------------------------
# In-process fallback queue (used when REDIS_URL is not configured)
# ---------------------------------------------------------------------------


class LocalJobQueue:
    """Thread-safe in-process queue with the same interface as RedisJobQueue."""

    def __init__(self) -> None:
        self._wait: queue.Queue = queue.Queue()
        self._store: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()

    def enqueue(
        self,
        name: str,
        data: Dict[str, Any],
        job_id: Optional[str] = None,
        opts: Optional[Dict[str, Any]] = None,
    ) -> str:
        job_id = job_id or uuid.uuid4().hex
        envelope = _envelope(job_id, name, data, opts)
        envelope["_state"] = "waiting"
        with self._lock:
            self._store[job_id] = envelope
        self._wait.put(job_id)
        return job_id

    def get(self, job_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            envelope = self._store.get(job_id)
            return json.loads(json.dumps(envelope)) if envelope else None

    def _pop_active(self) -> Optional[str]:
        try:
            return self._wait.get(timeout=2)
        except queue.Empty:
            return None

    def _complete(self, job_id: str, result: Dict[str, Any]) -> None:
        with self._lock:
            envelope = self._store[job_id]
            envelope["processedOn"] = envelope.get("processedOn") or _now_ms()
            envelope["finishedOn"] = _now_ms()
            envelope["returnvalue"] = result
            envelope["attemptsMade"] = envelope.get("attemptsMade", 0) + 1
            envelope["_state"] = "completed"

    def _fail(self, job_id: str, reason: str, requeue: bool) -> None:
        with self._lock:
            envelope = self._store[job_id]
            envelope["failedReason"] = reason
            envelope["attemptsMade"] = envelope.get("attemptsMade", 0) + 1
            if requeue:
                envelope["_state"] = "waiting"

# ---------------------------------------------------------------------------
# Worker thread
# ---------------------------------------------------------------------------

JobHandler = Callable[[str, Dict[str, Any]], Dict[str, Any]]


class JobWorker:
    """Drain ``wait`` -> run handler -> ``completed``/``failed`` (BullMQ shape)."""

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

    def start(self) -> None:
        if self._threads:
            return
        for _ in range(self.concurrency):
            thread = threading.Thread(target=self._run, daemon=True)
            thread.start()
            self._threads.append(thread)

    def stop(self) -> None:
        self._stop.set()

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
            try:
                result = handler(job_id, envelope.get("data") or {})
                self.backend._complete(job_id, result)
            except Exception as error:  # noqa: BLE001 - queue boundary
                attempts = int((envelope.get("opts") or {}).get("attempts", 1))
                requeue = envelope.get("attemptsMade", 0) + 1 < attempts
                self.backend._fail(job_id, str(error), requeue=requeue)
                if requeue and hasattr(self.backend, "_wait"):
                    self.backend._wait.put(job_id)


def create_job_queue() -> Any:
    """Redis-backed queue when configured, else a shared in-process singleton.

    The Redis path shares keys across every ``create_job_queue()`` call, so
    producer, worker, and status reader all see the same lanes. The in-process
    fallback must behave the same way, otherwise a worker completing a job on
    its own queue instance is invisible to ``get_pipeline_job`` which built a
    fresh queue. A shared module-level instance preserves that causality.
    """
    redis_url = _redis_url()
    if redis_url:
        try:
            return RedisJobQueue(redis_url)
        except Exception:  # noqa: BLE001 - degrade to local queue
            pass
    return _LOCAL_QUEUE


_LOCAL_QUEUE = LocalJobQueue()
