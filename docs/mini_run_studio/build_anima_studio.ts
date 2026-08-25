import fs from "fs";
import path from "path";

const repoRoot = "/home/ec2-user/PROMETHEUS-CORE-BACKEND";
const outputStudioPath = path.join(repoRoot, "docs/mini_run_studio/anima_studio.html");
const outputPreviewPath = path.join(repoRoot, "Yuan Prometheus Screenshots/prometheus_animations_preview/anima.html");

interface ArchetypeVariant {
  id: number;
  badge: string;
  name: string;
  traitId: string;
  concern: string;
  targetScope: string;
  channels: string;
  conflicts: string;
  frameExpression: string;
  footerSpec: string;
  slug: string;
  code: string;
  html: string;
  type?: "animation" | "treatment";
  usageNote?: string;
}

interface AnimaArchetypeFull {
  id: number;
  serialNumber: string;
  badge: string;
  name: string;
  category: "typography" | "metrics" | "structures" | "processes" | "transformations" | "artifacts" | "communication";
  categoryLabel: string;
  definition: string;
  examplePrompt: string;
  traitId: string;
  concern: string;
  targetScope: string;
  channels: string;
  conflicts: string;
  frameExpression: string;
  audioLinkage: string;
  footerNote: string;
  slug: string;
  variants: ArchetypeVariant[];
  customCss: string;
}

// 1. TYPOGRAPHY 30 PRESETS (ANIMA #01)
const TYPOGRAPHY_30_PRESETS: ArchetypeVariant[] = [
  {
    id: 1,
    badge: "TYPO #01",
    name: "Apple Pro Display Hero Revealer",
    traitId: "trait_blur_up_reveal",
    concern: "MotionPhysics",
    targetScope: "word",
    channels: "filter.blur, opacity, translateY, scale",
    conflicts: "gooey_metaball_filter",
    frameExpression: "blurPx = max(0, 26 - (frame/30)*26)",
    footerSpec: "SF Pro Display 800 • Tracking -0.03em • Subpixel Blur-Up",
    slug: "apple-hero-reveal",
    code: "@keyframes apple-hero-anim { 0% { opacity: 0; transform: translateY(32px) scale(0.93); filter: blur(18px); } 100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0px); } }",
    html: `<div class="typo-apple-hero">THINK DIFFERENT.</div>`
  },
  {
    id: 2,
    badge: "TYPO #02",
    name: "Dynamic Staggered Char Cascade",
    traitId: "trait_staggered_rotate_x",
    concern: "MotionPhysics",
    targetScope: "glyph",
    channels: "rotateX, translateY, filter.blur",
    conflicts: "hand_drawn_svg_path",
    frameExpression: "rotateX = max(0, -90 + ((frame - idx*2.4)/20)*90)",
    footerSpec: "Per-character 3D RotateX • Stagger 0.08s",
    slug: "staggered-char-cascade",
    code: "@keyframes char-cascade-anim { 0% { opacity: 0; transform: translateY(28px) rotateX(-90deg); filter: blur(10px); } 100% { opacity: 1; transform: translateY(0) rotateX(0deg); } }",
    html: `<div class="char-box"><span class="char-item" style="animation-delay:0s; color:#fff;">P</span><span class="char-item" style="animation-delay:0.08s; color:#fff;">R</span><span class="char-item" style="animation-delay:0.16s; color:var(--accent-cyan);">O</span><span class="char-item" style="animation-delay:0.24s; color:#fff;">M</span><span class="char-item" style="animation-delay:0.32s; color:#fff;">E</span><span class="char-item" style="animation-delay:0.40s; color:var(--accent-purple);">T</span><span class="char-item" style="animation-delay:0.48s; color:#fff;">H</span><span class="char-item" style="animation-delay:0.56s; color:#fff;">E</span><span class="char-item" style="animation-delay:0.64s; color:#fff;">U</span><span class="char-item" style="animation-delay:0.72s; color:#fff;">S</span></div>`
  },
  {
    id: 3,
    badge: "TYPO #03",
    name: "Apple Keynote Headline Punch-In",
    traitId: "trait_keynote_punch",
    concern: "MotionPhysics",
    targetScope: "phrase",
    channels: "scale, opacity, filter.blur",
    conflicts: "None",
    frameExpression: "scale = frame < 12 ? (1.35 - (frame/12)*0.37) : 1.0",
    footerSpec: "Scale 1.35 to 1.0 • Focal Blur Recovery",
    slug: "keynote-punch-in",
    code: "@keyframes keynote-punch-anim { 0% { transform: scale(1.35); opacity: 0; filter: blur(16px); } 100% { transform: scale(1); opacity: 1; filter: blur(0px); } }",
    html: `<div class="typo-keynote-punch">ONE MORE THING.</div>`
  },
  {
    id: 4,
    badge: "TYPO #04",
    name: "Sub-Pixel Blur-Up Mask",
    traitId: "trait_blur_up_reveal",
    concern: "MotionPhysics",
    targetScope: "word",
    channels: "filter.blur, opacity, scale",
    conflicts: "gooey_metaball_filter",
    frameExpression: "blurPx = max(0, 26 - (frame/30)*26)",
    footerSpec: "Filter Blur 26px to 0px • Subpixel Mask",
    slug: "subpixel-blur-mask",
    code: "@keyframes blur-mask-anim { 0% { filter: blur(26px); opacity: 0; transform: scale(0.90); } 100% { filter: blur(0px); opacity: 1; transform: scale(1); } }",
    html: `<div class="typo-blur-mask">ULTRA CINEMATIC</div>`
  },
  {
    id: 5,
    badge: "TYPO #05",
    name: "TextRotate Kinetic Word Cycler",
    traitId: "trait_text_rotate_cycle",
    concern: "TemporalTrigger",
    targetScope: "word",
    channels: "translateY, opacity",
    conflicts: "None",
    frameExpression: "translateY = max(0, 100 - (frame/20)*100)",
    footerSpec: "Spring Physics • Stagger 0.025s Word Cycle",
    slug: "text-rotate-kinetic",
    code: ".text-rotate-pill { background: #ff5941; padding: 6px 16px; border-radius: 12px; }",
    html: `<div class="text-rotate-container"><span class="text-rotate-prefix">Make it</span><div class="text-rotate-pill"><span class="text-rotate-word"><span class="text-rotate-char" style="animation-delay:0.025s;">w</span><span class="text-rotate-char" style="animation-delay:0.05s;">o</span><span class="text-rotate-char" style="animation-delay:0.075s;">r</span><span class="text-rotate-char" style="animation-delay:0.1s;">k</span><span class="text-rotate-char" style="animation-delay:0.125s;">!</span></span></div></div>`
  },
  {
    id: 6,
    badge: "TYPO #06",
    name: "TextEffect (Gaussian Blur Reveal Sweep)",
    traitId: "trait_gaussian_blur_sweep",
    concern: "MotionPhysics",
    targetScope: "word",
    channels: "filter.blur, opacity",
    conflicts: "None",
    frameExpression: "blurPx = sin((frame - wordIdx*6)/30)*16",
    footerSpec: "White Stage • Charcoal SF Pro • Gaussian Blur Sweep",
    slug: "text-effect-exact-blur",
    code: "@keyframes exact-word-blur { 0% { opacity: 0.15; filter: blur(16px); } 35%, 75% { opacity: 1; filter: blur(0px); } 100% { opacity: 0.15; filter: blur(16px); } }",
    html: `<div class="exact-blur-stage"><div class="exact-blur-text"><span class="word-blur-1">Animate</span> <span class="word-blur-2">your</span> <span class="word-blur-3">ideas</span></div></div>`
  },
  {
    id: 7,
    badge: "TYPO #07",
    name: "HextaUI Typewriter & Ghost Cursor Engine",
    traitId: "trait_hexta_ghost_typewriter",
    concern: "TemporalTrigger",
    targetScope: "phrase",
    channels: "text.visibleLength, opacity",
    conflicts: "liquid_gooey_morph",
    frameExpression: "visibleCharCount = floor(frame / 2.5)",
    footerSpec: "Ghost Alpha Backspace • Active Cursor • Typewriter Loop",
    slug: "hexta-typewriter-engine",
    code: ".hexta-ghost-text { color: rgba(0,0,0,0.08); } .hexta-active-text { color: #1c1c1e; }",
    html: `<div class="hexta-typewriter-stage"><div class="hexta-typewriter-box"><span class="hexta-ghost-text">Welcome to HextaUI</span><span class="hexta-active-text">Welcome to HextaUI</span><span class="hexta-cursor">|</span></div></div>`
  },
  {
    id: 8,
    badge: "TYPO #08",
    name: "Vercel Kinetic Highlight Box Engine",
    traitId: "trait_vercel_yellow_pill",
    concern: "EnclosureAndAccents",
    targetScope: "word",
    channels: "scaleX, text.color",
    conflicts: "soft_lavender_pill",
    frameExpression: "scaleX = clamp(frame/18, 0, 1)",
    footerSpec: "Dark Stage • Yellow Pill (#ffd000) • Inverted Black Text",
    slug: "vercel-highlight-box",
    code: "@keyframes vercel-wipe { 0% { transform: scaleX(0); } 30%, 80% { transform: scaleX(1); } 100% { transform: scaleX(0); } }",
    html: `<div class="vercel-highlight-stage"><div class="vercel-highlight-box"><span>Made for</span><div class="vercel-yellow-pill"><div class="vercel-wipe-bg"></div><span class="vercel-highlight-text">builders.</span></div></div></div>`
  },
  {
    id: 9,
    badge: "TYPO #09",
    name: "Isometric 3D Kinetic Perspective Stack",
    traitId: "trait_isometric_3d_stack",
    concern: "CompositionGeometry",
    targetScope: "phrase",
    channels: "matrix3d, rotateX, rotateZ, skewX",
    conflicts: "hand_drawn_svg_path",
    frameExpression: "matrix3d = rotateX(38deg) rotateZ(-28deg) skewX(12deg)",
    footerSpec: "Studio Gray • 3D Matrix (38deg, -28deg, 12deg)",
    slug: "isometric-perspective-stack",
    code: ".iso-perspective-container { transform: rotateX(38deg) rotateZ(-28deg) skewX(12deg); }",
    html: `<div class="iso-perspective-stage"><div class="iso-perspective-container"><div class="iso-word" style="animation-delay:0s;">INFINITE</div><div class="iso-word" style="animation-delay:0.1s;">PROGRESS</div><div class="iso-word" style="animation-delay:0.2s;">INNOVATION</div><div class="iso-word" style="animation-delay:0.3s;">FUTURE</div></div></div>`
  },
  {
    id: 10,
    badge: "TYPO #10",
    name: "Hand-Drawn Kinetic SVG Underline Engine",
    traitId: "trait_hand_drawn_underline",
    concern: "EnclosureAndAccents",
    targetScope: "word",
    channels: "svg.strokeDashoffset, opacity",
    conflicts: "None",
    frameExpression: "strokeDashoffset = max(0, 320 - (frame/25)*320)",
    footerSpec: "White Stage • Charcoal SF Pro • SVG Draw Animation",
    slug: "hand-drawn-underline",
    code: "@keyframes svg-underline-draw { 0% { stroke-dashoffset: 320; } 60%, 85% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: 320; } }",
    html: `<div class="hand-drawn-stage"><div class="hand-drawn-text">Namaste World!</div><svg class="hand-drawn-svg" viewBox="0 0 300 20" fill="none"><path class="hand-drawn-path" d="M 5,8 Q 140,20 295,10" stroke="#000000" stroke-width="3.5" stroke-linecap="round" /></svg></div>`
  },
  {
    id: 11,
    badge: "TYPO #11",
    name: "Horizontal Linear Gradient Sweep & Fade Engine",
    traitId: "trait_gradient_fade_sweep",
    concern: "MaterialTreatment",
    targetScope: "word",
    channels: "background.position, opacity",
    conflicts: "metallic_chrome_3d",
    frameExpression: "bgPositionX = -100 + (frame/45)*200",
    footerSpec: "White Stage • Solid Black to Transparent Edge Mask",
    slug: "gradient-fade-sweep",
    code: "background: linear-gradient(90deg, #000 0%, rgba(0,0,0,0.5) 60%, transparent 95%); background-size: 200% 100%;",
    html: `<div class="gradient-fade-stage"><div class="gradient-fade-text">Mishra Hub</div></div>`
  },
  {
    id: 12,
    badge: "TYPO #12",
    name: "Designali Liquid Gooey Ink Morphing Engine",
    traitId: "trait_liquid_gooey_morph",
    concern: "MotionPhysics",
    targetScope: "word",
    channels: "filter.svgThreshold, scale, opacity",
    conflicts: "vector_stroke_outline",
    frameExpression: "filterMode = frame < 20 ? 'url(#goo) blur(4px)' : 'none'",
    footerSpec: "Liquid Ink Morphing • Crisp Resolution When Settled",
    slug: "designali-gooey-word-morph",
    code: "filter: url(#goo-threshold-html) blur(2px);",
    html: `<div class="gooey-morph-stage"><div class="gooey-ink-container"><span class="gooey-ink-word">Designali</span></div></div>`
  },
  {
    id: 13,
    badge: "TYPO #13",
    name: "Cinematic Viewport Mask Sweep Engine",
    traitId: "trait_cinematic_viewport_sweep",
    concern: "MaterialTreatment",
    targetScope: "phrase",
    type: "treatment",
    channels: "background.position, brightness",
    conflicts: "gradient_fade_sweep",
    frameExpression: "bgPositionX = sin((frame/540)*2π)*100",
    footerSpec: "Dark Stage • Ultra-Slow Viewport Sweep (18s) • Pure Stylization",
    slug: "cinematic-viewport-sweep",
    code: "background-image: url('https://images.unsplash.com/photo-1506744038136-46273834b3fb'); -webkit-background-clip: text;",
    html: `<div class="masked-glyph-stage"><div class="cinematic-sweep-text">STUNNING</div></div>`
  },
  {
    id: 14,
    badge: "TYPO #14",
    name: "Elegant Per-Word Spring Blur Physics Engine",
    traitId: "trait_per_word_spring_blur",
    concern: "MotionPhysics",
    targetScope: "word",
    channels: "filter.blur, opacity, translateY",
    conflicts: "liquid_gooey_morph",
    frameExpression: "blurPx = max(0, 16 - ((frame - wordIdx*2.4)/15)*16)",
    footerSpec: "Dark Stage • Per-Word Stagger • Spring Blur Physics",
    slug: "elegant-blur-physics",
    code: "@keyframes elegant-word-physics { 0% { filter: blur(16px); opacity: 0; } 25%, 80% { filter: blur(0); opacity: 1; } }",
    html: `<div class="elegant-blur-stage"><div class="elegant-blur-paragraph"><span class="blur-word">The</span> <span class="blur-word">future</span> <span class="blur-word">of</span> <span class="blur-word">video</span> <span class="blur-word">creation</span></div></div>`
  },
  {
    id: 15,
    badge: "TYPO #15",
    name: "Cyber Matrix Text Scramble Engine",
    traitId: "trait_cyber_matrix_scramble",
    concern: "TemporalTrigger",
    targetScope: "word",
    channels: "text.scrambleString, opacity",
    conflicts: "None",
    frameExpression: "revealedCharCount = floor(frame / 3)",
    footerSpec: "Dark Stage • Neon Yellow Bar (#ffff00) • Matrix Scramble",
    slug: "matrix-scramble-highlight",
    code: ".matrix-yellow-bar { background: #ffff00; color: #000; font-family: monospace; font-weight: 900; }",
    html: `<div class="matrix-scramble-stage"><div class="matrix-yellow-bar">DYNAMIC TEXT</div><div class="matrix-sub-text">MATRIX RESOLVE</div></div>`
  },
  {
    id: 16,
    badge: "TYPO #16",
    name: "Motion Primitives Kinetic Glyph Slot Engine",
    traitId: "trait_slot_bounce",
    concern: "MotionPhysics",
    targetScope: "glyph",
    channels: "translateY, scale, color",
    conflicts: "gooey_metaball_filter",
    frameExpression: "subY = sin((frame/60)*2π)*8 | superY = -sin((frame/60)*2π)*10",
    footerSpec: "White Stage • Kinetic Subscript ('o') & Superscript ('t') Bounces",
    slug: "motion-primitives-slot",
    code: "@keyframes slot-bounce-sub { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(8px); } }",
    html: `<div class="motion-primitives-stage"><div class="motion-primitives-box"><span>m</span><span class="slot-sub">o</span><span class="slot-super">t</span><span>ion-primitives</span></div></div>`
  },
  {
    id: 17,
    badge: "TYPO #17",
    name: "Apple Metallic Chrome 3D Count-Up Hero Engine",
    traitId: "trait_metallic_chrome_3d",
    concern: "MaterialTreatment",
    targetScope: "phrase",
    channels: "background.gradient, dropShadow",
    conflicts: "vector_stroke_outline",
    frameExpression: "countVal = floor(easeOutQuart(frame/72) * 404)",
    footerSpec: "Dark Stage • Metallic Chrome Gradient • Smooth Count-Up",
    slug: "apple-metallic-chrome-counter",
    code: "background: linear-gradient(180deg, #fff 0%, #e4e4e7 35%, #71717a 70%, #27272a 100%); -webkit-background-clip: text;",
    html: `<div class="chrome-hero-stage"><div class="chrome-counter-title">404</div></div>`
  },
  {
    id: 18,
    badge: "TYPO #18",
    name: "Designali Soft Lavender Highlight Selection Engine",
    traitId: "trait_soft_lavender_pill",
    concern: "EnclosureAndAccents",
    targetScope: "word",
    channels: "background.color, text.color",
    conflicts: "vercel_yellow_pill",
    frameExpression: "pillAlpha = 0.9 | cursorBlink = floor(frame/24)%2 === 0 ? 1 : 0",
    footerSpec: "White Stage • Soft Lavender Pill Selection • Purple Cursor",
    slug: "designali-soft-highlight",
    code: ".lavender-highlight-pill { background: rgba(243, 232, 255, 0.9); color: #7e22ce; }",
    html: `<div class="soft-highlight-stage"><div class="soft-highlight-box"><span>Design</span><div class="lavender-highlight-pill"><span class="soft-pill-word">Limitless</span><span class="soft-cursor-line"></span></div></div></div>`
  },
  {
    id: 19,
    badge: "TYPO #19",
    name: "Electric Blue Emoji Line Revealer Engine",
    traitId: "trait_emoji_line_reveal",
    concern: "MotionPhysics",
    targetScope: "layer",
    channels: "translateY, opacity",
    conflicts: "None",
    frameExpression: "translateY = max(0, 115 - ((frame - lineIdx*5.0)/20)*115)",
    footerSpec: "Dotted Grid Stage • Electric Royal Blue • Staggered Blind Slide",
    slug: "emoji-line-reveal",
    code: "@keyframes emoji-line-up { 0% { transform: translateY(115%); } 25%, 85% { transform: translateY(0%); } }",
    html: `<div class="emoji-line-stage"><div class="emoji-line-mask"><div class="emoji-line-content">HI 👋, FRIEND!</div></div><div class="emoji-line-mask"><div class="emoji-line-content" style="animation-delay:0.16s;">🌤️ IT IS NICE ↗ TO MEET 😊</div></div></div>`
  },
  {
    id: 20,
    badge: "TYPO #20",
    name: "21st.dev Vector Stroke Outline & Sparkle Engine",
    traitId: "trait_vector_stroke_outline",
    concern: "MaterialTreatment",
    targetScope: "word",
    channels: "text.stroke, fillColor, opacity",
    conflicts: "metallic_chrome_3d",
    frameExpression: "strokeWidthPx = 1.5 | fillOpacity = frame>25 ? 1.0 : 0.0",
    footerSpec: "Dark Stage • Thin Vector Stroke • Tracing Sparkle Star",
    slug: "21st-dev-outline-sparkle",
    code: "@keyframes stroke-star-trace { 0% { transform: translateX(-140px); } 100% { transform: translateX(140px); } }",
    html: `<div class="stroke-sparkle-stage"><div class="stroke-sparkle-title">21st.dev <span class="star-sparkle-glyph">✦</span></div></div>`
  },
  {
    id: 21,
    badge: "TYPO #21",
    name: "Figma Collaborative Frame Expansion Engine",
    traitId: "trait_figma_vector_frame",
    concern: "EnclosureAndAccents",
    targetScope: "word",
    channels: "border.color, scaleX, scaleY",
    conflicts: "vercel_yellow_pill",
    frameExpression: "scaleX = clamp(frame/18, 0, 1)",
    footerSpec: "Dark Stage • Animated Frame Expansion • Vector Cursor Pointers",
    slug: "collaborative-headline",
    code: ".figma-select-box-animated { border: 2px solid #60a5fa; box-shadow: 0 0 16px rgba(96,165,250,0.5); }",
    html: `<div class="collab-stage"><div class="collab-box"><div class="figma-word1-wrap"><div class="figma-select-box-animated"></div><span>Design</span><div class="user-cursor-pointer-1"><svg width="22" height="22" viewBox="0 0 24 24" fill="#ea580c"><path d="M3 3l7 18 3-7 7-3L3 3z"/></svg></div></div><div class="figma-word2-wrap"><span>together</span><div class="user-cursor-pointer-2"><svg width="22" height="22" viewBox="0 0 24 24" fill="#2563eb"><path d="M3 3l7 18 3-7 7-3L3 3z"/></svg></div></div></div></div>`
  },
  {
    id: 22,
    badge: "TYPO #22",
    name: "Hybrid Cross-Bred Figma Frame & Kinetic Slot Engine",
    traitId: "trait_figma_vector_frame + trait_slot_bounce",
    concern: "Multi-Layer Trait Fusion",
    targetScope: "hero + accent",
    channels: "border.color, translateY, scale",
    conflicts: "None",
    frameExpression: "Enclosure = figma-frame | Motion = slot-bounce ('o' & 'r')",
    footerSpec: "White Stage • Figma Frame Expansion + Character Slot Bouncing",
    slug: "hybrid-collab-slot",
    code: "Enclosure = figma-frame | Motion = slot-bounce ('o' & 'r')",
    html: `<div class="hybrid-collab-stage"><div class="hybrid-box"><div class="figma-word1-wrap"><div class="figma-select-box-animated"></div><span>m</span><span class="slot-sub">o</span><span>tion</span></div><div class="figma-word2-wrap"><span>p</span><span class="slot-super">r</span><span>imitives</span></div></div></div>`
  },
  {
    id: 23,
    badge: "TYPO #23",
    name: "Glow Search Input & Pulsing Caret Engine",
    traitId: "trait_glow_search_caret",
    concern: "EnclosureAndAccents",
    targetScope: "word",
    channels: "background.glow, caret.blink",
    conflicts: "None",
    frameExpression: "glowScaleX = clamp(frame/20, 0, 1) | caretBlink = floor(frame/15)%2 === 0 ? 1 : 0",
    footerSpec: "Dark Input Stage • Soft Blue Glow (#3b82f6) • Pulsing Caret Cursor",
    slug: "glow-search-input",
    code: ".search-glow-bg { background: rgba(59, 130, 246, 0.3); filter: blur(12px); }",
    html: `<div class="glow-search-box"><div class="search-glow-bg"></div><div class="search-caret-line"></div><div class="search-text-content">Search query...</div></div>`
  },
  {
    id: 24,
    badge: "TYPO #24",
    name: "Dotted Grid Canvas & Blue Text Shimmer Wave Engine",
    traitId: "trait_dotted_shimmer_wave",
    concern: "MaterialTreatment + TemporalTrigger",
    targetScope: "phrase",
    channels: "background.dotGrid, text.shimmerGradient, translateY.wavePulse",
    conflicts: "None",
    frameExpression: "shimmerPos = (frame % 90) / 90 * 200% | waveY = sin((frame - charIdx*3)/15)*5",
    footerSpec: "Fine Dotted Canvas • Royal Blue Shimmer Sweep • Fluid Wave Micro-Pulse",
    slug: "dotted-shimmer-wave",
    code: "background: linear-gradient(90deg, #1d4ed8 0%, #3b82f6 20%, #fff 50%, #3b82f6 80%, #1d4ed8 100%); -webkit-background-clip: text;",
    html: `<div class="dotted-shimmer-stage"><div class="dotted-shimmer-box"><span class="shimmer-wave-text">Creating the perfect video...</span></div></div>`
  },
  {
    id: 25,
    badge: "TYPO #26",
    name: "Top-Down Staggered Character Drop Engine",
    traitId: "trait_top_down_letters",
    concern: "MotionPhysics",
    targetScope: "glyph",
    channels: "translateY, opacity, filter.blur, scale",
    conflicts: "None",
    frameExpression: "translateY = min(0, -44 + (frame - charIdx*2.5)*1.8) | blurPx = max(0, 14 - (frame - charIdx*2.5)*0.6)",
    footerSpec: "White Studio Stage • Per-Character Top Down Cascade • Focal Blur & Spring",
    slug: "top-down-letters",
    code: "@keyframes top-down-letter-drop { 0% { opacity: 0; transform: translateY(-44px); filter: blur(14px); } 100% { opacity: 1; transform: translateY(0); filter: blur(0); } }",
    html: `<div class="top-down-stage"><div class="top-down-box">Hello World</div></div>`
  },
  {
    id: 26,
    badge: "TYPO #27",
    name: "Dotted Grid Canvas & Elastic Word Pull Engine",
    traitId: "trait_dotted_word_pull",
    concern: "MotionPhysics + LayoutComposition",
    targetScope: "phrase",
    channels: "translateX, opacity, filter.blur, letterSpacing",
    conflicts: "None",
    frameExpression: "pullX = max(0, 80 - (frame/20)*80) | pullOpacity = clamp(frame/15, 0, 0.45)",
    footerSpec: "Dot Canvas Stage • Solid Black Lead Word • Horizontal Translucent Elastic Pull",
    slug: "dotted-word-pull",
    code: "@keyframes word-pull-secondary-slide { 0% { opacity: 0; transform: translateX(80px); filter: blur(16px); } 100% { opacity: 0.45; transform: translateX(0); } }",
    html: `<div class="word-pull-stage"><div class="word-pull-box"><span class="word-pull-primary">Word</span><span class="word-pull-secondary">Pull</span></div></div>`
  },
  {
    id: 27,
    badge: "TYPO #28",
    name: "Obsidian Stage & LED Dot-Matrix Scanline Engine",
    traitId: "trait_led_dot_matrix",
    concern: "MaterialTreatment + TextureFusion",
    targetScope: "phrase",
    channels: "background.dotMask, text.ledGlow, filter.scanline",
    conflicts: "None",
    frameExpression: "ledScanX = (frame % 90) / 90 * 200% | dotGlow = 0.96 + sin((frame/12)*π)*0.04",
    footerSpec: "Obsidian Stage • High-Density LED Matrix Dot Grid • Phosphor Bloom & Scanline",
    slug: "led-dot-matrix",
    code: ".led-matrix-text { background: radial-gradient(circle, #fff 42%, #94a3b8 68%, transparent 72%); -webkit-background-clip: text; }",
    html: `<div class="led-matrix-stage"><div class="led-matrix-box"><span class="led-matrix-text">DESIGN</span></div></div>`
  },
  {
    id: 28,
    badge: "TYPO #29",
    name: "Geometric Circle Inversion & Kinetic Contrast Engine",
    traitId: "trait_geometric_circle_inversion",
    concern: "MaterialTreatment + LayoutComposition",
    targetScope: "phrase",
    channels: "container.orbPosition, text.mixBlendMode, text.tracking",
    conflicts: "None",
    frameExpression: "orbX = sin((frame/30)*π)*50 | blendMode = 'difference'",
    footerSpec: "White Studio Stage • Floating Black Circle Orb • CSS Difference Blend Mode",
    slug: "circle-inversion",
    code: ".invert-text-container { mix-blend-mode: difference; } .invert-circle-orb { background: #000; border-radius: 50%; }",
    html: `<div class="circle-invert-stage"><div class="invert-circle-orb"></div><div class="invert-text-container"><span class="invert-text-line" style="font-size:38px; font-weight:900;">ELEVATE</span><span class="invert-text-line" style="font-size:38px; font-weight:900;">VISION</span></div></div>`
  },
  {
    id: 29,
    badge: "TYPO #30",
    name: "Cyber Acid Lime Heavy Grotesque & Matrix Glitch Engine",
    traitId: "trait_acid_lime_letter_glitch",
    concern: "MotionPhysics + GlyphDisplace",
    targetScope: "glyph",
    channels: "transform.translate, filter.rgbSplit, text.color, opacity",
    conflicts: "None",
    frameExpression: "glitchJitterX = sin((frame - glyphIdx*2.2)*14) * max(0, 10 - (frame/20)*10)",
    footerSpec: "Dark Obsidian • Heavy Grotesque Sans 900 • Letter-by-Letter Cyber RGB Matrix Glitch",
    slug: "acid-lime-glitch",
    code: "@keyframes lime-glyph-glitch-in { 0% { opacity: 0; filter: drop-shadow(-8px 0 0 #00ffff) drop-shadow(8px 0 0 #ff0055); } 100% { opacity: 1; filter: none; } }",
    html: `<div class="acid-lime-glitch-stage"><div class="glitch-word-stack"><div class="glitch-line-white"><span class="lime-glitch-char">g</span><span class="lime-glitch-char">l</span><span class="lime-glitch-char">i</span><span class="lime-glitch-char">t</span><span class="lime-glitch-char">c</span><span class="lime-glitch-char">h</span></div><div class="glitch-line-lime"><span class="lime-glitch-char lime-accent">m</span><span class="lime-glitch-char lime-accent">a</span><span class="lime-glitch-char lime-accent">t</span><span class="lime-glitch-char lime-accent">r</span><span class="lime-glitch-char lime-accent">i</span><span class="lime-glitch-char lime-accent">x</span></div></div></div>`
  },
  {
    id: 30,
    badge: "TYPO #31",
    name: "Kinetic Sandstorm Particle Disintegration & Grain Dissolve (Ref Screenshot 01)",
    traitId: "trait_sandstorm_grain_dissolve",
    concern: "MaterialTreatment + MotionPhysics",
    targetScope: "stippled_glyph_cluster",
    channels: "filter.noise, transform.translate, opacity, filter.blur",
    conflicts: "None",
    frameExpression: "sandScatterX = sin(frame / 15) * 25px | windSweep = (frame % 60) / 60 * 100%",
    footerSpec: "Ocean/Space Dark Backdrop • Granular Stippled Particles • 45° Sandstorm Wind Sweep • Continuous Disintegration & Reformation",
    slug: "sandstorm-grain-dissolve",
    code: `.sand-text-block { filter: url(#sandStippleGlow); } .sand-wind-streak { animation: sand-wind-drift 3.8s ease-in-out infinite alternate; }`,
    html: `<div class="typo-sand-stage"><svg class="typo-sand-defs" style="position: absolute; width: 0; height: 0;"><defs><filter id="sandStippleGlow" x="-50%" y="-50%" width="200%" height="200%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" result="sandNoise"/><feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 16 -4" result="hardNoise"/><feComposite in="SourceGraphic" in2="hardNoise" operator="in" result="sandText"/><feGaussianBlur in="sandText" stdDeviation="1.5" result="sandGlow"/><feMerge><feMergeNode in="sandGlow"/><feMergeNode in="sandText"/></feMerge></filter></defs></svg><div class="typo-sand-container"><div class="sand-wind-streak"></div><div class="sand-particle-cloud"><span class="sand-grain g1"></span><span class="sand-grain g2"></span><span class="sand-grain g3"></span><span class="sand-grain g4"></span><span class="sand-grain g5"></span><span class="sand-grain g6"></span><span class="sand-grain g7"></span><span class="sand-grain g8"></span></div><div class="sand-text-block"><div class="sand-line l1">SAND</div><div class="sand-line l2">TYPO</div></div></div></div>`
  }
  ,{
    id: 31, badge: "TYPO #32", name: "Canva Tall Glyph Stack Treatment",
    traitId: "trait_canva_tall_glyph_stack", concern: "TallFontSubjectMask", targetScope: "tall_word",
    type: "treatment",
    channels: "translateY, rotateZ, letterSpacing", conflicts: "wide_sentence_layout",
    frameExpression: "glyphTilt = sin((frame-glyphIdx*4)/10)*4", footerSpec: "Condensed tall glyphs • Independent stagger/tilt • Behind-subject only",
    slug: "canva-tall-glyph-stack", code: ".overlap-tilt-char { animation: canva-tall-stack 1.1s both; }",
    html: `<div style="height:100%;display:grid;place-items:center;background:#111"><style>@keyframes canvaRef{0%{transform:translateY(28px) rotate(-6deg);opacity:0}70%{transform:translateY(-4px) rotate(2deg)}100%{transform:translateY(0) rotate(0);opacity:1}}</style><div style="font:900 58px/.8 'Bebas Neue',sans-serif;letter-spacing:1px;color:#e9e9e9">${"CANVA".split("").map((c,i)=>`<span style="display:inline-block;animation:canvaRef .7s ${i*.1}s both">${c}</span>`).join("")}</div></div>`
  },
  {
    id: 32,
    badge: "TYPO #33",
    name: "High-Tech Kinetic Typography — Brands",
    traitId: "trait_hightech_chromatic_brands",
    concern: "MotionPhysics + ChromaticAberration",
    targetScope: "word",
    channels: "filter.displacement, filter.blur, transform.translate, mixBlendMode",
    conflicts: "None",
    frameExpression: "warpScale = sin(frame * 0.08) * 6 | redShiftX = sin(frame * 0.15) * 4",
    footerSpec: "Syne 800 • SVG Cinematic Warp & Glitch Blur • Cyan/Red Chromatic Aberration",
    slug: "hightech-kinetic-brands",
    code: ".brands-cyan-shift { fill: #00ffff; animation: brandsCyanGlitch 2.5s infinite; }",
    html: `<div class="typo-brands-stage"><div class="brands-glow-backdrop"></div><div class="brands-scanlines"></div><div class="brands-viewport"><svg class="brands-wordmark" viewBox="0 0 450 120" xmlns="http://www.w3.org/2000/svg"><defs><filter id="brands-cinematic-warp-anima" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.02 0.05" numOctaves="2" result="noise" /><feDisplacementMap in="SourceGraphic" in2="noise" scale="6" xChannelSelector="R" yChannelSelector="G" result="displaced" /><feGaussianBlur in="displaced" stdDeviation="0.4" result="blurred" /><feMerge><feMergeNode in="blurred" /><feMergeNode in="SourceGraphic" /></feMerge></filter><filter id="brands-glitch-blur-anima"><feGaussianBlur stdDeviation="0"><animate attributeName="stdDeviation" values="0;2;0.2;5;0;1;0" dur="3s" repeatCount="indefinite" /></feGaussianBlur></filter></defs><text x="15" y="90" class="brands-brand-text brands-red-shift" filter="url(#brands-glitch-blur-anima)">brands</text><text x="15" y="90" class="brands-brand-text brands-cyan-shift" filter="url(#brands-glitch-blur-anima)">brands</text><text x="15" y="90" class="brands-brand-text" filter="url(#brands-cinematic-warp-anima)">brands</text></svg></div></div>`
  },
  {
    id: 33,
    badge: "TYPO #34",
    name: "Kinetic Cyber Typography — They Need",
    traitId: "trait_kinetic_cyber_they_need",
    concern: "MotionPhysics + TemporalTrigger",
    targetScope: "phrase",
    channels: "width, filter.blur, transform.skewX, transform.scale, opacity",
    conflicts: "None",
    frameExpression: "needWidth = interpolate(frame % 120, [18, 42, 96, 120], [0, 2.7, 2.7, 0])",
    footerSpec: "Plus Jakarta Sans 800 • Perspective 3D Floor Grid • Expanding Kinetic Word & HUD Line",
    slug: "kinetic-cyber-they-need",
    code: ".they-need-word-need { animation: theyNeedKineticExpand 4s cubic-bezier(0.16, 1, 0.3, 1) infinite; }",
    html: `<div class="typo-they-need-stage"><div class="they-need-energy-field"></div><div class="they-need-grid-overlay"></div><div class="they-need-stage-content"><div class="they-need-text-wrapper"><span class="they-need-word they-need-word-they">they</span><span class="they-need-word they-need-word-need">need</span></div><div class="they-need-hud-line"></div></div></div>`
  },
  {
    id: 34,
    badge: "TYPO #35",
    name: "Kinetic Glow Sweep — Attention",
    traitId: "trait_kinetic_glow_sweep_attention",
    concern: "MotionPhysics + MaterialTreatment",
    targetScope: "glyph",
    channels: "textShadow, color, transform.scale, filter.blur",
    conflicts: "None",
    frameExpression: "charGlow = sin((frame - charIdx*3.6)/30) * 130px",
    footerSpec: "Plus Jakarta Sans 800 • High-Tech Grid Backdrop • Sequential Character Bloom Wave",
    slug: "kinetic-glow-sweep-attention",
    code: ".glow-sweep-char { animation: sweepGlowAnim 3.2s cubic-bezier(0.25, 1, 0.5, 1) infinite; }",
    html: `<div class="typo-glow-sweep-stage"><div class="glow-sweep-grid-bg"></div><div class="glow-sweep-ambient"></div><div class="glow-sweep-scanlines"></div><div class="glow-sweep-container"><h1 class="glow-sweep-word" aria-label="attention"><span class="glow-sweep-char" style="--index: 0">a</span><span class="glow-sweep-char" style="--index: 1">t</span><span class="glow-sweep-char" style="--index: 2">t</span><span class="glow-sweep-char" style="--index: 3">e</span><span class="glow-sweep-char" style="--index: 4">n</span><span class="glow-sweep-char" style="--index: 5">t</span><span class="glow-sweep-char" style="--index: 6">i</span><span class="glow-sweep-char" style="--index: 7">o</span><span class="glow-sweep-char" style="--index: 8">n</span></h1></div></div>`
  },
  {
    id: 35,
    badge: "TYPO #36",
    name: "Kinetic Word-by-Word Typography — Fast",
    traitId: "trait_kinetic_word_fast_pulse",
    concern: "MotionPhysics + TemporalTrigger",
    targetScope: "word",
    channels: "filter.blur, opacity, textShadow, transform.translateY, transform.scale",
    conflicts: "None",
    frameExpression: "staggerCycle = 0.45s per word | pulseScale = 1.06",
    footerSpec: "Plus Jakarta Sans 800 • High-Speed Stagger • Focal Flash & Rapid Recovery",
    slug: "kinetic-word-fast-pulse",
    code: ".word-fast-item { animation: rapidWordPulseAnim 1.35s cubic-bezier(0.05, 0.7, 0.1, 1) infinite; }",
    html: `<div class="typo-word-fast-stage"><div class="word-fast-ambient"></div><div class="word-fast-sentence"><span class="word-fast-item">Text</span><span class="word-fast-item">isn't</span><span class="word-fast-item">just</span></div></div>`
  },
  {
    id: 36,
    badge: "TYPO #37",
    name: "Kinetic Dynamic Slant — Watch It Move",
    traitId: "trait_kinetic_dynamic_slant_move",
    concern: "MotionPhysics + MaterialTreatment",
    targetScope: "word",
    channels: "transform.skewX, transform.translateX, textShadow, color",
    conflicts: "None",
    frameExpression: "skewAngle = -12deg to -32deg | trailPulse = 0.3 to 0.9",
    footerSpec: "Plus Jakarta Sans 800 Italic • Ambient Orange Core • Dynamic Kinetic Slant & Ghost Trail",
    slug: "kinetic-dynamic-slant-move",
    code: ".dynamic-slant-move { animation: dynamicKineticSlantAnim 2.2s cubic-bezier(0.2, 0.8, 0.2, 1) infinite; }",
    html: `<div class="typo-dynamic-slant-stage"><div class="dynamic-slant-ambient"></div><div class="dynamic-slant-sentence"><span class="dynamic-slant-static">Watch</span><span class="dynamic-slant-static">it</span><span class="dynamic-slant-move">move</span></div></div>`
  },
  {
    id: 37,
    badge: "TYPO #38",
    name: "Kinetic Chromatic Typewriter Effect",
    traitId: "trait_kinetic_chromatic_typewriter",
    concern: "TemporalTrigger + ChromaticAberration",
    targetScope: "phrase",
    channels: "text.visibleLength, textShadow, transform.translate, opacity",
    conflicts: "None",
    frameExpression: "charStep = 85ms + jitter(40ms) | rgbSplit = 3px",
    footerSpec: "Plus Jakarta Sans 800 • Film Scratch Flicker • RGB Split Dynamic Typewriter & CRT Jitter",
    slug: "kinetic-chromatic-typewriter",
    code: ".typewriter-chromatic-text { animation: typewriterChromaticJitter 0.12s infinite alternate; }",
    html: `<div class="typo-typewriter-stage"><div class="typewriter-film-scratch"></div><div class="typewriter-viewport-track"><span class="typewriter-chromatic-text" data-text=""></span><span class="typewriter-cursor"></span></div></div>`
  },
  {
    id: 38,
    badge: "TYPO #39",
    name: "3D Metallic Chrome Counter — Edits Later",
    traitId: "trait_3d_metallic_chrome_counter",
    concern: "MaterialTreatment + MotionPhysics",
    targetScope: "metric_number",
    channels: "number.value, text.specularStroke, filter.dropShadow, backgroundClip",
    conflicts: "None",
    frameExpression: "easeOut = 1 - pow(1 - progress, 3) | count = 0 -> 110",
    footerSpec: "Anton + Plus Jakarta Sans • 3D Specular Chrome Metallic Fill • Exponential Ease-Out Count Up",
    slug: "3d-metallic-chrome-counter",
    code: ".chrome-counter-main { background: linear-gradient(175deg, #ffffff 0%, #3b76cc 28%, #82b8f8 98%); }",
    html: `<div class="typo-chrome-counter-stage"><div class="chrome-counter-dot-matrix"></div><div class="chrome-counter-ambient"></div><div class="chrome-counter-stage-content"><div class="chrome-counter-num-wrapper"><div class="chrome-counter-shadow">0</div><div class="chrome-counter-main">0</div><div class="chrome-counter-outline">0</div><div class="chrome-counter-overlay-text">edits later</div></div></div></div>`
  },
  {
    id: 39,
    badge: "TYPO #40",
    name: "Apple-Style Kinetic Gaussian Chrome — GOAL",
    traitId: "trait_apple_gaussian_chrome_goal",
    concern: "MotionPhysics + MaterialTreatment",
    targetScope: "glyph",
    channels: "filter.blur, opacity, transform.translateY, transform.scale, transform.rotateX",
    conflicts: "None",
    frameExpression: "spring = cubic-bezier(0.16, 1, 0.3, 1) | blur = 28px -> 0px",
    footerSpec: "Anton • Apple Liquid Metallic Chrome Gradient • Fluid Gaussian Blur & Focus Pop",
    slug: "apple-gaussian-chrome-goal",
    code: ".apple-gaussian-char.lit { opacity: 1; filter: blur(0px) drop-shadow(0 0 20px rgba(0,230,255,0.8)); }",
    html: `<div class="typo-apple-gaussian-stage"><div class="apple-gaussian-ambient"></div><div class="apple-gaussian-stage-content"><span class="apple-gaussian-char" data-text="G">G</span><span class="apple-gaussian-char" data-text="O">O</span><span class="apple-gaussian-char" data-text="A">A</span><span class="apple-gaussian-char" data-text="L">L</span></div></div>`
  },
  {
    id: 40,
    badge: "TYPO #41",
    name: "Cinematic Apple-Style Word-by-Word Bounce",
    traitId: "trait_cinematic_apple_word_bounce",
    concern: "MotionPhysics + ElasticSpring",
    targetScope: "word",
    channels: "filter.blur, transform.translateY, transform.scale, transform.rotateX, opacity",
    conflicts: "None",
    frameExpression: "spring = cubic-bezier(0.16, 1, 0.3, 1) | blur = 40px -> 0px",
    footerSpec: "Inter 900 • Platinum Metallic Gradient • Apple-Style 3D Spring Bounce Physics",
    slug: "cinematic-apple-word-bounce",
    code: ".apple-bounce-word.bounce-in { animation: appleCinematicBounceAnim 1.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }",
    html: `<div class="typo-apple-bounce-stage"><div class="apple-bounce-ambient"></div><div class="apple-bounce-stage-content"><div class="apple-bounce-line"><div class="apple-bounce-word-box"><span class="apple-bounce-word bw-1">Apple</span></div><div class="apple-bounce-word-box"><span class="apple-bounce-word bw-2">style</span></div></div><div class="apple-bounce-line"><div class="apple-bounce-word-box"><span class="apple-bounce-word bw-3">bounce</span></div><div class="apple-bounce-word-box"><span class="apple-bounce-word bw-4">animations</span></div></div></div></div>`
  },
  {
    id: 41,
    badge: "TYPO #42",
    name: "Cinematic Distance Convergence — In This Field",
    traitId: "trait_cinematic_distance_convergence",
    concern: "MotionPhysics + TrackingConvergence",
    targetScope: "phrase",
    channels: "letterSpacing, wordSpacing, filter.blur, transform.scale, opacity",
    conflicts: "None",
    frameExpression: "tracking = 0.45em -> -0.055em | blur = 35px -> 0px",
    footerSpec: "Plus Jakarta Sans 800 • Gaussian Blur Tracking Convergence • RGB Fringe Aberration",
    slug: "cinematic-distance-convergence",
    code: "@keyframes convergenceCloseDistance { 0% { letter-spacing: 0.45em; filter: blur(28px); } 70% { letter-spacing: -0.055em; filter: blur(0px); } }",
    html: `<div class="typo-convergence-stage"><div class="convergence-ambient"></div><div class="convergence-stage-content"><h1 class="convergence-text-cinematic">in this field</h1></div></div>`
  }
];

