"""
schema.py

The feature schema for Prometheus trajectory extraction.

WHY THIS EXISTS (read this before changing anything):
  This is the ~60-80 discrete, hand-engineered, low-correlation feature set
  committed to in ROADMAP Program 20. It is the SINGLE shared representation
  that both BC and IRL consume. Building it once, here, is what makes
  warm-start transfer between BC and IRL actually real.

  Every field here is DISCRETE on purpose: enums, booleans, small integers,
  or bucketed floats. There are NO high-dimensional neural embeddings
  (no CLIP, no ResNet, no MiniLM). Discrete features:
    - work at ~300-600 videos (the data you actually have)
    - are interpretable (each weight = one craft lever)
    - transfer between BC and IRL without re-extraction
    - keep MaxEnt near-convex (fast, stable solve on CPU)

HOW TO READ THIS FILE:
  - Trajectory            = one video's complete extraction (what gets saved as trajectory.json)
  - TimelineWindow        = one discretized time-bucket within a video
  - Each *_Features block = one craft family, ~6-10 fields each
  - Total active features = ~70 (in the Program 20 sweet spot)

CONVENTIONS:
  - Enums mirror the planner's genome vocabulary where one exists
    (intensity, visualDensity, motionEnergy, editorialRole) so that a
    learned weight w_joseph maps directly onto planner dimensions.
  - Booleans are used when the thing either happens or doesn't (PiP on/off,
    B-roll on/off). Cheaper and more interpretable than a confidence float.
  - Bucketed floats use 3- or 4-level enums instead of raw numbers.
  - Every field has a docstring. If you can't explain what a field means in
    one sentence, it's not a good feature — remove it.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ============================================================================
# CORE ENUMS  (these mirror the planner genome vocabulary in types.ts)
# ============================================================================

class Intensity(str, Enum):
    """Maps 1:1 to minimalismLevelSchema in the planner."""
    minimal = "minimal"
    restrained = "restrained"
    balanced = "balanced"
    expressive = "expressive"


class VisualDensity(str, Enum):
    """Maps 1:1 to visualDensityProfileSchema in the planner."""
    quiet = "quiet"
    balanced = "balanced"
    loud = "loud"


class MotionEnergy(str, Enum):
    """Maps 1:1 to motionEnergyProfileSchema in the planner."""
    none = "none"
    subtle = "subtle"
    active = "active"


class EditorialRole(str, Enum):
    """Maps 1:1 to archiveEditorialRoleSchema in the planner."""
    setup = "setup"
    explain = "explain"
    tension = "tension"
    payoff = "payoff"


class EnergyBucket(str, Enum):
    """3-level loudness/energy bucket. Avoids raw floats -> avoids overfit."""
    low = "low"
    mid = "mid"
    high = "high"


class Confidence(str, Enum):
    """Speaker vocal confidence. Discrete so a weight is interpretable."""
    uncertain = "uncertain"
    neutral = "neutral"
    assertive = "assertive"


# ============================================================================
# FEATURE FAMILIES  (~70 features total across 8 families)
# ============================================================================

class CameraFeatures(BaseModel):
    """What the camera / virtual-camera is doing in this window.
    Captured via optical flow + MediaPipe face-box velocity."""

    movement_class: str = Field(
        ...,
        description="static | slow_zoom_in | slow_zoom_out | pan | handheld_shake | whip",
    )
    movement_magnitude: EnergyBucket = Field(
        ...,
        description="How far the frame moved within the window. Bucketed, not raw px.",
    )
    has_ken_burns: bool = Field(
        False,
        description="Slow deliberate scale/translate on a static image (the 'Ken Burns' move).",
    )
    face_box_velocity: EnergyBucket = Field(
        ...,
        description="How fast the speaker's face-box is moving in frame. proxy for camera motion relative to subject.",
    )
    shot_change_count: int = Field(
        ...,
        ge=0,
        le=5,
        description="Number of hard cuts within this window. Capped at 5 (anything more is a bug or a montage).",
    )
    has_jump_cut: bool = Field(
        False,
        description="Same-subject cut with no camera move. Joseph's signature pacing tool.",
    )
    has_match_cut: bool = Field(
        False,
        description="Cut on a matched action or composition.",
    )
    momentum_direction: str = Field(
        ...,
        description="in | out | none. Is energy building or releasing? Drives climax/restraint windows.",
    )
    crop_tightness: str = Field(
        ...,
        description="tight_head | medium | wide | full_body. The speaker framing.",
    )
    rule_of_thirds_alignment: bool = Field(
        False,
        description="Subject sits on a thirds intersection (left-anchor / right-anchor in genome vocab).",
    )


class TypographyFeatures(BaseModel):
    """On-screen text. This is where most of Joseph's signature lives.
    Captured via OCR (EasyOCR / PaddleOCR) + heuristics."""

    has_text: bool = Field(False, description="Any on-screen text at all in this window?")
    role: str = Field(
        "none",
        description=(
            "none | caption | keyword_pop | lower_third | title_card | cta | watermark. "
            "Maps to creativeTreatmentSchema in the planner."
        ),
    )
    placement_zone: str = Field(
        "none",
        description="none | upper_third | lower_third | center | hero | full_width | left_anchor | right_anchor",
    )
    font_weight: str = Field(
        "none",
        description="none | light | regular | bold | black",
    )
    text_color_treatment: str = Field(
        "none",
        description="none | white | black | brand_color | gradient | outlined",
    )
    animation_class: str = Field(
        "none",
        description="none | fade | slide | pop | typewriter | kinetic",
    )
    has_background_plate: bool = Field(
        False,
        description="Does the text sit on a solid/blur plate for legibility? Joseph's signature on lower-thirds.",
    )
    keyword_count: int = Field(
        0,
        ge=0,
        le=4,
        description="Number of emphasized keyword pops. Capped at 4.",
    )
    text_duration_bucket: str = Field(
        "none",
        description="none | flash (<1s) | short (1-2s) | standard (2-4s) | held (>4s)",
    )
    occupancy_bucket: EnergyBucket = Field(
        "low",
        description="How much of the frame the text occupies. Bucketed.",
    )


class MotionGraphicsFeatures(BaseModel):
    """Animated overlays beyond text: glass cards, data viz, image assets."""

    has_glass_card: bool = Field(False, description="Frosted/blurred card overlay.")
    has_image_asset: bool = Field(False, description="A still image / screenshot inserted.")
    has_data_viz: bool = Field(False, description="Chart / graph / number counter.")
    has_screen_recording: bool = Field(False, description="Screen capture inset.")
    micro_animation_family: str = Field(
        "none",
        description="none | zoom_elastic | fade_in | slide | pop | blur_reveal | scale_pulse",
    )
    overlay_layer_count: int = Field(
        0,
        ge=0,
        le=4,
        description="Distinct overlay layers active. Capped at 4.",
    )
    has_particle_fx: bool = Field(False, description="Sparkle / dust / light particles.")
    has_depth_layering: bool = Field(
        False,
        description="Foreground/background separation (parallax or blur depth).",
    )


class CompositionFeatures(BaseModel):
    """Spatial layout / depth / subject arrangement."""

    speaker_position: str = Field(
        ...,
        description="left | center | right | absent. Absent = pure B-roll or full-frame graphic.",
    )
    has_pip: bool = Field(False, description="Picture-in-picture of another video or image.")
    pip_count: int = Field(0, ge=0, le=2, description="Number of PiP insets. Capped at 2.")
    pip_arrangement: str = Field(
        "none",
        description="none | split_screen | inset_corner | stacked",
    )
    negative_space_ratio: EnergyBucket = Field(
        ...,
        description="Empty area not occupied by subject/text. low = cluttered, high = breathing room.",
    )
    background_type: str = Field(
        ...,
        description="real_scene | blurred_interior | solid_color | gradient | image | screenshot",
    )
    depth_of_field: str = Field(
        ...,
        description="deep | shallow | synthetic_blur",
    )
    has_subject_segmentation: bool = Field(
        False,
        description="Speaker matted/cut out from background (RobustVideoMatting style).",
    )
    subject_scale: str = Field(
        ...,
        description="small | medium | large. How big the speaker is in frame.",
    )
    visual_symmetry: bool = Field(False, description="Left/right balanced composition.")


class TransitionFeatures(BaseModel):
    """How one shot becomes the next. Captured at window boundaries."""

    dominant_type: str = Field(
        "cut",
        description="cut | crossfade | whip_pan | motion_match | fade_to_black | morph",
    )
    has_audio_synced_cut: bool = Field(
        False,
        description="Cut lands within ~80ms of a beat or transient. Joseph's rhythm signature.",
    )
    timing_offset_bucket: str = Field(
        "on",
        description="early | on | late. Cut relative to the nearest beat.",
    )
    has_momentum_handoff: bool = Field(
        False,
        description="Motion direction carries across the cut (smooth continuity).",
    )
    transition_duration_bucket: str = Field(
        "instant",
        description="instant | fast (<200ms) | standard (200-500ms) | slow (>500ms)",
    )
    has_flash_transition: bool = Field(False, description="Flash / light-burst transition.")


class AudioFeatures(BaseModel):
    """Sound design. Captured via librosa + beat-grid-builder."""

    sfx_class: str = Field(
        "none",
        description="none | whoosh | impact | riser | pop | boom | ui_tick",
    )
    sfx_count: int = Field(0, ge=0, le=4, description="SFX triggers in window. Capped at 4.")
    music_presence: bool = Field(False, description="Is background music active?")
    music_energy: EnergyBucket = Field(..., description="Music loudness/intensity bucket.")
    beat_proximity: str = Field(
        "off",
        description="on_beat | near_beat | off_beat. How aligned window events are to the beat grid.",
    )
    ducking_active: bool = Field(
        False,
        description="Music volume ducked under the speaker's voice.",
    )
    has_silence_gap: bool = Field(False, description="Intentional silence (tension tool).")
    vocal_energy: EnergyBucket = Field(..., description="Speaker loudness bucket.")
    spectral_brightness: EnergyBucket = Field(
        ...,
        description="Spectral centroid bucket — dull | neutral | bright.",
    )
    transient_density: EnergyBucket = Field(
        ...,
        description="How many sharp onsets per second. Proxy for 'busyness'.",
    )


class TemporalFeatures(BaseModel):
    """Where this window sits in the video's pacing arc."""

    position_in_video: str = Field(
        ...,
        description="hook (0-10%) | intro (10-25%) | body (25-75%) | climax (75-90%) | outro (90-100%)",
    )
    pacing_density: EnergyBucket = Field(
        ...,
        description="Cuts-per-second bucket for this window vs the video average.",
    )
    is_climax_window: bool = Field(
        False,
        description="This window is in the highest-intensity region of the arc.",
    )
    is_restraint_window: bool = Field(
        False,
        description="Deliberately quiet window before/after a climax (contrast setup).",
    )
    sequence_trend: str = Field(
        ...,
        description="rising | falling | steady | volatile. Maps to sequenceTrendSchema.",
    )
    novelty_level: EnergyBucket = Field(
        ...,
        description="How visually novel this window is vs recent windows. QD relevance signal.",
    )
    surprise_budget_state: EnergyBucket = Field(
        ...,
        description="How much 'weird/surprising' budget remains. low = spent, high = available.",
    )
    repetition_penalty_active: bool = Field(
        False,
        description="A recent window already used this treatment, so this one should differ.",
    )


