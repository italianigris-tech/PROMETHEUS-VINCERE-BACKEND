#!/usr/bin/env python3
"""
YouTube Music Downloader CLI
Downloads audio from YouTube URLs and converts to MP3
"""

import os
import sys
import json
import time
import re
from pathlib import Path
from typing import List, Optional, Set, Dict, Tuple
from difflib import SequenceMatcher
from concurrent.futures import ThreadPoolExecutor, as_completed
import yt_dlp
import click
from colorama import Fore, Style, init

# Try to import mutagen for metadata reading
try:
    from mutagen.mp3 import MP3
    from mutagen.id3 import ID3, TIT2, TPE1
    MUTAGEN_AVAILABLE = True
except ImportError:
    MUTAGEN_AVAILABLE = False

init(autoreset=True)

def safe_echo(text="", nl=True):
    """Safely print text with encoding issues"""
    if not isinstance(text, str):
        text = str(text)
    try:
        click.echo(text, nl=nl)
    except UnicodeEncodeError:
        # Fallback to ASCII-safe version
        safe_text = text.encode('ascii', 'ignore').decode('ascii')
        click.echo(safe_text, nl=nl)


class YouTubeMusicDownloader:
    """Main downloader class"""
    
    def __init__(self, output_dir: str = "downloads", config_file: Optional[str] = None):
        """Initialize downloader with output directory and optional config"""
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
        # Track downloaded videos to prevent duplicates
        self.downloaded_videos: Set[str] = set()
        self.downloaded_titles: List[str] = []
        self.skipped_count = 0
        
        # Load or create config
        self.config = self._load_config(config_file)
        
        # Session state for resuming
        self.state_file = Path("download_state.json")
        self.state = self._load_state()
        
        # Scan existing library immediately for dedupe
        self.library_songs = self._scan_existing_library()
        self.library_video_ids = {s.get('video_id') for s in self.library_songs.values() if s.get('video_id')}

    def _load_state(self) -> dict:
        """Load download state for resuming"""
        if self.state_file.exists():
            try:
                with open(self.state_file, 'r') as f:
                    return json.load(f)
            except:
                pass
        return {"processed_urls": {}}

    def _save_state(self):
        """Save download state"""
        try:
            with open(self.state_file, 'w') as f:
                json.dump(self.state, f, indent=2)
        except:
            pass

    def _extract_video_id(self, url: str) -> Optional[str]:
        """Fast extraction of video ID from URL string"""
        # Standard youtube URLs
        patterns = [
            r"v=([a-zA-Z0-9_-]{11})",
            r"be/([a-zA-Z0-9_-]{11})",
            r"embed/([a-zA-Z0-9_-]{11})",
            r"watch\?v=([a-zA-Z0-9_-]{11})"
        ]
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None
    
    def _load_config(self, config_file: Optional[str]) -> dict:
        """Load configuration from file or create default"""
        if config_file and Path(config_file).exists():
            with open(config_file, 'r') as f:
                return json.load(f)
        
        return {
            "audio_format": "mp3",
            "audio_quality": "0",  # 0 = best available
            "embed_metadata": True,
            "keep_video": False,
            "skip_duplicates": True,
            "duplicate_threshold": 0.85,  # 85% similarity = duplicate
            "download_related": False,     # NEW: Download related songs
            "max_related_per_song": 2,     # NEW: Max related songs per input
            "organize_by_genre": False,    # NEW: Organize downloads by genre
            "genre_detection": "metadata", # NEW: metadata, title, or ai
        }
    
    def _detect_genre(self, title: str, description: str = "", uploader: str = "") -> str:
        """Detect genre from title, description, and uploader info"""
        detection_method = self.config.get("genre_detection", "metadata")
        
        # Combine all text for analysis
        text = f"{title} {description} {uploader}".lower()
        
        # Genre keywords mapping - UPDATED for content creation categories
        genre_keywords = {
            "Classical / Orchestral Prestige": ["classical", "orchestral", "symphony", "orchestra", "prestige", 
                                             "bach", "mozart", "beethoven", "vivaldi", "tchaikovsky", "wagner",
                                             "philharmonic", "chamber", "string quartet", "concerto", "sonata"],
            "Cinematic Trailer / Epic": ["epic", "trailer", "cinematic", "dramatic", "hollywood", "movie", 
                                       "film score", "soundtrack", "heroic", "adventure", "battle", "victory",
                                       "hans zimmer", "transformers", "avengers", "star wars"],
            "Premium Business / Corporate Authority": ["corporate", "business", "professional", "executive", 
                                                     "authority", "premium", "luxury brand", "enterprise", 
                                                     "boardroom", "success", "achievement", "leadership"],
            "Motivational / Uplift": ["motivational", "uplifting", "inspirational", "positive", "energy", 
                                    "success", "achievement", "victory", "triumph", "overcoming", "breakthrough"],
            "Tension / Urgency / Pressure": ["tension", "urgency", "pressure", "suspense", "dramatic", 
                                           "intense", "building", "climax", "suspenseful", "anticipation"],
            "Tech / Futuristic / AI": ["technology", "futuristic", "sci-fi", "cyberpunk", "electronic", 
                                     "synthetic", "digital", "ai", "robot", "space", "future", "innovation"],
            "Luxury / Minimal / Ambient": ["luxury", "minimal", "ambient", "minimalist", "atmospheric", 
                                         "peaceful", "serene", "contemporary", "modern", "sophisticated"],
            "Hip-Hop / Trap / Urban Energy": ["hip hop", "hip-hop", "trap", "urban", "rap", "beats", 
                                            "boom bap", "grime", "drill", "freestyle", "flow", "street"],
            "Pop / Indie / Lifestyle": ["pop", "indie", "alternative", "lifestyle", "modern", "contemporary", 
                                      "indie pop", "dream pop", "folk pop", "synth pop", "electro pop"],
            "Lo-Fi / Chill / Soft Focus": ["lo-fi", "lofi", "chill", "soft", "relaxing", "beats", "hip hop beats", 
                                         "instrumental", "jazzhop", "chillhop", "focus", "study", "ambient beats"]
        }
        
        # Score each genre
        genre_scores = {}
        for genre, keywords in genre_keywords.items():
            score = sum(1 for keyword in keywords if keyword in text)
            if score > 0:
                genre_scores[genre] = score
        
        # Return highest scoring genre, or "other" if none found
        if genre_scores:
            best_genre = max(genre_scores, key=genre_scores.get)
            return best_genre.title()  # Capitalize first letter
        
        return "Other"
    
    def _organize_by_genre(self) -> None:
        """Organize downloaded files into genre folders"""
        if not self.config.get("organize_by_genre", False):
            return
        
        click.echo(f"{Fore.BLUE}Organizing files by genre...")
        
        # Get all MP3 files in output directory
        mp3_files = list(self.output_dir.glob("*.mp3"))
        
        organized_count = 0
        
        for mp3_path in mp3_files:
            try:
                # Read metadata to detect genre
                if MUTAGEN_AVAILABLE:
                    mp3 = MP3(str(mp3_path), ID3=ID3)
                    
                    title = str(mp3.tags.get('TIT2', [''])[0]) if mp3.tags and 'TIT2' in mp3.tags else mp3_path.stem
                    description = ""
                    uploader = ""
                    
                    # Try to extract additional info from custom tags
                    if mp3.tags:
                        for tag_key, tag_value in mp3.tags.items():
                            if tag_key in ['TXXX', 'COMM']:
                                tag_text = str(tag_value)
                                if 'description' in tag_text.lower():
                                    description = tag_text
                                elif 'artist' in tag_text.lower() or 'uploader' in tag_text.lower():
                                    uploader = tag_text
                    
                    genre = self._detect_genre(title, description, uploader)
                else:
                    # Fallback to title-only detection
                    genre = self._detect_genre(mp3_path.stem)
                
                # Create genre folder
                genre_dir = self.output_dir / genre
                genre_dir.mkdir(exist_ok=True)
                
                # Move MP3 file
                new_mp3_path = genre_dir / mp3_path.name
                if mp3_path != new_mp3_path:
                    mp3_path.rename(new_mp3_path)
                
                # Move corresponding thumbnail if it exists
                for ext in ['.jpg', '.webp', '.png']:
                    thumb_path = mp3_path.with_suffix(ext)
                    if thumb_path.exists():
                        new_thumb_path = genre_dir / thumb_path.name
                        thumb_path.rename(new_thumb_path)
                
                organized_count += 1
                safe_echo(f"{Fore.BLUE}  -> {genre}: {mp3_path.name}")
                
            except Exception as e:
                click.echo(f"{Fore.YELLOW}⚠ Could not organize {mp3_path.name}: {str(e)}")
        
        if organized_count > 0:
            click.echo(f"{Fore.GREEN}Organized {organized_count} files into genre folders")
    
    def _scan_existing_library(self) -> Dict[str, Dict]:
        """Scan existing downloads folder and extract metadata from MP3 files"""
        library_songs = {}
        
        if not MUTAGEN_AVAILABLE:
            safe_echo(f"{Fore.YELLOW}WARNING: Mutagen not available - library deduplication limited")
            return library_songs
        
        mp3_files = list(self.output_dir.rglob("*.mp3"))
        
        for mp3_path in mp3_files:
            try:
                mp3 = MP3(str(mp3_path), ID3=ID3)
                
                # Extract metadata
                title = None
                artist = None
                video_id = None
                
                if mp3.tags:
                    title = str(mp3.tags.get('TIT2', [''])[0]) if 'TIT2' in mp3.tags else None
                    artist = str(mp3.tags.get('TPE1', [''])[0]) if 'TPE1' in mp3.tags else None
                    
                    # Try to extract video ID from custom tags or comments
                    for tag_key, tag_value in mp3.tags.items():
                        if tag_key in ['TXXX', 'COMM']:
                            tag_text = str(tag_value)
                            if 'youtube.com/watch?v=' in tag_text:
                                # Extract video ID from URL
                                try:
                                    video_id = tag_text.split('v=')[1].split('&')[0].split()[0]
                                    break
                                except:
                                    continue
                
                # Fallback to filename if no title metadata
                if not title:
                    title = mp3_path.stem
                
                # Create library entry
                if title:
                    library_songs[title.lower().strip()] = {
                        'title': title,
                        'artist': artist or 'Unknown',
                        'video_id': video_id,
                        'file_path': str(mp3_path),
                        'file_size': mp3_path.stat().st_size,
                        'duration': int(mp3.info.length) if hasattr(mp3, 'info') else 0
                    }
                    
            except Exception as e:
                # Skip files that can't be read
                continue
        
        click.echo(f"{Fore.BLUE}Scanned library: {len(library_songs)} existing songs")
        return library_songs
    
    def _is_duplicate_in_library(self, title: str, artist: str = None, video_id: str = None, 
                                library: Dict[str, Dict] = None) -> Tuple[bool, str]:
        """Check if song exists in existing library"""
        if not library:
            library = self._scan_existing_library()
        
        if not library:
            return False, ""
        
        title_lower = title.lower().strip()
        threshold = self.config.get("duplicate_threshold", 0.85)
        
        # Check exact video ID match first
        if video_id:
            for song_data in library.values():
                if song_data.get('video_id') == video_id:
                    return True, f"Exact video ID match: {song_data['title']}"
        
        # Check title similarity
        for existing_title_lower, song_data in library.items():
            similarity = SequenceMatcher(None, title_lower, existing_title_lower).ratio()
            
            if similarity >= threshold:
                existing_title = song_data['title']
                existing_artist = song_data.get('artist', 'Unknown')
                
                # If we have artist info, make it more precise
                if artist and existing_artist != 'Unknown':
                    if artist.lower().strip() == existing_artist.lower().strip():
                        return True, f"Title + Artist match: {existing_title} by {existing_artist}"
                else:
                    return True, f"Title similarity ({similarity:.1%}): {existing_title}"
        
        return False, ""
    
    def _get_related_videos(self, url: str, max_related: int = 2) -> List[str]:
        """Extract related video URLs from a YouTube video"""
        related_urls = []
        
        try:
            # Extract video info to get related videos
            extract_opts = {
                "quiet": True,
                "no_warnings": True,
                "extract_flat": True,  # Don't download, just get metadata
            }
            
            with yt_dlp.YoutubeDL(extract_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                
                # Get related videos
                related = info.get('related_videos', [])
                
                for video in related[:max_related]:
                    if isinstance(video, dict) and 'url' in video:
                        video_url = video['url']
                        if video_url and 'youtube.com/watch?v=' in video_url:
                            related_urls.append(video_url)
                            
        except Exception as e:
            click.echo(f"{Fore.YELLOW}WARNING: Could not extract related videos: {str(e)}")
        
        return related_urls
    
    def _is_duplicate(self, title: str, artist: str = None, video_id: str = None, threshold: float = None) -> Tuple[bool, str]:
        """Check if a song title is a duplicate inside this run only"""
        if not threshold:
            threshold = self.config.get("duplicate_threshold", 0.85)
        
        if not title:
            return False, ""
        
        title_lower = title.lower().strip()
        
        # First check session duplicates (already downloaded in this run)
        for downloaded_title in self.downloaded_titles:
            downloaded_lower = downloaded_title.lower().strip()
            similarity = SequenceMatcher(None, title_lower, downloaded_lower).ratio()
            
            if similarity >= threshold:
                return True, f"Session duplicate: {downloaded_title}"
        
        return False, ""
    
    def _get_ydl_opts(self) -> dict:
        """Get yt-dlp options based on config"""
        opts = {
            "format": "bestaudio/best",
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": self.config.get("audio_format", "mp3"),
                    "preferredquality": self.config.get("audio_quality", "0"),
                }
            ],
            "outtmpl": str(self.output_dir / "%(title)s.%(ext)s"),
            "quiet": False,
            "no_warnings": False,
        }
        
        if self.config.get("embed_metadata", True):
            opts["writethumbnail"] = True
            if "FFmpegMetadata" not in [p.get("key") for p in opts["postprocessors"]]:
                opts["postprocessors"].append({"key": "FFmpegMetadata"})
        
        if not self.config.get("keep_video", False):
            opts["keepvideo"] = False
        
        return opts
    
    def download(self, url: str, download_related: bool = None) -> bool:
        """Download single URL without related songs"""
        # Never download related songs - just download the main URL
        success = self._download_single(url)
        return success
    
    def _download_single(self, url: str) -> bool:
        """Download a single URL (internal method)"""
        try:
            # Check if already processed in this session state (to support resuming)
            if url in self.state["processed_urls"]:
                if self.state["processed_urls"][url] == "success":
                    # We don't increment skipped_count here as it was already counted in previous run
                    return True
            
            # FAST CHECK: Extract video ID from URL string first
            video_id = self._extract_video_id(url)
            if video_id and video_id in self.library_video_ids:
                safe_echo(f"{Fore.YELLOW}SKIP: Fast skip (video ID {video_id} already in library)")
                self.skipped_count += 1
                self.state["processed_urls"][url] = "success"
                return True

            # Step 1: Extract info WITHOUT downloading (to check for title similarity)
            extract_opts = {
                "quiet": True,
                "no_warnings": True,
                "extract_flat": False,
            }
            
            with yt_dlp.YoutubeDL(extract_opts) as ydl_extract:
                try:
                    info = ydl_extract.extract_info(url, download=False)
                except Exception as e:
                    # If extraction fails, we might still try downloading or skip
                    if "Sign in to confirm you're not a bot" in str(e):
                        raise e # Propagate bot detection
                    info = None
            
            # Step 2: Check for duplicates BEFORE downloading
            if info:
                title = info.get("title", "Unknown")
                video_id = info.get("id", "Unknown")
                uploader = info.get("uploader", None)
                
                # Check library again with full info (title similarity)
                is_library_dup, library_reason = self._is_duplicate_in_library(title, uploader, video_id, self.library_songs)
                if is_library_dup:
                    safe_echo(f"{Fore.YELLOW}SKIP: Skipped (existing library duplicate: {library_reason})")
                    self.skipped_count += 1
                    self.state["processed_urls"][url] = "success"
                    return True
                
                if self.config.get("skip_duplicates", True):
                    is_duplicate, reason = self._is_duplicate(title, uploader, video_id)
                    if is_duplicate:
                        safe_echo(f"{Fore.YELLOW}SKIP: Skipped ({reason})")
                        self.state["processed_urls"][url] = "success"
                        return True
            
            # Step 3: Now download (only if not a duplicate)
            click.echo(f"{Fore.CYAN}Downloading: {Fore.WHITE}{url}")
            
            with yt_dlp.YoutubeDL(self._get_ydl_opts()) as ydl:
                info = ydl.extract_info(url, download=True)
                title = info.get("title", "Unknown")
                video_id = info.get("id", "Unknown")
                
                # Track this download
                self.downloaded_videos.add(video_id)
                self.downloaded_titles.append(title)
                self.library_video_ids.add(video_id) # Update fast-check cache
                
                self.state["processed_urls"][url] = "success"
                safe_echo(f"{Fore.GREEN}OK: Downloaded: {Fore.WHITE}{title}")
                return True
                
        except Exception as e:
            if "Sign in to confirm you're not a bot" in str(e):
                safe_echo(f"{Fore.RED}BOT DETECTION: YouTube blocked this request. Try using cookies or waiting.")
            else:
                safe_echo(f"{Fore.RED}FAIL: Failed: {Fore.WHITE}{url}")
                safe_echo(f"{Fore.RED}Error: {str(e)}")
            return False

    def download_batch(self, urls: List[str], skip_errors: bool = True, max_workers: int = 1) -> dict:
        """Download multiple URLs in parallel"""
        stats = {
            "total": len(urls),
            "success": 0,
            "failed": 0,
            "skipped": 0,
            "failed_urls": []
        }
        
        click.echo(f"\n{Fore.YELLOW}Starting batch download: {len(urls)} URLs")
        click.echo(f"(Duplicates enabled: {self.config.get('skip_duplicates', True)}, Workers: {max_workers})\n")
        
        # Split URLs into those already processed and those not
        to_process = []
        for url in urls:
            if url in self.state["processed_urls"] and self.state["processed_urls"][url] == "success":
                stats["success"] += 1 # Or "skipped", but user wants "newly downloaded" focus
                # Actually let's count them as skipped in summary but show them as already done
            else:
                to_process.append(url)
        
        if not to_process:
            click.echo(f"{Fore.GREEN}All URLs already processed!")
            return stats

        click.echo(f"{Fore.CYAN}Queueing {len(to_process)} URLs for download...")

        if max_workers > 1:
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                future_to_url = {executor.submit(self._download_single, url): url for url in to_process}
                
                try:
                    for future in as_completed(future_to_url):
                        url = future_to_url[future]
                        try:
                            success = future.result()
                            if success:
                                stats["success"] += 1
                            else:
                                stats["failed"] += 1
                                stats["failed_urls"].append(url)
                        except Exception as e:
                            stats["failed"] += 1
                            stats["failed_urls"].append(url)
                            safe_echo(f"{Fore.RED}Unhandled error for {url}: {str(e)}")
                        
                        self._save_state() # Save periodically
                except KeyboardInterrupt:
                    executor.shutdown(wait=False)
                    raise
        else:
            for idx, url in enumerate(to_process, 1):
                safe_echo(f"{Fore.MAGENTA}[{idx}/{len(to_process)}]", nl=False)
                success = self._download_single(url)
                if success:
                    stats["success"] += 1
                else:
                    stats["failed"] += 1
                    stats["failed_urls"].append(url)
                
                self._save_state()
                if not success and not skip_errors:
                    break
        
        stats["skipped"] = self.skipped_count
        
        # Organize by genre if enabled
        if self.config.get("organize_by_genre", False):
            self._organize_by_genre()
        
        return stats


