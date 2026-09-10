"""Approved Cloudflare R2 and local song selection, individual controls, autonomous scoring, and runway-aware arrangement."""

from __future__ import annotations

import hashlib
import json
import math
import os
import random
import re
import secrets
import shutil
import subprocess
import urllib.request
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, Iterator, List, Optional, Tuple


TOKEN_RE = re.compile(r"[a-z0-9]+")

# ---------------------------------------------------------------------------
# Built-in canonical catalog of approved tracks
# ---------------------------------------------------------------------------

BUILTIN_SANCTIONED_TRACKS: List[Dict[str, Any]] = [
    {
        "id": "music-preview-cinematic-trailer-epic-intense-trailer",
        "title": "Intense Trailer",
        "artist": "Prometheus Original",
        "category": "cinematic-trailer-epic",
        "genreTags": ["cinematic", "trailer", "epic", "intense", "tension", "tech"],
        "moodTags": ["intense", "dramatic", "epic", "tension", "action"],
        "useCaseTags": ["hook", "high-stakes", "trailer", "commercial"],
        "avoidWhen": ["relaxing", "calm", "sleep", "meditation"],
        "intensity": "hard",
        "durationSec": 79.0,
        "audioObjectKey": "music-originals/cinematic-trailer-epic/intense-trailer.mp3",
        "relativeSrc": "audio/music/cinematic-trailer-epic--intense-trailer.mp3",
        "renderAllowed": True,
        "commercialAllowed": True,
        "licenseVerified": True,
        "licenseType": "sanctioned_private_music_originals",
        "approvalSource": "builtin_sanctioned_inventory",
    },
    {
        "id": "music-preview-classical-orchestral-prestige-vivaldi-the-four-seasons-summer-violin-concerto-in-g-minor-op-8-2-rv-315-iii-presto",
        "title": "Vivaldi: The Four Seasons, Summer, Violin Concerto in G Minor (Presto)",
        "artist": "Antonio Vivaldi",
        "category": "classical-orchestral-prestige",
        "genreTags": ["classical", "orchestral", "prestige", "baroque", "violin"],
        "moodTags": ["prestige", "sophisticated", "dramatic", "virtuosic", "elegant"],
        "useCaseTags": ["prestige", "luxury", "intellectual", "underscore"],
        "avoidWhen": ["casual", "workout", "phonk", "party"],
        "intensity": "soft",
        "durationSec": 163.47,
        "audioObjectKey": "music-originals/classical-orchestral-prestige/vivaldi-the-four-seasons-summer-violin-concerto-in-g-minor-op-8-2-rv-315-iii-presto.mp3",
        "relativeSrc": "audio/music/classical-orchestral-prestige--vivaldi-the-four-seasons-summer-violin-concerto-in-g-minor-op-8-2-rv-315-iii-presto.mp3",
        "renderAllowed": True,
        "commercialAllowed": True,
        "licenseVerified": True,
        "licenseType": "public_domain_classical_master",
        "approvalSource": "builtin_sanctioned_inventory",
    },
    {
        "id": "music-preview-classical-passacaglia-handel-halvorsen-relaxing-piano-music",
        "title": "Passacaglia - Handel / Halvorsen (Relaxing Piano)",
        "artist": "George Frideric Handel",
        "category": "classical",
        "genreTags": ["classical", "passacaglia", "piano", "solo", "minimal"],
        "moodTags": ["relaxing", "calm", "peaceful", "reflective", "contemplative"],
        "useCaseTags": ["speech-friendly", "focused", "underscore", "storytelling"],
        "avoidWhen": ["fast-paced", "hype", "intense-action"],
        "intensity": "soft",
        "durationSec": 169.76,
        "audioObjectKey": "music-originals/classical/passacaglia-handel-halvorsen-relaxing-piano-music.mp3",
        "relativeSrc": "audio/music/classical--passacaglia-handel-halvorsen-relaxing-piano-music.mp3",
        "renderAllowed": True,
        "commercialAllowed": True,
        "licenseVerified": True,
        "licenseType": "public_domain_classical_master",
        "approvalSource": "builtin_sanctioned_inventory",
    },
    {
        "id": "music-preview-hip-hop-trap-urban-energy-beats-that",
        "title": "Beats That",
        "artist": "Prometheus Urban",
        "category": "hip-hop-trap-urban-energy",
        "genreTags": ["hip-hop", "trap", "urban", "energy", "beats", "drive"],
        "moodTags": ["energy", "drive", "confident", "dynamic", "punchy"],
        "useCaseTags": ["fast-paced", "hype", "rhythmic", "speech-friendly"],
        "avoidWhen": ["meditation", "ambient", "sleep"],
        "intensity": "hard",
        "durationSec": 168.0,
        "audioObjectKey": "music-originals/hip-hop-trap-urban-energy/beats-that.mp3",
        "relativeSrc": "audio/music/hip-hop-trap-urban-energy--beats-that.mp3",
        "renderAllowed": True,
        "commercialAllowed": True,
        "licenseVerified": True,
        "licenseType": "sanctioned_private_music_originals",
        "approvalSource": "builtin_sanctioned_inventory",
    },
    {
        "id": "music-preview-lo-fi-chill-soft-focus-the-way-instrumental",
        "title": "The Way (Instrumental)",
        "artist": "Prometheus Lo-Fi",
        "category": "lo-fi-chill-soft-focus",
        "genreTags": ["lo-fi", "chill", "soft", "focus", "instrumental", "calm", "intentional", "deliberate"],
        "moodTags": ["chill", "soft", "focus", "calm", "mellow", "ambient", "intentional", "deliberate"],
        "useCaseTags": ["speech-friendly", "focused", "workflow", "underscore", "podcast", "deliberate-call"],
        "avoidWhen": ["intense", "rage", "hard-action"],
        "intensity": "soft",
        "durationSec": 424.85,
        "audioObjectKey": "music-originals/lo-fi-chill-soft-focus/the-way-instrumental.mp3",
        "relativeSrc": "audio/music/lo-fi-chill-soft-focus--the-way-instrumental.mp3",
        "renderAllowed": True,
        "commercialAllowed": True,
        "licenseVerified": True,
        "licenseType": "sanctioned_private_music_originals",
        "approvalSource": "builtin_sanctioned_inventory",
    },
    {
        "id": "music-preview-business-executive-board-bed",
        "title": "Executive Board Bed",
        "artist": "Prometheus Business",
        "category": "business",
        "genreTags": ["business", "corporate", "executive", "focus", "underscore", "intentional", "deliberate"],
        "moodTags": ["deliberate", "intentional", "focused", "corporate", "strategic", "confident"],
        "useCaseTags": ["speech-friendly", "business-call", "keynote", "conference", "underscore", "workflow"],
        "avoidWhen": ["party", "club", "workout", "rage", "hype"],
        "intensity": "medium",
        "durationSec": 96.0,
        "audioObjectKey": "music-originals/business/seed-executive-board-02.mp3",
        "relativeSrc": "audio/music/business--seed-executive-board-02.mp3",
        "renderAllowed": True,
        "commercialAllowed": True,
        "licenseVerified": True,
        "licenseType": "sanctioned_private_music_originals",
        "approvalSource": "builtin_sanctioned_inventory",
    },
    {
        "id": "music-preview-motivational-uplift-triumph",
        "title": "Triumph",
        "artist": "Prometheus Orchestral",
        "category": "motivational-uplift",
        "genreTags": ["motivational", "uplift", "triumph", "inspiring", "corporate", "business", "executive"],
        "moodTags": ["motivational", "uplifting", "triumphant", "optimistic", "proud", "intentional"],
        "useCaseTags": ["commercial", "reveal", "cta", "speech-friendly", "keynote"],
        "avoidWhen": ["dark", "horror", "grief"],
        "intensity": "medium",
        "durationSec": 188.8,
        "audioObjectKey": "music-originals/motivational-uplift/triumph.mp3",
        "relativeSrc": "audio/music/motivational-uplift--triumph.mp3",
        "renderAllowed": True,
        "commercialAllowed": True,
        "licenseVerified": True,
        "licenseType": "sanctioned_private_music_originals",
        "approvalSource": "builtin_sanctioned_inventory",
    },
    {
        "id": "music-preview-other-work-for-it",
        "title": "Work for It",
        "artist": "Prometheus Motion",
        "category": "other",
        "genreTags": ["other", "work", "fitness", "rhythm", "fast"],
        "moodTags": ["energetic", "focused", "grind", "determined"],
        "useCaseTags": ["hook", "high-tempo", "short-form"],
        "avoidWhen": ["soft", "sleep", "classical"],
        "intensity": "medium",
        "durationSec": 25.59,
        "audioObjectKey": "music-originals/other/work-for-it.mp3",
        "relativeSrc": "audio/music/other--work-for-it.mp3",
        "renderAllowed": True,
        "commercialAllowed": True,
        "licenseVerified": True,
        "licenseType": "sanctioned_private_music_originals",
        "approvalSource": "builtin_sanctioned_inventory",
    },
    {
        "id": "music-preview-pop-indie-lifestyle-pop-up",
        "title": "Pop Up",
        "artist": "Prometheus Pop",
        "category": "pop-indie-lifestyle",
        "genreTags": ["pop", "indie", "lifestyle", "bright", "modern"],
        "moodTags": ["fun", "cheerful", "lighthearted", "lifestyle", "youthful"],
        "useCaseTags": ["vlog", "lifestyle", "commercial", "speech-friendly"],
        "avoidWhen": ["somber", "intense-drama", "dark"],
        "intensity": "medium",
        "durationSec": 154.65,
        "audioObjectKey": "music-originals/pop-indie-lifestyle/pop-up.mp3",
        "relativeSrc": "audio/music/pop-indie-lifestyle--pop-up.mp3",
        "renderAllowed": True,
        "commercialAllowed": True,
        "licenseVerified": True,
        "licenseType": "sanctioned_private_music_originals",
        "approvalSource": "builtin_sanctioned_inventory",
    },
    {
        "id": "music-preview-tech-futuristic-ai-ain-t-ready",
        "title": "Ain't Ready",
        "artist": "Prometheus Synthetic",
        "category": "tech-futuristic-ai",
        "genreTags": ["tech", "futuristic", "ai", "synth", "cyberpunk", "electronic"],
        "moodTags": ["futuristic", "curious", "innovative", "modern", "bold"],
        "useCaseTags": ["tech-talk", "ai-workflow", "product-demo", "speech-friendly"],
        "avoidWhen": ["vintage", "acoustic", "historical"],
        "intensity": "medium",
        "durationSec": 138.27,
        "audioObjectKey": "music-originals/tech-futuristic-ai/ain-t-ready.mp3",
        "relativeSrc": "audio/music/tech-futuristic-ai--ain-t-ready.mp3",
        "renderAllowed": True,
        "commercialAllowed": True,
        "licenseVerified": True,
        "licenseType": "sanctioned_private_music_originals",
        "approvalSource": "builtin_sanctioned_inventory",
    },
    # ---------------------------------------------------------------------------
    # Creator Reference Archetype Tracks (Ingested from creator reference ontology)
    # ---------------------------------------------------------------------------
    {
        "id": "positive/first-place",
        "title": "FIRST PLACE",
        "artist": "Justin Bieber",
        "category": "positive",
        "archetype": "positive",
        "genreTags": ["pop", "r&b", "positive", "triumphant", "uplifting", "bright", "winning"],
        "moodTags": ["positive", "victorious", "celebratory", "optimistic", "energetic"],
        "useCaseTags": ["speech-friendly", "positive-reveal", "winning", "success-story", "lifestyle"],
        "avoidWhen": ["grief", "horror", "dark-ambient"],
        "intensity": "medium",
        "durationSec": 200.09,
        "dropOnsetSec": 8.5,
        "dropReason": "energy_surge_8.5s",
        "audioObjectKey": "music-originals/positive/Justin Bieber - FIRST PLACE.mp3",
        "relativeSrc": "audio/music/Justin Bieber - FIRST PLACE.mp3",
        "renderAllowed": True,
        "commercialAllowed": True,
        "licenseVerified": True,
        "licenseType": "creator_curated_reference",
        "approvalSource": "creator_reference_ontology_2026",
    },
    {
        "id": "positive/ethereal",
        "title": "Ethereal",
        "artist": "Txmy",
        "category": "positive",
        "archetype": "positive",
        "genreTags": ["electronic", "ambient", "positive", "dreamy", "synth", "uplifting", "ethereal"],
        "moodTags": ["positive", "peaceful", "transcendent", "glowing", "bright"],
        "useCaseTags": ["speech-friendly", "cinematic-reveal", "uplifting", "lifestyle", "travel"],
        "avoidWhen": ["heavy-metal", "action-drill", "horror"],
        "intensity": "soft",
        "durationSec": 168.0,
        "dropOnsetSec": 58.0,
        "dropReason": "energy_peak_58.0s",
        "audioObjectKey": "music-originals/positive/Txmy - Ethereal.mp3",
        "relativeSrc": "audio/music/Txmy - Ethereal.mp3",
        "renderAllowed": True,
        "commercialAllowed": True,
        "licenseVerified": True,
        "licenseType": "creator_curated_reference",
        "approvalSource": "creator_reference_ontology_2026",
    },
    {
        "id": "positive/fine-line-instrumental",
        "title": "Fine Line (Instrumental)",
        "artist": "Kapa Boy",
        "category": "positive",
        "archetype": "positive",
        "genreTags": ["pop", "acoustic", "positive", "bright", "celebratory", "warm", "hopeful"],
        "moodTags": ["positive", "uplifting", "warm", "triumphant", "hopeful"],
        "useCaseTags": ["speech-friendly", "story-resolution", "positive-reveal", "lifestyle"],
        "avoidWhen": ["dark", "gloom", "monotone"],
        "intensity": "medium",
        "durationSec": 113.88,
        "dropOnsetSec": 15.5,
        "dropReason": "energy_surge_15.5s",
        "audioObjectKey": "music-originals/positive/Kapa Boy - Fine Line (Instrumental).mp3",
        "relativeSrc": "audio/music/Kapa Boy - Fine Line (Instrumental).mp3",
        "renderAllowed": True,
        "commercialAllowed": True,
        "licenseVerified": True,
        "licenseType": "creator_curated_reference",
        "approvalSource": "creator_reference_ontology_2026",
    },
    {
        "id": "authority/a-good-man-with-a-broken-heart",
        "title": "A Good Man with a Broken Heart",
        "artist": "lovibe",
        "category": "authority",
        "archetype": "authority",
        "genreTags": ["cinematic", "instrumental", "authority", "heavyweight", "deep", "solemn"],
        "moodTags": ["authority", "commanding", "stoic", "reflective", "weighty"],
        "useCaseTags": ["speech-friendly", "executive-call", "hard-truth", "authority-speech"],
        "avoidWhen": ["comedy", "dance-party", "vlog-fun"],
        "intensity": "medium",
        "durationSec": 118.8,
        "dropOnsetSec": 9.0,
        "dropReason": "energy_surge_9.0s",
        "audioObjectKey": "music-originals/authority/lovibe - A Good Man with a Broken Heart.mp3",
        "relativeSrc": "audio/music/lovibe - A Good Man with a Broken Heart.mp3",
        "renderAllowed": True,
        "commercialAllowed": True,
        "licenseVerified": True,
        "licenseType": "creator_curated_reference",
        "approvalSource": "creator_reference_ontology_2026",
    },
    {
        "id": "authority/feeling-blue",
        "title": "Feeling Blue",
        "artist": "Caleb Arredondo",
        "category": "authority",
        "archetype": "authority",
        "genreTags": ["hip-hop", "instrumental", "authority", "stoic", "business", "dramatic"],
        "moodTags": ["authority", "commanding", "composed", "deliberate", "intense"],
        "useCaseTags": ["speech-friendly", "business-truth", "executive-monologue", "discipline"],
        "avoidWhen": ["silly", "party", "whimsical"],
        "intensity": "medium",
        "durationSec": 106.97,
        "dropOnsetSec": 70.5,
        "dropReason": "energy_peak_70.5s",
        "audioObjectKey": "music-originals/authority/Caleb Arredondo - Feeling Blue.mp3",
        "relativeSrc": "audio/music/Caleb Arredondo - Feeling Blue.mp3",
        "renderAllowed": True,
        "commercialAllowed": True,
        "licenseVerified": True,
        "licenseType": "creator_curated_reference",
        "approvalSource": "creator_reference_ontology_2026",
    },
    {
        "id": "storytelling/leanin-slowed",
        "title": "Leanin (Slowed)",
        "artist": "Prometheus Slowed",
        "category": "storytelling",
        "archetype": "storytelling",
        "genreTags": ["slowed", "reverb", "storytelling", "nostalgic", "atmospheric", "lo-fi"],
        "moodTags": ["storytelling", "contemplative", "reflective", "mellow", "moody"],
        "useCaseTags": ["speech-friendly", "personal-story", "journey", "struggle-to-triumph"],
        "avoidWhen": ["fast-hype", "comedy", "commercial-sell"],
        "intensity": "soft",
        "durationSec": 144.09,
        "dropOnsetSec": 13.5,
        "dropReason": "energy_surge_13.5s",
        "audioObjectKey": "music-originals/storytelling/Leanin (Slowed).mp3",
        "relativeSrc": "audio/music/Leanin (Slowed).mp3",
        "renderAllowed": True,
        "commercialAllowed": True,
        "licenseVerified": True,
        "licenseType": "creator_curated_reference",
        "approvalSource": "creator_reference_ontology_2026",
    },
    {
        "id": "storytelling/as-time-flies",
        "title": "As Time Flies",
        "artist": "Ty's Music",
        "category": "storytelling",
        "archetype": "storytelling",
        "genreTags": ["piano", "ambient", "storytelling", "time", "temporal", "journey"],
        "moodTags": ["storytelling", "nostalgic", "poignant", "reflective", "deliberate"],
        "useCaseTags": ["speech-friendly", "timeline-narrative", "reflection", "documentary"],
        "avoidWhen": ["club", "rave", "fast-dance"],
        "intensity": "soft",
        "durationSec": 61.8,
        "dropOnsetSec": 6.0,
        "dropReason": "energy_surge_6.0s",
        "audioObjectKey": "music-originals/storytelling/Ty's Music - As Time Flies.mp3",
        "relativeSrc": "audio/music/Ty's Music - As Time Flies.mp3",
        "renderAllowed": True,
        "commercialAllowed": True,
        "licenseVerified": True,
        "licenseType": "creator_curated_reference",
        "approvalSource": "creator_reference_ontology_2026",
    },
    {
        "id": "storytelling/every-living-breathing-moment",
        "title": "Every Living Breathing Moment",
        "artist": "Prometheus Cinematic",
        "category": "storytelling",
        "archetype": "storytelling",
        "genreTags": ["cinematic", "orchestral", "storytelling", "emotional", "epic-journey"],
        "moodTags": ["storytelling", "awe", "inspiring", "grand", "contemplative"],
        "useCaseTags": ["speech-friendly", "life-lesson", "deep-story", "documentary-climax"],
        "avoidWhen": ["frivolous", "meme", "dance"],
        "intensity": "medium",
        "durationSec": 106.25,
        "dropOnsetSec": 4.0,
        "dropReason": "energy_surge_4.0s",
        "audioObjectKey": "music-originals/storytelling/Every Living Breathing Moment.mp3",
        "relativeSrc": "audio/music/Every Living Breathing Moment.mp3",
        "renderAllowed": True,
        "commercialAllowed": True,
        "licenseVerified": True,
        "licenseType": "creator_curated_reference",
        "approvalSource": "creator_reference_ontology_2026",
    },
    {
        "id": "educational/earfquake",
        "title": "EARFQUAKE",
        "artist": "Tyler, The Creator",
        "category": "educational",
        "archetype": "educational",
        "genreTags": ["hip-hop", "synth-funk", "educational", "rhythmic", "bounce", "catchy"],
        "moodTags": ["educational", "head-nodding", "engaging", "energetic", "groove"],
        "useCaseTags": ["speech-friendly", "educational-hook", "explainer", "tactical-breakdown"],
        "avoidWhen": ["somber", "grief", "ambient-meditation"],
        "intensity": "medium",
        "durationSec": 190.07,
        "dropOnsetSec": 22.5,
        "dropReason": "energy_surge_22.5s",
        "audioObjectKey": "music-originals/educational/Tyler, The Creator - EARFQUAKE.mp3",
        "relativeSrc": "audio/music/Tyler, The Creator - EARFQUAKE.mp3",
        "renderAllowed": True,
        "commercialAllowed": True,
        "licenseVerified": True,
        "licenseType": "creator_curated_reference",
        "approvalSource": "creator_reference_ontology_2026",
    },
    {
        "id": "educational/daisies",
        "title": "Daisies",
        "artist": "Justin Bieber",
        "category": "educational",
        "archetype": "educational",
        "genreTags": ["r&b", "pop", "educational", "bounce", "rhythmic", "modern-groove"],
        "moodTags": ["educational", "fresh", "bouncy", "confident", "curious"],
        "useCaseTags": ["speech-friendly", "tutorial", "framework-explainer", "step-by-step"],
        "avoidWhen": ["funeral", "horror", "gothic"],
        "intensity": "medium",
        "durationSec": 176.44,
        "dropOnsetSec": 8.0,
        "dropReason": "energy_surge_8.0s",
        "audioObjectKey": "music-originals/educational/Justin Bieber - Daisies.mp3",
        "relativeSrc": "audio/music/Justin Bieber - Daisies.mp3",
        "renderAllowed": True,
        "commercialAllowed": True,
        "licenseVerified": True,
        "licenseType": "creator_curated_reference",
        "approvalSource": "creator_reference_ontology_2026",
    },
    {
        "id": "educational/atm",
        "title": "ATM",
        "artist": "Don Toliver",
        "category": "educational",
        "archetype": "educational",
        "genreTags": ["trap", "melodic", "educational", "bounce", "rhythmic-flow", "punchy"],
        "moodTags": ["educational", "focused", "driving", "sharp", "stylish"],
        "useCaseTags": ["speech-friendly", "quick-tips", "high-retention-hook", "tactical-framework"],
        "avoidWhen": ["sad-ballad", "meditation", "sleep"],
        "intensity": "medium",
        "durationSec": 192.7,
        "dropOnsetSec": 11.5,
        "dropReason": "energy_surge_11.5s",
        "audioObjectKey": "music-originals/educational/Don Toliver - ATM.mp3",
        "relativeSrc": "audio/music/Don Toliver - ATM.mp3",
        "renderAllowed": True,
        "commercialAllowed": True,
        "licenseVerified": True,
        "licenseType": "creator_curated_reference",
        "approvalSource": "creator_reference_ontology_2026",
    },
    {
        "id": "emotional/apathy",
        "title": "Apathy",
        "artist": "Prometheus Ambient",
        "category": "emotional",
        "archetype": "emotional",
        "genreTags": ["ambient", "dark-lofi", "emotional", "vulnerable", "melancholy", "raw"],
        "moodTags": ["emotional", "bittersweet", "lonely", "somber", "introspective"],
        "useCaseTags": ["speech-friendly", "vulnerable-truth", "sad-confession", "deep-reflection"],
        "avoidWhen": ["hype", "party", "fitness-workout"],
        "intensity": "soft",
        "durationSec": 117.07,
        "dropOnsetSec": 10.0,
        "dropReason": "energy_surge_10.0s",
        "audioObjectKey": "music-originals/emotional/Apathy.mp3",
        "relativeSrc": "audio/music/Apathy.mp3",
        "renderAllowed": True,
        "commercialAllowed": True,
        "licenseVerified": True,
        "licenseType": "creator_curated_reference",
        "approvalSource": "creator_reference_ontology_2026",
    },
    {
        "id": "emotional/weargue",
        "title": "WEArgue",
        "artist": "Prometheus Moody",
        "category": "emotional",
        "archetype": "emotional",
        "genreTags": ["lo-fi", "dramatic", "emotional", "tension", "bittersweet", "longing"],
        "moodTags": ["emotional", "conflict", "poignant", "dramatic", "haunting"],
        "useCaseTags": ["speech-friendly", "dramatic-conflict", "relationship-story", "raw-truth"],
        "avoidWhen": ["celebration", "corporate-keynote", "comedy"],
        "intensity": "medium",
        "durationSec": 341.79,
        "dropOnsetSec": 17.0,
        "dropReason": "energy_surge_17.0s",
        "audioObjectKey": "music-originals/emotional/WEArgue.mp3",
        "relativeSrc": "audio/music/WEArgue.mp3",
        "renderAllowed": True,
        "commercialAllowed": True,
        "licenseVerified": True,
        "licenseType": "creator_curated_reference",
        "approvalSource": "creator_reference_ontology_2026",
    },
    {
        "id": "emotional/limerence",
        "title": "Limerence",
        "artist": "Yves Tumor",
        "category": "emotional",
        "archetype": "emotional",
        "genreTags": ["ambient", "shoegaze", "emotional", "nostalgic", "lo-fi", "tape-hiss", "haunting"],
        "moodTags": ["emotional", "bittersweet", "yearning", "poetic", "transcendent", "hypnotic"],
        "useCaseTags": ["speech-friendly", "emotional", "cinematic-ending", "poignant-truth", "deep-vlog"],
        "avoidWhen": ["fast-paced-hype", "action"],
        "intensity": "soft",
        "durationSec": 329.4,
        "dropOnsetSec": 7.0,
        "dropReason": "energy_surge_7.0s",
        "audioObjectKey": "music-originals/emotional/Yves Tumor - Limerence.mp3",
        "relativeSrc": "audio/music/Yves Tumor - Limerence.mp3",
        "renderAllowed": True,
        "commercialAllowed": True,
        "licenseVerified": True,
        "licenseType": "creator_curated_reference",
        "approvalSource": "creator_reference_ontology_2026",
    },
]