// 2. MICRO ASSET 15 ADVANCED MOTION PRESETS (ANIMA #02 - INSTAGRAM ICON SUBJECT)
const MICRO_ASSET_15_PRESETS: ArchetypeVariant[] = [
  {
    id: 1,
    badge: "MICRO #01",
    name: "Bézier Kinetic Spring & Dynamic Overshoot Snap",
    traitId: "trait_bezier_spring_overshoot",
    concern: "MotionPhysics",
    targetScope: "asset_mesh",
    channels: "scale, rotate, translateY, filter.dropShadow",
    conflicts: "None",
    frameExpression: "scale = easeOutElastic(frame / 45) * 1.0",
    footerSpec: "Cubic-Bézier (0.34, 1.56, 0.64, 1) • Dynamic Rotation Recovery",
    slug: "bezier-spring-overshoot",
    code: `@keyframes ig-bezier-spring { 0% { transform: scale(0.15) rotate(-24deg) translateY(40px); opacity: 0; } 60% { transform: scale(1.18) rotate(4deg) translateY(-8px); opacity: 1; } 80% { transform: scale(0.95) rotate(-1deg) translateY(2px); } 100% { transform: scale(1) rotate(0deg) translateY(0); filter: drop-shadow(0 14px 28px rgba(220,39,67,0.4)); } }`,
    html: `<div class="ig-stage"><div class="ig-bezier-spring-card"><svg class="ig-svg-box" viewBox="0 0 100 100"><defs><linearGradient id="ig-g1" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#ffd600"/><stop offset="25%" stop-color="#ff0100"/><stop offset="50%" stop-color="#d800b9"/><stop offset="100%" stop-color="#7000ff"/></linearGradient></defs><rect class="ig-bg" x="8" y="8" width="84" height="84" rx="22" fill="url(#ig-g1)"/><rect class="ig-stroke" x="20" y="20" width="60" height="60" rx="16" stroke="#fff" stroke-width="6.5" fill="none"/><circle class="ig-lens" cx="50" cy="50" r="15" stroke="#fff" stroke-width="6.5" fill="none"/><circle class="ig-dot" cx="66" cy="34" r="4.2" fill="#fff"/></svg></div></div>`
  },
  {
    id: 2,
    badge: "MICRO #02",
    name: "Subpixel Gaussian Focal Blur-Up & Resolving Bloom",
    traitId: "trait_subpixel_blur_bloom",
    concern: "MaterialTreatment",
    targetScope: "asset_material",
    channels: "filter.blur, opacity, scale, filter.dropShadow",
    conflicts: "gooey_metaball_filter",
    frameExpression: "blurPx = max(0, 28 - (frame/25)*28)",
    footerSpec: "Pure Gaussian Focal Blur 28px to 0px • Resolving Specular Bloom",
    slug: "subpixel-blur-bloom",
    code: `@keyframes ig-blur-reveal { 0% { filter: blur(28px); opacity: 0; transform: scale(0.82); } 100% { filter: blur(0px); opacity: 1; transform: scale(1); } }`,
    html: `<div class="ig-stage"><div class="ig-blur-flare-card"><svg class="ig-svg-box" viewBox="0 0 100 100"><defs><linearGradient id="ig-g2" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#ffd600"/><stop offset="25%" stop-color="#ff0100"/><stop offset="50%" stop-color="#d800b9"/><stop offset="100%" stop-color="#7000ff"/></linearGradient></defs><rect class="ig-bg" x="8" y="8" width="84" height="84" rx="22" fill="url(#ig-g2)"/><rect class="ig-stroke" x="20" y="20" width="60" height="60" rx="16" stroke="#fff" stroke-width="6.5" fill="none"/><circle class="ig-lens" cx="50" cy="50" r="15" stroke="#fff" stroke-width="6.5" fill="none"/><circle class="ig-dot" cx="66" cy="34" r="4.2" fill="#fff"/></svg></div></div>`
  },
  {
    id: 3,
    badge: "MICRO #03",
    name: "Parametric Liquid SVG Stroke Tracing & Path Unfurl",
    traitId: "trait_liquid_svg_stroke_draw",
    concern: "MotionPhysics",
    targetScope: "svg_path",
    channels: "strokeDashoffset, opacity, fillOpacity",
    conflicts: "None",
    frameExpression: "dashOffset = max(0, 360 - (frame/30)*360)",
    footerSpec: "Multi-Path SVG Stroke Tracing • Delayed Gradient Fill Pop",
    slug: "liquid-svg-stroke-draw",
    code: `@keyframes ig-stroke-draw { 0% { stroke-dashoffset: 360; fill-opacity: 0; } 70% { stroke-dashoffset: 0; fill-opacity: 0; } 100% { stroke-dashoffset: 0; fill-opacity: 1; } }`,
    html: `<div class="ig-stage"><div class="ig-stroke-draw-card"><svg class="ig-svg-box" viewBox="0 0 100 100"><defs><linearGradient id="ig-g3" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#ffd600"/><stop offset="25%" stop-color="#ff0100"/><stop offset="50%" stop-color="#d800b9"/><stop offset="100%" stop-color="#7000ff"/></linearGradient></defs><rect class="ig-bg ig-bg-stroke" x="8" y="8" width="84" height="84" rx="22" fill="url(#ig-g3)"/><rect class="ig-stroke ig-stroke-path" x="20" y="20" width="60" height="60" rx="16" stroke="#fff" stroke-width="6.5" fill="none"/><circle class="ig-lens ig-lens-path" cx="50" cy="50" r="15" stroke="#fff" stroke-width="6.5" fill="none"/><circle class="ig-dot ig-dot-path" cx="66" cy="34" r="4.2" fill="#fff"/></svg></div></div>`
  },
  {
    id: 4,
    badge: "MICRO #04",
    name: "Apple Spatial Aperture Iris & Elastic Squircle Expansion",
    traitId: "trait_spatial_aperture_iris_reveal",
    concern: "CompositionGeometry",
    targetScope: "iris_blade",
    channels: "rotate, scale, filter.blur, opacity",
    conflicts: "None",
    frameExpression: "irisRot = -45 + easeOutExpo(frame/30)*45 | squircleScale = easeOutBack(frame/30)",
    footerSpec: "Camera Shutter Iris 45° Blade Twist • Elastic Squircle Bloom",
    slug: "spatial-aperture-iris-expansion",
    code: `@keyframes ig-aperture-squircle { 0% { transform: scale(0.3); opacity: 0; } 50%, 100% { transform: scale(1); opacity: 1; } } @keyframes ig-aperture-iris { 0% { transform: scale(0.1) rotate(-60deg); opacity: 0; } 60%, 100% { transform: scale(1) rotate(0deg); opacity: 1; } }`,
    html: `<div class="ig-stage"><div class="ig-aperture-card"><svg class="ig-svg-box" viewBox="0 0 100 100"><defs><linearGradient id="ig-g4" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#ffd600"/><stop offset="25%" stop-color="#ff0100"/><stop offset="50%" stop-color="#d800b9"/><stop offset="100%" stop-color="#7000ff"/></linearGradient></defs><rect class="ig-bg ig-aperture-bg" x="8" y="8" width="84" height="84" rx="22" fill="url(#ig-g4)"/><rect class="ig-stroke ig-aperture-stroke" x="20" y="20" width="60" height="60" rx="16" stroke="#fff" stroke-width="6.5" fill="none"/><circle class="ig-lens ig-aperture-lens" cx="50" cy="50" r="15" stroke="#fff" stroke-width="6.5" fill="none"/><circle class="ig-dot ig-aperture-dot" cx="66" cy="34" r="4.2" fill="#fff"/></svg></div></div>`
  },
  {
    id: 5,
    badge: "MICRO #05",
    name: "Continuous Gaussian Focal Blur Morph & Pulse Breathing",
    traitId: "trait_focal_blur_harmonic_pulse",
    concern: "MotionPhysics",
    targetScope: "asset_core",
    channels: "filter.blur, transform.scale, opacity",
    conflicts: "None",
    frameExpression: "blurPx = 6 + sin(frame * 0.12) * 6 | scale = 1.0 + sin(frame * 0.08) * 0.08",
    footerSpec: "Harmonic Blur Breathing (0px..14px) • Dynamic Aperture Rack-Focus",
    slug: "focal-blur-harmonic-pulse",
    code: `@keyframes ig-focal-pulse { 0%, 100% { filter: blur(1px); transform: scale(1); } 50% { filter: blur(14px); transform: scale(1.12); } }`,
    html: `<div class="ig-stage"><div class="ig-focal-pulse-card"><svg class="ig-svg-box" viewBox="0 0 100 100"><defs><linearGradient id="ig-g5" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#ffd600"/><stop offset="25%" stop-color="#ff0100"/><stop offset="50%" stop-color="#d800b9"/><stop offset="100%" stop-color="#7000ff"/></linearGradient></defs><rect class="ig-bg" x="8" y="8" width="84" height="84" rx="22" fill="url(#ig-g5)"/><rect class="ig-stroke" x="20" y="20" width="60" height="60" rx="16" stroke="#fff" stroke-width="6.5" fill="none"/><circle class="ig-lens" cx="50" cy="50" r="15" stroke="#fff" stroke-width="6.5" fill="none"/><circle class="ig-dot" cx="66" cy="34" r="4.2" fill="#fff"/></svg></div></div>`
  },
  {
    id: 6,
    badge: "MICRO #06",
    name: "3D Isometric Perspective Matrix & Z-Axis Extrusion",
    traitId: "trait_isometric_3d_extrusion",
    concern: "CompositionGeometry",
    targetScope: "asset_mesh",
    channels: "transform.matrix3d, rotateX, rotateZ, dropShadow",
    conflicts: "None",
    frameExpression: "matrix3d = rotateX(42deg) rotateZ(-32deg) rotateY(15deg) translateZ(40px)",
    footerSpec: "3D Matrix Perspective (42deg, -32deg, 15deg) • Tiered Shadow Cast",
    slug: "isometric-3d-extrusion",
    code: `.ig-iso-card { transform: rotateX(42deg) rotateZ(-32deg) rotateY(15deg); box-shadow: 20px 28px 45px rgba(0,0,0,0.85), -6px -6px 24px rgba(244,63,94,0.35); }`,
    html: `<div class="ig-stage" style="perspective: 800px;"><div class="ig-iso-card"><svg class="ig-svg-box" viewBox="0 0 100 100"><defs><linearGradient id="ig-g6" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#ffd600"/><stop offset="25%" stop-color="#ff0100"/><stop offset="50%" stop-color="#d800b9"/><stop offset="100%" stop-color="#7000ff"/></linearGradient></defs><rect class="ig-bg" x="8" y="8" width="84" height="84" rx="22" fill="url(#ig-g6)"/><rect class="ig-stroke" x="20" y="20" width="60" height="60" rx="16" stroke="#fff" stroke-width="6.5" fill="none"/><circle class="ig-lens" cx="50" cy="50" r="15" stroke="#fff" stroke-width="6.5" fill="none"/><circle class="ig-dot" cx="66" cy="34" r="4.2" fill="#fff"/></svg></div></div>`
  },
  {
    id: 7,
    badge: "MICRO #07",
    name: "Liquid Gooey Metaball Separation & Gradient Coalesce",
    traitId: "trait_gooey_metaball_coalesce",
    concern: "MotionPhysics",
    targetScope: "fluid_droplets",
    channels: "filter.svgGoo, transform.translate, scale",
    conflicts: "crisp_vector_stroke",
    frameExpression: "dropletDist = max(0, 48 - (frame/25)*48)",
    footerSpec: "SVG Goo Threshold Matrix Filter • Elastic Droplet Fusion",
    slug: "gooey-metaball-coalesce",
    code: `.ig-goo-wrap { filter: url(#goo-threshold-html); } @keyframes ig-goo-fuse { 0% { transform: scale(0.4); } 60% { transform: scale(1.15); } 100% { transform: scale(1); } }`,
    html: `<div class="ig-stage"><div class="ig-goo-wrap"><div class="ig-goo-blob blob-1"></div><div class="ig-goo-blob blob-2"></div><div class="ig-goo-blob blob-3"></div><div class="ig-goo-core"><svg class="ig-svg-box" viewBox="0 0 100 100"><defs><linearGradient id="ig-g7" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#ffd600"/><stop offset="25%" stop-color="#ff0100"/><stop offset="50%" stop-color="#d800b9"/><stop offset="100%" stop-color="#7000ff"/></linearGradient></defs><rect class="ig-bg" x="8" y="8" width="84" height="84" rx="22" fill="url(#ig-g7)"/><rect class="ig-stroke" x="20" y="20" width="60" height="60" rx="16" stroke="#fff" stroke-width="6.5" fill="none"/><circle class="ig-lens" cx="50" cy="50" r="15" stroke="#fff" stroke-width="6.5" fill="none"/><circle class="ig-dot" cx="66" cy="34" r="4.2" fill="#fff"/></svg></div></div></div>`
  },
  {
    id: 8,
    badge: "MICRO #08",
    name: "Electric Arc Shockwave Ring & Sparkle Star Burst",
    traitId: "trait_electric_arc_shockwave",
    concern: "EnclosureAndAccents",
    targetScope: "asset_aura",
    channels: "scale, opacity, strokeDashoffset, filter.bloom",
    conflicts: "None",
    frameExpression: "ringScale = 0.4 + (frame % 60)/60 * 2.0 | ringAlpha = max(0, 1 - (frame % 60)/60)",
    footerSpec: "120 BPM Expanding Pulse Shockwave • 4-Point Diamond Sparkle Star",
    slug: "electric-arc-shockwave",
    code: `@keyframes ig-shockwave-pulse { 0% { transform: scale(0.6); opacity: 1; border-color: #06b6d4; } 100% { transform: scale(2.4); opacity: 0; border-color: #f43f5e; } }`,
    html: `<div class="ig-stage"><div class="ig-shockwave-container"><div class="ig-pulse-ring ring-1"></div><div class="ig-pulse-ring ring-2"></div><span class="ig-sparkle-star s1">✦</span><span class="ig-sparkle-star s2">✦</span><svg class="ig-svg-box" viewBox="0 0 100 100"><defs><linearGradient id="ig-g8" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#ffd600"/><stop offset="25%" stop-color="#ff0100"/><stop offset="50%" stop-color="#d800b9"/><stop offset="100%" stop-color="#7000ff"/></linearGradient></defs><rect class="ig-bg" x="8" y="8" width="84" height="84" rx="22" fill="url(#ig-g8)"/><rect class="ig-stroke" x="20" y="20" width="60" height="60" rx="16" stroke="#fff" stroke-width="6.5" fill="none"/><circle class="ig-lens" cx="50" cy="50" r="15" stroke="#fff" stroke-width="6.5" fill="none"/><circle class="ig-dot" cx="66" cy="34" r="4.2" fill="#fff"/></svg></div></div>`
  },
  {
    id: 9,
    badge: "MICRO #09",
    name: "Keynote Elastic Scale Punch-In with Dual Pressure Ripples",
    traitId: "trait_keynote_punch_pressure_ripple",
    concern: "MotionPhysics",
    targetScope: "asset_mesh",
    channels: "transform.scale, filter.blur, opacity",
    conflicts: "None",
    frameExpression: "scale = frame < 12 ? (1.5 - (frame/12)*0.54) : 1.0",
    footerSpec: "Scale 1.65 to 1.0 • Apple Keynote Pressure Wave Dispersion",
    slug: "keynote-punch-pressure-ripple",
    code: `@keyframes ig-keynote-punch { 0% { transform: scale(1.65); opacity: 0; filter: blur(22px); } 50% { transform: scale(0.92); opacity: 1; filter: blur(0); } 100% { transform: scale(1); } }`,
    html: `<div class="ig-stage"><div class="ig-keynote-punch-card"><svg class="ig-svg-box" viewBox="0 0 100 100"><defs><linearGradient id="ig-g9" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#ffd600"/><stop offset="25%" stop-color="#ff0100"/><stop offset="50%" stop-color="#d800b9"/><stop offset="100%" stop-color="#7000ff"/></linearGradient></defs><rect class="ig-bg" x="8" y="8" width="84" height="84" rx="22" fill="url(#ig-g9)"/><rect class="ig-stroke" x="20" y="20" width="60" height="60" rx="16" stroke="#fff" stroke-width="6.5" fill="none"/><circle class="ig-lens" cx="50" cy="50" r="15" stroke="#fff" stroke-width="6.5" fill="none"/><circle class="ig-dot" cx="66" cy="34" r="4.2" fill="#fff"/></svg></div></div>`
  },
  {
    id: 10,
    badge: "MICRO #10",
    name: "Zero-Gravity Floating Drift & Magnetic Kinetic Orbit",
    traitId: "trait_zero_gravity_levitation",
    concern: "MotionPhysics",
    targetScope: "asset_mesh",
    channels: "translateY, rotate, dropShadow",
    conflicts: "None",
    frameExpression: "driftY = sin((frame/45)*2π) * 16 | driftRot = cos((frame/60)*2π) * 6",
    footerSpec: "Harmonic Physics Oscillation • Depth Shadow Parallax",
    slug: "zero-gravity-levitation",
    code: `@keyframes ig-floating-anim { 0%, 100% { transform: translateY(0) rotate(0deg); filter: drop-shadow(0 15px 25px rgba(0,0,0,0.6)); } 50% { transform: translateY(-16px) rotate(6deg); filter: drop-shadow(0 32px 45px rgba(220,39,67,0.4)); } }`,
    html: `<div class="ig-stage"><div class="ig-floating-card"><svg class="ig-svg-box" viewBox="0 0 100 100"><defs><linearGradient id="ig-g10" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#ffd600"/><stop offset="25%" stop-color="#ff0100"/><stop offset="50%" stop-color="#d800b9"/><stop offset="100%" stop-color="#7000ff"/></linearGradient></defs><rect class="ig-bg" x="8" y="8" width="84" height="84" rx="22" fill="url(#ig-g10)"/><rect class="ig-stroke" x="20" y="20" width="60" height="60" rx="16" stroke="#fff" stroke-width="6.5" fill="none"/><circle class="ig-lens" cx="50" cy="50" r="15" stroke="#fff" stroke-width="6.5" fill="none"/><circle class="ig-dot" cx="66" cy="34" r="4.2" fill="#fff"/></svg></div></div>`
  },
  {
    id: 11,
    badge: "MICRO #11",
    name: "Prismatic Holographic Laser Sweep & Iridescent Sheen",
    traitId: "trait_holographic_laser_sweep",
    concern: "MaterialTreatment",
    targetScope: "asset_material",
    channels: "background.gradientSweep, mixBlendMode, brightness",
    conflicts: "None",
    frameExpression: "laserPos = (frame % 75) / 75 * 200%",
    footerSpec: "40° Diagonal Spectral Iridescence • Cyber Hologram Laser",
    slug: "holographic-laser-sweep",
    code: `@keyframes ig-laser-sweep-anim { 0%, 20% { left: -150%; } 80%, 100% { left: 200%; } }`,
    html: `<div class="ig-stage"><div class="ig-holo-card"><div class="ig-laser-beam"></div><svg class="ig-svg-box" viewBox="0 0 100 100"><defs><linearGradient id="ig-g11" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#ffd600"/><stop offset="25%" stop-color="#ff0100"/><stop offset="50%" stop-color="#d800b9"/><stop offset="100%" stop-color="#7000ff"/></linearGradient></defs><rect class="ig-bg" x="8" y="8" width="84" height="84" rx="22" fill="url(#ig-g11)"/><rect class="ig-stroke" x="20" y="20" width="60" height="60" rx="16" stroke="#fff" stroke-width="6.5" fill="none"/><circle class="ig-lens" cx="50" cy="50" r="15" stroke="#fff" stroke-width="6.5" fill="none"/><circle class="ig-dot" cx="66" cy="34" r="4.2" fill="#fff"/></svg></div></div>`
  },
  {
    id: 12,
    badge: "MICRO #12",
    name: "Staggered Multi-Layer Deconstruction & Kinetic Reassembly",
    traitId: "trait_deconstruction_reassembly",
    concern: "MotionPhysics",
    targetScope: "sub_layers",
    channels: "translate3d, rotate, opacity",
    conflicts: "None",
    frameExpression: "layerOffset = (layerIndex * 6) -> easeOutQuart",
    footerSpec: "4-Layer Temporal Stagger • Explosive Blueprint Reassembly",
    slug: "deconstruction-reassembly",
    code: `@keyframes ig-layer-bg-in { 0% { transform: translateY(-50px) scale(0.6); opacity: 0; } 40%, 100% { transform: translateY(0) scale(1); opacity: 1; } }`,
    html: `<div class="ig-stage"><div class="ig-deconstruct-card"><svg class="ig-svg-box" viewBox="0 0 100 100"><defs><linearGradient id="ig-g12" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#ffd600"/><stop offset="25%" stop-color="#ff0100"/><stop offset="50%" stop-color="#d800b9"/><stop offset="100%" stop-color="#7000ff"/></linearGradient></defs><rect class="ig-bg ig-layer-bg" x="8" y="8" width="84" height="84" rx="22" fill="url(#ig-g12)"/><rect class="ig-stroke ig-layer-stroke" x="20" y="20" width="60" height="60" rx="16" stroke="#fff" stroke-width="6.5" fill="none"/><circle class="ig-lens ig-layer-lens" cx="50" cy="50" r="15" stroke="#fff" stroke-width="6.5" fill="none"/><circle class="ig-dot ig-layer-dot" cx="66" cy="34" r="4.2" fill="#fff"/></svg></div></div>`
  },
  {
    id: 13,
    badge: "MICRO #13",
    name: "Retro CRT Phosphor Beam Turn-On & Horizontal Raster Scan",
    traitId: "trait_crt_phosphor_raster_beam",
    concern: "MaterialTreatment + TemporalTrigger",
    targetScope: "composite_plane",
    channels: "scaleY, scaleX, filter.brightness, filter.scanline",
    conflicts: "None",
    frameExpression: "beamH = frame < 8 ? (frame/8)*0.05 : clamp((frame-8)/15, 0.05, 1.0)",
    footerSpec: "1980s Analog CRT Turn-On Flash • 60Hz Phosphor Raster Decay",
    slug: "crt-phosphor-raster-beam",
    code: `@keyframes ig-crt-turn-on { 0% { transform: scaleY(0.01) scaleX(0.05); filter: brightness(5); } 50%, 100% { transform: scaleY(1) scaleX(1); filter: brightness(1); } }`,
    html: `<div class="ig-stage"><div class="ig-crt-card"><div class="ig-crt-lines"></div><svg class="ig-svg-box" viewBox="0 0 100 100"><defs><linearGradient id="ig-g13" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#ffd600"/><stop offset="25%" stop-color="#ff0100"/><stop offset="50%" stop-color="#d800b9"/><stop offset="100%" stop-color="#7000ff"/></linearGradient></defs><rect class="ig-bg" x="8" y="8" width="84" height="84" rx="22" fill="url(#ig-g13)"/><rect class="ig-stroke" x="20" y="20" width="60" height="60" rx="16" stroke="#fff" stroke-width="6.5" fill="none"/><circle class="ig-lens" cx="50" cy="50" r="15" stroke="#fff" stroke-width="6.5" fill="none"/><circle class="ig-dot" cx="66" cy="34" r="4.2" fill="#fff"/></svg></div></div>`
  },
  {
    id: 14,
    badge: "MICRO #14",
    name: "Glassmorphic Frosted Lens Flare & Specular Bevel Reflection",
    traitId: "trait_glassmorphism_bevel_reflection",
    concern: "MaterialTreatment",
    targetScope: "asset_material",
    channels: "backdropFilter, borderColor, boxShadow, specularAngle",
    conflicts: "None",
    frameExpression: "specularAngle = (frame % 90) / 90 * 360deg",
    footerSpec: "Frosted Acrylic VisionOS Glass • Dual Specular Rim Bevel",
    slug: "glassmorphism-bevel-reflection",
    code: `.ig-glass-card { background: rgba(255,255,255,0.06); backdrop-filter: blur(20px) saturate(180%); border: 1.5px solid rgba(255,255,255,0.22); }`,
    html: `<div class="ig-stage"><div class="ig-glass-card"><div class="ig-glass-bevel-gleam"></div><svg class="ig-svg-box" viewBox="0 0 100 100"><defs><linearGradient id="ig-g14" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#ffd600"/><stop offset="25%" stop-color="#ff0100"/><stop offset="50%" stop-color="#d800b9"/><stop offset="100%" stop-color="#7000ff"/></linearGradient></defs><rect class="ig-bg" x="8" y="8" width="84" height="84" rx="22" fill="url(#ig-g14)"/><rect class="ig-stroke" x="20" y="20" width="60" height="60" rx="16" stroke="#fff" stroke-width="6.5" fill="none"/><circle class="ig-lens" cx="50" cy="50" r="15" stroke="#fff" stroke-width="6.5" fill="none"/><circle class="ig-dot" cx="66" cy="34" r="4.2" fill="#fff"/></svg></div></div>`
  },
  {
    id: 15,
    badge: "MICRO #15",
    name: "Hyper-Speed Radial Velocity Blur & Sonic Impact Drop",
    traitId: "trait_velocity_blur_sonic_impact",
    concern: "MotionPhysics",
    targetScope: "asset_mesh",
    channels: "translateZ, scale, filter.motionBlur, opacity",
    conflicts: "None",
    frameExpression: "velocityZ = easeOutExpo(frame/20) * 1000",
    footerSpec: "Warp Speed Converging Streaks • Heavy Bass Screen Shake Landing",
    slug: "velocity-blur-sonic-impact",
    code: `@keyframes ig-velocity-drop-anim { 0% { transform: scale(3.2); filter: blur(30px); opacity: 0; } 55% { transform: scale(0.92); filter: blur(0); opacity: 1; } 100% { transform: scale(1); } }`,
    html: `<div class="ig-stage"><div class="ig-velocity-drop-card"><svg class="ig-svg-box" viewBox="0 0 100 100"><defs><linearGradient id="ig-g15" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#ffd600"/><stop offset="25%" stop-color="#ff0100"/><stop offset="50%" stop-color="#d800b9"/><stop offset="100%" stop-color="#7000ff"/></linearGradient></defs><rect class="ig-bg" x="8" y="8" width="84" height="84" rx="22" fill="url(#ig-g15)"/><rect class="ig-stroke" x="20" y="20" width="60" height="60" rx="16" stroke="#fff" stroke-width="6.5" fill="none"/><circle class="ig-lens" cx="50" cy="50" r="15" stroke="#fff" stroke-width="6.5" fill="none"/><circle class="ig-dot" cx="66" cy="34" r="4.2" fill="#fff"/></svg></div></div>`
  }
];