@click.group()
def cli():
    """YouTube Music Downloader - Batch download audio from YouTube"""
    pass


@cli.command()
@click.argument("url")
@click.option("-o", "--output", default="downloads", help="Output directory")
@click.option("--audio-format", default="mp3", help="Audio format (mp3, m4a, wav, etc.)")
@click.option("--audio-quality", default="0", help="Audio quality (0=best, or bitrate like 320)")
@click.option("--download-related", is_flag=True, default=False, help="Download related songs")
@click.option("--max-related", default=2, type=int, help="Maximum related songs to download")
@click.option("--organize-by-genre", is_flag=True, default=False, help="Organize downloads into genre folders")
@click.option("--genre-detection", default="metadata", type=click.Choice(["metadata", "title", "ai"]), help="Genre detection method")
def single(url: str, output: str, audio_format: str, audio_quality: str, download_related: bool, max_related: int, organize_by_genre: bool, genre_detection: str):
    """Download a single URL"""
    config_data = {
        "audio_format": audio_format,
        "audio_quality": audio_quality,
        "embed_metadata": True,
        "download_related": download_related,
        "max_related_per_song": max_related,
        "organize_by_genre": organize_by_genre,
        "genre_detection": genre_detection,
    }
    
    downloader = YouTubeMusicDownloader(output_dir=output)
    downloader.config = config_data
    
    success = downloader.download(url)
    
    # Organize by genre if enabled and download succeeded
    if success and organize_by_genre:
        downloader._organize_by_genre()