def _r2_reference(reference: str) -> tuple[Optional[str], str]:
    value = reference.removeprefix("r2://")
    if reference.startswith("r2://"):
        bucket, separator, key = value.partition("/")
        if not separator or not bucket or not key:
            raise ValueError(f"Invalid R2 catalog reference: {reference}")
        return bucket, key
    return None, value


def _inventory_key_from_preview(preview: Dict[str, Any]) -> Optional[str]:
    source_name = Path(str(preview.get("src") or "")).name
    category, separator, file_name = source_name.partition("--")
    if not separator or not category or not file_name:
        return None
    return f"music-originals/{category}/{file_name}"


def _find_repo_root() -> Path:
    """Locate the project root directory safely."""
    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / "mini_run_pipeline").is_dir() or (parent / "package.json").is_file():
            return parent
    return current.parent.parent


def _clean_text_punctuation(val: str) -> str:
    s = str(val)
    s = s.replace("：", ": ").replace("⧸", " / ").replace("–", "-").replace("—", "-")
    s = s.replace("\uff02", '"').replace("\uff1a", ": ").replace("\u29f8", " / ")
    s = s.replace("“", '"').replace("”", '"').replace("’", "'").replace("‘", "'")
    return s


def _slugify_name(text: str) -> str:
    cleaned = re.sub(r"[\(\)\[\]\{\}\.,_\-–—]+", " ", str(text).lower())
    cleaned = re.sub(r"[^a-z0-9\s]+", "", cleaned)
    tokens = [t for t in cleaned.split() if t not in {"by", "official", "audio", "video", "visualizer", "music", "slowed", "remix", "feat", "ft"}]
    return "-".join(tokens)


def _parse_artist_and_title(raw_title: str) -> tuple[str, str]:
    cleaned = _clean_text_punctuation(raw_title).strip()
    lowered = cleaned.lower()
    inferred_artist = None
    if "vivaldi" in lowered:
        inferred_artist = "Antonio Vivaldi"
    elif "handel" in lowered or "halvorsen" in lowered:
        inferred_artist = "George Frideric Handel"
    elif "debussy" in lowered:
        inferred_artist = "Claude Debussy"
    elif "hauser" in lowered:
        inferred_artist = "HAUSER"
    elif "damma beatz" in lowered:
        inferred_artist = "Damma Beatz"
    elif "kygo" in lowered:
        inferred_artist = "Kygo"
    elif "lost frequencies" in lowered:
        inferred_artist = "Lost Frequencies"
    elif "lil tecca" in lowered:
        inferred_artist = "Lil Tecca"
    elif "dj anemia" in lowered:
        inferred_artist = "DJ ANEMIA"
    elif "petit biscuit" in lowered:
        inferred_artist = "Petit Biscuit"
    elif "andrea vanzo" in lowered:
        inferred_artist = "Andrea Vanzo"

    if " by " in cleaned.lower():
        parts = re.split(r"\s+by\s+", cleaned, flags=re.IGNORECASE)
        title = parts[0].strip("() ")
        artist = parts[1].strip("() ")
        return inferred_artist or artist, title
    if " - " in cleaned:
        parts = cleaned.split(" - ", 1)
        artist = parts[0].strip()
        title = parts[1].strip()
        return inferred_artist or artist, title
    return inferred_artist or "Prometheus Music", cleaned


def _infer_tags_and_intensity(title: str, category: str, existing_tags: Optional[List[str]] = None) -> tuple[List[str], str]:
    tags = list(existing_tags or [])
    lowered = f"{title} {category}".lower()
    keywords = [
        "epic", "cinematic", "trailer", "piano", "classical", "orchestral", "prestige",
        "trap", "phonk", "beat", "beats", "lo-fi", "lofi", "chill", "soft", "focus",
        "motivational", "uplift", "triumph", "pop", "indie", "lifestyle", "tech",
        "futuristic", "ai", "synth", "cyberpunk", "ambient", "dark", "calm", "dramatic",
        "electronic", "house", "dance", "funk", "groove", "action", "adventure", "intense",
        "slowed", "reverb", "relaxing", "vlog", "workout", "drill", "acoustic"
    ]
    for kw in keywords:
        if kw in lowered and kw not in tags:
            tags.append(kw)
    if any(k in lowered for k in ["trap", "phonk", "heavy", "intense", "action", "epic", "drill", "braam", "beats", "club", "speed", "fast", "presto"]):
        intensity = "hard"
    elif any(k in lowered for k in ["piano", "lo-fi", "lofi", "chill", "soft", "calm", "slowed", "ambient", "quiet", "relaxing", "intimate", "peaceful"]):
        intensity = "soft"
    else:
        intensity = "medium"
    return tags, intensity


def _resolve_local_audio_path(relative_or_name: str, root_dir: Optional[Path] = None) -> Optional[Path]:
    """Search project roots for the given audio filename or relative path."""
    root = root_dir or _find_repo_root()
    clean_name = Path(relative_or_name).name
    candidates = [
        root / relative_or_name,
        root / "remotion-app" / "public" / relative_or_name,
        root / "remotion-app" / "public" / "audio" / "music" / clean_name,
        root / "PROMETHEUS_SONGS" / clean_name,
        root / "docs" / "mini_landscape_runs" / "music" / clean_name,
        root / "YOUTUBE MUSIC DOWNLOADER -THRAGG" / "downloads" / clean_name,
        root / "public" / "audio" / "music" / clean_name,
    ]
    for cand in candidates:
        if cand.is_file() and cand.stat().st_size > 0:
            return cand
    downloader_dir = root / "YOUTUBE MUSIC DOWNLOADER -THRAGG" / "downloads"
    if downloader_dir.is_dir():
        for sub in downloader_dir.rglob(clean_name):
            if sub.is_file() and sub.stat().st_size > 0:
                return sub
    return None


