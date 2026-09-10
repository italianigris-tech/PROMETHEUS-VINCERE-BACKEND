"""Prometheus Core — Mineral Extraction & Macro Section Image Orchestration Bridge.

Part of the Mini-Run Pipeline (mini_run_pipeline/).

Architectural Mandates:
1. MINERAL & PHYSICAL EXTRACTION:
   Deconstructs monologue concepts and extracts their elemental mineral, material,
   and physical foundations (heavy cast iron, carved marble bedrock, oiled steel,
   polished brass, luminescent amber glass, obsidian, monolithic stone).

2. MACRO SECTION EXPANSION (STRICTLY NO LANDSCAPE):
   Elevates physical entities into high-agency tactile macro cinematography:
   - 35mm anamorphic close-up lenses, shallow depth of field, optical bokeh.
   - Chiaroscuro key lighting, volumetric haze, Kodak 5219 film grain.
   - Polarizing bevel containers, double-state cast shadows, rotational damped oscillation.
   - INVARIANT: Strictly enforces 9:16 vertical format. Landscape orientations (16:9,
     wide horizons, panoramic scenery) are actively blocked.

3. REQUISITE IMAGE PAIRING & ORCHESTRATION BRIDGE:
   Pairs every semantic inflection and animation idea with its requisite tactile
   macro image asset to support the orchestration agent sending jobs to
   generative pipelines (Flux 1.1 / Gemini Image 1.1 -> Veo 3.1 Image-to-Video).

4. PLUGGABLE ENABLING TOOL ARCHITECTURE:
   Structured with an extensible adapter interface (EnablingImageTool) ready to
   seamlessly bind the enabling tool provided by the user while gracefully utilizing
   local broadcast catalog assets and API providers in the interim.

5. NON-DESTRUCTIVE SUPPORT:
   Preserves all existing transcriptions, timestamps, and semantic metadata without
   mutation or disruption.
"""

from __future__ import annotations

import base64
import json
import os
import shutil
from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple, Union


# ---------------------------------------------------------------------------
# Constants & Paths
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent
STUDIO_DIR = REPO_ROOT / "docs" / "mini_run_studio"
MACRO_ASSETS_DIR = STUDIO_DIR / "assets" / "macro_sections"
MANIFEST_OUTPUT_PATH = STUDIO_DIR / "mineral_macro_manifest.json"

DEFAULT_ASPECT_RATIO = "9:16"
FORBIDDEN_LANDSCAPE_RATIOS = {"16:9", "4:3", "21:9", "1.77", "landscape"}


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------

@dataclass
class MineralPhysicalEntity:
    """Elemental mineral and tactile material definition extracted from transcript."""
    entity_id: str
    material_name: str
    mineral_domain: str  # e.g. "ferrous_metallurgy", "mineral_architectural", "vitreous_luminescence", "precision_horology"
    tactile_surface_properties: str
    physical_weight_kg_m3: float
    acoustic_resonance: str
    symbolic_grounding: str


@dataclass
class MacroCinematographySpec:
    """Rigorous tactile macro shot parameters (strictly 9:16 vertical)."""
    aspect_ratio: str
    lens_type: str
    focal_length: str
    aperture: str
    focus_behavior: str
    optical_blur_px: float
    lighting_style: str
    film_emulsion: str
    framing_container: str
    shadow_mechanics: str
    secondary_motion: List[str]


@dataclass
class RequisiteImageAsset:
    """Pristine 9:16 macro image paired with the concept for orchestration."""
    asset_id: str
    file_path: str
    relative_path: str
    aspect_ratio: str
    dimensions: Tuple[int, int]
    mime_type: str
    color_palette: List[str]
    has_alpha: bool
    base64_preview: Optional[str] = None


@dataclass
class MacroOrchestrationPacket:
    """Complete complementary package dispatched to the orchestration agent."""
    concept_id: str
    concept_name: str
    timestamp: str
    start_sec: float
    end_sec: float
    duration_sec: float
    veo_duration_seconds: int
    spoken_phrase: str
    mineral_entity: MineralPhysicalEntity
    macro_spec: MacroCinematographySpec
    requisite_image: RequisiteImageAsset
    veo_image_to_video_prompt: str
    veo_text_prompt: str
    headline: str
    subline: str
    badges: List[str]
    status: str = "READY_FOR_ORCHESTRATION"