const MICRO_ASSET_CUSTOM_CSS = `
/* ========================================================================= */
/* ANIMA #02 MICRO ASSET SUITE (15 ADVANCED MOTION PRESETS - INSTAGRAM ICON) */
/* ========================================================================= */
.ig-stage {
  display: flex; align-items: center; justify-content: center;
  width: 100%; height: 100%; position: relative; overflow: hidden;
}
.ig-svg-box {
  width: 110px; height: 110px; display: block;
}

/* 1. Bézier Kinetic Spring & Overshoot Snap */
.ig-bezier-spring-card {
  animation: ig-bezier-spring-anim 2.2s cubic-bezier(0.34, 1.56, 0.64, 1) infinite alternate;
}
@keyframes ig-bezier-spring-anim {
  0% { transform: scale(0.2) rotate(-28deg) translateY(45px); opacity: 0; filter: drop-shadow(0 0 0 transparent); }
  55% { transform: scale(1.18) rotate(4deg) translateY(-8px); opacity: 1; filter: drop-shadow(0 18px 36px rgba(220,39,67,0.5)); }
  75% { transform: scale(0.94) rotate(-2deg) translateY(3px); }
  100% { transform: scale(1) rotate(0deg) translateY(0); filter: drop-shadow(0 14px 28px rgba(220,39,67,0.4)); }
}

/* 2. Subpixel Gaussian Focal Blur-Up & Resolving Bloom */
.ig-blur-flare-card {
  position: relative;
  animation: ig-blur-flare-anim 2.4s cubic-bezier(0.16, 1, 0.3, 1) infinite alternate;
}
@keyframes ig-blur-flare-anim {
  0% { filter: blur(28px) brightness(1.2); opacity: 0; transform: scale(0.82); }
  60%, 100% { filter: blur(0px) brightness(1); opacity: 1; transform: scale(1); filter: drop-shadow(0 14px 28px rgba(220,39,67,0.4)); }
}

/* 3. Parametric Liquid SVG Stroke Tracing & Path Unfurl */
.ig-stroke-draw-card .ig-bg-stroke {
  animation: ig-bg-fill-pop 2.5s cubic-bezier(0.16, 1, 0.3, 1) infinite;
}
.ig-stroke-draw-card .ig-stroke-path,
.ig-stroke-draw-card .ig-lens-path,
.ig-stroke-draw-card .ig-dot-path {
  stroke-dasharray: 300;
  stroke-dashoffset: 300;
  animation: ig-stroke-trace 2.5s cubic-bezier(0.16, 1, 0.3, 1) infinite;
}
@keyframes ig-stroke-trace {
  0% { stroke-dashoffset: 300; opacity: 0; }
  20% { opacity: 1; }
  65%, 100% { stroke-dashoffset: 0; opacity: 1; }
}
@keyframes ig-bg-fill-pop {
  0%, 45% { transform: scale(0.7); opacity: 0; fill-opacity: 0; }
  70% { transform: scale(1.05); opacity: 1; fill-opacity: 0.8; }
  100% { transform: scale(1); opacity: 1; fill-opacity: 1; }
}

/* 4. Apple Spatial Aperture Iris & Elastic Squircle Expansion */
.ig-aperture-card {
  animation: ig-aperture-card-anim 2.5s cubic-bezier(0.16, 1, 0.3, 1) infinite alternate;
}
.ig-aperture-bg {
  transform-origin: 50px 50px;
  animation: ig-aperture-squircle 2.5s cubic-bezier(0.34, 1.56, 0.64, 1) infinite alternate;
}
.ig-aperture-stroke {
  transform-origin: 50px 50px;
  animation: ig-aperture-stroke-anim 2.5s cubic-bezier(0.16, 1, 0.3, 1) infinite alternate;
}
.ig-aperture-lens {
  transform-origin: 50px 50px;
  animation: ig-aperture-iris 2.5s cubic-bezier(0.16, 1, 0.3, 1) infinite alternate;
}
.ig-aperture-dot {
  transform-origin: 66px 34px;
  animation: ig-aperture-dot-pop 2.5s cubic-bezier(0.34, 1.56, 0.64, 1) infinite alternate;
}
@keyframes ig-aperture-card-anim {
  0% { filter: blur(12px); opacity: 0; }
  40%, 100% { filter: blur(0px); opacity: 1; filter: drop-shadow(0 14px 28px rgba(220,39,67,0.4)); }
}
@keyframes ig-aperture-squircle {
  0% { transform: scale(0.3); opacity: 0; }
  50%, 100% { transform: scale(1); opacity: 1; }
}
@keyframes ig-aperture-stroke-anim {
  0%, 20% { transform: scale(0.5); opacity: 0; }
  60%, 100% { transform: scale(1); opacity: 1; }
}
@keyframes ig-aperture-iris {
  0% { transform: scale(0.1) rotate(-60deg); opacity: 0; }
  60%, 100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
@keyframes ig-aperture-dot-pop {
  0%, 35% { transform: scale(0); opacity: 0; }
  70%, 100% { transform: scale(1); opacity: 1; }
}

/* 5. Continuous Gaussian Focal Blur Morph & Pulse Breathing */
.ig-focal-pulse-card {
  animation: ig-focal-pulse-anim 3s ease-in-out infinite;
}
@keyframes ig-focal-pulse-anim {
  0%, 100% { filter: blur(1px) drop-shadow(0 8px 20px rgba(220,39,67,0.3)); transform: scale(1); }
  50% { filter: blur(14px) drop-shadow(0 20px 40px rgba(112,0,255,0.6)); transform: scale(1.12); }
}

/* 6. 3D Isometric Perspective Matrix & Z-Axis Extrusion */
.ig-iso-card {
  transform: rotateX(42deg) rotateZ(-32deg) rotateY(15deg);
  box-shadow: 20px 28px 45px rgba(0,0,0,0.85), -6px -6px 24px rgba(244,63,94,0.35);
  border-radius: 24px;
  animation: ig-iso-float 3.5s ease-in-out infinite;
}
@keyframes ig-iso-float {
  0%, 100% { transform: rotateX(42deg) rotateZ(-32deg) rotateY(15deg) translateY(0); }
  50% { transform: rotateX(46deg) rotateZ(-30deg) rotateY(18deg) translateY(-14px); }
}

/* 7. Liquid Gooey Metaball Separation & Gradient Coalesce */
.ig-goo-wrap {
  filter: url(#goo-threshold-html);
  position: relative; width: 140px; height: 140px;
  display: flex; align-items: center; justify-content: center;
}
.ig-goo-blob {
  position: absolute; border-radius: 50%;
  background: linear-gradient(135deg, #ffd600, #d800b9);
}
.ig-goo-blob.blob-1 { width: 36px; height: 36px; animation: ig-blob-orbit-1 3s ease-in-out infinite; }
.ig-goo-blob.blob-2 { width: 32px; height: 32px; animation: ig-blob-orbit-2 3s ease-in-out infinite; }
.ig-goo-blob.blob-3 { width: 28px; height: 28px; animation: ig-blob-orbit-3 3s ease-in-out infinite; }
.ig-goo-core { width: 90px; height: 90px; border-radius: 22px; }
@keyframes ig-blob-orbit-1 { 0%, 100% { transform: translate(-40px, -30px); } 50% { transform: translate(0, 0); } }
@keyframes ig-blob-orbit-2 { 0%, 100% { transform: translate(40px, 30px); } 50% { transform: translate(0, 0); } }
@keyframes ig-blob-orbit-3 { 0%, 100% { transform: translate(-30px, 40px); } 50% { transform: translate(0, 0); } }

/* 8. Electric Arc Shockwave Ring & Sparkle Star Burst */
.ig-shockwave-container {
  position: relative; display: flex; align-items: center; justify-content: center;
}
.ig-pulse-ring {
  position: absolute; border-radius: 50%; border: 2px solid var(--accent-cyan); pointer-events: none;
}
.ig-pulse-ring.ring-1 { width: 100px; height: 100px; animation: ig-shockwave-pulse 2s cubic-bezier(0.16, 1, 0.3, 1) infinite; }
.ig-pulse-ring.ring-2 { width: 100px; height: 100px; animation: ig-shockwave-pulse 2s 0.6s cubic-bezier(0.16, 1, 0.3, 1) infinite; }
.ig-sparkle-star {
  position: absolute; color: #ffd700; font-size: 20px; animation: ig-star-spin 2s ease-in-out infinite;
}
.ig-sparkle-star.s1 { top: -14px; right: -14px; }
.ig-sparkle-star.s2 { bottom: -14px; left: -14px; animation-delay: 1s; }
@keyframes ig-shockwave-pulse {
  0% { transform: scale(0.6); opacity: 1; border-color: #06b6d4; }
  100% { transform: scale(2.4); opacity: 0; border-color: #f43f5e; }
}
@keyframes ig-star-spin {
  0%, 100% { transform: scale(0.6) rotate(0deg); opacity: 0.3; }
  50% { transform: scale(1.3) rotate(90deg); opacity: 1; filter: drop-shadow(0 0 8px #ffd700); }
}

/* 9. Keynote Elastic Scale Punch-In with Dual Pressure Ripples */
.ig-keynote-punch-card {
  animation: ig-keynote-punch-anim 2s cubic-bezier(0.16, 1, 0.3, 1) infinite alternate;
}
@keyframes ig-keynote-punch-anim {
  0% { transform: scale(1.65); opacity: 0; filter: blur(22px); }
  50% { transform: scale(0.92); opacity: 1; filter: blur(0); }
  75% { transform: scale(1.05); }
  100% { transform: scale(1); filter: drop-shadow(0 12px 30px rgba(0,0,0,0.8)); }
}

/* 10. Zero-Gravity Floating Drift & Magnetic Kinetic Orbit */
.ig-floating-card {
  animation: ig-floating-anim 3.5s ease-in-out infinite;
}
@keyframes ig-floating-anim {
  0%, 100% { transform: translateY(0) rotate(0deg); filter: drop-shadow(0 15px 25px rgba(0,0,0,0.6)); }
  50% { transform: translateY(-16px) rotate(6deg); filter: drop-shadow(0 32px 45px rgba(220,39,67,0.4)); }
}

/* 11. Prismatic Holographic Laser Sweep & Iridescent Sheen */
.ig-holo-card {
  position: relative; overflow: hidden; border-radius: 24px;
}
.ig-laser-beam {
  position: absolute; top: -50%; left: -150%; width: 60%; height: 200%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.9), rgba(0,255,255,0.8), rgba(255,0,128,0.8), transparent);
  transform: rotate(40deg);
  animation: ig-laser-sweep-anim 2.5s ease-in-out infinite;
  pointer-events: none;
}
@keyframes ig-laser-sweep-anim {
  0%, 20% { left: -150%; }
  80%, 100% { left: 200%; }
}

/* 12. Staggered Multi-Layer Deconstruction & Kinetic Reassembly */
.ig-deconstruct-card .ig-layer-bg { animation: ig-layer-bg-in 2.6s cubic-bezier(0.16, 1, 0.3, 1) infinite; }
.ig-deconstruct-card .ig-layer-stroke { animation: ig-layer-stroke-in 2.6s cubic-bezier(0.16, 1, 0.3, 1) infinite; }
.ig-deconstruct-card .ig-layer-lens { animation: ig-layer-lens-in 2.6s cubic-bezier(0.16, 1, 0.3, 1) infinite; }
.ig-deconstruct-card .ig-layer-dot { animation: ig-layer-dot-in 2.6s cubic-bezier(0.16, 1, 0.3, 1) infinite; }
@keyframes ig-layer-bg-in { 0% { transform: translateY(-50px) scale(0.6); opacity: 0; } 40%, 100% { transform: translateY(0) scale(1); opacity: 1; } }
@keyframes ig-layer-stroke-in { 0%, 20% { transform: translateX(-40px); opacity: 0; } 60%, 100% { transform: translateX(0); opacity: 1; } }
@keyframes ig-layer-lens-in { 0%, 40% { transform: scale(0); opacity: 0; } 75%, 100% { transform: scale(1); opacity: 1; } }
@keyframes ig-layer-dot-in { 0%, 55% { transform: scale(0); opacity: 0; } 85%, 100% { transform: scale(1); opacity: 1; } }

/* 13. Retro CRT Phosphor Beam Turn-On & Horizontal Raster Scan */
.ig-crt-card { position: relative; animation: ig-crt-turn-on 2.5s ease-out infinite; }
.ig-crt-lines {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.4) 2px, rgba(0,0,0,0.4) 4px);
  pointer-events: none;
}
@keyframes ig-crt-turn-on {
  0% { transform: scaleY(0.01) scaleX(0.05); filter: brightness(5) contrast(3); }
  25% { transform: scaleY(0.03) scaleX(1); filter: brightness(4) contrast(2); }
  50%, 100% { transform: scaleY(1) scaleX(1); filter: brightness(1) contrast(1); }
}

/* 14. Glassmorphic Frosted Lens Flare & Specular Bevel Reflection */
.ig-glass-card {
  padding: 8px; background: rgba(255,255,255,0.06); backdrop-filter: blur(20px) saturate(180%);
  border: 1.5px solid rgba(255,255,255,0.22); border-radius: 28px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.8), inset 0 1px 2px rgba(255,255,255,0.6);
  position: relative; overflow: hidden;
  animation: ig-glass-float 3.5s ease-in-out infinite;
}
.ig-glass-bevel-gleam {
  position: absolute; top: -40%; left: -100%; width: 50%; height: 180%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent);
  transform: rotate(35deg);
  animation: ig-glass-gleam-anim 3.5s ease-in-out infinite;
  pointer-events: none;
}
@keyframes ig-glass-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
@keyframes ig-glass-gleam-anim { 0%, 30% { left: -100%; } 70%, 100% { left: 180%; } }

/* 15. Hyper-Speed Radial Velocity Blur & Sonic Impact Drop */
.ig-velocity-drop-card {
  animation: ig-velocity-drop-anim 2.4s cubic-bezier(0.16, 1, 0.3, 1) infinite alternate;
}
@keyframes ig-velocity-drop-anim {
  0% { transform: scale(1.45); filter: blur(16px); opacity: 0; }
  55% { transform: scale(0.96); filter: blur(0); opacity: 1; }
  75% { transform: scale(1.03); }
  100% { transform: scale(1); filter: drop-shadow(0 14px 28px rgba(220,39,67,0.4)); }
}
`;

// 3. AUTHENTIC PHOTOREALISTIC MARBLE COLUMN ASSET EMBEDDING
const marblePillarB64 = fs.readFileSync(path.join(repoRoot, "docs/mini_run_studio/classical_marble_pillar_cutout.png")).toString("base64");
const MARBLE_PILLAR_DATA_URI = `data:image/png;base64,${marblePillarB64}`;

// 4. LIST / ENUMERATION 9 HIGH-TIER CINEMATIC MODULAR PRESETS (ANIMA #03)
const LIST_ENUMERATION_9_PRESETS: ArchetypeVariant[] = [
  {
    id: 1,
    badge: "LIST #01",
    name: "3D Cylindrical Carousel Deck (Rack-Focus DoF Gaussian Blur)",
    traitId: "trait_3d_cylindrical_carousel_deck",
    concern: "CompositionGeometry + MotionPhysics",
    targetScope: "card_carousel",
    channels: "rotateY, translateZ, scale, filter.blur, opacity",
    conflicts: "None",
    frameExpression: "activeCardIndex = floor(frame / 45) % 3 | dofBlur = isCenter ? 0 : 8px",
    footerSpec: "3D Cylinder Perspective (900px) • Active Center Card (Sharp) • Non-Active Cards (Gaussian Depth Blur 8px)",
    slug: "3d-cylindrical-carousel-deck",
    code: `.carousel-card.card-center { transform: translateZ(55px) scale(1.12); filter: blur(0px); opacity: 1; } .carousel-card.blurred-dof { filter: blur(8px); opacity: 0.35; transform: rotateY(35deg) translateZ(-50px) scale(0.82); }`,
    html: `<div class="list-stage list-carousel-stage"><div class="list-carousel-3d-wrap"><div class="carousel-card card-left blurred-dof"><span class="carousel-card-num num-blur">3</span></div><div class="carousel-card card-center active-focus"><span class="carousel-card-num num-sharp">1</span></div><div class="carousel-card card-right blurred-dof"><span class="carousel-card-num num-blur">2</span></div></div></div>`
  },
  {
    id: 2,
    badge: "LIST #02",
    name: "Vertical Word Stack & Dynamic Kinetic Highlight Track",
    traitId: "trait_vertical_pill_tracker",
    concern: "TemporalTrigger + EnclosureAndAccents",
    targetScope: "list_item",
    channels: "translateY, opacity, filter.blur, background.color",
    conflicts: "None",
    frameExpression: "activeItemIdx = floor(frame / 35) % 7 | nonActiveBlur = 5px | nonActiveAlpha = 0.28",
    footerSpec: "Deep Cobalt Radial Stage • Glowing Magenta Tracking Pill • Heavy Gaussian Blur on Non-Active Words",
    slug: "vertical-pill-tracker",
    code: `.v-list-item.v-list-active { filter: blur(0px); opacity: 1; transform: scale(1.1); } .v-list-item.blurred-item { filter: blur(5px); opacity: 0.25; transform: scale(0.92); }`,
    html: `<div class="list-stage list-vertical-stack-stage"><div class="list-vertical-stack-box"><div class="v-list-item blurred-item">Piloter</div><div class="v-list-item blurred-item">Connecter</div><div class="v-list-item blurred-item">Valoriser</div><div class="v-list-item v-list-active sharp-item"><span class="v-arrow-pointer">▶</span><span class="v-pill-highlight">Exalter</span></div><div class="v-list-item blurred-item">Sécuriser</div><div class="v-list-item blurred-item">Optimiser</div><div class="v-list-item blurred-item">Structurer</div></div></div>`
  },
  {
    id: 3,
    badge: "LIST #03",
    name: "Overlapping Dual-Card Deck (Subtext Toggle & Kinetic Typo)",
    traitId: "trait_overlapping_dual_card_deck",
    concern: "LayoutComposition",
    targetScope: "split_cards",
    channels: "translateX, scale, opacity, filter.blur, text.numeral",
    conflicts: "None",
    frameExpression: "cardPop = easeOutBack(frame / 30) | showSubtext = true",
    footerSpec: "Cobalt Dual-Card Deck • Big 01 Numeral Plate • Subtext Explanation Toggleable",
    slug: "overlapping-dual-card-deck",
    code: `.split-num-card { background: #1d4ed8; border-radius: 20px; box-shadow: 0 14px 28px rgba(0,0,0,0.6); } .split-content-card { background: #1e40af; border-radius: 20px; border: 1px solid rgba(255,255,255,0.15); }`,
    html: `<div class="list-stage list-split-deck-stage"><div class="split-card-container"><div class="split-num-card"><span class="split-big-num">01</span></div><div class="split-content-card"><div class="split-header-row"><h4 class="split-card-title">Branding & Identity</h4><span class="subtext-toggle-pill" title="Modular Toggle">Subtext: ON</span></div><p class="split-card-subtext">Comprehensive visual architecture establishing market authority, brand consistency, and high-conversion positioning.</p></div></div></div>`
  },
  {
    id: 4,
    badge: "LIST #04",
    name: "Concentric Bubble Node Sequencer & Word Blur Reveal",
    traitId: "trait_concentric_bubble_sequencer",
    concern: "MotionPhysics",
    targetScope: "bullet_nodes",
    channels: "scale, filter.blur, opacity",
    conflicts: "None",
    frameExpression: "bubbleScale = clamp((frame - itemIdx*8)/15, 0, 1) | dofBlur = isActive ? 0 : 6px",
    footerSpec: "Concentric Circle Bullets • Active Node in Sharp Cobalt Glow • Remaining Items Gaussian Blurred",
    slug: "concentric-bubble-sequencer",
    code: `.bubble-item.active-bubble { filter: blur(0px); opacity: 1; } .bubble-item.blurred-item { filter: blur(6px); opacity: 0.3; }`,
    html: `<div class="list-stage list-bubble-stage"><div class="bubble-list-container"><div class="bubble-item blurred-item"><span class="bubble-bullet-icon"><span class="bubble-inner-dot"></span></span><span class="bubble-item-text">Define the authoritative offer</span></div><div class="bubble-item blurred-item"><span class="bubble-bullet-icon"><span class="bubble-inner-dot"></span></span><span class="bubble-item-text">Deploy automated campaign sequence</span></div><div class="bubble-item active-bubble sharp-item"><span class="bubble-bullet-icon active"><span class="bubble-inner-dot"></span></span><span class="bubble-item-text highlight">Scale infrastructure systematically</span></div><div class="bubble-item blurred-item"><span class="bubble-bullet-icon"><span class="bubble-inner-dot"></span></span><span class="bubble-item-text">Lock in recurring cashflow loops</span></div></div></div>`
  },
  {
    id: 5,
    badge: "LIST #05",
    name: "Classical Greek Architectural Pillar Trio (Photorealistic Column & Giant Gradient Blur Numerals)",
    traitId: "trait_classical_pillar_trio",
    concern: "MotionPhysics + MaterialTreatment",
    targetScope: "pillar_cutout_mesh",
    channels: "translateY, opacity, filter.blur, text.gradientMask",
    conflicts: "None",
    frameExpression: "pillarY = max(0, 140 - (frame/25)*140) | numeralBlur = isActive ? 0 : 8px",
    footerSpec: "Authentic Isolated Classical Marble Column Asset • Giant Top Gradient Blur Numerals (1, 2, 3) • Cinematic DoF Blur",
    slug: "classical-pillar-trio",
    code: `.pillar-giant-num.active { background: linear-gradient(180deg, #ffffff 0%, #38bdf8 50%, rgba(56,189,248,0) 100%); -webkit-background-clip: text; filter: blur(0px) drop-shadow(0 0 25px #38bdf8); } .pillar-giant-num { filter: blur(8px); opacity: 0.35; }`,
    html: `<div class="list-stage list-pillar-cinematic-stage"><div class="pillar-cinematic-container"><div class="pillar-cinematic-col pillar-col-1 blurred-pillar"><div class="pillar-giant-num">1</div><img class="pillar-img pillar-blur" src="${MARBLE_PILLAR_DATA_URI}" alt="Classical Column" /></div><div class="pillar-cinematic-col pillar-col-2 active-pillar"><div class="pillar-giant-num active">2</div><img class="pillar-img pillar-sharp" src="${MARBLE_PILLAR_DATA_URI}" alt="Classical Column" /></div><div class="pillar-cinematic-col pillar-col-3 blurred-pillar"><div class="pillar-giant-num">3</div><img class="pillar-img pillar-blur" src="${MARBLE_PILLAR_DATA_URI}" alt="Classical Column" /></div></div></div>`
  },
  {
    id: 6,
    badge: "LIST #06",
    name: "5-Pillar Monumental Architectural Framework (Photorealistic 5 Columns & Strategy Icons)",
    traitId: "trait_monumental_5_pillars",
    concern: "CompositionGeometry",
    targetScope: "pillar_system",
    channels: "translateY, scale, opacity, filter.blur",
    conflicts: "None",
    frameExpression: "activePillarIdx = floor(frame / 30) % 5 | dofBlur = isActive ? 0 : 7px",
    footerSpec: "5 Photorealistic Marble Columns on Deep Royal Blue Studio Stage • Floating Strategy Tokens • Staggered DoF Rack-Focus",
    slug: "monumental-5-pillars",
    code: `.p5-col.active-pillar { filter: blur(0px); opacity: 1; transform: translateY(-10px) scale(1.08); } .p5-col.blurred-pillar { filter: blur(7px); opacity: 0.35; transform: translateY(0) scale(0.94); }`,
    html: `<div class="list-stage list-pillars-5-stage"><div class="pillars-5-container"><div class="p5-col p5-c1 blurred-pillar"><div class="pillar-giant-num-5">1</div><div class="p5-badge"><span class="p5-icon">🔍</span><span>SEO</span></div><img class="pillar-img-5 pillar-blur" src="${MARBLE_PILLAR_DATA_URI}" alt="Classical Column" /></div><div class="p5-col p5-c2 active-pillar"><div class="pillar-giant-num-5 active">2</div><div class="p5-badge active"><span class="p5-icon">👥</span><span>Social</span></div><img class="pillar-img-5 pillar-sharp" src="${MARBLE_PILLAR_DATA_URI}" alt="Classical Column" /></div><div class="p5-col p5-c3 blurred-pillar"><div class="pillar-giant-num-5">3</div><div class="p5-badge"><span class="p5-icon">📢</span><span>Ads</span></div><img class="pillar-img-5 pillar-blur" src="${MARBLE_PILLAR_DATA_URI}" alt="Classical Column" /></div><div class="p5-col p5-c4 blurred-pillar"><div class="pillar-giant-num-5">4</div><div class="p5-badge"><span class="p5-icon">🤝</span><span>Influencers</span></div><img class="pillar-img-5 pillar-blur" src="${MARBLE_PILLAR_DATA_URI}" alt="Classical Column" /></div><div class="p5-col p5-c5 blurred-pillar"><div class="pillar-giant-num-5">5</div><div class="p5-badge"><span class="p5-icon">📊</span><span>Data</span></div><img class="pillar-img-5 pillar-blur" src="${MARBLE_PILLAR_DATA_URI}" alt="Classical Column" /></div></div></div>`
  },
  {
    id: 7,
    badge: "LIST #07",
    name: "Staggered Stencil Number Stack (4-Quadrant Depth Chase Grid)",
    traitId: "trait_staggered_stencil_numbers",
    concern: "MotionPhysics",
    targetScope: "quadrant_grid",
    channels: "translateY, opacity, border.glow, filter.blur",
    conflicts: "None",
    frameExpression: "quadrantIdx = floor(frame / 25) % 4 | dofBlur = isActive ? 0 : 7px",
    footerSpec: "4-Quadrant Chase Grid • Large Stencil Numbers 01..04 • Active Cell Sharp Neon, Others Gaussian Blurred",
    slug: "staggered-stencil-quadrant",
    code: `.stencil-cell.active.sharp-cell { filter: blur(0px); opacity: 1; border-color: var(--accent-cyan); box-shadow: 0 0 20px rgba(6,182,212,0.3); } .stencil-cell.blurred-cell { filter: blur(7px); opacity: 0.25; }`,
    html: `<div class="list-stage"><div class="stencil-quad-grid"><div class="stencil-cell active sharp-cell"><span class="st-num">01</span><span class="st-label">Idea Validation</span></div><div class="stencil-cell blurred-cell"><span class="st-num">02</span><span class="st-label">Acquisition Funnel</span></div><div class="stencil-cell blurred-cell"><span class="st-num">03</span><span class="st-label">Product Velocity</span></div><div class="stencil-cell blurred-cell"><span class="st-num">04</span><span class="st-label">Capital Compounding</span></div></div></div>`
  },
  {
    id: 8,
    badge: "LIST #08",
    name: "Glassmorphic VisionOS Floating Step Tiles (Rack-Focus Acrylic)",
    traitId: "trait_glassmorphic_step_tiles",
    concern: "MaterialTreatment",
    targetScope: "step_tiles",
    channels: "backdropFilter, borderColor, translateY, scale, filter.blur",
    conflicts: "None",
    frameExpression: "tileActive = (frame / 30) % 3 | dofBlur = isActive ? 0 : 6px",
    footerSpec: "Frosted Acrylic VisionOS Glass • Specular Rim Reflection • Inactive Steps Gaussian Blurred",
    slug: "glassmorphic-step-tiles",
    code: `.glass-step-tile.active.sharp-tile { filter: blur(0px); opacity: 1; border-color: #38bdf8; background: rgba(56,189,248,0.15); box-shadow: 0 0 20px rgba(56,189,248,0.3); } .glass-step-tile.blurred-tile { filter: blur(6px); opacity: 0.35; }`,
    html: `<div class="list-stage"><div class="glass-tiles-wrap"><div class="glass-step-tile completed"><span class="step-check completed">✓</span><span>Phase 1: Architecture</span></div><div class="glass-step-tile active sharp-tile"><span class="step-check active">▶</span><span>Phase 2: Execution Engine</span></div><div class="glass-step-tile pending blurred-tile"><span class="step-check pending">○</span><span>Phase 3: Scale Distribution</span></div></div></div>`
  },
  {
    id: 9,
    badge: "LIST #09",
    name: "Horizontal Milestone Step Sequencer Track (Infinite Scalability)",
    traitId: "trait_horizontal_milestone_track",
    concern: "TemporalTrigger",
    targetScope: "progress_track",
    channels: "scaleX, beacon.scale, opacity, filter.blur",
    conflicts: "None",
    frameExpression: "trackProgress = (frame % 90) / 90 * 100% | dofBlur = isActive ? 0 : 5px",
    footerSpec: "Horizontal Connected Line • Expanding Active Checkpoint Beacon • Inactive Milestones Gaussian Blurred",
    slug: "horizontal-milestone-track",
    code: `.m-node.active.sharp-node { filter: blur(0px); opacity: 1; } .m-node.blurred-node { filter: blur(5px); opacity: 0.3; }`,
    html: `<div class="list-stage"><div class="milestone-track-container"><div class="milestone-bar-bg"><div class="milestone-bar-fill"></div></div><div class="milestone-nodes-row"><div class="m-node completed"><span class="m-dot">1</span><span class="m-title">Discovery</span></div><div class="m-node active sharp-node"><span class="m-dot">2</span><span class="m-title">Sprint</span></div><div class="m-node pending blurred-node"><span class="m-dot">3</span><span class="m-title">Launch</span></div></div></div></div>`
  }
];

const LIST_CUSTOM_CSS = `
/* ========================================================================= */
/* ANIMA #03 LIST / ENUMERATION SUITE (9 HIGH-TIER CINEMATIC MODULAR PRESETS)*/
/* ========================================================================= */
.list-stage {
  display: flex; align-items: center; justify-content: center;
  width: 100%; height: 100%; position: relative; overflow: hidden;
}

/* 1. 3D Cylindrical Carousel Deck */
.list-carousel-stage {
  perspective: 900px;
}
.list-carousel-3d-wrap {
  display: flex; align-items: center; justify-content: center;
  gap: 16px; transform-style: preserve-3d;
  animation: list-carousel-float 3s ease-in-out infinite;
}
.carousel-card {
  width: 90px; height: 130px; border-radius: 16px;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 16px 30px rgba(0,0,0,0.7);
  transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}
.carousel-card.card-left {
  background: linear-gradient(135deg, #15803d, #22c55e);
  transform: rotateY(35deg) translateZ(-40px) scale(0.85);
}
.carousel-card.card-center {
  background: linear-gradient(135deg, #ea580c, #f59e0b);
  transform: translateZ(55px) scale(1.12); z-index: 10;
  box-shadow: 0 20px 45px rgba(234,88,12,0.5);
}
.carousel-card.card-right {
  background: linear-gradient(135deg, #0284c7, #06b6d4);
  transform: rotateY(-35deg) translateZ(-40px) scale(0.85);
}
.carousel-card.blurred-dof {
  filter: blur(8px) brightness(0.65); opacity: 0.35;
}
.carousel-card.active-focus {
  filter: blur(0px) brightness(1.1); opacity: 1;
}
.carousel-card-num {
  font-size: 38px; font-weight: 900; color: #000; font-family: var(--font-mono);
}
.carousel-card-num.num-blur { filter: blur(3px); }
.carousel-card-num.num-sharp { filter: blur(0px); }
@keyframes list-carousel-float {
  0%, 100% { transform: translateY(0) rotateX(4deg); }
  50% { transform: translateY(-8px) rotateX(-2deg); }
}

/* 2. Vertical Word Stack & Dynamic Kinetic Highlight Track */
.list-vertical-stack-stage {
  background: radial-gradient(circle at 50% 50%, #1e3a8a 0%, #0f172a 90%);
  border-radius: 18px; width: 85%; height: 85%;
  box-shadow: inset 0 0 30px rgba(0,0,0,0.5);
}
.list-vertical-stack-box {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; width: 100%; height: 100%;
}
.v-list-item {
  font-size: 13.5px; font-weight: 700; color: #fff;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.v-list-item.v-list-active {
  display: flex; align-items: center; gap: 8px;
  transform: scale(1.1); color: #fff;
}
.v-list-item.blurred-item {
  filter: blur(5px); opacity: 0.25; transform: scale(0.92);
}
.v-list-item.sharp-item {
  filter: blur(0px); opacity: 1;
}
.v-arrow-pointer {
  color: #fff; font-size: 11px; animation: v-arrow-pulse 1.2s ease-in-out infinite alternate;
}
.v-pill-highlight {
  background: #e11d48; color: #fff; padding: 4px 16px; border-radius: 20px;
  font-weight: 800; font-size: 14px; box-shadow: 0 4px 18px rgba(225,29,72,0.6);
}
@keyframes v-arrow-pulse {
  from { transform: translateX(0); }
  to { transform: translateX(4px); }
}

/* 3. Overlapping Dual-Card Deck with Subtext Toggle */
.list-split-deck-stage {
  display: flex; align-items: center; justify-content: center;
}
.split-card-container {
  position: relative; width: 290px; height: 185px;
}
.split-num-card {
  position: absolute; left: 0; top: 12px; width: 115px; height: 160px;
  background: #1d4ed8; border-radius: 20px;
  display: flex; align-items: flex-start; justify-content: center; padding-top: 24px;
  box-shadow: 0 14px 28px rgba(0,0,0,0.6);
  animation: split-num-float 3s ease-in-out infinite;
}
.split-big-num {
  font-size: 52px; font-weight: 900; color: #e2e8f0; font-family: var(--font-display, sans-serif);
  letter-spacing: -2px;
}
.split-content-card {
  position: absolute; right: 0; top: 0; width: 205px; height: 185px;
  background: #1e40af; border-radius: 20px; padding: 16px 18px;
  display: flex; flex-direction: column; justify-content: space-between;
  box-shadow: 0 20px 40px rgba(0,0,0,0.7); z-index: 2;
  border: 1px solid rgba(255,255,255,0.15);
}
.split-header-row {
  display: flex; justify-content: space-between; align-items: flex-start; gap: 6px;
}
.split-card-title {
  font-size: 15px; font-weight: 900; color: #fff; line-height: 1.2;
}
.subtext-toggle-pill {
  font-size: 8px; font-weight: 800; background: rgba(56,189,248,0.25); color: #38bdf8;
  border: 1px solid #38bdf8; border-radius: 10px; padding: 2px 6px; white-space: nowrap;
}
.split-card-subtext {
  font-size: 9px; color: #93c5fd; line-height: 1.45; opacity: 0.9;
}
@keyframes split-num-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

/* 4. Concentric Bubble Node Sequencer */
.list-bubble-stage {
  padding: 10px;
}
.bubble-list-container {
  display: flex; flex-direction: column; gap: 14px; width: 100%; max-width: 320px;
}
.bubble-item {
  display: flex; align-items: center; gap: 12px;
  font-size: 13px; font-weight: 600; color: var(--text-secondary);
  transition: all 0.4s ease;
}
.bubble-item.blurred-item {
  filter: blur(6px); opacity: 0.3;
}
.bubble-item.sharp-item {
  filter: blur(0px); opacity: 1;
}
.bubble-bullet-icon {
  width: 18px; height: 18px; border-radius: 50%;
  border: 2.5px solid #6366f1; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.bubble-bullet-icon.active {
  border-color: #38bdf8; box-shadow: 0 0 12px #38bdf8;
}
.bubble-inner-dot {
  width: 4px; height: 4px; border-radius: 50%; background: #6366f1;
}
.bubble-bullet-icon.active .bubble-inner-dot { background: #38bdf8; }
.bubble-item-text.highlight {
  color: #fff; font-weight: 800;
}

/* 5. Classical Greek Architectural Pillar Trio */
.list-pillar-cinematic-stage {
  align-items: flex-end; padding-bottom: 0;
  background: radial-gradient(circle at 50% 30%, #0f172a 0%, #020617 90%);
}
.pillar-cinematic-container {
  display: flex; align-items: flex-end; justify-content: center; gap: 20px; width: 100%; height: 100%;
}
.pillar-cinematic-col {
  display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
  position: relative; height: 100%; transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.pillar-img {
  width: 58px; height: auto; object-fit: contain; display: block;
  filter: drop-shadow(0 15px 25px rgba(0,0,0,0.8));
  transition: all 0.5s ease;
}
.pillar-img.pillar-blur { filter: blur(7px) brightness(0.55); opacity: 0.4; }
.pillar-img.pillar-sharp { filter: blur(0px) brightness(1.1); opacity: 1; }
.pillar-giant-num {
  font-family: var(--font-display, 'Syne', sans-serif);
  font-size: 72px; font-weight: 900; line-height: 0.85; letter-spacing: -3px;
  background: linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,0.7) 40%, rgba(255,255,255,0) 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  filter: blur(8px); opacity: 0.35;
  transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  transform: translateY(15px) scale(0.9); margin-bottom: -15px; z-index: 5;
}
.pillar-giant-num.active {
  background: linear-gradient(180deg, #ffffff 0%, #38bdf8 50%, rgba(56,189,248,0) 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  filter: blur(0px) drop-shadow(0 0 25px rgba(56,189,248,0.7)); opacity: 1;
  transform: translateY(0) scale(1.12);
  animation: giant-num-pulse 2.5s ease-in-out infinite alternate;
}
.pillar-col-1 { animation: pillar-rise-1 3s ease-in-out infinite alternate; }
.pillar-col-2 { animation: pillar-rise-2 3s 0.2s ease-in-out infinite alternate; }
.pillar-col-3 { animation: pillar-rise-3 3s 0.4s ease-in-out infinite alternate; }
@keyframes pillar-rise-1 { 0% { transform: translateY(10px); } 100% { transform: translateY(-5px); } }
@keyframes pillar-rise-2 { 0% { transform: translateY(0); } 100% { transform: translateY(-18px); } }
@keyframes pillar-rise-3 { 0% { transform: translateY(15px); } 100% { transform: translateY(-8px); } }
@keyframes giant-num-pulse {
  0% { transform: translateY(0) scale(1.08); filter: blur(0px) drop-shadow(0 0 20px rgba(56,189,248,0.6)); }
  100% { transform: translateY(-6px) scale(1.15); filter: blur(0px) drop-shadow(0 0 35px rgba(56,189,248,0.9)); }
}

/* 6. 5-Pillar Monumental Architectural Framework */
.list-pillars-5-stage {
  background: radial-gradient(circle at 50% 30%, #1e40af 0%, #0f172a 80%);
  align-items: flex-end; padding-bottom: 0;
}
.pillars-5-container {
  display: flex; align-items: flex-end; justify-content: space-around; width: 100%; height: 100%;
  padding: 0 10px;
}
.p5-col {
  display: flex; flex-direction: column; align-items: center; width: 18%; height: 100%; justify-content: flex-end;
  transition: all 0.5s ease;
}
.p5-col.active-pillar {
  filter: blur(0px); opacity: 1; transform: translateY(-8px) scale(1.06);
}
.p5-col.blurred-pillar {
  filter: blur(6px); opacity: 0.35; transform: translateY(0) scale(0.92);
}
.pillar-giant-num-5 {
  font-family: var(--font-display, sans-serif); font-size: 32px; font-weight: 900; line-height: 0.9;
  background: linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,0) 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  filter: blur(4px); opacity: 0.35; margin-bottom: -6px; z-index: 3;
}
.pillar-giant-num-5.active {
  background: linear-gradient(180deg, #ffffff 0%, #38bdf8 70%, rgba(56,189,248,0) 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  filter: blur(0px) drop-shadow(0 0 15px #38bdf8); opacity: 1;
}
.p5-badge {
  background: rgba(0,0,0,0.7); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px;
  padding: 3px 5px; font-size: 8px; font-weight: 700; color: #fff; margin-bottom: 4px;
  display: flex; flex-direction: column; align-items: center; gap: 2px; white-space: nowrap; z-index: 4;
}
.p5-badge.active {
  border-color: #38bdf8; box-shadow: 0 0 14px rgba(56,189,248,0.6); color: #38bdf8;
}
.p5-icon { font-size: 10px; }
.pillar-img-5 {
  width: 44px; height: auto; object-fit: contain; display: block;
}
.pillar-img-5.pillar-blur { filter: blur(6px) brightness(0.55); opacity: 0.35; }
.pillar-img-5.pillar-sharp { filter: blur(0px) brightness(1.1); opacity: 1; }

/* 7. Staggered Stencil Number Stack */
.stencil-quad-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: 90%;
}
.stencil-cell {
  background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle); border-radius: 12px;
  padding: 12px 14px; display: flex; align-items: center; gap: 10px; transition: all 0.4s ease;
}
.stencil-cell.sharp-cell {
  background: rgba(6,182,212,0.15); border-color: var(--accent-cyan); filter: blur(0px); opacity: 1;
  box-shadow: 0 0 20px rgba(6,182,212,0.3);
}
.stencil-cell.blurred-cell {
  filter: blur(7px); opacity: 0.25;
}
.st-num { font-size: 20px; font-weight: 900; font-family: var(--font-mono); color: var(--accent-cyan); }
.st-label { font-size: 12px; font-weight: 700; color: #fff; }

/* 8. Glassmorphic VisionOS Floating Step Tiles */
.glass-tiles-wrap {
  display: flex; flex-direction: column; gap: 8px; width: 85%;
}
.glass-step-tile {
  background: rgba(255,255,255,0.05); backdrop-filter: blur(16px);
  border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; padding: 10px 14px;
  display: flex; align-items: center; gap: 10px; font-size: 12.5px; font-weight: 700;
  transition: all 0.4s ease;
}
.glass-step-tile.sharp-tile {
  border-color: #38bdf8; background: rgba(56,189,248,0.15); box-shadow: 0 0 20px rgba(56,189,248,0.3);
  filter: blur(0px); opacity: 1;
}
.glass-step-tile.blurred-tile {
  filter: blur(6px); opacity: 0.35;
}
.step-check { font-weight: 900; color: #10b981; }
.step-check.active { color: #38bdf8; }
.step-check.pending { color: var(--text-muted); }

/* 9. Horizontal Milestone Step Sequencer Track */
.milestone-track-container {
  width: 90%; display: flex; flex-direction: column; gap: 16px; position: relative;
}
.milestone-bar-bg {
  position: absolute; top: 18px; left: 10%; width: 80%; height: 3px; background: rgba(255,255,255,0.15); z-index: 1;
}
.milestone-bar-fill {
  width: 50%; height: 100%; background: linear-gradient(90deg, #06b6d4, #7c3aed);
}
.milestone-nodes-row {
  display: flex; justify-content: space-between; position: relative; z-index: 2;
}
.m-node {
  display: flex; flex-direction: column; align-items: center; gap: 6px; transition: all 0.4s ease;
}
.m-node.sharp-node { filter: blur(0px); opacity: 1; }
.m-node.blurred-node { filter: blur(5px); opacity: 0.3; }
.m-dot {
  width: 36px; height: 36px; border-radius: 50%; background: #000;
  border: 2px solid var(--border-subtle); display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 12px; color: #fff;
}
.m-node.completed .m-dot { background: #06b6d4; border-color: #06b6d4; color: #000; }
.m-node.active .m-dot { border-color: #7c3aed; box-shadow: 0 0 14px #7c3aed; color: #7c3aed; }
.m-title { font-size: 11px; font-weight: 700; color: #fff; }
`;

