/**
 * PROMETHEUS CORE — CONCEPT-TO-PHYSICAL MANIFESTATION BRIDGE ENGINE
 * 
 * Maps abstract human concepts (ideas, anger, discipline, momentum, chaos, wealth)
 * into their canonical physical equivalents with emotional exigency scoring
 * and Doubting Thomas valence modulation.
 */

export type PhysicalDomain = 
  | "electrical_luminescence"   // Ideas, thoughts, insight, genius
  | "thermal_combustion"        // Anger, passion, burnout, heat, intensity
  | "mineral_architectural"     // Discipline, resilience, bedrock, foundation
  | "kinetic_aerospace"         // Speed, momentum, acceleration, velocity
  | "botanical_vitality"        // Growth, compounding, organic expansion
  | "entropic_interference"     // Chaos, bottleneck, breaking, confusion
  | "financial_monetary";       // Cash, wealth, valuation, revenue

export interface PhysicalAssetCandidate {
  id: string;
  name: string;
  domain: PhysicalDomain;
  physicalManifestation: string;
  keywords: string[];
  baseConfidence: number;
  exigencyTriggers: { intense: string[]; subtle: string[] };
  generator: (state: "thriving" | "negated_broken", intensity: number) => string;
  defaultPosition: "left_shoulder" | "right_shoulder" | "behind_head" | "center_stage";
  renderWidthPx: number;
  audioCue: string;
}

function toBase64Svg(svg: string): string {
  return "data:image/svg+xml;base64," + Buffer.from(svg.trim()).toString("base64");
}

// =============================================================================
// 1. PROCEDURAL PHYSICAL ASSET GENERATORS
// =============================================================================

// A. Vintage Edison Bulb & Synaptic Spark (Electrical / Luminescence)
export function generateEdisonBulbSvg(state: "thriving" | "negated_broken" = "thriving", intensity = 1.0): string {
  const isBroken = state === "negated_broken";
  const glowOpacity = isBroken ? 0.05 : Math.min(1.0, 0.45 * intensity);
  const filamentColor = isBroken ? "#475569" : "#FFE600";
  const glowColor = isBroken ? "transparent" : "#F59E0B";

  return toBase64Svg(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 280" width="240" height="280" fill="none">
  <defs>
    <radialGradient id="bulbGlow" cx="50%" cy="40%" r="50%">
      <stop offset="0%" stop-color="${glowColor}" stop-opacity="${glowOpacity}"/>
      <stop offset="60%" stop-color="${glowColor}" stop-opacity="${glowOpacity * 0.4}"/>
      <stop offset="100%" stop-color="${glowColor}" stop-opacity="0.0"/>
    </radialGradient>
    <filter id="filamentFilter" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <!-- Ambient Radiance Aura -->
  <circle cx="120" cy="110" r="100" fill="url(#bulbGlow)"/>
  <!-- Glass Bulb Outer Envelope -->
  <path d="M 80 180 C 60 160 50 130 50 100 C 50 60 80 30 120 30 C 160 30 190 60 190 100 C 190 130 180 160 160 180 Z" stroke="rgba(255,255,255,0.3)" stroke-width="2.5" fill="rgba(255,255,255,0.03)"/>
  <!-- Metallic Threaded Base -->
  <rect x="95" y="180" width="50" height="8" rx="2" fill="#94A3B8"/>
  <rect x="98" y="190" width="44" height="8" rx="2" fill="#64748B"/>
  <rect x="102" y="200" width="36" height="8" rx="2" fill="#475569"/>
  <path d="M 110 208 Q 120 216 130 208" fill="#1E293B"/>
  <!-- Tungsten Filament Coils -->
  <line x1="105" y1="180" x2="105" y2="120" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>
  <line x1="135" y1="180" x2="135" y2="120" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>
  <path d="M 105 120 C 105 85 135 85 135 120" stroke="${filamentColor}" stroke-width="3" fill="none" filter="url(#filamentFilter)"/>
  <!-- Filament Core Spark -->
  ${isBroken ? `
    <!-- Fracture Shatter Crack -->
    <path d="M 80 70 L 110 95 L 95 130 L 140 145" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="120" cy="100" r="4" fill="#64748B"/>
  ` : `
    <circle cx="120" cy="92" r="5" fill="#FFFFFF" filter="url(#filamentFilter)"/>
    <circle cx="120" cy="92" r="10" stroke="#FFE600" stroke-width="1.5" stroke-dasharray="3 3"/>
  `}
</svg>`);
}

// B. Combustion Flames & Thermal Embers (Thermal / Combustion / Anger / Passion)
export function generateCombustionFireSvg(intensity = 1.0): string {
  return toBase64Svg(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 280" width="240" height="280" fill="none">
  <defs>
    <linearGradient id="flameOuterGrad" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#DC2626"/>
      <stop offset="50%" stop-color="#EA580C"/>
      <stop offset="85%" stop-color="#F59E0B"/>
      <stop offset="100%" stop-color="#FFE600"/>
    </linearGradient>
    <linearGradient id="flameInnerGrad" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#F59E0B"/>
      <stop offset="60%" stop-color="#FFE600"/>
      <stop offset="100%" stop-color="#FFFFFF"/>
    </linearGradient>
    <filter id="fireGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <!-- Outer Raging Flame -->
  <path d="M 120 20 C 140 70 200 110 190 180 C 180 230 140 250 120 250 C 100 250 60 230 50 180 C 40 120 90 80 120 20 Z" fill="url(#flameOuterGrad)" filter="url(#fireGlow)" opacity="0.9"/>
  <!-- Secondary Flickering Tongue -->
  <path d="M 120 60 C 150 100 175 140 165 190 C 155 230 135 240 120 240 C 105 240 85 230 75 190 C 65 140 95 100 120 60 Z" fill="url(#flameOuterGrad)" opacity="0.95"/>
  <!-- Core White-Hot Heart -->
  <path d="M 120 120 C 135 150 150 170 145 205 C 140 230 130 235 120 235 C 110 235 100 230 95 205 C 90 170 105 150 120 120 Z" fill="url(#flameInnerGrad)" filter="url(#fireGlow)"/>
  <!-- Floating Thermal Ember Sparks -->
  <circle cx="90" cy="50" r="3" fill="#FFE600" filter="url(#fireGlow)"/>
  <circle cx="150" cy="40" r="4" fill="#F59E0B" filter="url(#fireGlow)"/>
  <circle cx="130" cy="15" r="2.5" fill="#FFFFFF"/>
</svg>`);
}

