"""Google Veo 3.1 Video Orchestration & High-Tier Editorial Prompt Synthesis Engine.

Part of the Mini-Run Pipeline (mini_run_pipeline/).

This engine translates monologue transcript semantic inflection moments into
broadcast-grade Veo 3.1 generative video prompts and manages the predictLongRunning
API orchestration lifecycle.

Dogma & Editorial Rules:
1. Editorial Style: High-agency documentary cinematography (Vox / Johnny Harris / Iman Gadzhi).
   Tactile macro materials, 35mm anamorphic lens, chiaroscuro/Rembrandt lighting,
   and physical metaphor visualization over flat 2D cards.
2. Complete Asset Treatment Specification:
   - Optical Blur & Depth-of-Field: Background Defocus Isolation, Rack-Focus Dive, Directional Motion-Streak.
   - Spatial Physics & Rotation: 3D Off-Axis Swing (85°->0°), Slap-Drop with Contact Bounce, Lateral Friction Slide.
   - Framed Containers & B-Roll: Asymmetric Track Matte Unfurl, Polarizing Bevel / Card Elevation, Mask-Slice Slide.
   - Shadow Mechanics: Dynamic Elevation Shadow, Double-State Cast Shadow (Contact + Throw), Trailing Shadow Vector.
   - Secondary Motion: Continuous Sub-Pixel Drift (100%->102%), Rotational Damped Oscillation, Canvas Reaction Jolt.
3. API Adherence:
   - Targets Google AI Studio endpoints: models/veo-3.1-generate-preview, models/veo-3.1-fast-generate-preview, models/veo-3.1-lite-generate-preview.
   - Parameters: durationSeconds strictly clamped to valid Veo intervals (4, 6, or 8 seconds), aspectRatio="9:16".
   - Handles asynchronous operation polling via /v1beta/operations/{id}.
   - Robustly captures HTTP 429 quota constraints and produces exhaustive offline orchestration artifacts.
"""

from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


# ---------------------------------------------------------------------------
# Constants & Model Identifiers
# ---------------------------------------------------------------------------

VEO_3_1_STANDARD = "models/veo-3.1-generate-preview"
VEO_3_1_FAST = "models/veo-3.1-fast-generate-preview"
VEO_3_1_LITE = "models/veo-3.1-lite-generate-preview"

DEFAULT_VEO_MODEL = VEO_3_1_FAST
VALID_VEO_DURATIONS = (4, 6, 8)


# ---------------------------------------------------------------------------
# API Key Resolution
# ---------------------------------------------------------------------------

def resolve_google_api_key() -> str:
    """Retrieve Google AI Studio API key from environment or project root .env."""
    key = os.getenv("GOOGLE_AI_STUDIO_API_KEY") or os.getenv("GEMINI_API_KEY")
    if key and key.strip():
        return key.strip()

    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip('"').strip("'")
                if k in ("GOOGLE_AI_STUDIO_API_KEY", "GEMINI_API_KEY") and v:
                    return v

    raise RuntimeError("GOOGLE_AI_STUDIO_API_KEY is not configured in environment or .env.")


# ---------------------------------------------------------------------------
# Data Models for Asset Treatment & Prompt Synthesis
# ---------------------------------------------------------------------------

@dataclass
class AssetTreatmentDirective:
    """Defines exact cinematic physical treatment applied to an introduced visual asset."""
    optical_blur: str
    spatial_physics: str
    framed_container: str
    shadow_behavior: str
    secondary_motion: str
    metaphor_scene: str
    tactile_materials: str
    lighting_atmosphere: str


@dataclass
class VeoGenerationJob:
    """Structured job descriptor for a Veo 3.1 video clip generation."""
    concept_id: str
    concept_name: str
    timestamp: str
    target_start_sec: float
    target_end_sec: float
    target_duration_sec: float
    veo_duration_seconds: int
    prompt: str
    treatment: AssetTreatmentDirective
    model: str
    aspect_ratio: str = "9:16"
    image_path: Optional[str] = None
    operation_name: Optional[str] = None
    video_uri: Optional[str] = None
    status: str = "PENDING"  # PENDING, SUBMITTED, COMPLETED, QUOTA_RESTRICTED, ERROR
    error_message: Optional[str] = None


