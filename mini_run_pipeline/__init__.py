"""Prometheus Mini-Run Studio — full pipeline parity package.

Provides the same pipeline capabilities as the production backend while keeping
the Mini-Run Studio's superior typographic design output:

    ids       job/session ID minting        (backend/src/utils/ids.ts parity)
    classify  short-form vs long-form call parser
    silence   FFmpeg silence detection + protected rhetorical-pause
              classification                 (backend/src/maul/editorial-timeline.ts parity)
    chunks    silence-aware smart chunker
    storage   R2 (S3-compatible) + Supabase persistence
    jobs      BullMQ-compatible Redis job queue + worker
    render    parallel slice render -> final composed encoded video
    pipeline  end-to-end orchestrator
"""

from . import ids  # noqa: F401
from . import classify  # noqa: F401
from . import silence  # noqa: F401
from . import chunks  # noqa: F401
from . import storage  # noqa: F401
from . import jobs  # noqa: F401
from . import render  # noqa: F401
from . import pipeline  # noqa: F401

__all__ = [
    "ids",
    "classify",
    "silence",
    "chunks",
    "storage",
    "jobs",
    "render",
    "pipeline",
]