class SpeakerVocalFeatures(BaseModel):
    """What the speaker is doing vocally / emotionally."""

    is_speaking: bool = Field(False, description="Active speech in this window?")
    speaking_rate: str = Field(
        "none",
        description="none | slow | medium | fast. Words-per-minute bucket.",
    )
    confidence: Confidence = Field(..., description="Vocal assertiveness bucket.")
    has_emphasis: bool = Field(
        False,
        description="A stressed word / punchy delivery (volume or pitch spike).",
    )
    has_pause: bool = Field(False, description="Intentional rhetorical pause.")
    face_emotion_class: str = Field(
        "neutral",
        description="neutral | smiling | serious | intense | surprised",
    )
    gaze_target: str = Field(
        ...,
        description="lens | offscreen | graphic. Where the speaker is looking.",
    )
    has_gesture: bool = Field(False, description="Visible hand/body gesture in frame.")


# ============================================================================
# THE WINDOW  (one discretized time-bucket's worth of features)
# ============================================================================

class TimelineWindow(BaseModel):
    """One bucket of time within a video's trajectory.

    Discretization rule (Program 1): windows are fixed-duration buckets
    (default 1.0s) OR shot-boundary-aligned, whichever you choose at
    extraction config time. Shot-aligned is more faithful to craft;
    fixed-duration is simpler to compare across videos. Pick one and
    be consistent across the whole corpus.
    """

    index: int = Field(..., ge=0, description="Zero-based window index within the trajectory.")
    start_seconds: float = Field(..., ge=0)
    end_seconds: float = Field(..., gt=0)

    # The genome dimensions the planner already speaks. These four are the
    # cell-key of the QD archive, so a learned reward must score along them.
    intensity: Intensity
    visual_density: VisualDensity
    motion_energy: MotionEnergy
    editorial_role: EditorialRole

    # The ~70 hand features, grouped.
    camera: CameraFeatures
    typography: TypographyFeatures
    motion_graphics: MotionGraphicsFeatures
    composition: CompositionFeatures
    transitions: TransitionFeatures
    audio: AudioFeatures
    temporal: TemporalFeatures
    speaker_vocal: SpeakerVocalFeatures

    @property
    def feature_count(self) -> int:
        """Total discrete feature fields across all families.
        Program 20 target is 60-80. This should land ~70."""
        families = [
            self.camera, self.typography, self.motion_graphics, self.composition,
            self.transitions, self.audio, self.temporal, self.speaker_vocal,
        ]
        return sum(len(family.model_fields) for family in families)