@cli.command()
@click.argument("url_file", type=click.Path(exists=True))
@click.option("-o", "--output", default="downloads", help="Output directory")
@click.option("--audio-format", default="mp3", help="Audio format (mp3, m4a, wav, etc.)")
@click.option("--audio-quality", default="0", help="Audio quality (0=best, or bitrate like 320)")
@click.option("--skip-errors", is_flag=True, default=True, help="Continue on download errors")
@click.option("--allow-duplicates", is_flag=True, default=False, help="Allow duplicate songs in playlists")
@click.option("--duplicate-threshold", default=0.85, type=float, help="Similarity threshold for duplicates (0.0-1.0)")
@click.option("--download-related", is_flag=True, default=False, help="Download related songs for each URL")
@click.option("--max-related", default=2, type=int, help="Maximum related songs per input URL")
@click.option("--organize-by-genre", is_flag=True, default=False, help="Organize downloads into genre folders")
@click.option("--genre-detection", default="metadata", type=click.Choice(["metadata", "title", "ai"]), help="Genre detection method")
@click.option("--workers", default=3, type=int, help="Number of parallel downloads")
def batch(url_file: str, output: str, audio_format: str, audio_quality: str, skip_errors: bool, 
          allow_duplicates: bool, duplicate_threshold: float, download_related: bool, max_related: int,
          organize_by_genre: bool, genre_detection: str, workers: int):
    """Download multiple URLs from a file (one URL per line)"""
    
    # Read URLs from file
    try:
        with open(url_file, 'r') as f:
            urls = [line.strip() for line in f if line.strip() and not line.startswith("#")]
    except FileNotFoundError:
        click.echo(f"{Fore.RED}Error: File not found: {url_file}")
        sys.exit(1)
    
    if not urls:
        click.echo(f"{Fore.RED}Error: No URLs found in file")
        sys.exit(1)
    
    config_data = {
        "audio_format": audio_format,
        "audio_quality": audio_quality,
        "embed_metadata": True,
        "skip_duplicates": not allow_duplicates,
        "duplicate_threshold": duplicate_threshold,
        "download_related": download_related,
        "max_related_per_song": max_related,
        "organize_by_genre": organize_by_genre,
        "genre_detection": genre_detection,
    }
    
    downloader = YouTubeMusicDownloader(output_dir=output)
    downloader.config = config_data
    
    # Show enhanced features
    features = []
    if not allow_duplicates:
        features.append("Enhanced deduplication")
    if download_related:
        features.append(f"Related songs ({max_related} per input)")
    if organize_by_genre:
        features.append(f"Genre organization ({genre_detection})")
    
    if features:
        safe_echo(f"{Fore.BLUE}Enabled: " + ", ".join(features))
    
    stats = downloader.download_batch(urls, skip_errors=skip_errors, max_workers=workers)
    
    # Print summary
    safe_echo(f"\n{Fore.YELLOW}{'='*50}")
    safe_echo(f"Download Summary:")
    safe_echo(f"  Total:      {stats['total']}")
    safe_echo(f"  Success:    {Fore.GREEN}{stats['success']}")  
    safe_echo(f"  Skipped:    {Fore.CYAN}{stats['skipped']}{Fore.YELLOW} (duplicates)")
    safe_echo(f"  Failed:     {Fore.RED}{stats['failed']}")
    
    if stats['failed_urls']:
        safe_echo(f"\n{Fore.YELLOW}Failed URLs:")
        for url in stats['failed_urls']:
            safe_echo(f"  {Fore.RED}- {url}")
    
    safe_echo(f"{Fore.YELLOW}{'='*50}\n")