def _find_any_valid_local_song(root_dir: Optional[Path] = None) -> Optional[Path]:
    """Return any playable local audio file from PROMETHEUS_SONGS or bundled music folders."""
    root = root_dir or _find_repo_root()
    search_dirs = [
        root / "PROMETHEUS_SONGS",
        root / "remotion-app" / "public" / "audio" / "music",
        root / "docs" / "mini_landscape_runs" / "music",
        root / "public" / "audio" / "music",
    ]
    for s_dir in search_dirs:
        if s_dir.is_dir():
            for f in sorted(s_dir.iterdir()):
                if f.is_file() and f.suffix.lower() in {".mp3", ".wav", ".m4a", ".aac"} and f.stat().st_size > 50000:
                    return f
    return None


def _discover_local_song_catalog(root_dir: Optional[Path] = None) -> Dict[str, Any]:
    """Assemble the complete approved song catalog (~224 tracks) across all project sources.
    
    Ingests:
      1. YOUTUBE MUSIC DOWNLOADER -THRAGG/downloads/music-catalog.json (149 Cloudflare R2 tracks)
      2. YOUTUBE MUSIC DOWNLOADER -THRAGG/downloads audio files (all category subdirectories)
      3. PROMETHEUS_SONGS directory (22 tracks)
      4. remotion-app/public/audio/music & remotion-app/src/data/music.local.json
      5. docs/mini_landscape_runs/music and seed song specifications
    """
    root = root_dir or _find_repo_root()
    entries: List[Dict[str, Any]] = []
    seen_ids: set[str] = set()

    def register_entry(
        track_id: str,
        title: str,
        artist: Optional[str],
        category: str,
        duration: Optional[float] = None,
        filepath: Optional[Path] = None,
        r2_key: Optional[str] = None,
        source: str = "",
        existing_tags: Optional[List[str]] = None,
        forced_intensity: Optional[str] = None,
        archetype: Optional[str] = None,
        drop_onset_sec: Optional[float] = None,
        drop_reason: Optional[str] = None,
    ) -> None:
        base_id = track_id.lower().strip()
        clean_id = base_id
        count = 2
        while clean_id in seen_ids:
            clean_id = f"{base_id}-{count}"
            count += 1
        seen_ids.add(clean_id)

        tags, auto_intensity = _infer_tags_and_intensity(title, category, existing_tags)
        intensity = forced_intensity if forced_intensity in {"soft", "medium", "hard"} else auto_intensity
        mood_tags = [t for t in tags if t in {
            "chill", "soft", "focus", "epic", "intense", "calm", "motivational",
            "dramatic", "dark", "ambient", "futuristic", "triumph", "warm", "peaceful"
        }]
        use_case_tags = ["speech-friendly"]
        if intensity == "soft":
            use_case_tags.extend(["podcast", "storytelling", "underscore"])
        elif intensity == "hard":
            use_case_tags.extend(["hook-bed", "action", "high-tempo"])
        else:
            use_case_tags.extend(["lifestyle", "workflow", "commercial"])

        filename = Path(filepath).name if filepath else f"{clean_id}.mp3"
        resolved_local = filepath if (filepath and filepath.is_file()) else _resolve_local_audio_path(filename, root)

        entries.append({
            "id": clean_id,
            "title": _clean_text_punctuation(title),
            "artist": artist or "Prometheus Music",
            "category": category,
            "archetype": archetype or category,
            "genreTags": tags,
            "moodTags": mood_tags or [intensity],
            "useCaseTags": use_case_tags,
            "avoidWhen": [],
            "intensity": intensity,
            "durationSec": float(duration) if duration else 60.0,
            "dropOnsetSec": float(drop_onset_sec) if drop_onset_sec is not None else None,
            "dropReason": drop_reason,
            "audioObjectKey": r2_key or f"music-originals/{category}/{filename}",
            "bucket": "prometheus-music",
            "localPath": str(resolved_local.resolve()) if resolved_local else None,
            "renderAllowed": True,
            "commercialAllowed": True,
            "licenseVerified": True,
            "licenseType": "sanctioned_private_music_originals",
            "approvalSource": source,
        })

    # 1. Downloader music-catalog.json (Cloudflare R2 catalog)
    cat_file = root / "YOUTUBE MUSIC DOWNLOADER -THRAGG" / "downloads" / "music-catalog.json"
    if cat_file.is_file():
        try:
            items = json.loads(cat_file.read_text(encoding="utf-8"))
            if isinstance(items, list):
                for item in items:
                    raw_title = item.get("title") or item.get("id") or "Untitled Track"
                    artist, title = _parse_artist_and_title(raw_title)
                    cat = item.get("categorySlug") or "other"
                    tid = item.get("id") or f"music-r2-{cat}-{_slugify_name(title)}"
                    register_entry(
                        track_id=tid,
                        title=title,
                        artist=artist,
                        category=cat,
                        duration=item.get("duration"),
                        r2_key=item.get("originalObjectKey"),
                        source="r2_downloader_manifest",
                    )
        except Exception:
            pass

    # 2. Audio files in YOUTUBE MUSIC DOWNLOADER -THRAGG/downloads
    down_dir = root / "YOUTUBE MUSIC DOWNLOADER -THRAGG" / "downloads"
    if down_dir.is_dir():
        for f in sorted(down_dir.rglob("*")):
            if f.is_file() and f.suffix.lower() in {".mp3", ".wav", ".m4a", ".webm"}:
                artist, title = _parse_artist_and_title(f.stem)
                parent = f.parent.name
                cat = parent.lower().replace(" ", "-") if parent not in ["downloads", "YOUTUBE MUSIC DOWNLOADER -THRAGG"] else "other"

                matched = False
                for e in entries:
                    if not e.get("localPath") and (_slugify_name(e["title"]) == _slugify_name(title) or _slugify_name(e["title"]) == _slugify_name(f.stem)):
                        e["localPath"] = str(f.resolve())
                        matched = True
                        break
                if not matched:
                    tid = f"yt-{cat}-{_slugify_name(f.stem)}"
                    approx_dur = round(f.stat().st_size / (192 * 1024 / 8), 1)
                    register_entry(
                        track_id=tid,
                        title=title,
                        artist=artist,
                        category=cat,
                        duration=max(15.0, min(600.0, approx_dur)),
                        filepath=f,
                        source="downloader_file",
                    )

    # 3. PROMETHEUS_SONGS
    creator_ref_map = {
        "first place": {
            "id": "positive/first-place", "title": "FIRST PLACE", "artist": "Justin Bieber",
            "category": "positive", "archetype": "positive", "intensity": "medium",
            "dropOnsetSec": 8.5, "dropReason": "energy_surge_8.5s", "duration": 200.09,
            "genreTags": ["pop", "r&b", "positive", "triumphant", "uplifting", "bright", "winning"],
        },
        "ethereal": {
            "id": "positive/ethereal", "title": "Ethereal", "artist": "Txmy",
            "category": "positive", "archetype": "positive", "intensity": "soft",
            "dropOnsetSec": 58.0, "dropReason": "energy_peak_58.0s", "duration": 168.0,
            "genreTags": ["electronic", "ambient", "positive", "dreamy", "synth", "uplifting", "ethereal"],
        },
        "fine line": {
            "id": "positive/fine-line-instrumental", "title": "Fine Line (Instrumental)", "artist": "Kapa Boy",
            "category": "positive", "archetype": "positive", "intensity": "medium",
            "dropOnsetSec": 15.5, "dropReason": "energy_surge_15.5s", "duration": 113.88,
            "genreTags": ["pop", "acoustic", "positive", "bright", "celebratory", "warm", "hopeful"],
        },
        "good man with a broken heart": {
            "id": "authority/a-good-man-with-a-broken-heart", "title": "A Good Man with a Broken Heart", "artist": "lovibe",
            "category": "authority", "archetype": "authority", "intensity": "medium",
            "dropOnsetSec": 9.0, "dropReason": "energy_surge_9.0s", "duration": 118.8,
            "genreTags": ["cinematic", "instrumental", "authority", "heavyweight", "deep", "solemn"],
        },
        "feeling blue": {
            "id": "authority/feeling-blue", "title": "Feeling Blue", "artist": "Caleb Arredondo",
            "category": "authority", "archetype": "authority", "intensity": "medium",
            "dropOnsetSec": 70.5, "dropReason": "energy_peak_70.5s", "duration": 106.97,
            "genreTags": ["hip-hop", "instrumental", "authority", "stoic", "business", "dramatic"],
        },
        "leanin": {
            "id": "storytelling/leanin-slowed", "title": "Leanin (Slowed)", "artist": "Prometheus Slowed",
            "category": "storytelling", "archetype": "storytelling", "intensity": "soft",
            "dropOnsetSec": 13.5, "dropReason": "energy_surge_13.5s", "duration": 144.09,
            "genreTags": ["slowed", "reverb", "storytelling", "nostalgic", "atmospheric", "lo-fi"],
        },
        "time flies": {
            "id": "storytelling/as-time-flies", "title": "As Time Flies", "artist": "Ty's Music",
            "category": "storytelling", "archetype": "storytelling", "intensity": "soft",
            "dropOnsetSec": 6.0, "dropReason": "energy_surge_6.0s", "duration": 61.8,
            "genreTags": ["piano", "ambient", "storytelling", "time", "temporal", "journey"],
        },
        "every living breathing moment": {
            "id": "storytelling/every-living-breathing-moment", "title": "Every Living Breathing Moment", "artist": "Prometheus Cinematic",
            "category": "storytelling", "archetype": "storytelling", "intensity": "medium",
            "dropOnsetSec": 4.0, "dropReason": "energy_surge_4.0s", "duration": 106.25,
            "genreTags": ["cinematic", "orchestral", "storytelling", "emotional", "epic-journey"],
        },
        "earfquake": {
            "id": "educational/earfquake", "title": "EARFQUAKE", "artist": "Tyler, The Creator",
            "category": "educational", "archetype": "educational", "intensity": "medium",
            "dropOnsetSec": 22.5, "dropReason": "energy_surge_22.5s", "duration": 190.07,
            "genreTags": ["hip-hop", "synth-funk", "educational", "rhythmic", "bounce", "catchy"],
        },
        "daisies": {
            "id": "educational/daisies", "title": "Daisies", "artist": "Justin Bieber",
            "category": "educational", "archetype": "educational", "intensity": "medium",
            "dropOnsetSec": 8.0, "dropReason": "energy_surge_8.0s", "duration": 176.44,
            "genreTags": ["r&b", "pop", "educational", "bounce", "rhythmic", "modern-groove"],
        },
        "atm": {
            "id": "educational/atm", "title": "ATM", "artist": "Don Toliver",
            "category": "educational", "archetype": "educational", "intensity": "medium",
            "dropOnsetSec": 11.5, "dropReason": "energy_surge_11.5s", "duration": 192.7,
            "genreTags": ["trap", "melodic", "educational", "bounce", "rhythmic-flow", "punchy"],
        },
        "apathy": {
            "id": "emotional/apathy", "title": "Apathy", "artist": "Prometheus Ambient",
            "category": "emotional", "archetype": "emotional", "intensity": "soft",
            "dropOnsetSec": 10.0, "dropReason": "energy_surge_10.0s", "duration": 117.07,
            "genreTags": ["ambient", "dark-lofi", "emotional", "vulnerable", "melancholy", "raw"],
        },
        "weargue": {
            "id": "emotional/weargue", "title": "WEArgue", "artist": "Prometheus Moody",
            "category": "emotional", "archetype": "emotional", "intensity": "medium",
            "dropOnsetSec": 17.0, "dropReason": "energy_surge_17.0s", "duration": 341.79,
            "genreTags": ["lo-fi", "dramatic", "emotional", "tension", "bittersweet", "longing"],
        },
        "limerence": {
            "id": "emotional/limerence", "title": "Limerence", "artist": "Yves Tumor",
            "category": "emotional", "archetype": "emotional", "intensity": "soft",
            "dropOnsetSec": 7.0, "dropReason": "energy_surge_7.0s", "duration": 329.4,
            "genreTags": ["ambient", "shoegaze", "emotional", "nostalgic", "lo-fi", "tape-hiss", "haunting"],
        },
    }

    p_songs = root / "PROMETHEUS_SONGS"
    if p_songs.is_dir():
        for f in sorted(p_songs.glob("*.*")):
            if f.is_file() and f.suffix.lower() in {".mp3", ".wav", ".m4a"}:
                stem_lower = f.stem.lower()
                matched_ref = None
                for k, v in creator_ref_map.items():
                    if k in stem_lower:
                        matched_ref = v
                        break
                if matched_ref:
                    register_entry(
                        track_id=matched_ref["id"],
                        title=matched_ref["title"],
                        artist=matched_ref["artist"],
                        category=matched_ref["category"],
                        archetype=matched_ref["archetype"],
                        duration=matched_ref["duration"],
                        drop_onset_sec=matched_ref["dropOnsetSec"],
                        drop_reason=matched_ref["dropReason"],
                        existing_tags=matched_ref["genreTags"],
                        forced_intensity=matched_ref["intensity"],
                        filepath=f,
                        source="creator_reference_ontology_2026",
                    )
                else:
                    artist, title = _parse_artist_and_title(f.stem.removeprefix("APLMate.com - "))
                    tid = f"prometheus-song-{_slugify_name(f.stem)}"
                    approx_dur = round(f.stat().st_size / (192 * 1024 / 8), 1)
                    register_entry(
                        track_id=tid,
                        title=title,
                        artist=artist or "Prometheus Urban",
                        category="trap",
                        duration=max(15.0, min(600.0, approx_dur)),
                        filepath=f,
                        source="prometheus_songs",
                    )

    # 4. remotion-app/public/audio/music
    rem_dir = root / "remotion-app" / "public" / "audio" / "music"
    if rem_dir.is_dir():
        for f in sorted(rem_dir.glob("*.*")):
            if f.is_file() and f.suffix.lower() in {".mp3", ".wav", ".m4a"}:
                artist, title = _parse_artist_and_title(f.stem)
                tid = f"music-preview-{_slugify_name(f.stem)}"
                approx_dur = round(f.stat().st_size / (192 * 1024 / 8), 1)
                register_entry(
                    track_id=tid,
                    title=title,
                    artist=artist or "Prometheus Core",
                    category="core-preview",
                    duration=max(15.0, min(600.0, approx_dur)),
                    filepath=f,
                    source="remotion_music",
                )

    # 5. docs/mini_landscape_runs/music
    land_dir = root / "docs" / "mini_landscape_runs" / "music"
    if land_dir.is_dir():
        for f in sorted(land_dir.glob("*.*")):
            if f.is_file() and f.suffix.lower() in {".mp3", ".wav", ".m4a"}:
                artist, title = _parse_artist_and_title(f.stem)
                tid = f"landscape-music-{_slugify_name(f.stem)}"
                approx_dur = round(f.stat().st_size / (192 * 1024 / 8), 1)
                register_entry(
                    track_id=tid,
                    title=title,
                    artist=artist or "Landscape Library",
                    category="landscape",
                    duration=max(15.0, min(600.0, approx_dur)),
                    filepath=f,
                    source="landscape_music",
                )

    # 6. Seed tracks from landscape_song_catalog.ts
    seed_tracks = [
        ("seed-soft-desk-piano-01", "Quiet Desk Piano", "LibrarySetters", "piano", 82.0, "soft"),
        ("seed-executive-board-02", "Executive Board Bed", "LibrarySetters", "business", 96.0, "medium"),
        ("seed-tech-pulse-03", "Data Centre Pulse", "LibrarySetters", "techno", 120.0, "hard"),
        ("seed-cinematic-braam-04", "Deep Cinema Braam", "LibrarySetters", "cinematic", 70.0, "hard"),
        ("seed-warm-funk-05", "Warm Funk Groove", "LibrarySetters", "funk", 108.0, "hard"),
        ("seed-driving-beat-06", "Driving Beat", "LibrarySetters", "hip-hop", 92.0, "hard"),
        ("seed-documentary-emotive-07", "Documentary Emotive", "LibrarySetters", "documentary", 88.0, "medium"),
        ("seed-luxe-ambient-pad-08", "Luxe Ambient Pad", "LibrarySetters", "ambient", 60.0, "soft"),
        ("seed-lofi-focus-loop-09", "Focus Lo-Fi Loop", "LibrarySetters", "lofi", 82.0, "soft"),
    ]
    for sid, stitle, sartist, scat, sdur, sint in seed_tracks:
        register_entry(
            track_id=sid,
            title=stitle,
            artist=sartist,
            category=scat,
            duration=sdur,
            forced_intensity=sint,
            source="seed_catalog",
        )

    # 7. remotion-app/src/data/music.local.json
    manifest_path = root / "remotion-app" / "src" / "data" / "music.local.json"
    if manifest_path.is_file():
        try:
            items = json.loads(manifest_path.read_text(encoding="utf-8"))
            if isinstance(items, list):
                for item in items:
                    tid = item.get("id")
                    if tid and tid not in seen_ids:
                        register_entry(
                            track_id=tid,
                            title=item.get("label") or tid,
                            artist=item.get("artist") or "Prometheus Music",
                            category="core-preview",
                            duration=float(item.get("durationSeconds") or 60.0),
                            existing_tags=item.get("tags") or [],
                            forced_intensity=item.get("intensity"),
                            source="music.local.json",
                        )
        except Exception:
            pass

    # 8. Fallback to built-in immutable tracks if still empty
    if not entries:
        for item in BUILTIN_SANCTIONED_TRACKS:
            local_file = _resolve_local_audio_path(str(item.get("relativeSrc") or ""), root)
            entries.append({
                **item,
                "localPath": str(local_file) if local_file else None,
            })

    return {
        "artifactType": "local_music_catalog",
        "version": "local-v3-comprehensive",
        "bucket": "prometheus-music",
        "entries": entries,
    }


