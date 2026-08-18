import os
import sys
import json
import math
import wave
import struct
import cv2
import numpy as np

VIDEO_PATH = "/home/ec2-user/PROMETHEUS-CORE-BACKEND/docs/mini_run_studio/uploaded_input_video.mp4"
AUDIO_PATH = "/home/ec2-user/PROMETHEUS-CORE-BACKEND/docs/mini_run_studio/extracted_audio.wav"
OUTPUT_JSON = "/home/ec2-user/PROMETHEUS-CORE-BACKEND/docs/mini_run_studio/extracted_temporal_manifest.json"

print("=================================================")
print("PROMETHEUS TEMPORAL CUE & MOTION EXTRACTOR")
print("=================================================")

if not os.path.exists(VIDEO_PATH):
    print(f"Error: Video file not found at {VIDEO_PATH}")
    sys.exit(1)

# 1. Video Analysis
cap = cv2.VideoCapture(VIDEO_PATH)
fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
duration_sec = total_frames / fps

print(f"Video Specs: {width}x{height} @ {fps:.2f} fps | {total_frames} frames ({duration_sec:.2f}s)")

# Track motion, scene cuts, zoom cues, text pop-ins
scene_cuts = []
zoom_events = []
pan_events = []
motion_spikes = []

prev_gray = None
prev_hist = None

frame_idx = 0
sample_step = 2 # Process every 2nd frame for speed (12-15 fps sample rate)

h_center, w_center = height / 2.0, width / 2.0
# Coordinate grid for radial divergence (zoom detection)
y_coords, x_coords = np.mgrid[0:height:sample_step, 0:width:sample_step]
rad_x = (x_coords - w_center) / w_center
rad_y = (y_coords - h_center) / h_center
rad_dist = np.sqrt(rad_x**2 + rad_y**2)
rad_dist[rad_dist == 0] = 1.0 # avoid div by zero
norm_rad_x = rad_x / rad_dist
norm_rad_y = rad_y / rad_dist

