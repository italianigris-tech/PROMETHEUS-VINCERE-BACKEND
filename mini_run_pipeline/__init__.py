import os
from pathlib import Path

def _load_env():
    backend_root = Path(__file__).resolve().parent.parent
    env_file = backend_root / '.env'
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                key = k.strip()
                val = v.strip().strip('"').strip('\'')
                if key and not os.environ.get(key):
                    os.environ[key] = val

_load_env()

from . import ids
from . import classify
from . import silence
from . import chunks
from . import storage
from . import jobs
from . import looks
from . import render
from . import pipeline

__all__ = [
    'ids',
    'classify',
    'silence',
    'chunks',
    'storage',
    'jobs',
    'looks',
    'render',
    'pipeline',
]