# ============================================================================
# THE TRAJECTORY  (one complete video -> one of these -> one trajectory.json)
# ============================================================================

class ExtractionMode(str, Enum):
    """Which footage variant produced this trajectory.
    Records the extraction path so provenance is auditable and BC/IRL
    can distinguish paired-derived vs finals-derived actions."""
    paired = "paired"          # raw + edited both available; actions derived by diffing
    finals_only = "finals_only"  # only the final edit available; actions detected in-place


class SegmentGenre(str, Enum):
    """What kind of segment this window belongs to. Used to FILTER OUT
    tutorial-walkthrough content (screen-recordings of AE/Notion/app UI)
    so the learned reward trains on editorial craft, not instructional noise.
    Set during extraction; filtered before training."""
    editorial = "editorial"                          # the real Joseph craft signal
    tutorial_walkthrough = "tutorial_walkthrough"    # step-by-step app UI — EXCLUDE from training
    broll_only = "broll_only"                        # pure B-roll, no speaker
    title_card = "title_card"                        # static title / end-card frame


class TrajectoryMetadata(BaseModel):
    """Provenance for the trajectory. Needed for audit + dedup."""

    extraction_mode: ExtractionMode = Field(
        ...,
        description="paired (raw+edited diffed) or finals_only (detected in-place). MUST be consistent per corpus.",
    )
    source_video_id: Optional[str] = Field(
        None,
        description="Stable hash of the source footage. Null for finals_only extraction.",
    )
    edited_video_id: str = Field(..., description="Stable hash of the edited/final cut.")
    editor_label: str = Field("joseph", description="Whose craft this trajectory captures.")
    extracted_at_utc: str
    extractor_version: str = Field(..., description="Schema/extractor version, e.g. '0.1.0'.")
    duration_seconds: float = Field(..., gt=0)
    fps: float = Field(..., gt=0)
    resolution: str = Field(..., description="e.g. '1080x1920'")
    windowing_mode: str = Field(
        ...,
        description="shot_aligned | fixed_1s | fixed_2s. MUST be consistent across the corpus.",
    )
    notes: Optional[str] = Field(None, description="Free-text caveats (bad OCR, missing audio, etc).")


