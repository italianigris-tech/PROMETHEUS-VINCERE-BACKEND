import fs from "fs";
import path from "path";

export interface ArchetypeSignal {
  archetypeId: number;
  archetypeSerial: string;
  archetypeName: string;
  category: string;
  confidence: number; // 0.0 to 1.0
  reason: string;
  matchedTokens: string[];
  recommendedPreset: string;
  assetRealizationWorkflow?: string;
  audioCue: string;
}

export interface CompoundRoutingResult {
  rawStatement: string;
  primaryArchetype: ArchetypeSignal;
  secondaryArchetypes: ArchetypeSignal[];
  isCompound: boolean;
  compoundDescription: string;
  compositionLayering: {
    z10_backgroundAsset: string | null;
    z20_speakerClearance: string;
    z30_foregroundTypography: string;
    spatialAudioMapping: {
      pan: number; // -1.0 to 1.0
      cutoffHz: number;
      soundCue: string;
    };
  };
  extractedEntities: {
    brands: string[];
    concreteTools: string[];
    abstractConcepts: string[];
    humanRoles: string[];
    metrics: string[];
    percentages: string[];
    timeMarkers: string[];
    contrastPairs: string[];
    steps: string[];
  };
}

// 1. GENERALIZED LINGUISTIC & ENTITY KNOWLEDGE TAXONOMIES (AVOIDING OVERFITTING)
const BRAND_ENTITIES = [
  "google", "instagram", "tesla", "apple", "microsoft", "amazon", "ebay", "meta", "facebook", "twitter", "x",
  "stripe", "openai", "chatgpt", "github", "figma", "vercel", "shopify", "notion", "slack", "discord",
  "youtube", "tiktok", "netflix", "uber", "airbnb", "spotify", "nvidia", "anthropic", "claude", "remotion"
];

const CONCRETE_TOOL_AND_UTILITY_ENTITIES = [
  "tool", "tools", "screwdriver", "spanner", "wrench", "hammer", "pliers", "gear", "gears",
  "machinery", "hardware", "software", "instrument", "instruments", "engine", "calculator",
  "compiler", "terminal", "debugger", "workbench", "stack", "toolkit", "apparatus", "gadget"
];

const CONCEPT_AND_COGNITIVE_ENTITIES = [
  "idea", "ideas", "strategy", "strategies", "focus", "vision", "clarity", "matters",
  "discipline", "leverage", "momentum", "principle", "principles", "mindset", "philosophy",
  "thesis", "priorities", "conviction"
];

const HUMAN_ROLE_AND_CHARACTER_ENTITIES = [
  "founder", "founders", "customer", "customers", "user", "users", "client", "clients",
  "developer", "developers", "engineer", "engineers", "designer", "designers", "creator",
  "creators", "leader", "leaders", "ceo", "cto", "doctor", "specialist"
];

const CYCLICAL_AND_COMPOUNDING_ENTITIES = [
  "repeatedly", "again and again", "flywheel", "cycle", "loop", "compounding",
  "iteratively", "feedback loop", "recurring", "compound", "compound interest", "iteration"
];

const GEO_LOCATIONS = [
  "lagos", "london", "new york", "san francisco", "tokyo", "paris", "berlin", "singapore",
  "dubai", "nigeria", "uk", "usa", "europe", "africa", "asia", "america", "sydney", "toronto"
];

const COMPARISON_KEYWORDS = [
  "versus", "vs", "compared to", "in contrast", "while", "difference between",
  "rather than", "instead of", "on the other hand", "unlike", "contrary to",
  "doesn't come from", "doesn't automatically", "not freedom"
];

const BEFORE_AFTER_KEYWORDS = [
  "before and after", "before", "after", "previously", "now", "transformed", "used to be",
  "started with", "ended up", "evolved from", "prior to"
];

const TIMELINE_KEYWORDS = [
  "first", "second", "then", "later", "eventually", "timeline", "years ago", "in 2020", "in 2024",
  "months later", "step by step", "over time", "milestone", "yesterday", "tomorrow", "history", "decided"
];

