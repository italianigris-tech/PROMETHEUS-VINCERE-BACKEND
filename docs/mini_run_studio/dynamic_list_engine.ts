/**
 * PROMETHEUS CORE: ANIMA #03 DYNAMIC LIST & ENUMERATION ENGINE (V3 CINEMATIC MODULAR)
 * 
 * Implements high-tier, cinematic, modular multi-item list architectures derived from
 * the 6 authoritative reference archetypes (3D Carousel Decks, Vertical Pill Trackers,
 * Overlapping Dual-Card Decks, Circular Bubble Sequencers, and Photorealistic Classical Pillars).
 * 
 * Includes:
 * - Depth-of-field (DoF) Rack-Focus Gaussian Blur physics (active item sharp, non-active blurred).
 * - Full Typography Master Kinetic Suite modularity for all text elements.
 * - Subtext explanation toggle (showSubtext).
 * - Font JSON profile pairing integration.
 * - Photorealistic Classical Column assets with giant gradient blur numerals (1, 2, 3).
 */

import fs from "fs";
import path from "path";

export type ListArchetypeFormat = 
  | "3d_carousel_deck"             // Ref Screenshot 01 (165239)
  | "vertical_pill_tracker"        // Ref Screenshot 02 (165253)
  | "overlapping_dual_card_deck"   // Ref Screenshot 03 (165326)
  | "concentric_bubble_sequencer"  // Ref Screenshot 04 (165453)
  | "classical_pillar_trio"        // Ref Screenshot 05 (165645) & Screenshot 171127
  | "monumental_5_pillars"         // Ref Screenshot 06 (165655) & Screenshot 171127
  | "staggered_stencil_quadrant"   // 4-Quadrant Depth Chase Grid
  | "glassmorphic_visionos_tiles"  // VisionOS Frosted Step Tiles
  | "horizontal_milestone_track";  // Horizontal Connected Progress Track

export type ItemState = "pending" | "active" | "completed";

export type DepthPlanePlacement = "Z:10_BACKGROUND_STAGE" | "Z:30_FOREGROUND_FLOAT";

export type BackdropTreatmentStyle = 
  | "royal_blue_radial_gradient"   // Deep cobalt studio stage (Screenshot 06)
  | "obsidian_vignette"            // OLED deep black vignette
  | "classical_marble_colonnade"   // Ancient architecture backdrop
  | "visionos_frosted_acrylic"     // Spatial translucent blur
  | "transparent_direct_overlay";  // Clean foreground overlay

export interface DynamicListItem {
  itemIndex: number;          // 0-indexed (0..totalCount-1)
  numeralBadge: string;       // "01", "1", "A", "I"
  primaryLabel: string;       // Spoken bullet / concept
  subtextParagraph?: string;  // Detailed explanation (used in Overlapping Cards)
  iconGlyph?: string;         // Emoji or SVG icon identifier
  state: ItemState;           // Execution state
  relativeTimestampSec?: number; // Timing offset in timeline
  audioCue: string;           // SFX linkage
}

export interface DynamicListMetadata {
  schemaVersion: "3.0.0";
  archetypeId: 3;
  archetypeName: "List / Enumeration (Dynamic Sequence & Pillar Suite)";
  listFormat: ListArchetypeFormat;
  totalCount: number;         // Total items in list (dynamic: 3..7)
  activeItemIndex: number;    // Current active highlighted item (0..totalCount-1)
  showSubtext: boolean;       // Modular toggle to turn subtext explanation on/off
  kineticTypographyPresetId: string; // Linked Typography Master Kinetic Suite preset
  fontPairingId: string;      // Linked Font JSON Profile Pairing
  staggerIntervalMs: number;  // e.g. 150ms per item
  textAnimationMode: "gaussian_blur_word_fade" | "letter_by_letter" | "kinetic_spring_slide";
  depthPlacement: DepthPlanePlacement;
  backdrop: {
    requiresBackgroundGeneration: boolean;
    style: BackdropTreatmentStyle;
    ambientVignetteOpacity: number;
    depthZIndex: 10;
  };
  pillarAssetSpec?: {
    materialShader: "photorealistic_classical_marble";
    giantNumeralGradient: string;
    independentRiseDamping: number;
    fluteCount: number;
  };
  items: DynamicListItem[];
}

