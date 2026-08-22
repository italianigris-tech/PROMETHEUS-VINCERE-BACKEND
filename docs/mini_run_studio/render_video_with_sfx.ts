import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";

const studioDir = __dirname;
const repoRoot = path.resolve(studioDir, "../..");
const ffmpegBin = path.join(repoRoot, "remotion-app/node_modules/@remotion/compositor-linux-x64-gnu/ffmpeg");

const inputVideo = path.join(studioDir, "uploaded_input_video.mp4");
const soundManifestPath = path.join(studioDir, "authoritative_sound_treatment.json");
const outputVideo = path.join(studioDir, "video_with_real_sfx.mp4");

console.log("=================================================");
console.log("PROMETHEUS REAL SFX AUDIO MIXER & BAKER");
console.log("=================================================");

const manifest = JSON.parse(fs.readFileSync(soundManifestPath, "utf8"));
const treatments = manifest.treatments;

console.log(`Baking ${treatments.length} real audio sound cues into video...`);

// Group cues to prevent exceeding max FFmpeg input limits by creating an audio mixdown
// We'll generate an audio timeline script using FFmpeg filter_complex or SoX/Python
const scriptPath = path.join(studioDir, "mix_audio_timeline.py");
const pythonCode = `
import os
import json
import wave
import struct
import numpy as np

studio_dir = "${studioDir}"
repo_root = "${repoRoot}"
manifest_path = "${soundManifestPath}"
ffmpeg_bin = "${ffmpegBin}"
output_wav = os.path.join(studio_dir, "master_sfx_track.wav")


with open(manifest_path, "r") as f:
    data = json.load(f)

sample_rate = 44100
total_duration = 60.5
total_samples = int(total_duration * sample_rate)

# Stereo Master Buffer
master_left = np.zeros(total_samples, dtype=np.float32)
master_right = np.zeros(total_samples, dtype=np.float32)

# Audio File Cache
audio_cache = {}

def load_audio_file(rel_path):
    full_path = os.path.join(repo_root, rel_path)
    if full_path in audio_cache:
        return audio_cache[full_path]
    
    # Use ffmpeg to convert to 44.1kHz stereo float32 raw PCM
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
    audio_cache[full_path] = stereo
    return stereo

print(f"Mixing {len(data['treatments'])} sound cues into master stereo audio stream...")

for t in data["treatments"]:
    s_time = t["timestampSeconds"]
    s_file = t["soundDesign"]["soundFile"]
    pan = t["soundDesign"]["stereoPan"] # -1.0 to +1.0
    gain_db = t["soundDesign"]["gainDb"]
    
    linear_gain = 10.0 ** (gain_db / 20.0)
    
    # Stereo panning law
    # pan = -1.0 -> left=1.0, right=0.0
    # pan = 0.0 -> left=0.707, right=0.707
    # pan = +1.0 -> left=0.0, right=1.0
    pan_norm = (pan + 1.0) / 2.0 # 0.0 to 1.0
    gain_left = linear_gain * np.cos(pan_norm * np.pi / 2.0)
    gain_right = linear_gain * np.sin(pan_norm * np.pi / 2.0)
    
    audio = load_audio_file(s_file)
    if audio is None:
        continue
        
    start_sample = int(s_time * sample_rate)
    num_samples = len(audio)
    end_sample = min(total_samples, start_sample + num_samples)
    actual_len = end_sample - start_sample
    
    if actual_len > 0:
        master_left[start_sample:end_sample] += audio[:actual_len, 0] * gain_left
        master_right[start_sample:end_sample] += audio[:actual_len, 1] * gain_right

# Peak Limiter / Normalization (-1.5 dB ceiling)
max_peak = max(np.max(np.abs(master_left)), np.max(np.abs(master_right)))
if max_peak > 0.85:
    norm_factor = 0.85 / max_peak
    master_left *= norm_factor
    master_right *= norm_factor
    print(f"Applied master limiter (Peak was {max_peak:.2f}, normalized to 0.85)")

# Interleave and export 16-bit PCM WAV
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

print(f"✓ Master SFX track mixed to: {output_wav}")
`;

fs.writeFileSync(scriptPath, pythonCode, "utf8");
execSync(`/home/ec2-user/PROMETHEUS-CORE-BACKEND/bin/python3 "${scriptPath}"`, { stdio: "inherit" });

// Mux master SFX audio back into the video
console.log("\nMuxing master SFX audio stream into video container...");
const masterWav = path.join(studioDir, "master_sfx_track.wav");
const muxCmd = `"${ffmpegBin}" -i "${inputVideo}" -i "${masterWav}" -c:v copy -c:a aac -b:a 256k -shortest "${outputVideo}" -y`;
execSync(muxCmd, { stdio: "inherit" });

console.log("\n=================================================");
console.log(`🎉 SUCCESS! Baked Master Video Created: ${outputVideo}`);
console.log("=================================================");