// C. Classical Marble Column & Bedrock Foundation (Mineral / Architectural / Discipline)
export function generateMarbleColumnSvg(state: "thriving" | "negated_broken" = "thriving"): string {
  const isBroken = state === "negated_broken";
  return toBase64Svg(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 280" width="240" height="280" fill="none">
  <defs>
    <linearGradient id="marbleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#E2E8F0"/>
      <stop offset="25%" stop-color="#F8FAFC"/>
      <stop offset="70%" stop-color="#CBD5E1"/>
      <stop offset="100%" stop-color="#94A3B8"/>
    </linearGradient>
    <filter id="pillarShadow">
      <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="rgba(0,0,0,0.6)"/>
    </filter>
  </defs>
  <!-- Capital (Top Crown) -->
  <rect x="50" y="30" width="140" height="16" rx="3" fill="url(#marbleGrad)" filter="url(#pillarShadow)"/>
  <rect x="65" y="46" width="110" height="12" rx="2" fill="url(#marbleGrad)"/>
  <!-- Fluted Shaft Columns -->
  <g filter="url(#pillarShadow)">
    <rect x="75" y="58" width="90" height="160" fill="url(#marbleGrad)"/>
    <line x1="90" y1="58" x2="90" y2="218" stroke="rgba(0,0,0,0.15)" stroke-width="3"/>
    <line x1="105" y1="58" x2="105" y2="218" stroke="rgba(0,0,0,0.15)" stroke-width="3"/>
    <line x1="120" y1="58" x2="120" y2="218" stroke="rgba(0,0,0,0.15)" stroke-width="3"/>
    <line x1="135" y1="58" x2="135" y2="218" stroke="rgba(0,0,0,0.15)" stroke-width="3"/>
    <line x1="150" y1="58" x2="150" y2="218" stroke="rgba(0,0,0,0.15)" stroke-width="3"/>
  </g>
  <!-- Plinth (Base Foundation) -->
  <rect x="65" y="218" width="110" height="12" rx="2" fill="url(#marbleGrad)"/>
  <rect x="45" y="230" width="150" height="20" rx="4" fill="url(#marbleGrad)" filter="url(#pillarShadow)"/>
  ${isBroken ? `
    <!-- Fracture Crack Line across column -->
    <path d="M 75 110 L 115 135 L 105 165 L 165 190" stroke="#EF4444" stroke-width="3" stroke-linecap="round"/>
  ` : ""}
</svg>`);
}

// =============================================================================
// 2. THE CONCEPT TAXONOMY REGISTRY
// =============================================================================

export const CONCEPT_PHYSICAL_REGISTRY: PhysicalAssetCandidate[] = [
  // 1. IDEAS / INTELLECT
  {
    id: "concept_edison_bulb",
    name: "Vintage Incandescent Edison Bulb (Idea / Breakthrough)",
    domain: "electrical_luminescence",
    physicalManifestation: "Edison filament glass bulb with electrical ionization glow",
    keywords: ["idea", "ideas", "genius", "insight", "brainstorm", "concept", "thesis", "clarity", "philosophy", "discovery"],
    baseConfidence: 0.96,
    exigencyTriggers: {
      intense: ["breakthrough", "genius", "revolutionary", "brilliant", "eureka", "mastery"],
      subtle: ["small idea", "thought", "maybe", "consider", "option"]
    },
    generator: (state, intensity) => generateEdisonBulbSvg(state, intensity),
    defaultPosition: "right_shoulder",
    renderWidthPx: 210,
    audioCue: "Electrical Incandescent Filament Hum & Chime (Z:10, 2400Hz)"
  },

  // 2. ANGER / PASSION / BURNOUT
  {
    id: "concept_combustion_fire",
    name: "Combustion Fire & Thermal Flare (Anger / Passion / Burnout)",
    domain: "thermal_combustion",
    physicalManifestation: "Raging combustion flames with rising thermal ember particles",
    keywords: ["anger", "angry", "furious", "passion", "burnout", "burning", "fire", "heat", "rage", "intense", "fury", "flame"],
    baseConfidence: 0.97,
    exigencyTriggers: {
      intense: ["burning through", "furious", "exhaustion", "raging", "exploded", "crisis"],
      subtle: ["warm", "passionate", "mild anger", "frustration"]
    },
    generator: (_state, intensity) => generateCombustionFireSvg(intensity),
    defaultPosition: "behind_head",
    renderWidthPx: 220,
    audioCue: "Thermal Combustion Roar & Spark Crackle (Z:10, 650Hz)"
  },

  // 3. DISCIPLINE / RESILIENCE
  {
    id: "concept_marble_pillar",
    name: "Classical Ionic Marble Column (Discipline / Resilience / Foundation)",
    domain: "mineral_architectural",
    physicalManifestation: "Solid carved fluted marble pillar grounded on bedrock plinth",
    keywords: ["discipline", "resilience", "foundation", "structure", "unshakeable", "principles", "bedrock", "conviction", "stand firm"],
    baseConfidence: 0.94,
    exigencyTriggers: {
      intense: ["unbreakable", "bedrock", "cornerstone", "ironclad", "absolute"],
      subtle: ["routine", "habit", "consistent"]
    },
    generator: (state) => generateMarbleColumnSvg(state),
    defaultPosition: "left_shoulder",
    renderWidthPx: 200,
    audioCue: "Deep Monolithic Stone Impact Resonance (Z:10, 450Hz)"
  }
];

// =============================================================================
// 3. AUTONOMOUS CONCEPT EXTRACTOR & EXIGENCY EVALUATOR
// =============================================================================

export interface ResolvedConceptBridge {
  matchedCandidate: PhysicalAssetCandidate;
  confidenceScore: number;
  exigencyLevel: "subtle" | "standard" | "intense_visceral";
  computedIntensity: number;
  renderedSvgUri: string;
}

export function extractAndBridgeConcept(
  chunkText: string,
  surroundingContext = "",
  isDoubtingThomasNegated = false
): ResolvedConceptBridge | null {
  const currentLower = chunkText.toLowerCase();
  const contextLower = (chunkText + " " + surroundingContext).toLowerCase();

  for (const candidate of CONCEPT_PHYSICAL_REGISTRY) {
    const matchedWord = candidate.keywords.find(kw => new RegExp(`(^|[^a-z])${kw}([^a-z]|$)`, "i").test(currentLower));
    if (matchedWord) {
      // Evaluate Exigency from context
      let exigencyLevel: "subtle" | "standard" | "intense_visceral" = "standard";
      let intensity = 1.0;

      if (candidate.exigencyTriggers.intense.some(t => contextLower.includes(t))) {
        exigencyLevel = "intense_visceral";
        intensity = 1.6;
      } else if (candidate.exigencyTriggers.subtle.some(t => contextLower.includes(t))) {
        exigencyLevel = "subtle";
        intensity = 0.65;
      }

      const state = isDoubtingThomasNegated ? "negated_broken" : "thriving";
      const svg = candidate.generator(state, intensity);

      return {
        matchedCandidate: candidate,
        confidenceScore: candidate.baseConfidence,
        exigencyLevel,
        computedIntensity: intensity,
        renderedSvgUri: svg
      };
    }
  }

  return null;
}