# ---------------------------------------------------------------------------
# High-Tier Editorial Prompt Synthesis (Vox / Iman Gadzhi Style)
# ---------------------------------------------------------------------------

class VeoEditorialPromptBuilder:
    """Synthesizes broadcast-grade Veo 3.1 prompts matching Vox / Iman Gadzhi aesthetics."""

    @staticmethod
    def clamp_veo_duration(actual_duration_sec: float) -> int:
        """Clamp arbitrary timeline segment to the closest valid Veo duration (4, 6, or 8s)."""
        if actual_duration_sec <= 5.0:
            return 4
        elif actual_duration_sec <= 7.0:
            return 6
        else:
            return 8

    @classmethod
    def synthesize_flow_prompt(
        cls,
        subject_element: str,
        action_movement: str,
        location_background: str,
        context_lighting: str,
        composition: str,
        style_cues: str,
    ) -> str:
        """Synthesize prompt adhering strictly to the proven Google Flow viral structure:
        [Subject/Element] + [Action/Movement] + [Location/Background] + [Context/Lighting] + [Composition] + [Style/Cues]
        """
        parts = [
            subject_element.strip().rstrip(","),
            action_movement.strip().rstrip(","),
            location_background.strip().rstrip(","),
            context_lighting.strip().rstrip(","),
            composition.strip().rstrip(","),
            style_cues.strip().rstrip("."),
        ]
        return ", ".join(p for p in parts if p) + "."

    @classmethod
    def synthesize_prompt(
        cls,
        concept_name: str,
        spoken_phrase: str,
        visual_metaphor: str,
        treatment: AssetTreatmentDirective,
        duration_sec: int,
    ) -> str:
        """Compose a prompt adhering strictly to the proven 6-part Google Flow structure."""
        subject = f"{visual_metaphor or treatment.metaphor_scene} with {treatment.tactile_materials}"
        action = f"{treatment.spatial_physics}, {treatment.optical_blur}, {treatment.secondary_motion}"
        location = f"dark minimalist obsidian background with subtle transparent checkerboard grid and {treatment.framed_container}"
        lighting = treatment.lighting_atmosphere or "dramatic chiaroscuro lighting with cool cyan rim light and warm spotlight"
        composition = f"vertical 9:16 framing, 35mm anamorphic lens with shallow depth of field and anamorphic bokeh, continuous smooth camera tracking"
        style = f"premium Vox and Iman Gadzhi high-agency editorial documentary motion design, 24fps, crisp vector edges, subtle 35mm Kodak 5219 film grain"

        return cls.synthesize_flow_prompt(
            subject_element=subject,
            action_movement=action,
            location_background=location,
            context_lighting=lighting,
            composition=composition,
            style_cues=style,
        )


# ---------------------------------------------------------------------------
# Default Curated Treatment Mappings for Monologue Inflections
# ---------------------------------------------------------------------------

