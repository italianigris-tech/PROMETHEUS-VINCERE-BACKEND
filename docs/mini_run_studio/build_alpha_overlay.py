"""Build the mini-run's browser-ready alpha foreground from a black-keyed source.

The original/base video is never read or re-encoded. This only prepares the
foreground speaker once as a muted VP9 WebM with alpha for browser overlay.
"""

import subprocess
import sys

import cv2
import numpy as np

SOURCE = "/home/ec2-user/PROMETHEUS-CORE-BACKEND/docs/mini_run_studio/uploaded_videos/the_matted_AKIMBOSA_MALE_HEAD_VIDEO.mp4"
OUTPUT = "/home/ec2-user/PROMETHEUS-CORE-BACKEND/docs/mini_run_studio/uploaded_videos/the_matted_AKIMBOSA_MALE_HEAD_VIDEO.alpha.webm"
FFMPEG = "/home/ec2-user/.local/bin/ffmpeg"
WIDTH, HEIGHT = 720, 1280


def main() -> None:
    capture = cv2.VideoCapture(SOURCE)
    if not capture.isOpened():
        raise RuntimeError(f"Cannot open foreground source: {SOURCE}")

    fps = capture.get(cv2.CAP_PROP_FPS) or 30
    command = [
        FFMPEG, "-y", "-f", "image2pipe", "-vcodec", "png",
        "-r", str(fps), "-i", "-",
        "-an", "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p",
        "-crf", "32", "-b:v", "0", "-row-mt", "1", "-deadline",
        "realtime", "-cpu-used", "8", OUTPUT,
    ]
    encoder = subprocess.Popen(command, stdin=subprocess.PIPE)
    frame_count = 0
    try:
        while True:
            ok, bgr = capture.read()
            if not ok:
                break
            source_height, source_width = bgr.shape[:2]
            crop_width = (source_height * 9 // 16) // 2 * 2
            crop_left = (source_width - crop_width) // 2
            portrait = bgr[:, crop_left:crop_left + crop_width]
            portrait = cv2.resize(portrait, (WIDTH, HEIGHT), interpolation=cv2.INTER_AREA)
            hsv = cv2.cvtColor(portrait, cv2.COLOR_BGR2HSV)
            alpha = np.where((hsv[:, :, 1] < 55) & (hsv[:, :, 2] < 38), 0, 255).astype(np.uint8)
            rgba = np.dstack((portrait, alpha))
            ok, png = cv2.imencode(".png", rgba)
            if not ok:
                raise RuntimeError("Could not encode alpha frame as PNG")
            encoder.stdin.write(png.tobytes())
            frame_count += 1
    finally:
        capture.release()
        if encoder.stdin:
            encoder.stdin.close()
    if encoder.wait() != 0:
        raise RuntimeError("VP9 alpha encoder failed")
    print(f"Wrote {frame_count} transparent foreground frames to {OUTPUT}")


if __name__ == "__main__":
    main()
