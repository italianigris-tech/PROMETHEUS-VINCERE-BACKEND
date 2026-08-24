import json
import modal
import time
import os
import sys

app = modal.App("test_mini_run")
vol = modal.Volume.from_name("prometheus-render-artifacts")

@app.local_entrypoint()
def main():
    f = modal.Function.from_name("prometheus-mini-run-studio", "run_mini_run")
    payload = {
        "source": {"path": "/opt/prometheus/LANDSCAPE VIDEOS FOR USE/Unedited Videos Made Me a Better Editor_ Here's How....mp4"},
        "metadata": {"pipeline": "minirun"},
        "design": {"aspectRatio": "9:16"}
    }
    print("Sending request to Modal...")
    start = time.time()
    try:
        res = f.remote(payload)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
    end = time.time()
    
    print(f"Time taken: {end - start:.2f} seconds")
    print("Result summary:", {k: v for k, v in res.items() if k != "fontManifest"})
    
    output_url = res.get("outputUrl")
    output_path = res.get("outputPath")
    dest_video = "/home/ec2-user/PROMETHEUS-CORE-BACKEND/prometheus_kinetic_editorial_master.mp4"
    dest_manifest = "/home/ec2-user/PROMETHEUS-CORE-BACKEND/final_font_manifest.json"

    if output_url:
        import urllib.request
        print(f"Downloading master video from presigned URL to '{dest_video}'...")
        urllib.request.urlretrieve(output_url, dest_video)
        print(f"Video downloaded successfully ({os.path.getsize(dest_video) / (1024*1024):.2f} MB)")
    elif output_path:
        remote_path = output_path.replace("/data/", "").lstrip("/")
        print(f"Streaming full video from volume '{remote_path}' to '{dest_video}'...")
        bytes_written = 0
        with open(dest_video, "wb") as out_f:
            for chunk in vol.read_file(remote_path):
                out_f.write(chunk)
                bytes_written += len(chunk)
        print(f"Video downloaded completely ({bytes_written / (1024*1024):.2f} MB)")
    
    font_manifest = res.get("fontManifest")
    if font_manifest:
        with open(dest_manifest, "w", encoding="utf-8") as out_m:
            json.dump(font_manifest, out_m, indent=2)
        print("Manifest written directly from result!")
    elif output_path:
        try:
            remote_manifest = (os.path.dirname(output_path.replace("/data/", "").lstrip("/")) + "/font_manifest.json")
            with open(dest_manifest, "wb") as out_m:
                for chunk in vol.read_file(remote_manifest):
                    out_m.write(chunk)
            print("Manifest downloaded from volume!")
        except Exception as e:
            print(f"Warning downloading manifest: {e}")

if __name__ == "__main__":
    main()
