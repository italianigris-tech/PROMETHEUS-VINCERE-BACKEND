/**
 * PROMETHEUS CORE — DOGMA ART STYLE ENGINE & BESPOKE ASSET REGISTRY
 * 
 * Invariant visual dogma derived from authoritative style paradigms:
 * 1. Vintage Monochrome Halftone Line Scan (Style #01)
 * 2. Classical Stoic Marble Sculpture Juxtaposition (Style #02)
 * 3. Anatomical Vintage Scientific Engraving (Style #03)
 * 4. Circular Spotlight Vignette Lighting Post-Treatment (Treatment #04)
 * 5. Impasto Palette-Knife Textured Oil Painting (Style #05)
 * 6. Stylized 3D Polygonal / Arcane Cel-Shaded (Style #06)
 * 7. High-Contrast Duotone Graphic Noir Vector (Style #07)
 * 8. Textured Grungy Noir Silhouette Film Poster (Style #08)
 * 
 * CRITICAL ARCHITECTURAL CONTRACT:
 * Reference screenshots serve strictly as stylistic dogma and inspiration.
 * All on-stage visual assets are BESPOKE GENERATED ARTIFACTS embodying these styles.
 */

export interface DogmaArtStyle {
  id: string;
  name: string;
  aestheticCategory: string;
  promptDescriptor: string;
  shaderFilterCss: string;
  vignetteTreatment: boolean;
}

export const DOGMA_ART_STYLES: DogmaArtStyle[] = [
  {
    id: "style_01_vintage_halftone",
    name: "Vintage Monochrome Halftone Line Scan",
    aestheticCategory: "halftone_lithograph",
    promptDescriptor: "High-contrast monochrome lithograph engraving with horizontal scanline raster and fine halftone screen on pure black backdrop",
    shaderFilterCss: "contrast(1.4) grayscale(1) drop-shadow(0 12px 24px rgba(0,0,0,0.8))",
    vignetteTreatment: false
  },
  {
    id: "style_02_stoic_marble",
    name: "Classical Stoic Marble Sculpture Juxtaposition",
    aestheticCategory: "classical_sculpture",
    promptDescriptor: "Greco-Roman classical carved marble philosopher bust with modern technology, dramatic soft studio directional key lighting, photorealistic marble grain",
    shaderFilterCss: "contrast(1.15) brightness(1.05) drop-shadow(0 16px 36px rgba(0,0,0,0.7))",
    vignetteTreatment: true
  },
  {
    id: "style_03_anatomical_engraving",
    name: "Anatomical Vintage Scientific Engraving",
    aestheticCategory: "vintage_engraving",
    promptDescriptor: "Detailed vintage medical/botanical atlas copperplate engraving, fine cortical gyri linework, intricate cross-hatching and stipple shading",
    shaderFilterCss: "contrast(1.3) drop-shadow(0 10px 25px rgba(0,0,0,0.75))",
    vignetteTreatment: false
  },
  {
    id: "style_04_spotlight_vignette",
    name: "Circular Spotlight Vignette Lighting Post-Treatment",
    aestheticCategory: "post_treatment_lighting",
    promptDescriptor: "Dramatic radial stage spotlight, high-contrast falloff, deep royal navy/charcoal ambient shadow, intense focal illumination",
    shaderFilterCss: "contrast(1.25) brightness(1.1) drop-shadow(0 20px 40px rgba(0,0,0,0.9))",
    vignetteTreatment: true
  },
  {
    id: "style_05_impasto_oil",
    name: "Impasto Palette-Knife Textured Oil Painting",
    aestheticCategory: "expressive_oil",
    promptDescriptor: "Expressive palette knife oil portrait, thick textured impasto paint strokes, heavy visible pigment ridges, vibrant cadmium contrast",
    shaderFilterCss: "contrast(1.2) saturate(1.3) drop-shadow(0 14px 30px rgba(0,0,0,0.75))",
    vignetteTreatment: true
  },
  {
    id: "style_06_stylized_3d_arcane",
    name: "Stylized 3D Polygonal / Arcane Cel-Shaded",
    aestheticCategory: "stylized_3d",
    promptDescriptor: "Sharp faceted polygonal planes, cinematic angular rim lighting, highly stylized character design, deep atmospheric shadows",
    shaderFilterCss: "contrast(1.2) brightness(1.05) drop-shadow(0 16px 32px rgba(0,0,0,0.85))",
    vignetteTreatment: false
  },
  {
    id: "style_07_duotone_noir_vector",
    name: "High-Contrast Duotone Graphic Noir Vector",
    aestheticCategory: "duotone_graphic",
    promptDescriptor: "Vibrant crimson red duotone, bold black shadow silhouettes, clean graphic novel line weight, minimal modern silhouette",
    shaderFilterCss: "contrast(1.35) saturate(1.4) drop-shadow(0 12px 28px rgba(0,0,0,0.8))",
    vignetteTreatment: false
  },
  {
    id: "style_08_grungy_film_poster",
    name: "Textured Grungy Noir Silhouette Film Poster",
    aestheticCategory: "grungy_noir",
    promptDescriptor: "Gritty charcoal texture, atmospheric dark side-profile silhouette against vibrant crimson backdrop, distressed ink brushwork",
    shaderFilterCss: "contrast(1.3) saturate(1.2) drop-shadow(0 18px 35px rgba(0,0,0,0.85))",
    vignetteTreatment: true
  }
];