/**
 * Load authentic photorealistic marble column asset as base64 data URI
 */
export function getMarblePillarDataUri(): string {
  try {
    const pillarPath = path.join(process.cwd(), "docs/mini_run_studio/classical_marble_pillar_cutout.png");
    if (fs.existsSync(pillarPath)) {
      const b64 = fs.readFileSync(pillarPath).toString("base64");
      return `data:image/png;base64,${b64}`;
    }
  } catch (e) {
    // Fallback gracefully
  }
  return "/docs/mini_run_studio/classical_marble_pillar_cutout.png";
}

/**
 * Plan and generate dynamic list metadata from raw transcript statement or item array
 */
export function planDynamicList(
  rawTranscript: string,
  explicitItems?: string[],
  overrideFormat?: ListArchetypeFormat,
  activeIdx: number = 0,
  options: { showSubtext?: boolean; fontPairing?: string; typoPreset?: string } = {}
): DynamicListMetadata {
  let itemsList: string[] = [];
  if (explicitItems && explicitItems.length > 0) {
    itemsList = explicitItems;
  } else {
    const lines = rawTranscript.split(/,|\band\b|\bfirst\b|\bsecond\b|\bthird\b|\bfourth\b|\bfifth\b/i)
      .map(s => s.trim())
      .filter(s => s.length > 2);
    itemsList = lines.length >= 2 ? lines.slice(0, 7) : ["Core Foundation", "Execution Velocity", "Scale & Compound"];
  }

  const total = Math.min(Math.max(itemsList.length, 3), 7);
  const active = Math.min(Math.max(activeIdx, 0), total - 1);

  let chosenFormat: ListArchetypeFormat = overrideFormat || "3d_carousel_deck";
  const lower = rawTranscript.toLowerCase();

  if (!overrideFormat) {
    if (lower.includes("pillar") || lower.includes("foundations") || lower.includes("strategy") || lower.includes("seo")) {
      chosenFormat = total === 3 ? "classical_pillar_trio" : "monumental_5_pillars";
    } else if (lower.includes("card") || lower.includes("identity") || lower.includes("brand")) {
      chosenFormat = "overlapping_dual_card_deck";
    } else if (lower.includes("task") || lower.includes("todo") || lower.includes("steps")) {
      chosenFormat = "concentric_bubble_sequencer";
    } else if (lower.includes("connect") || lower.includes("pilot") || lower.includes("arrow")) {
      chosenFormat = "vertical_pill_tracker";
    } else {
      chosenFormat = "3d_carousel_deck";
    }
  }

  const isPillar = chosenFormat === "classical_pillar_trio" || chosenFormat === "monumental_5_pillars";
  const depth: DepthPlanePlacement = isPillar ? "Z:10_BACKGROUND_STAGE" : "Z:30_FOREGROUND_FLOAT";
  const backdropStyle: BackdropTreatmentStyle = chosenFormat === "monumental_5_pillars" || chosenFormat === "vertical_pill_tracker"
    ? "royal_blue_radial_gradient" 
    : "obsidian_vignette";

  const dynamicItems: DynamicListItem[] = itemsList.slice(0, total).map((text, idx) => {
    let state: ItemState = "pending";
    if (idx < active) state = "completed";
    else if (idx === active) state = "active";

    const defaultIcons = ["🔍", "👥", "📢", "🤝", "📊", "⚡", "🎯"];

    return {
      itemIndex: idx,
      numeralBadge: String(idx + 1).padStart(2, "0"),
      primaryLabel: text,
      subtextParagraph: `Engineered protocol driving maximum leverage, precision execution, and scalable feedback loops across stage ${idx + 1}.`,
      iconGlyph: defaultIcons[idx % defaultIcons.length],
      state,
      relativeTimestampSec: idx * 1.5,
      audioCue: state === "active" ? "Mechanical Ratchet Strike & Low-Pass Rise" : "Tick Pip"
    };
  });

  return {
    schemaVersion: "3.0.0",
    archetypeId: 3,
    archetypeName: "List / Enumeration (Dynamic Sequence & Pillar Suite)",
    listFormat: chosenFormat,
    totalCount: total,
    activeItemIndex: active,
    showSubtext: options.showSubtext !== undefined ? options.showSubtext : true,
    kineticTypographyPresetId: options.typoPreset || "TYPO #02 Subpixel Gaussian Rack-Focus",
    fontPairingId: options.fontPairing || "Syne 800 + Space Grotesk 500",
    staggerIntervalMs: 150,
    textAnimationMode: "gaussian_blur_word_fade",
    depthPlacement: depth,
    backdrop: {
      requiresBackgroundGeneration: isPillar || chosenFormat === "vertical_pill_tracker",
      style: backdropStyle,
      ambientVignetteOpacity: 0.85,
      depthZIndex: 10
    },
    pillarAssetSpec: isPillar ? {
      materialShader: "photorealistic_classical_marble",
      giantNumeralGradient: "linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,0.7) 40%, rgba(255,255,255,0) 100%)",
      independentRiseDamping: 0.82,
      fluteCount: 24
    } : undefined,
    items: dynamicItems
  };
}

