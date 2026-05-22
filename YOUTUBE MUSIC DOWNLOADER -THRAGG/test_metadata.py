#!/usr/bin/env python3
"""Test metadata extraction from downloaded MP3s"""

from mutagen.mp3 import MP3
from mutagen.id3 import ID3
import os
import json

downloads_dir = r'c:\Users\HomePC\YOUTUBE MUSIC DOWNLOADER -THRAGG\downloads'

# Find first MP3 file
mp3_files = [f for f in os.listdir(downloads_dir) if f.endswith('.mp3')]

if not mp3_files:
    print("✗ No MP3 files found!")
    exit(1)

print(f"Testing metadata on: {mp3_files[0]}\n")
mp3_path = os.path.join(downloads_dir, mp3_files[0])

try:
    mp3 = MP3(mp3_path, ID3=ID3)
    
    print("=" * 60)
    print("METADATA TEST RESULTS")
    print("=" * 60)
    
    if mp3.tags:
        print(f"\n✓ ID3 Tags Found! ({len(mp3.tags)} tags)")
        print("\nTag Details:")
        for key, val in list(mp3.tags.items())[:10]:  # First 10 tags
            print(f"  {key}: {str(val)[:80]}")
        if len(mp3.tags) > 10:
            print(f"  ... and {len(mp3.tags) - 10} more tags")
    else:
        print("\n✗ No ID3 tags found in file")
    
    print(f"\nFile Size: {os.path.getsize(mp3_path) / (1024*1024):.2f} MB")
    print(f"Duration: {mp3.info.length:.1f} seconds ({int(mp3.info.length // 60)}:{int(mp3.info.length % 60):02d})")
    
except Exception as e:
    print(f"✗ Error reading metadata: {e}")

# List file structure
print("\n" + "=" * 60)
print("FILE STRUCTURE ANALYSIS")
print("=" * 60)

files_by_type = {}
for f in os.listdir(downloads_dir):
    ext = os.path.splitext(f)[1].lower()
    if ext not in files_by_type:
        files_by_type[ext] = 0
    files_by_type[ext] += 1

print(f"\nTotal files: {len(os.listdir(downloads_dir))}")
print("File types:")
for ext, count in sorted(files_by_type.items()):
    print(f"  {ext if ext else 'no extension'}: {count} files")

# Check for any metadata JSON files
json_files = [f for f in os.listdir(downloads_dir) if f.endswith('.json')]
print(f"\nJSON metadata files: {len(json_files)}")
if json_files:
    print(f"  Examples: {json_files[:3]}")