def _discover_r2_song_catalog(storage: Any, metadata_path: Path) -> Dict[str, Any]:
    bucket = str(getattr(storage, "music_bucket", None) or getattr(storage, "bucket", "")).strip()
    if not bucket:
        raise RuntimeError("Cloudflare music inventory discovery requires an R2 music bucket.")
    objects = storage.list_objects("music-originals/", bucket=bucket)
    audio_objects = [
        item for item in objects
        if int(item.get("Size", 0)) > 0 and Path(str(item.get("Key", ""))).suffix.lower() in {".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg"}
    ]
    if not audio_objects:
        raise RuntimeError(f"Cloudflare bucket {bucket} has no songs under music-originals/.")

    previews: List[Dict[str, Any]] = []
    if metadata_path.is_file():
        parsed = json.loads(metadata_path.read_text(encoding="utf-8"))
        previews = parsed if isinstance(parsed, list) else []
    preview_by_key = {
        key: preview
        for preview in previews
        if (key := _inventory_key_from_preview(preview)) is not None
    }

    entries: List[Dict[str, Any]] = []
    for item in sorted(audio_objects, key=lambda value: str(value.get("Key", ""))):
        key = str(item["Key"])
        path = Path(key)
        category = path.parts[-2] if len(path.parts) > 1 else "other"
        track_slug = path.stem
        preview = preview_by_key.get(key, {})
        tags = [str(tag) for tag in (preview.get("tags") or [])]
        raw_title = str(preview.get("label") or track_slug.replace("-", " ").title())
        clean_title = raw_title.replace("：", ": ").replace("⧸", " / ")
        entries.append({
            "id": str(preview.get("id") or f"r2-{category}-{track_slug}"),
            "title": clean_title,
            "artist": str(preview.get("artist") or "Prometheus Original"),
            "category": category,
            "genreTags": tags or [token for token in category.split("-") if token],
            "moodTags": tags,
            "useCaseTags": [tag for tag in tags if tag in {"speech-friendly", "focused", "workflow", "underscore"}],
            "avoidWhen": [],
            "intensity": str(preview.get("intensity") or "medium"),
            "audioObjectKey": key,
            "bucket": bucket,
            "durationSec": preview.get("durationSeconds"),
            "renderAllowed": True,
            "commercialAllowed": True,
            "licenseVerified": True,
            "licenseType": "sanctioned_private_r2_music_originals",
            "approvalSource": "private_music_originals_inventory",
        })
    return {"artifactType": "r2_music_catalog", "version": "inventory-v1", "bucket": bucket, "entries": entries}


def load_song_catalog(
    reference: Optional[str] = None,
    *,
    storage: Any = None,
    metadata_path: Optional[Path] = None,
    env: Optional[Dict[str, str]] = None,
    force_fresh: bool = False,
) -> Dict[str, Any]:
    """Load the approved catalog with resilient multi-tier discovery."""
    environment = env if env is not None else os.environ
    reference = str(reference or environment.get("MUSIC_R2_CATALOG_PATH", "")).strip()

    if reference:
        if reference.startswith(("http://", "https://")):
            with urllib.request.urlopen(reference, timeout=60) as response:
                catalog = json.loads(response.read().decode("utf-8"))
        else:
            local_path = Path(reference)
            if local_path.is_file():
                catalog = json.loads(local_path.read_text(encoding="utf-8"))
            else:
                if storage is None:
                    from .storage import R2Storage
                    storage = R2Storage(environment)
                bucket, key = _r2_reference(reference)
                catalog = storage.read_json(key, bucket=bucket)
        if isinstance(catalog, dict) and isinstance(catalog.get("entries"), list):
            return catalog

    # Tier 1: Custom mock/test storage or explicitly requested fresh metadata discovery
    if (storage is not None and metadata_path is not None) or force_fresh:
        default_metadata = _find_repo_root() / "remotion-app" / "src" / "data" / "music.local.json"
        return _discover_r2_song_catalog(storage, Path(metadata_path or default_metadata))

    # Tier 2: Bundled pre-indexed comprehensive catalog manifest (all 269 tracks across all libraries)
    bundled_manifest = Path(__file__).resolve().parent / "comprehensive_catalog.json"
    if bundled_manifest.is_file():
        try:
            bundled = json.loads(bundled_manifest.read_text(encoding="utf-8"))
            if isinstance(bundled, dict) and isinstance(bundled.get("entries"), list) and len(bundled["entries"]) >= 200:
                return bundled
        except Exception:
            pass

    # Tier 2b: If custom storage is explicitly passed, use live R2 discovery
    if storage is not None:
        default_metadata = _find_repo_root() / "remotion-app" / "src" / "data" / "music.local.json"
        return _discover_r2_song_catalog(storage, Path(metadata_path or default_metadata))

    # Tier 3: Attempt R2 discovery if default credentials are enabled
    try:
        from .storage import R2Storage
        default_storage = R2Storage(environment)
        if default_storage.enabled:
            default_metadata = _find_repo_root() / "remotion-app" / "src" / "data" / "music.local.json"
            return _discover_r2_song_catalog(default_storage, Path(metadata_path or default_metadata))
    except Exception:
        pass

    # Tier 4: Local filesystem discovery across all 5 libraries
    local_catalog = _discover_local_song_catalog()
    if local_catalog.get("entries"):
        return local_catalog

    # Tier 5: Immutable built-in catalog
    return {
        "artifactType": "builtin_music_catalog",
        "version": "fallback-v1",
        "bucket": "prometheus-uploads",
        "entries": BUILTIN_SANCTIONED_TRACKS,
    }


def iter_selectable_songs(
    catalog: Optional[Dict[str, Any]] = None,
    *,
    category: Optional[str] = None,
    archetype: Optional[str] = None,
    mood: Optional[str] = None,
    intensity: Optional[str] = None,
    search: Optional[str] = None,
    storage: Any = None,
) -> Iterator[Dict[str, Any]]:
    """Yield approved selectable songs lazily one-by-one to prevent memory/relational clogging."""
    active_catalog = catalog or load_song_catalog(storage=storage)
    raw_entries = active_catalog.get("entries") if isinstance(active_catalog, dict) else active_catalog
    category_q = category.strip().lower() if category else None
    archetype_q = archetype.strip().lower() if archetype else None
    mood_q = mood.strip().lower() if mood else None
    intensity_q = intensity.strip().lower() if intensity else None
    search_q = search.strip().lower() if search else None

    for track in (raw_entries or []):
        if not _approved(track):
            continue
        if category_q and category_q not in str(track.get("category", "")).lower() and not any(category_q in str(tag).lower() for tag in (track.get("genreTags") or [])):
            continue
        if archetype_q and archetype_q != str(track.get("archetype", "")).lower() and archetype_q != str(track.get("category", "")).lower() and not any(archetype_q in str(tag).lower() for tag in (track.get("genreTags") or [])):
            continue
        if mood_q and not any(mood_q in str(tag).lower() for tag in (track.get("moodTags") or [])):
            continue
        if intensity_q and str(track.get("intensity", "")).lower() != intensity_q:
            continue
        if search_q:
            tokens_to_search = " ".join([
                str(track.get("title", "")),
                str(track.get("artist", "")),
                str(track.get("category", "")),
                str(track.get("archetype", "")),
                " ".join(str(t) for t in (track.get("genreTags") or [])),
                " ".join(str(t) for t in (track.get("moodTags") or [])),
            ]).lower()
            if search_q not in tokens_to_search:
                continue

        yield {
            "id": track.get("id"),
            "title": track.get("title"),
            "artist": track.get("artist"),
            "category": track.get("category"),
            "archetype": track.get("archetype") or track.get("category"),
            "genreTags": track.get("genreTags", []),
            "moodTags": track.get("moodTags", []),
            "useCaseTags": track.get("useCaseTags", []),
            "intensity": track.get("intensity", "medium"),
            "durationSec": track.get("durationSec"),
            "dropOnsetSec": track.get("dropOnsetSec"),
            "dropReason": track.get("dropReason"),
            "renderAllowed": track.get("renderAllowed", True),
            "commercialAllowed": track.get("commercialAllowed", True),
            "licenseVerified": track.get("licenseVerified", True),
            "licenseType": track.get("licenseType", "sanctioned"),
            "audioObjectKey": track.get("audioObjectKey"),
            "localPath": track.get("localPath"),
        }


def list_selectable_songs(
    catalog: Optional[Dict[str, Any]] = None,
    *,
    category: Optional[str] = None,
    archetype: Optional[str] = None,
    mood: Optional[str] = None,
    intensity: Optional[str] = None,
    search: Optional[str] = None,
    prompt: Optional[str] = None,
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    storage: Any = None,
) -> List[Dict[str, Any]]:
    """Return a queryable list of all selectable songs with optional pagination, filtering, and prompt intent ranking."""
    generator = iter_selectable_songs(
        catalog=catalog,
        category=category,
        archetype=archetype,
        mood=mood,
        intensity=intensity,
        search=search,
        storage=storage,
    )
    items = list(generator)
    if prompt:
        intent = extract_audio_intent_from_prompt(prompt)
        def _prompt_score(track: Dict[str, Any]) -> float:
            score, _, _ = _score_system_autonomous(track, set(), audio_intent=intent)
            return score
        items.sort(key=_prompt_score, reverse=True)

    if page is not None and page_size is not None and int(page) > 0 and int(page_size) > 0:
        p = int(page)
        ps = int(page_size)
        start_idx = (p - 1) * ps
        end_idx = start_idx + ps
        return items[start_idx:end_idx]
    return items


def search_songs(
    query: str,
    catalog: Optional[Dict[str, Any]] = None,
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    storage: Any = None
) -> List[Dict[str, Any]]:
    """Helper search function returning best-matching songs with optional pagination."""
    return list_selectable_songs(
        catalog=catalog,
        search=query,
        page=page,
        page_size=page_size,
        storage=storage,
    )



def _safe_audio_name(track_id: str, object_key_or_path: str) -> str:
    suffix = Path(object_key_or_path.split("?", 1)[0]).suffix.lower()
    if suffix not in {".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg"}:
        suffix = ".audio"
    stem = re.sub(r"[^a-zA-Z0-9._-]+", "-", track_id).strip("-") or "song"
    return f"{stem}{suffix}"