class Trajectory(BaseModel):
    """A complete extraction of one edited video.

    This is what gets saved as trajectory.json and later consumed by:
      - BC:  treats each window's genome+features as (state) and learns
             the (state -> next-state-delta) mapping.
      - IRL (MaxEnt): treats the full sequence as one expert demonstration
             and learns weights w over the discrete features.
      - QD archive: indexes windows by the 4 genome dimensions.

    ONE video == ONE Trajectory. Do not split a video into multiple
    trajectories, and do not merge multiple videos into one.
    """

    schema_version: str = Field("0.1.0", description="Bump if the schema changes shape.")
    metadata: TrajectoryMetadata
    windows: list[TimelineWindow] = Field(
        ...,
        min_length=1,
        description="Ordered list of windows from video start to end.",
    )

    @property
    def total_feature_slots(self) -> int:
        """feature_count per window, times window count. NOT unique features.
        Useful for sanity-checking extraction output size."""
        if not self.windows:
            return 0
        return self.windows[0].feature_count * len(self.windows)


# ============================================================================
# SELF-CHECK  (run: python -m trajectory_extractor.schema)
# ============================================================================

if __name__ == "__main__":
    """Prints the feature audit: total fields, per-family counts.
    This is the Program 20 feature audit gate. Run it before scaling
    extraction to the full corpus."""

    sample_window_families = [
        ("camera", CameraFeatures),
        ("typography", TypographyFeatures),
        ("motion_graphics", MotionGraphicsFeatures),
        ("composition", CompositionFeatures),
        ("transitions", TransitionFeatures),
        ("audio", AudioFeatures),
        ("temporal", TemporalFeatures),
        ("speaker_vocal", SpeakerVocalFeatures),
    ]

    print("=" * 60)
    print("PROMETHEUS TRAJECTORY SCHEMA — FEATURE AUDIT")
    print("=" * 60)
    print(f"Schema version: {Trajectory.model_fields['schema_version'].default}")
    print()
    total = 0
    for name, model in sample_window_families:
        count = len(model.model_fields)
        total += count
        print(f"  {name:<20} {count:>3} features")
    print("-" * 60)
    print(f"  {'GENOME DIMS':<20} {'4':>3} features  (intensity/visualDensity/motionEnergy/role)")
    print(f"  {'TOTAL PER WINDOW':<20} {total + 4:>3} features")
    print()
    print(f"  Program 20 target: 60-80  ->  {'PASS' if 60 <= total + 4 <= 80 else 'FAIL'}")
    print("=" * 60)