CURATED_TREATMENTS: Dict[str, AssetTreatmentDirective] = {
    "INFLECTION-001": AssetTreatmentDirective(
        optical_blur="Background Defocus Isolation with 25px lens blur and 15% brightness dip across the underlying canvas",
        spatial_physics="The Slap-Drop with Contact Bounce pushing along Z-axis with exponential decrescendo and 2-frame 3% scale squash on impact",
        framed_container="The Polarizing Bevel Card Elevation with fine metallic bevel border and archival document badge",
        shadow_behavior="The Double-State Cast Shadow featuring 70% dense contact shadow at 3px offset and 25% directional throw shadow at 40px feather",
        secondary_motion="Continuous Sub-Pixel Drift scaling 100% to 102% paired with 1-frame 3px canvas reaction jolt on contact",
        metaphor_scene="An obsessive investigator's darkroom desk illuminated by an overhead tungsten lamp; thousands of scattered theory papers and research notes dissolve into fine ethereal smoke",
        tactile_materials="Aged parchment, matte carbon-fiber clipboard, illuminated cyan neon status indicator",
        lighting_atmosphere="Moody chiaroscuro contrast, warm 3200K tungsten spotlight with cool cyan rim back-lighting",
    ),
    "INFLECTION-002": AssetTreatmentDirective(
        optical_blur="The Rack-Focus Dive rapidly scaling down from 125% to 100% over 12 frames while optical blur snaps from 50px to 0px with anamorphic bokeh",
        spatial_physics="The Lateral Friction Slide entering horizontally at maximum velocity with zero ease-in, gliding against 70% simulated high friction",
        framed_container="The Asymmetric Crop Track Matte Unfurl with hairline border appearing first then scaling width 0% to 100% then height 20% to 100%",
        shadow_behavior="Trailing Shadow Vector lagging dynamically behind lateral trajectory before settling into dual-state contact alignment",
        secondary_motion="Rotational Damped Oscillation landing at +3 degrees, rebounding to -1.2 degrees, and settling at 0 degrees over 16 frames",
        metaphor_scene="Macro push-in on an intricate brass and matte obsidian mechanical flywheel gear train continuously tracking iterative feedback loops with high precision",
        tactile_materials="Laser-etched titanium dials, micro-milled brass bevel gears, glowing fiber-optic data channels",
        lighting_atmosphere="Cool industrial split lighting, razor-sharp volumetric sun rays through darkroom dust, high specular highlights",
    ),
    "INFLECTION-003": AssetTreatmentDirective(
        optical_blur="Directional Motion-Streak Entrance with active 360-degree shutter angle streak snapping pin-sharp upon deceleration",
        spatial_physics="The 3D Off-Axis Swing with anchor point on outer edge, hinged rotational entry from 80 degrees down to 0 degrees with dramatic perspective deformation",
        framed_container="The Polarizing Bevel Elevation with forensic evidentiary numbering and Polaroid-grade chamfered edges",
        shadow_behavior="Dynamic Elevation Shadow tracking Z-distance, collapsing from 15% faint 80px feather into 45% tight contact shadow upon landing",
        secondary_motion="Continuous Sub-Pixel Drift with 0.5px subtle lateral floating drift and micro rotational oscillation",
        metaphor_scene="An expansive asymmetric 10x10 grid of 100 vintage glass vacuum tube filaments; 99 tubes remain cold and fractured while one central tube ignites into brilliant gold-white luminescence",
        tactile_materials="Hand-blown borosilicate glass, tungsten filament coils, textured dark slate baseplate, amber vacuum glow",
        lighting_atmosphere="Deep moody shadows, intense golden point-source glow casting long dramatic shadows across the grid",
    ),
    "INFLECTION-004": AssetTreatmentDirective(
        optical_blur="Background Defocus Isolation paired with The Rack-Focus Dive snapping into pinpoint focus on the central mechanical lever",
        spatial_physics="The Slap-Drop with Contact Bounce and 1-frame canvas reaction jolt transferring physical weight to the board",
        framed_container="The Mask-Slice Slide translating cleanly out from behind an invisible vertical divider into full view",
        shadow_behavior="The Double-State Cast Shadow with 80% dense contact occlusion and wide 50px directional throw",
        secondary_motion="Continuous Sub-Pixel Drift 100% to 101.8% scale keeping the asset visually breathing throughout dialogue",
        metaphor_scene="An architectural blueprint elevation showing a high-pressure hydrodynamic conduit bottleneck; a single massive solid brass bypass valve turns smoothly, instantly unleashing a 10x surge of kinetic flow",
        tactile_materials="Heavy drafting vellum, machined solid brass valve wheel, blueprint cyan ink, polished industrial fittings",
        lighting_atmosphere="Warm architectural study lighting, sharp drafting lamp shadows, luminous drafting grid backlight",
    ),
}


