# YouTube Music Downloader CLI

A command-line tool for batch downloading and converting YouTube videos/playlists to MP3 audio files with metadata.

## Features

✅ **Batch Download** - Download multiple URLs at once from a file  
✅ **Single Download** - Download individual YouTube URLs  
✅ **MP3 Conversion** - Automatic audio extraction and conversion  
✅ **Metadata Embedding** - Automatically embeds title, thumbnail, and metadata  
✅ **Duplicate Detection** - Automatically skips duplicate songs in playlists  
✅ **Error Handling** - Continue on errors with detailed failure reporting  
✅ **Colored Output** - Easy-to-read colored terminal output  
✅ **Configurable Quality** - Choose audio quality/bitrate  

## Installation

### Prerequisites

- Python 3.7+
- FFmpeg (required for audio conversion)

### Setup FFmpeg

**Windows:**
```bash
choco install ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt-get install ffmpeg
```

### Install Python Dependencies

```bash
pip install -r requirements.txt
```

## Usage

### 1. First-Time Setup

```bash
python downloader.py setup
```

This verifies your environment and creates the output directory.

### 2. Download Single URL

```bash
python downloader.py single "https://www.youtube.com/watch?v=VIDEO_ID"
```

### 3. Batch Download (Recommended)

Create a file `urls.txt` with one URL per line:

```
https://www.youtube.com/watch?v=video1
https://www.youtube.com/watch?v=video2
https://www.youtube.com/watch?v=video3
```

Then run:

```bash
python downloader.py batch urls.txt
```

### 4. Custom Output Directory

```bash
python downloader.py batch urls.txt -o "my_music"
```

### 5. Custom Audio Quality

```bash
python downloader.py batch urls.txt --audio-quality 320
```

Quality options:
- `0` = Best available quality (default)
- `128`, `192`, `256`, `320` = Specific bitrate in kbps

### 6. Different Audio Format

```bash
python downloader.py batch urls.txt --audio-format m4a
```

Supported formats: `mp3`, `m4a`, `wav`, `opus`, `vorbis`

## Command Reference

### `setup` Command
Verifies dependencies and initializes the environment.

```bash
python downloader.py setup
```

### `single` Command
Download a single URL with options.

```bash
python downloader.py single "URL" [OPTIONS]

Options:
  -o, --output TEXT           Output directory (default: downloads)
  --audio-format TEXT         Audio format: mp3, m4a, wav (default: mp3)
  --audio-quality TEXT        Audio quality: 0=best, or bitrate like 320 (default: 0)
```

### `batch` Command
Download multiple URLs from a file.

```bash
python downloader.py batch URL_FILE [OPTIONS]

Options:
  -o, --output TEXT                Output directory (default: downloads)
  --audio-format TEXT              Audio format: mp3, m4a, wav (default: mp3)
  --audio-quality TEXT             Audio quality: 0=best, or bitrate like 320 (default: 0)
  --skip-errors                    Continue on download errors (default: enabled)
  --allow-duplicates               Allow downloading duplicate songs (default: disabled)
  --duplicate-threshold FLOAT      Similarity threshold for duplicates (0.0-1.0, default: 0.85)
```

## 🚫 Duplicate Detection

By default, the downloader **automatically prevents downloading duplicate songs**, which is perfect for playlists where the same track appears multiple times.

**How it works:**
- Tracks downloaded video IDs and song titles
- Compares new songs against previously downloaded songs
- Skips songs with 85%+ title similarity by default
- Shows skipped duplicates in the summary

**Example output:**
```
[1/163] Downloading: ...
✓ Downloaded: Vivaldi - The Four Seasons, Summer - Presto

[2/163] Downloading: ...
⊘ Skipped (duplicate): Vivaldi: The Four Seasons Summer Presto (similar version)

[3/163] Downloading: ...
✓ Downloaded: Bach - Cello Suite No. 1
```

**To allow duplicates:**
```bash
python downloader.py batch urls.txt --allow-duplicates
```

**To adjust sensitivity:**
```bash
# More strict (only exact matches)
python downloader.py batch urls.txt --duplicate-threshold 0.95

# More lenient (catch more variations)
python downloader.py batch urls.txt --duplicate-threshold 0.75
```

**Threshold values:**
- `1.0` = Exact match only
- `0.9` = Very strict
- `0.85` = Recommended (default)
- `0.75` = Lenient
- `0.5` = Very lenient

```
# This is a comment - lines starting with # are ignored
https://www.youtube.com/watch?v=dQw4w9WgXcQ
https://www.youtube.com/watch?v=jNQXAC9IVRw

# You can also use YouTube Music URLs:
https://music.youtube.com/watch?v=VIDEO_ID
```

## Output

Downloads are saved to the `downloads/` directory (or your specified output directory) with the following structure:

```
downloads/
├── Song Title 1.mp3
├── Song Title 1.jpg
├── Song Title 2.mp3
├── Song Title 2.jpg
└── ...
```

Each download includes:
- **MP3 file** with embedded metadata (title, artist, thumbnail)
- **JPG thumbnail** file

## Batch Download Example

**File: `my_playlist.txt`**
```
https://www.youtube.com/watch?v=dQw4w9WgXcQ
https://www.youtube.com/watch?v=jNQXAC9IVRw
https://www.youtube.com/watch?v=aqz-KE-bpKQ
https://www.youtube.com/watch?v=Vjbmv0rX1NU
```

**Command:**
```bash
python downloader.py batch my_playlist.txt -o "my_music" --audio-quality 320
```

**Output:**
```
[1/4] Downloading: https://www.youtube.com/watch?v=dQw4w9WgXcQ
✓ Downloaded: Rick Astley - Never Gonna Give You Up

[2/4] Downloading: https://www.youtube.com/watch?v=jNQXAC9IVRw
✓ Downloaded: Me at the zoo

... (more downloads) ...

==================================================
Download Summary:
  Total:   4
  Success: 4
  Failed:  0
==================================================
```

## Error Handling

The downloader will:
- ✅ Continue on errors by default
- 📋 List all failed URLs at the end
- 💾 Save successful downloads before retrying
- 📝 Show detailed error messages for troubleshooting

## Troubleshooting

### "FFmpeg not found"
Install FFmpeg using the instructions in the Installation section above.

### "yt-dlp not found"
```bash
pip install -r requirements.txt
```

### "Video not available"
Some videos may be:
- Age-restricted
- Private
- Geographically blocked
- Removed by copyright claims

Try updating yt-dlp:
```bash
pip install --upgrade yt-dlp
```

### "No audio stream available"
Some videos may not have downloadable audio. The downloader will skip these and continue with the batch.

## Advanced Usage

### Resume Interrupted Downloads

Simply run the batch command again - completed files won't be re-downloaded.

### Dry Run (Check URLs without downloading)

```bash
python downloader.py setup  # Verifies environment
```

### Getting Help

```bash
python downloader.py --help
python downloader.py single --help
python downloader.py batch --help
```

## License

This tool uses yt-dlp (licensed under Unlicense) and FFmpeg.

## Notes

- Always respect copyright and YouTube's Terms of Service
- Use this tool only for content you have permission to download
- Some videos may be protected by copyright restrictions
- Large batch downloads may take significant time and bandwidth
