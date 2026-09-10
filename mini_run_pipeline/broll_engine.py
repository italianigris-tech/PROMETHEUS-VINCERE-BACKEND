"""Authoritative B-Roll Intelligence & Cinematic Treatment Engine for Mini-Runs.

Part of the 9:16 Mini-Run Pipeline (mini_run_pipeline/).

This engine implements the complete B-roll lifecycle for short-form video:
1. Mathematical Scoring Formula (Multifaceted Decision Engine):
   Evaluates transcript chunks to determine whether B-roll, motion graphics,
   or kinetic typography is optimal. Resolves:
   - Sufficiency of time (duration window: 2.0s - 5.0s optimal)
   - Concreteness vs. Abstraction (physical nouns/environments vs. abstract concepts)
   - Visual fatigue (talking-head monotony breaker)
   - Cooldown gating (preventing rapid-fire cutaway spam)
   - Rhetorical beat weight (hook, crisis, revelation, proof)
2. Semantic Search Query Extraction:
   Extracts high-signal, visual search queries from transcript context.
3. Pexels Video Client:
   Integrates directly with the Pexels Videos API to search, select, and
   download 9:16 vertical/portrait video assets with local caching.
4. After Effects-Grade B-Roll Treatments (The 7 Broadcast Styles):
   - cinematic_fullbleed: Ken Burns drift + film halation + 35mm grain.
   - evidentiary_dossier_card: 2.5D floating card with slap-drop bounce & double-state shadow.
   - track_matte_unfurl: Asymmetric geometric box wipe with razor stroke.
   - rack_focus_spotlight: Background defocus dive + center snap-to-focus.
   - hinged_3d_swing: 75° -> 0° Y-axis perspective swing with outer-edge pivot.
   - retinal_flash_cut: 2-frame micro-flash / color inversion transient.
   - behind_subject_depth: Matted speaker layering (B-roll behind cutout).
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple

# ---------------------------------------------------------------------------
# API Key Resolution
# ---------------------------------------------------------------------------


def resolve_pexels_api_key() -> str:
    """Retrieve Pexels API key from environment or .env file (never hardcoded)."""
    key = os.getenv("PEXELS_API_KEY")
    if key and key.strip():
        return key.strip()

    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        try:
            for line in env_path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip('"').strip("'")
                    if k == "PEXELS_API_KEY" and v:
                        return v
        except Exception:
            pass

    return ""


# ---------------------------------------------------------------------------
# Lexical & Semantic Categories for Concreteness Scoring
# ---------------------------------------------------------------------------

# Words indicating concrete, physical, tangible, worldly entities and actions (High B-roll affinity)
CONCRETE_PHYSICAL_TOKENS: Set[str] = {
    # Environments & Locations
    "city", "street", "subway", "train", "office", "desk", "room", "building", "skyline",
    "skyscraper", "warehouse", "factory", "lab", "laboratory", "airport", "airplane", "road",
    "highway", "bridge", "ocean", "sea", "mountain", "forest", "desert", "store", "shop",
    "restaurant", "boardroom", "studio", "hallway", "door", "window", "hospital", "clinic",
    # Objects & Tools
    "computer", "laptop", "keyboard", "screen", "monitor", "phone", "iphone", "watch",
    "rolex", "car", "supercar", "vehicle", "engine", "gear", "machine", "robot", "money",
    "cash", "dollar", "bill", "gold", "coin", "card", "paper", "pen", "notebook", "book",
    "coffee", "cup", "glass", "bottle", "camera", "lens", "key", "box", "package", "hardware",
    # Tangible Actions & Sensory Verbs
    "walk", "walking", "run", "running", "drive", "driving", "type", "typing", "build",
    "building", "cut", "cutting", "look", "looking", "stare", "staring", "fly", "flying",
    "stand", "standing", "sit", "sitting", "write", "writing", "read", "reading", "drink",
    "drinking", "pour", "pouring", "shake", "shaking", "open", "opening", "close", "closing",
    "work", "working", "press", "pressing", "click", "clicking", "turn", "turning",
    # World Context & Society
    "crowd", "people", "worker", "team", "crowded", "traffic", "night", "sunrise", "sunset",
    "rain", "smoke", "fire", "light", "lights", "shadow", "dark", "urban", "industrial",
}

# Words indicating abstract logic, metrics, or numbered steps (Motion Graphics / Typography affinity)
ABSTRACT_LOGICAL_TOKENS: Set[str] = {
    # Metrics & Numbers
    "percent", "percentage", "%", "stat", "stats", "metric", "metrics", "number", "numbers",
    "revenue", "profit", "margin", "growth", "multiple", "10x", "2x", "ratio", "double", "triple",
    # Systems & Frameworks
    "system", "framework", "mindset", "principle", "rule", "rules", "pillar", "pillars",
    "step", "steps", "formula", "concept", "theory", "strategy", "funnel", "pipeline",
    "paradigm", "structure", "algorithm", "process", "workflow", "matrix", "diagram",
    # Listicle Enumeration
    "first", "second", "third", "fourth", "fifth", "1.", "2.", "3.", "one", "two", "three",
    # Cognitive / Meta Verbs
    "think", "believe", "understand", "realize", "imagine", "suppose", "remember", "forget",
    "mean", "know", "wonder", "decide", "conclude", "analyze", "evaluate",
}


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------

@dataclass
class BrollSuitabilityEvaluation:
    """Detailed score card explaining why a chunk is or is not ideal for B-roll."""
    chunk_index: int
    text: str
    duration_sec: float
    is_eligible: bool
    recommended_treatment_category: str  # "broll_cutaway" | "motion_graphic" | "kinetic_typography" | "talking_head"
    composite_score: float
    duration_score: float
    concreteness_score: float
    fatigue_score: float
    rhetorical_score: float
    cooldown_penalty: float
    abstract_penalty: float
    matched_concrete_terms: List[str]
    matched_abstract_terms: List[str]
    rationale: str


@dataclass
class BrollAssetMetadata:
    """Metadata for a resolved Pexels B-roll video asset."""
    asset_id: str
    source: str  # "pexels" | "local_cache" | "mock"
    query: str
    video_url: str
    local_file: str
    duration_sec: float
    width: int
    height: int
    orientation: str  # "portrait" | "landscape"
    aspect_ratio: str  # "9:16" | "16:9"
    photographer: str
    photographer_url: str


@dataclass
class AfterEffectsTreatmentConfig:
    """Adobe After Effects broadcast treatment parameters for B-roll rendering."""
    treatment_name: str  # e.g. "cinematic_fullbleed", "evidentiary_dossier_card"
    ken_burns: Dict[str, Any] = field(default_factory=lambda: {
        "enabled": True,
        "scale_start": 1.00,
        "scale_end": 1.06,
        "pan_direction": "slow_drift_down",
    })
    framing: Dict[str, Any] = field(default_factory=lambda: {
        "style": "full_bleed",  # "full_bleed" | "polaroid_card" | "unfurl_crop" | "letterbox_2_39"
        "border_radius_px": 0,
        "border_width_px": 0,
        "border_color": "rgba(255, 255, 255, 0.2)",
    })
    optical: Dict[str, Any] = field(default_factory=lambda: {
        "defocus_dive": False,
        "blur_start_px": 0,
        "blur_end_px": 0,
        "film_grain_opacity": 0.04,
        "film_halation_intensity": 0.25,
        "vignette_intensity": 0.35,
    })
    shadow: Dict[str, Any] = field(default_factory=lambda: {
        "double_state": False,
        "contact_shadow": "0 2px 6px rgba(0, 0, 0, 0.85)",
        "directional_shadow": "0 24px 48px rgba(0, 0, 0, 0.65)",
    })
    motion_physics: Dict[str, Any] = field(default_factory=lambda: {
        "entrance_physics": "none",  # "none" | "slap_drop_bounce" | "hinged_3d_swing" | "track_matte_wipe"
        "settle_frames": 14,
        "reaction_jolt_px": 0,
    })
    transient: Dict[str, Any] = field(default_factory=lambda: {
        "retinal_flash": False,
        "flash_frames": 2,
        "color_inversion": False,
    })


@dataclass
class BrollPlacementDirective:
    """Full production manifest record for an authoritative B-roll placement."""
    placement_id: str
    chunk_index: int
    scene_id: str
    start_ms: int
    end_ms: int
    duration_ms: int
    evaluation: BrollSuitabilityEvaluation
    asset: BrollAssetMetadata
    treatment: AfterEffectsTreatmentConfig
    sfx_cue: Optional[str] = None


# ---------------------------------------------------------------------------
# Mathematical Scoring Formula (BrollSuitabilityEngine)
# ---------------------------------------------------------------------------

class BrollSuitabilityEngine:
    """Multifaceted mathematical scoring formula determining B-roll eligibility.

    Formula:
      Score = (w_d * DurationScore + w_c * ConcretenessScore + w_f * FatigueScore + w_r * RhetoricalScore)
              * (1.0 - CooldownPenalty) * (1.0 - AbstractPenalty)

    Decision Criteria:
    1. Duration < 1.4s: Score clamped to 0.0. Short phrases lack sufficiency of time
       for the human eye to parse scene semantics. Kinetic typography or micro-motion graphic is used.
    2. Concrete vs. Abstract: Physical environments/objects/actions yield high ConcretenessScore.
       Abstract concepts, percentages, and lists yield high AbstractPenalty, routing to Motion Graphics.
    3. Fatigue Accumulation: Monotony metric tracking seconds elapsed without a visual break.
    4. Cooldown Gating: Strong penalty applied if another B-roll ended recently (< 4.5s).
    """

    # Model Weights
    WEIGHT_DURATION = 0.30
    WEIGHT_CONCRETENESS = 0.35
    WEIGHT_FATIGUE = 0.20
    WEIGHT_RHETORICAL = 0.15

    # Threshold for B-roll selection
    SELECTION_THRESHOLD = 0.62

    # Minimum and optimal durations (seconds)
    MIN_DURATION_SEC = 1.6
    OPTIMAL_DURATION_LOW_SEC = 2.2
    OPTIMAL_DURATION_HIGH_SEC = 4.8
    MAX_DURATION_SEC = 7.0

    # Minimum quiet gap between B-rolls (seconds)
    COOLDOWN_GAP_SEC = 4.5

    @classmethod
    def calculate_duration_score(cls, duration_sec: float) -> float:
        """Piecewise sigmoid-bell curve measuring sufficiency of time."""
        if duration_sec < cls.MIN_DURATION_SEC:
            # Below minimum duration, score drops precipitously
            if duration_sec <= 1.0:
                return 0.0
            return max(0.0, (duration_sec - 1.0) / (cls.MIN_DURATION_SEC - 1.0) * 0.4)

        if cls.OPTIMAL_DURATION_LOW_SEC <= duration_sec <= cls.OPTIMAL_DURATION_HIGH_SEC:
            return 1.0

        if duration_sec < cls.OPTIMAL_DURATION_LOW_SEC:
            # Linear rise into optimal window
            return 0.4 + 0.6 * ((duration_sec - cls.MIN_DURATION_SEC) / (cls.OPTIMAL_DURATION_LOW_SEC - cls.MIN_DURATION_SEC))

        # Gradual falloff for overly long shots (risk of viewer disengagement)
        excess = duration_sec - cls.OPTIMAL_DURATION_HIGH_SEC
        return max(0.5, 1.0 - 0.15 * (excess / (cls.MAX_DURATION_SEC - cls.OPTIMAL_DURATION_HIGH_SEC)))

    @classmethod
    def calculate_concreteness(cls, text: str) -> Tuple[float, List[str], List[str]]:
        """Linguistic extraction comparing physical sensory tokens against abstract metrics."""
        cleaned = text.lower().strip()
        tokens = [t.strip(".,!?:;\"'()[]{}") for t in cleaned.split()]

        concrete_matches: List[str] = []
        abstract_matches: List[str] = []

        for t in tokens:
            if not t:
                continue
            if t in CONCRETE_PHYSICAL_TOKENS or any(t.startswith(cp) for cp in CONCRETE_PHYSICAL_TOKENS if len(cp) > 4):
                concrete_matches.append(t)
            if t in ABSTRACT_LOGICAL_TOKENS or any(t.startswith(ab) for ab in ABSTRACT_LOGICAL_TOKENS if len(ab) > 4):
                abstract_matches.append(t)
            # Regex check for digits, stats, percentages
            if re.match(r"^\d+%$", t) or re.match(r"^\d+(?:x|k|m|b)?$", t):
                abstract_matches.append(t)

        num_words = max(1, len(tokens))
        concrete_ratio = len(concrete_matches) / num_words
        abstract_ratio = len(abstract_matches) / num_words

        # Base concreteness score
        score = min(1.0, concrete_ratio * 2.5)

        # Dampen if heavily abstract
        if abstract_ratio > 0.25:
            score = max(0.0, score - abstract_ratio * 1.5)

        return round(score, 3), concrete_matches, abstract_matches

    @classmethod
    def calculate_fatigue_score(cls, time_since_last_visual_break_sec: float) -> float:
        """Visual fatigue metric. As speaker talking-head persists without a cutaway, score rises."""
        if time_since_last_visual_break_sec <= 2.0:
            return 0.1
        if time_since_last_visual_break_sec >= 7.0:
            return 1.0
        return round((time_since_last_visual_break_sec - 2.0) / 5.0, 3)

    @classmethod
    def calculate_rhetorical_weight(cls, text: str, beat_type: Optional[str] = None) -> float:
        """Score based on narrative inflection (e.g. proof, context, crisis)."""
        t_low = text.lower()
        base_score = 0.5

        if beat_type in ("proof", "evidence", "world_context", "crisis", "revelation"):
            base_score += 0.3
        elif beat_type in ("hook", "intro"):
            base_score += 0.2

        # Keywords of high dramatic payoff
        if any(w in t_low for w in ("look at", "imagine", "see", "world", "reality", "every day", "walked into", "secret")):
            base_score += 0.2

        return min(1.0, base_score)

    @classmethod
    def evaluate_chunk(
        cls,
        *,
        chunk_index: int,
        text: str,
        duration_sec: float,
        time_since_last_broll_sec: float,
        time_since_last_visual_break_sec: float,
        beat_type: Optional[str] = None,
        is_behind_subject_assigned: bool = False,
    ) -> BrollSuitabilityEvaluation:
        """Comprehensive evaluation of a chunk against the mathematical scoring formula."""
        # 1. Calculate component scores
        d_score = cls.calculate_duration_score(duration_sec)
        c_score, concrete_matches, abstract_matches = cls.calculate_concreteness(text)
        f_score = cls.calculate_fatigue_score(time_since_last_visual_break_sec)
        r_score = cls.calculate_rhetorical_weight(text, beat_type)

        # 2. Cooldown penalty
        cooldown_penalty = 0.0
        if time_since_last_broll_sec < cls.COOLDOWN_GAP_SEC:
            # Harsh penalty prevents back-to-back cutaways
            cooldown_penalty = 1.0 - (time_since_last_broll_sec / cls.COOLDOWN_GAP_SEC)

        # 3. Abstract / Motion-graphics penalty
        abstract_penalty = 0.0
        if len(abstract_matches) > 0 and len(concrete_matches) == 0:
            abstract_penalty = min(0.85, len(abstract_matches) * 0.4)

        # 4. Composite formula
        weighted_sum = (
            cls.WEIGHT_DURATION * d_score
            + cls.WEIGHT_CONCRETENESS * c_score
            + cls.WEIGHT_FATIGUE * f_score
            + cls.WEIGHT_RHETORICAL * r_score
        )

        composite = weighted_sum * max(0.0, 1.0 - cooldown_penalty) * max(0.0, 1.0 - abstract_penalty)
        composite = round(max(0.0, min(1.0, composite)), 3)

        # 5. Determine recommended treatment category
        if duration_sec < 1.4:
            rec = "kinetic_typography"
            rationale = "Duration insufficient for scene parsing (<1.4s); kinetic typography preserves reading cadence."
            is_eligible = False
        elif abstract_penalty > 0.4 or (len(abstract_matches) > 0 and c_score < 0.2):
            rec = "motion_graphic"
            rationale = (
                f"Abstract / logical / numerical concept ({', '.join(abstract_matches)}); "
                f"motion graphic or chart visualization is far superior to physical B-roll."
            )
            is_eligible = False
        elif cooldown_penalty > 0.5:
            rec = "talking_head"
            rationale = f"Cooldown in effect ({time_since_last_broll_sec:.1f}s since prior B-roll < {cls.COOLDOWN_GAP_SEC}s threshold)."
            is_eligible = False
        elif composite >= cls.SELECTION_THRESHOLD:
            rec = "broll_cutaway"
            rationale = (
                f"High physical concreteness ({', '.join(concrete_matches) or 'scene context'}), "
                f"sufficient duration ({duration_sec:.1f}s), and fatigue relief ({f_score:.2f})."
            )
            is_eligible = True
        else:
            rec = "talking_head"
            rationale = f"Composite suitability ({composite:.2f}) below threshold ({cls.SELECTION_THRESHOLD}). Preserving speaker anchor."
            is_eligible = False

        return BrollSuitabilityEvaluation(
            chunk_index=chunk_index,
            text=text,
            duration_sec=round(duration_sec, 2),
            is_eligible=is_eligible,
            recommended_treatment_category=rec,
            composite_score=composite,
            duration_score=round(d_score, 3),
            concreteness_score=c_score,
            fatigue_score=f_score,
            rhetorical_score=round(r_score, 3),
            cooldown_penalty=round(cooldown_penalty, 3),
            abstract_penalty=round(abstract_penalty, 3),
            matched_concrete_terms=concrete_matches,
            matched_abstract_terms=abstract_matches,
            rationale=rationale,
        )


# ---------------------------------------------------------------------------
# Semantic Search Query Generator
# ---------------------------------------------------------------------------

def extract_broll_search_queries(
    text: str,
    beat_name: Optional[str] = None,
    thematic_theme: Optional[str] = None,
) -> Tuple[str, str]:
    """Generate high-precision primary and fallback search queries for stock video APIs."""
    t_clean = text.lower()
    t_clean = re.sub(r"[^\w\s]", " ", t_clean)
    words = [w for w in t_clean.split() if len(w) > 2]

    # Filter out conversational filler
    STOP_FILTER = {
        "you", "your", "they", "them", "what", "which", "this", "that", "these", "those",
        "have", "has", "had", "with", "from", "into", "about", "against", "between", "through",
        "before", "after", "above", "below", "down", "once", "here", "there", "when", "where",
        "just", "should", "could", "would", "like", "also", "want", "need", "because", "know",
    }
    content_words = [w for w in words if w not in STOP_FILTER]

    # Prioritize physical concrete terms
    concrete_found = [w for w in content_words if w in CONCRETE_PHYSICAL_TOKENS]

    if concrete_found:
        primary_query = f"{' '.join(concrete_found[:3])} cinematic 4k"
    elif content_words:
        primary_query = f"{' '.join(content_words[:3])} cinematic"
    elif beat_name:
        primary_query = f"{beat_name} cinematic modern"
    else:
        primary_query = "cinematic business technology"

    # Fallback query
    fallback_query = "cinematic modern urban documentary"
    if thematic_theme:
        fallback_query = f"{thematic_theme} cinematic"

    return primary_query.strip(), fallback_query.strip()


# ---------------------------------------------------------------------------
# Pexels Videos API Client
# ---------------------------------------------------------------------------

class PexelsVideoClient:
    """Production-grade client for searching and materializing Pexels vertical video assets."""

    API_BASE = "https://api.pexels.com/videos/search"
    CACHE_DIR = Path(__file__).resolve().parent.parent / "remotion-app" / "public" / "broll"

    def __init__(self, api_key: Optional[str] = None, cache_dir: Optional[Path] = None):
        self.api_key = api_key or resolve_pexels_api_key()
        self.cache_dir = cache_dir or self.CACHE_DIR
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def search_videos(
        self,
        query: str,
        *,
        orientation: str = "portrait",
        per_page: int = 5,
        min_duration_sec: int = 3,
    ) -> List[Dict[str, Any]]:
        """Search Pexels Videos API for vertical/portrait video clips."""
        if not self.api_key:
            return []

        params = {
            "query": query,
            "orientation": orientation,
            "per_page": per_page,
        }
        url = f"{self.API_BASE}?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(
            url,
            headers={
                "Authorization": self.api_key,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) PrometheusBrollEngine/1.0",
            },
        )

        try:
            with urllib.request.urlopen(req, timeout=12) as response:
                if response.status == 200:
                    payload = json.loads(response.read().decode("utf-8"))
                    videos = payload.get("videos", [])
                    # Filter for duration
                    return [v for v in videos if v.get("duration", 0) >= min_duration_sec]
        except urllib.error.HTTPError as exc:
            print(f"[PexelsVideoClient] HTTP error {exc.code} for query '{query}': {exc.reason}", flush=True)
        except Exception as exc:
            print(f"[PexelsVideoClient] Request error for query '{query}': {exc}", flush=True)

        return []

    def select_best_vertical_file(self, video_record: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Pick highest resolution vertical (9:16) MP4 file stream from a video record."""
        files = video_record.get("video_files", [])
        if not files:
            return None

        # Filter for MP4 format
        mp4_files = [f for f in files if f.get("file_type") == "video/mp4" or str(f.get("link", "")).endswith(".mp4")]
        if not mp4_files:
            mp4_files = files

        # Sort preference: HD vertical (1080x1920) > UHD vertical (2160x3840) > other portrait > landscape
        def _score_file(f: Dict[str, Any]) -> int:
            w = f.get("width") or 0
            h = f.get("height") or 0
            if h > w:  # Portrait orientation
                if w == 1080 and h == 1920:
                    return 1000  # Perfect 1080p vertical match
                if w == 2160 and h == 3840:
                    return 900   # 4K vertical match
                return 500 + min(w, 400)
            return 100 + min(w, 200)

        sorted_files = sorted(mp4_files, key=_score_file, reverse=True)
        return sorted_files[0] if sorted_files else None

    def materialize_asset(
        self,
        query: str,
        *,
        preferred_orientation: str = "portrait",
        download_local: bool = True,
    ) -> Optional[BrollAssetMetadata]:
        """Search, select, and optionally download a B-roll video clip."""
        videos = self.search_videos(query, orientation=preferred_orientation)
        if not videos and preferred_orientation == "portrait":
            # Fallback to landscape search if no portrait found
            videos = self.search_videos(query, orientation="landscape")

        if not videos:
            return None

        chosen_vid = videos[0]
        chosen_file = self.select_best_vertical_file(chosen_vid)
        if not chosen_file or not chosen_file.get("link"):
            return None

        video_url = chosen_file["link"]
        vid_id = str(chosen_vid.get("id"))
        w = int(chosen_file.get("width") or chosen_vid.get("width") or 1080)
        h = int(chosen_file.get("height") or chosen_vid.get("height") or 1920)
        dur = float(chosen_vid.get("duration") or 5.0)

        rel_local_path = f"broll/pexels_{vid_id}.mp4"
        abs_local_path = self.cache_dir / f"pexels_{vid_id}.mp4"

        # Download if requested and not yet cached
        if download_local and not abs_local_path.exists():
            try:
                print(f"[PexelsVideoClient] Downloading clip {vid_id} ({w}x{h}, {dur}s) to {abs_local_path.name}...", flush=True)
                dl_req = urllib.request.Request(
                    video_url,
                    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) PrometheusBrollEngine/1.0"},
                )
                with urllib.request.urlopen(dl_req, timeout=30) as dl_resp, open(abs_local_path, "wb") as out_f:
                    while True:
                        chunk = dl_resp.read(65536)
                        if not chunk:
                            break
                        out_f.write(chunk)
                print(f"[PexelsVideoClient] Successfully cached {abs_local_path.name} ({abs_local_path.stat().st_size} bytes)", flush=True)
            except Exception as exc:
                print(f"[PexelsVideoClient] Download failed for {vid_id} ({exc}); falling back to remote URL.", flush=True)
                rel_local_path = video_url

        return BrollAssetMetadata(
            asset_id=f"pexels_{vid_id}",
            source="pexels",
            query=query,
            video_url=video_url,
            local_file=rel_local_path if abs_local_path.exists() else video_url,
            duration_sec=dur,
            width=w,
            height=h,
            orientation="portrait" if h >= w else "landscape",
            aspect_ratio="9:16" if h >= w else "16:9",
            photographer=str(chosen_vid.get("user", {}).get("name", "Pexels Creator")),
            photographer_url=str(chosen_vid.get("user", {}).get("url", "https://www.pexels.com")),
        )


