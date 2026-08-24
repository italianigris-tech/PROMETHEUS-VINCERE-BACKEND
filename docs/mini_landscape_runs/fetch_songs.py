#!/usr/bin/env python3
"""
fetch_songs.py — download the REAL songs the soundtrack baker bridges to.

The seed catalogue carries fingerprints but no audio. The actual literal songs
(classical, cinematic trailer, hip-hop, lo-fi, motivational) live in Cloudflare
R2 bucket `prometheus-music` under `music-originals/`. This script downloads
just the files the current SEED_TO_REAL / SEED_TO_REAL_ALT mapping needs into
./music/ so bake_soundtrack.py has real audio to mix.

Credentials resolution order:
  1. environment (R2_ENDPOINT/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET_NAME)
  2. Modal secret `prometheus-shared-env` (the deployment home of the R2 keys)

Usage:
  python3 docs/mini_landscape_runs/fetch_songs.py
"""
import json
import os
import subprocess
import sys
import tempfile

import bake_soundtrack as bk

MUSIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "music")
R2_SONG_PREFIX = "music-originals/"

# R2 object key per song file (mirrors the bucket layout discovered from
# prometheus-music/music-originals/<category>/<track>.mp3)
SONG_OBJECT_KEYS: dict[str, str] = {
    "epic-cinematic-dramatic-adventure-trailer.mp3": "cinematic-trailer-epic/epic-cinematic-dramatic-adventure-trailer.mp3",
    "epic-inspiration.mp3":                            "cinematic-trailer-epic/epic-inspiration.mp3",
    "passacaglia-handel-halvorsen-relaxing-piano-music.mp3": "classical/passacaglia-handel-halvorsen-relaxing-piano-music.mp3",
    "vivaldi-the-four-seasons-summer-violin-concerto-in-g-minor-op-8-2-rv-315-iii-presto.mp3": "classical-orchestral-prestige/vivaldi-the-four-seasons-summer-violin-concerto-in-g-minor-op-8-2-rv-315-iii-presto.mp3",
    "triumph.mp3":                                    "motivational-uplift/triumph.mp3",
    "the-way-instrumental.mp3":                       "lo-fi-chill-soft-focus/the-way-instrumental.mp3",
}


def load_r2_env() -> dict:
    env = {
        "endpoint": os.environ.get("R2_ENDPOINT", ""),
        "access_key_id": os.environ.get("R2_ACCESS_KEY_ID", ""),
        "secret_access_key": os.environ.get("R2_SECRET_ACCESS_KEY", ""),
        "bucket": os.environ.get("R2_BUCKET_NAME", "") or os.environ.get("R2_BUCKET", "") or "prometheus-music",
        "account_id": os.environ.get("R2_ACCOUNT_ID", ""),
    }
    if all([env["endpoint"], env["access_key_id"], env["secret_access_key"]]):
        return env

    # Fallback: pull the R2 env vars from the Modal secret used by the deployed
    # studio (mini_run_pipeline/storage.py reads the same names).
    try:
        import modal
    except ImportError:
        print("Modal SDK not installed; cannot resolve R2 credentials.", file=sys.stderr)
        sys.exit(1)

    app = modal.App("fetch-songs")
    secret = modal.Secret.from_name("prometheus-shared-env")

    @app.function(secrets=[secret])
    def read_r2_env():
        return {
            "endpoint": os.environ.get("R2_ENDPOINT", ""),
            "access_key_id": os.environ.get("R2_ACCESS_KEY_ID", ""),
            "secret_access_key": os.environ.get("R2_SECRET_ACCESS_KEY", ""),
            "bucket": os.environ.get("R2_BUCKET_NAME", "") or "prometheus-music",
            "account_id": os.environ.get("R2_ACCOUNT_ID", ""),
        }

    with app.run():
        resolved = read_r2_env.remote()
    resolved["bucket"] = resolved["bucket"] or "prometheus-music"
    if not resolved["endpoint"] and resolved["account_id"]:
        resolved["endpoint"] = f"https://{resolved['account_id']}.r2.cloudflarestorage.com"
    return resolved


def main() -> int:
    os.makedirs(MUSIC_DIR, exist_ok=True)
    env = load_r2_env()
    if not all([env["endpoint"], env["access_key_id"], env["secret_access_key"]]):
        print("R2 credentials not configured (set R2_ENDPOINT/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY).", file=sys.stderr)
        return 1

    try:
        import boto3
    except ImportError:
        print("boto3 not installed.", file=sys.stderr)
        return 1

    client = boto3.client(
        "s3",
        endpoint_url=env["endpoint"],
        aws_access_key_id=env["access_key_id"],
        aws_secret_access_key=env["secret_access_key"],
        region_name="auto",
    )

    wanted: set[str] = set(bk.SEED_TO_REAL.values()) | set(bk.SEED_TO_REAL_ALT.values())
    for name in sorted(wanted):
        key = SONG_OBJECT_KEYS.get(name)
        if not key:
            print(f"  SKIP {name} (no R2 object key registered)")
            continue
        local = os.path.join(MUSIC_DIR, name)
        if os.path.exists(local) and os.path.getsize(local) > 0:
            print(f"  OK   {name} (cached)")
            continue
        print(f"  GET  {R2_SONG_PREFIX}{key}")
        client.download_file(Bucket=env["bucket"], Key=R2_SONG_PREFIX + key, Filename=local)
        print(f"       -> {local} ({os.path.getsize(local)} bytes)")

    print(f"\nSongs ready in {MUSIC_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