/**
 * Generate high-tier parametric HTML string with Gaussian Blur Rack-Focus physics
 */
export function renderParametricListHtml(metadata: DynamicListMetadata): string {
  const pillarImgSrc = getMarblePillarDataUri();

  switch (metadata.listFormat) {
    case "3d_carousel_deck":
      return `
      <div class="list-stage list-carousel-stage">
        <div class="list-carousel-3d-wrap">
          ${metadata.items.map((it, idx) => {
            const isCenter = idx === metadata.activeItemIndex;
            const isLeft = idx < metadata.activeItemIndex;
            const cls = isCenter ? "card-center active-focus" : (isLeft ? "card-left blurred-dof" : "card-right blurred-dof");
            return `
            <div class="carousel-card ${cls}">
              <span class="carousel-card-num ${isCenter ? 'num-sharp' : 'num-blur'}">${it.itemIndex + 1}</span>
            </div>`;
          }).join("")}
        </div>
      </div>`;

    case "vertical_pill_tracker":
      return `
      <div class="list-stage list-vertical-stack-stage">
        <div class="list-vertical-stack-box">
          ${metadata.items.map((it, idx) => {
            if (idx === metadata.activeItemIndex) {
              return `
              <div class="v-list-item v-list-active sharp-item">
                <span class="v-arrow-pointer">▶</span>
                <span class="v-pill-highlight">${it.primaryLabel}</span>
              </div>`;
            }
            return `<div class="v-list-item blurred-item">${it.primaryLabel}</div>`;
          }).join("")}
        </div>
      </div>`;

    case "overlapping_dual_card_deck":
      const activeItem = metadata.items[metadata.activeItemIndex] || metadata.items[0];
      return `
      <div class="list-stage list-split-deck-stage">
        <div class="split-card-container">
          <div class="split-num-card">
            <span class="split-big-num">${activeItem.numeralBadge}</span>
          </div>
          <div class="split-content-card">
            <h4 class="split-card-title">${activeItem.primaryLabel}</h4>
            ${metadata.showSubtext && activeItem.subtextParagraph ? `<p class="split-card-subtext">${activeItem.subtextParagraph}</p>` : ''}
          </div>
        </div>
      </div>`;

    case "concentric_bubble_sequencer":
      return `
      <div class="list-stage list-bubble-stage">
        <div class="bubble-list-container">
          ${metadata.items.map((it, idx) => {
            const isActive = idx === metadata.activeItemIndex;
            return `
            <div class="bubble-item ${isActive ? "active-bubble sharp-item" : "blurred-item"}">
              <span class="bubble-bullet-icon ${isActive ? "active" : ""}"><span class="bubble-inner-dot"></span></span>
              <span class="bubble-item-text ${isActive ? "highlight" : ""}">${it.primaryLabel}</span>
            </div>`;
          }).join("")}
        </div>
      </div>`;

    case "classical_pillar_trio":
      return `
      <div class="list-stage list-pillar-cinematic-stage">
        <div class="pillar-cinematic-container">
          ${metadata.items.slice(0, 3).map((it, idx) => {
            const isActive = idx === metadata.activeItemIndex;
            return `
            <div class="pillar-cinematic-col pillar-col-${idx + 1} ${isActive ? 'active-pillar' : 'blurred-pillar'}">
              <div class="pillar-giant-num ${isActive ? 'active' : ''}">${idx + 1}</div>
              <img class="pillar-img ${isActive ? 'pillar-sharp' : 'pillar-blur'}" src="${pillarImgSrc}" alt="Classical Column" />
            </div>`;
          }).join("")}
        </div>
      </div>`;

    case "monumental_5_pillars":
      return `
      <div class="list-stage list-pillars-5-stage">
        <div class="pillars-5-container">
          ${metadata.items.slice(0, 5).map((it, idx) => {
            const isActive = idx === metadata.activeItemIndex;
            return `
            <div class="p5-col p5-c${idx + 1} ${isActive ? "active-pillar" : "blurred-pillar"}">
              <div class="pillar-giant-num-5 ${isActive ? 'active' : ''}">${idx + 1}</div>
              <div class="p5-badge ${isActive ? "active" : ""}">
                <span class="p5-icon">${it.iconGlyph || "🏛️"}</span>
                <span>${it.primaryLabel}</span>
              </div>
              <img class="pillar-img-5 ${isActive ? 'pillar-sharp' : 'pillar-blur'}" src="${pillarImgSrc}" alt="Classical Column" />
            </div>`;
          }).join("")}
        </div>
      </div>`;

    case "staggered_stencil_quadrant":
      return `
      <div class="list-stage">
        <div class="stencil-quad-grid">
          ${metadata.items.slice(0, 4).map((it, idx) => {
            const isActive = idx === metadata.activeItemIndex;
            return `
            <div class="stencil-cell ${isActive ? "active sharp-cell" : "blurred-cell"}">
              <span class="st-num">${it.numeralBadge}</span>
              <span class="st-label">${it.primaryLabel}</span>
            </div>`;
          }).join("")}
        </div>
      </div>`;

    case "glassmorphic_visionos_tiles":
      return `
      <div class="list-stage">
        <div class="glass-tiles-wrap">
          ${metadata.items.map((it, idx) => {
            const isActive = idx === metadata.activeItemIndex;
            const isCompleted = idx < metadata.activeItemIndex;
            const statusClass = isActive ? "active sharp-tile" : (isCompleted ? "completed" : "pending blurred-tile");
            const icon = isCompleted ? "✓" : (isActive ? "▶" : "○");
            return `
            <div class="glass-step-tile ${statusClass}">
              <span class="step-check ${isActive ? 'active' : (isCompleted ? 'completed' : 'pending')}">${icon}</span>
              <span>${it.primaryLabel}</span>
            </div>`;
          }).join("")}
        </div>
      </div>`;

    case "horizontal_milestone_track":
      return `
      <div class="list-stage">
        <div class="milestone-track-container">
          <div class="milestone-bar-bg"><div class="milestone-bar-fill"></div></div>
          <div class="milestone-nodes-row">
            ${metadata.items.map((it, idx) => {
              const isActive = idx === metadata.activeItemIndex;
              const isCompleted = idx < metadata.activeItemIndex;
              const statusClass = isActive ? "active sharp-node" : (isCompleted ? "completed" : "pending blurred-node");
              return `
              <div class="m-node ${statusClass}">
                <span class="m-dot">${it.itemIndex + 1}</span>
                <span class="m-title">${it.primaryLabel}</span>
              </div>`;
            }).join("")}
          </div>
        </div>
      </div>`;

    default:
      return `<div class="list-stage"><div class="generic-list-fallback">${metadata.items.length} dynamic items</div></div>`;
  }
}
