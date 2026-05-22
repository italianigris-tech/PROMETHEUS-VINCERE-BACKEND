#!/usr/bin/env python3
"""Comprehensive metadata analysis of downloaded MP3 files"""

from mutagen.mp3 import MP3
from mutagen.id3 import ID3
import os
from pathlib import Path

downloads_dir = Path(r'c:\Users\HomePC\YOUTUBE MUSIC DOWNLOADER -THRAGG\downloads')

print("\n" + "="*80)
print("COMPREHENSIVE METADATA ANALYSIS - What Gets Embedded in MP3s")
print("="*80 + "\n")

# Get all MP3 files
mp3_files = list(downloads_dir.glob('*.mp3'))

if not mp3_files:
    print("❌ No MP3 files found to analyze!")
    exit(1)

print(f"📊 Analyzing {len(mp3_files)} downloaded MP3 files...\n")

# Analyze first 3 files for detailed breakdown
for i, mp3_path in enumerate(mp3_files[:3], 1):
    print(f"🎵 FILE {i}: {mp3_path.name}")
    print("-" * 60)

    try:
        mp3 = MP3(str(mp3_path), ID3=ID3)

        if mp3.tags:
            print(f"✅ {len(mp3.tags)} ID3 tags embedded")

            # Map ID3 tags to human-readable names
            tag_mapping = {
                'TIT2': 'Title',
                'TPE1': 'Artist',
                'TPE2': 'Album Artist',
                'TALB': 'Album',
                'TCON': 'Genre',
                'TDRC': 'Release Date',
                'TRCK': 'Track Number',
                'TPOS': 'Disc Number',
                'TSSE': 'Encoder',
                'COMM': 'Comment',
                'TXXX': 'Custom Tags',
                'APIC': 'Album Art',
                'USLT': 'Lyrics',
                'WOAR': 'Artist URL',
                'WXXX': 'Custom URL'
            }

            # Show each tag
            for tag_key, tag_value in mp3.tags.items():
                # Get human-readable name
                tag_name = tag_mapping.get(tag_key, tag_key)

                # Format value
                if hasattr(tag_value, 'text'):
                    value = str(tag_value.text[0]) if tag_value.text else str(tag_value)
                else:
                    value = str(tag_value)

                # Truncate long values
                if len(value) > 80:
                    value = value[:77] + "..."

                print(f"  {tag_name}: {value}")

        else:
            print("❌ No ID3 tags found")

        # Show file info
        print(f"  📏 File Size: {os.path.getsize(mp3_path) / (1024*1024):.2f} MB")
        print(f"  ⏱️  Duration: {int(mp3.info.length // 60)}:{int(mp3.info.length % 60):02d}")
        print(f"  🔊 Bitrate: {mp3.info.bitrate} kbps")

    except Exception as e:
        print(f"❌ Error reading metadata: {e}")

    print()

# Summary of what gets captured
print("="*80)
print("📋 METADATA SUMMARY - What You Get")
print("="*80)

metadata_summary = {
    "✅ ALWAYS CAPTURED": [
        "Title (full song name from YouTube)",
        "Artist (uploader/channel name)",
        "Genre (usually 'Music')",
        "Release Date (upload date)",
        "Source URL (original YouTube link)",
        "Encoder info",
        "File duration",
        "Audio quality/bitrate"
    ],
    "⚠️ SOMETIMES CAPTURED": [
        "Album (if specified in video)",
        "Description (video description)",
        "Thumbnail (saved as separate .webp file)",
        "Comments (if any)"
    ],
    "❌ NOT CAPTURED": [
        "Album art (embedded - only thumbnail file)",
        "Lyrics (unless in video description)",
        "Track numbers (unless in playlist)",
        "Disc numbers",
        "Composer credits",
        "Producer credits"
    ]
}

for category, items in metadata_summary.items():
    print(f"\n{category}:")
    for item in items:
        print(f"  • {item}")

print("\n" + "="*80)
print("💡 WHAT THIS MEANS FOR YOU")
print("="*80)

print("""
✅ GOOD FOR:
   • Organizing by artist/title
   • Finding original YouTube source
   • Basic music library management
   • Playback with metadata display

⚠️ LIMITATIONS:
   • No embedded album art (separate thumbnail files)
   • Artist = uploader (not always the performer)
   • No advanced music metadata (composer, producer, etc.)
   • Genre is generic "Music"

📁 FILE STRUCTURE:
   • MP3 with embedded metadata
   • Separate thumbnail (.webp/.jpg) file
   • All files in flat downloads/ folder
""")

print("\n" + "="*80)
print("🎯 READY TO DOWNLOAD?")
print("="*80)
print("""
Your MP3s will have:
• Full title and artist info
• YouTube source link
• Upload date
• Audio quality info
• Separate thumbnail images

Run: python downloader.py batch urls.txt
""")