# ---------------------------------------------------------------------------
# Veo 3.1 API Client
# ---------------------------------------------------------------------------

class VeoClient:
    """Client for Google AI Studio Veo 3.1 predictLongRunning API."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or resolve_google_api_key()

    def submit_predict_long_running(
        self,
        prompt: str,
        duration_seconds: int = 6,
        aspect_ratio: str = "9:16",
        model: str = DEFAULT_VEO_MODEL,
        image_path: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Submit a video generation job to predictLongRunning endpoint.
        
        Duration must be one of: 4, 6, 8 seconds.
        If image_path is provided, performs Image-to-Video generation.
        """
        if duration_seconds not in VALID_VEO_DURATIONS:
            raise ValueError(f"Invalid durationSeconds {duration_seconds}. Must be one of {VALID_VEO_DURATIONS}.")

        url = f"https://generativelanguage.googleapis.com/v1beta/{model}:predictLongRunning"
        instance: Dict[str, Any] = {"prompt": prompt}

        if image_path and Path(image_path).exists():
            import base64
            img_bytes = Path(image_path).read_bytes()
            instance["image"] = {"bytesBase64Encoded": base64.b64encode(img_bytes).decode("utf-8")}

        payload = {
            "instances": [instance],
            "parameters": {
                "aspectRatio": aspect_ratio,
                "durationSeconds": duration_seconds,
            },
        }

        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": self.api_key,
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as err:
            err_body = err.read().decode("utf-8")
            if err.code == 429:
                return {
                    "error": {
                        "code": 429,
                        "status": "RESOURCE_EXHAUSTED",
                        "message": "Veo generation quota exhausted or restricted on current API key tier.",
                        "raw_response": err_body,
                    }
                }
            elif err.code == 400:
                return {
                    "error": {
                        "code": 400,
                        "status": "INVALID_ARGUMENT",
                        "message": "Invalid argument provided to Veo API.",
                        "raw_response": err_body,
                    }
                }
            else:
                return {
                    "error": {
                        "code": err.code,
                        "status": err.reason,
                        "message": f"HTTP error {err.code}: {err.reason}",
                        "raw_response": err_body,
                    }
                }

    def poll_operation(self, operation_name: str, poll_interval_sec: int = 10, max_attempts: int = 30) -> Dict[str, Any]:
        """Poll a long-running operation until completion."""
        url = f"https://generativelanguage.googleapis.com/v1beta/{operation_name}"
        req = urllib.request.Request(
            url,
            headers={"x-goog-api-key": self.api_key},
            method="GET",
        )

        for attempt in range(max_attempts):
            try:
                with urllib.request.urlopen(req, timeout=20) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    if data.get("done", False):
                        return data
            except Exception as e:
                print(f"[veo_client] Polling error on attempt {attempt+1}: {e}")

            time.sleep(poll_interval_sec)

        return {"done": False, "error": "Polling timed out"}


# ---------------------------------------------------------------------------
# High-Level Orchestrator
# ---------------------------------------------------------------------------