# ---------------------------------------------------------------------------
# Adobe After Effects-Grade Treatment Prescriber
# ---------------------------------------------------------------------------

def prescribe_after_effects_treatment(
    *,
    treatment_type: Optional[str] = None,
    beat_type: Optional[str] = None,
    evaluation: Optional[BrollSuitabilityEvaluation] = None,
    seed: Optional[str] = None,
) -> AfterEffectsTreatmentConfig:
    """Prescribe top-notch Adobe After Effects broadcast treatment configuration.

    Styles:
    1. cinematic_fullbleed:
       Slow Ken Burns continuous push (100% -> 106%), 35mm organic film grain,
       warm amber/cool teal color grading, soft halation bloom on highlights.
    2. evidentiary_dossier_card:
       2.5D physical floating card (16px border-radius, thin polaroid border),
       slap-drop entrance with 2-frame squash contact bounce (102% -> 98%),
       double-state cast shadow (ambient contact + directional throw).
    3. track_matte_unfurl:
       Asymmetric geometric bounding-box reveal (0% -> 100% width, then 20% -> 100% height)
       with luminous cyan or gold razor stroke and inner counter-drift.
    4. rack_focus_spotlight:
       Underlying talking head dives into 28px Camera Lens Blur + 20% brightness dip;
       B-roll snaps sharply from 40px blur + 120% scale -> 0px blur + 100% scale.
    5. hinged_3d_swing:
       Outer-edge anchor, 75° -> 0° Y-axis perspective swing with motion streak.
    6. retinal_flash_cut:
       2-frame micro-flash / color inversion transient synchronized with impact sfx.
    7. behind_subject_depth:
       Composited on Z:5 directly behind matted speaker cutout (Z:50).
    """
    valid_styles = (
        "cinematic_fullbleed",
        "evidentiary_dossier_card",
        "track_matte_unfurl",
        "rack_focus_spotlight",
        "hinged_3d_swing",
        "retinal_flash_cut",
        "behind_subject_depth",
    )

    style = treatment_type
    if not style or style not in valid_styles:
        # Intelligently assign based on beat type & evaluation
        if beat_type in ("proof", "evidence"):
            style = "evidentiary_dossier_card"
        elif beat_type in ("crisis", "conflict"):
            style = "retinal_flash_cut"
        elif beat_type in ("revelation", "realization"):
            style = "rack_focus_spotlight"
        elif beat_type in ("world_context", "environment"):
            style = "cinematic_fullbleed"
        elif beat_type in ("tech_workflow", "system"):
            style = "track_matte_unfurl"
        else:
            # Deterministic hash selection for variety
            h = int(hashlib.md5(f"{seed}_{evaluation.chunk_index if evaluation else 0}".encode()).hexdigest(), 16)
            style = valid_styles[h % len(valid_styles)]

    # 1. Cinematic Full-Bleed
    if style == "cinematic_fullbleed":
        return AfterEffectsTreatmentConfig(
            treatment_name="cinematic_fullbleed",
            ken_burns={"enabled": True, "scale_start": 1.00, "scale_end": 1.07, "pan_direction": "slow_push_in"},
            framing={"style": "full_bleed", "border_radius_px": 0, "border_width_px": 0, "border_color": "transparent"},
            optical={"defocus_dive": False, "blur_start_px": 0, "blur_end_px": 0, "film_grain_opacity": 0.05, "film_halation_intensity": 0.30, "vignette_intensity": 0.40},
            shadow={"double_state": False, "contact_shadow": "none", "directional_shadow": "none"},
            motion_physics={"entrance_physics": "none", "settle_frames": 0, "reaction_jolt_px": 0},
            transient={"retinal_flash": False, "flash_frames": 0, "color_inversion": False},
        )

    # 2. Evidentiary Dossier Card (2.5D Slap-Drop)
    if style == "evidentiary_dossier_card":
        return AfterEffectsTreatmentConfig(
            treatment_name="evidentiary_dossier_card",
            ken_burns={"enabled": True, "scale_start": 1.00, "scale_end": 1.03, "pan_direction": "sub_pixel_drift"},
            framing={"style": "polaroid_card", "border_radius_px": 16, "border_width_px": 2, "border_color": "rgba(255, 255, 255, 0.25)"},
            optical={"defocus_dive": True, "blur_start_px": 0, "blur_end_px": 0, "film_grain_opacity": 0.03, "film_halation_intensity": 0.15, "vignette_intensity": 0.25},
            shadow={"double_state": True, "contact_shadow": "0 3px 8px rgba(0, 0, 0, 0.85)", "directional_shadow": "0 28px 56px rgba(0, 0, 0, 0.70)"},
            motion_physics={"entrance_physics": "slap_drop_bounce", "settle_frames": 14, "reaction_jolt_px": 3},
            transient={"retinal_flash": False, "flash_frames": 0, "color_inversion": False},
        )

    # 3. Track-Matte Asymmetric Unfurl
    if style == "track_matte_unfurl":
        return AfterEffectsTreatmentConfig(
            treatment_name="track_matte_unfurl",
            ken_burns={"enabled": True, "scale_start": 1.05, "scale_end": 1.00, "pan_direction": "counter_pan_right"},
            framing={"style": "unfurl_crop", "border_radius_px": 8, "border_width_px": 2, "border_color": "rgba(56, 189, 248, 0.85)"},
            optical={"defocus_dive": False, "blur_start_px": 0, "blur_end_px": 0, "film_grain_opacity": 0.04, "film_halation_intensity": 0.20, "vignette_intensity": 0.30},
            shadow={"double_state": True, "contact_shadow": "0 2px 6px rgba(0, 0, 0, 0.80)", "directional_shadow": "0 20px 40px rgba(0, 0, 0, 0.55)"},
            motion_physics={"entrance_physics": "track_matte_wipe", "settle_frames": 10, "reaction_jolt_px": 0},
            transient={"retinal_flash": False, "flash_frames": 0, "color_inversion": False},
        )

    # 4. Rack-Focus Dive & Target Spotlight
    if style == "rack_focus_spotlight":
        return AfterEffectsTreatmentConfig(
            treatment_name="rack_focus_spotlight",
            ken_burns={"enabled": True, "scale_start": 1.15, "scale_end": 1.00, "pan_direction": "zoom_in_snap"},
            framing={"style": "full_bleed", "border_radius_px": 0, "border_width_px": 0, "border_color": "transparent"},
            optical={"defocus_dive": True, "blur_start_px": 36, "blur_end_px": 0, "film_grain_opacity": 0.05, "film_halation_intensity": 0.35, "vignette_intensity": 0.50},
            shadow={"double_state": False, "contact_shadow": "none", "directional_shadow": "none"},
            motion_physics={"entrance_physics": "none", "settle_frames": 12, "reaction_jolt_px": 0},
            transient={"retinal_flash": False, "flash_frames": 0, "color_inversion": False},
        )

    # 5. Hinged 3D Swing
    if style == "hinged_3d_swing":
        return AfterEffectsTreatmentConfig(
            treatment_name="hinged_3d_swing",
            ken_burns={"enabled": True, "scale_start": 1.00, "scale_end": 1.04, "pan_direction": "slow_drift"},
            framing={"style": "polaroid_card", "border_radius_px": 12, "border_width_px": 2, "border_color": "rgba(255, 255, 255, 0.20)"},
            optical={"defocus_dive": True, "blur_start_px": 0, "blur_end_px": 0, "film_grain_opacity": 0.04, "film_halation_intensity": 0.20, "vignette_intensity": 0.30},
            shadow={"double_state": True, "contact_shadow": "0 4px 10px rgba(0, 0, 0, 0.85)", "directional_shadow": "0 30px 60px rgba(0, 0, 0, 0.65)"},
            motion_physics={"entrance_physics": "hinged_3d_swing", "settle_frames": 16, "reaction_jolt_px": 1},
            transient={"retinal_flash": False, "flash_frames": 0, "color_inversion": False},
        )

    # 6. Retinal Flash Cut
    if style == "retinal_flash_cut":
        return AfterEffectsTreatmentConfig(
            treatment_name="retinal_flash_cut",
            ken_burns={"enabled": True, "scale_start": 1.08, "scale_end": 1.01, "pan_direction": "impact_rebound"},
            framing={"style": "full_bleed", "border_radius_px": 0, "border_width_px": 0, "border_color": "transparent"},
            optical={"defocus_dive": False, "blur_start_px": 0, "blur_end_px": 0, "film_grain_opacity": 0.06, "film_halation_intensity": 0.40, "vignette_intensity": 0.45},
            shadow={"double_state": False, "contact_shadow": "none", "directional_shadow": "none"},
            motion_physics={"entrance_physics": "none", "settle_frames": 6, "reaction_jolt_px": 2},
            transient={"retinal_flash": True, "flash_frames": 2, "color_inversion": True},
        )

    # 7. Behind-Subject Depth (Matted Speaker)
    return AfterEffectsTreatmentConfig(
        treatment_name="behind_subject_depth",
        ken_burns={"enabled": True, "scale_start": 1.00, "scale_end": 1.05, "pan_direction": "depth_recede"},
        framing={"style": "full_bleed", "border_radius_px": 0, "border_width_px": 0, "border_color": "transparent"},
        optical={"defocus_dive": False, "blur_start_px": 0, "blur_end_px": 0, "film_grain_opacity": 0.04, "film_halation_intensity": 0.25, "vignette_intensity": 0.35},
        shadow={"double_state": False, "contact_shadow": "none", "directional_shadow": "none"},
        motion_physics={"entrance_physics": "none", "settle_frames": 0, "reaction_jolt_px": 0},
        transient={"retinal_flash": False, "flash_frames": 0, "color_inversion": False},
    )