// =========================================================================
// RADIAL TICK SVG GENERATOR (Ref Screenshot 01 for ANIMA #06 Percentage)
// =========================================================================
function generateRadialTicksSvg(activePct: number = 20, totalTicks: number = 48): string {
  const activeCount = Math.round((activePct / 100) * totalTicks);
  const cx = 100, cy = 100, rInner = 62, rOuterActive = 92, rOuterInactive = 80;
  let ticks = "";
  for (let i = 0; i < totalTicks; i++) {
    const angleDeg = (i / totalTicks) * 360 - 90;
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const isActive = i < activeCount;
    const rOuter = isActive ? rOuterActive : rOuterInactive;
    const x1 = (cx + rInner * cos).toFixed(1);
    const y1 = (cy + rInner * sin).toFixed(1);
    const x2 = (cx + rOuter * cos).toFixed(1);
    const y2 = (cy + rOuter * sin).toFixed(1);
    const stroke = isActive ? "url(#tickOrangeGrad)" : "rgba(255,255,255,0.18)";
    const width = isActive ? "2.8" : "1.8";
    ticks += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" />`;
  }
  return ticks;
}

// 5. CHART / GRAPH 8 HIGH-TIER PROGRESSIVE TEMPORAL REVEAL VECTOR PRESETS (ANIMA #04)
const CHART_GRAPH_8_PRESETS: ArchetypeVariant[] = [
  {
    id: 1,
    badge: "CHART #01",
    name: "Exponential Bullish Parabolic Uptrend (Progressive Line Draw & Area Flow)",
    traitId: "trait_exponential_uptrend_spline",
    concern: "TemporalTrigger + MotionPhysics",
    targetScope: "chart_spline",
    channels: "strokeDashoffset, clipPath.width, opacity, scale, filter.dropShadow",
    conflicts: "None",
    frameExpression: "splineDraw = easeOutCubic(frame / 60) | areaReveal = splineDraw * 300px",
    footerSpec: "Positive Resolution • Simultaneous Progressive Line Draw & Area Flow • Staggered Milestone Badges (50k ➔ 70k ➔ 80만) • Apex Beacon Bloom",
    slug: "exponential-uptrend-spline",
    code: `.chart-spline-1 { stroke-dasharray: 600; stroke-dashoffset: 600; animation: prog-draw-spline-1 3.5s cubic-bezier(0.2, 0.8, 0.2, 1) infinite; }`,
    html: `<div class="chart-stage chart-prog-stage chart-c1-stage"><svg class="chart-svg-main" viewBox="0 0 320 180" fill="none"><defs><linearGradient id="limeAreaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#a3e635" stop-opacity="0.65"/><stop offset="50%" stop-color="#84cc16" stop-opacity="0.25"/><stop offset="100%" stop-color="#84cc16" stop-opacity="0.0"/></linearGradient><clipPath id="clipProg1"><rect class="prog-clip-rect-1" x="0" y="0" width="0" height="180"/></clipPath><filter id="neonLimeGlow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g clip-path="url(#clipProg1)"><path class="chart-area-fill" d="M 20 160 Q 140 155 220 90 T 290 25 L 290 160 L 20 160 Z" fill="url(#limeAreaGrad)"/><path class="chart-spline-stroke chart-spline-1" d="M 20 160 Q 140 155 220 90 T 290 25" stroke="#d9f99d" stroke-width="3.5" filter="url(#neonLimeGlow)" stroke-linecap="round"/><line class="chart-drop-line d1" x1="120" y1="145" x2="120" y2="160" stroke="rgba(255,255,255,0.2)" stroke-dasharray="3,3"/><line class="chart-drop-line d2" x1="200" y1="108" x2="200" y2="160" stroke="rgba(255,255,255,0.2)" stroke-dasharray="3,3"/><line class="chart-drop-line d3" x1="290" y1="25" x2="290" y2="160" stroke="rgba(255,255,255,0.35)" stroke-dasharray="3,3"/><circle class="chart-node-dot dot-1" cx="120" cy="145" r="3.5" fill="#fff"/><circle class="chart-node-dot dot-2" cx="200" cy="108" r="4.5" fill="#fff"/><circle class="chart-apex-beacon beacon-1" cx="290" cy="25" r="6" fill="#fff" filter="drop-shadow(0 0 12px #a3e635)"/></g></svg><div class="chart-floating-badge c1-b1">50k</div><div class="chart-floating-badge c1-b2">70k</div><div class="chart-floating-badge c1-b3 apex">80만</div><div class="chart-x-labels"><span>23.07</span><span>24.02</span><span>24.10</span></div></div>`
  },
  {
    id: 2,
    badge: "CHART #02",
    name: "Harmonic Volatility Spline & Downward Fall (Progressive Sine Wave & Curve Draw)",
    traitId: "trait_volatility_waveform_spline",
    concern: "TemporalTrigger + MotionPhysics",
    targetScope: "wave_path",
    channels: "strokeDashoffset, clipPath.width, opacity",
    conflicts: "None",
    frameExpression: "waveDraw = easeOutQuad(frame / 60) | areaWidth = waveDraw * 320px",
    footerSpec: "Negative Resolution • Progressive Spline Curve Draw with Sync'd Indigo Area Unmask • Harmonic Crests & Lower Plunge",
    slug: "harmonic-volatility-waveform",
    code: `.wave-spline-2 { stroke-dasharray: 800; stroke-dashoffset: 800; animation: prog-draw-spline-2 3.5s ease-out infinite; }`,
    html: `<div class="chart-stage chart-prog-stage chart-c2-stage"><svg class="chart-svg-main" viewBox="0 0 320 180" fill="none"><defs><linearGradient id="waveIndigoGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#818cf8" stop-opacity="0.55"/><stop offset="100%" stop-color="#312e81" stop-opacity="0.0"/></linearGradient><clipPath id="clipProg2"><rect class="prog-clip-rect-2" x="0" y="0" width="0" height="180"/></clipPath></defs><g clip-path="url(#clipProg2)"><path class="wave-area-path" d="M 20 50 C 40 50, 50 120, 70 125 C 90 130, 100 155, 120 155 C 150 155, 170 125, 190 120 C 210 115, 230 45, 250 45 C 270 45, 280 135, 300 160 L 300 170 L 20 170 Z" fill="url(#waveIndigoGrad)"/><path class="wave-stroke-path wave-spline-2" d="M 20 50 C 40 50, 50 120, 70 125 C 90 130, 100 155, 120 155 C 150 155, 170 125, 190 120 C 210 115, 230 45, 250 45 C 270 45, 280 135, 300 160" stroke="#a5b4fc" stroke-width="3.5" stroke-linecap="round"/></g></svg></div>`
  },
  {
    id: 3,
    badge: "CHART #03",
    name: "Neon Telemetry Laser Spline & Apex Tooltip Callout (Progressive Laser Line & Projection)",
    traitId: "trait_telemetry_apex_tooltip_spline",
    concern: "TemporalTrigger + Structures",
    targetScope: "telemetry_cursor",
    channels: "strokeDashoffset, opacity, translateY, filter.dropShadow",
    conflicts: "None",
    frameExpression: "laserDraw = easeOutCubic(frame / 50) | tooltipPop = (frame > 35)",
    footerSpec: "Declining Projection Resolution • Progressive Cyan Laser Stroke Draw • Tooltip Pill (783 kwh) Emerges at Apex • Dotted Decline",
    slug: "telemetry-apex-tooltip-spline",
    code: `.telemetry-solid-3 { stroke-dasharray: 400; stroke-dashoffset: 400; animation: prog-draw-laser-3 3.5s ease-out infinite; }`,
    html: `<div class="chart-stage chart-prog-stage chart-c3-stage"><div class="telemetry-tooltip-pill c3-tooltip">783 kwh</div><svg class="chart-svg-main" viewBox="0 0 320 180" fill="none"><defs><clipPath id="clipProg3"><rect class="prog-clip-rect-3" x="0" y="0" width="0" height="180"/></clipPath></defs><g clip-path="url(#clipProg3)"><line class="telemetry-vertical-laser c3-vert" x1="180" y1="40" x2="180" y2="170" stroke="rgba(56,189,248,0.4)" stroke-width="1.5"/><path class="telemetry-solid-spline telemetry-solid-3" d="M 10 80 C 40 80, 60 120, 90 120 C 120 120, 140 90, 160 85 L 180 40" stroke="#38bdf8" stroke-width="3.5" stroke-linecap="round" filter="drop-shadow(0 0 10px #0284c7)"/><path class="telemetry-future-dashed c3-dashed" d="M 180 40 C 200 40, 220 65, 250 65 C 280 65, 290 95, 310 110" stroke="rgba(255,255,255,0.3)" stroke-width="2" stroke-dasharray="4,4" stroke-linecap="round"/><circle class="telemetry-apex-node c3-apex" cx="180" cy="40" r="6" fill="#ffffff" filter="drop-shadow(0 0 14px #38bdf8)"/></g></svg></div>`
  },
  {
    id: 4,
    badge: "CHART #04",
    name: "Segmented Multi-Peak Area Grid (Progressive Curve Draw & Coordinate Lattice)",
    traitId: "trait_segmented_peak_area_grid",
    concern: "TemporalTrigger + Structures",
    targetScope: "area_peaks",
    channels: "clipPath.width, strokeDashoffset, opacity, scaleY",
    conflicts: "None",
    frameExpression: "gridUnmask = (frame / 55) * 320px | peakDraw = easeOutCubic(frame / 50)",
    footerSpec: "Negative Resolution • Progressive Grid Lattice & Amber Jagged Line Draw • Peak Callout (58 h) • Floor Descent",
    slug: "segmented-peak-area-grid",
    code: `.amber-peak-stroke-4 { stroke-dasharray: 700; stroke-dashoffset: 700; animation: prog-draw-amber-4 3.5s ease-out infinite; }`,
    html: `<div class="chart-stage chart-prog-stage chart-c4-stage"><div class="amber-peak-badge c4-badge">58 h</div><svg class="chart-svg-main" viewBox="0 0 320 180" fill="none"><defs><linearGradient id="amberAreaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f97316" stop-opacity="0.75"/><stop offset="60%" stop-color="#ea580c" stop-opacity="0.3"/><stop offset="100%" stop-color="#9a3412" stop-opacity="0.0"/></linearGradient><clipPath id="clipProg4"><rect class="prog-clip-rect-4" x="0" y="0" width="0" height="180"/></clipPath></defs><g clip-path="url(#clipProg4)"><g class="amber-vert-grid" stroke="rgba(255,255,255,0.08)" stroke-width="1"><line x1="40" y1="20" x2="40" y2="170"/><line x1="70" y1="20" x2="70" y2="170"/><line x1="100" y1="20" x2="100" y2="170"/><line x1="130" y1="20" x2="130" y2="170"/><line x1="160" y1="20" x2="160" y2="170"/><line x1="190" y1="20" x2="190" y2="170"/><line x1="220" y1="20" x2="220" y2="170"/><line x1="250" y1="20" x2="250" y2="170"/><line x1="280" y1="20" x2="280" y2="170"/></g><path d="M 20 40 L 40 85 L 60 105 L 85 65 L 110 75 L 135 25 L 180 40 L 210 80 L 235 65 L 260 85 L 275 75 L 295 105 L 310 160 L 20 160 Z" fill="url(#amberAreaGrad)"/><path class="amber-peak-stroke amber-peak-stroke-4" d="M 20 40 L 40 85 L 60 105 L 85 65 L 110 75 L 135 25 L 180 40 L 210 80 L 235 65 L 260 85 L 275 75 L 295 105 L 310 160" stroke="#fb923c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><line x1="135" y1="25" x2="135" y2="170" stroke="#f97316" stroke-width="1.5"/><circle cx="135" cy="25" r="5" fill="#ea580c" stroke="#fed7aa" stroke-width="2" filter="drop-shadow(0 0 10px #f97316)"/></g></svg></div>`
  },
  {
    id: 5,
    badge: "CHART #05",
    name: "Bearish Selloff Crash Area Grid (Progressive Crash Slope Line & Area Flow)",
    traitId: "trait_bearish_selloff_crash_grid",
    concern: "TemporalTrigger + MotionPhysics",
    targetScope: "crash_slope",
    channels: "strokeDashoffset, clipPath.width, opacity",
    conflicts: "None",
    frameExpression: "crashProg = (frame / 50) * 320px | badgePop = (frame > 45)",
    footerSpec: "Negative Crash Resolution • Starts High (t=0) ➔ Progressive Crimson Line & Red Wash Cascade ➔ Drawdown Badge (-68.4% CRASH)",
    slug: "bearish-selloff-crash-grid",
    code: `.crash-stroke-5 { stroke-dasharray: 800; stroke-dashoffset: 800; animation: prog-draw-crash-5 3.5s ease-out infinite; }`,
    html: `<div class="chart-stage chart-prog-stage chart-c5-stage"><svg class="chart-svg-main" viewBox="0 0 320 180" fill="none"><defs><linearGradient id="crashRedGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ef4444" stop-opacity="0.9"/><stop offset="50%" stop-color="#b91c1c" stop-opacity="0.5"/><stop offset="100%" stop-color="#450a0a" stop-opacity="0.2"/></linearGradient><pattern id="crashGridPat" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="0.7"/></pattern><clipPath id="clipProg5"><rect class="prog-clip-rect-5" x="0" y="0" width="0" height="180"/></clipPath></defs><rect x="0" y="0" width="320" height="180" fill="url(#crashGridPat)"/><g clip-path="url(#clipProg5)"><path d="M 10 20 L 35 50 L 50 30 L 80 45 L 105 60 L 125 45 L 150 95 L 165 110 L 175 95 L 190 120 L 215 110 L 235 130 L 260 125 L 275 140 L 285 130 L 310 170 L 10 170 Z" fill="url(#crashRedGrad)"/><path class="crash-stroke-line crash-stroke-5" d="M 10 20 L 35 50 L 50 30 L 80 45 L 105 60 L 125 45 L 150 95 L 165 110 L 175 95 L 190 120 L 215 110 L 235 130 L 260 125 L 275 140 L 285 130 L 310 170" stroke="#fca5a5" stroke-width="3.5" stroke-linejoin="round"/></g></svg><div class="crash-drawdown-badge c5-badge">-68.4% CRASH</div></div>`
  },
  {
    id: 6,
    badge: "CHART #06",
    name: "Crimson Laser Downtrend Arrow (Progressive Laser Path & Sequential Beacons)",
    traitId: "trait_crimson_downtrend_vertex_arrow",
    concern: "TemporalTrigger + VectorMotionPhysics",
    targetScope: "laser_arrow_track",
    channels: "strokeDashoffset, opacity, scale, filter.dropShadow",
    conflicts: "None",
    frameExpression: "laserPathDraw = easeOutCubic(frame / 50)",
    footerSpec: "Negative Resolution • Progressive Laser Beam Curve Draw • Staggered Vertex Nodes (1 ➔ 2 ➔ 3 ➔ 4 ➔ 5) • Terminal Crash Arrow (↘)",
    slug: "crimson-downtrend-vertex-arrow",
    code: `.crimson-laser-6 { stroke-dasharray: 800; stroke-dashoffset: 800; animation: prog-draw-crimson-6 3.5s ease-out infinite; }`,
    html: `<div class="chart-stage chart-prog-stage chart-c6-stage"><svg class="chart-svg-main" viewBox="0 0 320 180" fill="none"><defs><linearGradient id="crimsonAreaGlow" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#dc2626" stop-opacity="0.6"/><stop offset="100%" stop-color="#450a0a" stop-opacity="0.0"/></linearGradient><clipPath id="clipProg6"><rect class="prog-clip-rect-6" x="0" y="0" width="0" height="180"/></clipPath><filter id="crimsonLaserGlow"><feGaussianBlur stdDeviation="3.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g clip-path="url(#clipProg6)"><path d="M 10 10 L 50 60 L 95 30 L 140 50 L 180 140 L 230 110 L 290 170 L 10 170 Z" fill="url(#crimsonAreaGlow)"/><path class="crimson-laser-path crimson-laser-6" d="M 10 10 L 50 60 L 95 30 L 140 50 L 180 140 L 230 110 L 290 170" stroke="#ff2a4b" stroke-width="4.5" filter="url(#crimsonLaserGlow)" stroke-linecap="round" stroke-linejoin="round"/><path class="c6-arrow" d="M 270 170 L 290 170 L 290 150" stroke="#ff2a4b" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/><circle class="c6-node node-1" cx="50" cy="60" r="5" fill="#ff4d6d" filter="drop-shadow(0 0 8px #ff0033)"/><circle class="c6-node node-2" cx="95" cy="30" r="5" fill="#ff4d6d" filter="drop-shadow(0 0 8px #ff0033)"/><circle class="c6-node node-3" cx="140" cy="50" r="5" fill="#ff4d6d" filter="drop-shadow(0 0 8px #ff0033)"/><circle class="c6-node node-4" cx="180" cy="140" r="5" fill="#ff4d6d" filter="drop-shadow(0 0 8px #ff0033)"/><circle class="c6-node node-5" cx="230" cy="110" r="5" fill="#ff4d6d" filter="drop-shadow(0 0 8px #ff0033)"/></g></svg></div>`
  },
  {
    id: 7,
    badge: "CHART #07",
    name: "High-Voltage Neon Emerald Bullish Mountain (Progressive Mountain Ridge Line & Fill)",
    traitId: "trait_neon_emerald_bullish_mountain",
    concern: "TemporalTrigger + MotionPhysics",
    targetScope: "emerald_mountain",
    channels: "strokeDashoffset, clipPath.width, scale",
    conflicts: "None",
    frameExpression: "mountainDraw = easeOutExpo(frame / 50)",
    footerSpec: "Positive Resolution • Progressive Laser Ridge Line Draw • Deep Forest Green Fill Expansion • Climax Apex Summit",
    slug: "neon-emerald-bullish-mountain",
    code: `.emerald-ridge-7 { stroke-dasharray: 800; stroke-dashoffset: 800; animation: prog-draw-emerald-7 3.5s ease-out infinite; }`,
    html: `<div class="chart-stage chart-prog-stage chart-c7-stage"><svg class="chart-svg-main" viewBox="0 0 320 180" fill="none"><defs><linearGradient id="emeraldMountainGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#10b981" stop-opacity="0.8"/><stop offset="40%" stop-color="#064e3b" stop-opacity="0.6"/><stop offset="100%" stop-color="#022c22" stop-opacity="0.9"/></linearGradient><clipPath id="clipProg7"><rect class="prog-clip-rect-7" x="0" y="0" width="0" height="180"/></clipPath><filter id="emeraldLaserGlow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g clip-path="url(#clipProg7)"><path d="M 0 145 L 35 155 L 75 110 L 105 155 L 140 120 L 175 145 L 220 70 L 245 95 L 320 5 L 320 180 L 0 180 Z" fill="url(#emeraldMountainGrad)"/><path class="emerald-ridge-stroke emerald-ridge-7" d="M 0 145 L 35 155 L 75 110 L 105 155 L 140 120 L 175 145 L 220 70 L 245 95 L 320 5" stroke="#34d399" stroke-width="4.5" filter="url(#emeraldLaserGlow)" stroke-linecap="round" stroke-linejoin="round"/></g></svg></div>`
  },
  {
    id: 8,
    badge: "CHART #08",
    name: "Minimalist Candlestick Frequency Spectrum (Individual Staggered Rise)",
    traitId: "trait_candlestick_frequency_spectrum",
    concern: "TemporalTrigger + Structures",
    targetScope: "candlestick_bars",
    channels: "scaleY, opacity, translateY",
    conflicts: "None",
    frameExpression: "barHeight = (frame > barIdx*4) ? scaleY(1) : scaleY(0)",
    footerSpec: "Positive/Frequency • 15 Individual Vertical Tick Bars • Staggered Left-to-Right Upward Growth • Zero Pulsating Static",
    slug: "candlestick-frequency-spectrum",
    code: `.c-bar-prog { transform-origin: bottom; animation: prog-bar-grow 3.2s cubic-bezier(0.16, 1, 0.3, 1) infinite; }`,
    html: `<div class="chart-stage chart-spectrum-stage"><div class="candlestick-bars-container"><div class="c-bar c-bar-prog" style="height: 45px; animation-delay: 0.05s;"></div><div class="c-bar c-bar-prog" style="height: 30px; animation-delay: 0.10s;"></div><div class="c-bar c-bar-prog" style="height: 60px; animation-delay: 0.15s;"></div><div class="c-bar c-bar-prog" style="height: 85px; animation-delay: 0.20s;"></div><div class="c-bar c-bar-prog" style="height: 55px; animation-delay: 0.25s;"></div><div class="c-bar c-bar-prog" style="height: 25px; animation-delay: 0.30s;"></div><div class="c-bar c-bar-prog" style="height: 40px; animation-delay: 0.35s;"></div><div class="c-bar c-bar-prog" style="height: 70px; animation-delay: 0.40s;"></div><div class="c-bar c-bar-prog" style="height: 60px; animation-delay: 0.45s;"></div><div class="c-bar c-bar-prog active-pulse" style="height: 105px; animation-delay: 0.50s;"></div><div class="c-bar c-bar-prog" style="height: 35px; animation-delay: 0.55s;"></div><div class="c-bar c-bar-prog" style="height: 65px; animation-delay: 0.60s;"></div><div class="c-bar c-bar-prog" style="height: 80px; animation-delay: 0.65s;"></div><div class="c-bar c-bar-prog" style="height: 45px; animation-delay: 0.70s;"></div><div class="c-bar c-bar-prog" style="height: 95px; animation-delay: 0.75s;"></div></div></div>`
  }
];

const CHART_CUSTOM_CSS = `
/* ========================================================================= */
/* ANIMA #04 CHART / GRAPH SUITE (PROGRESSIVE TEMPORAL REVEAL ENGINES)       */
/* ========================================================================= */
.chart-stage {
  display: flex; align-items: center; justify-content: center;
  width: 100%; height: 100%; position: relative; overflow: hidden;
}
.chart-svg-main {
  width: 100%; height: 100%; max-height: 190px;
}

/* --- 1. EXPONENTIAL UPTREND PROGRESSIVE DRAW --- */
.chart-spline-1 {
  stroke-dasharray: 600;
  stroke-dashoffset: 600;
  animation: prog-draw-spline-1 3.5s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
}
.prog-clip-rect-1 {
  animation: prog-expand-rect-1 3.5s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
}
@keyframes prog-draw-spline-1 {
  0% { stroke-dashoffset: 600; }
  65%, 88% { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: 600; }
}
@keyframes prog-expand-rect-1 {
  0% { width: 0px; }
  65%, 88% { width: 320px; }
  100% { width: 0px; }
}
.c1-b1 {
  opacity: 0; transform: translateY(8px);
  animation: c1-pop-badge-1 3.5s ease-out infinite;
}
.c1-b2 {
  opacity: 0; transform: translateY(8px);
  animation: c1-pop-badge-2 3.5s ease-out infinite;
}
.c1-b3.apex {
  opacity: 0; transform: scale(0);
  animation: c1-pop-apex 3.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) infinite;
}
@keyframes c1-pop-badge-1 {
  0%, 20% { opacity: 0; transform: translateY(8px); }
  28%, 88% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; }
}
@keyframes c1-pop-badge-2 {
  0%, 42% { opacity: 0; transform: translateY(8px); }
  50%, 88% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; }
}
@keyframes c1-pop-apex {
  0%, 60% { opacity: 0; transform: scale(0); filter: drop-shadow(0 0 0 transparent); }
  68%, 88% { opacity: 1; transform: scale(1.08); filter: drop-shadow(0 0 16px #a3e635); }
  100% { opacity: 0; transform: scale(0); }
}
.chart-floating-badge {
  position: absolute; background: rgba(0,0,0,0.85); border: 1px solid rgba(255,255,255,0.25);
  border-radius: 6px; padding: 2px 6px; font-size: 9px; font-weight: 800; color: #fff;
  font-family: var(--font-mono);
}
.c1-b1 { left: 35%; top: 68%; }
.c1-b2 { left: 60%; top: 50%; }
.c1-b3.apex {
  right: 8%; top: 6%; background: #a3e635; color: #000; border-color: #bef264;
}
.chart-x-labels {
  position: absolute; bottom: 8px; left: 0; width: 100%; display: flex; justify-content: space-around;
  font-size: 8.5px; font-family: var(--font-mono); color: rgba(255,255,255,0.4);
}

/* --- 2. HARMONIC VOLATILITY SINE DRAW --- */
.wave-spline-2 {
  stroke-dasharray: 800;
  stroke-dashoffset: 800;
  animation: prog-draw-spline-2 3.5s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
}
.prog-clip-rect-2 {
  animation: prog-expand-rect-2 3.5s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
}
@keyframes prog-draw-spline-2 {
  0% { stroke-dashoffset: 800; }
  65%, 88% { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: 800; }
}
@keyframes prog-expand-rect-2 {
  0% { width: 0px; }
  65%, 88% { width: 320px; }
  100% { width: 0px; }
}

/* --- 3. NEON TELEMETRY DECLINING DRAW --- */
.telemetry-solid-3 {
  stroke-dasharray: 400;
  stroke-dashoffset: 400;
  animation: prog-draw-laser-3 3.5s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
}
.prog-clip-rect-3 {
  animation: prog-expand-rect-3 3.5s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
}
@keyframes prog-draw-laser-3 {
  0% { stroke-dashoffset: 400; }
  55%, 88% { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: 400; }
}
@keyframes prog-expand-rect-3 {
  0% { width: 0px; }
  65%, 88% { width: 320px; }
  100% { width: 0px; }
}
.c3-tooltip {
  opacity: 0; transform: translate(-50%, 6px);
  animation: c3-pop-tooltip 3.5s ease-out infinite;
}
.c3-vert, .c3-apex {
  opacity: 0;
  animation: c3-pop-apex 3.5s ease-out infinite;
}
.c3-dashed {
  opacity: 0;
  animation: c3-pop-dashed 3.5s ease-out infinite;
}
@keyframes c3-pop-tooltip {
  0%, 48% { opacity: 0; transform: translate(-50%, 6px); }
  56%, 88% { opacity: 1; transform: translate(-50%, 0); }
  100% { opacity: 0; }
}
@keyframes c3-pop-apex {
  0%, 48% { opacity: 0; }
  56%, 88% { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes c3-pop-dashed {
  0%, 60% { opacity: 0; }
  70%, 88% { opacity: 1; }
  100% { opacity: 0; }
}
.telemetry-tooltip-pill {
  position: absolute; top: 14px; left: 50%;
  background: rgba(30,58,138,0.9); backdrop-filter: blur(12px); border: 1px solid rgba(56,189,248,0.6);
  border-radius: 6px; padding: 3px 8px; font-size: 10px; font-weight: 800; color: #fff;
  font-family: var(--font-mono); box-shadow: 0 0 14px rgba(56,189,248,0.5); z-index: 10;
}

/* --- 4. SEGMENTED PEAK AREA GRID DRAW --- */
.amber-peak-stroke-4 {
  stroke-dasharray: 700;
  stroke-dashoffset: 700;
  animation: prog-draw-amber-4 3.5s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
}
.prog-clip-rect-4 {
  animation: prog-expand-rect-4 3.5s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
}
@keyframes prog-draw-amber-4 {
  0% { stroke-dashoffset: 700; }
  65%, 88% { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: 700; }
}
@keyframes prog-expand-rect-4 {
  0% { width: 0px; }
  65%, 88% { width: 320px; }
  100% { width: 0px; }
}
.c4-badge {
  opacity: 0; transform: translateY(6px);
  animation: c4-pop-badge 3.5s ease-out infinite;
}
@keyframes c4-pop-badge {
  0%, 38% { opacity: 0; transform: translateY(6px); }
  45%, 88% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; }
}
.amber-peak-badge {
  position: absolute; top: 12px; left: 40%;
  background: rgba(0,0,0,0.85); border: 1px solid #f97316; border-radius: 6px;
  padding: 2px 6px; font-size: 9.5px; font-weight: 800; color: #fff; font-family: var(--font-mono);
}

/* --- 5. BEARISH SELLOFF CRASH PROGRESSIVE DRAW --- */
.crash-stroke-5 {
  stroke-dasharray: 800;
  stroke-dashoffset: 800;
  animation: prog-draw-crash-5 3.5s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
}
.prog-clip-rect-5 {
  animation: prog-expand-rect-5 3.5s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
}
@keyframes prog-draw-crash-5 {
  0% { stroke-dashoffset: 800; }
  65%, 88% { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: 800; }
}
@keyframes prog-expand-rect-5 {
  0% { width: 0px; }
  65%, 88% { width: 320px; }
  100% { width: 0px; }
}
.c5-badge {
  opacity: 0; transform: scale(0.7);
  animation: c5-pop-crash 3.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) infinite;
}
@keyframes c5-pop-crash {
  0%, 65% { opacity: 0; transform: scale(0.7); }
  72%, 88% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; }
}
.crash-drawdown-badge {
  position: absolute; bottom: 18px; left: 16px;
  background: #dc2626; color: #fff; font-weight: 900; font-size: 10px;
  padding: 4px 8px; border-radius: 6px; box-shadow: 0 0 16px rgba(220,38,38,0.8);
}

/* --- 6. CRIMSON LASER PROGRESSIVE VERTICES --- */
.crimson-laser-6 {
  stroke-dasharray: 800;
  stroke-dashoffset: 800;
  animation: prog-draw-crimson-6 3.5s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
}
.prog-clip-rect-6 {
  animation: prog-expand-rect-6 3.5s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
}
@keyframes prog-draw-crimson-6 {
  0% { stroke-dashoffset: 800; }
  65%, 88% { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: 800; }
}
@keyframes prog-expand-rect-6 {
  0% { width: 0px; }
  65%, 88% { width: 320px; }
  100% { width: 0px; }
}
.c6-arrow {
  opacity: 0;
  animation: c6-pop-arrow 3.5s ease-out infinite;
}
@keyframes c6-pop-arrow {
  0%, 62% { opacity: 0; transform: translate(4px, 4px); }
  68%, 88% { opacity: 1; transform: translate(0, 0); }
  100% { opacity: 0; }
}

/* --- 7. NEON EMERALD MOUNTAIN RIDGE DRAW --- */
.emerald-ridge-7 {
  stroke-dasharray: 800;
  stroke-dashoffset: 800;
  animation: prog-draw-emerald-7 3.5s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
}
.prog-clip-rect-7 {
  animation: prog-expand-rect-7 3.5s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
}
@keyframes prog-draw-emerald-7 {
  0% { stroke-dashoffset: 800; }
  65%, 88% { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: 800; }
}
@keyframes prog-expand-rect-7 {
  0% { width: 0px; }
  65%, 88% { width: 320px; }
  100% { width: 0px; }
}

/* --- 8. CANDLESTICK SPECTRUM INDIVIDUAL RISE --- */
.chart-spectrum-stage { padding: 10px; }
.candlestick-bars-container {
  display: flex; align-items: flex-end; justify-content: center; gap: 8px; height: 120px; width: 100%;
}
.c-bar {
  width: 5px; background: rgba(255,255,255,0.7); border-radius: 3px;
}
.c-bar-prog {
  transform-origin: bottom;
  transform: scaleY(0); opacity: 0;
  animation: prog-bar-grow 3.2s cubic-bezier(0.16, 1, 0.3, 1) infinite;
}
@keyframes prog-bar-grow {
  0% { transform: scaleY(0); opacity: 0; }
  22% { transform: scaleY(1); opacity: 1; }
  85% { transform: scaleY(1); opacity: 1; }
  100% { transform: scaleY(0); opacity: 0; }
}
.c-bar.active-pulse { background: #38bdf8; box-shadow: 0 0 14px #38bdf8; }
`;

