"""Job / session ID minting — parity with ``backend/src/utils/ids.ts``.

The backend mints the ID. The front-end provides an optional ``userId`` for
tracking; it never mints identifiers. This prevents ID collision, ID guessing,
and user spoofing.
"""

from __future__ import annotations

import secrets
import time


def _mint(prefix: str) -> str:
    stamp = format(int(time.time() * 1000), "x")
    entropy = secrets.token_hex(5)
    return f"{prefix}_{stamp}_{entropy}"


def create_job_id() -> str:
    """Return ``job_<base36timestamp>_<10-hex-entropy>`` (backend ``createJobId``)."""
    return _mint("job")


def create_edit_session_id() -> str:
    """Return ``edit_<base36timestamp>_<10-hex-entropy>`` (backend ``createEditSessionId``)."""
    return _mint("edit")