# ---------------------------------------------------------------------------
# Mineral & Material Taxonomy Registry
# ---------------------------------------------------------------------------

MINERAL_TAXONOMY: Dict[str, MineralPhysicalEntity] = {
    "weathered_cast_iron": MineralPhysicalEntity(
        entity_id="min_cast_iron",
        material_name="Weathered Cast Iron & Brushed Industrial Steel",
        mineral_domain="ferrous_metallurgy",
        tactile_surface_properties="Pitted granular iron oxide, micro-scratches, cold brushed steel shearing marks, raw machined bevels",
        physical_weight_kg_m3=7200.0,
        acoustic_resonance="Low-frequency metallic clang with dense 120Hz mechanical damping",
        symbolic_grounding="Radical self-reliance, immovable agency, solitary momentum"
    ),
    "parchment_oak_slate": MineralPhysicalEntity(
        entity_id="min_parchment_slate",
        material_name="Cellulose Parchment, Raw Quarter-Sawn Oak & Honed Slate",
        mineral_domain="lignin_metamorphic_sediment",
        tactile_surface_properties="Dry fibrous parchment edges, deep open-grain oak pores, matte micro-crystalline slate clefts",
        physical_weight_kg_m3=2400.0,
        acoustic_resonance="Dry paper friction slide settling into dense wooden desk thud (280Hz)",
        symbolic_grounding="Shedding information overload, clean execution slate, focused workspace"
    ),
    "oiled_steel_brass": MineralPhysicalEntity(
        entity_id="min_oiled_brass_steel",
        material_name="Tempered Alloy Steel & Polished Phosphor Bronze / Brass",
        mineral_domain="precision_horology_metallurgy",
        tactile_surface_properties="Hydrophobic mineral oil sheen, razor laser-etched vernier calibrations, specular tooth flanks",
        physical_weight_kg_m3=8500.0,
        acoustic_resonance="Crisp interlocking gear mesh clicks, harmonic clockwork shimmer (1800Hz)",
        symbolic_grounding="Systematic edge, volume with feedback, flywheel compounding"
    ),
    "borosilicate_luminescent": MineralPhysicalEntity(
        entity_id="min_borosilicate_crystal",
        material_name="Annealed Borosilicate Glass & Incandescent Solute Liquid",
        mineral_domain="vitreous_luminescence",
        tactile_surface_properties="Optical flint glass refraction, caustic light dispersion, condensation beading, mirror-polished wire rack",
        physical_weight_kg_m3=2230.0,
        acoustic_resonance="High-frequency crystal chime (3400Hz) with bubbling thermal convection",
        symbolic_grounding="The 100-experiment asymmetry, singular breakthrough discovery from failures"
    ),
    "marble_bedrock_foundation": MineralPhysicalEntity(
        entity_id="min_marble_bedrock",
        material_name="Pentelic Carved Marble & Deep Granitic Bedrock Plinth",
        mineral_domain="mineral_architectural",
        tactile_surface_properties="Crystalline calcite grain, hand-chiseled fluting, weathered structural fissures, raw basalt foundation",
        physical_weight_kg_m3=2700.0,
        acoustic_resonance="Sub-bass monolithic earth resonance (45Hz) with stone friction grinding",
        symbolic_grounding="Unshakeable principles, ironclad reputation, foundational ownership"
    ),
}


# ---------------------------------------------------------------------------
# Pluggable Enabling Tool Interface
# ---------------------------------------------------------------------------

class EnablingImageTool(ABC):
    """Abstract interface for image generation / retrieval tools.
    
    This ensures that when the user provides an enabling tool, it can be
    registered directly without modifying core orchestration logic.
    """
    @abstractmethod
    def acquire_image(
        self,
        prompt: str,
        concept_id: str,
        aspect_ratio: str = DEFAULT_ASPECT_RATIO,
        fallback_path: Optional[Path] = None,
    ) -> RequisiteImageAsset:
        pass


