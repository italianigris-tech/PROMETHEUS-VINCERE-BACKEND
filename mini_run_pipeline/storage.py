"""Storage parity: R2 (S3-compatible) + Supabase, on top of the Modal Volume.

Env contract matches the backend (``backend/src/config.ts`` / ``r2.ts``):

    R2_ACCOUNT_ID, R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
    R2_BUCKET, R2_UPLOAD_BUCKET, R2_PUBLIC_UPLOADS_BASE,
    R2_UPLOAD_URL_EXPIRES_SECONDS
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

Everything degrades gracefully: if the credentials are absent the clients are
``enabled=False`` and no-op safely, so the studio keeps working offline.
"""

from __future__ import annotations

import json
import os
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, Optional

DEFAULT_R2_BUCKET = "prometheus-uploads"
DEFAULT_R2_UPLOAD_URL_EXPIRES_SECONDS = 600
DEFAULT_R2_DOWNLOAD_URL_EXPIRES_SECONDS = 900
DEFAULT_R2_ENDPOINT = "https://{account}.r2.cloudflarestorage.com"

MINI_RUN_JOBS_TABLE = os.getenv("MINI_RUN_JOBS_TABLE", "mini_run_jobs")


def _first(*values: Optional[str], default: str = "") -> str:
    for value in values:
        if value:
            return value
    return default


# ---------------------------------------------------------------------------
# R2
# ---------------------------------------------------------------------------


class R2Storage:
    """Minimal Cloudflare R2 object storage client (S3-compatible)."""

    def __init__(self, env: Optional[Dict[str, str]] = None) -> None:
        env = env if env is not None else os.environ
        self.account_id = env.get("R2_ACCOUNT_ID", "")
        self.endpoint = env.get("R2_ENDPOINT") or (
            DEFAULT_R2_ENDPOINT.format(account=self.account_id) if self.account_id else ""
        )
        self.access_key_id = env.get("R2_ACCESS_KEY_ID", "")
        self.secret_access_key = env.get("R2_SECRET_ACCESS_KEY", "")
        self.bucket = _first(
            env.get("R2_BUCKET"), env.get("R2_BUCKET_NAME"), env.get("R2_UPLOAD_BUCKET"),
            default=DEFAULT_R2_BUCKET,
        )
        self.music_bucket = env.get("R2_BUCKET_NAME") or self.bucket
        self.public_base = env.get("R2_PUBLIC_UPLOADS_BASE", "")
        self.upload_url_expires = int(
            env.get("R2_UPLOAD_URL_EXPIRES_SECONDS", DEFAULT_R2_UPLOAD_URL_EXPIRES_SECONDS)
        )
        self.enabled = bool(
            self.endpoint and self.access_key_id and self.secret_access_key and self.bucket
        )

    def _client(self):
        if not self.enabled:
            raise RuntimeError("R2Storage is not configured (missing R2 credentials).")
        import boto3

        return boto3.client(
            "s3",
            endpoint_url=self.endpoint,
            aws_access_key_id=self.access_key_id,
            aws_secret_access_key=self.secret_access_key,
            region_name="auto",
        )

    def upload_file(self, local_path: str, key: str, content_type: Optional[str] = None) -> str:
        """Upload a local file to R2; returns the object key."""
        if not self.enabled:
            return key
        extra: Dict[str, Any] = {}
        if content_type:
            extra["ContentType"] = content_type
        self._client().upload_file(str(local_path), self.bucket, key, ExtraArgs=extra or None)
        return key

    def download_file(self, key: str, local_path: str, bucket: Optional[str] = None) -> str:
        """Download one object into a concrete local render path."""
        if not self.enabled:
            raise RuntimeError("R2Storage is not configured (missing R2 credentials).")
        destination = Path(local_path)
        destination.parent.mkdir(parents=True, exist_ok=True)
        self._client().download_file(bucket or self.bucket, key, str(destination))
        if not destination.is_file() or destination.stat().st_size <= 0:
            raise RuntimeError(f"R2 object {bucket or self.bucket}/{key} produced no local audio file.")
        return str(destination)

    def read_json(self, key: str, bucket: Optional[str] = None) -> Dict[str, Any]:
        """Read a JSON artifact directly from R2 without creating a temp file."""
        if not self.enabled:
            raise RuntimeError("R2Storage is not configured (missing R2 credentials).")
        response = self._client().get_object(Bucket=bucket or self.bucket, Key=key)
        payload = response["Body"].read()
        parsed = json.loads(payload.decode("utf-8"))
        if not isinstance(parsed, dict):
            raise RuntimeError(f"R2 JSON artifact {key} must contain an object.")
        return parsed

    def list_objects(self, prefix: str, bucket: Optional[str] = None) -> list[Dict[str, Any]]:
        """List every object below a bounded prefix, following R2 pagination."""
        if not self.enabled:
            raise RuntimeError("R2Storage is not configured (missing R2 credentials).")
        client = self._client()
        target_bucket = bucket or self.bucket
        continuation: Optional[str] = None
        objects: list[Dict[str, Any]] = []
        while True:
            params: Dict[str, Any] = {"Bucket": target_bucket, "Prefix": prefix}
            if continuation:
                params["ContinuationToken"] = continuation
            response = client.list_objects_v2(**params)
            objects.extend(response.get("Contents") or [])
            if not response.get("IsTruncated"):
                break
            continuation = response.get("NextContinuationToken")
            if not continuation:
                break
        return objects

    def presigned_upload_url(self, key: str, content_type: str = "video/mp4") -> str:
        """Presigned PUT URL for direct-to-R2 uploads (backend ``createUploadUrl``)."""
        if not self.enabled:
            return ""
        return self._client().generate_presigned_url(
            "put_object",
            Params={"Bucket": self.bucket, "Key": key, "ContentType": content_type},
            ExpiresIn=self.upload_url_expires,
        )

    def presigned_download_url(
        self, key: str, expires: int = DEFAULT_R2_DOWNLOAD_URL_EXPIRES_SECONDS
    ) -> str:
        if not self.enabled:
            return ""
        return self._client().generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=expires,
        )

    def object_url(self, key: str) -> str:
        """Public URL when configured, else a presigned URL, else the raw key."""
        if not self.enabled:
            return key
        if self.public_base:
            return f"{self.public_base.rstrip('/')}/{key.lstrip('/')}"
        return self.presigned_download_url(key)


