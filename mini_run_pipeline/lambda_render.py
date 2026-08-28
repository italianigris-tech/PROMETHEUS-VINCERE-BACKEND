"""Remotion on AWS Lambda distributed render interface."""

from __future__ import annotations

import json
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional


def render_mini_run_on_lambda(
    manifest_data: Dict[str, Any],
    *,
    region: Optional[str] = None,
    function_name: Optional[str] = None,
    serve_url: Optional[str] = None,
    output_path: Optional[str] = None,
    frames_per_lambda: int = 20,
) -> Dict[str, Any]:
    """Execute a distributed Remotion Mini Run render across AWS Lambda functions."""
    region = region or os.environ.get("REMOTION_AWS_REGION", "us-east-1")
    serve_url = serve_url or os.environ.get("REMOTION_SERVE_URL")
    function_name = function_name or os.environ.get("REMOTION_AWS_FUNCTION_NAME")

    # Write manifest data to temporary file
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as tmp:
        json.dump(manifest_data, tmp, indent=2)
        tmp_manifest = tmp.name

    try:
        remotion_dir = Path(__file__).resolve().parent.parent / "remotion-app"
        cmd = [
            "npx",
            "tsx",
            "scripts/lambda-render.ts",
            tmp_manifest,
        ]

        env = os.environ.copy()
        if region:
            env["REMOTION_AWS_REGION"] = region
        if serve_url:
            env["REMOTION_SERVE_URL"] = serve_url
        if function_name:
            env["REMOTION_AWS_FUNCTION_NAME"] = function_name

        result = subprocess.run(
            cmd,
            cwd=str(remotion_dir),
            env=env,
            capture_output=True,
            text=True,
            check=True,
        )

        return {
            "status": "success",
            "stdout": result.stdout,
            "manifestPath": tmp_manifest,
        }
    except subprocess.CalledProcessError as err:
        return {
            "status": "error",
            "error": str(err),
            "stderr": err.stderr,
            "stdout": err.stdout,
        }
    finally:
        if os.path.exists(tmp_manifest):
            try:
                os.remove(tmp_manifest)
            except OSError:
                pass