// 6. NUMBER / STATISTIC 6 HIGH-TIER CINEMATIC PRESETS (ANIMA #05)
const NUMBER_STATISTIC_6_PRESETS: ArchetypeVariant[] = [
  {
    id: 1,
    badge: "NUM #01",
    name: "Liquid Velocity Smear with Glitch Drop & Shockwave Ring (Ref Screenshot 01)",
    traitId: "trait_liquid_velocity_smear_numeral",
    concern: "TemporalTrigger + MaterialTreatment",
    targetScope: "numeral_mesh",
    channels: "filter.blur, opacity, transform.translate, textShadow, transform.scale",
    conflicts: "None",
    frameExpression: "glitchDrop = easeOutBack(frame / 20) | shockwave = (frame > 18) ? scale((frame-18)/12 * 3.2) : 0",
    footerSpec: "Vibrant Cobalt Blue Stage • Initial Glitch-In Drop • Directional Liquid Smear Flare • Impact Snap with Expanding Neon Shockwave Ring",
    slug: "liquid-velocity-smear-numeral",
    code: `.num-glitch-drop { animation: num-glitch-drop-in 3.2s cubic-bezier(0.16, 1, 0.3, 1) infinite; } .num-liquid-shockwave { animation: num-liquid-shockwave-ring 3.2s cubic-bezier(0.16, 1, 0.3, 1) infinite; }`,
    html: `<div class="num-stage num-liquid-stage"><div class="num-liquid-backdrop-glow"></div><div class="num-shockwave-ring num-liquid-shockwave"></div><div class="num-liquid-container num-glitch-drop"><div class="num-liquid-smear-trail">9</div><div class="num-liquid-core">9</div></div><div class="num-subtext-pill">Fluid Velocity Smear & Shockwave</div></div>`
  },
  {
    id: 2,
    badge: "NUM #02",
    name: "Staggered Multi-Reel Vertical Slot Tumbler (Ref Screenshot 02)",
    traitId: "trait_multi_reel_slot_tumbler",
    concern: "SequenceComposition + MotionPhysics",
    targetScope: "digit_columns",
    channels: "translateY, filter.blur, opacity",
    conflicts: "None",
    frameExpression: "reel1 = easeOutBack(clamp(frame/40, 0, 1)) | reel2 = easeOutBack(clamp((frame-8)/40, 0, 1)) | reel3 = easeOutBack(clamp((frame-16)/40, 0, 1))",
    footerSpec: "3 Independent Digit Reels (5 • 5 • 1) • Asynchronous Rolling Speeds • Motion Blur During Transit • Elastic Snap Lock",
    slug: "multi-reel-slot-tumbler",
    code: `.num-reel-col.r1 .num-reel-strip { animation: reel-spin-1 3.2s cubic-bezier(0.175, 0.885, 0.32, 1.15) infinite; }`,
    html: `<div class="num-stage num-reel-stage"><div class="num-reels-wrapper"><div class="num-reel-col r1"><div class="num-reel-strip"><span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span class="active">5</span><span>6</span><span>7</span></div></div><div class="num-reel-col r2"><div class="num-reel-strip"><span>0</span><span>2</span><span>4</span><span>3</span><span>6</span><span class="active">5</span><span>8</span><span>9</span></div></div><div class="num-reel-col r3"><div class="num-reel-strip"><span>7</span><span>8</span><span>9</span><span>0</span><span>3</span><span class="active">1</span><span>2</span><span>4</span></div></div></div><div class="num-subtext-pill">Staggered Multi-Reel Slot Tumbler</div></div>`
  },
  {
    id: 3,
    badge: "NUM #03",
    name: "Mechanical Slanted Zeroes with Elastic Rebound Bounce",
    traitId: "trait_slanted_zeros_bounce",
    concern: "Structures + TemporalTrigger",
    targetScope: "counter_digits",
    channels: "transform.skewX, scale, translateY, color",
    conflicts: "None",
    frameExpression: "zeroSlant = -14deg | singleBounce = sin((frame-45)/10)*18px",
    footerSpec: "Mechanical Rapid Count-Up ($50,000) • Post-Lock Slanted Zeroes Line • Solitary Middle Zero Elastic Rebound Bounce & Correct",
    slug: "slanted-zeros-bounce",
    code: `.num-slant-zeros { animation: num-slant-lock-clean 3.4s cubic-bezier(0.16, 1, 0.3, 1) infinite; } .z-bounce { animation: num-single-zero-bounce 3.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) infinite; }`,
    html: `<div class="num-stage num-slant-stage"><div class="num-slant-container"><span class="num-slant-prefix">$</span><span class="num-slant-lead">5</span><span class="num-slant-zeros"><span class="z-char">0</span><span class="z-char z-bounce">0</span><span class="z-char">0</span></span></div><div class="num-subtext-pill">Slanted Zeroes & Elastic Bounce</div></div>`
  },
  {
    id: 4,
    badge: "NUM #04",
    name: "Domino Falling Zero Physics Knock (Post-Lock Leftward Cascade)",
    traitId: "trait_domino_falling_zero_knock",
    concern: "MotionPhysics + SequenceComposition",
    targetScope: "domino_zeroes",
    channels: "transform.rotate, translateX, textShadow, color",
    conflicts: "None",
    frameExpression: "dominoFall = easeOutBounce((frame - 35)/20) * -26deg | dominoKnock = (frame > 45) ? 6px : 0px",
    footerSpec: "Physics Domino Collapse • Zero After Comma Tilts & Falls Leftward (-26deg) • Knocks Adjacent Zero • Organic Rebound Alignment",
    slug: "domino-falling-zero-knock",
    code: `.num-domino-fall-0 { transform-origin: bottom left; animation: domino-fall-knock 3.4s cubic-bezier(0.2, 0.8, 0.2, 1) infinite; } .num-domino-nudge-0 { animation: domino-nudge-react 3.4s cubic-bezier(0.175, 0.885, 0.32, 1.2) infinite; }`,
    html: `<div class="num-stage num-domino-stage"><div class="num-domino-container"><span class="num-domino-prefix">$</span><span class="num-domino-lead">5</span><span class="num-domino-comma">,</span><span class="num-domino-fall-0">0</span><span class="num-domino-nudge-0">0</span><span class="num-domino-rest-0">0</span></div><div class="num-subtext-pill">Domino Zero Physics Knock</div></div>`
  },
  {
    id: 5,
    badge: "NUM #05",
    name: "Staggered Per-Digit Drop-In with Depth-of-Field (DoF) Rack Focus",
    traitId: "trait_staggered_dof_per_digit",
    concern: "SequenceComposition + MaterialTreatment",
    targetScope: "digit_nodes",
    channels: "translateY, scale, filter.blur, opacity",
    conflicts: "None",
    frameExpression: "dofRack = easeOutCubic((frame - digitIdx*10)/30)",
    footerSpec: "4 Discrete Number Nodes (2 • 0 • 2 • 6) • Independent Deep Z-Space Drop • Gaussian Rack Focus Snap",
    slug: "staggered-dof-per-digit",
    code: `.num-dof-digit { filter: blur(16px); animation: num-dof-drop 3.2s cubic-bezier(0.16, 1, 0.3, 1) infinite; }`,
    html: `<div class="num-stage num-dof-stage"><div class="num-dof-digits-row"><span class="num-dof-digit d1">2</span><span class="num-dof-digit d2">0</span><span class="num-dof-digit d3">2</span><span class="num-dof-digit d4">6</span></div><div class="num-subtext-pill">Per-Digit DoF Rack Focus</div></div>`
  },
  {
    id: 6,
    badge: "NUM #06",
    name: "Cyberpunk CRT Beam Raster Counter with Chromatic Split",
    traitId: "trait_crt_chromatic_split",
    concern: "MaterialTreatment + TemporalTrigger",
    targetScope: "raster_screen",
    channels: "textShadow, background.scanlines, opacity",
    conflicts: "None",
    frameExpression: "chromaticShift = (frame % 8 === 0) ? 4px : 1px",
    footerSpec: "Scanline Raster Overlay • Phosphor Cyan Glow • High-Speed RGB Chromatic Aberration Pulses",
    slug: "crt-chromatic-split",
    code: `.num-crt-text { text-shadow: -2px 0 #00ffff, 2px 0 #ff0055; animation: num-crt-jitter 0.15s infinite; }`,
    html: `<div class="num-stage num-crt-stage"><div class="num-crt-scanlines"></div><div class="num-crt-readout"><span class="num-crt-prefix">#</span><span class="num-crt-text">4,892</span></div><div class="num-subtext-pill">CRT Chromatic Aberration</div></div>`
  }
];

const NUMBER_CUSTOM_CSS = `
/* ========================================================================= */
/* ANIMA #05 NUMBER / STATISTIC SUITE (6 HIGH-TIER CINEMATIC MOTION PRESETS) */
/* ========================================================================= */
.num-stage {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  width: 100%; height: 100%; position: relative; overflow: hidden;
}
.num-subtext-pill {
  position: absolute; bottom: 8px; font-size: 8px; font-weight: 700;
  font-family: var(--font-mono); color: rgba(255,255,255,0.45);
  background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 4px; padding: 2px 6px; z-index: 10;
}

/* 1. Liquid Velocity Smear with Glitch Drop & Shockwave (Screenshot 01) */
.num-liquid-stage {
  background: radial-gradient(circle at 45% 45%, #0284c7 0%, #0369a1 35%, #024397 70%, #0b1528 100%);
  border-radius: 12px; width: 92%; height: 90%;
}
.num-liquid-backdrop-glow {
  position: absolute; width: 140px; height: 140px; border-radius: 50%;
  background: radial-gradient(circle, rgba(56,189,248,0.45) 0%, rgba(2,132,199,0) 70%);
  filter: blur(20px);
}
.num-liquid-container {
  position: relative; display: flex; align-items: center; justify-content: center;
}
.num-glitch-drop {
  animation: num-glitch-drop-in 3.2s cubic-bezier(0.16, 1, 0.3, 1) infinite;
}
@keyframes num-glitch-drop-in {
  0% { transform: scale(1.8) translateY(-30px); opacity: 0; filter: blur(12px) drop-shadow(4px 0 #00ffff) drop-shadow(-4px 0 #ff0055); }
  6% { transform: scale(1.2) translateY(-10px) skew(-6deg, 4deg); opacity: 0.9; filter: drop-shadow(-6px 0 #00ffff) drop-shadow(6px 0 #ff0055); }
  12% { transform: scale(1.02) translateY(2px) skew(2deg, -1deg); opacity: 1; filter: blur(0); }
  18%, 85% { transform: scale(1) translateY(0); filter: blur(0); opacity: 1; }
  100% { transform: scale(0.6); opacity: 0; filter: blur(10px); }
}
.num-liquid-smear-trail {
  font-family: var(--font-display); font-size: 105px; font-weight: 900; color: #ffffff;
  position: absolute; left: 50%; top: 50%; transform: translate(-58%, -62%) skew(-10deg, -6deg);
  filter: blur(14px) opacity(0.9); pointer-events: none;
  animation: num-smear-pulse 3.2s cubic-bezier(0.16, 1, 0.3, 1) infinite;
}
.num-liquid-core {
  font-family: var(--font-display); font-size: 105px; font-weight: 900; color: #ffffff;
  text-shadow: 0 0 25px rgba(255,255,255,0.9), 0 0 50px rgba(56,189,248,0.7);
  position: relative; z-index: 2;
  animation: num-core-breathe 3.2s cubic-bezier(0.16, 1, 0.3, 1) infinite;
}
@keyframes num-smear-pulse {
  0%, 100% { filter: blur(14px) opacity(0.85); transform: translate(-58%, -62%) skew(-10deg, -6deg); }
  50% { filter: blur(22px) opacity(0.5); transform: translate(-64%, -70%) skew(-14deg, -10deg); }
}
@keyframes num-core-breathe {
  0%, 100% { transform: scale(1); text-shadow: 0 0 25px rgba(255,255,255,0.9), 0 0 50px rgba(56,189,248,0.7); }
  50% { transform: scale(1.04); text-shadow: 0 0 35px rgba(255,255,255,1), 0 0 70px rgba(56,189,248,0.9); }
}
.num-liquid-shockwave {
  position: absolute; width: 90px; height: 90px; border-radius: 50%;
  border: 2px solid rgba(56,189,248,0.9); box-shadow: 0 0 25px rgba(56,189,248,0.8);
  animation: num-liquid-shockwave-ring 3.2s cubic-bezier(0.16, 1, 0.3, 1) infinite;
  pointer-events: none;
}
@keyframes num-liquid-shockwave-ring {
  0%, 12% { transform: scale(0.1); opacity: 0; }
  18% { opacity: 1; border-width: 3px; }
  55%, 100% { transform: scale(3.2); opacity: 0; border-width: 0.5px; }
}

/* 2. Staggered Multi-Reel Slot Tumbler (Screenshot 02) */
.num-reel-stage {
  background: radial-gradient(circle at 50% 50%, #0284c7 0%, #0369a1 40%, #024397 80%, #081225 100%);
  border-radius: 12px; width: 92%; height: 90%;
}
.num-reels-wrapper {
  display: flex; gap: 8px; align-items: center; justify-content: center; height: 90px;
  mask-image: linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%);
}
.num-reel-col {
  height: 90px; width: 44px; overflow: hidden; position: relative;
}
.num-reel-strip {
  display: flex; flex-direction: column; align-items: center;
}
.num-reel-strip span {
  height: 90px; display: flex; align-items: center; justify-content: center;
  font-family: var(--font-display); font-size: 68px; font-weight: 900; color: #ffffff;
  text-shadow: 0 0 20px rgba(255,255,255,0.8);
}
.num-reel-col.r1 .num-reel-strip { animation: reel-spin-1 3.2s cubic-bezier(0.175, 0.885, 0.32, 1.15) infinite; }
.num-reel-col.r2 .num-reel-strip { animation: reel-spin-2 3.2s cubic-bezier(0.175, 0.885, 0.32, 1.15) infinite; }
.num-reel-col.r3 .num-reel-strip { animation: reel-spin-3 3.2s cubic-bezier(0.175, 0.885, 0.32, 1.15) infinite; }

@keyframes reel-spin-1 {
  0% { transform: translateY(0); filter: blur(0); }
  15% { filter: blur(0px, 8px); }
  45%, 85% { transform: translateY(-450px); filter: blur(0); }
  100% { transform: translateY(0); filter: blur(0); }
}
@keyframes reel-spin-2 {
  0% { transform: translateY(0); filter: blur(0); }
  22% { filter: blur(0px, 8px); }
  55%, 85% { transform: translateY(-450px); filter: blur(0); }
  100% { transform: translateY(0); filter: blur(0); }
}
@keyframes reel-spin-3 {
  0% { transform: translateY(0); filter: blur(0); }
  30% { filter: blur(0px, 8px); }
  65%, 85% { transform: translateY(-450px); filter: blur(0); }
  100% { transform: translateY(0); filter: blur(0); }
}

/* 3. Slanted Zeroes & Elastic Bounce */
.num-slant-container {
  display: flex; align-items: baseline; font-family: var(--font-display);
}
.num-slant-prefix { font-size: 32px; font-weight: 800; color: #a3e635; margin-right: 2px; }
.num-slant-lead { font-size: 64px; font-weight: 900; color: #ffffff; }
.num-slant-zeros {
  font-size: 60px; font-weight: 800; color: rgba(255,255,255,0.7);
  display: inline-flex; transform-origin: bottom center;
  animation: num-slant-lock-clean 3.4s cubic-bezier(0.16, 1, 0.3, 1) infinite;
}
.z-bounce {
  display: inline-block;
  animation: num-single-zero-bounce 3.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) infinite;
}
@keyframes num-slant-lock-clean {
  0%, 25% { transform: skewX(0deg); color: #fff; }
  35%, 88% { transform: skewX(-14deg); color: rgba(255,255,255,0.7); font-style: italic; }
  100% { transform: skewX(0deg); color: #fff; }
}
@keyframes num-single-zero-bounce {
  0%, 42% { transform: translateY(0) scale(1); }
  52% { transform: translateY(-18px) scale(1.2); color: #a3e635; text-shadow: 0 0 16px #a3e635; }
  64%, 88% { transform: translateY(0) scale(1); color: inherit; text-shadow: none; }
  100% { transform: translateY(0); }
}

/* 4. Domino Falling Zero Physics Knock */
.num-domino-container {
  display: flex; align-items: baseline; font-family: var(--font-display);
}
.num-domino-prefix { font-size: 32px; font-weight: 800; color: #facc15; margin-right: 2px; }
.num-domino-lead { font-size: 64px; font-weight: 900; color: #ffffff; }
.num-domino-comma { font-size: 54px; font-weight: 800; color: rgba(255,255,255,0.6); margin-right: 2px; }
.num-domino-fall-0 {
  font-size: 60px; font-weight: 800; color: #38bdf8; display: inline-block;
  transform-origin: bottom left;
  animation: domino-fall-knock 3.4s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
}
.num-domino-nudge-0 {
  font-size: 60px; font-weight: 800; color: #ffffff; display: inline-block;
  transform-origin: bottom center;
  animation: domino-nudge-react 3.4s cubic-bezier(0.175, 0.885, 0.32, 1.2) infinite;
}
.num-domino-rest-0 {
  font-size: 60px; font-weight: 800; color: rgba(255,255,255,0.7); display: inline-block;
}
@keyframes domino-fall-knock {
  0%, 30% { transform: rotate(0deg) translateX(0); }
  45% { transform: rotate(-26deg) translateX(-4px); color: #38bdf8; text-shadow: 0 0 16px #38bdf8; }
  60%, 88% { transform: rotate(0deg) translateX(0); color: #fff; text-shadow: none; }
  100% { transform: rotate(0deg); }
}
@keyframes domino-nudge-react {
  0%, 43% { transform: translateX(0) rotate(0deg); }
  50% { transform: translateX(6px) rotate(8deg); }
  62%, 88% { transform: translateX(0) rotate(0deg); }
  100% { transform: translateX(0); }
}

/* 5. Per-Digit DoF Rack Focus */
.num-dof-digits-row { display: flex; gap: 6px; }
.num-dof-digit {
  font-family: var(--font-display); font-size: 56px; font-weight: 900; color: #fff;
  display: inline-block;
}
.num-dof-digit.d1 { animation: num-dof-rack-1 3.2s ease-out infinite; }
.num-dof-digit.d2 { animation: num-dof-rack-2 3.2s ease-out infinite; }
.num-dof-digit.d3 { animation: num-dof-rack-3 3.2s ease-out infinite; }
.num-dof-digit.d4 { animation: num-dof-rack-4 3.2s ease-out infinite; }
@keyframes num-dof-rack-1 {
  0% { transform: scale(2) translateY(-20px); filter: blur(16px); opacity: 0; }
  18%, 85% { transform: scale(1) translateY(0); filter: blur(0); opacity: 1; }
  100% { opacity: 0; }
}
@keyframes num-dof-rack-2 {
  0%, 12% { transform: scale(2) translateY(-20px); filter: blur(16px); opacity: 0; }
  30%, 85% { transform: scale(1) translateY(0); filter: blur(0); opacity: 1; }
  100% { opacity: 0; }
}
@keyframes num-dof-rack-3 {
  0%, 24% { transform: scale(2) translateY(-20px); filter: blur(16px); opacity: 0; }
  42%, 85% { transform: scale(1) translateY(0); filter: blur(0); opacity: 1; }
  100% { opacity: 0; }
}
@keyframes num-dof-rack-4 {
  0%, 36% { transform: scale(2) translateY(-20px); filter: blur(16px); opacity: 0; }
  54%, 85% { transform: scale(1) translateY(0); filter: blur(0); opacity: 1; }
  100% { opacity: 0; }
}

/* 6. CRT Chromatic Aberration */
.num-crt-stage {
  background: #050505; border: 1px solid rgba(0,255,255,0.2); border-radius: 12px;
  position: relative; width: 92%; height: 90%;
}
.num-crt-scanlines {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  background: repeating-linear-gradient(0deg, rgba(0,0,0,0.5) 0px, rgba(0,0,0,0.5) 1px, transparent 1px, transparent 3px);
  pointer-events: none; z-index: 5;
}
.num-crt-readout {
  display: flex; align-items: baseline; font-family: var(--font-mono);
}
.num-crt-prefix { font-size: 24px; color: #00ffff; margin-right: 4px; }
.num-crt-text {
  font-size: 54px; font-weight: 900; color: #ffffff;
  text-shadow: -2px 0 #00ffff, 2px 0 #ff0055;
  animation: num-crt-jitter 0.15s infinite;
}
@keyframes num-crt-jitter {
  0% { text-shadow: -2px 0 #00ffff, 2px 0 #ff0055; transform: translate(0, 0); }
  50% { text-shadow: -3px 0 #00ffff, 3px 0 #ff0055; transform: translate(0.5px, -0.5px); }
  100% { text-shadow: -2px 0 #00ffff, 2px 0 #ff0055; transform: translate(0, 0); }
}
`;

// 7. PERCENTAGE 5 ADVANCED PRESETS (ANIMA #06 - INCLUDING SCREENSHOTS 01 & 02)
const PERCENTAGE_5_PRESETS: ArchetypeVariant[] = [
  {
    id: 1,
    badge: "PCT #01",
    name: "Radial Multi-Tick Dynamic Dial Percentage Counter",
    traitId: "trait_radial_tick_dial_percentage",
    concern: "TemporalTrigger + Structures",
    targetScope: "radial_dial",
    channels: "stroke, opacity, text.percentage, scale",
    conflicts: "None",
    frameExpression: "activeTicks = floor((frame % 90) / 90 * 48) | pctValue = floor((activeTicks/48)*100) + '%'",
    footerSpec: "48 Radial Tick Markers • Coral/Orange Gradient Active Sweep (50% Dynamic Fill) • Bold Center Readout (50%) • Clean Metric Framing",
    slug: "radial-tick-dial-percentage",
    code: `.radial-tick-dial-wrap { position: relative; width: 170px; height: 170px; } .radial-tick-pct { font-size: 38px; font-weight: 900; font-family: var(--font-display); }`,
    html: `<div class="percentage-stage radial-tick-dial-stage"><div class="radial-tick-dial-wrap"><svg class="radial-tick-svg" viewBox="0 0 200 200"><defs><linearGradient id="tickOrangeGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f97316"/><stop offset="100%" stop-color="#ef4444"/></linearGradient></defs><g class="radial-ticks-group" stroke-linecap="round">${generateRadialTicksSvg(50, 48)}</g></svg><div class="radial-tick-center"><span class="radial-tick-pct">50%</span></div></div></div>`
  },
  {
    id: 2,
    badge: "PCT #02",
    name: "Polar Arc Neon Progress Gauge with Specular Apex Pip",
    traitId: "trait_polar_arc_neon_gauge",
    concern: "MotionPhysics",
    targetScope: "arc_stroke",
    channels: "strokeDashoffset, filter.dropShadow, text.pct",
    conflicts: "None",
    frameExpression: "arcFill = (frame % 75) / 75 * 270deg",
    footerSpec: "270° Polar Arc Vector Ring • Neon Cyan Gradient Sweep • Specular Leading Apex Pip • Clean +68% Readout",
    slug: "polar-arc-neon-gauge",
    code: `.polar-arc-stroke { stroke-dasharray: 400; stroke-dashoffset: 120; filter: drop-shadow(0 0 12px #06b6d4); }`,
    html: `<div class="percentage-stage"><div class="polar-gauge-wrap"><svg class="polar-gauge-svg" viewBox="0 0 160 160"><circle cx="80" cy="80" r="60" stroke="rgba(255,255,255,0.1)" stroke-width="8" fill="none"/><circle class="polar-arc-stroke" cx="80" cy="80" r="60" stroke="url(#cyanGaugeGrad)" stroke-width="8" fill="none" stroke-linecap="round"/><defs><linearGradient id="cyanGaugeGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#06b6d4"/><stop offset="100%" stop-color="#3b82f6"/></linearGradient></defs></svg><div class="polar-gauge-center"><span class="gauge-pct-val">+68%</span></div></div></div>`
  },
  {
    id: 3,
    badge: "PCT #03",
    name: "Kinetic Punch-In Percentage with Shockwave Ring (Tandem Number Physics)",
    traitId: "trait_kinetic_pct_punch_halo",
    concern: "TypographyMaster + EnclosureAndAccents",
    targetScope: "giant_pct",
    channels: "transform.scale, filter.blur, opacity, text.value",
    conflicts: "None",
    frameExpression: "pctScale = 1.0 + sin(frame / 12) * 0.15",
    footerSpec: "Giant Kinetic % Punch • Tandem Rapid Count-Up Physics • Expanding Neon Shockwave Pulse Ring",
    slug: "kinetic-pct-punch-halo",
    code: `.giant-punch-pct { font-size: 64px; font-weight: 900; background: linear-gradient(135deg, #fff, #38bdf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }`,
    html: `<div class="percentage-stage"><div class="kinetic-punch-wrap"><div class="punch-halo-ring"></div><div class="punch-halo-ring r2"></div><span class="giant-punch-pct">94%</span></div></div>`
  },
  {
    id: 4,
    badge: "PCT #04",
    name: "Luminescent Sphere Orb Gauge with Specular Ray Needle (Ref Screenshot 01)",
    traitId: "trait_luminescent_sphere_orb_gauge",
    concern: "MaterialTreatment + MotionPhysics",
    targetScope: "sphere_orb",
    channels: "transform.rotate, filter.blur, background, textShadow",
    conflicts: "None",
    frameExpression: "needleSweep = sin(frame/25)*30deg | fluidPulse = 1.0 + cos(frame/20)*0.1",
    footerSpec: "3D Luminescent Sphere Orb • Iridescent Violet Fluid Membrane • Perimeter Ticks • Rotating Specular Ray Needle (87%)",
    slug: "luminescent-sphere-orb-gauge",
    code: `.pct-orb-fluid-fold { animation: orb-fluid-fold-spin 6s ease-in-out infinite alternate; } .pct-orb-specular-ray { animation: orb-ray-sweep 4s ease-in-out infinite alternate; }`,
    html: `<div class="percentage-stage pct-orb-stage"><div class="pct-orb-container"><div class="pct-orb-sphere"><div class="pct-orb-fluid-fold"></div><div class="pct-orb-specular-ray"></div><div class="pct-orb-ticks-rim"><span class="orb-tick t1"></span><span class="orb-tick t2"></span><span class="orb-tick t3"></span><span class="orb-tick t4"></span></div><div class="pct-orb-inner-face"><span class="pct-orb-value">87</span><span class="pct-orb-symbol">%</span></div></div></div></div>`
  },
  {
    id: 5,
    badge: "PCT #05",
    name: "Celestial Horizon Glow & Hairline Eclipse Percentage (Ref Screenshot 02)",
    traitId: "trait_celestial_horizon_eclipse_pct",
    concern: "MaterialTreatment + Transformations",
    targetScope: "horizon_metric",
    channels: "transform.translateY, opacity, filter.blur, box-shadow",
    conflicts: "None",
    frameExpression: "horizonRise = easeOutCubic(frame / 45) | coronaPulse = 0.8 + sin(frame / 20) * 0.2",
    footerSpec: "Electric-Cyan Atmospheric Horizon Limb • Volumetric Corona Glow • Ultra-Fine Hairline Numerals (300%) Rising from Deep Space",
    slug: "celestial-horizon-eclipse-pct",
    code: `.pct-celestial-num-wrap { animation: celestial-num-rise 3.8s cubic-bezier(0.16, 1, 0.3, 1) infinite alternate; } .pct-celestial-horizon-arc { box-shadow: 0 -8px 30px rgba(56,189,248,0.9), 0 -2px 10px #ffffff; }`,
    html: `<div class="percentage-stage pct-celestial-stage"><div class="pct-celestial-container"><div class="pct-celestial-num-wrap"><span class="pct-celestial-num">300</span><span class="pct-celestial-sym">%</span></div><div class="pct-celestial-horizon-arc"></div><div class="pct-celestial-corona-glow"></div></div></div>`
  }
];

const PERCENTAGE_CUSTOM_CSS = `
/* ========================================================================= */
/* ANIMA #06 PERCENTAGE SUITE (5 HIGH-TIER CINEMATIC PRESETS)                */
/* ========================================================================= */
.percentage-stage {
  display: flex; align-items: center; justify-content: center;
  width: 100%; height: 100%; position: relative; overflow: hidden;
}

/* 1. Radial Multi-Tick Dial Percentage Counter (Ref Screenshot 01) */
.radial-tick-dial-wrap {
  position: relative; width: 180px; height: 180px;
  display: flex; align-items: center; justify-content: center;
}
.radial-tick-svg {
  width: 100%; height: 100%; position: absolute; top: 0; left: 0;
  animation: tick-dial-spin 20s linear infinite;
}
.radial-tick-center {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  position: relative; z-index: 2;
}
.radial-tick-pct {
  font-size: 38px; font-weight: 900; color: #fff; font-family: var(--font-display, sans-serif);
  line-height: 1; letter-spacing: -1px; text-shadow: 0 0 20px rgba(249,115,22,0.6);
}
@keyframes tick-dial-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 2. Polar Arc Neon Gauge */
.polar-gauge-wrap {
  position: relative; width: 150px; height: 150px;
  display: flex; align-items: center; justify-content: center;
}
.polar-gauge-svg { width: 100%; height: 100%; position: absolute; transform: rotate(-135deg); }
.polar-arc-stroke {
  stroke-dasharray: 380; stroke-dashoffset: 120;
  animation: polar-arc-sweep 2.5s ease-in-out infinite alternate;
}
.polar-gauge-center {
  display: flex; flex-direction: column; align-items: center; position: relative; z-index: 2;
}
.gauge-pct-val { font-size: 36px; font-weight: 900; color: #38bdf8; font-family: var(--font-display); text-shadow: 0 0 20px rgba(56,189,248,0.7); }
@keyframes polar-arc-sweep {
  0% { stroke-dashoffset: 280; }
  100% { stroke-dashoffset: 80; }
}

/* 3. Kinetic Subpixel Number Punch */
.kinetic-punch-wrap {
  position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.punch-halo-ring {
  position: absolute; width: 120px; height: 120px; border-radius: 50%;
  border: 1.5px solid rgba(56,189,248,0.3); animation: halo-expand 2s infinite ease-out;
}
.punch-halo-ring.r2 { animation-delay: 0.8s; }
.giant-punch-pct {
  font-size: 64px; font-weight: 900; font-family: var(--font-display); line-height: 1;
  background: linear-gradient(135deg, #ffffff 0%, #38bdf8 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  animation: punch-scale 2s ease-in-out infinite alternate;
}
@keyframes punch-scale {
  0% { transform: scale(0.95); filter: drop-shadow(0 0 10px rgba(56,189,248,0.4)); }
  100% { transform: scale(1.08); filter: drop-shadow(0 0 25px rgba(56,189,248,0.9)); }
}
@keyframes halo-expand {
  0% { transform: scale(0.7); opacity: 0.8; }
  100% { transform: scale(1.6); opacity: 0; }
}

/* 4. Luminescent Sphere Orb Gauge (Ref Screenshot 01) */
.pct-orb-stage {
  background: #060913; border-radius: 12px; position: relative; width: 92%; height: 90%;
}
.pct-orb-container {
  position: relative; width: 140px; height: 140px; display: flex; align-items: center; justify-content: center;
}
.pct-orb-sphere {
  width: 130px; height: 130px; border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #1e1b4b 0%, #0f172a 60%, #030712 100%);
  border: 1px solid rgba(255,255,255,0.15);
  box-shadow: 0 10px 30px rgba(0,0,0,0.8), inset 0 2px 15px rgba(168,85,247,0.3);
  position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden;
}
.pct-orb-fluid-fold {
  position: absolute; width: 120px; height: 120px; border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%;
  background: radial-gradient(circle at 30% 30%, rgba(192,132,252,0.8) 0%, rgba(99,102,241,0.5) 45%, transparent 70%);
  filter: blur(10px);
  animation: orb-fluid-fold-spin 6s ease-in-out infinite alternate;
}
.pct-orb-specular-ray {
  position: absolute; width: 60px; height: 2px;
  background: linear-gradient(90deg, rgba(255,255,255,1), rgba(192,132,252,0.8) 40%, transparent 100%);
  top: 45px; left: 10px; transform-origin: 55px 20px;
  box-shadow: 0 0 10px rgba(255,255,255,0.9), 0 0 20px rgba(168,85,247,0.8);
  animation: orb-ray-sweep 4s ease-in-out infinite alternate;
}
.pct-orb-ticks-rim .orb-tick {
  position: absolute; width: 6px; height: 1.5px; background: rgba(255,255,255,0.6); border-radius: 1px;
}
.orb-tick.t1 { top: 25px; left: 18px; transform: rotate(45deg); }
.orb-tick.t2 { top: 48px; left: 12px; transform: rotate(15deg); }
.orb-tick.t3 { top: 72px; left: 12px; transform: rotate(-15deg); }
.orb-tick.t4 { top: 96px; left: 18px; transform: rotate(-45deg); }
.pct-orb-inner-face {
  position: relative; z-index: 5; width: 85px; height: 85px; border-radius: 50%;
  background: radial-gradient(circle at 40% 40%, #030712 0%, #0b0f19 100%);
  border: 1px solid rgba(255,255,255,0.18);
  display: flex; align-items: baseline; justify-content: center;
  box-shadow: 0 4px 20px rgba(0,0,0,0.9);
}
.pct-orb-value {
  font-family: var(--font-display); font-size: 38px; font-weight: 300; color: #ffffff;
  letter-spacing: -1px; text-shadow: 0 0 15px rgba(255,255,255,0.4);
}
.pct-orb-symbol {
  font-family: var(--font-display); font-size: 18px; font-weight: 600; color: rgba(255,255,255,0.6);
  margin-left: 1px;
}
@keyframes orb-fluid-fold-spin {
  0% { transform: rotate(0deg) scale(0.95); }
  100% { transform: rotate(45deg) scale(1.1); }
}
@keyframes orb-ray-sweep {
  0% { transform: rotate(-15deg); }
  100% { transform: rotate(35deg); }
}

/* 5. Celestial Horizon Glow & Hairline Eclipse Percentage (Ref Screenshot 02) */
.pct-celestial-stage {
  background: #020617; border-radius: 12px; position: relative; width: 92%; height: 90%;
  display: flex; align-items: flex-end; justify-content: center; overflow: hidden;
}
.pct-celestial-container {
  position: relative; width: 100%; height: 100%; display: flex; flex-direction: column;
  align-items: center; justify-content: flex-end;
}
.pct-celestial-num-wrap {
  position: absolute; bottom: 32px; display: flex; align-items: baseline; justify-content: center;
  z-index: 1;
  animation: celestial-num-rise 3.8s cubic-bezier(0.16, 1, 0.3, 1) infinite alternate;
}
.pct-celestial-num {
  font-family: var(--font-display); font-size: 82px; font-weight: 200; color: #ffffff;
  letter-spacing: -2px; line-height: 0.9;
  text-shadow: 0 0 20px rgba(56,189,248,0.4);
}
.pct-celestial-sym {
  font-family: var(--font-display); font-size: 40px; font-weight: 200; color: rgba(255,255,255,0.85);
  margin-left: 2px;
}
.pct-celestial-horizon-arc {
  position: absolute; bottom: -120px; width: 340px; height: 180px; border-radius: 50%;
  background: #030712; border-top: 2.5px solid #38bdf8;
  box-shadow: 0 -8px 30px rgba(56,189,248,0.9), 0 -2px 10px #ffffff;
  z-index: 3;
}
.pct-celestial-corona-glow {
  position: absolute; bottom: -30px; width: 260px; height: 90px; border-radius: 50%;
  background: radial-gradient(ellipse at center, rgba(56,189,248,0.6) 0%, rgba(2,132,199,0.3) 45%, transparent 75%);
  filter: blur(14px); z-index: 2; pointer-events: none;
  animation: celestial-corona-pulse 3.8s ease-in-out infinite alternate;
}
@keyframes celestial-num-rise {
  0% { transform: translateY(18px); opacity: 0.7; filter: blur(2px); }
  100% { transform: translateY(-4px); opacity: 1; filter: blur(0px); text-shadow: 0 0 25px rgba(56,189,248,0.7); }
}
@keyframes celestial-corona-pulse {
  0% { opacity: 0.6; transform: scaleY(0.85); }
  100% { opacity: 1; transform: scaleY(1.15); }
}
`;