@cli.command()
@click.option("-o", "--output", default="downloads", help="Output directory")
def setup(output: str):
    """Setup and test the environment"""
    safe_echo(f"{Fore.CYAN}YouTube Music Downloader - Setup")
    safe_echo(f"{Fore.YELLOW}{'='*50}\n")
    
    # Check yt-dlp
    try:
        import yt_dlp
        safe_echo(f"{Fore.GREEN}yt-dlp is installed")
    except ImportError:
        safe_echo(f"{Fore.RED}yt-dlp not found. Install with: pip install -r requirements.txt")
        sys.exit(1)
    
    # Check mutagen (for enhanced deduplication)
    try:
        from mutagen.mp3 import MP3
        from mutagen.id3 import ID3
        safe_echo(f"{Fore.GREEN}mutagen is installed (enhanced deduplication enabled)")
    except ImportError:
        safe_echo(f"{Fore.YELLOW}mutagen not found. Enhanced library deduplication disabled.")
        safe_echo(f"   Install with: pip install mutagen")
    
    # Check ffmpeg
    try:
        result = os.system("ffmpeg -version >nul 2>&1" if sys.platform == "win32" else "ffmpeg -version > /dev/null 2>&1")
        if result == 0:
            safe_echo(f"{Fore.GREEN}FFmpeg is installed")
        else:
            raise Exception("FFmpeg not found")
    except:
        safe_echo(f"{Fore.YELLOW}FFmpeg not found. Install it for audio conversion:")
        safe_echo(f"   Windows: choco install ffmpeg")
        safe_echo(f"   macOS: brew install ffmpeg")
        safe_echo(f"   Linux: sudo apt-get install ffmpeg")
    
    # Create output directory
    Path(output).mkdir(exist_ok=True)
    safe_echo(f"{Fore.GREEN}Output directory ready: {output}")
    
    safe_echo(f"\n{Fore.YELLOW}{'='*50}")
    safe_echo(f"\n{Fore.GREEN}Setup complete! Ready to download.\n")
    safe_echo(f"Usage examples:")
    safe_echo(f"  {Fore.CYAN}python downloader.py single \"https://www.youtube.com/watch?v=dQw4w9WgXcQ\"")
    safe_echo(f"  {Fore.CYAN}python downloader.py batch urls.txt")
    safe_echo(f"  {Fore.CYAN}python downloader.py batch urls.txt --download-related --max-related 2")
    safe_echo(f"  {Fore.CYAN}python downloader.py batch urls.txt --organize-by-genre --genre-detection metadata")
    safe_echo(f"  {Fore.CYAN}python downloader.py batch urls.txt -o \"my_music\" --audio-quality 320\n")


if __name__ == "__main__":
    cli()