# ---------------------------------------------------------------------------
# Chunk Timing Schema Resolution
# ---------------------------------------------------------------------------

def resolve_chunk_timing_ms(
    chunk: Dict[str, Any],
    default_duration_ms: float = 2500.0,
) -> Tuple[int, int]:
    """Resolve chunk start/end across timing schemas.

    Production chunks (chunks.py) carry camelCase ``startMs``/``endMs`` (mirrored
    to ``outputStartMs``/``outputEndMs``). Snake_case ``start_ms``/``end_ms`` exist
    only on word tokens and on legacy test fixtures. Returns (start_ms, end_ms)
    with a guaranteed positive duration.
    """
    start_ms = chunk.get("startMs")
    if start_ms is None:
        start_ms = chunk.get("outputStartMs")
    if start_ms is None:
        start_ms = chunk.get("displayStartMs")
    if start_ms is None:
        start_ms = chunk.get("start_ms")
    start_ms = int(start_ms or 0)

    end_ms = chunk.get("endMs")
    if end_ms is None:
        end_ms = chunk.get("outputEndMs")
    if end_ms is None:
        end_ms = chunk.get("end_ms")
    if end_ms is None:
        end_ms = start_ms + default_duration_ms
    end_ms = int(end_ms)
    if end_ms <= start_ms:
        end_ms = start_ms + max(1, int(default_duration_ms))
    return start_ms, end_ms