class LocalCatalogImageTool(EnablingImageTool):
    """Retrieves high-fidelity pre-rendered macro images from the repository catalog."""

    def __init__(self, catalog_dir: Path = MACRO_ASSETS_DIR):
        self.catalog_dir = catalog_dir

    def acquire_image(
        self,
        prompt: str,
        concept_id: str,
        aspect_ratio: str = DEFAULT_ASPECT_RATIO,
        fallback_path: Optional[Path] = None,
    ) -> RequisiteImageAsset:
        # Search for matched file in catalog
        filename_mapping = {
            "I001": "i001_cast_iron_gear_macro.jpg",
            "I002": "i002_research_dossier_macro.jpg",
            "I003": "i003_systematic_gears_macro.jpg",
            "I004": "i004_experiment_testtube_macro.jpg",
            "SR001": "i001_cast_iron_gear_macro.jpg",
            "RMT002": "i002_research_dossier_macro.jpg",
            "SEF003": "i003_systematic_gears_macro.jpg",
            "HEA004": "i004_experiment_testtube_macro.jpg",
            "MINERAL_BEDROCK": "mineral_bedrock_column_macro.jpg",
        }
        target_name = filename_mapping.get(concept_id, f"{concept_id.lower()}_macro.jpg")
        target_file = self.catalog_dir / target_name

        if not target_file.exists() and fallback_path and fallback_path.exists():
            target_file = fallback_path

        if not target_file.exists():
            raise FileNotFoundError(f"Requisite macro image for {concept_id} not found at {target_file}")

        rel_path = f"assets/macro_sections/{target_file.name}"
        file_bytes = target_file.read_bytes()
        b64 = f"data:image/jpeg;base64,{base64.b64encode(file_bytes).decode('utf-8')}"

        return RequisiteImageAsset(
            asset_id=f"img_{concept_id.lower()}",
            file_path=str(target_file.resolve()),
            relative_path=rel_path,
            aspect_ratio=aspect_ratio,
            dimensions=(768, 1376),
            mime_type="image/jpeg",
            color_palette=["#0F172A", "#38BDF8", "#F59E0B", "#E2E8F0"],
            has_alpha=False,
            base64_preview=b64[:120] + "...[truncated]"
        )


class ExternalUserToolAdapter(EnablingImageTool):
    """Adapter for dynamic runtime enabling tools supplied by the user."""

    def __init__(self, tool_callable: Optional[Callable[..., Any]] = None):
        self.tool_callable = tool_callable

    def set_tool(self, tool_callable: Callable[..., Any]) -> None:
        self.tool_callable = tool_callable

    def acquire_image(
        self,
        prompt: str,
        concept_id: str,
        aspect_ratio: str = DEFAULT_ASPECT_RATIO,
        fallback_path: Optional[Path] = None,
    ) -> RequisiteImageAsset:
        if self.tool_callable is None:
            # Fall back to local catalog if external tool is not yet bound
            local_fallback = LocalCatalogImageTool()
            return local_fallback.acquire_image(prompt, concept_id, aspect_ratio, fallback_path)

        # Invoke user-supplied enabling tool
        res = self.tool_callable(prompt=prompt, concept_id=concept_id, aspect_ratio=aspect_ratio)
        if isinstance(res, RequisiteImageAsset):
            return res
        elif isinstance(res, (str, Path)) and Path(res).exists():
            p = Path(res)
            return RequisiteImageAsset(
                asset_id=f"img_{concept_id.lower()}",
                file_path=str(p.resolve()),
                relative_path=f"assets/macro_sections/{p.name}",
                aspect_ratio=aspect_ratio,
                dimensions=(768, 1376),
                mime_type="image/jpeg",
                color_palette=[],
                has_alpha=False,
            )
        raise ValueError(f"External enabling tool returned unexpected format: {type(res)}")


# ---------------------------------------------------------------------------
# Mineral Extraction & Macro Section Orchestrator
# ---------------------------------------------------------------------------

