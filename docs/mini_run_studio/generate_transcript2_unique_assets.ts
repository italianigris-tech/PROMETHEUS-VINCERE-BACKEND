import * as fs from "node:fs";
import * as path from "node:path";

const studioDir = __dirname;

// Helper to generate 100% transparent high-detail Cyberpunk SVG assets
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

// 1. UNIQUE ASSET 1: Cyberpunk Neon Metronome & Hourglass (Positioned to Right Shoulder Clearance)
const metronomeSvg = createCyberpunkSvgAsset(800, 500, `
  <circle cx="580" cy="220" r="200" fill="url(#cyanGlow)"/>
  <circle cx="580" cy="220" r="130" fill="url(#goldGlow)"/>
  <!-- Metronome Frame Shifted Right (x:580) for Shoulder Clearance -->
  <polygon points="580,50 470,380 690,380" fill="#101625" stroke="#00F0FF" stroke-width="6" filter="url(#cyberGlowFilter)"/>
  <polygon points="580,80 490,360 670,360" fill="#070913" stroke="#FFD700" stroke-width="3"/>
  <!-- Pendulum Arm -->
  <line x1="580" y1="350" x2="640" y2="100" stroke="#00F0FF" stroke-width="8" filter="url(#cyberGlowFilter)"/>
  <rect x="615" y="130" width="45" height="35" rx="6" fill="#FFD700" stroke="#FFFFFF" stroke-width="2"/>
  <!-- Glowing Dial -->
  <circle cx="580" cy="350" r="14" fill="#00F0FF"/>
  <path d="M 520,280 Q 580,220 640,280" fill="none" stroke="#FF8C00" stroke-width="4" stroke-dasharray="8,8"/>
`);

// 2. UNIQUE ASSET 2: Robotic Assembly Arm (Positioned to Left Shoulder Clearance)
const roboticArmSvg = createCyberpunkSvgAsset(800, 500, `
  <circle cx="220" cy="220" r="200" fill="url(#cyanGlow)"/>
  <!-- Robotic Arm Base Shifted Left (x:220) for Shoulder Clearance -->
  <rect x="140" y="340" width="160" height="60" rx="12" fill="#1E293B" stroke="#00F0FF" stroke-width="5"/>
  <circle cx="220" cy="340" r="35" fill="#070913" stroke="#FFD700" stroke-width="4"/>
  <!-- Arm Segments extending Left -->
  <line x1="220" y1="340" x2="120" y2="200" stroke="#00F0FF" stroke-width="14" stroke-linecap="round" filter="url(#cyberGlowFilter)"/>
  <circle cx="120" cy="200" r="20" fill="#FFD700" stroke="#FFFFFF" stroke-width="3"/>
  <line x1="120" y1="200" x2="300" y2="100" stroke="#00F0FF" stroke-width="10" stroke-linecap="round" filter="url(#cyberGlowFilter)"/>
  <circle cx="300" cy="100" r="16" fill="#00F0FF"/>
  <!-- Laser Tool Claw -->
  <path d="M 300,100 L 340,70 M 300,100 L 340,130" stroke="#FF3366" stroke-width="6" stroke-linecap="round" filter="url(#cyberGlowFilter)"/>
  <circle cx="220" cy="220" r="60" fill="none" stroke="#00F0FF" stroke-width="4" stroke-dasharray="12 6"/>
`);

// 3. UNIQUE ASSET 3: Starship Rocket & Orbit Mesh (Positioned to Right Shoulder Clearance)
const rocketSvg = createCyberpunkSvgAsset(800, 500, `
  <circle cx="580" cy="220" r="210" fill="url(#cyanGlow)"/>
  <circle cx="580" cy="180" r="140" fill="url(#goldGlow)"/>
  <!-- Rocket Body Shifted Right (x:580) for Shoulder Clearance -->
  <path d="M 580,50 C 615,140 625,260 625,340 L 535,340 C 535,260 545,140 580,50 Z" fill="#101625" stroke="#00F0FF" stroke-width="6" filter="url(#cyberGlowFilter)"/>
  <!-- Wings & Fins -->
  <polygon points="535,290 475,370 535,360" fill="#1E293B" stroke="#FFD700" stroke-width="3"/>
  <polygon points="625,290 685,370 625,360" fill="#1E293B" stroke="#FFD700" stroke-width="3"/>
  <!-- Cockpit Glass Glow -->
  <ellipse cx="580" cy="150" rx="24" ry="38" fill="#00F0FF" stroke="#FFFFFF" stroke-width="3" filter="url(#cyberGlowFilter)"/>
  <!-- Thruster Energy Blast -->
  <polygon points="555,340 580,430 605,340" fill="#FF3366" filter="url(#cyberGlowFilter)"/>
  <polygon points="568,340 580,400 592,340" fill="#FFD700"/>
  <!-- Orbit Ring -->
  <ellipse cx="580" cy="230" rx="260" ry="70" fill="none" stroke="#00F0FF" stroke-width="3" stroke-dasharray="14 8" transform="rotate(-15 580 230)"/>
`);

fs.writeFileSync(path.join(studioDir, "transcript2_metronome_unique.svg"), metronomeSvg);
fs.writeFileSync(path.join(studioDir, "transcript2_robotic_arm_unique.svg"), roboticArmSvg);
fs.writeFileSync(path.join(studioDir, "transcript2_rocket_scale_unique.svg"), rocketSvg);

console.log("REMOVED_SOLID_BLACK_RECT_FROM_SVG_ASSETS!");