# ---------------------------------------------------------------------------
# Supabase
# ---------------------------------------------------------------------------


class SupabaseStore:
    """REST client for the ``mini_run_jobs`` row store (service-role key) with outbox persistence."""

    def __init__(self, env: Optional[Dict[str, str]] = None) -> None:
        env = env if env is not None else os.environ
        self.url = (env.get("SUPABASE_URL") or "").rstrip("/")
        self.service_role_key = env.get("SUPABASE_SERVICE_ROLE_KEY", "")
        self.table = env.get("MINI_RUN_JOBS_TABLE", MINI_RUN_JOBS_TABLE)
        self.enabled = bool(self.url and self.service_role_key)
        outbox_default = Path(tempfile.gettempdir()) / "supabase_mini_run_outbox.jsonl"
        self.outbox_file = Path(env.get("MINI_RUN_OUTBOX_FILE", str(outbox_default)))
        self._flushing = False

    def _request(
        self, method: str, path: str, body: Optional[Dict[str, Any]] = None, retries: int = 3
    ) -> Dict[str, Any]:
        last_error: Optional[Exception] = None
        for attempt in range(retries):
            request = urllib.request.Request(
                f"{self.url}/rest/v1/{self.table}{path}",
                data=json.dumps(body).encode("utf-8") if body is not None else None,
                headers={
                    "apikey": self.service_role_key,
                    "Authorization": f"Bearer {self.service_role_key}",
                    "Content-Type": "application/json",
                    "Prefer": "return=representation",
                },
                method=method,
            )
            try:
                with urllib.request.urlopen(request, timeout=15) as response:
                    payload = response.read().decode("utf-8")
                    data = json.loads(payload) if payload else {}
                    # Try flushing outbox after a successful request if outbox exists
                    if not self._flushing and self.outbox_file.exists() and self.outbox_file.stat().st_size > 0:
                        self.flush_outbox()
                    return data
            except urllib.error.HTTPError as error:
                last_error = error
                detail = error.read().decode("utf-8")[:500] if error.fp else str(error)
                # Retry on 5xx or rate limit
                if error.code in (408, 429, 500, 502, 503, 504) and attempt < retries - 1:
                    time.sleep(0.3 * (2 ** attempt))
                    continue
                raise RuntimeError(f"Supabase {method} {path} failed: HTTP {error.code} {detail}")
            except (urllib.error.URLError, TimeoutError, OSError) as error:
                last_error = error
                if attempt < retries - 1:
                    time.sleep(0.3 * (2 ** attempt))
                    continue
                raise RuntimeError(f"Supabase {method} {path} connection error: {error}")

        if last_error:
            raise last_error
        return {}

    def _buffer_outbox(self, op: str, job_id: str, payload: Dict[str, Any]) -> None:
        """Buffer a failed Supabase update locally to replay when internet restores."""
        try:
            record = {
                "op": op,
                "job_id": job_id,
                "payload": payload,
                "timestamp": time.time(),
            }
            self.outbox_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.outbox_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(record) + "\n")
            print(f"[supabase:outbox] Buffered {op} for job {job_id} to {self.outbox_file.name}", flush=True)
        except Exception as e:
            print(f"[supabase:outbox] Failed to buffer to outbox: {e}", flush=True)

    def flush_outbox(self) -> int:
        """Replay pending offline updates that failed during internet downtime."""
        if not self.enabled or not self.outbox_file.exists() or self.outbox_file.stat().st_size == 0:
            return 0

        self._flushing = True
        replayed = 0
        remaining_lines = []
        try:
            lines = self.outbox_file.read_text("utf-8").splitlines()
            for line in lines:
                if not line.strip():
                    continue
                try:
                    entry = json.loads(line)
                    op = entry.get("op")
                    job_id = entry.get("job_id")
                    payload = entry.get("payload") or {}
                    if op == "update":
                        self.update_job(job_id, payload, buffer_on_fail=False)
                    elif op == "create":
                        self.create_job(payload, buffer_on_fail=False)
                    replayed += 1
                except Exception:
                    # Still offline or individual item failed; preserve for next cycle
                    remaining_lines.append(line)

            if remaining_lines:
                self.outbox_file.write_text("\n".join(remaining_lines) + "\n", "utf-8")
            else:
                self.outbox_file.unlink(missing_ok=True)
        except Exception as err:
            print(f"[supabase:outbox] Flush encountered error: {err}", flush=True)
        finally:
            self._flushing = False

        if replayed:
            print(f"[supabase:outbox] Successfully flushed {replayed} buffered updates to Supabase.", flush=True)
        return replayed

    def create_job(self, record: Dict[str, Any], buffer_on_fail: bool = True) -> Optional[Dict[str, Any]]:
        """Insert a job row; buffers to outbox if offline."""
        if not self.enabled:
            return None
        try:
            rows = self._request("POST", "", record)
            if isinstance(rows, list) and rows:
                return rows[0]
            return rows if isinstance(rows, dict) else None
        except Exception as err:
            if buffer_on_fail:
                self._buffer_outbox("create", record.get("id", "unknown"), record)
            return None

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        if not self.enabled:
            return None
        import urllib.parse

        try:
            rows = self._request("GET", f"?id=eq.{urllib.parse.quote(job_id)}&select=*&limit=1")
            if isinstance(rows, list) and rows:
                return rows[0]
        except Exception:
            return None
        return None

    def update_job(
        self, job_id: str, updates: Dict[str, Any], buffer_on_fail: bool = True
    ) -> Optional[Dict[str, Any]]:
        """Update a job row; buffers to outbox WAL if network is down."""
        if not self.enabled:
            return None
        import urllib.parse

        updates = dict(updates)
        updates["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
        try:
            rows = self._request("PATCH", f"?id=eq.{urllib.parse.quote(job_id)}", updates)
            if isinstance(rows, list) and rows:
                return rows[0]
            return rows if isinstance(rows, dict) else None
        except Exception as err:
            if buffer_on_fail:
                self._buffer_outbox("update", job_id, updates)
            return None