print(f"Analyzing video dynamics across {total_frames} frames...")

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break
    
    if frame_idx % sample_step != 0:
        frame_idx += 1
        continue
    
    timestamp = frame_idx / fps
    small_frame = cv2.resize(frame, (width // 2, height // 2))
    gray = cv2.cvtColor(small_frame, cv2.COLOR_BGR2GRAY)
    
    # 1. Histogram for Scene Cuts
    hist = cv2.calcHist([gray], [0], None, [32], [0, 256])
    cv2.normalize(hist, hist, alpha=0, beta=1, norm_type=cv2.NORM_MINMAX)
    
    if prev_hist is not None:
        hist_diff = cv2.compareHist(prev_hist, hist, cv2.HISTCMP_BHATTACHARYYA)
        if hist_diff > 0.42: # Hard scene cut threshold
            scene_cuts.append({
                "timestampSeconds": round(timestamp, 3),
                "frame": frame_idx,
                "score": round(float(hist_diff), 3),
                "type": "hard_scene_cut"
            })
            
    # 2. Optical Flow for Zoom / Motion
    if prev_gray is not None:
        flow = cv2.calcOpticalFlowFarneback(
            prev_gray, gray, None, 
            pyr_scale=0.5, levels=3, winsize=15, 
            iterations=3, poly_n=5, poly_sigma=1.2, flags=0
        )
        u = flow[..., 0] # horizontal
        v = flow[..., 1] # vertical
        
        # Radial projection (Divergence = Zoom In / Zoom Out)
        # Rescale coordinate grids to match small_frame
        curr_h, curr_w = gray.shape
        grid_y, grid_x = np.mgrid[0:curr_h, 0:curr_w]
        c_x, c_y = (grid_x - curr_w/2.0) / (curr_w/2.0), (grid_y - curr_h/2.0) / (curr_h/2.0)
        dist = np.sqrt(c_x**2 + c_y**2)
        dist[dist == 0] = 1.0
        
        radial_motion = np.mean((u * (c_x/dist) + v * (c_y/dist)))
        mean_u = np.mean(u)
        motion_mag = np.mean(np.sqrt(u**2 + v**2))
        
        # Detect Zoom Punch (> 0.60 radial expansion)
        if radial_motion > 0.45:
            zoom_events.append({
                "timestampSeconds": round(timestamp, 3),
                "frame": frame_idx,
                "type": "zoom_in_punch",
                "magnitude": round(float(radial_motion), 3)
            })
        elif radial_motion < -0.45:
            zoom_events.append({
                "timestampSeconds": round(timestamp, 3),
                "frame": frame_idx,
                "type": "zoom_out_pull",
                "magnitude": round(float(abs(radial_motion)), 3)
            })
            
        # Detect Lateral Whip Pan
        if abs(mean_u) > 1.2:
            pan_events.append({
                "timestampSeconds": round(timestamp, 3),
                "frame": frame_idx,
                "type": "camera_pan_left" if mean_u < 0 else "camera_pan_right",
                "panVelocity": round(float(mean_u), 3),
                "stereoPanTarget": round(float(np.clip(mean_u / 3.0, -1.0, 1.0)), 2)
            })
            
        # Detect Regional Visual Pop-in (e.g. text/graphic entrance)
        if motion_mag > 2.0:
            motion_spikes.append({
                "timestampSeconds": round(timestamp, 3),
                "frame": frame_idx,
                "type": "kinetic_visual_burst",
                "intensity": round(float(motion_mag), 3)
            })
            
    prev_gray = gray
    prev_hist = hist
    frame_idx += 1

cap.release()

# 2. Audio Energy Envelope Analysis
audio_events = []
if os.path.exists(AUDIO_PATH):
    print("Analyzing audio envelope & vocal cadence...")
    wf = wave.open(AUDIO_PATH, "rb")
    n_channels = wf.getnchannels()
    sampwidth = wf.getsampwidth()
    framerate = wf.getframerate()
    n_frames = wf.getnframes()
    
    # Process in 100ms blocks
    block_size = int(framerate * 0.1) # 100ms
    raw_data = wf.readframes(n_frames)
    wf.close()
    
    total_samples = len(raw_data) // (sampwidth * n_channels)
    audio_data = struct.unpack(f"{total_samples}h", raw_data[:total_samples*2])
    audio_arr = np.array(audio_data, dtype=np.float32) / 32768.0
    
    # Compute RMS energy curve
    num_blocks = len(audio_arr) // block_size
    energy_curve = []
    for b in range(num_blocks):
        block = audio_arr[b*block_size:(b+1)*block_size]
        rms = float(np.sqrt(np.mean(block**2)))
        t_sec = (b * 0.1)
        energy_curve.append({"t": round(t_sec, 2), "rms": round(rms, 4)})
        
    # Detect high vocal peaks and silence gaps
    rms_vals = [e["rms"] for e in energy_curve]
    avg_rms = np.mean(rms_vals) if rms_vals else 0.05
    peak_rms = np.max(rms_vals) if rms_vals else 0.2
    
    for e in energy_curve:
        if e["rms"] > avg_rms * 1.8 and e["rms"] > 0.08:
            audio_events.append({
                "timestampSeconds": e["t"],
                "type": "vocal_energy_peak",
                "intensity": round(e["rms"] / peak_rms, 2)
            })
        elif e["rms"] < 0.015:
            audio_events.append({
                "timestampSeconds": e["t"],
                "type": "speech_gap_pause",
                "intensity": round(e["rms"], 4)
            })

# Deduplicate close events within 0.3s window
def cluster_events(events, time_key="timestampSeconds", window=0.4):
    clustered = []
    for ev in events:
        if not clustered:
            clustered.append(ev)
            continue
        last = clustered[-1]
        if ev[time_key] - last[time_key] > window or ev["type"] != last["type"]:
            clustered.append(ev)
        else:
            # Keep higher magnitude/score
            if "magnitude" in ev and ev.get("magnitude", 0) > last.get("magnitude", 0):
                clustered[-1] = ev
            elif "score" in ev and ev.get("score", 0) > last.get("score", 0):
                clustered[-1] = ev
    return clustered

filtered_cuts = cluster_events(scene_cuts, window=0.5)
filtered_zooms = cluster_events(zoom_events, window=0.4)
filtered_pans = cluster_events(pan_events, window=0.4)
filtered_bursts = cluster_events(motion_spikes, window=0.35)

manifest = {
    "videoMetadata": {
        "filePath": VIDEO_PATH,
        "width": width,
        "height": height,
        "fps": round(fps, 2),
        "totalFrames": total_frames,
        "durationSeconds": round(duration_sec, 2),
        "aspectRatio": "9:16" if height > width else "16:9",
    },
    "sceneCuts": filtered_cuts,
    "zoomEvents": filtered_zooms,
    "panEvents": filtered_pans,
    "visualBursts": filtered_bursts,
    "audioEnergyPeaks": cluster_events([e for e in audio_events if e["type"] == "vocal_energy_peak"], window=0.5),
    "speechPauses": cluster_events([e for e in audio_events if e["type"] == "speech_gap_pause"], window=0.5),
}

with open(OUTPUT_JSON, "w") as f:
    json.dump(manifest, f, indent=2)

print("\n=================================================")
print("✅ EXTRACTION COMPLETE:")
print(f" - Duration: {manifest['videoMetadata']['durationSeconds']}s")
print(f" - Scene Cuts Detected: {len(filtered_cuts)}")
print(f" - Zoom Punches / Pulls Detected: {len(filtered_zooms)}")
print(f" - Camera Pan Moves Detected: {len(filtered_pans)}")
print(f" - Kinetic Visual Bursts (Text/Pop-ins): {len(filtered_bursts)}")
print(f" - Saved Temporal Manifest: {OUTPUT_JSON}")
print("=================================================")