export interface DogmaAssetCandidate {
  id: string;
  name: string;
  conceptCluster: "idea" | "founder" | "money" | "results" | "breaking" | "discipline" | "momentum";
  artStyleId: string;
  imageFilePath: string;
  valenceAffinity: "positive" | "negative_rejection" | "neutral";
  baseWeight: number;
  widthPx: number;
  position: "left_shoulder" | "right_shoulder" | "behind_head" | "center_stage";
}

export const DOGMA_ASSET_REGISTRY: DogmaAssetCandidate[] = [
  // BESPOKE ZERO-BACKGROUND MATTED IDEA ASSETS
  {
    id: "bespoke_idea_stoic_monument",
    name: "Classical Stoic Philosopher Pondering Glowing Filament Monument (Dogma Style #02)",
    conceptCluster: "idea",
    artStyleId: "style_02_stoic_marble",
    imageFilePath: "docs/mini_run_studio/assets/idea_stoic_monument_matted.png",
    valenceAffinity: "positive",
    baseWeight: 3.5,
    widthPx: 235,
    position: "left_shoulder"
  },
  {
    id: "bespoke_idea_engraved_synapse",
    name: "Anatomical Atlas Copperplate Synaptic Luminous Brain (Dogma Style #03)",
    conceptCluster: "idea",
    artStyleId: "style_03_anatomical_engraving",
    imageFilePath: "docs/mini_run_studio/assets/idea_engraved_synapse_matted.png",
    valenceAffinity: "positive",
    baseWeight: 3.2,
    widthPx: 220,
    position: "right_shoulder"
  },
  {
    id: "bespoke_idea_vintage_halftone",
    name: "Vintage Halftone Lithograph Palm & Glowing Brain Bulb (Dogma Style #01)",
    conceptCluster: "idea",
    artStyleId: "style_01_vintage_halftone",
    imageFilePath: "docs/mini_run_studio/assets/idea_vintage_halftone_matted.png",
    valenceAffinity: "positive",
    baseWeight: 2.8,
    widthPx: 215,
    position: "right_shoulder"
  },

  // NOTABLE TECH FOUNDER TAXONOMY (ZERO-BACKGROUND MATTED)
  {
    id: "bespoke_founder_arcane_executive",
    name: "Notable Silicon Founder / Jensen Huang Archetype (Dogma Style #06)",
    conceptCluster: "founder",
    artStyleId: "style_06_stylized_3d_arcane",
    imageFilePath: "docs/mini_run_studio/assets/founder_arcane_executive_matted.png",
    valenceAffinity: "neutral",
    baseWeight: 3.5,
    widthPx: 240,
    position: "behind_head"
  },
  {
    id: "bespoke_founder_impasto_oil",
    name: "Notable Visionary AI Founder / Sam Altman Archetype (Dogma Style #05)",
    conceptCluster: "founder",
    artStyleId: "style_05_impasto_oil",
    imageFilePath: "docs/mini_run_studio/assets/founder_impasto_oil_matted.png",
    valenceAffinity: "neutral",
    baseWeight: 3.2,
    widthPx: 235,
    position: "behind_head"
  },
  {
    id: "bespoke_founder_duotone_noir",
    name: "Notable Frontier Pioneer / Elon Musk Archetype (Dogma Style #07)",
    conceptCluster: "founder",
    artStyleId: "style_07_duotone_noir_vector",
    imageFilePath: "docs/mini_run_studio/assets/founder_duotone_noir_matted.png",
    valenceAffinity: "neutral",
    baseWeight: 3.0,
    widthPx: 235,
    position: "behind_head"
  },
  {
    id: "bespoke_founder_tech_trio",
    name: "Notable Silicon Valley Pioneers Trio (Dogma Style #01)",
    conceptCluster: "founder",
    artStyleId: "style_01_vintage_halftone",
    imageFilePath: "docs/mini_run_studio/assets/tech_founders_matted.png",
    valenceAffinity: "neutral",
    baseWeight: 2.7,
    widthPx: 245,
    position: "behind_head"
  }
];

/**
 * Dynamic Dogma Asset Selector with History Context & Novelty Penalties
 */
export function selectDogmaAsset(
  conceptCluster: "idea" | "founder" | "money" | "results" | "breaking" | "discipline" | "momentum",
  valence: "positive" | "negative_rejection" | "neutral",
  usageHistory: Record<string, number> = {},
  rng: () => number = Math.random
): DogmaAssetCandidate | null {
  const candidates = DOGMA_ASSET_REGISTRY.filter(c => c.conceptCluster === conceptCluster);
  if (candidates.length === 0) return null;

  const scored = candidates.map(c => {
    const usage = usageHistory[c.id] || 0;
    const historyPenalty = Math.pow(0.12, usage);
    const valenceBoost = (c.valenceAffinity === valence || c.valenceAffinity === "neutral") ? 1.3 : 0.8;
    const weight = c.baseWeight * historyPenalty * valenceBoost * (0.85 + rng() * 0.3);
    return { candidate: c, weight };
  });

  const totalWeight = scored.reduce((sum, s) => sum + s.weight, 0);
  if (totalWeight <= 0) return candidates[0];

  let r = rng() * totalWeight;
  for (const s of scored) {
    if (r <= s.weight) return s.candidate;
    r -= s.weight;
  }

  return scored[0].candidate;
}
