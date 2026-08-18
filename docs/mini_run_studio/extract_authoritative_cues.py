import os
import sys
import json
import cv2
import numpy as np

VIDEO_PATH = "/home/ec2-user/PROMETHEUS-CORE-BACKEND/docs/mini_run_studio/uploaded_input_video.mp4"
OUTPUT_JSON = "/home/ec2-user/PROMETHEUS-CORE-BACKEND/docs/mini_run_studio/authoritative_video_cues.json"

print("=================================================")
print("PROMETHEUS DEEP FRAME-BY-FRAME CUE EXTRACTOR")
print("=================================================")

cap = cv2.VideoCapture(VIDEO_PATH)
fps = cap.get(cv2.CAP_PROP_FPS) or 23.976
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
duration_sec = total_frames / fps

print(f"Analyzing {total_frames} frames ({duration_sec:.2f}s @ {fps:.2f} fps)...")

cues = []
prev_gray = None
prev_hist = None

h_half, w_half = height // 2, width // 2
grid_y, grid_x = np.mgrid[0:h_half, 0:w_half]
c_x = (grid_x - w_half/2.0) / (w_half/2.0)
c_y = (grid_y - h_half/2.0) / (h_half/2.0)
dist = np.sqrt(c_x**2 + c_y**2)
dist[dist == 0] = 1.0

frame_num = 0
sample_interval = 1 # Inspect EVERY SINGLE FRAME for sub-frame accuracy

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break

    timestamp = round(frame_num / fps, 3)
    small = cv2.resize(frame, (w_half, h_half))
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)

    # 1. Histogram Scene Cut Check
    hist = cv2.calcHist([gray], [0], None, [32], [0, 256])
    cv2.normalize(hist, hist, alpha=0, beta=1, norm_type=cv2.NORM_MINMAX)

    if prev_hist is not None:
        hist_diff = cv2.compareHist(prev_hist, hist, cv2.HISTCMP_BHATTACHARYYA)
        if hist_diff > 0.40:
            cues.append({
                "timestampSeconds": timestamp,
                "frame": frame_num,
                "type": "scene_cut",
                "elementName": f"Scene Cut #{len([c for c in cues if c['type'] == 'scene_cut']) + 1}",
                "description": f"Hard scene transition (Visual divergence: {hist_diff:.2f})",
                "screenXPercent": 50,
                "screenYPercent": 50,
                "stereoPan": 0.0,
                "depthPlane": 30,
                "visualMagnitude": round(float(hist_diff), 3)
            })

    # 2. Optical Flow Motion Analysis
    if prev_gray is not None:
        flow = cv2.calcOpticalFlowFarneback(
            prev_gray, gray, None,
            pyr_scale=0.5, levels=2, winsize=13,
            iterations=2, poly_n=5, poly_sigma=1.1, flags=0
        )
        u, v = flow[..., 0], flow[..., 1]
        
        # Radial Expansion (Zoom In vs Zoom Out)
        radial = np.mean((u * (c_x / dist) + v * (c_y / dist)))
        mean_u = np.mean(u)
        mag = np.mean(np.sqrt(u**2 + v**2))

        # Detect High-Speed Zoom In Punch
        if radial > 0.65:
            cues.append({
                "timestampSeconds": timestamp,
                "frame": frame_num,
                "type": "zoom_in_punch",
                "elementName": "Camera Zoom-In Punch",
                "description": f"Fast focal push / impact frame (Scale velocity: {radial:.2f})",
                "screenXPercent": 50,
                "screenYPercent": 45,
                "stereoPan": 0.0,
                "depthPlane": 30,
                "visualMagnitude": round(float(radial), 3)
            })
        elif radial < -0.65:
            cues.append({
                "timestampSeconds": timestamp,
                "frame": frame_num,
                "type": "zoom_out_pull",
                "elementName": "Camera Pull-Back Release",
                "description": f"Camera wide framing pull-back (Release velocity: {abs(radial):.2f})",
                "screenXPercent": 50,
                "screenYPercent": 50,
                "stereoPan": 0.0,
                "depthPlane": 10,
                "visualMagnitude": round(float(abs(radial)), 3)
            })

        # Detect Lateral Whip Pan
        if abs(mean_u) > 1.3:
            pan_direction = "camera_pan_left" if mean_u < 0 else "camera_pan_right"
            pan_val = np.clip(mean_u / 3.0, -1.0, 1.0)
            x_pct = 25 if mean_u < 0 else 75
            cues.append({
                "timestampSeconds": timestamp,
                "frame": frame_num,
                "type": pan_direction,
                "elementName": f"Directional Whip Pan ({'Left' if mean_u < 0 else 'Right'})",
                "description": f"Lateral camera motion (Velocity: {mean_u:.2f}px/f)",
                "screenXPercent": x_pct,
                "screenYPercent": 50,
                "stereoPan": round(float(pan_val), 2),
                "depthPlane": 20,
                "visualMagnitude": round(float(abs(mean_u)), 3)
            })

        # 3. Detect Regional Typography & Asset Pop-ins
        # Check quadrants for localized high contrast appearance
        diff = cv2.absdiff(prev_gray, gray)
        thresh = cv2.threshold(diff, 30, 255, cv2.THRESH_BINARY)[1]
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if 1500 < area < 45000: # Typical text box / card / asset bounding box
                x, y, w, h = cv2.boundingRect(cnt)
                center_x_pct = round(((x + w/2) / w_half) * 100, 1)
                center_y_pct = round(((y + h/2) / h_half) * 100, 1)
                stereo_pan = round(np.clip((center_x_pct - 50.0) / 40.0, -1.0, 1.0), 2)
                
                # Determine element type based on aspect ratio & position
                aspect = w / float(h)
                if aspect > 2.0:
                    el_type = "typography_text_pop"
                    el_name = "Kinetic Typography Header"
                    depth = 30
                elif 0.7 <= aspect <= 1.4:
                    el_type = "asset_intro"
                    el_name = "Graphic Sticker / Icon Asset"
                    depth = 20
                else:
                    el_type = "ui_card_reveal"
                    el_name = "UI Card / Pill Highlight"
                    depth = 20

                cues.append({
                    "timestampSeconds": timestamp,
                    "frame": frame_num,
                    "type": el_type,
                    "elementName": el_name,
                    "description": f"Visual element entrance at ({center_x_pct}%, {center_y_pct}%) [Area: {int(area)}px]",
                    "screenXPercent": center_x_pct,
                    "screenYPercent": center_y_pct,
                    "stereoPan": stereo_pan,
                    "depthPlane": depth,
                    "visualMagnitude": round(float(area / 1000.0), 2)
                })

    prev_gray = gray
    prev_hist = hist
    frame_num += 1