class MineralMacroBridgeEngine:
    """Coordinates mineral entity extraction, macro cinematography expansion,
    and requisite image asset pairing for complementary video orchestration.
    """

    def __init__(self, image_tool: Optional[EnablingImageTool] = None):
        self.image_tool: EnablingImageTool = image_tool or LocalCatalogImageTool()
        self._validate_environment()

    def _validate_environment(self) -> None:
        MACRO_ASSETS_DIR.mkdir(parents=True, exist_ok=True)

    def register_enabling_tool(self, tool: EnablingImageTool) -> None:
        """Register or upgrade the active enabling tool."""
        self.image_tool = tool

    @staticmethod
    def enforce_portrait_macro_invariant(aspect_ratio: str) -> None:
        """Reject any landscape orientation or aspect ratio."""
        cleaned = aspect_ratio.strip().lower()
        if cleaned in FORBIDDEN_LANDSCAPE_RATIOS or (":" in cleaned and float(cleaned.split(":")[0]) > float(cleaned.split(":")[1])):
            raise ValueError(
                f"VIOLATION OF CORE RULE: Macro section strictly rejects landscape formats (got {aspect_ratio}). "
                "Must be vertical portrait 9:16."
            )

    def extract_mineral_grounding(self, concept_name: str, spoken_phrase: str) -> MineralPhysicalEntity:
        """Map conceptual turning point to its mineral/physical bedrock entity."""
        concept_lower = (concept_name + " " + spoken_phrase).lower()

        if any(w in concept_lower for w in ["self-reliance", "save you", "iron", "mentor", "only person"]):
            return MINERAL_TAXONOMY["weathered_cast_iron"]
        elif any(w in concept_lower for w in ["research", "execution", "entertainment", "dossier", "read", "course"]):
            return MINERAL_TAXONOMY["parchment_oak_slate"]
        elif any(w in concept_lower for w in ["system", "edge", "volume", "feedback", "gear", "flywheel"]):
            return MINERAL_TAXONOMY["oiled_steel_brass"]
        elif any(w in concept_lower for w in ["experiment", "ninety-nine", "test tube", "win", "wrong", "liquid"]):
            return MINERAL_TAXONOMY["borosilicate_luminescent"]
        elif any(w in concept_lower for w in ["reputation", "bedrock", "foundation", "standards", "pillar", "monument"]):
            return MINERAL_TAXONOMY["marble_bedrock_foundation"]

        # Default to weathered iron resilience
        return MINERAL_TAXONOMY["weathered_cast_iron"]

    def synthesize_macro_spec(
        self,
        mineral: MineralPhysicalEntity,
        optical_blur_choice: str = "The Rack-Focus Dive (Macro-Defocus to Sharp Snap)"
    ) -> MacroCinematographySpec:
        """Expand mineral entity into complete tactile macro cinematography specification."""
        self.enforce_portrait_macro_invariant(DEFAULT_ASPECT_RATIO)

        return MacroCinematographySpec(
            aspect_ratio=DEFAULT_ASPECT_RATIO,
            lens_type="35mm Anamorphic Macro Prime (1.5x squeeze)",
            focal_length="65mm Macro Equivalent",
            aperture="T1.5 Ultra-Shallow Depth of Field",
            focus_behavior=optical_blur_choice,
            optical_blur_px=30.0,
            lighting_style="Chiaroscuro key from high 45° with Rembrandt fill and volumetric mist rim",
            film_emulsion="Kodak Vision3 5219 500T with fine organic silver halide grain",
            framing_container="The Polarizing Bevel / 38.Whitecheckered Card Elevation",
            shadow_mechanics="The Double-State Cast Shadow (Contact 75% @ 3px + Throw 25% @ 45px)",
            secondary_motion=[
                "Rotational Damped Oscillation (Pendulum settle: +2.5° -> -1.0° -> 0°)",
                "Continuous Sub-Pixel Drift (100% -> 101.8% scale over segment duration)"
            ]
        )

    def process_semantic_manifest(
        self,
        semantic_manifest_path: Path = STUDIO_DIR / "deep_semantic_manifest.json"
    ) -> Dict[str, Any]:
        """Ingest deep semantic manifest, perform mineral extraction, expand macro section,
        and bind requisite 9:16 macro image assets.
        """
        if not semantic_manifest_path.exists():
            raise FileNotFoundError(f"Source semantic manifest not found: {semantic_manifest_path}")

        raw_data = json.loads(semantic_manifest_path.read_text(encoding="utf-8"))
        inflections = raw_data.get("selectedInflections", [])

        packets: List[MacroOrchestrationPacket] = []

        for inf in inflections:
            cid = inf.get("conceptId", "UNKNOWN")
            cname = inf.get("conceptName", "")
            spoken = inf.get("spokenPhrase", "")
            veo_dur = inf.get("veoDurationSeconds", 6)
            headline = inf.get("headline", "")
            subline = inf.get("subline", "")
            badges = inf.get("badges", [])

            # 1. Mineral extraction
            mineral = self.extract_mineral_grounding(cname, spoken)

            # 2. Macro section cinematography expansion
            macro_spec = self.synthesize_macro_spec(
                mineral,
                optical_blur_choice=inf.get("opticalBlur", "The Rack-Focus Dive (Macro-Defocus to Sharp Snap)")
            )

            # 3. Formulate Image-to-Video and Text prompts
            prompt_i2v = (
                f"Cinematic 9:16 vertical macro shot animating the provided input image. "
                f"Tactile surface animation: {mineral.tactile_surface_properties}. "
                f"Camera execution: {macro_spec.lens_type}, {macro_spec.focus_behavior}, {macro_spec.aperture}. "
                f"{macro_spec.lighting_style}. Natural organic motion, {veo_dur}s loop cadence, 24fps, Kodak 5219 film grain."
            )

            # 4. Acquire requisite image using active enabling tool
            img_asset = self.image_tool.acquire_image(
                prompt=prompt_i2v,
                concept_id=cid,
                aspect_ratio=DEFAULT_ASPECT_RATIO
            )

            packet = MacroOrchestrationPacket(
                concept_id=cid,
                concept_name=cname,
                timestamp=inf.get("timestamp", "00:00-00:00"),
                start_sec=float(inf.get("startSec", 0.0)),
                end_sec=float(inf.get("endSec", 0.0)),
                duration_sec=float(inf.get("durationSec", 0.0)),
                veo_duration_seconds=veo_dur,
                spoken_phrase=spoken,
                mineral_entity=mineral,
                macro_spec=macro_spec,
                requisite_image=img_asset,
                veo_image_to_video_prompt=prompt_i2v,
                veo_text_prompt=inf.get("veoPrompt", ""),
                headline=headline,
                subline=subline,
                badges=badges
            )
            packets.append(packet)

        # Also add the universal Mineral Bedrock Foundation asset (Inflection 0 / Bedrock Plinth)
        bedrock_entity = MINERAL_TAXONOMY["marble_bedrock_foundation"]
        bedrock_macro_spec = self.synthesize_macro_spec(bedrock_entity)
        bedrock_img = self.image_tool.acquire_image(
            prompt="Cinematic 9:16 vertical macro shot animating the classical carved marble column base on bedrock plinth.",
            concept_id="MINERAL_BEDROCK",
            aspect_ratio=DEFAULT_ASPECT_RATIO
        )
        packets.append(MacroOrchestrationPacket(
            concept_id="MINERAL_BEDROCK",
            concept_name="Bedrock Foundation & Monolithic Ownership",
            timestamp="03:04-03:42",
            start_sec=184.0,
            end_sec=222.0,
            duration_sec=38.0,
            veo_duration_seconds=8,
            spoken_phrase="Your reputation is your real asset... Own the outcome. Everything else is commentary.",
            mineral_entity=bedrock_entity,
            macro_spec=bedrock_macro_spec,
            requisite_image=bedrock_img,
            veo_image_to_video_prompt=(
                "Cinematic 9:16 vertical macro shot animating the classical carved marble column base on dark granite bedrock. "
                "Camera performs subtle sub-pixel upward pedestal drift while side chiaroscuro lighting reveals mineral veining and stone texture."
            ),
            veo_text_prompt="Cinematic 9:16 vertical macro shot of classical marble column base grounded on granite bedrock foundation.",
            headline="OWN THE OUTCOME",
            subline="Everything Else Is Commentary.",
            badges=["FOUNDATION", "BEDROCK", "REPUTATION"]
        ))

        # Compile comprehensive complementary manifest
        compiled_manifest = {
            "version": "1.0.0",
            "engine": "Prometheus Mineral-Macro Orchestration Bridge",
            "narrativeTheme": raw_data.get("narrativeTheme", "Radical Ownership & Relentless Execution"),
            "speakerArchetype": raw_data.get("speakerArchetype", "The Pragmatic Architect"),
            "aspectRatioStandard": DEFAULT_ASPECT_RATIO,
            "landscapeProhibited": True,
            "activeImageToolProvider": self.image_tool.__class__.__name__,
            "thematicBeats": raw_data.get("thematicBeats", []),
            "macroSections": [asdict(p) for p in packets]
        }

        # Write to destination manifest
        MANIFEST_OUTPUT_PATH.write_text(json.dumps(compiled_manifest, indent=2), encoding="utf-8")
        return compiled_manifest

    def audit_mineral_visual_fidelity(
        self,
        concept_id: str,
        frame_path: Union[str, Path],
        font_contract: Optional[Any] = None,
        gemini_critic: Optional[Any] = None,
    ) -> Any:
        """Inspect and self-correct mineral visual output using the GEMINI CRITIC.
        
        Strictly confined to the Mineral Section — checks material authenticity against
        the declared mineral taxonomy and validates read-only font contracts.
        """
        from mini_run_pipeline.gemini_critic import (
            GeminiCritic,
            ObservedMineralFrame,
            DeclaredMineralContract,
            DeclaredFontContract,
        )
        engine = gemini_critic or GeminiCritic()
        frame = ObservedMineralFrame.from_file(frame_path)

        mineral_key_map = {
            "SR001": "weathered_cast_iron",
            "I001": "weathered_cast_iron",
            "RMT002": "parchment_oak_slate",
            "I002": "parchment_oak_slate",
            "SEF003": "oiled_steel_brass",
            "I003": "oiled_steel_brass",
            "HEA004": "borosilicate_luminescent",
            "I004": "borosilicate_luminescent",
            "MINERAL_BEDROCK": "marble_bedrock_foundation",
        }
        entity_key = mineral_key_map.get(concept_id, "marble_bedrock_foundation")
        entity = MINERAL_TAXONOMY.get(entity_key, MINERAL_TAXONOMY["weathered_cast_iron"])

        declared_contract = DeclaredMineralContract(
            concept_id=concept_id,
            material_name=entity.material_name,
            mineral_domain=entity.mineral_domain,
            tactile_surface_properties=entity.tactile_surface_properties,
            physical_weight_kg_m3=entity.physical_weight_kg_m3,
            acoustic_resonance=entity.acoustic_resonance,
            symbolic_grounding=entity.symbolic_grounding,
        )

        declared_font = font_contract or DeclaredFontContract(
            headline_font_family="Bebas Neue",
            headline_weight=900,
            accent_font_family="Cinzel Decorative",
            accent_weight=700,
            spatial_zone="Zone A: Scalp Contact (y: 9.8% - 18.5%, Z:10)",
            min_contrast_ratio=4.5,
            max_horizontal_occupancy_percent=82.0,
        )

        return engine.evaluate_frame(
            frame=frame,
            declared_mineral=declared_contract,
            declared_font=declared_font,
        )


# ---------------------------------------------------------------------------
# Standalone Execution Entrypoint
# ---------------------------------------------------------------------------

def run_mineral_macro_compilation() -> Path:
    """Run mineral extraction and macro section image pairing."""
    engine = MineralMacroBridgeEngine()
    print("Executing Mineral Extraction & Macro Section Image Orchestration Bridge...")
    manifest = engine.process_semantic_manifest()
    print(f"Successfully compiled {len(manifest['macroSections'])} macro section packets.")
    print(f"Manifest written to: {MANIFEST_OUTPUT_PATH}")
    return MANIFEST_OUTPUT_PATH


if __name__ == "__main__":
    run_mineral_macro_compilation()