const PROCESS_WORKFLOW_KEYWORDS = [
  "process", "workflow", "system", "steps", "funnel", "customer enters", "pipeline", "stage 1",
  "how it works", "mechanism", "protocol", "framework", "lifecycle", "producing results"
];

const FINANCIAL_KEYWORDS = [
  "revenue", "profit", "mrr", "arr", "cashflow", "valuation", "investment", "dollars", "capital",
  "income", "costs", "expenses", "margins", "crypto", "trading", "stock", "sales", "money"
];

// Helper to check whole-word matching
function matchTokens(list: string[], text: string): string[] {
  return list.filter(item => new RegExp(`\\b${item}\\b`, 'i').test(text));
}

// 2. AUTHORITATIVE ROUTER FUNCTION
export function routeStatementToArchetypes(statement: string): CompoundRoutingResult {
  const text = statement.trim();
  const lower = text.toLowerCase();
  const tokens = lower.split(/[\s,.;:!?]+/).filter(t => t.length > 0);

  const signals: ArchetypeSignal[] = [];

  // Entity Taxonomy Extractions with strict word boundaries
  const matchedBrands = matchTokens(BRAND_ENTITIES, text);
  const matchedTools = matchTokens(CONCRETE_TOOL_AND_UTILITY_ENTITIES, text);
  const matchedConcepts = matchTokens(CONCEPT_AND_COGNITIVE_ENTITIES, text);
  const matchedRoles = matchTokens(HUMAN_ROLE_AND_CHARACTER_ENTITIES, text);
  const matchedCycles = matchTokens(CYCLICAL_AND_COMPOUNDING_ENTITIES, text);
  const matchedGeos = matchTokens(GEO_LOCATIONS, text);
  
  // Numerical extractions
  const moneyMatch = text.match(/\$[\d,]+(\.\d+)?(\s*(k|m|b|thousand|million|billion|a month|per month))?|\b(six figures|seven figures|six-figure)\b/gi);
  const percentMatch = text.match(/\b\d+(\.\d+)?%/g) || (lower.includes("percent") ? ["percentage"] : []);
  const standaloneNumbers = text.match(/\b\d+([,.]\d+)?\b/g);

  // --- ARCHETYPE 02: MICRO ASSET / CONCRETE TOOL & BRAND ENTITIES ---
  if (matchedTools.length > 0) {
    signals.push({
      archetypeId: 2,
      archetypeSerial: "02",
      archetypeName: "Micro Asset (Concrete Tool / Utility Icon)",
      category: "artifacts",
      confidence: 0.95,
      reason: `Concrete physical/digital utility instrument detected: "${matchedTools.join(", ")}"`,
      matchedTokens: matchedTools,
      recommendedPreset: "MICRO #01 (Mechanical Gear / Screwdriver / Spanner Vector Tool Asset)",
      assetRealizationWorkflow: "1. Tokenizer extracts 'tool' -> 2. Vector Registry resolves canonical wrench/screwdriver/gear SVG -> 3. Parametric 60fps stroke drawing physics -> 4. Depth plane placement (Z:10 / Z:30) outside 14.79% scalp box.",
      audioCue: "HUD Optical Ping & Mechanical Ratchet Click (Z:10, 1400Hz)"
    });
  } else if (matchedBrands.length > 0) {
    signals.push({
      archetypeId: 2,
      archetypeSerial: "02",
      archetypeName: "Micro Asset (Brand / Corporate Logo)",
      category: "artifacts",
      confidence: Math.min(1.0, 0.6 + matchedBrands.length * 0.2),
      reason: `Detected recognizable brand/company entity token(s): ${matchedBrands.join(", ")}`,
      matchedTokens: matchedBrands,
      recommendedPreset: "MICRO #01 (Dynamic Vector Brand Badge)",
      assetRealizationWorkflow: "1. Brand token lookup -> 2. Load official vector SVG asset -> 3. Ambient glow bloom -> 4. Z:10 background anchoring.",
      audioCue: "HUD Optical Ping (Z:10, 1400Hz)"
    });
  }

  // --- ARCHETYPE 49: LOOP / CYCLE & FLYWHEEL ---
  if (matchedCycles.length > 0) {
    signals.push({
      archetypeId: 49,
      archetypeSerial: "49",
      archetypeName: "Loop / Cycle (Compounding Orbital Flywheel)",
      category: "processes",
      confidence: 0.98,
      reason: `Compounding cadence & feedback loop detected: "${matchedCycles.join(", ")}"`,
      matchedTokens: matchedCycles,
      recommendedPreset: "LOOP #01 (Compounding Orbital Flywheel Loop)",
      assetRealizationWorkflow: "1. Cyclic cadence detected -> 2. Load 3-node compounding flywheel orbital mesh -> 3. 60fps continuous angular velocity rotation -> 4. Sub-bass harmonic drone.",
      audioCue: "Harmonic Sub-Bass Flywheel Drone (Z:10, 1200Hz)"
    });
  }

  // --- ARCHETYPE 23: CONCEPT VISUALIZATION ---
  if (matchedConcepts.length > 0) {
    const isFocus = matchedConcepts.some(c => c === "focus" || c === "matters" || c === "priorities");
    const isIdea = matchedConcepts.some(c => c === "idea" || c === "ideas");
    const isStrategy = matchedConcepts.some(c => c === "strategy" || c === "strategies");

    const assetName = isFocus ? "Precision Focus Target HUD & Crosshair" :
                      isIdea ? "Radiant Synapse / Lightbulb Burst Token" :
                      isStrategy ? "Strategic Chess Knight & Compass Node" : "Abstract Vector Concept Mesh";

    signals.push({
      archetypeId: 23,
      archetypeSerial: "23",
      archetypeName: "Concept Visualization",
      category: "communication",
      confidence: 0.92,
      reason: `Abstract mental principle or strategic token detected: "${matchedConcepts.join(", ")}"`,
      matchedTokens: matchedConcepts,
      recommendedPreset: `CONCEPT #01 (${assetName})`,
      assetRealizationWorkflow: `1. Extract abstract concept token -> 2. Map to semantic archetype visual metaphor (${assetName}) -> 3. Render 60fps HUD pulse.`,
      audioCue: "HUD Optical Scan Ping (Z:10, 1400Hz)"
    });
  }

  // --- ARCHETYPE 15: PERSON / CHARACTER ASSET (MASTER PERSONA SUITE) ---
  if (matchedRoles.length > 0) {
    let recommendedPreset = "PERSON #01 (Corporate Masked Suit on Rounded Blue Card - Ref Screenshot 01)";
    if (lower.includes("sticker") || lower.includes("bucket hat") || lower.includes("cutout") || lower.includes("head")) {
      recommendedPreset = "PERSON #02 (Die-Cut Sticker Head Cutout with Parallax Bob - Ref Screenshot 02)";
    } else if (lower.includes("noir") || lower.includes("red") || lower.includes("beard") || lower.includes("shadow")) {
      recommendedPreset = "PERSON #03 (Graphic Noir Angular Vector Portrait - Ref Screenshot 03 Red)";
    } else if (lower.includes("headphones") || lower.includes("beanie") || lower.includes("3d") || lower.includes("pixar")) {
      recommendedPreset = "PERSON #04 (3D Stylized Studio Persona with Headphones - Ref Screenshot 03 Blue)";
    } else if (lower.includes("anime") || lower.includes("glasses") || lower.includes("purple") || lower.includes("line art")) {
      recommendedPreset = "PERSON #05 (Cel-Shaded Line-Art Anime Persona - Ref Screenshot 03 Purple)";
    } else if (lower.includes("phone") || lower.includes("smartphone") || lower.includes("sweater") || lower.includes("felt")) {
      recommendedPreset = "PERSON #06 (Tactile 3D Felt & Knit Character - Ref Screenshot 03 Cyan)";
    }

    signals.push({
      archetypeId: 15,
      archetypeSerial: "15",
      archetypeName: "Person / Character Asset",
      category: "artifacts",
      confidence: 0.94,
      reason: `Human archetype / professional role setup detected: "${matchedRoles.join(", ")}"`,
      matchedTokens: matchedRoles,
      recommendedPreset,
      assetRealizationWorkflow: "Asset Realization: Card Squircle Spring -> Suited / Stylized Body Entry -> Specular Face Mask / Sticker Pop -> Vocal Resonance SFX",
      audioCue: "Avatar Pop Acoustic Resonance & Ambient Studio Presence (Z:20, 6500Hz)"
    });
  }

  // --- ARCHETYPE 03: LIST / ENUMERATION ---
  const hasNumberedList = /\b(1\.|2\.|3\.|first|second|third|one|two|three|1st|2nd|3rd)\b/i.test(text);
  const hasCommaEnumeration = (text.split(',').length >= 3) || (text.includes(" and ") && text.split(',').length >= 2);
  const isPillarMention = lower.includes("pillar") || lower.includes("foundation") || lower.includes("principles");
  if (hasNumberedList || hasCommaEnumeration || isPillarMention) {
    const recommendedPreset = isPillarMention 
      ? "LIST #06 (5-Pillar Monumental Architectural Framework)" 
      : (hasNumberedList ? "LIST #01 (3D Cylindrical Carousel Deck)" : "LIST #02 (Vertical Item Stack & Dynamic Pill Highlight)");

    signals.push({
      archetypeId: 3,
      archetypeSerial: "03",
      archetypeName: "List / Enumeration",
      category: "structures",
      confidence: isPillarMention ? 0.96 : (hasNumberedList ? 0.95 : 0.85),
      reason: isPillarMention 
        ? "Architectural foundational framework / pillar enumeration" 
        : (hasNumberedList ? "Explicit sequential or numbered list markers" : "Multi-item sequence / enumeration"),
      matchedTokens: isPillarMention ? ["pillar", "framework"] : (hasNumberedList ? ["numbered list tokens"] : ["multi-item sequence"]),
      recommendedPreset,
      assetRealizationWorkflow: isPillarMention
        ? "Asset Realization: Vector Sourcing -> 5 Fluted Classical Marble Columns with Doric/Ionic/Corinthian Capitals -> Render Deep Royal Blue Studio Gradient Backdrop (Z:10) -> Independent Damped Rise Animation (Z:10..Z:30) with Floating Strategy Icons"
        : "Asset Realization: Dynamic List Planner -> 3D Cylindrical Perspective Carousel or Number Swap Cards -> Staggered Gaussian Blur Word Reveals -> Ratchet SFX Linkage",
      audioCue: "Mechanical Ratchet Clicks & Orchestral Pillar Rises (Z:30, 18500Hz)"
    });
  }

  // --- ARCHETYPE 04: CHART / GRAPH (MASTER VECTOR TRAJECTORY SUITE) ---
  const chartKeywords = [
    "went from", "grew from", "increased from", "dropped to", "trend", "graph", "curve",
    "trajectory", "plunged", "skyrocketed", "market size", "downtrend", "uptrend", "crash",
    "selloff", "volatility", "waveform", "candlestick", "drawdown", "exponential"
  ];
  const matchedChart = chartKeywords.filter(k => lower.includes(k));
  const isDowntrend = lower.includes("drop") || lower.includes("crash") || lower.includes("plunge") || lower.includes("downtrend") || lower.includes("selloff") || lower.includes("drawdown");
  const isWave = lower.includes("wave") || lower.includes("volatility") || lower.includes("cycle");
  const isMarketSize = lower.includes("market size") || lower.includes("billion");

  if (matchedChart.length > 0 || (moneyMatch && moneyMatch.length >= 2)) {
    let recommendedPreset = "CHART #01 (Exponential Bullish Parabolic Uptrend)";
    if (isDowntrend) {
      recommendedPreset = lower.includes("grid") 
        ? "CHART #05 (Bearish Selloff Crash Area Grid)" 
        : "CHART #06 (Crimson Laser Downtrend Arrow with Sequential Vertex Beacons)";
    } else if (isWave) {
      recommendedPreset = "CHART #02 (Harmonic Volatility Spline & Downward Fall)";
    } else if (lower.includes("mountain")) {
      recommendedPreset = "CHART #07 (High-Voltage Neon Emerald Bullish Mountain)";
    } else if (lower.includes("energy") || lower.includes("kwh") || lower.includes("apex")) {
      recommendedPreset = "CHART #03 (Neon Telemetry Laser Spline & Apex Tooltip Callout)";
    } else if (lower.includes("spectrum") || lower.includes("candlestick")) {
      recommendedPreset = "CHART #08 (Minimalist Candlestick Frequency Spectrum)";
    }

    signals.push({
      archetypeId: 4,
      archetypeSerial: "04",
      archetypeName: "Chart / Graph (Master Vector Trajectory Suite)",
      category: "metrics",
      confidence: 0.96,
      reason: `Quantitative trajectory/trend transition detected (${matchedChart.join(", ") || "multiple data points"})`,
      matchedTokens: matchedChart,
      recommendedPreset,
      assetRealizationWorkflow: isDowntrend
        ? "Asset Realization: Crimson Drawdown Shader -> Render Geometric Grid Lattice & Laser Vertices -> Animate Cascading Slope Wipe (Z:10 / Z:30) with Drawdown SFX"
        : "Asset Realization: Transparent Vector Spline -> Render Lime/Emerald Area Underglow -> Staggered Milestone Drop Lines (50k, 70k, 80만) & Apex Beacon Ping",
      audioCue: isDowntrend ? "Heavy Drawdown Sweep & Sub-Bass Thud (Z:30, 12000Hz)" : "Telemetry Optical Ping & Harmonic Resonance (Z:30, 16000Hz)"
    });
  }

  // --- ARCHETYPE 05: NUMBER / STATISTIC (DYNAMIC KINETIC NUMBER SUITE) ---
  if (moneyMatch && moneyMatch.length > 0 && !matchedChart.length) {
    const isRoundMetric = moneyMatch.some(m => m.includes("000") || m.includes("00"));
    const recommendedPreset = isRoundMetric 
      ? "NUM #03 (Mechanical Slanted Zeroes with Elastic Rebound Bounce)"
      : "NUM #04 (Domino Falling Zero Physics Knock)";

    signals.push({
      archetypeId: 5,
      archetypeSerial: "05",
      archetypeName: "Number / Statistic (Dynamic Kinetic Number & Counter Suite)",
      category: "metrics",
      confidence: 0.96,
      reason: `Prominent standalone financial metric or stat: ${moneyMatch.join(", ")}`,
      matchedTokens: moneyMatch,
      recommendedPreset,
      assetRealizationWorkflow: "Asset Realization: Rapid Multi-Digit Ticker -> Staggered Elastic Overshoot -> Slanted Zeroes & Bounce/Domino Cascade -> Sub-Bass Impact Boom",
      audioCue: "Sub-Bass Heavy Impact Climax & Mechanical Snap (Z:30, 18500Hz)"
    });
  } else if (standaloneNumbers && standaloneNumbers.length > 0 && !percentMatch.length && !matchedChart.length) {
    const isSingleDigit = standaloneNumbers.some(n => n.length === 1);
    const isMultiDigit = standaloneNumbers.some(n => n.length >= 2);
    const recommendedPreset = isSingleDigit 
      ? "NUM #01 (Liquid Velocity Smear with Glitch Drop & Shockwave Ring - Ref Screenshot 01)"
      : (isMultiDigit ? "NUM #02 (Staggered Multi-Reel Vertical Slot Tumbler - Ref Screenshot 02)" : "NUM #05 (Staggered Per-Digit Drop-In with DoF Rack Focus)");

    signals.push({
      archetypeId: 5,
      archetypeSerial: "05",
      archetypeName: "Number / Statistic (Dynamic Kinetic Number & Counter Suite)",
      category: "metrics",
      confidence: 0.88,
      reason: `Numerical figures detected: ${standaloneNumbers.join(", ")}`,
      matchedTokens: standaloneNumbers,
      recommendedPreset,
      assetRealizationWorkflow: isSingleDigit
        ? "Asset Realization: Directional Gaussian Smear Filter -> Liquid Flare Upper-Left Offset -> Luminous White Glyphs with Subpixel Bleed -> Velocity Snap"
        : "Asset Realization: Independent Digit Slot Columns -> Asynchronous Vertical Transit with Motion Blur -> Elastic Overshoot Snapping",
      audioCue: "Subpixel Ratchet Clicks & Velocity Smear Whoosh (Z:30, 14000Hz)"
    });
  }

  // --- ARCHETYPE 06: PERCENTAGE (DYNAMIC RADIAL DIAL, 3D ORB & HORIZON SUITE) ---
  if (percentMatch.length > 0) {
    const rawVal = parseFloat(percentMatch[0].replace(/[^0-9.]/g, ""));
    let recommendedPreset = "PCT #01 (Radial Multi-Tick Dynamic Dial Percentage Counter)";
    if (lower.includes("sphere") || lower.includes("orb") || lower.includes("needle") || rawVal === 87) {
      recommendedPreset = "PCT #04 (Luminescent Sphere Orb Gauge with Specular Ray Needle - Ref Screenshot 01)";
    } else if (lower.includes("horizon") || lower.includes("eclipse") || rawVal >= 200) {
      recommendedPreset = "PCT #05 (Celestial Horizon Glow & Hairline Eclipse Percentage - Ref Screenshot 02)";
    } else if (lower.includes("polar") || lower.includes("arc") || percentMatch[0].startsWith("+")) {
      recommendedPreset = "PCT #02 (Polar Arc Neon Progress Gauge with Specular Apex Pip)";
    } else if (lower.includes("punch") || lower.includes("shockwave")) {
      recommendedPreset = "PCT #03 (Kinetic Punch-In Percentage with Shockwave Ring)";
    }

    signals.push({
      archetypeId: 6,
      archetypeSerial: "06",
      archetypeName: "Percentage (Radial Tick Dial, 3D Sphere Orb & Polar Gauge Suite)",
      category: "metrics",
      confidence: 0.98,
      reason: `Explicit percentage metric detected: ${percentMatch.join(", ")}`,
      matchedTokens: percentMatch,
      recommendedPreset,
      assetRealizationWorkflow: "Asset Realization: Dynamic 48-Tick Proportional Sweep -> 3D Sphere Orb / Atmospheric Horizon Arc -> Specular Leading Apex Gleam -> Subpixel Whir SFX",
      audioCue: "Subpixel Tick Whir, Laser Needle Sweep & Sine Resolution (Z:30, 14500Hz)"
    });
  }

  // --- ARCHETYPE 07: COMPARISON (DYNAMIC CONTRAST & SPLIT SUITE) ---
  const matchedComp = COMPARISON_KEYWORDS.filter(k => lower.includes(k));
  if (matchedComp.length > 0) {
    let recommendedPreset = "COMP #01 (Stepped Notch Laser Split Screen - Ref Screenshot 04)";
    if (lower.includes("product") || lower.includes("bottle") || lower.includes("podium") || lower.includes("side by side") || lower.includes("tumbler")) {
      recommendedPreset = "COMP #02 (Dual Product Side-by-Side Studio Stage - Ref Screenshot 02)";
    }

    signals.push({
      archetypeId: 7,
      archetypeSerial: "07",
      archetypeName: "Comparison (Dynamic Contrast & Split Suite)",
      category: "transformations",
      confidence: 0.92,
      reason: `Comparative contrast structure detected: "${matchedComp.join(", ")}"`,
      matchedTokens: matchedComp,
      recommendedPreset,
      assetRealizationWorkflow: "Asset Realization: Stepped Notch Laser Seam / Dual Studio Stage -> Divergent Atmosphere Lighting -> Tinkerable Trajectory Entry -> Stereo Split SFX",
      audioCue: "Dual Polarity Laser Slice & Studio Resonance (Pan: Split L/R, Cutoff: 17,000 Hz)"
    });
  }

  // --- ARCHETYPE 08: BEFORE / AFTER ---
  const matchedBeforeAfter = BEFORE_AFTER_KEYWORDS.filter(k => lower.includes(k));
  if (matchedBeforeAfter.length > 0) {
    signals.push({
      archetypeId: 8,
      archetypeSerial: "08",
      archetypeName: "Before / After",
      category: "transformations",
      confidence: 0.94,
      reason: `Temporal transformation state change detected: "${matchedBeforeAfter.join(", ")}"`,
      matchedTokens: matchedBeforeAfter,
      recommendedPreset: "BEFORE_AFTER #01 (Curtain Wipe State Morph)",
      audioCue: "Whoosh Curtain Slide Transition (Z:20, 8000Hz)"
    });
  }

  // --- ARCHETYPE 09: TIMELINE / SEQUENCE ---
  const matchedTimeline = TIMELINE_KEYWORDS.filter(k => lower.includes(k));
  if (matchedTimeline.length >= 2 || lower.includes("timeline")) {
    signals.push({
      archetypeId: 9,
      archetypeSerial: "09",
      archetypeName: "Timeline / Sequence",
      category: "processes",
      confidence: 0.89,
      reason: `Chronological sequence milestones detected: "${matchedTimeline.join(", ")}"`,
      matchedTokens: matchedTimeline,
      recommendedPreset: "TIMELINE #01 (Horizontal Step Progress Track)",
      audioCue: "Clockwork Rhythm Ticks (120 BPM)"
    });
  }

  // --- ARCHETYPE 10: PROCESS / WORKFLOW ---
  const matchedProcess = PROCESS_WORKFLOW_KEYWORDS.filter(k => lower.includes(k));
  if (matchedProcess.length > 0 || text.includes("->") || text.includes("→")) {
    signals.push({
      archetypeId: 10,
      archetypeSerial: "10",
      archetypeName: "Process / Workflow",
      category: "processes",
      confidence: 0.91,
      reason: `Step-by-step system pipeline detected: "${matchedProcess.join(", ") || "arrow notation"}"`,
      matchedTokens: matchedProcess,
      recommendedPreset: "WORKFLOW #01 (Stage Process Node Flowchart)",
      audioCue: "Conveyor Ratchet Pulses (Z:20, 6500Hz)"
    });
  }

  // --- ARCHETYPE 14: GEOGRAPHIC MAP ---
  if (matchedGeos.length > 0) {
    signals.push({
      archetypeId: 14,
      archetypeSerial: "14",
      archetypeName: "Geographic / Map Asset",
      category: "artifacts",
      confidence: 0.93,
      reason: `Geographic location reference: ${matchedGeos.join(", ")}`,
      matchedTokens: matchedGeos,
      recommendedPreset: "MAP #01 (Transatlantic Telemetry Arc)",
      audioCue: "Radar Sonar Ping (Z:10, 2200Hz)"
    });
  }

  // --- ARCHETYPE 01: TYPOGRAPHY (PURE KINETIC TEXT FALLBACK) ---
  if (signals.length === 0) {
    signals.push({
      archetypeId: 1,
      archetypeSerial: "01",
      archetypeName: "Typography (Kinetic Text Suite)",
      category: "typography",
      confidence: 0.99,
      reason: "Direct verbal statement requiring pure typographic rhythm, font JSON styling, and focal emphasis",
      matchedTokens: tokens.slice(0, 4),
      recommendedPreset: "TYPO #01 (Apple Pro Display Hero Revealer)",
      audioCue: "Subpixel Keystroke Click (Z:30, 18500Hz)"
    });
  }

  // Rank signals by confidence score descending
  signals.sort((a, b) => b.confidence - a.confidence);

  const primary = signals[0];
  const secondaries = signals.slice(1);
  const isCompound = secondaries.length > 0;

  let compoundDesc = `Single Archetype Treatment: ${primary.archetypeName}`;
  if (isCompound) {
    compoundDesc = `Compound Multi-Layer Fusion: Primary [${primary.archetypeName}] fused with Secondary [${secondaries.map(s => s.archetypeName).join(", ")}]`;
  }

  // 3D Composition Layer Architecture
  const z10 = primary.archetypeId === 2 ? `Brand / Tool Vector Asset Layer (${primary.matchedTokens.join(", ")})` :
              primary.archetypeId === 14 ? "Transatlantic Map Telemetry Arc" :
              primary.archetypeId === 15 ? "Vintage Tech Founders Trio Asset Layer" :
              primary.archetypeId === 23 ? `Abstract Concept HUD Mesh (${primary.matchedTokens.join(", ")})` :
              primary.archetypeId === 49 ? "Atomic Compounding Flywheel Orbital Mesh" : null;

  return {
    rawStatement: statement,
    primaryArchetype: primary,
    secondaryArchetypes: secondaries,
    isCompound: isCompound,
    compoundDescription: compoundDesc,
    compositionLayering: {
      z10_backgroundAsset: z10,
      z20_speakerClearance: "MediaPipe 14.79% Scalp Boundary",
      z30_foregroundTypography: primary.recommendedPreset,
      spatialAudioMapping: {
        pan: primary.archetypeId === 7 ? -0.75 : 0.0,
        cutoffHz: primary.archetypeId === 49 ? 1200 : (primary.archetypeId === 2 ? 1400 : 18500),
        soundCue: primary.audioCue
      }
    },
    extractedEntities: {
      brands: matchedBrands,
      concreteTools: matchedTools,
      abstractConcepts: matchedConcepts,
      humanRoles: matchedRoles,
      metrics: moneyMatch || [],
      percentages: percentMatch,
      timeMarkers: matchedTimeline,
      contrastPairs: matchedComp,
      steps: matchedProcess
    }
  };
}

