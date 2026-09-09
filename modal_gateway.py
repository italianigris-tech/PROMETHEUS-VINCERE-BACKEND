"""Modal Serverless Deployment for Prometheus Vincere AI Gateway (MCP & OpenAPI).

Deploy with:
    modal deploy modal_gateway.py

Cost discipline:
    - min_containers = 0 (scales to zero when idle: 0 credit drain)
    - scaledown_window = 60 (spins down 60s after last Claude/ChatGPT request)
    - cpu = 1, memory = 1024 (runs on lightweight CPU, fraction of a cent per call)
    - requires_proxy_auth = False (allows Claude and ChatGPT to connect via Bearer PAT tokens)
"""

from pathlib import Path, PurePosixPath
import os
import subprocess
import modal

APP_NAME = "prometheus-ai-gateway"
APP_ROOT = PurePosixPath("/opt/prometheus")
BACKEND_ROOT = APP_ROOT / "backend"
GATEWAY_PORT = 3100

local_root = Path(__file__).resolve().parent

def local(relative_path: str) -> str:
    return str(local_root / relative_path)

gateway_image = (
    modal.Image.from_registry("node:22-bookworm-slim", add_python="3.12")
    .apt_install("ca-certificates")
    .run_commands("npm install -g tsx")
    .add_local_file(local("backend/package.json"), f"{BACKEND_ROOT}/package.json", copy=True)
    .add_local_file(local("backend/tsconfig.json"), f"{BACKEND_ROOT}/tsconfig.json", copy=True)
    .add_local_dir(local("backend/src/gateway"), f"{BACKEND_ROOT}/src/gateway", copy=True)
    .workdir(str(BACKEND_ROOT))
)

app = modal.App(APP_NAME)

@app.function(
    image=gateway_image,
    cpu=1.0,
    memory=1024,
    min_containers=0,
    max_containers=4,
    scaledown_window=60,
    timeout=10 * 60,
)
@modal.concurrent(max_inputs=50)
@modal.web_server(
    port=GATEWAY_PORT,
    startup_timeout=2 * 60,
    label="gateway",
    requires_proxy_auth=False,
)
def gateway() -> None:
    """Serve the Prometheus Vincere MCP and OpenAPI Gateway on Modal."""
    runtime_env = os.environ.copy()
    runtime_env.update(
        {
            "PORT": str(GATEWAY_PORT),
            "GATEWAY_PORT": str(GATEWAY_PORT),
            "NODE_ENV": "production",
        }
    )
    subprocess.Popen(
        ["tsx", "src/gateway/server.ts"],
        cwd=str(BACKEND_ROOT),
        env=runtime_env,
    )
