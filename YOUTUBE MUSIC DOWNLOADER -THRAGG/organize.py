import os
from pathlib import Path
from downloader import YouTubeMusicDownloader

def organize():
    downloader = YouTubeMusicDownloader(output_dir="downloads")
    # Enable organization and set method to metadata
    downloader.config["organize_by_genre"] = True
    downloader.config["genre_detection"] = "metadata"
    
    # We need to monkeypatch or modify _organize_by_genre to include .webm and .mp4
    # and maybe some others.
    
    print("Starting organization of existing downloads...")
    
    output_dir = Path("downloads")
    mp3_files = list(output_dir.glob("*.mp3"))
    
    organized_count = 0
    
    for mp3_path in mp3_files:
        try:
            # Use the existing detect_genre logic
            title = mp3_path.stem
            genre = downloader._detect_genre(title)
            
            # Sanitize genre for folder name (replace / with - to avoid Windows path issues)
            # and strip trailing/leading spaces which Windows doesn't like in folder names
            safe_genre = genre.replace(" / ", " - ").replace("/", "-").strip()
            
            # Create genre folder
            genre_dir = output_dir / safe_genre
            genre_dir.mkdir(parents=True, exist_ok=True)
            
            # Move MP3 file
            new_mp3_path = genre_dir / mp3_path.name
            print(f"Moving {mp3_path.name} to {safe_genre}")
            
            # If target exists, we might want to overwrite or skip
            # For now, let's just move (it will fail if exists on some systems, 
            # but rename usually overwrites on many)
            if new_mp3_path.exists():
                print(f"  Target already exists, overwriting: {new_mp3_path.name}")
                new_mp3_path.unlink()
            
            mp3_path.rename(new_mp3_path)
            
            # Move corresponding thumbnail and video files
            for ext in ['.jpg', '.webp', '.png', '.webm', '.mp4']:
                other_path = mp3_path.with_suffix(ext)
                if other_path.exists():
                    new_other_path = genre_dir / other_path.name
                    if new_other_path.exists():
                        new_other_path.unlink()
                    other_path.rename(new_other_path)
            
            organized_count += 1
            
        except Exception as e:
            print(f"Error organizing {mp3_path.name}: {e}")

    print(f"Finished. Organized {organized_count} files.")

if __name__ == "__main__":
    organize()