// 3. AUTOMATED VERIFICATION TEST SUITE
console.log("=================================================");
console.log("PROMETHEUS 50-ARCHETYPE SEMANTIC CLASSIFIER & ROUTER TEST SUITE");
console.log("=================================================");

const testCases = [
  { text: "Companies like Google, Instagram, and Tesla dominate the tech landscape.", expectedPrimary: 2 },
  { text: "Revenue went from $10,000 to $50,000 in less than sixty days.", expectedPrimary: 4 },
  { text: "We achieved $50,000 in net profit this month alone.", expectedPrimary: 5 },
  { text: "Our conversion rate jumped 40% immediately.", expectedPrimary: 6 },
  { text: "A small business versus a massive enterprise.", expectedPrimary: 7 },
  { text: "Before the automated system, we were working 70 hours a week.", expectedPrimary: 8 },
  { text: "First you define the offer, then you run the campaign, then you scale.", expectedPrimary: 3 },
  { text: "We expanded our engineering team from Lagos to London.", expectedPrimary: 14 },
  { text: "Growth doesn't come from doing more things. It comes from doing the right things repeatedly.", expectedPrimary: 49 },
  { text: "Most founders don't have a growth problem; they have a focus problem.", expectedPrimary: 15 },
  { text: "and new tools.", expectedPrimary: 2 },
  { text: "You realize something extraordinary.", expectedPrimary: 1 }
];

let passed = 0;
testCases.forEach((tc, idx) => {
  const res = routeStatementToArchetypes(tc.text);
  const isMatch = res.primaryArchetype.archetypeId === tc.expectedPrimary;
  if (isMatch) {
    console.log(`✅ [TEST ${idx+1}/${testCases.length} PASSED] "${tc.text.slice(0, 40)}..." -> Primary: #${res.primaryArchetype.archetypeSerial} ${res.primaryArchetype.archetypeName} (Compound: ${res.isCompound ? 'YES' : 'NO'})`);
    passed++;
  } else {
    console.log(`❌ [TEST ${idx+1}/${testCases.length} FAILED] "${tc.text}" -> Got #${res.primaryArchetype.archetypeId}, expected #${tc.expectedPrimary}`);
  }
});

console.log(`\n🎉 Test Suite Completed: ${passed}/${testCases.length} assertions passed.\n`);