cap.release()

# Deduplicate close events within 0.25s clustering window
clustered = []
for c in sorted(cues, key=lambda x: x["timestampSeconds"]):
    if not clustered:
        clustered.append(c)
        continue
    last = clustered[-1]
    if c["timestampSeconds"] - last["timestampSeconds"] > 0.25 or c["type"] != last["type"]:
        clustered.append(c)
    else:
        if c.get("visualMagnitude", 0) > last.get("visualMagnitude", 0):
            clustered[-1] = c

manifest = {
    "videoMetadata": {
        "filePath": VIDEO_PATH,
        "width": width,
        "height": height,
        "fps": round(fps, 2),
        "totalFrames": total_frames,
        "durationSeconds": round(duration_sec, 2),
        "aspectRatio": "9:16",
        "audioStatus": "muted"
    },
    "totalCues": len(clustered),
    "cueBreakdown": {
        "scene_cuts": len([c for c in clustered if c["type"] == "scene_cut"]),
        "zooms": len([c for c in clustered if "zoom" in c["type"]]),
        "camera_pans": len([c for c in clustered if "pan" in c["type"]]),
        "typography_text": len([c for c in clustered if "typography" in c["type"]]),
        "asset_introductions": len([c for c in clustered if "asset" in c["type"] or "card" in c["type"]]),
    },
    "cues": clustered
}

with open(OUTPUT_JSON, "w") as f:
    json.dump(manifest, f, indent=2)

print("\n=================================================")
print("✅ AUTHORITATIVE CUE EXTRACTION COMPLETE:")
print(f" - Total Structured Visual Cues: {len(clustered)}")
print(f" - Scene Cuts: {manifest['cueBreakdown']['scene_cuts']}")
print(f" - Zoom Punches / Pulls: {manifest['cueBreakdown']['zooms']}")
print(f" - Directional Whip Pans: {manifest['cueBreakdown']['camera_pans']}")
print(f" - Kinetic Typography Pops: {manifest['cueBreakdown']['typography_text']}")
print(f" - Asset & Card Introductions: {manifest['cueBreakdown']['asset_introductions']}")
print(f" - Saved Authoritative Manifest: {OUTPUT_JSON}")
print("=================================================")