// 8. COMPARISON 2 HIGH-TIER CINEMATIC PRESETS (ANIMA #07)
const COMPARISON_2_PRESETS: ArchetypeVariant[] = [
  {
    id: 1,
    badge: "COMP #01",
    name: "Stepped Notch Laser Split Screen (Ref Screenshot 04)",
    traitId: "trait_stepped_notch_split_screen",
    concern: "SpatialArrangement + MaterialTreatment",
    targetScope: "split_viewport",
    channels: "clipPath, filter.glow, opacity, transform.scale",
    conflicts: "None",
    frameExpression: "steppedNotch = 50% + sin(frame / 30) * 2% | leftGlow = #ef4444 | rightGlow = #0284c7",
    footerSpec: "Non-Straight Geometric Stepped Notch Seam • Crimson Low-Efficiency Atmosphere (100 HOOK) vs Electric-Cyan Alpha Stage (1M HOOK) • Tinkerable Animation Knobs",
    slug: "stepped-notch-split-screen",
    code: `.comp-stepped-split { clip-path: polygon(0 0, 48% 0, 52% 40%, 48% 60%, 52% 100%, 0 100%); }`,
    html: `<div class="comp-stage comp-stepped-stage"><div class="comp-stepped-left"><div class="comp-notch-badge b-left"><span class="notch-icon">👁️</span><span class="notch-val">100</span><span class="notch-sub">HOOK</span></div></div><div class="comp-stepped-divider-line"><svg class="stepped-seam-svg" viewBox="0 0 20 200" preserveAspectRatio="none"><path d="M10 0 L10 75 L18 85 L2 115 L10 125 L10 200" stroke="#ffffff" stroke-width="2.5" fill="none" filter="drop-shadow(0 0 8px #38bdf8)"/></svg></div><div class="comp-stepped-right"><div class="comp-notch-badge b-right"><span class="notch-icon">👁️</span><span class="notch-val">1M</span><span class="notch-sub">HOOK</span></div></div></div>`
  },
  {
    id: 2,
    badge: "COMP #02",
    name: "Dual Product Side-by-Side Studio Stage (Ref Screenshot 02)",
    traitId: "trait_dual_product_studio_stage",
    concern: "MaterialTreatment + Transformations",
    targetScope: "product_podiums",
    channels: "translateY, filter.dropShadow, opacity, transform.rotate",
    conflicts: "None",
    frameExpression: "podiumFloat = sin(frame / 20) * 6px",
    footerSpec: "Dual Independent Studio Lighting • Left: Warm Ivory Minimalist Podium (Standard) • Right: Dark Obsidian Titanium Stage (Pro Engine) • Tinkerable Animation Knobs",
    slug: "dual-product-studio-stage",
    code: `.comp-podium.p1 { background: radial-gradient(circle, #f5f5f4 0%, #d6d3d1 100%); } .comp-podium.p2 { background: radial-gradient(circle, #44403c 0%, #1c1917 100%); }`,
    html: `<div class="comp-stage comp-dual-product-stage"><div class="comp-product-col left-studio"><div class="product-asset-bottle b-white"><div class="bottle-cap"></div><div class="bottle-body"></div></div><div class="product-label-serif">HydroPro Stainless</div></div><div class="comp-studio-seam"></div><div class="comp-product-col right-studio"><div class="product-asset-bottle b-titanium"><div class="tumbler-cap"></div><div class="tumbler-body"><span class="tumbler-decal">HYDRO</span></div></div><div class="product-label-tech"><span>HydroPro</span><strong>ACTIVITY</strong></div></div></div>`
  }
];

const COMPARISON_CUSTOM_CSS = `
/* ========================================================================= */
/* ANIMA #07 COMPARISON SUITE (2 HIGH-TIER CINEMATIC MOTION PRESETS)         */
/* ========================================================================= */
.comp-stage {
  display: flex; align-items: center; justify-content: center;
  width: 100%; height: 100%; position: relative; overflow: hidden;
}

/* 1. Stepped Notch Laser Split (Screenshot 04) */
.comp-stepped-stage {
  display: flex; width: 100%; height: 100%; position: relative;
}
.comp-stepped-left {
  flex: 1; height: 100%;
  background: radial-gradient(circle at 35% 50%, #7f1d1d 0%, #450a0a 60%, #0c0404 100%);
  display: flex; align-items: center; justify-content: center; position: relative;
}
.comp-stepped-right {
  flex: 1; height: 100%;
  background: radial-gradient(circle at 65% 50%, #0369a1 0%, #082f49 60%, #020617 100%);
  display: flex; align-items: center; justify-content: center; position: relative;
}
.comp-stepped-divider-line {
  position: absolute; top: 0; left: calc(50% - 10px); width: 20px; height: 100%;
  z-index: 10; pointer-events: none;
}
.stepped-seam-svg { width: 100%; height: 100%; }
.comp-notch-badge {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 10px 16px; border-radius: 12px; font-family: var(--font-display);
}
.comp-notch-badge.b-left {
  animation: notch-pulse-left 3.2s ease-in-out infinite alternate;
}
.comp-notch-badge.b-right {
  animation: notch-pulse-right 3.2s ease-in-out infinite alternate;
}
.b-left .notch-icon { font-size: 22px; filter: drop-shadow(0 0 10px #ef4444); }
.b-left .notch-val { font-size: 32px; font-weight: 900; color: #f87171; text-shadow: 0 0 15px rgba(239,68,68,0.8); line-height: 1; }
.b-left .notch-sub { font-size: 14px; font-weight: 900; color: #ffffff; letter-spacing: 1px; }

.b-right .notch-icon { font-size: 22px; filter: drop-shadow(0 0 10px #38bdf8); }
.b-right .notch-val { font-size: 32px; font-weight: 900; color: #38bdf8; text-shadow: 0 0 15px rgba(56,189,248,0.9); line-height: 1; }
.b-right .notch-sub { font-size: 14px; font-weight: 900; color: #ffffff; letter-spacing: 1px; }

@keyframes notch-pulse-left {
  0% { transform: scale(0.95); opacity: 0.85; }
  100% { transform: scale(1.05); opacity: 1; filter: drop-shadow(0 0 20px rgba(239,68,68,0.6)); }
}
@keyframes notch-pulse-right {
  0% { transform: scale(1.05); opacity: 1; filter: drop-shadow(0 0 20px rgba(56,189,248,0.7)); }
  100% { transform: scale(0.95); opacity: 0.85; }
}

/* 2. Dual Product Side-by-Side (Screenshot 02) */
.comp-dual-product-stage {
  display: flex; width: 100%; height: 100%;
}
.comp-product-col {
  flex: 1; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 10px; gap: 8px;
}
.left-studio { background: #e7e5e4; }
.right-studio { background: #1c1917; }
.comp-studio-seam { width: 1.5px; height: 100%; background: rgba(0,0,0,0.15); }
.product-asset-bottle {
  display: flex; flex-direction: column; align-items: center;
  animation: product-float 3.5s ease-in-out infinite alternate;
}
.b-white .bottle-cap { width: 18px; height: 8px; background: #a8a29e; border-radius: 3px 3px 0 0; }
.b-white .bottle-body {
  width: 34px; height: 74px; background: #fafaf9; border-radius: 12px 12px 10px 10px;
  box-shadow: inset -4px 0 10px rgba(0,0,0,0.15), 0 10px 20px rgba(0,0,0,0.2);
}
.product-label-serif { font-family: serif; font-size: 10px; font-weight: 700; color: #1c1917; }

.b-titanium .tumbler-cap { width: 28px; height: 7px; background: #09090b; border-radius: 2px; }
.b-titanium .tumbler-body {
  width: 32px; height: 75px; background: linear-gradient(135deg, #71717a 0%, #27272a 100%);
  border-radius: 4px 4px 8px 8px; border: 1px solid rgba(255,255,255,0.2);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 10px 25px rgba(0,0,0,0.7), inset 0 0 10px rgba(255,255,255,0.2);
}
.tumbler-decal { font-size: 8px; font-family: monospace; font-weight: 900; color: #ffffff; transform: rotate(-90deg); letter-spacing: 2px; }
.product-label-tech {
  display: flex; flex-direction: column; align-items: center; line-height: 1.1;
  font-family: var(--font-display);
}
.product-label-tech span { font-size: 9px; color: #a1a1aa; }
.product-label-tech strong { font-size: 11px; color: #ffffff; letter-spacing: 1.5px; }

@keyframes product-float {
  0% { transform: translateY(0); }
  100% { transform: translateY(-6px); }
}
`;

// 9. PERSON / CHARACTER 6 HIGH-TIER CINEMATIC PRESETS (ANIMA #15 - IMAN GADZHI DUAL-AXIS SUITE)
const PERSON_6_PRESETS: ArchetypeVariant[] = [
  {
    id: 1,
    badge: "PERSON #01",
    name: "Corporate Masked Executive on Rounded Blue Card (Ref Screenshot 01)",
    traitId: "trait_corporate_masked_suit",
    concern: "MaterialTreatment + LayoutComposition",
    targetScope: "character_avatar",
    channels: "translateY, scale, opacity, filter.dropShadow, filter.blur",
    conflicts: "None",
    frameExpression: "cardAxis = easeOutCubic(frame / 20) | bodySlideUp = easeOutBack(frame / 35)",
    footerSpec: "Dual-Axis Entry • Squircle Card (-30px Drop) • Suited Body (+160px Slide-Up) • Specular Face Disc Pop",
    slug: "corporate-masked-suit",
    code: `.iman-card-axis { animation: iman-card-axis 5s cubic-bezier(0.16, 1, 0.3, 1) infinite; } .iman-body-slideup { animation: iman-body-slideup 5s cubic-bezier(0.16, 1, 0.3, 1) infinite; }`,
    html: `<div class="person-stage person-suit-stage"><div class="gaussian-body-flare flare-blue"></div><div class="person-suit-card iman-card-axis"><img class="person-photo-mesh iman-body-slideup" src="/assets/person_masked_suit.jpg" alt="Executive Suited Persona" /><div class="person-face-disc-layer iman-face-disc-axis"><div class="person-face-disc-specular"></div></div></div></div>`
  },
  {
    id: 2,
    badge: "PERSON #02",
    name: "Die-Cut Sticker Head Cutout with Parallax Bob (Ref Screenshot 02)",
    traitId: "trait_die_cut_sticker_head",
    concern: "MotionPhysics + MaterialTreatment",
    targetScope: "sticker_avatar",
    channels: "rotate, translateY, filter.dropShadow, scale",
    conflicts: "None",
    frameExpression: "stickerSlideUp = easeOutBack(frame / 30) | tilt = sin(frame / 35) * 4deg",
    footerSpec: "Dual-Axis Sticker Entry • +160px Deep Slide-Up • 3.5px Die-Cut Contour • Spring Peel Parallax",
    slug: "die-cut-sticker-head",
    code: `.iman-sticker-axis { animation: iman-sticker-axis 5s cubic-bezier(0.16, 1, 0.3, 1) infinite; }`,
    html: `<div class="person-stage person-sticker-stage"><div class="gaussian-body-flare flare-green"></div><div class="person-sticker-wrap iman-sticker-axis"><img class="person-sticker-img" src="/assets/person_sticker_head.jpg" alt="Die-Cut Sticker Head" /></div></div>`
  },
  {
    id: 3,
    badge: "PERSON #03",
    name: "Graphic Noir Angular Vector Portrait (Ref Screenshot 03 - Red)",
    traitId: "trait_graphic_noir_portrait",
    concern: "MaterialTreatment + CompositionGeometry",
    targetScope: "noir_character",
    channels: "clipPath, opacity, filter.glow, translateY, scale",
    conflicts: "None",
    frameExpression: "cardDrop = -30px -> 0px | bodySlide = +160px -> 0px",
    footerSpec: "Dual-Axis Noir Reveal • Crimson Card (-30px Drop) • Noir Silhouette (+160px Slide-Up) • Chiaroscuro Pulse",
    slug: "graphic-noir-vector-portrait",
    code: `.person-noir-card { animation: iman-card-axis 5s cubic-bezier(0.16, 1, 0.3, 1) infinite; }`,
    html: `<div class="person-stage person-noir-stage"><div class="gaussian-body-flare flare-red"></div><div class="person-noir-card iman-card-axis"><img class="person-art-mesh iman-body-slideup" src="/assets/person_noir_portrait.jpg" alt="Graphic Noir Character" /></div></div>`
  },
  {
    id: 4,
    badge: "PERSON #04",
    name: "3D Stylized Studio Persona with Headphones (Ref Screenshot 03 - Blue)",
    traitId: "trait_stylized_3d_headphones",
    concern: "MotionPhysics + MaterialTreatment",
    targetScope: "3d_character",
    channels: "translateY, rotateZ, scale, filter.dropShadow",
    conflicts: "None",
    frameExpression: "cardDrop = -30px -> 0px | bodySlide = +160px -> 0px | nod = sin(frame / 14) * 4px",
    footerSpec: "Dual-Axis 3D Entrance • Cobalt Card (-30px Drop) • 3D Persona (+160px Slide-Up) • Rhythmic Head-Nod",
    slug: "stylized-3d-headphones",
    code: `.person-3d-card { animation: iman-card-axis 5s cubic-bezier(0.16, 1, 0.3, 1) infinite; }`,
    html: `<div class="person-stage person-3d-stage"><div class="gaussian-body-flare flare-cyan"></div><div class="person-3d-card iman-card-axis"><img class="person-art-mesh iman-body-slideup anim-nod" src="/assets/person_beanie_headphones.jpg" alt="3D Persona with Headphones" /></div></div>`
  },
  {
    id: 5,
    badge: "PERSON #05",
    name: "Cel-Shaded Line-Art Anime Persona (Ref Screenshot 03 - Purple)",
    traitId: "trait_cel_shaded_anime_persona",
    concern: "MaterialTreatment + MotionPhysics",
    targetScope: "anime_character",
    channels: "strokeDashoffset, opacity, translateY, filter.glow",
    conflicts: "None",
    frameExpression: "cardDrop = -30px -> 0px | bodySlide = +160px -> 0px | float = sin(frame / 20) * 3px",
    footerSpec: "Dual-Axis Anime Slide • Lavender Card (-30px Drop) • Anime Character (+160px Slide-Up) • Vector Float",
    slug: "cel-shaded-anime-persona",
    code: `.person-anime-card { animation: iman-card-axis 5s cubic-bezier(0.16, 1, 0.3, 1) infinite; }`,
    html: `<div class="person-stage person-anime-stage"><div class="gaussian-body-flare flare-purple"></div><div class="person-anime-card iman-card-axis"><img class="person-art-mesh iman-body-slideup anim-float" src="/assets/person_anime_glasses.jpg" alt="Anime Line-Art Persona" /></div></div>`
  },
  {
    id: 6,
    badge: "PERSON #06",
    name: "Tactile 3D Felt & Knit Character (Ref Screenshot 03 - Cyan)",
    traitId: "trait_tactile_felt_smartphone",
    concern: "MaterialTreatment + MotionPhysics",
    targetScope: "clay_character",
    channels: "translateY, rotate, filter.dropShadow, scale",
    conflicts: "None",
    frameExpression: "cardDrop = -30px -> 0px | bodySlide = +160px -> 0px | screenBeam = 0.8 + sin(frame / 12) * 0.2",
    footerSpec: "Dual-Axis Felt Entrance • Sky-Blue Card (-30px Drop) • Felt Character (+160px Slide-Up) • Screen Beam Glow",
    slug: "tactile-felt-smartphone-character",
    code: `.person-felt-card { animation: iman-card-axis 5s cubic-bezier(0.16, 1, 0.3, 1) infinite; }`,
    html: `<div class="person-stage person-felt-stage"><div class="gaussian-body-flare flare-sky"></div><div class="person-felt-card iman-card-axis"><img class="person-art-mesh iman-body-slideup anim-bounce" src="/assets/person_curly_sweater.jpg" alt="Tactile 3D Felt Persona" /><div class="phone-screen-beam"></div></div></div>`
  }
];

const PERSON_CUSTOM_CSS = `
/* ========================================================================= */
/* ANIMA #15 PERSON / CHARACTER SUITE (IMAN GADZHI DUAL-AXIS MOTION SUITE)   */
/* ========================================================================= */
.person-stage {
  width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
  position: relative; overflow: hidden; background: #070913; border-radius: 12px;
}

/* Gaussian Body Flare Atmospheric Layer */
.gaussian-body-flare {
  position: absolute; width: 140px; height: 170px; border-radius: 50%;
  filter: blur(36px); opacity: 0.7; pointer-events: none; z-index: 1;
  animation: gaussian-flare-pulse 5s ease-in-out infinite alternate;
}
.flare-blue { background: radial-gradient(circle, #0284c7 0%, #0369a1 70%, transparent 100%); }
.flare-green { background: radial-gradient(circle, #10b981 0%, #047857 70%, transparent 100%); }
.flare-red { background: radial-gradient(circle, #ef4444 0%, #b91c1c 70%, transparent 100%); }
.flare-cyan { background: radial-gradient(circle, #38bdf8 0%, #0284c7 70%, transparent 100%); }
.flare-purple { background: radial-gradient(circle, #c084fc 0%, #7c3aed 70%, transparent 100%); }
.flare-sky { background: radial-gradient(circle, #38bdf8 0%, #0369a1 70%, transparent 100%); }

@keyframes gaussian-flare-pulse {
  0%, 8% { transform: scale(0.6); opacity: 0; }
  25%, 82% { transform: scale(1.15); opacity: 0.85; }
  94%, 100% { transform: scale(0.7); opacity: 0; }
}

/* ========================================================================= */
/* IMAN GADZHI DUAL-AXIS KEYFRAME DEFINITIONS                                */
/* ========================================================================= */

/* Axis 1: Squircle Card Drop Entrance (Starts from Y: -30px) */
@keyframes iman-card-axis {
  0%, 6% {
    opacity: 0;
    transform: translateY(-30px) scale(0.86);
    filter: blur(14px);
  }
  24% {
    opacity: 1;
    transform: translateY(2px) scale(1.02);
    filter: blur(0px);
  }
  30%, 82% {
    opacity: 1;
    transform: translateY(0px) scale(1);
    filter: blur(0px);
  }
  92%, 100% {
    opacity: 0;
    transform: translateY(-20px) scale(0.9);
    filter: blur(10px);
  }
}

/* Axis 2: Character Body Slide-Up (Starts from bottom Y: +160px completely out of view) */
@keyframes iman-body-slideup {
  0%, 10% {
    opacity: 0;
    transform: translateY(160px) scale(0.92);
    filter: blur(16px);
  }
  32% {
    opacity: 1;
    transform: translateY(-4px) scale(1.02);
    filter: blur(0px);
  }
  40%, 82% {
    opacity: 1;
    transform: translateY(0px) scale(1);
    filter: blur(0px);
  }
  92%, 100% {
    opacity: 0;
    transform: translateY(120px) scale(0.95);
    filter: blur(12px);
  }
}

/* Axis 3: Decoupled Circular Face Disc Pop & Drop */
@keyframes iman-face-disc-axis {
  0%, 24% {
    opacity: 0;
    transform: translateY(-45px) scale(0.15);
    filter: blur(12px);
  }
  36% {
    opacity: 1;
    transform: translateY(3px) scale(1.2);
    filter: blur(0px);
  }
  44%, 82% {
    opacity: 1;
    transform: translateY(0px) scale(1);
    filter: blur(0px);
  }
  92%, 100% {
    opacity: 0;
    transform: translateY(-30px) scale(0.4);
    filter: blur(8px);
  }
}

/* Axis 4: Die-Cut Sticker Head Slide-Up & Peel Snap */
@keyframes iman-sticker-axis {
  0%, 8% {
    opacity: 0;
    transform: translateY(160px) rotate(-14deg) scale(0.55);
    filter: blur(16px);
  }
  30% {
    opacity: 1;
    transform: translateY(-6px) rotate(3deg) scale(1.06);
    filter: blur(0px);
  }
  40%, 82% {
    opacity: 1;
    transform: translateY(0px) rotate(0deg) scale(1);
    filter: blur(0px);
  }
  92%, 100% {
    opacity: 0;
    transform: translateY(140px) rotate(-10deg) scale(0.65);
    filter: blur(12px);
  }
}

/* ========================================================================= */
/* CARD STYLES & LAYERS                                                      */
/* ========================================================================= */

/* 1. Corporate Masked Suit (Screenshot 01) */
.person-suit-stage { background: #cbd5e1; }
.person-suit-card {
  width: 135px; height: 175px; border-radius: 26px; position: relative; z-index: 2;
  display: flex; align-items: center; justify-content: center; overflow: hidden;
  box-shadow: 0 20px 45px rgba(2,132,199,0.35), 0 0 0 1px rgba(255,255,255,0.4);
}
.person-photo-mesh {
  width: 100%; height: 100%; object-fit: cover;
  transition: transform 0.3s ease;
}
.person-face-disc-layer {
  position: absolute; top: 12px; left: calc(50% - 24px); width: 48px; height: 48px;
  pointer-events: none; z-index: 5;
}
.person-face-disc-specular {
  width: 100%; height: 100%; border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #ffffff 0%, #f1f5f9 60%, #e2e8f0 100%);
  border: 1px solid rgba(255,255,255,0.9);
  box-shadow: 0 10px 25px rgba(0,0,0,0.35), inset 0 2px 4px rgba(255,255,255,0.8);
}

/* 2. Die-Cut Sticker Head Cutout (Screenshot 02) */
.person-sticker-stage {
  background: radial-gradient(circle at 50% 50%, #064e3b 0%, #022c22 75%, #01140e 100%);
}
.person-sticker-wrap {
  position: relative; z-index: 2; width: 140px; height: 140px;
  display: flex; align-items: center; justify-content: center;
  filter: drop-shadow(0 0 0 3.5px #ffffff) drop-shadow(0 15px 30px rgba(0,0,0,0.7));
}
.person-sticker-img {
  width: 100%; height: 100%; object-fit: contain; border-radius: 20px;
}

/* 3. Graphic Noir Vector Portrait (Screenshot 03 - Red) */
.person-noir-stage { background: #09090b; }
.person-noir-card {
  width: 130px; height: 175px; border-radius: 22px; position: relative; z-index: 2;
  overflow: hidden; box-shadow: 0 15px 35px rgba(220,38,38,0.45);
}
.person-art-mesh {
  width: 100%; height: 100%; object-fit: cover;
}

/* 4. 3D Stylized Studio Persona (Screenshot 03 - Blue) */
.person-3d-stage { background: #030712; }
.person-3d-card {
  width: 130px; height: 175px; border-radius: 22px; position: relative; z-index: 2;
  overflow: hidden; box-shadow: 0 15px 35px rgba(2,132,199,0.45);
}

/* 5. Cel-Shaded Anime Persona (Screenshot 03 - Purple) */
.person-anime-stage { background: #09090b; }
.person-anime-card {
  width: 130px; height: 175px; border-radius: 22px; position: relative; z-index: 2;
  overflow: hidden; box-shadow: 0 15px 35px rgba(124,58,237,0.45);
}

/* 6. Tactile 3D Felt & Knit Character (Screenshot 03 - Cyan) */
.person-felt-stage { background: #020617; }
.person-felt-card {
  width: 130px; height: 175px; border-radius: 22px; position: relative; z-index: 2;
  overflow: hidden; box-shadow: 0 15px 35px rgba(2,132,199,0.45);
}
.phone-screen-beam {
  position: absolute; bottom: 35px; right: 25px; width: 35px; height: 35px; border-radius: 50%;
  background: radial-gradient(circle, rgba(56,189,248,0.8) 0%, rgba(56,189,248,0) 70%);
  filter: blur(6px); pointer-events: none;
  animation: beam-flicker 1.4s ease-in-out infinite alternate;
}
@keyframes beam-flicker {
  0% { opacity: 0.6; transform: scale(0.9); }
  100% { opacity: 1; transform: scale(1.2); }
}

/* ========================================================================= */
/* ANIMATION CLASS BINDINGS                                                  */
/* ========================================================================= */
.iman-card-axis {
  animation: iman-card-axis 4.8s cubic-bezier(0.16, 1, 0.3, 1) infinite !important;
  will-change: transform, opacity, filter;
}

.iman-body-slideup {
  animation: iman-body-slideup 4.8s cubic-bezier(0.16, 1, 0.3, 1) infinite !important;
  will-change: transform, opacity, filter;
}

.iman-face-disc-axis {
  animation: iman-face-disc-axis 4.8s cubic-bezier(0.34, 1.56, 0.64, 1) infinite !important;
  will-change: transform, opacity, filter;
}

.iman-sticker-axis {
  animation: iman-sticker-axis 4.8s cubic-bezier(0.16, 1, 0.3, 1) infinite !important;
  will-change: transform, opacity, filter;
}

.anim-nod {
  animation: iman-body-slideup 4.8s cubic-bezier(0.16, 1, 0.3, 1) infinite, char-3d-nod 1.6s ease-in-out infinite alternate !important;
}

.anim-float {
  animation: iman-body-slideup 4.8s cubic-bezier(0.16, 1, 0.3, 1) infinite, anime-float 3.5s ease-in-out infinite alternate !important;
}

.anim-bounce {
  animation: iman-body-slideup 4.8s cubic-bezier(0.16, 1, 0.3, 1) infinite, felt-bounce 2.6s ease-in-out infinite alternate !important;
}

@keyframes char-3d-nod {
  0% { transform: translateY(0) rotate(0deg); }
  100% { transform: translateY(-5px) rotate(2deg); }
}

@keyframes anime-float {
  0% { transform: translateY(3px) scale(0.98); }
  100% { transform: translateY(-4px) scale(1.02); }
}

@keyframes felt-bounce {
  0% { transform: translateY(4px) scale(0.97); }
  100% { transform: translateY(-5px) scale(1.03); }
}
`;

// 10. DEFINITIONS OF ARCHETYPES 04 THROUGH 50
const ARCHETYPE_DEFS = [
  { id: 4, name: "Chart / Graph", cat: "metrics", def: "Quantitative relationship, trend, comparison, or distribution. “Revenue went from $10k to $50k” → animated graph.", note: "SVG Interpolated Spline • Neon Gradient Fill Area" },
  { id: 5, name: "Number / Statistic", cat: "metrics", def: "A standalone important numerical value. “$50,000 in revenue” → giant kinetic $50,000.", note: "OLED Focal Glow • Sub-Pixel Kinetic Punch" },
  { id: 6, name: "Percentage", cat: "metrics", def: "A percentage is mentioned or implied. “Conversion increased 40%” → +40% animation.", note: "Polar Arc Gauge" },
  { id: 7, name: "Comparison", cat: "transformations", def: "Two or more things are contrasted. “A small business versus a corporation” → split-screen comparison.", note: "Split Pane Benchmark" },
  { id: 8, name: "Before / After", cat: "transformations", def: "Transformation from one state to another. “Before the system / after the system”.", note: "Curtain Wipe Sweep" },
  { id: 9, name: "Timeline / Sequence", cat: "processes", def: "Events happen in chronological order. “First X, then Y, then Z”.", note: "Chronological Step Track" },
  { id: 10, name: "Process / Workflow", cat: "processes", def: "Speaker describes how something works. “Customer enters → system processes → result”.", note: "Stage Process Flowchart" },
  { id: 11, name: "Flow / Pipeline", cat: "processes", def: "Information, money, people, or objects move between stages. “Data goes from app to database”.", note: "Packet Stream Tube" },
  { id: 12, name: "Diagram / Relationship Map", cat: "structures", def: "Entities have relationships that need visualization. “The CEO manages three departments”.", note: "Orbital Star Topology" },
  { id: 13, name: "Hierarchy / Tree", cat: "structures", def: "Parent-child or organizational relationships. Company → departments → teams.", note: "Branching Inheritance Tree" },
  { id: 14, name: "Geographic / Map Asset", cat: "artifacts", def: "Location, movement, country, city, or region is relevant. “We expanded from Lagos to London”.", note: "Transatlantic Telemetry Arc" },
  { id: 15, name: "Person / Character Asset", cat: "artifacts", def: "A specific person or human archetype is mentioned. “A founder” → founder visual.", note: "Depth Matted Avatar & Halo" },
  { id: 16, name: "Brand / Product Asset", cat: "artifacts", def: "A specific product or commercial entity is referenced. “iPhone”, “Nike shoes”.", note: "Glassmorphic 3D Device Showcase" },
  { id: 17, name: "Document / UI Asset", cat: "artifacts", def: "A document, webpage, dashboard, app, or interface is referenced. “Open your analytics dashboard”.", note: "Floating macOS Telemetry Frame" },
  { id: 18, name: "Screenshot / Screen State", cat: "artifacts", def: "An actual interface state is the best representation. Showing an Instagram profile or spreadsheet.", note: "High-Fidelity Social State Feed" },
  { id: 19, name: "Text Artifact", cat: "artifacts", def: "The content itself is the visual. Quote, headline, email, tweet, sentence.", note: "Framed Verified Social Artifact" },
  { id: 20, name: "Quote / Citation Card", cat: "artifacts", def: "Someone else's words are explicitly referenced. “As Warren Buffett said…” → quote card.", note: "Editorial Serif Citation Card" },
  { id: 21, name: "Symbol / Iconography", cat: "communication", def: "An abstract concept has a conventional visual symbol. Money → $; warning → ⚠️.", note: "Quad Glyph Ambient Matrix" },
  { id: 22, name: "Metaphorical Visual", cat: "communication", def: "Figurative language can become a visual. “You're drowning in information”.", note: "Kinetic Ocean Data Waves" },
  { id: 23, name: "Concept Visualization", cat: "communication", def: "An abstract idea needs a visual representation. “Momentum”, “discipline”, “trust”.", note: "Vector Physics Momentum Particle" },
  { id: 24, name: "Object Transformation", cat: "transformations", def: "An object changes state or form. Empty battery → full battery.", note: "Dynamic Power Core Battery Charge" },
  { id: 25, name: "State Indicator", cat: "transformations", def: "Something communicates status. Loading, active, failed, blocked, complete.", note: "Pulsing Radar Cluster Beacons" },
  { id: 26, name: "Progress / Completion", cat: "transformations", def: "Growth toward a target or completion. 0% → 100% progress bar.", note: "Neon Spectrum Laser Progress Bar" },
  { id: 27, name: "Counter / Ticker", cat: "metrics", def: "A number continuously changes. $0 → $50,000.", note: "Mechanical Odometer Digit Reels" },
  { id: 28, name: "Gauge / Meter", cat: "metrics", def: "Level, intensity, capacity, or score. 20/100 → 85/100.", note: "Radial Dial Tachometer Needle" },
  { id: 29, name: "Ranking / Leaderboard", cat: "structures", def: "Things are ordered by performance. #1, #2, #3.", note: "3D Stepped Podium #1 Benchmark" },
  { id: 30, name: "Score / Rating", cat: "metrics", def: "Quality or performance is expressed numerically. 9.4/10, A+, 85%.", note: "Radiant 5-Star Decimal Score Card" },
  { id: 31, name: "Table / Matrix", cat: "structures", def: "Multiple attributes need simultaneous comparison. Product A/B/C × price/features.", note: "Multi-Tier Comparison Matrix Grid" },
  { id: 32, name: "Calendar / Schedule", cat: "structures", def: "Dates, deadlines, frequency, or scheduling matter. “Every Monday at 9 AM”.", note: "Tear-Off Calendar Flip Desk Widget" },
  { id: 33, name: "Clock / Time Asset", cat: "communication", def: "Specific duration or time pressure matters. “Only 30 seconds left”.", note: "Quartz Analog Chronometer Sweep" },
  { id: 34, name: "Timer / Countdown", cat: "communication", def: "An explicit countdown or urgency exists. 00:10 → 00:00.", note: "Digital LED Urgent Red Countdown" },
  { id: 35, name: "Money / Financial Visualization", cat: "metrics", def: "Money, cost, profit, revenue, or spending is central. Cash stacks, balance, financial ticker.", note: "Green Bull Candlestick Trading Chart" },
  { id: 36, name: "Equation / Formula", cat: "communication", def: "A mathematical relationship is spoken. Revenue − Costs = Profit.", note: "Interactive Mathematical Token Pills" },
  { id: 37, name: "Code / Technical Snippet", cat: "structures", def: "Code, commands, or programming concepts are mentioned. Terminal/code window.", note: "Syntax-Highlighted IDE Terminal" },
  { id: 38, name: "Search / Query Visualization", cat: "communication", def: "Searching, discovering, researching, or asking is described. Search bar → results.", note: "Live Typewriter Search Autocomplete" },
  { id: 39, name: "Notification / Alert", cat: "communication", def: "A message, alert, email, notification, or warning appears. Phone notification popping up.", note: "Spring-Damped Floating iOS Pop-Up" },
  { id: 40, name: "Communication Asset", cat: "communication", def: "Conversation or communication is central. Chat bubbles, email, phone call.", note: "Sequential Dialogue Chat Bubbles" },
  { id: 41, name: "Social Proof", cat: "communication", def: "Reviews, comments, followers, testimonials, or likes matter. “10,000 people liked it”.", note: "Floating Heart Likes & Verified Avatars" },
  { id: 42, name: "Crowd / Volume Visualization", cat: "communication", def: "A large quantity of people/things needs representation. One person → thousands.", note: "Multiplying Avatar Density Lattice" },
  { id: 43, name: "Physical Scale Visualization", cat: "transformations", def: "A difference in magnitude or size needs to be shown. Tiny startup vs massive corporation.", note: "Dynamic Fulcrum Balance Beam" },
  { id: 44, name: "Object Collection / Inventory", cat: "structures", def: "Multiple concrete objects belong together. “You have 500 files” → files accumulate.", note: "Isometric Layered Asset Stack" },
  { id: 45, name: "Reveal / Hidden Asset", cat: "transformations", def: "Something hidden, unknown, secret, or discovered is discussed. Locked box → reveal.", note: "Golden Vault Radial Moat Unlock" },
  { id: 46, name: "Cause → Effect Visualization", cat: "processes", def: "One action produces another outcome. Action → consequence.", note: "Cascading Domino Causal Ripple" },
  { id: 47, name: "Problem → Solution Visualization", cat: "processes", def: "A pain point is followed by a resolution. Chaos → organized system.", note: "Chaos-to-Order Grid Resolution" },
  { id: 48, name: "Input → Output Visualization", cat: "processes", def: "Something enters a system and something emerges. Raw data → processed insight.", note: "Raw Data Intake Refinement Funnel" },
  { id: 49, name: "Loop / Cycle", cat: "processes", def: "A recurring behavior or feedback loop is discussed. Marketing → sales → revenue → marketing.", note: "Compounding Orbital Flywheel Loop" },
  { id: 50, name: "Decision Tree / Branching", cat: "processes", def: "Choices or conditional paths are described. “If X, do Y; otherwise do Z”.", note: "Binary Conditional Logic Tree" }
];

// Extract Archetype Rendering Blocks
const archetypesBuilderFile = fs.readFileSync(path.join(repoRoot, "docs/mini_run_studio/build_visual_archetypes_preview.ts"), "utf-8");
const typoFile = fs.readFileSync(path.join(repoRoot, "Yuan Prometheus Screenshots/prometheus_animations_preview/typography.html"), "utf-8");
const typoCssMatch = typoFile.match(/\/\* PRESET STYLES \*\/([\s\S]*?)<\/style>/);
const typographyExtractedCss = typoCssMatch ? typoCssMatch[1] : "";

const SAND_TYPO_CUSTOM_CSS = `
/* ========================================================================= */
/* TYPO #31 KINETIC SANDSTORM DISINTEGRATION & GRAIN DISSOLVE (SCREENSHOT 01) */
/* ========================================================================= */
.typo-sand-stage {
  width: 100%; height: 100%; position: relative; overflow: hidden;
  background: radial-gradient(circle at 30% 70%, #0c2038 0%, #06111f 50%, #02060c 100%);
  display: flex; align-items: center; justify-content: center; border-radius: 12px;
}
.typo-sand-container {
  position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center;
  width: 90%; height: 90%;
}
.sand-wind-streak {
  position: absolute; width: 140%; height: 140%;
  background: linear-gradient(45deg, transparent 0%, rgba(56,189,248,0.15) 35%, rgba(255,255,255,0.45) 55%, transparent 75%);
  filter: blur(16px); pointer-events: none;
  animation: sand-wind-drift 3.8s ease-in-out infinite alternate;
}
.sand-particle-cloud {
  position: absolute; width: 100%; height: 100%; pointer-events: none;
}
.sand-grain {
  position: absolute; background: #e0f2fe; border-radius: 50%;
  box-shadow: 0 0 8px rgba(56,189,248,0.9);
}
.sand-grain.g1 { width: 4px; height: 4px; top: 25%; left: 30%; animation: grain-scatter-1 3.2s ease-out infinite; }
.sand-grain.g2 { width: 3px; height: 3px; top: 40%; left: 45%; animation: grain-scatter-2 3.2s ease-out infinite 0.2s; }
.sand-grain.g3 { width: 5px; height: 5px; top: 60%; left: 35%; animation: grain-scatter-1 3.2s ease-out infinite 0.5s; }
.sand-grain.g4 { width: 3px; height: 3px; top: 35%; left: 60%; animation: grain-scatter-2 3.2s ease-out infinite 0.7s; }
.sand-grain.g5 { width: 4px; height: 4px; top: 70%; left: 50%; animation: grain-scatter-1 3.2s ease-out infinite 0.9s; }
.sand-grain.g6 { width: 2px; height: 2px; top: 20%; left: 55%; animation: grain-scatter-2 3.2s ease-out infinite 1.1s; }
.sand-grain.g7 { width: 6px; height: 6px; top: 50%; left: 70%; animation: grain-scatter-1 3.2s ease-out infinite 1.3s; }
.sand-grain.g8 { width: 3px; height: 3px; top: 65%; left: 65%; animation: grain-scatter-2 3.2s ease-out infinite 1.5s; }

@keyframes grain-scatter-1 {
  0% { transform: translate(0, 0) scale(1); opacity: 1; }
  100% { transform: translate(60px, -70px) scale(0.2); opacity: 0; filter: blur(4px); }
}
@keyframes grain-scatter-2 {
  0% { transform: translate(0, 0) scale(1); opacity: 1; }
  100% { transform: translate(80px, -50px) scale(0.2); opacity: 0; filter: blur(4px); }
}
@keyframes sand-wind-drift {
  0% { transform: translate(-20px, 20px) rotate(0deg); opacity: 0.6; }
  100% { transform: translate(25px, -25px) rotate(3deg); opacity: 1; }
}

.sand-text-block {
  display: flex; flex-direction: column; align-items: flex-start; justify-content: center;
  position: relative; z-index: 5;
  font-family: var(--font-display, 'Syne', sans-serif);
  font-weight: 900; line-height: 0.88; letter-spacing: -1.5px;
}
.sand-line {
  font-size: 52px; color: #ffffff;
  text-shadow: 0 0 15px rgba(255,255,255,0.7), 0 0 35px rgba(56,189,248,0.5);
  background: radial-gradient(circle at 40% 40%, #ffffff 0%, #bae6fd 60%, #7dd3fc 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
}
.sand-line.l1 {
  transform-origin: bottom left;
  animation: sand-line-erode1 3.8s cubic-bezier(0.16, 1, 0.3, 1) infinite alternate;
}
.sand-line.l2 {
  transform-origin: top left;
  animation: sand-line-erode2 3.8s cubic-bezier(0.16, 1, 0.3, 1) infinite alternate;
}
@keyframes sand-line-erode1 {
  0% { transform: skewX(0deg) translate(0, 0); filter: drop-shadow(0 0 10px rgba(56,189,248,0.4)); }
  100% { transform: skewX(-4deg) translate(3px, -2px); filter: drop-shadow(15px -10px 25px rgba(56,189,248,0.8)); }
}
@keyframes sand-line-erode2 {
  0% { transform: skewX(0deg) translate(0, 0); filter: drop-shadow(0 0 10px rgba(56,189,248,0.4)); }
  100% { transform: skewX(-2deg) translate(2px, -1px); filter: drop-shadow(12px -8px 20px rgba(56,189,248,0.8)); }
}
`;

