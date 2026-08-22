/**
 * PROMETHEUS CORE — ANIMA #04 MASTER VECTOR TRAJECTORY CHART SUITE
 * Unified authoritative chart presets and progressive reveal CSS.
 */

export interface ChartPreset {
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
}

export const CHART_GRAPH_8_PRESETS: ChartPreset[] = [
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
    html: `<div class="chart-stage chart-prog-stage chart-c5-stage"><svg class="chart-svg-main" viewBox="0 0 320 180" fill="none"><defs><linearGradient id="crashRedGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ef4444" stop-opacity="0.9"/><stop offset="50%" stop-color="#b91c1c" stop-opacity="0.5"/><stop offset="100%" stop-color="#450a0a" stop-opacity="0.2"/></linearGradient><pattern id="crashGridPat" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="0.7"/></pattern><clipPath id="clipProg5"><rect class="prog-clip-rect-5" x="0" y="0" width="0" height="180"/></clipPath><mask id="gridFadeMask"><radialGradient id="gridFadeGrad" cx="50%" cy="50%" r="50%"><stop offset="30%" stop-color="#fff"/><stop offset="90%" stop-color="#000"/></radialGradient><rect width="320" height="180" fill="url(#gridFadeGrad)"/></mask></defs><rect x="0" y="0" width="320" height="180" fill="url(#crashGridPat)" mask="url(#gridFadeMask)"/><g clip-path="url(#clipProg5)"><path d="M 10 20 L 35 50 L 50 30 L 80 45 L 105 60 L 125 45 L 150 95 L 165 110 L 175 95 L 190 120 L 215 110 L 235 130 L 260 125 L 275 140 L 285 130 L 310 170 L 10 170 Z" fill="url(#crashRedGrad)"/><path class="crash-stroke-line crash-stroke-5" d="M 10 20 L 35 50 L 50 30 L 80 45 L 105 60 L 125 45 L 150 95 L 165 110 L 175 95 L 190 120 L 215 110 L 235 130 L 260 125 L 275 140 L 285 130 L 310 170" stroke="#fca5a5" stroke-width="3.5" stroke-linejoin="round"/></g></svg><div class="crash-drawdown-badge c5-badge">-68.4% CRASH</div></div>`
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

export const CHART_CUSTOM_CSS = `
/* ========================================================================= */
/* ANIMA #04 CHART / GRAPH SUITE (PROGRESSIVE TEMPORAL REVEAL ENGINES)       */
/* ========================================================================= */
.chart-stage {
  display: flex; align-items: center; justify-content: center;
  width: 100%; height: 100%; position: relative; overflow: visible;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  mask-image: radial-gradient(ellipse 80% 75% at 50% 50%, #000 35%, rgba(0,0,0,0.6) 70%, transparent 100%);
  -webkit-mask-image: radial-gradient(ellipse 80% 75% at 50% 50%, #000 35%, rgba(0,0,0,0.6) 70%, transparent 100%);
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

export function resolveAnimaChartPreset(
  valence: "positive" | "negative" | "cycle",
  seedRng: () => number
): ChartPreset {
  let candidates = CHART_GRAPH_8_PRESETS;
  if (valence === "negative") {
    candidates = CHART_GRAPH_8_PRESETS.filter(p => 
      p.name.includes("Bearish") || p.name.includes("Crimson") || p.name.includes("Downward") || p.name.includes("Segmented")
    );
  } else if (valence === "cycle") {
    candidates = CHART_GRAPH_8_PRESETS.filter(p => p.name.includes("Volatility") || p.name.includes("Sine"));
  } else {
    candidates = CHART_GRAPH_8_PRESETS.filter(p => 
      p.name.includes("Bullish") || p.name.includes("Parabolic") || p.name.includes("Mountain") || p.name.includes("Spectrum") || p.name.includes("Telemetry")
    );
  }
  if (candidates.length === 0) candidates = CHART_GRAPH_8_PRESETS;
  const idx = Math.floor(seedRng() * candidates.length);
  return candidates[idx];
}
