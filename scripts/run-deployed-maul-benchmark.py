#!/usr/bin/env python3
"""Compatibility alias for the production MAUL Modal runner.

Keep old Gemini commands safe: they now use the full-scale preflight, bounded
polling, artifact download, and MP4 verification instead of benchmark behavior.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
RUNNER = ROOT / "scripts" / "run-maul-modal.py"


def main() -> int:
    if len(sys.argv) not in {2, 4} or (len(sys.argv) == 4 and sys.argv[2] != "--output"):
        raise SystemExit(
            "Usage: python scripts/run-deployed-maul-benchmark.py <envelope.json> "
            "[--output <final.mp4>]"
        )
    envelope = Path(sys.argv[1])
    output = Path(sys.argv[3]) if len(sys.argv) == 4 else envelope.with_name("maul-modal-final.mp4")
    spec = importlib.util.spec_from_file_location("run_maul_modal", RUNNER)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load MAUL runner: {RUNNER}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.main([str(envelope), "--output", str(output)])


if __name__ == "__main__":
    raise SystemExit(main())
