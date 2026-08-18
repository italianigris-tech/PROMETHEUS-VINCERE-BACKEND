import os
import sys
import subprocess
import shutil

studio_dir = "/home/ec2-user/PROMETHEUS-CORE-BACKEND/docs/mini_run_studio"
repo_root = "/home/ec2-user/PROMETHEUS-CORE-BACKEND"
ffmpeg_bin = os.path.join(repo_root, "remotion-app/node_modules/@remotion/compositor-linux-x64-gnu/ffmpeg")

input_video = os.path.join(studio_dir, "uploaded_input_video.mp4")
backup_raw_video = os.path.join(studio_dir, "raw_original_video.mp4")
extracted_wav = os.path.join(studio_dir, "input_full_audio.wav")
separated_out_dir = os.path.join(studio_dir, "separated_stems")
isolated_vocals_video = os.path.join(studio_dir, "isolated_vocals_video.mp4")

print("=================================================")
print("PROMETHEUS VOCAL ISOLATION & SFX STRIPPER")
print("=================================================")

if not os.path.exists(input_video):
    print(f"Error: input video not found at {input_video}")
    sys.exit(1)

# 1. Backup original if not already backed up
if not os.path.exists(backup_raw_video):
    shutil.copyfile(input_video, backup_raw_video)
    print(f"✓ Backed up raw original video to: {backup_raw_video}")

# 2. Extract high quality 44.1kHz Stereo WAV from video
print("\n[1/4] Extracting raw audio stream from video...")
cmd_extract = f'"{ffmpeg_bin}" -i "{input_video}" -vn -acodec pcm_s16le -ar 44100 -ac 2 "{extracted_wav}" -y'
subprocess.run(cmd_extract, shell=True, check=True)
print("✓ Raw audio extracted to input_full_audio.wav")

# 3. Run AI Vocal Separation (Demucs)
print("\n[2/4] Running AI Stem Separation (Isolating Vocals, Stripping Soundtrack & SFX)...")
cmd_demucs = f'"{sys.executable}" -m demucs.separate -n htdemucs --two-stems vocals -o "{separated_out_dir}" "{extracted_wav}"'
res = subprocess.run(cmd_demucs, shell=True)


isolated_vocals_wav = os.path.join(separated_out_dir, "htdemucs/input_full_audio/vocals.wav")

if not os.path.exists(isolated_vocals_wav):
    print("\n⚠️ AI separation output not found at default path, searching...")
    found = None
    for root, dirs, files in os.walk(separated_out_dir):
        if "vocals.wav" in files:
            found = os.path.join(root, "vocals.wav")
            break
    if found:
        isolated_vocals_wav = found
    else:
        print("❌ Error: vocals.wav not generated.")
        sys.exit(1)

print(f"✓ Isolated clean vocal stem: {isolated_vocals_wav}")

# 4. Mux Isolated Vocal Track back into Video (Replacing original audio)
print("\n[3/4] Muxing isolated clean vocals into original visual footage...")
cmd_mux = f'"{ffmpeg_bin}" -i "{input_video}" -i "{isolated_vocals_wav}" -c:v copy -map 0:v:0 -map 1:a:0 -shortest -c:a aac -b:a 192k "{isolated_vocals_video}" -y'
subprocess.run(cmd_mux, shell=True, check=True)
print(f"✓ Created vocal-isolated video: {isolated_vocals_video}")

# 5. Replace canonical studio video so the live player streams only the clean voice
shutil.copyfile(isolated_vocals_video, input_video)
print(f"✓ Successfully replaced uploaded_input_video.mp4 with clean vocal footage!")

print("\n=================================================")
print("🎉 VOCAL ISOLATION COMPLETE!")
print("All background music, trailer sounds & SFX have been stripped.")
print("Only the speaker's vocal dialogue remains in the video.")
print("=================================================")