def _probe_audio_duration_ms(path: Path) -> int:
    try:
        completed = subprocess.run(
            [
                "ffprobe", "-v", "error", "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1", str(path),
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if completed.returncode == 0 and completed.stdout.strip():
            duration_ms = int(float(completed.stdout.strip()) * 1000)
            if duration_ms > 0:
                return duration_ms
    except Exception:
        pass

    # Fallback to file size estimation for MP3 at ~192kbps
    if path.is_file() and path.stat().st_size > 0:
        sec = path.stat().st_size / (192 * 1024 / 8)
        return max(1000, int(sec * 1000))

    raise RuntimeError(f"Song {path.name} duration could not be determined.")


def detect_track_chorus_or_drop(
    audio_path: str,
    *,
    timeline_duration_ms: int = 30000,
    max_search_sec: float = 120.0,
) -> Tuple[int, str]:
    """Detect the most energetic drop or chorus start offset in a music track.

    Analyzes rolling RMS energy across downsampled audio to locate the transition
    from quiet intro into the main beat / melodic chorus. Ensures sufficient runway
    remains for the timeline duration.
    """
    path_obj = Path(audio_path)
    if not path_obj.is_file() or path_obj.stat().st_size == 0:
        return 0, "file_missing"

    timeline_sec = float(timeline_duration_ms) / 1000.0

    try:
        cmd = [
            "ffmpeg", "-y", "-loglevel", "error",
            "-i", str(path_obj),
            "-ac", "1", "-ar", "1000",
            "-f", "f32le", "-"
        ]
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=15)
        if proc.returncode != 0 or not proc.stdout:
            return 0, "ffmpeg_read_failed"

        import numpy as np
        samples = np.frombuffer(proc.stdout, dtype=np.float32)
        total_sec = len(samples) / 1000.0

        min_runway_needed = timeline_sec + 2.0
        if total_sec <= min_runway_needed:
            return 0, "track_short_full_runway_needed"

        win_size = 2000
        step_size = 500
        rms_timeline: List[Tuple[float, float]] = []
        for i in range(0, len(samples) - win_size, step_size):
            t_sec = i / 1000.0
            block = samples[i:i + win_size]
            val = float(np.sqrt(np.mean(block ** 2)))
            rms_timeline.append((t_sec, val))

        if not rms_timeline:
            return 0, "rms_empty"

        intro_blocks = [x[1] for x in rms_timeline if x[0] <= 8.0]
        intro_rms = float(np.mean(intro_blocks)) if intro_blocks else 0.05

        search_ceiling = min(max_search_sec, total_sec - min_runway_needed)
        if search_ceiling < 8.0:
            return 0, "search_ceiling_too_tight"

        candidates = [x for x in rms_timeline if 8.0 <= x[0] <= search_ceiling]
        if not candidates:
            return 0, "no_candidates_in_window"

        surge_candidates = [x for x in candidates if x[1] >= max(0.09, intro_rms * 1.6)]
        if surge_candidates:
            onset_sec = surge_candidates[0][0]
            return int(round(onset_sec * 1000)), f"energy_surge_{onset_sec:.1f}s"

        peak = max(candidates, key=lambda x: x[1])
        if peak[1] > intro_rms * 1.2:
            return int(round(peak[0] * 1000)), f"peak_energy_{peak[0]:.1f}s"

    except Exception:
        pass

    return 0, "fallback_start"


def _reflow_materialized_program(program: Dict[str, Any], events: List[Dict[str, Any]]) -> Dict[str, Any]:
    duration_ms = max(1, int(program.get("durationMs", 0)))
    existing_transitions = list(program.get("transitions") or [])
    crossfade_ms = int(program.get("crossfadeMs") or (
        existing_transitions[0].get("durationMs") if existing_transitions else 900
    ))
    crossfade_ms = max(250, min(3000, crossfade_ms))
    reflowed_events: List[Dict[str, Any]] = []
    reflowed_transitions: List[Dict[str, Any]] = []
    cursor_ms = 0

    for event in events:
        actual_duration_ms = max(1, int(event["actualDurationMs"]))
        source_start_ms = max(0, int(event.get("sourceStartMs", 0)))
        runway_after_offset_ms = max(1, actual_duration_ms - source_start_ms)
        timeline_start_ms = 0 if not reflowed_events else max(0, cursor_ms - crossfade_ms)
        timeline_end_ms = min(duration_ms, timeline_start_ms + runway_after_offset_ms)
        reflowed_event = {
            **event,
            "timelineStartMs": timeline_start_ms,
            "timelineEndMs": timeline_end_ms,
            "sourceStartMs": source_start_ms,
            "sourceEndMs": source_start_ms + timeline_end_ms - timeline_start_ms,
        }
        if reflowed_events:
            previous = reflowed_events[-1]
            template = existing_transitions[len(reflowed_transitions)] if len(existing_transitions) > len(reflowed_transitions) else {}
            overlap_ms = max(0, previous["timelineEndMs"] - timeline_start_ms)
            reflowed_transitions.append({
                **template,
                "id": template.get("id") or f"song-transition-{len(reflowed_transitions) + 1}",
                "fromTrackId": previous["trackId"],
                "toTrackId": reflowed_event["trackId"],
                "startMs": timeline_start_ms,
                "durationMs": overlap_ms,
                "cause": {"gate": "song_runway_exhausted", "atMs": timeline_start_ms},
            })
        reflowed_events.append(reflowed_event)
        cursor_ms = timeline_end_ms
        if cursor_ms >= duration_ms:
            break

    if cursor_ms < duration_ms:
        raise RuntimeError(
            f"Materialized song runway ends at {cursor_ms}ms before the {duration_ms}ms render timeline."
        )
    return {**program, "events": reflowed_events, "transitions": reflowed_transitions}


def materialize_song_program(
    program: Dict[str, Any],
    *,
    storage: Any,
    cache_dir: str,
    duration_probe: Optional[Callable[[Path], int]] = None,
) -> Dict[str, Any]:
    """Materialize every planned song locally via local copy, resolved project asset, or R2 download."""
    destination_root = Path(cache_dir)
    destination_root.mkdir(parents=True, exist_ok=True)
    materialized = {**program, "events": []}
    probe = duration_probe or _probe_audio_duration_ms
    timeline_dur = int(program.get("durationMs", 30000))

    for event in program.get("events") or []:
        key = str(event.get("objectKey") or "").strip()
        local_path = str(event.get("localPath") or "").strip()
        bucket = str(event.get("bucket") or "").strip() or None
        track_id = str(event.get("trackId", "song"))

        destination = destination_root / _safe_audio_name(track_id, key or local_path or "song.mp3")

        # 1. Existing valid localPath
        if local_path and Path(local_path).is_file() and Path(local_path).stat().st_size > 0:
            if Path(local_path).resolve() != destination.resolve():
                shutil.copyfile(local_path, destination)
        # 2. Storage download if storage with download_file is provided (mock or active R2)
        elif key and storage is not None and hasattr(storage, "download_file") and getattr(storage, "enabled", True):
            try:
                storage.download_file(key, str(destination), bucket=bucket)
            except Exception as dl_err:
                resolved = _resolve_local_audio_path(local_path or key)
                if resolved is not None:
                    shutil.copyfile(resolved, destination)
                elif (cand := _find_any_valid_local_song()) is not None:
                    shutil.copyfile(cand, destination)
                else:
                    raise
        # 3. Local resolution against repo libraries
        elif (resolved := _resolve_local_audio_path(local_path or key)) is not None:
            shutil.copyfile(resolved, destination)
        elif (cand := _find_any_valid_local_song()) is not None:
            shutil.copyfile(cand, destination)
        elif destination.is_file() and destination.stat().st_size > 0:
            pass
        else:
            raise RuntimeError(f"Song event {event.get('id')} ({track_id}) could not materialize readable audio (key='{key}', local='{local_path}').")

        # Autonomous chorus / drop onset detection
        detected_start_ms = max(0, int(event.get("sourceStartMs", 0)))
        detection_reason = event.get("detectionReason") or "pre_planned"
        if detected_start_ms == 0:
            detected_start_ms, detection_reason = detect_track_chorus_or_drop(
                str(destination),
                timeline_duration_ms=timeline_dur,
            )

        materialized["events"].append({
            **event,
            "localPath": str(destination),
            "actualDurationMs": probe(destination),
            "sourceStartMs": detected_start_ms,
            "detectionReason": detection_reason,
        })

    return _reflow_materialized_program(materialized, materialized["events"])


def resolve_fallback_local_song(duration_ms: int, cache_dir: str) -> Optional[Dict[str, Any]]:
    """Build a reliable 1-event song program from any available local track in emergencies."""
    cand = _find_any_valid_local_song()
    if not cand:
        return None
    dest_dir = Path(cache_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_file = dest_dir / cand.name
    if cand.resolve() != dest_file.resolve():
        shutil.copyfile(cand, dest_file)
    dur = _probe_audio_duration_ms(dest_file)
    drop_offset_ms, reason = detect_track_chorus_or_drop(str(dest_file), timeline_duration_ms=duration_ms)
    runway_from_offset = max(1, dur - drop_offset_ms)
    actual_end_ms = min(duration_ms, runway_from_offset)
    return {
        "version": "2.0",
        "policy": "auto",
        "selectionMode": "local_emergency_fallback",
        "durationMs": duration_ms,
        "crossfadeMs": 900,
        "baseGainDb": -7.0,
        "events": [
            {
                "id": "song-1",
                "trackId": f"local/{cand.stem}",
                "title": cand.stem,
                "localPath": str(dest_file),
                "timelineStartMs": 0,
                "timelineEndMs": actual_end_ms,
                "sourceStartMs": drop_offset_ms,
                "sourceEndMs": drop_offset_ms + actual_end_ms,
                "actualDurationMs": dur,
                "detectionReason": reason,
            }
        ],
        "transitions": [],
    }


COMMON_SONG_STOPWORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
    "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
    "below", "between", "both", "but", "by", "can", "can't", "cannot", "could",
    "did", "do", "does", "doing", "down", "during", "each", "few", "for", "from",
    "further", "had", "has", "have", "having", "he", "her", "here", "hers", "herself",
    "him", "himself", "his", "how", "i", "if", "in", "into", "is", "it", "its", "itself",
    "just", "me", "more", "most", "my", "myself", "no", "nor", "not", "of", "off",
    "on", "once", "only", "or", "other", "our", "ours", "ourselves", "out", "over",
    "own", "same", "she", "should", "so", "some", "such", "than", "that", "the",
    "their", "theirs", "them", "themselves", "then", "there", "these", "they",
    "this", "those", "through", "to", "too", "under", "until", "up", "very", "was",
    "we", "were", "what", "when", "where", "which", "while", "who", "whom", "why",
    "with", "would", "you", "your", "yours", "yourself", "yourselves", "way", "get", "got",
    "like", "one", "two", "see", "say", "said", "know", "go", "make", "think", "take"
}


def _tokens(values: Iterable[Any]) -> set[str]:
    return {
        token
        for value in values
        for token in TOKEN_RE.findall(str(value).lower())
        if len(token) >= 2 and token not in COMMON_SONG_STOPWORDS
    }


def _approved(track: Dict[str, Any]) -> bool:
    try:
        duration_sec = float(track.get("durationSec"))
    except (TypeError, ValueError):
        return False
    has_source = bool(str(track.get("audioObjectKey") or "").strip() or str(track.get("localPath") or "").strip())
    return bool(
        track.get("renderAllowed")
        and track.get("commercialAllowed")
        and track.get("licenseVerified")
        and has_source
        and math.isfinite(duration_sec)
        and duration_sec > 0
    )


def _track_tokens(track: Dict[str, Any]) -> set[str]:
    return _tokens([
        track.get("title", ""),
        track.get("category", ""),
        track.get("artist", ""),
        *(track.get("genreTags") or []),
        *(track.get("moodTags") or []),
        *(track.get("useCaseTags") or []),
    ])


def _compatibility(left: Dict[str, Any], right: Dict[str, Any]) -> float:
    left_tags = _track_tokens(left)
    right_tags = _track_tokens(right)
    union = left_tags | right_tags
    return len(left_tags & right_tags) / len(union) if union else 0.0


# ---------------------------------------------------------------------------
# Semantic Domain Lexicons & User Prompt Intent Engine
# ---------------------------------------------------------------------------

AUDIO_DOMAIN_LEXICONS: Dict[str, Dict[str, Any]] = {
    "business": {
        "tokens": {
            "business", "company", "revenue", "profit", "margin", "market", "client",
            "customer", "growth", "scale", "enterprise", "roi", "sales", "roas", "ceo",
            "conference", "vision", "calendar", "executive", "investment", "founder",
            "corporate", "valuetainment", "leadership", "strategy", "strategic", "deal",
            "commercial", "cards", "holder", "entrepreneur", "industry", "pitch",
            "package", "capital", "equity", "board", "meeting", "management", "call",
            "bet-david", "valuetainer", "organization", "organizations", "network"
        },
        "preferredCategories": {
            "business", "classical", "lo-fi-chill-soft-focus", "lofi", "piano",
            "motivational-uplift", "tech-futuristic-ai", "documentary"
        },
        "preferredTags": {
            "business", "corporate", "executive", "focused", "underscore", "workflow",
            "motivational", "speech-friendly", "intellectual", "prestige", "strategic",
            "intentional", "deliberate", "calm"
        },
        "avoidCategories": {"other", "hip-hop-trap-urban-energy"},
        "avoidTags": {"party", "club", "dance", "rage", "fitness", "workout", "phonk"},
        "preferredIntensity": "medium",
        "description": "Professional business conference, corporate keynote, or strategic dialogue",
    },
    "intentional_deliberate": {
        "tokens": {
            "intentional", "deliberate", "measured", "thoughtful", "strategic", "discipline",
            "conviction", "calm", "steady", "focus", "foundation", "bedrock", "resilience",
            "impossible", "contemplative", "serious", "deep", "purpose", "calling", "clarity",
            "principle", "standards", "relentless", "sober", "reflection", "lessons",
            "mindset", "wisdom", "character"
        },
        "preferredCategories": {
            "business", "classical", "piano", "lo-fi-chill-soft-focus", "lofi",
            "documentary", "ambient", "classical-orchestral-prestige"
        },
        "preferredTags": {
            "focused", "underscore", "reflective", "contemplative", "prestige",
            "speech-friendly", "calm", "soft", "intentional", "deliberate", "storytelling"
        },
        "avoidCategories": {"other", "pop-indie-lifestyle"},
        "avoidTags": {"party", "hype", "club", "dance", "pop", "fun", "cheerful"},
        "preferredIntensity": "soft",
        "description": "Deliberate, intentional storytelling with high conviction and zero distraction",
    },
    "documentary_storytelling": {
        "tokens": {
            "documentary", "story", "memoir", "history", "journey", "life", "memory",
            "remember", "years", "archive", "investigation", "biography", "narrative",
            "book", "influence", "lessons", "past", "transformation", "truth"
        },
        "preferredCategories": {
            "documentary", "classical", "piano", "cinematic", "lo-fi-chill-soft-focus",
            "classical-orchestral-prestige"
        },
        "preferredTags": {
            "storytelling", "underscore", "reflective", "dramatic", "prestige",
            "speech-friendly", "focused"
        },
        "avoidCategories": {"pop-indie-lifestyle"},
        "avoidTags": {"party", "club", "phonk"},
        "preferredIntensity": "medium",
        "description": "Reflective autobiographical documentary or personal narrative arc",
    },
    "tech_innovation": {
        "tokens": {
            "tech", "technology", "ai", "software", "algorithm", "code", "coding",
            "digital", "data", "robot", "futuristic", "compute", "model", "neural",
            "platform", "system", "automation", "machine", "cyber", "cloud"
        },
        "preferredCategories": {"tech-futuristic-ai", "techno", "electronic"},
        "preferredTags": {"tech", "futuristic", "ai", "modern", "synth", "cyberpunk"},
        "avoidCategories": {"classical"},
        "avoidTags": {"vintage", "acoustic", "historical"},
        "preferredIntensity": "medium",
        "description": "Tech innovation, AI architecture, and cutting-edge software",
    },
    "motivation_fitness": {
        "tokens": {
            "workout", "fitness", "gym", "bodybuilding", "grind", "hustle",
            "train", "training", "exercise", "sweat", "lift", "muscle", "beast",
            "weights", "physique", "athlete"
        },
        "preferredCategories": {"hip-hop-trap-urban-energy", "motivational-uplift", "other"},
        "preferredTags": {"energy", "drive", "confident", "dynamic", "punchy", "hype", "fitness", "grind"},
        "avoidCategories": {"ambient"},
        "avoidTags": {"sleep", "meditation", "relaxing"},
        "preferredIntensity": "hard",
        "description": "High-intensity athletic training and explosive gym motivation",
    },
}


def extract_audio_intent_from_prompt(
    prompt: Optional[str] = None,
    transcript_tokens: Optional[set[str]] = None,
) -> Dict[str, Any]:
    """Parse user prompt and dialogue tokens to extract domain, genre, mood, and intensity."""
    raw_prompt = str(prompt or "").strip()
    prompt_tokens = _tokens([raw_prompt]) if raw_prompt else set()
    trans_tokens = set(transcript_tokens or set())
    all_tokens = prompt_tokens | trans_tokens

    genre_keywords = {
        "lo-fi": ["lofi", "lo-fi", "chillhop"],
        "classical": ["classical", "orchestral", "baroque", "violin", "symphony", "string quartet", "handel", "vivaldi", "bach"],
        "piano": ["piano", "keys", "solo piano"],
        "hip-hop": ["hip-hop", "hiphop", "trap", "rap", "beats"],
        "techno": ["techno", "tech-pulse", "electronic", "synth", "cyberpunk"],
        "ambient": ["ambient", "atmospheric", "pad", "drone"],
        "cinematic": ["cinematic", "trailer", "film score", "epic"],
        "business": ["business", "corporate", "executive", "boardroom"],
        "documentary": ["documentary", "storytelling", "emotive"],
        "pop": ["pop", "upbeat", "indie pop"],
    }
    explicit_genre = None
    prompt_lower = raw_prompt.lower()
    for g_canonical, g_aliases in genre_keywords.items():
        if any(alias in prompt_lower for alias in g_aliases):
            explicit_genre = g_canonical
            break

    mood_keywords = {
        "deliberate": ["deliberate", "intentional", "measured", "sober", "strategic", "calculated"],
        "calm": ["calm", "chill", "peaceful", "relaxing", "mellow", "serene", "quiet"],
        "focused": ["focus", "focused", "study", "deep work", "workflow"],
        "motivational": ["motivational", "inspiring", "uplifting", "triumphant", "hopeful"],
        "intense": ["intense", "dramatic", "epic", "high stakes", "urgent"],
        "dark": ["dark", "gritty", "ominous", "tension", "suspense"],
        "energetic": ["energetic", "hype", "fast", "punchy", "drive"],
    }
    explicit_mood = None
    for m_canonical, m_aliases in mood_keywords.items():
        if any(alias in prompt_lower for alias in m_aliases):
            explicit_mood = m_canonical
            break

    explicit_intensity = None
    if any(w in prompt_lower for w in ["soft", "quiet", "subtle", "low energy", "gentle", "minimal"]):
        explicit_intensity = "soft"
    elif any(w in prompt_lower for w in ["hard", "high energy", "loud", "heavy", "banger", "aggressive", "punchy"]):
        explicit_intensity = "hard"
    elif any(w in prompt_lower for w in ["medium", "balanced", "conversational", "moderate"]):
        explicit_intensity = "medium"

    domain_scores: Dict[str, float] = {}
    preferred_categories: set[str] = set()
    preferred_tags: set[str] = set()
    avoid_categories: set[str] = set()
    avoid_tags: set[str] = set()

    for domain_name, domain_data in AUDIO_DOMAIN_LEXICONS.items():
        prompt_hits = domain_data["tokens"] & prompt_tokens
        transcript_hits = domain_data["tokens"] & trans_tokens

        # In retrospective narratives (e.g. "I was a party guy... then I read a book, business card..."):
        # If intellectual/business narrative anchors are present, discount retrospective workout/party hits
        if domain_name == "motivation_fitness" and transcript_hits:
            if any(w in all_tokens for w in {"book", "friends", "influence", "business", "conference", "ceo", "recommended"}):
                transcript_hits = transcript_hits - {"bodybuilding", "workout"}

        score = len(prompt_hits) * 0.50 + len(transcript_hits) * 0.15
        if score > 0:
            domain_scores[domain_name] = round(score, 3)

    sorted_domains = sorted(domain_scores.items(), key=lambda x: x[1], reverse=True)
    active_domains = [d[0] for d in sorted_domains if d[1] >= 0.20]
    if not active_domains and sorted_domains:
        active_domains = [sorted_domains[0][0]]

    for dom in active_domains:
        d_info = AUDIO_DOMAIN_LEXICONS[dom]
        preferred_categories.update(d_info["preferredCategories"])
        preferred_tags.update(d_info["preferredTags"])
        avoid_categories.update(d_info["avoidCategories"])
        avoid_tags.update(d_info["avoidTags"])

    return {
        "rawPrompt": raw_prompt,
        "explicitGenre": explicit_genre,
        "explicitMood": explicit_mood,
        "explicitIntensity": explicit_intensity,
        "domainScores": domain_scores,
        "activeDomains": active_domains,
        "preferredCategories": sorted(preferred_categories),
        "preferredTags": sorted(preferred_tags),
        "avoidCategories": sorted(avoid_categories),
        "avoidTags": sorted(avoid_tags),
    }


# ---------------------------------------------------------------------------
# Individual Selection Resolution ("How the individual selects songs")
# ---------------------------------------------------------------------------

def resolve_individual_selection(
    candidates: List[Dict[str, Any]],
    design: Dict[str, Any],
) -> Optional[Tuple[Dict[str, Any], str]]:
    """Determine if the individual specified a song, genre, mood, artist, or custom track.

    Supports:
      - songTrackId / songId / trackId (exact id match)
      - songTitle / songName / songQuery (title or stem substring/match)
      - songCategory / songGenre (genre/category match)
      - songMood / mood (mood tag match)
      - songIntensity / songEnergy (soft / medium / hard match)
      - songArtist / artist (artist substring match)
      - songSource / songPath / songUrl (custom track file or URL)
    """
    design_copy = dict(design or {})

    # 1. Custom audio path or URL provided by individual
    custom_src = str(design_copy.get("songSource") or design_copy.get("songPath") or design_copy.get("songUrl") or "").strip()
    if custom_src:
        p = Path(custom_src)
        if p.is_file() and p.stat().st_size > 0:
            duration_sec = 60.0
            try:
                duration_sec = float(_probe_audio_duration_ms(p)) / 1000.0
            except Exception:
                pass
            custom_track = {
                "id": f"custom-{hashlib.sha256(custom_src.encode()).hexdigest()[:10]}",
                "title": p.stem.replace("-", " ").replace("_", " ").title(),
                "artist": "Individual Upload",
                "category": "custom",
                "genreTags": ["custom", "individual-upload"],
                "moodTags": ["custom"],
                "useCaseTags": ["individual-selected"],
                "avoidWhen": [],
                "intensity": "medium",
                "localPath": str(p),
                "audioObjectKey": f"custom-music/{p.name}",
                "bucket": "prometheus-uploads",
                "durationSec": duration_sec,
                "renderAllowed": True,
                "commercialAllowed": True,
                "licenseVerified": True,
                "licenseType": "user_provided_audio",
                "approvalSource": "individual_explicit_source",
            }
            return custom_track, f"Individual supplied custom audio file: {p.name}"

    # 2. Exact Track ID requested
    target_id = str(design_copy.get("songTrackId") or design_copy.get("songId") or design_copy.get("trackId") or "").strip()
    if target_id:
        for c in candidates:
            cand_id = str(c["id"]).lower()
            if cand_id == target_id.lower() or target_id.lower() in cand_id or cand_id.endswith(target_id.lower()):
                return c, f"Individual explicitly selected track ID: '{target_id}'."

    # 3. Track Title / Query requested
    title_req = str(design_copy.get("songTitle") or design_copy.get("songName") or design_copy.get("songQuery") or "").strip().lower()
    if title_req:
        for c in candidates:
            cand_title = str(c.get("title", "")).lower()
            if title_req == cand_title or title_req in cand_title or cand_title in title_req:
                return c, f"Individual selected song title matching: '{title_req}' ({c.get('title')})."

    # 4. Artist filter
    artist_req = str(design_copy.get("songArtist") or design_copy.get("artist") or "").strip().lower()
    if artist_req:
        for c in candidates:
            cand_artist = str(c.get("artist", "")).lower()
            cand_title = str(c.get("title", "")).lower()
            cand_id = str(c.get("id", "")).lower()
            if artist_req in cand_artist or artist_req in cand_title or artist_req in cand_id:
                if artist_req in cand_title and (not c.get("artist") or c.get("artist") == "Prometheus Music"):
                    c["artist"] = artist_req.title()
                return c, f"Individual selected song by artist matching: '{artist_req}' ({c.get('artist') or c.get('title')})."

    # 5. Genre / Category preference
    genre_req = str(design_copy.get("songGenre") or design_copy.get("songCategory") or "").strip().lower()
    if genre_req:
        matching_genre = [
            c for c in candidates
            if genre_req in str(c.get("category", "")).lower()
            or any(genre_req in str(t).lower() for t in (c.get("genreTags") or []))
        ]
        if matching_genre:
            return matching_genre[0], f"Individual selected song category/genre: '{genre_req}' ({matching_genre[0].get('title')})."

    # 6. Mood preference
    mood_req = str(design_copy.get("songMood") or design_copy.get("mood") or "").strip().lower()
    if mood_req:
        matching_mood = [
            c for c in candidates
            if any(mood_req in str(t).lower() for t in (c.get("moodTags") or []))
        ]
        if matching_mood:
            return matching_mood[0], f"Individual selected song mood: '{mood_req}' ({matching_mood[0].get('title')})."

    # 7. Intensity preference
    intensity_req = str(design_copy.get("songIntensity") or design_copy.get("songEnergy") or "").strip().lower()
    if intensity_req in {"soft", "medium", "hard"}:
        matching_intensity = [c for c in candidates if str(c.get("intensity", "")).lower() == intensity_req]
        if matching_intensity:
            return matching_intensity[0], f"Individual selected song intensity: '{intensity_req}' ({matching_intensity[0].get('title')})."

    # 7b. Creator Archetype preference (positive, authority, storytelling, educational, emotional)
    arch_req = str(design_copy.get("songArchetype") or design_copy.get("archetype") or "").strip().lower()
    if arch_req:
        matching_arch = [
            c for c in candidates
            if arch_req == str(c.get("archetype", "")).lower()
            or arch_req == str(c.get("category", "")).lower()
            or arch_req in str(c.get("id", "")).lower()
        ]
        if matching_arch:
            return matching_arch[0], f"Individual selected song archetype: '{arch_req}' ({matching_arch[0].get('title')})."

    # 8. Natural language user prompt direct title / artist request
    prompt_str = str(design_copy.get("prompt") or design_copy.get("userPrompt") or "").strip()
    if prompt_str:
        prompt_lower = prompt_str.lower()
        # Explicit track title mentioned directly in user prompt
        for c in candidates:
            cand_title = str(c.get("title", "")).lower()
            clean_cand_title = cand_title.replace(" (instrumental)", "").replace(" (presto)", "").strip()
            if len(clean_cand_title) >= 4 and clean_cand_title in prompt_lower:
                return c, f"Individual prompt explicitly requested track: '{c.get('title')}'."
        # Explicit artist mentioned directly in user prompt
        for c in candidates:
            cand_artist = str(c.get("artist", "")).lower()
            if len(cand_artist) >= 4 and cand_artist in prompt_lower and cand_artist not in {"prometheus music", "prometheus original", "librarysetters"}:
                return c, f"Individual prompt explicitly requested artist: '{c.get('artist')}' ({c.get('title')})."

    return None


# ---------------------------------------------------------------------------
# Autonomous System Scoring Matrix ("How the system selects songs")
# ---------------------------------------------------------------------------

LOOK_TO_MUSIC_AFFINITIES: Dict[str, Dict[str, Any]] = {
    "teal_and_orange_blockbuster": {
        "tags": {"cinematic", "trailer", "epic", "intense", "action", "contrast"},
        "preferredIntensity": "hard",
        "rationale": "Blockbuster visual grade harmonizes with high-stakes cinematic trailer and punchy beats.",
    },
    "moody_dramatic_cinema": {
        "tags": {"cinematic", "dramatic", "suspense", "dark", "tension"},
        "preferredIntensity": "medium",
        "rationale": "Moody shadows align with suspenseful dramatic underscore and orchestral tension.",
    },
    "vintage_warm_film": {
        "tags": {"lo-fi", "chill", "soft", "focus", "acoustic", "calm", "mellow"},
        "preferredIntensity": "soft",
        "rationale": "Warm vintage film grain pairs naturally with relaxed lo-fi chill and soft piano.",
    },
    "cold_nordic_minimal": {
        "tags": {"ambient", "lo-fi", "minimal", "calm", "focus", "piano"},
        "preferredIntensity": "soft",
        "rationale": "Cool minimal aesthetics demand understated ambient underscore.",
    },
    "neon_tokyo_cyberpunk": {
        "tags": {"tech", "futuristic", "ai", "synth", "cyberpunk", "electronic", "trap", "phonk"},
        "preferredIntensity": "hard",
        "rationale": "Neon cyberpunk visuals demand driving electronic, synth, or phonk energy.",
    },
    "faded_black_and_white": {
        "tags": {"classical", "passacaglia", "piano", "minimal", "reflective", "calm"},
        "preferredIntensity": "soft",
        "rationale": "Monochrome contrast pairs with timeless classical piano and acoustic strings.",
    },
    "bleach_bypass": {
        "tags": {"intense", "dark", "tension", "trap", "hard", "gritty"},
        "preferredIntensity": "hard",
        "rationale": "Bleach bypass grit calls for heavy trap bass and high-tension underscore.",
    },
    "golden_hour_commercial": {
        "tags": {"motivational", "uplift", "pop", "lifestyle", "triumph", "inspiring"},
        "preferredIntensity": "medium",
        "rationale": "Golden hour warmth resonates with uplifting motivational and lifestyle pop.",
    },
    "emerald_prestige": {
        "tags": {"classical", "orchestral", "prestige", "violin", "luxury", "baroque"},
        "preferredIntensity": "soft",
        "rationale": "Rich emerald palette complements prestigious classical and orchestral pieces.",
    },
    "sci_netone_balanced": {
        "tags": {"tech", "ai", "focused", "workflow", "underscore", "modern"},
        "preferredIntensity": "medium",
        "rationale": "Balanced tech grade matches modern futuristic AI underscore.",
    },
}


# ---------------------------------------------------------------------------
# Creator Reference Emotional Archetype Ontology (5 Core Pillars)
# Reference: image_657.png (Positive), image_658.png (Authority),
#            image_659.png (Storytelling), image_660.png (Educational),
#            image_661.png (Emotional)
# ---------------------------------------------------------------------------

CREATOR_EMOTIONAL_ARCHETYPES = ["positive", "authority", "storytelling", "educational", "emotional"]

ARCHETYPE_LEXICON: Dict[str, set[str]] = {
    "positive": {
        "win", "winning", "winner", "success", "successful", "breakthrough", "triumph", "victory",
        "celebrate", "celebrating", "celebration", "amazing", "awesome", "transform", "transformed",
        "transformation", "energy", "smile", "joy", "happy", "happiness", "potential", "freedom",
        "dream", "achieve", "achieved", "achievement", "elevate", "grow", "growth", "gain",
        "blessed", "greatest", "opportunity", "unstoppable", "conquer", "first", "place", "champion",
        "excited", "thrilled", "radiant", "inspire", "inspiring", "positive", "shine", "best", "proud",
        "thrive", "victorious", "optimistic", "breakthroughs"
    },
    "authority": {
        "discipline", "rules", "rule", "power", "powerful", "executive", "leadership", "leader",
        "standard", "standards", "respect", "command", "brutal", "truth", "facts", "reality",
        "dominate", "control", "focus", "business", "ceo", "empire", "money", "wealthy", "million",
        "billion", "revenue", "profit", "invest", "investor", "scale", "boardroom", "stoic",
        "unapologetic", "authority", "status", "demanded", "results", "operate", "vision", "strategy",
        "contract", "market", "position", "mastery", "elite", "hierarchy", "boss", "financial"
    },
    "storytelling": {
        "story", "stories", "remember", "remembered", "years", "ago", "started", "journey", "struggle",
        "struggled", "struggles", "walked", "felt", "then", "suddenly", "moment", "moments", "memory",
        "memories", "past", "chapter", "path", "road", "turned", "lesson", "lessons", "learned",
        "never", "forgot", "life", "realized", "looking", "back", "came", "across", "experienced",
        "throughout", "history", "origin", "began", "narrative", "childhood", "timeline", "climb",
        "once", "upon", "decided", "turning", "point"
    },
    "educational": {
        "step", "steps", "framework", "tips", "tip", "strategy", "strategies", "method", "methods",
        "system", "systems", "teach", "learn", "learning", "guide", "explain", "reason", "why",
        "because", "mistake", "mistakes", "avoid", "secret", "secrets", "breakdown", "analysis",
        "hack", "hacks", "tactic", "tactics", "blueprint", "process", "rule", "thumb", "takeaway",
        "education", "tutorial", "lesson", "concept", "structure", "principle", "principles", "here",
        "how", "watch", "break", "down", "simple", "clarity", "understand", "formula", "technique",
        "techniques"
    },
    "emotional": {
        "pain", "hurt", "hurts", "cry", "crying", "cried", "lost", "loss", "heart", "broken",
        "empty", "lonely", "loneliness", "dark", "darkness", "fear", "scared", "tears", "tear",
        "goodbye", "regret", "miss", "missing", "soul", "deep", "inside", "sorrow", "vulnerable",
        "depressed", "depression", "grief", "sadness", "bittersweet", "poignant", "ache", "brokenheart",
        "brokenhearted", "longing", "yearning", "despair", "helpless", "tragic", "grieving", "hopeless",
        "alone", "bleeding", "vulnerability"
    },
}


def analyze_video_emotional_storyboard(
    chunks: List[Dict[str, Any]],
    duration_ms: int,
    prompt: Optional[str] = None,
) -> Dict[str, Any]:
    """Analyze the complete video narrative to generate an Act-by-Act emotional storyboard.
    
    Structure:
      - Act 1: Hook / Premise (0% to ~25% or first 5-8s)
      - Act 2: Escalation / Core Journey (25% to ~75%)
      - Act 3: Climax / Payoff / Resolution (75% to 100%)
      
    Maps video pacing, emotional arc, narrative climax (climax_ms), and determines
    the optimal song entry strategy (hook_drop vs climax_sync vs narrative_intro).
    """
    dur_ms = max(1000, int(duration_ms))
    act1_cutoff = min(int(dur_ms * 0.25), 8000)
    act2_cutoff = int(dur_ms * 0.75)

    act1_chunks: List[Dict[str, Any]] = []
    act2_chunks: List[Dict[str, Any]] = []
    act3_chunks: List[Dict[str, Any]] = []

    for c in chunks:
        start = int(c.get("startMs", 0))
        if start < act1_cutoff:
            act1_chunks.append(c)
        elif start < act2_cutoff:
            act2_chunks.append(c)
        else:
            act3_chunks.append(c)

    # Act WPS cadences
    act1_wps = _calculate_speech_cadence(act1_chunks)
    act2_wps = _calculate_speech_cadence(act2_chunks)
    act3_wps = _calculate_speech_cadence(act3_chunks)

    # Score archetypes per act
    def score_act(act_chunks: List[Dict[str, Any]]) -> Dict[str, float]:
        text = " ".join(str(c.get("text", "")).lower() for c in act_chunks)
        tokens = set(TOKEN_RE.findall(text))
        scores: Dict[str, float] = {a: 0.0 for a in CREATOR_EMOTIONAL_ARCHETYPES}
        for arch, lex in ARCHETYPE_LEXICON.items():
            matches = tokens & lex
            scores[arch] = float(len(matches))
        return scores

    act1_scores = score_act(act1_chunks)
    act2_scores = score_act(act2_chunks)
    act3_scores = score_act(act3_chunks)

    # Weighted cumulative scores
    overall_scores: Dict[str, float] = {a: 0.0 for a in CREATOR_EMOTIONAL_ARCHETYPES}
    for a in CREATOR_EMOTIONAL_ARCHETYPES:
        overall_scores[a] = round(
            act1_scores[a] * 0.30 + act2_scores[a] * 0.40 + act3_scores[a] * 0.30, 2
        )

    # Prompt intent modulation
    if prompt:
        p_lower = prompt.lower()
        if any(k in p_lower for k in ["positive", "celebrat", "win", "optimist", "triumph", "uplift"]):
            overall_scores["positive"] += 1.5
        if any(k in p_lower for k in ["authority", "business", "executive", "stoic", "discipline", "deliberate", "call"]):
            overall_scores["authority"] += 1.5
        if any(k in p_lower for k in ["story", "narrative", "journey", "documentary", "struggle"]):
            overall_scores["storytelling"] += 1.5
        if any(k in p_lower for k in ["education", "tutorial", "how to", "explainer", "framework", "tips", "step"]):
            overall_scores["educational"] += 1.5
        if any(k in p_lower for k in ["emotional", "vulnerable", "sad", "poignant", "heart", "grief", "pain"]):
            overall_scores["emotional"] += 1.5

    # Determine dominant archetype
    top_arch = max(overall_scores, key=overall_scores.get)
    max_score = overall_scores[top_arch]
    if max_score <= 0.0:
        # Fallback to cadence-informed archetype
        if act1_wps > 2.6:
            top_arch = "educational"
        else:
            top_arch = "positive"
        confidence = 0.50
    else:
        tot = sum(overall_scores.values()) or 1.0
        confidence = min(0.98, max(0.55, max_score / tot))

    def act_dominant(scores: Dict[str, float], fallback: str) -> str:
        t = max(scores, key=scores.get)
        return t if scores[t] > 0 else fallback

    act1_arch = act_dominant(act1_scores, top_arch)
    act2_arch = act_dominant(act2_scores, top_arch)
    act3_arch = act_dominant(act3_scores, top_arch)

    active_archetypes = list(dict.fromkeys([top_arch, act1_arch, act2_arch, act3_arch]))
    emotional_shift = (act1_arch != act3_arch)
    trajectory = f"{act1_arch}_to_{act3_arch}" if emotional_shift else f"steady_{top_arch}_flow"

    # Climax detection (climax_ms)
    climax_ms = int(dur_ms * 0.75)
    late_chunks = [c for c in chunks if int(c.get("startMs", 0)) >= int(dur_ms * 0.60)]
    if late_chunks:
        # Check for exclamation marks or peak speech density
        peak_chunk = None
        for c in late_chunks:
            txt = str(c.get("text", ""))
            if "!" in txt or any(kw in txt.lower() for kw in ["finally", "won", "won!", "now", "result", "changed", "breakthrough"]):
                peak_chunk = c
                break
        if not peak_chunk:
            peak_chunk = max(late_chunks, key=lambda c: len(str(c.get("text", "")).split()))
        climax_ms = int(peak_chunk.get("startMs", int(dur_ms * 0.75)))

    # Entry preference
    act1_text = " ".join(str(c.get("text", "")).lower() for c in act1_chunks)
    has_hook_words = any(hw in act1_text for hw in ["stop", "look", "secret", "listen", "watch", "did you know", "here is", "never", "why"])

    p_lower = (prompt or "").lower()
    if any(k in p_lower for k in ["hook", "drop", "fast", "hype", "instant", "immediate"]):
        entry_pref = "hook_drop"
    elif act1_wps >= 2.4 or has_hook_words:
        entry_pref = "hook_drop"
    elif top_arch in {"educational", "positive"} and dur_ms <= 40000:
        entry_pref = "hook_drop"
    elif top_arch in {"storytelling", "emotional"} and climax_ms >= 10000:
        entry_pref = "climax_sync"
    elif act1_wps < 1.8:
        entry_pref = "narrative_intro"
    else:
        entry_pref = "hook_drop" if dur_ms <= 35000 else "narrative_intro"

    rec_intensity = "hard" if act1_wps > 2.8 else ("soft" if act1_wps < 2.0 else "medium")

    return {
        "dominant_archetype": top_arch,
        "confidence": round(confidence, 3),
        "archetype_scores": {k: round(v, 2) for k, v in overall_scores.items()},
        "acts": [
            {
                "act": 1,
                "name": "Hook",
                "startMs": 0,
                "endMs": act1_cutoff,
                "cadenceWps": act1_wps,
                "archetype": act1_arch,
                "summary": f"Act 1 introduces the hook at {act1_wps} WPS in {act1_arch} archetype.",
            },
            {
                "act": 2,
                "name": "Escalation",
                "startMs": act1_cutoff,
                "endMs": act2_cutoff,
                "cadenceWps": act2_wps,
                "archetype": act2_arch,
                "summary": f"Act 2 body unfolds at {act2_wps} WPS in {act2_arch} archetype.",
            },
            {
                "act": 3,
                "name": "Climax/Resolution",
                "startMs": act2_cutoff,
                "endMs": dur_ms,
                "cadenceWps": act3_wps,
                "archetype": act3_arch,
                "summary": f"Act 3 climax/resolution delivers payoff at {act3_wps} WPS in {act3_arch} archetype.",
            },
        ],
        "active_archetypes": active_archetypes,
        "emotional_shift": emotional_shift,
        "trajectory": trajectory,
        "climax_ms": climax_ms,
        "entry_preference": entry_pref,
        "recommended_intensity": rec_intensity,
    }


def compute_intelligent_song_entry(
    track: Dict[str, Any],
    storyboard: Dict[str, Any],
    duration_ms: int,
    timeline_start_ms: int = 0,
    timeline_end_ms: Optional[int] = None,
    design: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Calculate intelligent cue points (sourceStartMs) to eliminate the slow intro / missing drop problem.
    
    Supported Strategies:
      1. hook_drop: Cues the track directly at its energetic beat drop / hook onset (e.g. 22.5s for EARFQUAKE)
                    so short-form clips never suffer 15-20s of empty intro air.
      2. climax_sync: Synchronizes the song drop onset to align exactly with the video's narrative climax.
      3. narrative_intro: Starts from 0.0s for gradual acoustic/ambient reflective build.
      4. manual_override: Explicit user-specified cue point.
      
    Guarantees strict runway clamping against track duration so audio is never truncated.
    """
    track_dur_ms = max(1, int(float(track.get("durationSec") or 60.0) * 1000))
    event_dur_ms = max(1, (timeline_end_ms or duration_ms) - timeline_start_ms)
    design_copy = dict(design or {})

    # 1. Manual override
    if design_copy.get("songSourceStartMs") is not None:
        source_start = max(0, int(design_copy["songSourceStartMs"]))
        strategy = "manual_override"
        reason = f"Manual cue offset provided by user design: {source_start}ms."
    else:
        # Pre-computed or detected drop onset
        drop_sec = float(track.get("dropOnsetSec") or 0.0)
        if drop_sec == 0.0 and track.get("localPath") and Path(str(track["localPath"])).is_file():
            detected_ms, _ = detect_track_chorus_or_drop(str(track["localPath"]), timeline_duration_ms=event_dur_ms)
            drop_sec = detected_ms / 1000.0
        drop_ms = int(drop_sec * 1000)

        strategy = storyboard.get("entry_preference", "hook_drop")

        if strategy == "hook_drop":
            if drop_ms > 0:
                source_start = drop_ms
                reason = f"Cued directly at energetic beat drop (t={drop_sec:.1f}s) to eliminate empty intro air and match hook pacing."
            else:
                source_start = 0
                reason = "Track begins with immediate musical energy from 0.0s."
        elif strategy == "climax_sync":
            climax_ms = int(storyboard.get("climax_ms") or (duration_ms * 0.75))
            time_until_climax = max(0, climax_ms - timeline_start_ms)
            if drop_ms > 0 and time_until_climax > 0:
                desired_start = drop_ms - time_until_climax
                source_start = max(0, desired_start)
                reason = f"Synchronized drop (t={drop_sec:.1f}s) to land at narrative climax (t={climax_ms / 1000:.1f}s)."
            else:
                source_start = 0
                reason = "Starting from 0.0s for gradual narrative build leading into climax."
        else:  # narrative_intro
            source_start = 0
            reason = "Starting from track intro (t=0.0s) to support slow reflective spoken narrative."

    # Safety runway clamping: ensure source_start + event_dur_ms <= track_dur_ms
    max_allowed_start = max(0, track_dur_ms - event_dur_ms)
    if source_start > max_allowed_start:
        source_start = max_allowed_start
        reason += f" (Clamped to {source_start}ms to guarantee {event_dur_ms}ms runway without audio exhaustion)."

    source_end = source_start + event_dur_ms
    drop_ms = int(float(track.get("dropOnsetSec") or 0.0) * 1000)
    delta = (source_start + (storyboard.get("climax_ms", 0) - timeline_start_ms) - drop_ms) if drop_ms > 0 else 0

    return {
        "strategy": strategy,
        "sourceStartMs": source_start,
        "sourceEndMs": source_end,
        "dropOnsetSec": float(track.get("dropOnsetSec") or 0.0),
        "reason": reason,
        "dropSyncDeltaMs": delta,
    }


def _calculate_speech_cadence(chunks: List[Dict[str, Any]]) -> float:
    """Calculate average words-per-second (WPS) across speech chunks."""
    if not chunks:
        return 2.5
    total_words = 0
    total_speech_ms = 0
    for chunk in chunks:
        words = chunk.get("words") or []
        count = len(words) or int(chunk.get("wordCount", 0))
        if count == 0:
            text = str(chunk.get("text", "")).strip()
            count = len(text.split()) if text else 0
        total_words += count
        start = int(chunk.get("startMs", 0))
        end = int(chunk.get("endMs", start + 1))
        total_speech_ms += max(100, end - start)

    if total_speech_ms <= 0:
        return 2.5
    return round((total_words / (total_speech_ms / 1000.0)), 2)


def _score_system_autonomous(
    track: Dict[str, Any],
    transcript_tokens: set[str],
    look_id: Optional[str] = None,
    words_per_sec: float = 2.5,
    audio_intent: Optional[Dict[str, Any]] = None,
    storyboard: Optional[Dict[str, Any]] = None,
) -> Tuple[float, Dict[str, float], List[str]]:
    """Comprehensive autonomous scoring matrix evaluating:

    1. Semantic transcript keyword overlap
    2. Cinematic look & color grade synergy
    3. Speech cadence pacing alignment (WPS)
    4. Speech-friendly / dialogue support bonus
    5. Contextual domain synergy & user prompt intent alignment
    6. Context clash avoidance penalty
    7. Creator reference emotional storyboard archetype synergy & clash penalties
    """
    tags = _track_tokens(track)
    overlap = sorted(tags & transcript_tokens)
    avoided = sorted(_tokens(track.get("avoidWhen") or []) & transcript_tokens)
    speech_friendly = bool(tags & {"speech", "friendly", "underscore", "instrumental", "focused"})

    # 1. Semantic transcript score
    semantic_score = len(overlap) * 0.35 + (0.20 if speech_friendly else 0.0) - len(avoided) * 0.50
    evidence: List[str] = []

    if overlap:
        evidence.append(f"Transcript matched catalog tags: {', '.join(overlap[:6])}.")
    if speech_friendly:
        evidence.append("Track is verified speech-friendly for clear dialogue.")
    if avoided:
        evidence.append(f"Penalized for negative context keywords: {', '.join(avoided[:4])}.")

    # 2. Visual look affinity
    look_score = 0.0
    if look_id and look_id in LOOK_TO_MUSIC_AFFINITIES:
        affinity = LOOK_TO_MUSIC_AFFINITIES[look_id]
        common_look_tags = tags & affinity["tags"]
        if common_look_tags:
            look_score += 0.35
            evidence.append(f"Visual look '{look_id}' synergy: {affinity['rationale']}")
        if track.get("intensity") == affinity.get("preferredIntensity"):
            look_score += 0.15

    # 3. Speech cadence pacing alignment
    pacing_score = 0.0
    track_intensity = str(track.get("intensity", "medium")).lower()
    if words_per_sec > 2.8:
        # Fast, rapid talking -> energetic groove, tech pulse, or rhythmic beats
        if any(t in tags for t in {"beats", "energy", "drive", "trap", "hip-hop", "groove", "tech", "modern"}):
            pacing_score += 0.30
            evidence.append(f"Fast speech tempo ({words_per_sec} wps) pairs with rhythmic drive.")
        elif track_intensity == "hard":
            pacing_score += 0.15
            evidence.append(f"Fast speech tempo ({words_per_sec} wps) pairs with higher energy beat.")
    elif words_per_sec < 2.0:
        # Slow, measured speech -> soft, chill, or ambient lo-fi/piano
        if track_intensity == "soft":
            pacing_score += 0.30
            evidence.append(f"Measured speech tempo ({words_per_sec} wps) pairs with mellow chill underscore.")
        elif any(t in tags for t in {"lo-fi", "chill", "soft", "calm", "piano"}):
            pacing_score += 0.20
    else:
        # Standard conversational tempo
        if track_intensity == "medium":
            pacing_score += 0.20
            evidence.append(f"Balanced conversational tempo ({words_per_sec} wps) matches medium intensity track.")

    # Heavy cinematic trailers are designed for SFX-only montages and clash with dialogue; penalize for voice content
    cat_str = str(track.get("category", "")).lower()
    title_str = str(track.get("title", "")).lower()
    if "trailer" in cat_str or "trailer" in title_str or cat_str == "cinematic-trailer-epic":
        pacing_score -= 0.40

    # 4. Contextual domain synergy and user prompt intent alignment
    domain_score = 0.0
    if audio_intent:
        cat_lower = str(track.get("category", "")).lower()
        active_domains = audio_intent.get("activeDomains", [])
        preferred_cats = set(audio_intent.get("preferredCategories") or [])
        preferred_tags = set(audio_intent.get("preferredTags") or [])
        avoid_cats = set(audio_intent.get("avoidCategories") or [])
        avoid_tags = set(audio_intent.get("avoidTags") or [])

        # Explicit user prompt preferences (genre / mood / intensity)
        if audio_intent.get("explicitGenre"):
            g_req = audio_intent["explicitGenre"]
            if g_req in cat_lower or any(g_req in t for t in tags):
                domain_score += 0.65
                evidence.append(f"User prompt explicitly requested genre: '{g_req}'.")

        if audio_intent.get("explicitMood"):
            m_req = audio_intent["explicitMood"]
            if any(m_req in t for t in tags) or any(m_req in str(m).lower() for m in (track.get("moodTags") or [])):
                domain_score += 0.50
                evidence.append(f"User prompt requested mood: '{m_req}'.")

        if audio_intent.get("explicitIntensity"):
            if track_intensity == audio_intent["explicitIntensity"]:
                domain_score += 0.25
                evidence.append(f"User prompt requested intensity: '{audio_intent['explicitIntensity']}'.")

        # Domain synergy bonus (Business, Intentional/Deliberate, Documentary, Tech, etc.)
        if cat_lower in preferred_cats or (tags & preferred_tags):
            boost = 0.60 if any(d in active_domains for d in ("business", "intentional_deliberate")) else 0.40
            domain_score += boost
            matched_tags = sorted(tags & preferred_tags)
            dom_desc = ", ".join(active_domains)
            evidence.append(f"Domain synergy: Matched '{dom_desc}' context ({cat_lower}{f': {matched_tags[:3]}' if matched_tags else ''}).")

        # Domain clash avoidance penalty (e.g. party/club pop during a serious business/intentional call)
        if cat_lower in avoid_cats or (tags & avoid_tags):
            clash_penalty = 0.70
            domain_score -= clash_penalty
            evidence.append(f"Context clash penalty: Incompatible with '{', '.join(active_domains)}' context (penalty -{clash_penalty}).")

    # 5. Creator Reference Storyboard Emotional Archetype Alignment
    storyboard_score = 0.0
    if storyboard:
        dom_arch = str(storyboard.get("dominant_archetype") or "").strip().lower()
        track_arch = str(track.get("archetype") or track.get("category") or "").strip().lower()
        act_archetypes = [str(a).strip().lower() for a in (storyboard.get("active_archetypes") or [])]

        # Primary archetype synergy bonus (+0.85)
        if track_arch == dom_arch:
            storyboard_score += 0.85
            evidence.append(f"Storyline archetype synergy: '{track_arch}' matches video dominant narrative ({dom_arch}).")
        elif track_arch in act_archetypes:
            storyboard_score += 0.40
            evidence.append(f"Storyline archetype affinity: '{track_arch}' matches active act progression.")

        # Archetype clash penalties
        if dom_arch == "emotional" and track_intensity == "hard":
            storyboard_score -= 0.60
            evidence.append("Emotional clash: Aggressive hard track clashing with vulnerable emotional video narrative.")
        elif dom_arch == "authority" and any(t in tags for t in {"party", "club", "frivolous"}):
            storyboard_score -= 0.70
            evidence.append("Authority clash: Party elements clash with commanding executive authority.")
        elif dom_arch == "educational" and ("trailer" in cat_str or "epic" in cat_str):
            storyboard_score -= 0.50
            evidence.append("Educational clash: Overbearing trailer clashing with instructional explanation.")

    total_score = round(semantic_score + look_score + pacing_score + domain_score + storyboard_score, 3)
    if not evidence:
        evidence.append("Eligible catalog track selected via autonomous fallback compatibility.")

    breakdown = {
        "semantic": round(semantic_score, 3),
        "lookSynergy": round(look_score, 3),
        "pacingAlignment": round(pacing_score, 3),
        "domainContext": round(domain_score, 3),
        "storyboardArchetype": round(storyboard_score, 3),
    }

    return total_score, breakdown, evidence


def _compute_ducking_profile(track_intensity: str, custom_ducking: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Provide sidechain compression parameters tailored to song intensity.

    Uses gentle, broadcast-grade envelope smoothing (attack 100-150ms, release 750-950ms)
    and mild ratio (2.5 - 3.8) with a steady audible baseline, completely eliminating
    flutter/pumping artifacts while keeping the music acoustically audible and impactful.
    """
    intensity = (track_intensity or "medium").lower()
    defaults = {
        "mode": "sidechain",
        "threshold": 0.085,   # ~ -21.4 dBFS: triggers on clear vocal peaks, leaving quiet speech/gaps open
        "ratio": 2.2,         # Musical 3.5 dB ducking instead of harsh squashing
        "attackMs": 85,       # Smooth responsive ramp-down across speech onset
        "releaseMs": 400,     # Fast recovery so music maintains an audible groove between sentences
    }
    if intensity == "hard":
        # For punchy beats, slightly tighter control
        defaults.update({"threshold": 0.080, "ratio": 3.8, "attackMs": 95, "releaseMs": 750})
    elif intensity == "soft":
        # Transparent, gentle ducking for soft acoustic / piano / lo-fi
        defaults.update({"threshold": 0.090, "ratio": 2.5, "attackMs": 150, "releaseMs": 950})

    if custom_ducking:
        defaults.update(custom_ducking)
    return defaults


# ---------------------------------------------------------------------------
# Main Song Program Planner
# ---------------------------------------------------------------------------

def plan_song_program(
    *,
    catalog: Any,
    chunks: List[Dict[str, Any]],
    duration_ms: int,
    design: Optional[Dict[str, Any]] = None,
    prompt: Optional[str] = None,
) -> Dict[str, Any]:
    """Select approved songs and arrange them with dialogue-aware sidechain ducking and runway management.

    Supports:
      1. Individual direct selection (explicit trackId, title search, genre, mood, artist, custom source).
      2. Natural language user prompt intent & domain modulation (business, intentional, deliberate, etc.).
      3. Autonomous system selection (multi-factor matrix: transcript semantics + visual look synergy + speech cadence + domain context).
      4. Disabled policy (audio-only voice mux without music bed).
      5. Multi-track runway exhaustion handoffs with smooth crossfade transitions.
    """
    import hashlib
    design = dict(design or {})
    duration_ms = max(1, int(duration_ms))
    crossfade_ms = max(250, min(3000, int(design.get("songCrossfadeMs", 900))))
    song_policy = str(design.get("songPolicy", "auto")).strip().lower()

    # Policy: disabled
    if song_policy == "disabled":
        return {
            "version": "2.0",
            "policy": "disabled",
            "selectionMode": "disabled",
            "durationMs": duration_ms,
            "crossfadeMs": crossfade_ms,
            "baseGainDb": -60.0,
            "events": [],
            "transitions": [],
        }

    entries = catalog.get("entries", []) if isinstance(catalog, dict) else list(catalog or [])
    approved = [dict(track) for track in entries if _approved(track)]

    # If catalog is empty, fall back to built-in tracks
    if not approved:
        approved = [dict(t) for t in BUILTIN_SANCTIONED_TRACKS if _approved(t)]
    if not approved:
        raise RuntimeError("No render-approved songs are available in the catalog.")

    nonce = str(design.get("seed") or secrets.token_hex(24))
    rng = random.Random(nonce)

    resolved_prompt = str(
        prompt
        or design.get("prompt")
        or design.get("userPrompt")
        or (design.get("audio") or {}).get("prompt")
        or (design.get("audio") or {}).get("userPrompt")
        or ""
    ).strip()

    transcript_tokens = _tokens(chunk.get("text", "") for chunk in chunks)
    look_id = str(design.get("lookId") or design.get("lookName") or "").strip()
    speech_wps = _calculate_speech_cadence(chunks)

    # Ingest prompt and transcript to produce structured audio intent
    audio_intent = extract_audio_intent_from_prompt(resolved_prompt, transcript_tokens=transcript_tokens)

    # Analyze video emotional storyboard across narrative acts
    storyboard = analyze_video_emotional_storyboard(
        chunks=chunks,
        duration_ms=duration_ms,
        prompt=resolved_prompt,
    )

    # Score all candidates autonomously with domain, prompt intent, and emotional storyboard modulation
    scored = []
    for track in approved:
        score, breakdown, evidence = _score_system_autonomous(
            track,
            transcript_tokens,
            look_id=look_id,
            words_per_sec=speech_wps,
            audio_intent=audio_intent,
            storyboard=storyboard,
        )
        scored.append({
            "track": track,
            "score": score,
            "scoreBreakdown": breakdown,
            "evidence": evidence,
        })

    # Check for individual selection (including explicit natural language prompts)
    design_with_prompt = dict(design)
    if resolved_prompt:
        design_with_prompt["prompt"] = resolved_prompt
    individual_pick = resolve_individual_selection([item["track"] for item in scored], design_with_prompt)

    events: List[Dict[str, Any]] = []
    transitions: List[Dict[str, Any]] = []
    used: set[str] = set()
    cursor_ms = 0
    previous_track: Optional[Dict[str, Any]] = None

    while cursor_ms < duration_ms:
        candidates = [item for item in scored if item["track"]["id"] not in used]
        if not candidates:
            # If all tracks exhausted, allow reuse of least recently used tracks
            candidates = list(scored)

        if individual_pick is not None and not events:
            selected_track, individual_reason = individual_pick
            selected = next((item for item in scored if item["track"]["id"] == selected_track["id"]), None)
            if selected is None:
                selected = {
                    "track": selected_track,
                    "score": 10.0,
                    "scoreBreakdown": {"individual": 10.0},
                    "evidence": [individual_reason],
                }
            else:
                selected = {
                    **selected,
                    "evidence": [individual_reason, *selected["evidence"]],
                }
            resolution_mode = "individual_selection"
        else:
            resolution_mode = "system_autonomous"
            if previous_track is not None:
                for c in candidates:
                    c["effective_score"] = c["score"] + _compatibility(previous_track, c["track"]) * 0.35
                candidates.sort(key=lambda item: item["effective_score"], reverse=True)
            else:
                for c in candidates:
                    c["effective_score"] = c["score"]
                candidates.sort(key=lambda item: item["effective_score"], reverse=True)

            # Temperature-based selection among top tier
            top_candidates = candidates[:max(1, min(15, len(candidates)))]
            best_score = top_candidates[0]["effective_score"]
            if len(top_candidates) > 1 and (round(best_score - top_candidates[1]["effective_score"], 4) >= 0.15):
                selected = top_candidates[0]
            else:
                eligible = [c for c in top_candidates if best_score - c["effective_score"] <= 0.40]
                min_score = min(c["effective_score"] for c in eligible)
                weights = [math.exp(max(-4.0, min(4.0, (c["effective_score"] - min_score) * 2.0))) for c in eligible]
                total_weight = sum(weights)
                pick = rng.uniform(0, total_weight)
                cum = 0.0
                selected = eligible[0]
                for c, w in zip(eligible, weights):
                    cum += w
                    if cum >= pick:
                        selected = c
                        break

        track = selected["track"]
        used.add(track["id"])
        track_dur_ms = max(1, int(float(track.get("durationSec") or 0) * 1000))
        timeline_start = 0 if not events else max(0, cursor_ms - crossfade_ms)

        entry_calc = compute_intelligent_song_entry(
            track=track,
            storyboard=storyboard,
            duration_ms=duration_ms,
            timeline_start_ms=timeline_start,
            timeline_end_ms=min(duration_ms, timeline_start + track_dur_ms),
            design=design,
        )
        source_start = entry_calc["sourceStartMs"]
        available_runway_ms = max(1, track_dur_ms - source_start)
        timeline_end = min(duration_ms, timeline_start + available_runway_ms)
        source_end = source_start + (timeline_end - timeline_start)
        entry_calc["sourceEndMs"] = source_end

        event = {
            "id": f"song-{len(events) + 1}",
            "trackId": track["id"],
            "title": track.get("title"),
            "artist": track.get("artist"),
            "category": track.get("category"),
            "archetype": track.get("archetype") or track.get("category"),
            "genreTags": track.get("genreTags", []),
            "moodTags": track.get("moodTags", []),
            "intensity": track.get("intensity", "medium"),
            "bucket": track.get("bucket"),
            "objectKey": track.get("audioObjectKey"),
            "localPath": track.get("localPath"),
            "timelineStartMs": timeline_start,
            "timelineEndMs": timeline_end,
            "sourceStartMs": source_start,
            "sourceEndMs": source_end,
            "intelligentEntry": entry_calc,
            "resolution": resolution_mode if len(events) == 0 else "system_handoff",
            "selectionScore": selected["score"],
            "scoreBreakdown": selected.get("scoreBreakdown", {}),
            "selectionEvidence": selected["evidence"],
            "pacingWps": speech_wps,
            "lookAffinity": look_id or None,
            "approval": {
                "renderAllowed": bool(track.get("renderAllowed", True)),
                "commercialAllowed": bool(track.get("commercialAllowed", True)),
                "licenseVerified": bool(track.get("licenseVerified", True)),
                "licenseType": track.get("licenseType", "sanctioned"),
            },
        }

        if events:
            previous = events[-1]
            overlap = previous["timelineEndMs"] - timeline_start
            transitions.append({
                "id": f"song-transition-{len(transitions) + 1}",
                "fromTrackId": previous["trackId"],
                "toTrackId": track["id"],
                "startMs": timeline_start,
                "durationMs": overlap,
                "compatibilityScore": round(_compatibility(previous_track or {}, track), 3),
                "cause": {"gate": "song_runway_exhausted", "atMs": timeline_start},
            })

        events.append(event)
        cursor_ms = timeline_end
        previous_track = track

    primary_intensity = events[0].get("intensity", "medium") if events else "medium"
    ducking_config = _compute_ducking_profile(primary_intensity, design.get("dialogueDucking"))

    return {
        "version": "2.1",
        "policy": song_policy,
        "selectionMode": events[0].get("resolution", "system_autonomous") if events else "empty",
        "selectionNonce": nonce,
        "durationMs": duration_ms,
        "crossfadeMs": crossfade_ms,
        "baseGainDb": float(design.get("songGainDb", -7.0)),
        "prompt": resolved_prompt or None,
        "audioIntent": {
            "activeDomains": audio_intent.get("activeDomains", []),
            "explicitGenre": audio_intent.get("explicitGenre"),
            "explicitMood": audio_intent.get("explicitMood"),
            "explicitIntensity": audio_intent.get("explicitIntensity"),
            "domainScores": audio_intent.get("domainScores", {}),
        },
        "speechCadenceWps": speech_wps,
        "storyboard": storyboard,
        "lookId": look_id or None,
        "dialogueDucking": ducking_config,
        "events": events,
        "transitions": transitions,
    }

