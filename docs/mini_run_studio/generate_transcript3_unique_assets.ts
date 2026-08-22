import * as fs from "node:fs";
import * as path from "node:path";

const studioDir = __dirname;

function createCyberpunkSvgAsset(width: number, height: number, svgElements: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <radialGradient id="cyanGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#00F0FF" stop-opacity="0.85"/>
        <stop offset="50%" stop-color="#0088FF" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="goldGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#FFD700" stop-opacity="0.9"/>
        <stop offset="60%" stop-color="#FF8C00" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="roseGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#FF0055" stop-opacity="0.85"/>
        <stop offset="60%" stop-color="#990033" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </radialGradient>
      <filter id="cyberGlowFilter">
        <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    ${svgElements}
  </svg>`;
}

// 1. UNIQUE ASSET 1: Focus HUD & Precision Target Crosshair (Right Shoulder Clearance x:580, y:220)
const focusTargetSvg = createCyberpunkSvgAsset(800, 500, `
  <circle cx="580" cy="220" r="210" fill="url(#cyanGlow)"/>
  <circle cx="580" cy="220" r="140" fill="url(#goldGlow)"/>
  <!-- Outer Azimuth Ring -->
  <circle cx="580" cy="220" r="180" fill="none" stroke="#00F0FF" stroke-width="3" stroke-dasharray="24 12" filter="url(#cyberGlowFilter)"/>
  <circle cx="580" cy="220" r="150" fill="none" stroke="#FFD700" stroke-width="2" stroke-dasharray="6 6"/>
  <!-- Focus HUD Box -->
  <rect x="460" y="100" width="240" height="240" rx="16" fill="rgba(16,22,37,0.4)" stroke="#00F0FF" stroke-width="3" filter="url(#cyberGlowFilter)"/>
  <!-- Precision Crosshairs -->
  <line x1="420" y1="220" x2="740" y2="220" stroke="#00F0FF" stroke-width="4" stroke-dasharray="14 8"/>
  <line x1="580" y1="60" x2="580" y2="380" stroke="#00F0FF" stroke-width="4" stroke-dasharray="14 8"/>
  <!-- Central Lock Reticle -->
  <circle cx="580" cy="220" r="45" fill="none" stroke="#FFD700" stroke-width="5" filter="url(#cyberGlowFilter)"/>
  <circle cx="580" cy="220" r="12" fill="#FF0055"/>
  <path d="M 545,185 L 560,185 L 560,200" fill="none" stroke="#FFFFFF" stroke-width="3"/>
  <path d="M 615,185 L 600,185 L 600,200" fill="none" stroke="#FFFFFF" stroke-width="3"/>
  <path d="M 545,255 L 560,255 L 560,240" fill="none" stroke="#FFFFFF" stroke-width="3"/>
  <path d="M 615,255 L 600,255 L 600,240" fill="none" stroke="#FFFFFF" stroke-width="3"/>
  <text x="580" y="315" text-anchor="middle" fill="#00F0FF" font-family="monospace" font-size="14" font-weight="bold" letter-spacing="4">FOCUS LOCKED</text>
`);

// 2. UNIQUE ASSET 2: 4-Quadrant Chase Matrix (Left Shoulder Clearance x:220, y:220)
const chaseQuadrantSvg = createCyberpunkSvgAsset(800, 500, `
  <circle cx="220" cy="220" r="210" fill="url(#cyanGlow)"/>
  <!-- Central Hub -->
  <circle cx="220" cy="220" r="32" fill="#101625" stroke="#FFD700" stroke-width="4" filter="url(#cyberGlowFilter)"/>
  <circle cx="220" cy="220" r="12" fill="#00F0FF"/>
  <!-- Quadrant Connecting Struts -->
  <line x1="220" y1="220" x2="120" y2="120" stroke="#00F0FF" stroke-width="5" filter="url(#cyberGlowFilter)"/>
  <line x1="220" y1="220" x2="320" y2="120" stroke="#00F0FF" stroke-width="5" filter="url(#cyberGlowFilter)"/>
  <line x1="220" y1="220" x2="120" y2="320" stroke="#00F0FF" stroke-width="5" filter="url(#cyberGlowFilter)"/>
  <line x1="220" y1="220" x2="320" y2="320" stroke="#00F0FF" stroke-width="5" filter="url(#cyberGlowFilter)"/>
  <!-- Node 1: Ideas (Top Left x:120, y:120) -->
  <circle cx="120" cy="120" r="38" fill="#1E293B" stroke="#FFD700" stroke-width="3" filter="url(#cyberGlowFilter)"/>
  <text x="120" y="126" text-anchor="middle" fill="#FFD700" font-family="sans-serif" font-size="20">💡</text>
  <text x="120" y="172" text-anchor="middle" fill="#FFFFFF" font-family="monospace" font-size="11" font-weight="bold">IDEAS</text>
  <!-- Node 2: Customers (Top Right x:320, y:120) -->
  <circle cx="320" cy="120" r="38" fill="#1E293B" stroke="#00F0FF" stroke-width="3" filter="url(#cyberGlowFilter)"/>
  <text x="320" y="126" text-anchor="middle" fill="#00F0FF" font-family="sans-serif" font-size="20">👥</text>
  <text x="320" y="172" text-anchor="middle" fill="#FFFFFF" font-family="monospace" font-size="11" font-weight="bold">CUSTOMERS</text>
  <!-- Node 3: Strategies (Bottom Left x:120, y:320) -->
  <circle cx="120" cy="320" r="38" fill="#1E293B" stroke="#FF0055" stroke-width="3" filter="url(#cyberGlowFilter)"/>
  <text x="120" y="326" text-anchor="middle" fill="#FF0055" font-family="sans-serif" font-size="20">♟️</text>
  <text x="120" y="372" text-anchor="middle" fill="#FFFFFF" font-family="monospace" font-size="11" font-weight="bold">STRATEGY</text>
  <!-- Node 4: Tools (Bottom Right x:320, y:320) -->
  <circle cx="320" cy="320" r="38" fill="#1E293B" stroke="#00FF88" stroke-width="3" filter="url(#cyberGlowFilter)"/>
  <text x="320" y="326" text-anchor="middle" fill="#00FF88" font-family="sans-serif" font-size="20">⚙️</text>
  <text x="320" y="372" text-anchor="middle" fill="#FFFFFF" font-family="monospace" font-size="11" font-weight="bold">TOOLS</text>
`);

// 3. UNIQUE ASSET 3: Atomic Compounding Flywheel Loop (Right Shoulder Clearance x:580, y:220)
const atomicFlywheelSvg = createCyberpunkSvgAsset(800, 500, `
  <circle cx="580" cy="220" r="220" fill="url(#cyanGlow)"/>
  <circle cx="580" cy="220" r="150" fill="url(#goldGlow)"/>
  <!-- Compounding Loop Ring 1 -->
  <ellipse cx="580" cy="220" rx="190" ry="75" fill="none" stroke="#00F0FF" stroke-width="5" stroke-dasharray="18 10" transform="rotate(-25 580 220)" filter="url(#cyberGlowFilter)"/>
  <!-- Compounding Loop Ring 2 -->
  <ellipse cx="580" cy="220" rx="190" ry="75" fill="none" stroke="#FFD700" stroke-width="5" stroke-dasharray="18 10" transform="rotate(35 580 220)" filter="url(#cyberGlowFilter)"/>
  <!-- Compounding Loop Ring 3 -->
  <ellipse cx="580" cy="220" rx="190" ry="75" fill="none" stroke="#00FF88" stroke-width="4" stroke-dasharray="12 8" transform="rotate(95 580 220)"/>
  <!-- Turbine Core -->
  <circle cx="580" cy="220" r="50" fill="#101625" stroke="#FFFFFF" stroke-width="4" filter="url(#cyberGlowFilter)"/>
  <circle cx="580" cy="220" r="25" fill="#FFD700"/>
  <!-- Kinetic Momentum Arrows -->
  <path d="M 720,130 Q 750,220 680,290" fill="none" stroke="#00F0FF" stroke-width="6" stroke-linecap="round" filter="url(#cyberGlowFilter)"/>
  <polygon points="680,290 695,275 675,270" fill="#00F0FF"/>
  <text x="580" y="325" text-anchor="middle" fill="#FFD700" font-family="monospace" font-size="13" font-weight="bold" letter-spacing="3">COMPOUNDING REPETITION</text>
`);

fs.writeFileSync(path.join(studioDir, "transcript3_focus_target.svg"), focusTargetSvg);
fs.writeFileSync(path.join(studioDir, "transcript3_chase_quadrant.svg"), chaseQuadrantSvg);
fs.writeFileSync(path.join(studioDir, "transcript3_atomic_flywheel.svg"), atomicFlywheelSvg);

console.log("[TRANSCRIPT3_ASSETS] Successfully created 3 unique high-detail vector assets for Transcript 3:");
console.log(" -> transcript3_focus_target.svg");
console.log(" -> transcript3_chase_quadrant.svg");
console.log(" -> transcript3_atomic_flywheel.svg");
