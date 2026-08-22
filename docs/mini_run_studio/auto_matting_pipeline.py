#!/usr/bin/env python3
import sys
import os
import cv2
import numpy as np
from PIL import Image
from rembg import remove, new_session

session = new_session("u2net")

def process_transparent_asset(input_path, output_path, crop_bottom_text=False):
    if not os.path.exists(input_path):
        print(f"ERROR: Input path does not exist: {input_path}", file=sys.stderr)
        return False

    with open(input_path, "rb") as f:
        img_bytes = f.read()

    # Fast, high-precision u2net segmentation
    output_bytes = remove(img_bytes, session=session)
    
    temp_rgba = output_path + ".tmp.png"
    with open(temp_rgba, "wb") as f:
        f.write(output_bytes)

    rgba = cv2.imread(temp_rgba, cv2.IMREAD_UNCHANGED)
    if rgba is None:
        return False
    
    h, w, c = rgba.shape
    if c == 4:
        # Zero out any bottom text (like Latin engraving caption on brain image)
        if crop_bottom_text:
            rgba[int(h * 0.88):, :] = 0
            # Also clean top/side borders
            rgba[0:int(h * 0.02), :] = 0
            rgba[:, 0:int(w * 0.02)] = 0
            rgba[:, int(w * 0.98):] = 0

        # Gentle 1px alpha Gaussian blur to eliminate any harsh edge pixels
        alpha = rgba[:, :, 3]
        blurred_alpha = cv2.GaussianBlur(alpha, (3, 3), 0)
        rgba[:, :, 3] = np.minimum(alpha, blurred_alpha)

    cv2.imwrite(output_path, rgba)
    if os.path.exists(temp_rgba):
        os.remove(temp_rgba)
    
    print(f"[MATTING_SUCCESS] Wrote zero-background matted asset -> {output_path}")
    return True

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: auto_matting_pipeline.py <input_image> <output_png> [--crop-text]")
        sys.exit(1)
    
    in_file = sys.argv[1]
    out_file = sys.argv[2]
    crop_text = "--crop-text" in sys.argv
    process_transparent_asset(in_file, out_file, crop_bottom_text=crop_text)