# ---------------------------------------------------------------------------
# Master B-Roll Plan Generator for Mini-Runs
# ---------------------------------------------------------------------------

def plan_broll_cutaways_for_mini_run(
    *,
    chunks: List[Dict[str, Any]],
    scenes: List[Dict[str, Any]],
    duration_ms: int = 30000,
    max_brolls: int = 2,
    seed: Optional[str] = None,
    client: Optional[PexelsVideoClient] = None,
    download_assets: bool = True,
) -> List[BrollPlacementDirective]:
    """Execute complete B-roll planning, suitability evaluation, and asset materialization.

    Analyzes all transcript chunks in sequence, tracking fatigue accumulation,
    cooldown gating, and concreteness scoring to select the ideal moments for B-roll.
    """
    if not chunks:
        return []

    pexels_client = client or PexelsVideoClient()
    directives: List[BrollPlacementDirective] = []

    last_broll_end_sec = -100.0
    last_visual_break_sec = 0.0

    # First pass: evaluate all chunks
    evaluations: List[Tuple[int, BrollSuitabilityEvaluation, Dict[str, Any], Dict[str, Any]]] = []

    for idx, chunk in enumerate(chunks):
        c_start_ms, c_end_ms = resolve_chunk_timing_ms(chunk, default_duration_ms=2000.0)
        c_start_sec = c_start_ms / 1000.0
        c_end_sec = c_end_ms / 1000.0
        c_dur_sec = max(0.1, c_end_sec - c_start_sec)
        c_text = str(chunk.get("text", "")).strip()

        # Find corresponding scene
        matched_scene = next(
            (s for s in scenes if int(s.get("startMs", 0)) <= c_start_ms <= int(s.get("endMs", 30000))),
            scenes[0] if scenes else {"id": f"scene-{idx}"},
        )

        time_since_broll = max(0.0, c_start_sec - last_broll_end_sec)
        time_since_break = max(0.0, c_start_sec - last_visual_break_sec)

        evaluation = BrollSuitabilityEngine.evaluate_chunk(
            chunk_index=idx,
            text=c_text,
            duration_sec=c_dur_sec,
            time_since_last_broll_sec=time_since_broll,
            time_since_last_visual_break_sec=time_since_break,
            beat_type=matched_scene.get("beatType") or matched_scene.get("role"),
            is_behind_subject_assigned=bool((chunk.get("subjectLayering") or {}).get("behindSubject")),
        )

        evaluations.append((idx, evaluation, chunk, matched_scene))

    # Sort eligible candidates by composite suitability score
    eligible = [e for e in evaluations if e[1].is_eligible]
    eligible.sort(key=lambda x: x[1].composite_score, reverse=True)

    # Select top candidates obeying cooldown and max_brolls budget
    selected_indices: Set[int] = set()
    selected_intervals: List[Tuple[int, int]] = []
    cooldown_gap_ms = int(BrollSuitabilityEngine.COOLDOWN_GAP_SEC * 1000)
    for idx, eval_res, chunk, scene in eligible:
        if len(selected_indices) >= max_brolls:
            break

        c_start, c_end = resolve_chunk_timing_ms(chunk, default_duration_ms=3000.0)

        # Two-sided interval collision: candidates earlier in the timeline than a
        # previously selected placement must not be skipped by a signed-gap check.
        too_close = any(
            (c_start < s_end + cooldown_gap_ms) and (s_start < c_end + cooldown_gap_ms)
            for s_start, s_end in selected_intervals
        )

        if not too_close:
            selected_indices.add(idx)
            selected_intervals.append((c_start, c_end))

    # Second pass: Materialize assets and construct directives
    for idx, eval_res, chunk, scene in evaluations:
        if idx not in selected_indices:
            continue

        c_text = str(chunk.get("text", "")).strip()
        primary_q, fallback_q = extract_broll_search_queries(c_text, beat_name=scene.get("role"))

        # Fetch asset from Pexels
        asset = pexels_client.materialize_asset(primary_q, download_local=download_assets)
        if not asset and fallback_q != primary_q:
            asset = pexels_client.materialize_asset(fallback_q, download_local=download_assets)

        if not asset:
            # Safe mock fallback so pipeline never crashes on network interruption
            h_id = hashlib.md5(c_text.encode()).hexdigest()[:8]
            asset = BrollAssetMetadata(
                asset_id=f"broll_{h_id}",
                source="mock",
                query=primary_q,
                video_url="",
                local_file="",
                duration_sec=eval_res.duration_sec,
                width=1080,
                height=1920,
                orientation="portrait",
                aspect_ratio="9:16",
                photographer="Prometheus Studio",
                photographer_url="https://prometheus.ai",
            )

        treatment = prescribe_after_effects_treatment(
            beat_type=scene.get("role"),
            evaluation=eval_res,
            seed=seed,
        )

        c_start_ms, c_end_ms = resolve_chunk_timing_ms(chunk, default_duration_ms=3000.0)
        c_start_ms = min(c_start_ms, max(0, duration_ms - 1))
        c_end_ms = min(c_end_ms, duration_ms)

        # Assign high-tier SFX cue matching the entrance
        sfx_cue = "whoosh_cinematic"
        if treatment.treatment_name == "evidentiary_dossier_card":
            sfx_cue = "heavy_thud_sub"
        elif treatment.treatment_name == "retinal_flash_cut":
            sfx_cue = "impact_cinematic"
        elif treatment.treatment_name == "track_matte_unfurl":
            sfx_cue = "paper_slide"

        directive = BrollPlacementDirective(
            placement_id=f"broll-placement-{idx + 1}",
            chunk_index=idx,
            scene_id=str(scene.get("id", f"scene-{idx}")),
            start_ms=c_start_ms,
            end_ms=c_end_ms,
            duration_ms=max(1, c_end_ms - c_start_ms),
            evaluation=eval_res,
            asset=asset,
            treatment=treatment,
            sfx_cue=sfx_cue,
        )
        directives.append(directive)

    return directives