def orchestrate_transcript_veo_assets(
    semantic_manifest_path: str,
    output_dir: str,
    target_model: str = DEFAULT_VEO_MODEL,
) -> Dict[str, Any]:
    """Orchestrate Veo 3.1 video generation jobs for extracted narrative inflections."""
    manifest_file = Path(semantic_manifest_path)
    if not manifest_file.exists():
        raise FileNotFoundError(f"Semantic manifest not found: {manifest_file}")

    with open(manifest_file, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    inflections = manifest.get("selectedInflections", [])
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    client = VeoClient()
    jobs: List[VeoGenerationJob] = []

    print(f"[veo_orchestrator] Synthesizing Veo 3.1 prompts for {len(inflections)} narrative inflections...")

    for inf in inflections:
        cid = inf.get("conceptId", "INFLECTION-UNKNOWN")
        cname = inf.get("conceptName", "Untitled Concept")
        ts = inf.get("timestamp", "00:00")
        start_sec = float(inf.get("startSec", 0.0))
        end_sec = float(inf.get("endSec", start_sec + 6.0))
        dur_sec = float(inf.get("durationSec", end_sec - start_sec))
        phrase = inf.get("spokenPhrase", "")
        metaphor = inf.get("visualMetaphor", "")

        # Bind treatment directive directly from extracted manifest or fallback to curated
        if inf.get("opticalBlur"):
            sec_motion = inf.get("secondaryMotion", [])
            sec_motion_str = ", ".join(sec_motion) if isinstance(sec_motion, list) else str(sec_motion)
            treatment = AssetTreatmentDirective(
                optical_blur=inf.get("opticalBlur", ""),
                spatial_physics=inf.get("spatialPhysics", ""),
                framed_container=inf.get("framedContainer", ""),
                shadow_behavior=inf.get("shadowBehavior", ""),
                secondary_motion=sec_motion_str,
                metaphor_scene=metaphor or "Tactile documentary editorial scene",
                tactile_materials=inf.get("tactileMaterials", "Polished metals, dark slate, vellum paper"),
                lighting_atmosphere=inf.get("lightingAtmosphere", "Chiaroscuro contrast, volumetric warm spotlight"),
            )
        else:
            treatment = CURATED_TREATMENTS.get(
                cid,
                AssetTreatmentDirective(
                    optical_blur="Background Defocus Isolation with 20px Gaussian blur",
                    spatial_physics="The Slap-Drop with Contact Bounce and 2-frame squash",
                    framed_container="The Polarizing Bevel Card Elevation with clean metallic border",
                    shadow_behavior="The Double-State Cast Shadow with dense contact and wide throw",
                    secondary_motion="Continuous Sub-Pixel Drift 100% to 102%",
                    metaphor_scene=metaphor or "Tactile documentary editorial scene",
                    tactile_materials="Polished brass, dark slate, vellum paper",
                    lighting_atmosphere="Chiaroscuro contrast, volumetric warm spotlight",
                ),
            )

        veo_dur = inf.get("veoDurationSeconds") or VeoEditorialPromptBuilder.clamp_veo_duration(dur_sec)
        if veo_dur not in (4, 6, 8):
            veo_dur = VeoEditorialPromptBuilder.clamp_veo_duration(dur_sec)

        prompt = inf.get("veoPrompt")
        if not prompt or len(prompt.strip()) < 20:
            prompt = VeoEditorialPromptBuilder.synthesize_prompt(
                concept_name=cname,
                spoken_phrase=phrase,
                visual_metaphor=metaphor,
                treatment=treatment,
                duration_sec=veo_dur,
            )

        # Complementary integration: bind requisite macro image if mineral_macro_manifest exists
        matched_image_path: Optional[str] = None
        macro_manifest_file = Path(semantic_manifest_path).parent / "mineral_macro_manifest.json"
        if macro_manifest_file.exists():
            try:
                macro_meta = json.loads(macro_manifest_file.read_text(encoding="utf-8"))
                for sec in macro_meta.get("macroSections", []):
                    if sec.get("concept_id") == cid:
                        matched_image_path = sec.get("requisite_image", {}).get("file_path")
                        break
            except Exception:
                pass

        job = VeoGenerationJob(
            concept_id=cid,
            concept_name=cname,
            timestamp=ts,
            target_start_sec=start_sec,
            target_end_sec=end_sec,
            target_duration_sec=dur_sec,
            veo_duration_seconds=veo_dur,
            prompt=prompt,
            treatment=treatment,
            model=target_model,
            aspect_ratio="9:16",
            image_path=matched_image_path,
        )
        jobs.append(job)

    # Submit jobs to Veo API & record operation status
    print(f"[veo_orchestrator] Submitting jobs to Google Veo 3.1 ({target_model})...")
    api_results: List[Dict[str, Any]] = []

    for job in jobs:
        print(f"\n--- Submitting [{job.concept_id}] {job.concept_name} ({job.veo_duration_seconds}s) ---")
        if job.image_path:
            print(f"Paired Requisite Image: {job.image_path}")
        print(f"Prompt preview: {job.prompt[:160]}...")

        res = client.submit_predict_long_running(
            prompt=job.prompt,
            duration_seconds=job.veo_duration_seconds,
            aspect_ratio=job.aspect_ratio,
            model=job.model,
            image_path=job.image_path,
        )

        if "name" in res:
            job.status = "SUBMITTED"
            job.operation_name = res["name"]
            print(f"-> Submitted successfully! Operation ID: {res['name']}")
        elif "error" in res:
            err_info = res["error"]
            if err_info.get("code") == 429:
                job.status = "QUOTA_RESTRICTED"
                job.error_message = "HTTP 429 RESOURCE_EXHAUSTED (Standard Key Preview Tier Quota)"
                print(f"-> Quota restricted (HTTP 429): Preserved structured Veo prompt directive for orchestration.")
            else:
                job.status = "ERROR"
                job.error_message = f"{err_info.get('status')}: {err_info.get('message')}"
                print(f"-> Error: {job.error_message}")

        api_results.append({
            "concept_id": job.concept_id,
            "concept_name": job.concept_name,
            "veo_duration_seconds": job.veo_duration_seconds,
            "status": job.status,
            "operation_name": job.operation_name,
            "error_message": job.error_message,
            "prompt": job.prompt,
            "treatment": asdict(job.treatment),
        })

    # Save comprehensive Veo orchestration manifest
    veo_manifest_path = out_dir / "veo_orchestration_manifest.json"
    orchestration_output = {
        "engine": "Prometheus Core Veo 3.1 Orchestrator",
        "target_model": target_model,
        "style_dogma": "Vox / Iman Gadzhi High-Tier Editorial",
        "timestamp_generated": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_jobs": len(jobs),
        "jobs": api_results,
    }

    veo_manifest_path.write_text(json.dumps(orchestration_output, indent=2), encoding="utf-8")
    print(f"\n[veo_orchestrator] Veo orchestration manifest written to: {veo_manifest_path}")

    # Generate authoritative documentation markdown
    md_report_path = out_dir / "VEO_ORCHESTRATION_DIRECTIVE.md"
    _write_markdown_report(md_report_path, orchestration_output)
    print(f"[veo_orchestrator] Human-readable directive saved to: {md_report_path}")

    # Generate dedicated Google Flow 1-click copy-and-paste catalog
    flow_catalog_path = out_dir / "GOOGLE_FLOW_PROMPT_CATALOG.md"
    _write_google_flow_catalog(flow_catalog_path, orchestration_output)
    print(f"[veo_orchestrator] Google Flow Copy-and-Paste Catalog saved to: {flow_catalog_path}")

    return orchestration_output


def _write_google_flow_catalog(target_file: Path, data: Dict[str, Any]) -> None:
    """Generate ready-to-use copy-and-paste prompt catalog for Google Flow web studio."""
    lines = [
        "# Google Flow Viral Prompt Catalog (Proven 6-Part Structure)",
        "",
        "Use this catalog directly in **Google Flow** ([labs.google/flow](https://labs.google/flow)) using your Pro subscription credits.",
        "",
        "### Proven Google Flow Structure:",
        "```text",
        "[Subject/Element] + [Action/Movement] + [Location/Background] + [Context/Lighting] + [Composition] + [Style/Cues]",
        "```",
        "",
        "---",
        "",
        "## Part 1: Top Copy-and-Paste Motion Graphic Prompts",
        "",
        "### 1. Abstract Data Flow / Tech Intro",
        "**Formula Breakdown:**",
        "* `[Subject/Element]`: Animated interconnected glowing circuits and flowing digital waves",
        "* `[Location/Background]`: dark minimalist obsidian background",
        "* `[Context/Lighting]`: neon blue and violet light reflections",
        "* `[Action/Movement]`: smooth continuous orbital camera pan",
        "* `[Style/Cues]`: premium 4K vector motion graphics style, sleek corporate tech aesthetic",
        "",
        "**Copy & Paste Prompt:**",
        "```text",
        "Animated interconnected glowing circuits and flowing digital waves, smooth continuous orbital camera pan, dark minimalist obsidian background, neon blue and violet light reflections, vertical 9:16 framing, premium 4K vector motion graphics style, sleek corporate tech aesthetic.",
        "```",
        "",
        "---",
        "",
        "### 2. Kinetic Logo / Dynamic Typography",
        "**Formula Breakdown:**",
        "* `[Subject/Element]`: Sleek metallic 3D logo morphing and rotating smoothly",
        "* `[Location/Background]`: soft gradient background with clean studio environment",
        "* `[Context/Lighting]`: subtle volumetric light leaks and clean studio lighting",
        "* `[Action/Movement]`: slow-motion fluid zoom in",
        "* `[Style/Cues]`: crisp vector edges, modern minimalist motion design",
        "",
        "**Copy & Paste Prompt:**",
        "```text",
        "Sleek metallic 3D typography and geometric logo morphing and rotating smoothly, slow-motion fluid zoom in, clean studio lighting with soft gradient background, subtle volumetric light leaks, vertical 9:16 composition, crisp vector edges, modern minimalist motion design, 24fps.",
        "```",
        "",
        "---",
        "",
        "### 3. 38.Whitecheckered Search Query Visualization",
        "**Formula Breakdown:**",
        "* `[Subject/Element]`: Translucent holographic search box with dynamic typewriter entry and glowing dropdown results",
        "* `[Location/Background]`: dark slate studio backdrop with high-contrast transparent checkerboard backing",
        "* `[Context/Lighting]`: luminous neon cyan and amber status glow",
        "* `[Action/Movement]`: high-velocity lateral entry settling with damped oscillation and 1-frame impact squash",
        "* `[Style/Cues]`: premium 4K vector motion graphics, Vox documentary style, crisp typography",
        "",
        "**Copy & Paste Prompt:**",
        "```text",
        "Translucent holographic search box with dynamic typewriter entry and glowing dropdown result cards, high-velocity lateral entrance settling with damped pendulum oscillation, dark studio backdrop with subtle white transparent checkerboard backing, luminous neon cyan and amber status glow, vertical 9:16 framing, premium 4K vector motion graphics, Vox documentary style, crisp typography.",
        "```",
        "",
        "---",
        "",
        "## Part 2: Monologue Editorial Beats (\"Own the Outcome\")",
        "",
    ]

    for job in data.get("jobs", []):
        t = job.get("treatment", {})
        cid = job.get("concept_id")
        cname = job.get("concept_name")
        dur = job.get("veo_duration_seconds")
        lines.extend([
            f"### [{cid}] {cname} ({dur}s)",
            f"* **Spoken Concept**: {cname}",
            f"* **Target Video Duration**: `{dur}s` (Select {dur}s in Google Flow)",
            f"* **Aspect Ratio**: `9:16` Vertical",
            "",
            "**Structured Breakdown:**",
            f"* `[Subject/Element]`: {t.get('metaphor_scene')} ({t.get('tactile_materials')})",
            f"* `[Action/Movement]`: {t.get('spatial_physics')}, {t.get('optical_blur')}, {t.get('secondary_motion')}",
            f"* `[Location/Background]`: Dark minimalist obsidian background with {t.get('framed_container')}",
            f"* `[Context/Lighting]`: {t.get('lighting_atmosphere')}",
            f"* `[Composition]`: 35mm anamorphic lens with shallow depth of field and anamorphic bokeh, 9:16 vertical framing",
            f"* `[Style/Cues]`: Premium Vox / Iman Gadzhi high-agency editorial documentary style, 24fps, Kodak 5219 film grain",
            "",
            "**Copy & Paste Prompt for Google Flow:**",
            "```text",
            job.get("prompt", ""),
            "```",
            "",
            "---",
            "",
        ])

    lines.extend([
        "## How to Feed Generated Clips Back Into Prometheus",
        "",
        "1. Generate each clip in **Google Flow** using 9:16 aspect ratio.",
        "2. Save the clips into: `docs/mini_run_studio/flow_clips/`",
        "   - Beat 1 -> `docs/mini_run_studio/flow_clips/beat1.mp4` (or `I001.mp4`)",
        "   - Beat 2 -> `docs/mini_run_studio/flow_clips/beat2.mp4` (or `I002.mp4`)",
        "   - Beat 3 -> `docs/mini_run_studio/flow_clips/beat3.mp4` (or `I003.mp4`)",
        "3. Run the automated compositor:",
        "   ```powershell",
        "   python mini_run_pipeline/cinematic_asset_compositor.py",
        "   ```",
        "4. The pipeline will automatically embed your Google Flow video inside the 3D Polarizing Bevel container,",
        "   apply physical contact bounce and background defocus isolation, and multiplex the narrator's audio!",
    ])

    target_file.write_text("\n".join(lines), encoding="utf-8")


def _write_markdown_report(target_file: Path, data: Dict[str, Any]) -> None:
    """Generate professional markdown directive report."""
    lines = [
        "# Prometheus Core: Veo 3.1 Editorial Orchestration Directive",
        "",
        f"**Engine**: {data.get('engine')}",
        f"**Target Generative Model**: `{data.get('target_model')}`",
        f"**Aesthetic Dogma**: {data.get('style_dogma')}",
        f"**Generated**: {data.get('timestamp_generated')}",
        "",
        "---",
        "",
        "## Executive Summary",
        "This directive orchestrates the translation of monologue semantic inflection points into photorealistic,",
        "camera-directed generative video clips using Google Veo 3.1. Each prompt strictly enforces:",
        "1. **Tactile Macro Cinematography**: Physical world-building over flat 2D overlays.",
        "2. **Rigorous Asset Introduction Dogma**: Optical blur, spatial physics, framed container reveals, and shadow behaviors.",
        "3. **Bounded Temporal Clamping**: Clamped to valid Veo intervals (4s, 6s, 8s) matching the spoken delivery.",
        "",
        "---",
        "",
        "## Synthesized Veo 3.1 Prompt Catalog",
        "",
    ]

    for job in data.get("jobs", []):
        t = job.get("treatment", {})
        lines.extend([
            f"### [{job.get('concept_id')}] {job.get('concept_name')} ({job.get('veo_duration_seconds')}s)",
            f"- **Status**: `{job.get('status')}`",
            f"- **Operation Name**: `{job.get('operation_name') or 'N/A'}`",
            f"- **API Diagnostic**: {job.get('error_message') or 'Success'}",
            "",
            "#### Asset Treatment Specifications",
            f"- **Optical Blur & Depth of Field**: {t.get('optical_blur')}",
            f"- **Spatial Physics & Rotation**: {t.get('spatial_physics')}",
            f"- **Framed Container Reveal**: {t.get('framed_container')}",
            f"- **Shadow Behavior**: {t.get('shadow_behavior')}",
            f"- **Secondary Micro-Movement**: {t.get('secondary_motion')}",
            f"- **Tactile Materials**: {t.get('tactile_materials')}",
            f"- **Lighting & Atmosphere**: {t.get('lighting_atmosphere')}",
            "",
            "#### Exact Veo 3.1 Prompt Directive",
            "```text",
            job.get("prompt", ""),
            "```",
            "",
            "---",
            "",
        ])

    target_file.write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    manifest_p = "docs/mini_run_studio/deep_semantic_manifest.json"
    out_dir_p = "docs/mini_run_studio"
    orchestrate_transcript_veo_assets(manifest_p, out_dir_p)