interface BaseArchetypeExtraction {
  id: number;
  serialNumber: string;
  badge: string;
  name: string;
  category: string;
  categoryLabel: string;
  definition: string;
  examplePrompt: string;
  traitId: string;
  concern: string;
  targetScope: string;
  channels: string;
  conflicts: string;
  frameExpression: string;
  audioLinkage: string;
  renderHtml: string;
  customCss: string;
  footerNote: string;
  slug: string;
}

const EXTRACTED_ARCHETYPES_LIST: BaseArchetypeExtraction[] = [];

ARCHETYPE_DEFS.forEach(def => {
  const serial = String(def.id).padStart(2, "0");
  const idRegex = new RegExp(`id:\\s*${def.id},[\\s\\S]*?badge:\\s*"ARCHETYPE #${serial}",[\\s\\S]*?slug:\\s*"([^"]+)"[\\s\\S]*?}`, "m");
  const match = archetypesBuilderFile.match(idRegex);

  let renderHtml = `<div class="archetype-generic-stage"><div class="arch-main-label">${def.name}</div></div>`;
  let customCss = `.archetype-generic-stage { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; color: #fff; font-weight: 800; }`;
  let traitId = `trait_${def.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
  let targetScope = "archetype_component";
  let channels = "opacity, scale, translateY";
  let frameExpr = "motion = sin(frame * 0.1)";

  if (match) {
    const block = match[0];
    const htmlM = block.match(/renderHtml:\s*`([\s\S]*?)`/);
    const cssM = block.match(/customCss:\s*`([\s\S]*?)`/);
    const traitM = block.match(/traitId:\s*"([^"]+)"/);
    const scopeM = block.match(/targetScope:\s*"([^"]+)"/);
    const chanM = block.match(/channels:\s*"([^"]+)"/);
    const exprM = block.match(/frameExpression:\s*"([^"]+)"/);

    if (htmlM) renderHtml = htmlM[1];
    if (cssM) customCss = cssM[1];
    if (traitM) traitId = traitM[1];
    if (scopeM) targetScope = scopeM[1];
    if (chanM) channels = chanM[1];
    if (exprM) frameExpr = exprM[1];
  }

  EXTRACTED_ARCHETYPES_LIST.push({
    id: def.id,
    serialNumber: serial,
    badge: `ANIMA #${serial}`,
    name: def.name,
    category: def.cat,
    categoryLabel: def.cat.charAt(0).toUpperCase() + def.cat.slice(1),
    definition: def.def,
    examplePrompt: `“Demonstrating ${def.name} in 60fps Remotion action.”`,
    traitId: traitId,
    concern: `${def.name.replace(/[^a-zA-Z]/g, "")}Concern`,
    targetScope: targetScope,
    channels: channels,
    conflicts: "None",
    frameExpression: frameExpr,
    audioLinkage: `Spatial SFX Cue #${serial} (Stereo Pan & Dynamic Biquad Filter)`,
    renderHtml: renderHtml,
    customCss: customCss,
    footerNote: def.note,
    slug: def.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  });
});

// Helper to generate bespoke multi-variants for Archetypes 03 to 50
function generateArchetypeVariants(def: { id: number; name: string; cat: string; def: string; note: string }, baseHtml: string, baseCss: string): ArchetypeVariant[] {
  const serial = String(def.id).padStart(2, "0");
  const prefix = def.name.toUpperCase().slice(0, 4).replace(/[^A-Z]/g, '');

  return [
    {
      id: 1,
      badge: `${prefix} #01`,
      name: `${def.name} — Master Canonical Preset`,
      traitId: `trait_${def.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_canonical`,
      concern: `${def.name.replace(/[^a-zA-Z]/g, '')}Physics`,
      targetScope: "archetype_core",
      channels: "scale, opacity, translateY, rotate",
      conflicts: "None",
      frameExpression: "motion = sin(frame * 0.1) * 1.0",
      footerSpec: `${def.note} • 60 FPS Master Benchmark`,
      slug: `${def.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-canonical`,
      code: baseCss.slice(0, 180) + "...",
      html: baseHtml
    },
    {
      id: 2,
      badge: `${prefix} #02`,
      name: `${def.name} — High-Contrast Neon Variant`,
      traitId: `trait_${def.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_neon_pulse`,
      concern: "MaterialTreatment",
      targetScope: "hero_accent",
      channels: "filter.dropShadow, scale, strokeDashoffset",
      conflicts: "muted_paper_texture",
      frameExpression: "glowIntensity = 0.8 + 0.2 * sin(frame * 0.2)",
      footerSpec: "OLED Deep Black • Specular Cyan & Gold Bloom",
      slug: `${def.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-neon-pulse`,
      code: `.variant-neon { filter: drop-shadow(0 0 16px var(--accent-cyan)); }`,
      html: baseHtml.replace(/fill="#06b6d4"/g, 'fill="#ffd700"').replace(/stroke="#06b6d4"/g, 'stroke="#38bdf8"')
    },
    {
      id: 3,
      badge: `${prefix} #03`,
      name: `${def.name} — Kinetic Fast-Spring Variant`,
      traitId: `trait_${def.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_kinetic_spring`,
      concern: "TemporalTrigger",
      targetScope: "entity_token",
      channels: "translateY, scale, opacity",
      conflicts: "None",
      frameExpression: "springY = interpolate(frame, [0, 15], [30, 0], { extrapolateRight: 'clamp' })",
      footerSpec: "Fast 120 BPM Spring Physics • Overshoot Damped",
      slug: `${def.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-spring-fast`,
      code: `@keyframes spring-pop { 0% { transform: scale(0.8); } 70% { transform: scale(1.05); } 100% { transform: scale(1); } }`,
      html: baseHtml
    }
  ];
}

// Assemble ALL 50 ARCHETYPES SUITES
const ALL_50_ARCHETYPES_DATA: AnimaArchetypeFull[] = [
  // 01. Typography Master Suite (41 Presets)
  {
    id: 1,
    serialNumber: "01",
    badge: "ANIMA #01",
    name: "Typography (Master Kinetic Suite)",
    category: "typography",
    categoryLabel: "Kinetic Typography",
    definition: "Master typographic motion engine comprising 41 distinct kinetic treatments & stylizations (39 Motion Physics Engines + 2 High-Impact Editorial Treatments), 63 font JSON profiles, subpixel masking, and 60fps Remotion math.",
    examplePrompt: "“Words are not static text overlays; they are tactile 3D physical meshes interacting with depth and sound.”",
    traitId: "trait_master_kinetic_typography_suite",
    concern: "KineticTypographyCore",
    targetScope: "typography_canvas",
    channels: "opacity, filter.blur, translateY, scale, rotateX, clipPath, filter.noise",
    conflicts: "raw_unstyled_system_fonts",
    frameExpression: "kineticWeight = 700 + sin(frame * 0.1) * 200",
    audioLinkage: "Mechanical Keystroke Clicks & Sandstorm Particle Whir (Pan: Center, Cutoff: 18,500 Hz)",
    footerNote: "41 Active Presets • 39 Animation Physics + 2 Editorial Treatments",
    slug: "typography",
    variants: TYPOGRAPHY_30_PRESETS,
    customCss: typographyExtractedCss + "\n" + SAND_TYPO_CUSTOM_CSS
  },

  // 02. Micro Asset Master Motion Suite (15 Advanced Complex Presets - Instagram Icon Subject)
  {
    id: 2,
    serialNumber: "02",
    badge: "ANIMA #02",
    name: "Micro Asset (Master Vector Motion Suite)",
    category: "artifacts",
    categoryLabel: "Artifacts & Utilities",
    definition: "High-production vector motion suite featuring 15 distinct complex animation engines (Bézier springs, Gaussian blur flares, liquid stroke unfurls, RGB glitch, 3D isometric extrusions, gooey metaballs, and CRT beams).",
    examplePrompt: "“Recognizable brand entities & utility icons animated with bespoke physical motion physics.”",
    traitId: "trait_micro_asset_vector_motion_suite",
    concern: "VectorMotionPhysics",
    targetScope: "vector_asset_mesh",
    channels: "transform.scale, rotate, filter.blur, strokeDashoffset, clipPath, matrix3d",
    conflicts: "low_res_raster_bitmaps",
    frameExpression: "motionVector = easeOutElastic(frame / 45)",
    audioLinkage: "HUD Optical Ping & Mechanical Ratchet (Pan: 0.0, Cutoff: 14,000 Hz)",
    footerNote: "15 Active Presets • 60 FPS Parametric Motion Physics",
    slug: "micro-asset",
    variants: MICRO_ASSET_15_PRESETS,
    customCss: MICRO_ASSET_CUSTOM_CSS
  },

  // 03. List / Enumeration Dynamic Suite (12 Advanced Presets from Authoritative References)
  {
    id: 3,
    serialNumber: "03",
    badge: "ANIMA #03",
    name: "List / Enumeration (Dynamic Sequence & Pillar Suite)",
    category: "structures",
    categoryLabel: "Structures & Sequencing",
    definition: "Dynamic multi-item list and pillar suite featuring 3D cylindrical carousels, arrow-pointed pill trackers, overlapping numeral swap decks, bubble bullet sequencers, and classical Greek architectural column frameworks (Doric, Ionic, Corinthian).",
    examplePrompt: "“Five core strategic pillars: SEO, Social Media, Paid Ads, Influencer Collaboration, and Data Strategy.”",
    traitId: "trait_list_enumeration_dynamic_suite",
    concern: "SequenceComposition",
    targetScope: "list_container",
    channels: "translateY, scale, rotateY, opacity, clipPath, backdropFilter",
    conflicts: "None",
    frameExpression: "activeListIndex = floor(frame / 30) % itemCount",
    audioLinkage: "Mechanical Ratchet Clicks & Orchestral Pillar Rises (Pan: Center, Cutoff: 18,500 Hz)",
    footerNote: "9 Active Presets • Depth-of-Field (DoF) Rack-Focus Gaussian Blur Physics",
    slug: "list-enumeration",
    variants: LIST_ENUMERATION_9_PRESETS,
    customCss: LIST_CUSTOM_CSS
  },

  // 04. Chart / Graph Master Vector Trajectory Suite (8 Progressive Temporal Reveal Presets)
  {
    id: 4,
    serialNumber: "04",
    badge: "ANIMA #04",
    name: "Chart / Graph (Master Progressive Vector Trajectory Suite)",
    category: "metrics",
    categoryLabel: "Metrics & Data",
    definition: "High-production progressive temporal reveal vector chart suite. Zero static charts: every chart starts at origin (t=0) and dynamically flows forward into its positive or negative resolution with synchronized SVG line-drawing, expanding clip-path underglow gradients, staggered milestone pops, and apex blooms.",
    examplePrompt: "“Revenue went from $10k to $80k parabolically with massive compound velocity.”",
    traitId: "trait_chart_graph_progressive_trajectory_suite",
    concern: "TemporalTrigger + MotionPhysics",
    targetScope: "chart_vector_system",
    channels: "strokeDashoffset, clipPath.width, translateY, scale, opacity, filter.dropShadow",
    conflicts: "None",
    frameExpression: "splineDraw = easeOutCubic(frame / 60)",
    audioLinkage: "Telemetry Optical Ping & Harmonic Resonance (Pan: Center, Cutoff: 16,000 Hz)",
    footerNote: "8 Active Presets • 100% Progressive Temporal Reveal Physics • Origin-to-Resolution Flow",
    slug: "chart-graph",
    variants: CHART_GRAPH_8_PRESETS,
    customCss: CHART_CUSTOM_CSS
  },

  // 05. Number / Statistic Dynamic Kinetic Suite (6 Curated Motion Presets)
  {
    id: 5,
    serialNumber: "05",
    badge: "ANIMA #05",
    name: "Number / Statistic (Dynamic Kinetic Number & Counter Suite)",
    category: "metrics",
    categoryLabel: "Metrics & Data",
    definition: "High-production parametric number & counter motion suite. Features directional liquid velocity smear dissolves with initial glitch-in & expanding neon shockwave rings (Ref Screenshot 01), asynchronous multi-reel slot tumblers with motion blur (Ref Screenshot 02), mechanical counters with slanted zeroes and elastic rebound bouncing ($50,000), and physics-driven domino falling zero cascades.",
    examplePrompt: "“We scaled from 0 to over 551 enterprise clients with a $10M run rate.”",
    traitId: "trait_number_statistic_kinetic_suite",
    concern: "TemporalTrigger + MaterialTreatment",
    targetScope: "kinetic_number_cluster",
    channels: "filter.blur, transform.translateY, transform.scale, opacity, skewX, textShadow",
    conflicts: "None",
    frameExpression: "smearDissolve = easeOutCubic(frame / 45) | reelSpin = easeOutBack(frame / 40)",
    audioLinkage: "Subpixel Ratchet Clicks, Heavy Sub-Bass Impact & Velocity Smear Whoosh (Pan: Center, Cutoff: 18,500 Hz)",
    footerNote: "6 Active Presets • Directional Liquid Smear, Staggered Slot Reels & Domino Physics",
    slug: "number-statistic",
    variants: NUMBER_STATISTIC_6_PRESETS,
    customCss: NUMBER_CUSTOM_CSS
  },

  // 06. Percentage Suite (Dedicated Radial Multi-Tick Dial & Polar Gauges)
  {
    id: 6,
    serialNumber: "06",
    badge: "ANIMA #06",
    name: "Percentage (Radial Tick Dial, 3D Sphere Orb & Polar Gauge Suite)",
    category: "metrics",
    categoryLabel: "Metrics & Data",
    definition: "Precision percentage metric suite featuring dynamic 48-tick radial dial counters with proportional sweep, polar arc progress rings with specular apex gleams, kinetic punch numbers with shockwave pulse rings, 3D luminescent sphere orb gauges with rotating ray needles (Ref Screenshot 01), and celestial atmospheric horizon arcs with hairline eclipse numerals (Ref Screenshot 02).",
    examplePrompt: "“Conversion increased 50% across organic channels while retaining an 87% customer renewal rate.”",
    traitId: "trait_percentage_radial_gauge_suite",
    concern: "TemporalTrigger + Structures",
    targetScope: "percentage_gauge",
    channels: "stroke, opacity, text.percentage, scale, strokeDashoffset, transform.rotate",
    conflicts: "None",
    frameExpression: "activeTicks = floor((frame % 90) / 90 * 48)",
    audioLinkage: "Subpixel Tick Whir, Laser Needle Sweep & Sine Resolution (Pan: Center, Cutoff: 14,500 Hz)",
    footerNote: "5 Active Presets • Dynamic 48-Tick Sweep, 3D Luminescent Sphere & Celestial Horizon Glow",
    slug: "percentage",
    variants: PERCENTAGE_5_PRESETS,
    customCss: PERCENTAGE_CUSTOM_CSS
  },

  // 07. Comparison Dynamic Contrast & Split Suite (2 Curated Master Presets)
  {
    id: 7,
    serialNumber: "07",
    badge: "ANIMA #07",
    name: "Comparison (Dynamic Contrast & Split Suite)",
    category: "transformations",
    categoryLabel: "Transformations & States",
    definition: "High-production dynamic comparison and contrast suite. Features non-straight stepped notch laser split screens with divergent atmosphere lighting (Ref Screenshot 04), and dual product studio stages with independent podium lighting (Ref Screenshot 02). Fully tinkerable animation parameters across trajectories, split ratios, and pulse dynamics.",
    examplePrompt: "“A legacy manual approach vs the Prometheus AI autonomous engine.”",
    traitId: "trait_comparison_contrast_split_suite",
    concern: "SpatialArrangement + MaterialTreatment",
    targetScope: "comparison_stage",
    channels: "clipPath, filter.glow, transform.scale, opacity, translateY, filter.dropShadow",
    conflicts: "None",
    frameExpression: "steppedNotch = 50% + sin(frame / 30) * 2% | podiumFloat = sin(frame / 20) * 6px",
    audioLinkage: "Dual Polarity Laser Slice & Studio Resonance (Pan: Split L/R, Cutoff: 17,000 Hz)",
    footerNote: "2 Active Presets • Stepped Notch Seam & Dual Studio Podiums • Pipeline-Tinkerable",
    slug: "comparison",
    variants: COMPARISON_2_PRESETS,
    customCss: COMPARISON_CUSTOM_CSS
  },

  // 15. Person / Character Asset Master Persona Suite (6 Advanced Presets)
  {
    id: 15,
    serialNumber: "15",
    badge: "ANIMA #15",
    name: "Person / Character Asset (Depth-Matted Avatar & Stylized Persona Suite)",
    category: "artifacts",
    categoryLabel: "Artifacts & Utilities",
    definition: "Master character & persona suite. Features tailored business suits with blank specular circular face discs on rounded blue cards (Ref Screenshot 01), die-cut white outline sticker heads with parallax bob (Ref Screenshot 02), graphic noir ink vector silhouettes on crimson cards (Ref Screenshot 03 - Red), 3D rendered studio avatars with beanies & headphones (Ref Screenshot 03 - Blue), cel-shaded anime personas on lavender cards (Ref Screenshot 03 - Purple), and tactile 3D felt characters with glowing smartphones (Ref Screenshot 03 - Cyan).",
    examplePrompt: "“A visionary founder who rebuilt the architecture from first principles.”",
    traitId: "trait_person_character_stylized_persona_suite",
    concern: "MaterialTreatment + LayoutComposition",
    targetScope: "character_avatar",
    channels: "translateY, scale, opacity, filter.dropShadow, rotate, clipPath",
    conflicts: "None",
    frameExpression: "cardSpring = easeOutBack(frame / 30) | charFloat = sin(frame / 20) * 4px",
    audioLinkage: "Avatar Pop Acoustic Resonance, Ambient Studio Presence & Specular Shimmer (Pan: Center, Cutoff: 18,500 Hz)",
    footerNote: "6 Active Presets • Masked Suits, Die-Cut Stickers, Graphic Noir & 3D Avatars",
    slug: "person-character",
    variants: PERSON_6_PRESETS,
    customCss: PERSON_CUSTOM_CSS
  }
];

// Append remaining 42 archetypes (08-14, 16-50)
EXTRACTED_ARCHETYPES_LIST.forEach((arch) => {
  if (arch.id === 2 || arch.id === 3 || arch.id === 4 || arch.id === 5 || arch.id === 6 || arch.id === 7 || arch.id === 15) return;
  const def = ARCHETYPE_DEFS.find(d => d.id === arch.id);
  if (!def) return;
  const variants = generateArchetypeVariants(def, arch.renderHtml, arch.customCss);

  ALL_50_ARCHETYPES_DATA.push({
    id: arch.id,
    serialNumber: arch.serialNumber,
    badge: arch.badge,
    name: arch.name,
    category: arch.category as any,
    categoryLabel: arch.categoryLabel,
    definition: arch.definition,
    examplePrompt: arch.examplePrompt,
    traitId: arch.traitId,
    concern: arch.concern,
    targetScope: arch.targetScope,
    channels: arch.channels,
    conflicts: arch.conflicts,
    frameExpression: arch.frameExpression,
    audioLinkage: arch.audioLinkage,
    footerNote: arch.footerNote,
    slug: arch.slug,
    variants: variants,
    customCss: arch.customCss
  });
});

console.log(`[ANIMA_BUILDER] Assembled ${ALL_50_ARCHETYPES_DATA.length} Archetype Suites with ${ALL_50_ARCHETYPES_DATA.reduce((acc, a) => acc + a.variants.length, 0)} total live visual assets!`);

