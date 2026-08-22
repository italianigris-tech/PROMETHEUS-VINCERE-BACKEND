import os
import sys
import json
import wave
import numpy as np

studio_dir = "/home/ec2-user/PROMETHEUS-CORE-BACKEND/docs/mini_run_studio"
repo_root = "/home/ec2-user/PROMETHEUS-CORE-BACKEND"
manifest_path = os.path.join(studio_dir, "authoritative_sound_treatment.json")
ffmpeg_bin = "/home/ec2-user/PROMETHEUS-CORE-BACKEND/remotion-app/node_modules/@remotion/compositor-linux-x64-gnu/ffmpeg"
output_wav = os.path.join(studio_dir, "master_sfx_track.wav")

with open(manifest_path, "r") as f:
    data = json.load(f)

sample_rate = 44100
total_duration = 60.5
total_samples = int(total_duration * sample_rate)

# Stereo Master Buffer
master_left = np.zeros(total_samples, dtype=np.float32)
master_right = np.zeros(total_samples, dtype=np.float32)

audio_cache = {}

def extract_transient_aligned_audio(rel_path, category, target_dur_sec):
    full_path = os.path.join(repo_root, rel_path)
    
    # 1. Convert to 44.1kHz stereo PCM
    tmp_raw = os.path.join(studio_dir, "tmp_sample.wav")
    cmd = f'"{ffmpeg_bin}" -i "{full_path}" -ar 44100 -ac 2 "{tmp_raw}" -y -v quiet'
    os.system(cmd)
    
    if not os.path.exists(tmp_raw):
        return None
        
    wf = wave.open(tmp_raw, "rb")
    n_frames = wf.getnframes()
    raw = wf.readframes(n_frames)
    wf.close()
    
    samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    stereo = samples.reshape(-1, 2)
    mono = np.max(np.abs(stereo), axis=1)
    
    # 2. Transient Onset Detection (Find true start of sound, skip leading silence)
    max_amp = np.max(mono) if len(mono) > 0 else 0
    if max_amp < 0.005:
        return None
        
    thresh = max(0.02, max_amp * 0.08)
    onset_candidates = np.where(mono > thresh)[0]
    
    if len(onset_candidates) > 0:
        # Start 15ms before the threshold breach to preserve attack transient
        start_idx = max(0, onset_candidates[0] - int(0.015 * sample_rate))
    else:
        start_idx = 0
        
    # 3. Determine Duration from Onset Point
    if category in ("WHOOSHES", "SWOOSHES"):
        # Whooshes are exceptions: allow full sweep up to 1.1s
        dur_from_onset = min(1.10, max(0.60, target_dur_sec))
    elif category == "TRANSITIONS":
        dur_from_onset = min(0.65, max(0.40, target_dur_sec))
    elif category == "TEXT":
        # Single crisp keystroke strike only (0.22s from onset)
        dur_from_onset = 0.22
    elif category in ("UI INTERFACE", "DATA TELEMETRY"):
        # Single crisp micro-pop / digit blip (0.18s from onset)
        dur_from_onset = 0.18
    elif category == "MECHANICAL CLICKS":
        dur_from_onset = 0.20
    else:
        dur_from_onset = 0.30
        
    end_idx = min(len(stereo), start_idx + int(dur_from_onset * sample_rate))
    extracted = stereo[start_idx:end_idx].copy()
    
    if len(extracted) < 100:
        return None
        
    # 4. Smooth Fade-In and Cosine Fade-Out Windowing
    fade_in_len = min(len(extracted) // 4, int(0.006 * sample_rate)) # 6ms fade-in
    fade_out_len = min(len(extracted) // 3, int(0.035 * sample_rate)) # 35ms smooth cosine decay
    
    if fade_in_len > 0:
        extracted[:fade_in_len, :] *= np.linspace(0.0, 1.0, fade_in_len)[:, np.newaxis]
        
    if fade_out_len > 0:
        t_fade = np.linspace(0.0, np.pi/2.0, fade_out_len)
        fade_curve = np.cos(t_fade)**2
        extracted[-fade_out_len:, :] *= fade_curve[:, np.newaxis]
        
    return extracted

print(f"Mixing {len(data['treatments'])} transient-aligned luxury sound cues...")

successful_cues = 0
for t in data["treatments"]:
    s_time = t["timestampSeconds"]
    s_file = t["soundDesign"]["soundFile"]
    s_cat = t["soundDesign"]["category"]
    s_dur = t["soundDesign"].get("durationEstimateSec", 0.25)
    pan = t["soundDesign"]["stereoPan"]
    gain_db = t["soundDesign"]["gainDb"]
    
    linear_gain = 10.0 ** (gain_db / 20.0)
    
    pan_norm = (pan + 1.0) / 2.0
    gain_left = linear_gain * np.cos(pan_norm * np.pi / 2.0)
    gain_right = linear_gain * np.sin(pan_norm * np.pi / 2.0)
    
    audio = extract_transient_aligned_audio(s_file, s_cat, s_dur)
    if audio is None:
        print(f"⚠️ Warning: Could not extract transient for cue at {s_time}s ({s_file})")
        continue
        
    start_sample = int(s_time * sample_rate)
    num_samples = len(audio)
    end_sample = min(total_samples, start_sample + num_samples)
    actual_len = end_sample - start_sample
    
    if actual_len > 0:
        master_left[start_sample:end_sample] += audio[:actual_len, 0] * gain_left
        master_right[start_sample:end_sample] += audio[:actual_len, 1] * gain_right
        successful_cues += 1

print(f"✓ Successfully placed {successful_cues}/{len(data['treatments'])} audible transient cues!")

# Master Peak Limiter (-1.5 dB ceiling)
max_peak = max(np.max(np.abs(master_left)), np.max(np.abs(master_right)))
if max_peak > 0.85:
    norm_factor = 0.85 / max_peak
    master_left *= norm_factor
    master_right *= norm_factor
    print(f"Applied master limiter (Peak: {max_peak:.2f} -> 0.85)")

interleaved = np.empty((total_samples, 2), dtype=np.float32)
interleaved[:, 0] = master_left
interleaved[:, 1] = master_right
int_samples = np.clip(interleaved * 32767.0, -32768, 32767).astype(np.int16)

wf = wave.open(output_wav, "wb")
wf.setnchannels(2)
wf.setsampwidth(2)
wf.setframerate(sample_rate)
wf.writeframes(int_samples.tobytes())
wf.close()

print(f"✓ Pristine transient-aligned master track written: {output_wav}")