const htmlOutput = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>ANIMA — 50-Archetype Motion Engine & Semantic Router (218 Total Motion Assets)</title>
  
  <!-- WebFonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Fraunces:opsz,wght@9..144,700;9..144,900&family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600;700;800&family=Outfit:wght@600;800;900&family=Playfair+Display:ital,wght@1,700;1,900&family=Plus+Jakarta+Sans:ital,wght@0,400;0,600;0,700;0,800;1,800&family=Syne:wght@700;800;900&display=swap" rel="stylesheet">

  <style>
    :root {
      --bg-primary: #050508;
      --bg-secondary: #0a0b12;
      --bg-card: #10121d;
      --bg-preview: #040407;
      --border-subtle: rgba(255, 255, 255, 0.08);
      --border-glow: rgba(6, 182, 212, 0.4);
      --accent-cyan: #06b6d4;
      --accent-purple: #7c3aed;
      --accent-rose: #f43f5e;
      --accent-emerald: #10b981;
      --accent-amber: #f59e0b;
      --text-primary: #f8fafc;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --ease-apple: cubic-bezier(0.16, 1, 0.3, 1);
      --font-ui: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
      --font-mono: "JetBrains Mono", monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background-color: var(--bg-primary);
      color: var(--text-primary);
      font-family: var(--font-ui);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      -webkit-font-smoothing: antialiased;
      overflow-x: hidden;
    }

    /* TOP GLOBAL NAV */
    .nav-bar {
      position: sticky; top: 0; z-index: 1000;
      background: rgba(5, 5, 8, 0.92);
      backdrop-filter: blur(24px) saturate(180%);
      border-bottom: 1px solid var(--border-subtle);
      padding: 14px 28px;
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px;
    }

    .nav-brand { display: flex; align-items: center; gap: 12px; }
    .nav-brand-logo {
      width: 38px; height: 38px;
      background: linear-gradient(135deg, var(--accent-purple), var(--accent-cyan));
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-weight: 900; font-size: 18px; color: #fff;
      box-shadow: 0 0 20px rgba(124, 58, 237, 0.5);
    }
    .nav-brand-text h1 { font-size: 16px; font-weight: 800; letter-spacing: -0.02em; }
    .nav-brand-text p { font-size: 11px; color: var(--text-secondary); }

    .nav-links { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .nav-links a {
      color: var(--text-secondary); text-decoration: none;
      padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 600;
      background: rgba(255,255,255,0.04); border: 1px solid var(--border-subtle);
      transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 6px;
    }
    .nav-links a:hover, .nav-links a.active {
      color: #fff; background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.25);
    }
    .nav-links a.highlight {
      background: rgba(6, 182, 212, 0.15); border-color: rgba(6, 182, 212, 0.4); color: var(--accent-cyan);
    }

    /* TOP VIEW TABS: SUITES vs SEMANTIC ROUTER */
    .top-mode-bar {
      background: rgba(10, 11, 18, 0.95);
      border-bottom: 1px solid var(--border-subtle);
      padding: 10px 28px;
      display: flex; align-items: center; gap: 12px;
    }
    .mode-tab-btn {
      background: rgba(255,255,255,0.05); border: 1px solid var(--border-subtle);
      color: var(--text-secondary); font-size: 12px; font-weight: 800; padding: 8px 16px;
      border-radius: 8px; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 6px;
    }
    .mode-tab-btn:hover, .mode-tab-btn.active {
      background: rgba(6,182,212,0.2); border-color: var(--accent-cyan); color: #fff; box-shadow: 0 0 16px rgba(6,182,212,0.3);
    }

    /* ANIMA MAIN APP SHELL */
    .anima-shell {
      display: flex; flex: 1; min-height: calc(100vh - 120px);
    }

    /* LEFT SIDEBAR */
    .anima-sidebar {
      width: 360px; flex-shrink: 0; background: var(--bg-secondary);
      border-right: 1px solid var(--border-subtle); display: flex; flex-direction: column;
      height: calc(100vh - 120px); position: sticky; top: 120px;
    }

    .sidebar-header {
      padding: 16px; border-bottom: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 12px;
    }

    .serial-jump-bar { display: flex; gap: 8px; align-items: center; }
    .serial-input-wrapper { position: relative; flex: 1; }
    .serial-input {
      width: 100%; padding: 10px 14px 10px 34px; background: #000;
      border: 1px solid rgba(255,255,255,0.15); border-radius: 8px;
      color: #fff; font-family: var(--font-mono); font-size: 13px; font-weight: 700; outline: none;
    }
    .serial-input:focus { border-color: var(--accent-cyan); box-shadow: 0 0 16px rgba(6,182,212,0.35); }
    .serial-prefix-icon { position: absolute; left: 10px; top: 10px; font-size: 12px; color: var(--accent-cyan); font-family: var(--font-mono); }

    .btn-jump {
      background: var(--accent-cyan); color: #000; border: none; padding: 10px 14px;
      border-radius: 8px; font-weight: 800; font-size: 12px; cursor: pointer; transition: all 0.2s;
    }
    .btn-jump:hover { background: #38bdf8; box-shadow: 0 0 16px rgba(6,182,212,0.5); }

    .category-filter-chips { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; }
    .c-chip {
      background: rgba(255,255,255,0.05); border: 1px solid var(--border-subtle);
      color: var(--text-secondary); font-size: 11px; font-weight: 700; padding: 4px 10px;
      border-radius: 12px; cursor: pointer; white-space: nowrap; transition: all 0.2s;
    }
    .c-chip:hover, .c-chip.active { background: rgba(6,182,212,0.2); border-color: var(--accent-cyan); color: #fff; }

    .sidebar-list { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 6px; }
    .sidebar-item {
      display: flex; align-items: center; gap: 12px; padding: 10px 12px;
      background: rgba(255,255,255,0.02); border: 1px solid transparent;
      border-radius: 10px; cursor: pointer; transition: all 0.2s;
    }
    .sidebar-item:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.1); }
    .sidebar-item.selected { background: rgba(6,182,212,0.14); border-color: var(--accent-cyan); box-shadow: 0 0 20px rgba(6,182,212,0.2); }

    .s-num {
      font-family: var(--font-mono); font-size: 12px; font-weight: 900;
      color: var(--accent-cyan); background: rgba(6,182,212,0.12); padding: 4px 8px; border-radius: 6px;
    }
    .s-meta { display: flex; flex-direction: column; gap: 2px; flex: 1; overflow: hidden; }
    .s-name { font-size: 13px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .s-cat { font-family: var(--font-mono); font-size: 10px; color: var(--text-muted); }

    /* RIGHT MAIN STAGE */
    .anima-main {
      flex: 1; display: flex; flex-direction: column; overflow-y: auto; padding: 28px 36px;
      gap: 32px; max-width: 1500px; margin: 0 auto; width: 100%;
    }

    /* ARCHETYPE HERO BANNER */
    .archetype-hero-banner {
      background: linear-gradient(135deg, rgba(124,58,237,0.15), rgba(6,182,212,0.1));
      border: 1px solid rgba(255,255,255,0.12); border-radius: 18px; padding: 24px 32px;
      display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;
    }
    .hb-title-group h2 { font-size: 24px; font-weight: 900; letter-spacing: -0.02em; display: flex; align-items: center; gap: 10px; }
    .hb-title-group p { font-size: 13px; color: var(--text-secondary); margin-top: 4px; max-width: 750px; }
    .hb-badge { font-family: var(--font-mono); font-size: 11px; font-weight: 900; background: var(--accent-cyan); color: #000; padding: 4px 10px; border-radius: 6px; }

    .nav-pager-btns { display: flex; gap: 8px; }
    .pager-btn {
      background: #000; border: 1px solid rgba(255,255,255,0.2); color: #fff;
      padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s;
    }
    .pager-btn:hover { background: #fff; color: #000; }

    /* TRAIT SUMMARY STRIP */
    .trait-summary-strip {
      background: rgba(0,0,0,0.5); border: 1px solid var(--border-subtle); border-radius: 14px;
      padding: 14px 20px; display: flex; flex-wrap: wrap; gap: 16px; align-items: center; justify-content: space-between;
      font-family: var(--font-mono); font-size: 11px;
    }
    .trait-chip-item { display: flex; align-items: center; gap: 6px; color: var(--text-secondary); }
    .trait-chip-item strong { color: #fff; }

    /* CARDS GRID */
    .cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(480px, 1fr)); gap: 28px; }

    .card {
      background: var(--bg-card); border: 1px solid var(--border-subtle);
      border-radius: 20px; overflow: hidden; display: flex; flex-direction: column;
      transition: transform 0.25s, border-color 0.25s, box-shadow 0.25s;
      box-shadow: 0 12px 36px rgba(0,0,0,0.6);
    }
    .card:hover {
      border-color: rgba(255, 255, 255, 0.3);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(6, 182, 212, 0.15);
      transform: translateY(-4px);
    }

    .card-header {
      padding: 16px 20px; display: flex; align-items: center; justify-content: space-between;
      border-bottom: 1px solid var(--border-subtle); background: rgba(0, 0, 0, 0.4);
    }
    .card-title-group { display: flex; align-items: center; gap: 10px; }
    .card-badge {
      font-family: var(--font-mono); font-size: 11px; font-weight: 800; color: #fff;
      background: rgba(255, 255, 255, 0.14); padding: 4px 10px; border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.18);
    }
    .card-title { font-size: 15px; font-weight: 700; letter-spacing: -0.01em; color: #fff; }

    .header-actions { display: flex; align-items: center; gap: 8px; }
    .inspect-btn {
      background: rgba(6, 182, 212, 0.15); border: 1px solid rgba(6, 182, 212, 0.4);
      color: #38bdf8; border-radius: 8px; padding: 6px 12px; font-size: 11px; font-weight: 700;
      cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; gap: 4px;
    }
    .inspect-btn:hover { background: #06b6d4; color: #000; box-shadow: 0 0 16px rgba(6,182,212,0.5); }

    .replay-btn {
      background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.16);
      color: var(--text-primary); border-radius: 8px; padding: 6px 12px; font-size: 11px;
      font-weight: 600; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: all 0.2s ease;
    }
    .replay-btn:hover { background: #ffffff; color: #000; box-shadow: 0 0 18px rgba(255, 255, 255, 0.5); }

    .preview-stage {
      height: 280px; background: var(--bg-preview); position: relative; overflow: hidden;
      display: flex; align-items: center; justify-content: center; padding: 24px; width: 100%;
    }

    .card-footer {
      padding: 14px 20px; border-top: 1px solid var(--border-subtle);
      background: rgba(0, 0, 0, 0.25); display: flex; align-items: center; justify-content: space-between;
      font-size: 12px; color: var(--text-secondary); font-family: var(--font-mono);
    }

    /* TAG FILTER SYSTEM & BADGES */
    .tag-pill {
      display: inline-flex; align-items: center; gap: 4px;
      font-family: var(--font-mono); font-size: 10px; font-weight: 800;
      padding: 3px 9px; border-radius: 12px; margin-left: 8px;
    }
    .tag-animation { background: rgba(6,182,212,0.18); color: #38bdf8; border: 1px solid rgba(6,182,212,0.4); }
    .tag-treatment { background: rgba(192,132,252,0.18); color: #c084fc; border: 1px solid rgba(192,132,252,0.4); }
    .filter-btn {
      padding: 7px 16px; border-radius: 20px; font-size: 12px; font-weight: 700;
      cursor: pointer; border: 1px solid var(--border-subtle); background: var(--bg-secondary);
      color: var(--text-secondary); transition: all 0.2s; font-family: var(--font-mono);
    }
    .filter-btn:hover { background: rgba(255,255,255,0.1); color: #fff; border-color: rgba(255,255,255,0.3); }
    .filter-btn.active { background: rgba(6,182,212,0.2); color: #06b6d4; border-color: rgba(6,182,212,0.6); box-shadow: 0 0 12px rgba(6,182,212,0.2); }
    .filter-btn.treatment-active { background: rgba(192,132,252,0.2); color: #c084fc; border-color: rgba(192,132,252,0.6); box-shadow: 0 0 12px rgba(192,132,252,0.2); }

    .trait-drawer {
      background: #09090e; border-top: 1px solid rgba(6, 182, 212, 0.3);
      padding: 18px 20px; display: none; font-family: var(--font-mono); font-size: 11px;
      color: #cbd5e1; animation: slide-down 0.25s ease-out;
    }
    .trait-drawer.open { display: block; }
    @keyframes slide-down { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }

    .drawer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 8px; }
    .drawer-tag { display: inline-block; background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 4px; color: #fff; margin-right: 6px; font-weight: 700; }
    .drawer-code { background: #000; padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); color: #38bdf8; overflow-x: auto; margin-top: 8px; }

    /* ========================================================================= */
    /* SEMANTIC ROUTER & MULTI-ARCHETYPE CLASSIFIER STYLES                       */
    /* ========================================================================= */
    .router-container { display: flex; flex-direction: column; gap: 24px; width: 100%; }

    .router-card {
      background: var(--bg-card); border: 1px solid rgba(6,182,212,0.3); border-radius: 20px;
      padding: 24px 28px; display: flex; flex-direction: column; gap: 20px;
      box-shadow: 0 16px 40px rgba(0,0,0,0.7), 0 0 30px rgba(6,182,212,0.15);
    }

    .router-input-wrapper { display: flex; flex-direction: column; gap: 10px; }
    .router-textarea {
      width: 100%; height: 100px; background: #000; border: 1px solid rgba(255,255,255,0.2);
      border-radius: 12px; padding: 14px 18px; color: #fff; font-family: var(--font-ui);
      font-size: 15px; font-weight: 500; resize: vertical; outline: none; line-height: 1.5;
    }
    .router-textarea:focus { border-color: var(--accent-cyan); box-shadow: 0 0 20px rgba(6,182,212,0.4); }

    .quick-preset-chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .q-chip {
      background: rgba(255,255,255,0.06); border: 1px solid var(--border-subtle); color: var(--text-secondary);
      font-size: 11px; font-weight: 700; padding: 6px 12px; border-radius: 8px; cursor: pointer; transition: all 0.2s;
    }
    .q-chip:hover { background: rgba(6,182,212,0.2); border-color: var(--accent-cyan); color: #fff; }

    .router-results-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 24px; }
    
    .radar-panel {
      background: rgba(0,0,0,0.6); border: 1px solid var(--border-subtle); border-radius: 16px;
      padding: 20px; display: flex; flex-direction: column; gap: 16px;
    }

    .primary-signal-box {
      background: linear-gradient(135deg, rgba(6,182,212,0.2), rgba(124,58,237,0.15));
      border: 1px solid var(--accent-cyan); border-radius: 14px; padding: 16px 20px;
      display: flex; flex-direction: column; gap: 8px;
    }

    .confidence-meter {
      height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden; margin-top: 4px;
    }
    .confidence-fill { height: 100%; background: linear-gradient(90deg, var(--accent-cyan), var(--accent-emerald)); width: 95%; }

    .compound-pill {
      background: rgba(124,58,237,0.25); border: 1px solid var(--accent-purple); color: #c084fc;
      padding: 4px 10px; border-radius: 6px; font-family: var(--font-mono); font-size: 11px; font-weight: 800;
      display: inline-flex; align-items: center; gap: 6px;
    }

    .entity-tag {
      background: rgba(255,255,255,0.1); color: #fff; padding: 2px 8px; border-radius: 4px; font-family: var(--font-mono); font-size: 11px; margin-right: 4px;
    }

    /* EXTRACTED CSS RULES FOR ALL ARCHETYPES */
    ${ALL_50_ARCHETYPES_DATA.map(a => a.customCss).join("\n")}
  </style>
</head>
<body>

  <!-- SVG Filter Helpers -->
  <svg style="position: absolute; width: 0; height: 0; pointer-events: none;">
    <defs>
      <filter id="goo-threshold-html">
        <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
        <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="gooey" />
      </filter>
    </defs>
  </svg>

  <!-- TOP GLOBAL NAV -->
  <nav class="nav-bar">
    <div class="nav-brand">
      <div class="nav-brand-logo">A</div>
      <div class="nav-brand-text">
        <h1>ANIMA Studio</h1>
        <p>50-Archetype Visual Engine & Semantic Note Router (188 Total Assets)</p>
      </div>
    </div>
    <div class="nav-links">
      <a href="/typo">🎬 /typo Kinetic & Video Studio</a>
      <a href="/">🎥 / Video SFX Player</a>
      <a href="/mixfont">🎨 /mixfont Testing Hub</a>
      <a href="/anima" class="highlight active">✨ /anima ANIMA Studio</a>
      <a href="/paste">📸 /paste Gallery</a>
    </div>
  </nav>

  <!-- TOP MODE BAR: SUITES vs SEMANTIC ROUTER -->
  <div class="top-mode-bar">
    <button class="mode-tab-btn active" id="tabSuites" onclick="switchMainMode('suites')">
      <span>🔲 50 Archetype Visual Suites</span>
    </button>
    <button class="mode-tab-btn" id="tabRouter" onclick="switchMainMode('router')">
      <span>🧠 Semantic Classifier & Multi-Archetype Router</span>
    </button>
  </div>

  <!-- ANIMA APP SHELL -->
  <div class="anima-shell">
    
    <!-- SIDEBAR -->
    <aside class="anima-sidebar" id="sidebarContainer">
      <div class="sidebar-header">
        <div class="serial-jump-bar">
          <div class="serial-input-wrapper">
            <span class="serial-prefix-icon">#</span>
            <input type="text" id="serialInput" class="serial-input" placeholder="Jump to Serial (01..50)" maxlength="2" onkeyup="handleSerialKey(event)">
          </div>
          <button class="btn-jump" onclick="jumpToEnteredSerial()">JUMP</button>
        </div>
        <div class="category-filter-chips">
          <button class="c-chip active" data-cat="all" onclick="filterSidebar('all')">All (50)</button>
          <button class="c-chip" data-cat="typography" onclick="filterSidebar('typography')">Typography (${TYPOGRAPHY_30_PRESETS.length})</button>
          <button class="c-chip" data-cat="artifacts" onclick="filterSidebar('artifacts')">Artifacts (15+)</button>
          <button class="c-chip" data-cat="metrics" onclick="filterSidebar('metrics')">Metrics</button>
          <button class="c-chip" data-cat="structures" onclick="filterSidebar('structures')">Structures</button>
          <button class="c-chip" data-cat="processes" onclick="filterSidebar('processes')">Processes</button>
          <button class="c-chip" data-cat="transformations" onclick="filterSidebar('transformations')">States</button>
          <button class="c-chip" data-cat="communication" onclick="filterSidebar('communication')">Concepts</button>
        </div>
      </div>

      <div class="sidebar-list" id="sidebarList">
        ${ALL_50_ARCHETYPES_DATA.map((arch, idx) => `
          <div class="sidebar-item ${idx === 0 ? 'selected' : ''}" data-id="${arch.id}" data-serial="${arch.serialNumber}" data-cat="${arch.category}" onclick="openArchetypePage(${arch.id})">
            <span class="s-num">${arch.serialNumber}</span>
            <div class="s-meta">
              <span class="s-name">${arch.name}</span>
              <span class="s-cat">${arch.categoryLabel} (${arch.variants.length} assets)</span>
            </div>
          </div>
        `).join("\n")}
      </div>
    </aside>

    <!-- MAIN VIEWPORT -->
    <main class="anima-main" id="animaMainContainer">
      
      <!-- MODE 1: ARCHETYPE SUITES VIEW -->
      <div id="viewSuites" style="display: flex; flex-direction: column; gap: 32px;">
        <div class="archetype-hero-banner" id="heroBanner">
          <div class="hb-title-group">
            <h2>
              <span class="hb-badge" id="heroBadge">ANIMA #01</span>
              <span id="heroTitle">Typography (Master Kinetic Suite)</span>
            </h2>
            <p id="heroDefinition">Master typographic motion engine comprising ${TYPOGRAPHY_30_PRESETS.length} distinct kinetic treatments & stylizations (29 Motion Physics Engines + 8 High-Impact Editorial Treatments), 63 font JSON profiles, subpixel masking, and 60fps Remotion math.</p>
          </div>
          <div class="nav-pager-btns">
            <button class="pager-btn" onclick="prevArchetype()">← Previous</button>
            <button class="pager-btn" onclick="nextArchetype()">Next →</button>
          </div>
        </div>

        <div class="trait-summary-strip" id="traitSummaryStrip">
          <div class="trait-chip-item">
            <span>TRAIT ID:</span> <strong id="summaryTraitId">trait_master_kinetic_typography_suite</strong>
          </div>
          <div class="trait-chip-item">
            <span>CHANNELS:</span> <strong id="summaryChannels">opacity, filter.blur, translateY, scale, rotateX</strong>
          </div>
          <div class="trait-chip-item">
            <span>TOTAL ASSETS:</span> <strong id="summaryAssetCount" style="color:var(--accent-cyan);">${TYPOGRAPHY_30_PRESETS.length} Live Presets</strong>
          </div>
        </div>

        <div class="cards-grid" id="activeArchetypeGrid">
          <!-- Rendered dynamically -->
        </div>
      </div>

      <!-- MODE 2: SEMANTIC ROUTER & CLASSIFIER VIEW -->
      <div id="viewRouter" style="display: none;" class="router-container">
        
        <div class="router-card">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div>
              <h2 style="font-size: 20px; font-weight: 800;">🧠 Semantic Archetype Router & Multi-Note Classifier</h2>
              <p style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">Evaluates any spoken transcript or statement against all 50 note types, resolves compound multi-archetype fusions, and routes to exact visual assets.</p>
            </div>
            <span class="compound-pill">⚡ REAL-TIME 60 FPS DISPATCHER</span>
          </div>

          <div class="router-input-wrapper">
            <textarea id="routerInput" class="router-textarea" placeholder="Type or paste any statement (e.g. 'Companies like Google, Instagram, and Tesla grew 40% in revenue from $10,000 to $50,000...')" oninput="processStatementInput(this.value)"></textarea>
            
            <div style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">QUICK LOAD TEST STATEMENTS:</div>
            <div class="quick-preset-chips">
              <button class="q-chip" onclick="loadSamplePrompt(1)">🏢 Tech Brands & Micro-Assets</button>
              <button class="q-chip" onclick="loadSamplePrompt(2)">📈 Revenue $10k to $50k Trajectory</button>
              <button class="q-chip" onclick="loadSamplePrompt(3)">🔄 Before & After 70h Transformation</button>
              <button class="q-chip" onclick="loadSamplePrompt(4)">⚙️ Customer Onboarding Pipeline</button>
              <button class="q-chip" onclick="loadSamplePrompt(5)">🗺️ Geographic Lagos to London Expansion</button>
              <button class="q-chip" onclick="loadSamplePrompt(6)">⚛️ Atomic Compounding Flywheel Loop</button>
              <button class="q-chip" onclick="loadSamplePrompt(7)">👥 Founders Growth vs Focus Setup</button>
              <button class="q-chip" onclick="loadSamplePrompt(8)">🛠️ Concrete Utility Tools & Hardware</button>
            </div>
          </div>
        </div>

        <!-- ROUTING RESULTS GRID -->
        <div class="router-results-grid">
          
          <!-- LEFT: DETECTION RADAR & SIGNALS -->
          <div class="radar-panel">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 13px; font-weight: 800; color: #fff;">🏷️ PRIMARY ARCHETYPE IDENTIFIED</span>
              <span id="routerConfidenceTag" style="font-family: var(--font-mono); font-size: 11px; color: var(--accent-emerald); font-weight: 800;">98% CONFIDENCE</span>
            </div>

            <div class="primary-signal-box" id="primarySignalBox">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="card-badge" id="resPrimaryBadge" style="background:var(--accent-cyan); color:#000;">ANIMA #02</span>
                <span id="resPrimaryCategory" style="font-family: var(--font-mono); font-size: 11px; color: var(--accent-cyan); font-weight: 800;">ARTIFACTS CATEGORY</span>
              </div>
              <h3 id="resPrimaryTitle" style="font-size: 18px; font-weight: 900; color:#fff;">Micro Asset</h3>
              <p id="resPrimaryReason" style="font-size: 12px; color: var(--text-secondary);">Detected recognizable brand/company entity token(s): Google, Instagram, Tesla</p>
              
              <div class="confidence-meter">
                <div class="confidence-fill" id="resConfidenceFill"></div>
              </div>
            </div>

            <!-- INTERCONNECTED COMPOUND ARCHETYPES -->
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <span style="font-size: 12px; font-weight: 800; color: #fff;">🔗 INTERCONNECTED MULTI-ARCHETYPE FUSIONS</span>
              <div id="secondarySignalsContainer" style="display: flex; flex-direction: column; gap: 6px;">
                <!-- Populated dynamically -->
              </div>
            </div>

            <!-- EXTRACTED ENTITIES RADAR -->
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <span style="font-size: 12px; font-weight: 800; color: #fff;">🔍 EXTRACTED LINGUISTIC SIGNALS</span>
              <div id="extractedEntitiesBox" style="background: #000; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 12px; font-size: 12px;">
                <!-- Populated dynamically -->
              </div>
            </div>

            <!-- LAYER BLUEPRINT -->
            <div style="background: rgba(124,58,237,0.1); border: 1px solid rgba(124,58,237,0.3); border-radius: 12px; padding: 14px; font-family: var(--font-mono); font-size: 11px; display: flex; flex-direction: column; gap: 6px;">
              <span style="color: #c084fc; font-weight: 800;">📐 3D COMPOSITION LAYER ARCHITECTURE:</span>
              <div><span style="color:var(--text-muted);">Z:10 Background Asset:</span> <strong id="resZ10" style="color:#fff;">Brand Vector Logo Layer</strong></div>
              <div><span style="color:var(--text-muted);">Z:20 Subject Plane:</span> <strong style="color:#fff;">Matted Talking Head (Scalp Clearance: 14.79%)</strong></div>
              <div><span style="color:var(--text-muted);">Z:30 Kinetic Text:</span> <strong id="resZ30" style="color:#fff;">Staggered Stencil Number Stack (60fps)</strong></div>
              <div><span style="color:var(--text-muted);">Acoustic Pan & Cutoff:</span> <strong id="resAudio" style="color:#38bdf8;">HUD Optical Ping (18,500Hz)</strong></div>
            </div>

          </div>

          <!-- RIGHT: LIVE RENDERED PREVIEW STAGE FOR ROUTED ARCHETYPE -->
          <div class="radar-panel" style="display: flex; flex-direction: column; gap: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 13px; font-weight: 800; color: #fff;">📱 LIVE ANIMATION PREVIEW STAGE</span>
              <button class="inspect-btn" onclick="jumpToRoutedArchetype()">🚀 Open Full Suite</button>
            </div>
            
            <div class="preview-stage" id="routerLiveStage" style="height: 380px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.15);">
              <!-- Rendered dynamically -->
            </div>

            <div style="font-family: var(--font-mono); font-size: 11px; color: var(--text-secondary); display: flex; justify-content: space-between;">
              <span id="routerStagePreset">Preset: MICRO #01 (Bézier Kinetic Spring Snap)</span>
              <span>60 FPS Hardware-Accelerated</span>
            </div>
          </div>

        </div>

      </div>

    </main>
  </div>

  <script>
    const ALL_ARCHETYPES = ${JSON.stringify(ALL_50_ARCHETYPES_DATA)};
    let activeArchetypeId = 1;
    let currentMode = "suites";
    let lastRoutedArchetypeId = 2;

    const SAMPLE_PROMPTS = [
      "",
      "Companies like Google, Instagram, and Tesla dominate the tech landscape.",
      "Revenue went from $10,000 to $50,000 in less than sixty days.",
      "Before the automated system, we were working 70 hours a week. After the system, only 10.",
      "Customer signs up -> onboarding -> data processing -> result delivered.",
      "We expanded our engineering team from Lagos to London.",
      "Growth doesn't come from doing more things. It comes from doing the right things repeatedly.",
      "Most founders don't have a growth problem; they have a focus problem.",
      "and new tools."
    ];

    function switchMainMode(mode) {
      currentMode = mode;
      document.getElementById('tabSuites').classList.toggle('active', mode === 'suites');
      document.getElementById('tabRouter').classList.toggle('active', mode === 'router');
      document.getElementById('viewSuites').style.display = (mode === 'suites') ? 'flex' : 'none';
      document.getElementById('viewRouter').style.display = (mode === 'router') ? 'flex' : 'none';
      document.getElementById('sidebarContainer').style.display = (mode === 'suites') ? 'flex' : 'none';

      if (mode === 'router') {
        processStatementInput(document.getElementById('routerInput').value || SAMPLE_PROMPTS[1]);
      }
    }

    function openArchetypePage(id) {
      if (currentMode !== 'suites') switchMainMode('suites');
      activeArchetypeId = id;
      const arch = ALL_ARCHETYPES.find(a => a.id === id);
      if (!arch) return;

      document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.toggle('selected', parseInt(item.getAttribute('data-id')) === id);
      });

      document.getElementById('heroBadge').innerText = arch.badge;
      document.getElementById('heroTitle').innerText = arch.name;
      document.getElementById('heroDefinition').innerText = arch.definition;
      document.getElementById('summaryTraitId').innerText = arch.traitId;
      document.getElementById('summaryChannels').innerText = arch.channels;
      document.getElementById('summaryAssetCount').innerText = arch.variants.length + ' Live Visual Assets';

      const isTypoSuite = id === 1;
      const animCount = arch.variants.filter(v => v.type !== 'treatment').length;
      const treatCount = arch.variants.filter(v => v.type === 'treatment').length;

      let subfilterHtml = '';
      if (isTypoSuite) {
        subfilterHtml = \`
          <div class="typo-subfilter-bar" style="grid-column: 1 / -1; display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
            <button class="filter-btn active" onclick="filterTypoVariants('all')" id="typoFilterAll">⬛ All (\${arch.variants.length})</button>
            <button class="filter-btn" onclick="filterTypoVariants('animation')" id="typoFilterAnimation">▶ Animation (\${animCount})</button>
            <button class="filter-btn" onclick="filterTypoVariants('treatment')" id="typoFilterTreatment">◈ Treatment (\${treatCount})</button>
          </div>
        \`;
      }

      const grid = document.getElementById('activeArchetypeGrid');
      grid.innerHTML = subfilterHtml + arch.variants.map((v) => {
        const isTreatment = v.type === 'treatment';
        const tagPill = isTypoSuite
          ? \`<span class="tag-pill \${isTreatment ? 'tag-treatment' : 'tag-animation'}">\${isTreatment ? '◈ Treatment' : '▶ Animation'}</span>\`
          : '';
        const usageNoteHtml = v.usageNote
          ? \`<div style="margin-top:10px; padding:8px 10px; background:rgba(192,132,252,0.1); border:1px solid rgba(192,132,252,0.3); border-radius:6px; color:#e9d5ff; font-size:11px;">⚠️ <strong>Usage Note:</strong> \${v.usageNote}</div>\`
          : '';

        return \`
        <div class="card" id="card-variant-\${v.id}" data-type="\${v.type || 'animation'}">
          <div class="card-header">
            <div class="card-title-group">
              <span class="card-badge">\${v.badge}</span>
              <span class="card-title">\${v.name}</span>
              \${tagPill}
            </div>
            <div class="header-actions">
              <button class="inspect-btn" onclick="toggleDrawer(this)">🔍 Trait</button>
              <button class="replay-btn" onclick="replayCard(this)">↺ Replay</button>
            </div>
          </div>
          <div class="preview-stage" style="padding:\${id === 1 ? '0' : '24px'};">
            \${v.html}
          </div>
          <div class="trait-drawer">
            <div><span class="drawer-tag">TRAIT ID</span> <code>\${v.traitId}</code></div>
            <div class="drawer-grid">
              <div><strong>Concern:</strong> \${v.concern}</div>
              <div><strong>Target Scope:</strong> \${v.targetScope}</div>
              <div><strong>Channels:</strong> <code>\${v.channels}</code></div>
              <div><strong>Conflicts:</strong> <code>\${v.conflicts}</code></div>
            </div>
            <div class="drawer-code">FrameExpression: \${v.frameExpression}</div>
            \${usageNoteHtml}
          </div>
          <div class="card-footer">
            <span>\${v.footerSpec}</span>
            <span>\${v.slug}</span>
          </div>
        </div>
      \`;
      }).join('');

      document.getElementById('animaMainContainer').scrollTo({ top: 0, behavior: 'smooth' });

      if (isTypoSuite) {
        setTimeout(() => {
          initTypoChromaticTypewriter();
          initTypo3DMetallicCounter();
          initTypoAppleGaussianChrome();
          initTypoAppleBounceSequence();
        }, 50);
      }
    }

    function filterTypoVariants(type) {
      const cards = document.querySelectorAll('#activeArchetypeGrid .card');
      cards.forEach(card => {
        if (type === 'all') {
          card.style.display = 'flex';
        } else {
          const cardType = card.getAttribute('data-type') || 'animation';
          if (cardType === type) card.style.display = 'flex';
          else card.style.display = 'none';
        }
      });
      document.querySelectorAll('.typo-subfilter-bar .filter-btn').forEach(btn => btn.classList.remove('active', 'treatment-active'));
      const activeBtn = document.getElementById('typoFilter' + type.charAt(0).toUpperCase() + type.slice(1));
      if (activeBtn) {
        if (type === 'treatment') activeBtn.classList.add('treatment-active');
        else activeBtn.classList.add('active');
      }
    }

    // Interactive scripts for dynamic Typography presets
    function initTypoChromaticTypewriter() {
      const targets = document.querySelectorAll('.typewriter-chromatic-text');
      if (!targets.length) return;
      const textToType = "I started posting as a...";
      let charIndex = 0;
      function typeNext() {
        if (charIndex < textToType.length) {
          const current = textToType.substring(0, charIndex + 1);
          targets.forEach(el => {
            el.textContent = current;
            el.setAttribute("data-text", current);
          });
          charIndex++;
          setTimeout(typeNext, 85);
        } else {
          setTimeout(() => {
            charIndex = 0;
            targets.forEach(el => {
              el.textContent = "";
              el.setAttribute("data-text", "");
            });
            setTimeout(typeNext, 500);
          }, 2200);
        }
      }
      typeNext();
    }

    function initTypo3DMetallicCounter() {
      const mains = document.querySelectorAll('.chrome-counter-main');
      const shadows = document.querySelectorAll('.chrome-counter-shadow');
      const outlines = document.querySelectorAll('.chrome-counter-outline');
      if (!mains.length) return;
      const target = 110;
      const dur = 2200;
      function animate() {
        let start = null;
        function step(ts) {
          if (!start) start = ts;
          const progress = Math.min((ts - start) / dur, 1);
          const ease = 1 - Math.pow(1 - progress, 3);
          const val = Math.floor(ease * target);
          mains.forEach(el => el.textContent = val);
          shadows.forEach(el => el.textContent = val);
          outlines.forEach(el => el.textContent = val);
          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            mains.forEach(el => el.textContent = target);
            shadows.forEach(el => el.textContent = target);
            outlines.forEach(el => el.textContent = target);
            setTimeout(() => {
              mains.forEach(el => el.textContent = '0');
              shadows.forEach(el => el.textContent = '0');
              outlines.forEach(el => el.textContent = '0');
              setTimeout(animate, 400);
            }, 1800);
          }
        }
        requestAnimationFrame(step);
      }
      animate();
    }

    function initTypoAppleGaussianChrome() {
      const stages = document.querySelectorAll('.typo-apple-gaussian-stage');
      if (!stages.length) return;
      stages.forEach(stage => {
        const chars = stage.querySelectorAll('.apple-gaussian-char');
        const stagger = 220;
        function run() {
          chars.forEach(c => c.classList.remove('lit'));
          chars.forEach((c, idx) => {
            setTimeout(() => c.classList.add('lit'), (idx + 1) * stagger);
          });
          const cycle = (chars.length + 1) * stagger + 2600;
          setTimeout(run, cycle);
        }
        run();
      });
    }

    function initTypoAppleBounceSequence() {
      const stages = document.querySelectorAll('.typo-apple-bounce-stage');
      if (!stages.length) return;
      stages.forEach(stage => {
        const words = stage.querySelectorAll('.apple-bounce-word');
        function run() {
          words.forEach(w => w.classList.remove('bounce-in'));
          void stage.offsetWidth;
          words.forEach(w => w.classList.add('bounce-in'));
          setTimeout(run, 3800);
        }
        run();
      });
    }

    function prevArchetype() {
      let nextId = activeArchetypeId - 1;
      if (nextId < 1) nextId = 50;
      openArchetypePage(nextId);
    }

    function nextArchetype() {
      let nextId = activeArchetypeId + 1;
      if (nextId > 50) nextId = 1;
      openArchetypePage(nextId);
    }

    function toggleDrawer(btn) {
      const card = btn.closest('.card');
      const drawer = card.querySelector('.trait-drawer');
      drawer.classList.toggle('open');
    }

    function replayCard(btn) {
      const card = btn.closest('.card');
      const stage = card.querySelector('.preview-stage');
      const html = stage.innerHTML;
      stage.innerHTML = '';
      setTimeout(() => {
        stage.innerHTML = html;
        if (activeArchetypeId === 1) {
          initTypoChromaticTypewriter();
          initTypo3DMetallicCounter();
          initTypoAppleGaussianChrome();
          initTypoAppleBounceSequence();
        }
      }, 20);
    }

    function jumpToEnteredSerial() {
      const val = document.getElementById('serialInput').value.trim();
      const num = parseInt(val, 10);
      if (!isNaN(num) && num >= 1 && num <= 50) {
        openArchetypePage(num);
      } else {
        alert("Please enter a serial number between 1 and 50.");
      }
    }

    function handleSerialKey(e) {
      if (e.key === 'Enter') jumpToEnteredSerial();
    }

    function filterSidebar(cat) {
      document.querySelectorAll('.c-chip').forEach(c => c.classList.toggle('active', c.getAttribute('data-cat') === cat));
      document.querySelectorAll('.sidebar-item').forEach(item => {
        const itemCat = item.getAttribute('data-cat');
        item.style.display = (cat === 'all' || itemCat === cat) ? 'flex' : 'none';
      });
    }

    // =========================================================================
    // CLIENT-SIDE REAL-TIME SEMANTIC ARCHETYPE PARSER
    // =========================================================================
    const BRAND_ENTITIES = ["google", "instagram", "tesla", "apple", "microsoft", "amazon", "meta", "facebook", "twitter", "stripe", "openai", "chatgpt", "github", "figma", "vercel", "shopify", "notion", "slack", "discord", "youtube", "tiktok", "netflix", "uber", "airbnb", "spotify"];
    const CONCRETE_TOOL_ENTITIES = ["tool", "tools", "screwdriver", "spanner", "wrench", "hammer", "pliers", "gear", "gears", "machinery", "hardware", "software", "instrument", "instruments", "engine", "calculator", "compiler", "terminal", "debugger", "workbench", "stack", "toolkit", "apparatus", "gadget"];
    const CONCEPT_ENTITIES = ["idea", "ideas", "strategy", "strategies", "focus", "vision", "clarity", "matters", "discipline", "leverage", "momentum", "principle", "principles", "mindset", "philosophy", "thesis", "priorities", "conviction"];
    const HUMAN_ROLE_ENTITIES = ["founder", "founders", "customer", "customers", "user", "users", "client", "clients", "developer", "developers", "engineer", "engineers", "designer", "designers", "creator", "creators", "leader", "leaders", "ceo", "cto", "doctor"];
    const CYCLICAL_ENTITIES = ["repeatedly", "again and again", "flywheel", "cycle", "loop", "compounding", "iteratively", "feedback loop", "recurring", "compound", "iteration"];
    const GEO_LOCATIONS = ["lagos", "london", "new york", "san francisco", "tokyo", "paris", "berlin", "singapore", "dubai", "nigeria", "uk", "usa", "europe", "africa", "asia"];
    const COMPARISON_KEYWORDS = ["versus", "vs", "compared to", "in contrast", "while", "difference between", "rather than", "instead of", "doesn't come from", "doesn't automatically", "not freedom"];
    const BEFORE_AFTER_KEYWORDS = ["before and after", "before", "after", "previously", "now", "transformed", "used to be"];
    const TIMELINE_KEYWORDS = ["first", "second", "then", "later", "eventually", "timeline", "years ago", "in 2020", "in 2024", "milestone", "decided"];
    const PROCESS_KEYWORDS = ["process", "workflow", "system", "steps", "funnel", "pipeline", "how it works", "lifecycle", "producing results"];

    function matchWordTokens(list, text) {
      return list.filter(item => new RegExp('\\\\b' + item + '\\\\b', 'i').test(text));
    }

    function routeStatement(text) {
      const lower = text.toLowerCase();
      const signals = [];

      const matchedTools = matchWordTokens(CONCRETE_TOOL_ENTITIES, text);
      const matchedBrands = matchWordTokens(BRAND_ENTITIES, text);
      const matchedCycles = matchWordTokens(CYCLICAL_ENTITIES, text);
      const matchedConcepts = matchWordTokens(CONCEPT_ENTITIES, text);
      const matchedRoles = matchWordTokens(HUMAN_ROLE_ENTITIES, text);
      const matchedGeos = matchWordTokens(GEO_LOCATIONS, text);
      const matchedComp = matchWordTokens(COMPARISON_KEYWORDS, text);

      const moneyMatch = text.match(/\\$[\\d,]+(\\.\\d+)?(\\s*(k|m|b|thousand|million|billion|a month|per month))?/gi);
      const percentMatch = text.match(/\\b\\d+(\\.\\d+)?%/g) || (lower.includes("percent") ? ["percentage"] : []);

      if (matchedTools.length > 0) {
        signals.push({
          id: 2, serial: "02", name: "Micro Asset (Concrete Tool / Utility Icon)", cat: "ARTIFACTS", conf: 0.96,
          reason: "Concrete physical/digital utility instrument: " + matchedTools.join(', '),
          preset: "MICRO #01 (Bézier Kinetic Spring Snap)", audio: "HUD Optical Ping & Ratchet (Z:10, 1400Hz)"
        });
      } else if (matchedBrands.length > 0) {
        signals.push({
          id: 2, serial: "02", name: "Micro Asset (Brand Logo)", cat: "ARTIFACTS", conf: 0.96,
          reason: "Brand/entity token(s): " + matchedBrands.join(', '),
          preset: "MICRO #01 (Bézier Kinetic Spring Snap)", audio: "HUD Optical Ping (Z:10, 1400Hz)"
        });
      }

      if (matchedCycles.length > 0) {
        signals.push({
          id: 49, serial: "49", name: "Loop / Cycle (Compounding Flywheel)", cat: "PROCESSES", conf: 0.98,
          reason: "Compounding cadence & feedback loop: " + matchedCycles.join(', '),
          preset: "LOOP #01 (Compounding Orbital Flywheel)", audio: "Harmonic Sub-Bass Flywheel Drone (Z:10, 1200Hz)"
        });
      }

      if (matchedConcepts.length > 0) {
        signals.push({
          id: 23, serial: "23", name: "Concept Visualization", cat: "COMMUNICATION", conf: 0.93,
          reason: "Abstract principle / strategic metaphor: " + matchedConcepts.join(', '),
          preset: "CONCEPT #01 (Precision Focus Target HUD)", audio: "HUD Optical Scan Ping (Z:10, 1400Hz)"
        });
      }

      if (matchedRoles.length > 0) {
        signals.push({
          id: 15, serial: "15", name: "Person / Character Asset", cat: "ARTIFACTS", conf: 0.94,
          reason: "Human archetype / persona role: " + matchedRoles.join(', '),
          preset: "PERSON #01 (Vintage Tech Founders Trio / Avatar)", audio: "Mid-Field Vocal Warmth EQ (Z:20, 6500Hz)"
        });
      }

      const hasList = /\\b(1\\.|2\\.|3\\.|first|second|third|one|two|three)\\b/i.test(text) || (text.split(',').length >= 3);
      if (hasList) {
        signals.push({
          id: 3, serial: "03", name: "List / Enumeration", cat: "STRUCTURES", conf: 0.88,
          reason: "Sequential or comma-delimited multi-item list",
          preset: "LIST #01 (Staggered Stencil Number Stack)", audio: "Ratchet Mechanized Clicks (Z:30, 18500Hz)"
        });
      }

      if (lower.includes("went from") || lower.includes("grew from") || lower.includes("trend") || (moneyMatch && moneyMatch.length >= 2)) {
        signals.push({
          id: 4, serial: "04", name: "Chart / Graph", cat: "METRICS", conf: 0.90,
          reason: "Quantitative trajectory / trend transition",
          preset: "CHART #01 (SVG Interpolated Neon Area Spline)", audio: "Swoosh Rise & Filter Open (Z:30, 14000Hz)"
        });
      }

      if (moneyMatch && moneyMatch.length > 0) {
        signals.push({
          id: 5, serial: "05", name: "Number / Statistic", cat: "METRICS", conf: 0.96,
          reason: "Financial metric: " + moneyMatch.join(', '),
          preset: "STAT #01 (Giant 3D Punch-In Figure)", audio: "Sub-Bass Heavy Impact Climax (Z:30, 18500Hz)"
        });
      }

      if (percentMatch && percentMatch.length > 0) {
        signals.push({
          id: 6, serial: "06", name: "Percentage", cat: "METRICS", conf: 0.98,
          reason: "Percentage metric: " + percentMatch.join(', '),
          preset: "PERCENT #01 (Polar Arc Radial Gauge)", audio: "High-Freq Electronic Chirp (Z:30, 16000Hz)"
        });
      }

      if (matchedComp.length > 0) {
        signals.push({
          id: 7, serial: "07", name: "Comparison", cat: "TRANSFORMATIONS", conf: 0.92,
          reason: "Comparative contrast: " + matchedComp.join(', '),
          preset: "COMP #01 (Split-Screen Dual Benchmark Pane)", audio: "Stereo Split Left-Right Ping (Pan: -0.75 / +0.75)"
        });
      }

      const matchedBA = BEFORE_AFTER_KEYWORDS.filter(k => lower.includes(k));
      if (matchedBA.length > 0) {
        signals.push({
          id: 8, serial: "08", name: "Before / After", cat: "TRANSFORMATIONS", conf: 0.94,
          reason: "State transformation: " + matchedBA.join(', '),
          preset: "BEFORE_AFTER #01 (Curtain Wipe State Morph)", audio: "Whoosh Curtain Slide Transition (Z:20, 8000Hz)"
        });
      }

      const matchedTL = TIMELINE_KEYWORDS.filter(k => lower.includes(k));
      if (matchedTL.length >= 2 || lower.includes("timeline")) {
        signals.push({
          id: 9, serial: "09", name: "Timeline / Sequence", cat: "PROCESSES", conf: 0.89,
          reason: "Chronological sequence milestones: " + matchedTL.join(', '),
          preset: "TIMELINE #01 (Horizontal Step Progress Track)", audio: "Clockwork Rhythm Ticks (120 BPM)"
        });
      }

      const matchedPR = PROCESS_KEYWORDS.filter(k => lower.includes(k)) || text.includes("->") || text.includes("→");
      if (matchedPR && (matchedPR.length > 0 || text.includes("->") || text.includes("→"))) {
        signals.push({
          id: 10, serial: "10", name: "Process / Workflow", cat: "PROCESSES", conf: 0.91,
          reason: "Step-by-step system pipeline",
          preset: "WORKFLOW #01 (Stage Process Node Flowchart)", audio: "Conveyor Ratchet Pulses (Z:20, 6500Hz)"
        });
      }

      if (matchedGeos.length > 0) {
        signals.push({
          id: 14, serial: "14", name: "Geographic / Map Asset", cat: "ARTIFACTS", conf: 0.93,
          reason: "Geographic locations: " + matchedGeos.join(', '),
          preset: "MAP #01 (Transatlantic Telemetry Arc)", audio: "Radar Sonar Ping (Z:10, 2200Hz)"
        });
      }

      if (signals.length === 0) {
        signals.push({
          id: 1, serial: "01", name: "Typography (Master Suite)", cat: "TYPOGRAPHY", conf: 0.99,
          reason: "Direct verbal statement requiring pure typographic rhythm & focal emphasis",
          preset: "TYPO #01 (Apple Pro Display Hero Revealer)", audio: "Subpixel Keystroke Click (Z:30, 18500Hz)"
        });
      }

      signals.sort((a, b) => b.conf - a.conf);

      return {
        primary: signals[0],
        secondaries: signals.slice(1),
        entities: { brands: matchedBrands, tools: matchedTools, concepts: matchedConcepts, geos: matchedGeos, money: moneyMatch || [], percent: percentMatch || [] }
      };
    }

    function processStatementInput(text) {
      if (!text || text.trim() === '') text = SAMPLE_PROMPTS[1];
      const res = routeStatement(text);
      const p = res.primary;
      lastRoutedArchetypeId = p.id;

      // Update primary UI
      document.getElementById('resPrimaryBadge').innerText = 'ANIMA #' + p.serial;
      document.getElementById('resPrimaryCategory').innerText = p.cat + ' CATEGORY';
      document.getElementById('resPrimaryTitle').innerText = p.name;
      document.getElementById('resPrimaryReason').innerText = p.reason;
      document.getElementById('routerConfidenceTag').innerText = Math.round(p.conf * 100) + '% CONFIDENCE';
      document.getElementById('resConfidenceFill').style.width = Math.round(p.conf * 100) + '%';

      // Update secondaries
      const secContainer = document.getElementById('secondarySignalsContainer');
      if (res.secondaries.length === 0) {
        secContainer.innerHTML = '<span style="font-size:11px; color:var(--text-muted); font-family:var(--font-mono);">No secondary note types detected (Pure Single Treatment).</span>';
      } else {
        secContainer.innerHTML = res.secondaries.map(s => \`
          <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-subtle); border-radius:8px; padding:8px 12px; display:flex; justify-content:space-between; align-items:center;">
            <span class="compound-pill">ANIMA #\${s.serial} \${s.name}</span>
            <span style="font-family:var(--font-mono); font-size:10px; color:var(--text-secondary);">\${s.reason}</span>
          </div>
        \`).join('');
      }

      // Update extracted entities
      const entBox = document.getElementById('extractedEntitiesBox');
      let entHtml = '';
      if (res.entities.tools && res.entities.tools.length) entHtml += '<div><span style="color:var(--accent-cyan);">Concrete Tools:</span> ' + res.entities.tools.map(t => '<span class="entity-tag">' + t + '</span>').join('') + '</div>';
      if (res.entities.brands.length) entHtml += '<div style="margin-top:4px;"><span style="color:var(--accent-cyan);">Brands:</span> ' + res.entities.brands.map(b => '<span class="entity-tag">' + b + '</span>').join('') + '</div>';
      if (res.entities.money.length) entHtml += '<div style="margin-top:4px;"><span style="color:var(--accent-emerald);">Financial Figures:</span> ' + res.entities.money.map(m => '<span class="entity-tag">' + m + '</span>').join('') + '</div>';
      if (res.entities.percent.length) entHtml += '<div style="margin-top:4px;"><span style="color:var(--accent-amber);">Percentages:</span> ' + res.entities.percent.map(pr => '<span class="entity-tag">' + pr + '</span>').join('') + '</div>';
      if (res.entities.concepts && res.entities.concepts.length) entHtml += '<div style="margin-top:4px;"><span style="color:var(--accent-purple);">Concepts:</span> ' + res.entities.concepts.map(c => '<span class="entity-tag">' + c + '</span>').join('') + '</div>';
      if (!entHtml) entHtml = '<span style="color:var(--text-muted); font-family:var(--font-mono);">No named entity tokens detected (Semantic Grammar Match).</span>';
      entBox.innerHTML = entHtml;

      // Update Layer blueprint
      document.getElementById('resZ10').innerText = p.id === 2 ? 'Vector Brand / Tooling Layer (' + (res.entities.tools.join(', ') || res.entities.brands.join(', ') || 'Asset') + ')' :
                                                    p.id === 14 ? 'Transatlantic Map Arc Layer' :
                                                    p.id === 49 ? 'Atomic Flywheel Orbital Mesh' : 'Standard Dark Backdrop';
      document.getElementById('resZ30').innerText = p.preset;
      document.getElementById('resAudio').innerText = p.audio;

      // Update Live Preview Stage
      const arch = ALL_ARCHETYPES.find(a => a.id === p.id) || ALL_ARCHETYPES[0];
      const v = arch.variants[0];
      const stage = document.getElementById('routerLiveStage');
      stage.innerHTML = v.html;
      document.getElementById('routerStagePreset').innerText = 'Active Live Preset: ' + v.badge + ' (' + v.name + ')';
    }

    function loadSamplePrompt(idx) {
      const text = SAMPLE_PROMPTS[idx];
      document.getElementById('routerInput').value = text;
      processStatementInput(text);
    }

    function jumpToRoutedArchetype() {
      openArchetypePage(lastRoutedArchetypeId);
    }

    // Initialize with #02 Micro Asset so it shows immediately!
    openArchetypePage(2);
  </script>
</body>
</html>
`;

fs.writeFileSync(outputStudioPath, htmlOutput, "utf-8");
fs.writeFileSync(outputPreviewPath, htmlOutput, "utf-8");
console.log(`[ANIMA_BUILDER] Successfully built ANIMA Studio with 15 advanced Micro Asset presets:`);
console.log(` -> ${outputStudioPath}`);
console.log(` -> ${outputPreviewPath}`);
