import fs from "fs";
import path from "path";

const repoRoot = "/home/ec2-user/PROMETHEUS-CORE-BACKEND";
const outputHtmlPath = path.join(repoRoot, "Yuan Prometheus Screenshots/prometheus_animations_preview/visual_archetypes.html");
const studioMirrorHtmlPath = path.join(repoRoot, "docs/mini_run_studio/visual_archetypes.html");

interface VisualArchetype {
  id: number;
  badge: string;
  name: string;
  category: "metrics" | "structures" | "processes" | "transformations" | "artifacts" | "communication";
  categoryLabel: string;
  definition: string;
  examplePrompt: string;
  traitId: string;
  concern: string;
  targetScope: string;
  channels: string;
  conflicts: string;
  frameExpression: string;
  svgIcon: string;
  renderHtml: string;
  customCss: string;
  footerNote: string;
  slug: string;
}

const ARCHETYPES: VisualArchetype[] = [
  // 02. Micro Asset
  {
    id: 2,
    badge: "ARCHETYPE #02",
    name: "Micro Asset",
    category: "artifacts",
    categoryLabel: "Artifacts & Entities",
    definition: "A recognizable entity with a readily available icon/logo. “Instagram”, “Google”, “Tesla” → logo/icon.",
    examplePrompt: "“We integrated our pipeline directly with Instagram, Google, and Tesla telemetry.”",
    traitId: "trait_micro_asset_icon_pulse",
    concern: "EntityRecognition",
    targetScope: "icon_badge",
    channels: "scale, opacity, box-shadow",
    conflicts: "full_screen_macro_video",
    frameExpression: "scale = 1.0 + 0.08 * sin(frame * 0.12)",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>`,
    renderHtml: `
      <div class="micro-asset-cluster">
        <div class="micro-icon-badge ig-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
          <span>Instagram</span>
        </div>
        <div class="micro-icon-badge g-badge">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
          <span>Google</span>
        </div>
        <div class="micro-icon-badge ts-badge">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5l6 1.8v3.2l-6-1.8-6 1.8V6.3l6-1.8zm0-2.5L2 5.5v4.2l10-2.8 10 2.8V5.5L12 2zM12 9.5l6 1.8v10.2l-6-2.5-6 2.5V11.3l6-1.8z"/></svg>
          <span>Tesla</span>
        </div>
      </div>
    `,
    customCss: `
      .micro-asset-cluster { display: flex; gap: 14px; align-items: center; justify-content: center; width: 100%; }
      .micro-icon-badge { display: flex; align-items: center; gap: 10px; padding: 10px 18px; border-radius: 12px; font-weight: 700; font-size: 14px; border: 1px solid rgba(255,255,255,0.15); backdrop-filter: blur(12px); animation: micro-pop 2.5s infinite ease-in-out; }
      .ig-badge { background: linear-gradient(135deg, rgba(225,48,108,0.2), rgba(253,29,29,0.1)); color: #f43f5e; box-shadow: 0 0 20px rgba(225,48,108,0.3); }
      .g-badge { background: linear-gradient(135deg, rgba(66,133,244,0.2), rgba(52,168,83,0.1)); color: #38bdf8; box-shadow: 0 0 20px rgba(66,133,244,0.3); animation-delay: 0.2s; }
      .ts-badge { background: linear-gradient(135deg, rgba(232,33,39,0.2), rgba(255,255,255,0.05)); color: #ffffff; box-shadow: 0 0 20px rgba(232,33,39,0.3); animation-delay: 0.4s; }
      .micro-icon-badge svg { width: 20px; height: 20px; }
      @keyframes micro-pop { 0%, 100% { transform: scale(1) translateY(0); } 50% { transform: scale(1.06) translateY(-4px); } }
    `,
    footerNote: "Dynamic SVG Icon • Kinetic Hover & Ambient Pulse",
    slug: "micro-asset"
  },

  // 03. List / Enumeration
  {
    id: 3,
    badge: "ARCHETYPE #03",
    name: "List / Enumeration",
    category: "structures",
    categoryLabel: "Structures & Lists",
    definition: "Speaker explicitly gives multiple items. “One, two, three…” → animated numbered list.",
    examplePrompt: "“There are three non-negotiables: speed, precision, and retention.”",
    traitId: "trait_staggered_list_reveal",
    concern: "HierarchicalEnumeration",
    targetScope: "list_items",
    channels: "translateY, opacity, scaleX",
    conflicts: "None",
    frameExpression: "itemOpacity[i] = clamp(0, 1, (frame - i * 8) / 10)",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
    renderHtml: `
      <div class="enum-list-box">
        <div class="enum-item item-1"><span class="enum-num">01</span><span class="enum-label">Ultra-Low Latency Ingestion</span><span class="enum-check">✓</span></div>
        <div class="enum-item item-2"><span class="enum-num">02</span><span class="enum-label">Deterministic Kinetic Layouts</span><span class="enum-check">✓</span></div>
        <div class="enum-item item-3"><span class="enum-num">03</span><span class="enum-label">Spatial Multi-Layer Stacking</span><span class="enum-check">✓</span></div>
      </div>
    `,
    customCss: `
      .enum-list-box { display: flex; flex-direction: column; gap: 10px; width: 85%; }
      .enum-item { display: flex; align-items: center; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); padding: 10px 16px; border-radius: 10px; font-weight: 600; font-size: 14px; animation: enum-slide 3s infinite var(--ease-apple); }
      .enum-num { font-family: monospace; font-size: 13px; font-weight: 800; color: var(--accent-cyan); background: rgba(6,182,212,0.15); padding: 2px 8px; border-radius: 6px; margin-right: 12px; }
      .enum-label { flex: 1; color: #fff; }
      .enum-check { color: #10b981; font-weight: 800; }
      .item-1 { animation-delay: 0.1s; }
      .item-2 { animation-delay: 0.25s; }
      .item-3 { animation-delay: 0.4s; }
      @keyframes enum-slide { 0% { opacity: 0; transform: translateX(-16px); } 20%, 80% { opacity: 1; transform: translateX(0); } 100% { opacity: 0; transform: translateX(16px); } }
    `,
    footerNote: "Staggered Stencil Numbers • Sequential Reveal",
    slug: "list-enumeration"
  },

  // 04. Chart / Graph
  {
    id: 4,
    badge: "ARCHETYPE #04",
    name: "Chart / Graph",
    category: "metrics",
    categoryLabel: "Metrics & Quantitative",
    definition: "Quantitative relationship, trend, comparison, or distribution. “Revenue went from $10k to $50k” → animated graph.",
    examplePrompt: "“Our monthly recurring revenue went from ten thousand to fifty thousand.”",
    traitId: "trait_svg_path_chart_draw",
    concern: "DataVisualization",
    targetScope: "svg_path",
    channels: "strokeDashoffset, opacity, scaleY",
    conflicts: "None",
    frameExpression: "strokeOffset = max(0, 400 - (frame / 30) * 400)",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>`,
    renderHtml: `
      <div class="chart-graph-box">
        <div class="chart-header">
          <span class="chart-title">REVENUE TRAJECTORY</span>
          <span class="chart-badge">+400% ARR</span>
        </div>
        <svg class="chart-svg" viewBox="0 0 320 120">
          <defs>
            <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.35"/>
              <stop offset="100%" stop-color="#06b6d4" stop-opacity="0.0"/>
            </linearGradient>
          </defs>
          <path class="chart-area" d="M 10 100 Q 80 85 150 60 T 310 20 L 310 110 L 10 110 Z" fill="url(#chartGlow)"/>
          <path class="chart-line" d="M 10 100 Q 80 85 150 60 T 310 20" fill="none" stroke="#06b6d4" stroke-width="4" stroke-linecap="round"/>
          <circle class="chart-dot" cx="310" cy="20" r="6" fill="#ffffff" stroke="#06b6d4" stroke-width="3"/>
        </svg>
        <div class="chart-footer-row">
          <span>$10,000</span>
          <span style="color:#06b6d4; font-weight:800;">$50,000</span>
        </div>
      </div>
    `,
    customCss: `
      .chart-graph-box { width: 90%; background: rgba(14,14,20,0.8); border: 1px solid rgba(6,182,212,0.3); border-radius: 14px; padding: 18px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
      .chart-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-family: monospace; font-size: 11px; }
      .chart-title { color: #94a3b8; font-weight: 700; }
      .chart-badge { background: #06b6d4; color: #000; font-weight: 900; padding: 2px 6px; border-radius: 4px; }
      .chart-svg { width: 100%; height: 110px; overflow: visible; }
      .chart-line { stroke-dasharray: 400; stroke-dashoffset: 400; animation: draw-chart 3s infinite var(--ease-apple); }
      .chart-area { opacity: 0; animation: fade-area 3s infinite var(--ease-apple); }
      .chart-dot { animation: dot-pop 3s infinite var(--ease-apple); }
      .chart-footer-row { display: flex; justify-content: space-between; font-family: monospace; font-size: 12px; color: #64748b; margin-top: 4px; }
      @keyframes draw-chart { 0% { stroke-dashoffset: 400; } 40%, 80% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: 400; } }
      @keyframes fade-area { 0% { opacity: 0; } 30%, 80% { opacity: 1; } 100% { opacity: 0; } }
      @keyframes dot-pop { 0% { transform: scale(0); opacity: 0; } 40%, 80% { transform: scale(1); opacity: 1; } 100% { transform: scale(0); opacity: 0; } }
    `,
    footerNote: "SVG Interpolated Spline • Neon Gradient Fill Area",
    slug: "chart-graph"
  },

  // 05. Number / Statistic
  {
    id: 5,
    badge: "ARCHETYPE #05",
    name: "Number / Statistic",
    category: "metrics",
    categoryLabel: "Metrics & Quantitative",
    definition: "A standalone important numerical value. “$50,000 in revenue” → giant kinetic $50,000.",
    examplePrompt: "“We generated fifty thousand dollars in our first forty-eight hours.”",
    traitId: "trait_giant_kinetic_stat_punch",
    concern: "HighImpactStat",
    targetScope: "headline_number",
    channels: "scale, textContent, filter.blur",
    conflicts: "body_paragraph",
    frameExpression: "scale = max(1.0, 1.4 - (frame/15)*0.4)",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 22h16"/><path d="M12 2v20"/><path d="m17 7-5-5-5 5"/></svg>`,
    renderHtml: `
      <div class="kinetic-stat-hero">
        <span class="stat-prefix">TOTAL VOLUME</span>
        <div class="stat-giant-box">
          <span class="stat-symbol">$</span>
          <span class="stat-digits">50,000</span>
        </div>
        <span class="stat-sub-label">IN NET REVENUE</span>
      </div>
    `,
    customCss: `
      .kinetic-stat-hero { display: flex; flex-direction: column; align-items: center; justify-content: center; }
      .stat-prefix { font-family: monospace; font-size: 11px; letter-spacing: 0.2em; color: var(--accent-cyan); font-weight: 800; margin-bottom: 4px; }
      .stat-giant-box { display: flex; align-items: baseline; font-size: 58px; font-weight: 900; letter-spacing: -0.04em; color: #ffffff; text-shadow: 0 0 30px rgba(6,182,212,0.6); animation: stat-punch 3s infinite var(--ease-apple); }
      .stat-symbol { font-size: 38px; color: #06b6d4; margin-right: 4px; }
      .stat-sub-label { font-family: monospace; font-size: 12px; color: #94a3b8; font-weight: 700; letter-spacing: 0.1em; margin-top: 2px; }
      @keyframes stat-punch { 0% { transform: scale(0.6); opacity: 0; filter: blur(14px); } 30%, 80% { transform: scale(1); opacity: 1; filter: blur(0); } 100% { transform: scale(1.05); opacity: 0; filter: blur(10px); } }
    `,
    footerNote: "OLED Focal Glow • Sub-Pixel Kinetic Punch",
    slug: "number-statistic"
  },

  // 06. Percentage
  {
    id: 6,
    badge: "ARCHETYPE #06",
    name: "Percentage",
    category: "metrics",
    categoryLabel: "Metrics & Quantitative",
    definition: "A percentage is mentioned or implied. “Conversion increased 40%” → +40% animation.",
    examplePrompt: "“Our user conversion increased by over forty percent.”",
    traitId: "trait_radial_percentage_arc",
    concern: "DataDelta",
    targetScope: "radial_gauge",
    channels: "strokeDashoffset, counter",
    conflicts: "None",
    frameExpression: "arcPercent = min(100, (frame / 25) * 40)",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>`,
    renderHtml: `
      <div class="percentage-stage-box">
        <div class="percent-circle-wrapper">
          <svg viewBox="0 0 100 100" class="percent-svg">
            <circle cx="50" cy="50" r="42" stroke="rgba(255,255,255,0.1)" stroke-width="8" fill="none"/>
            <circle class="percent-arc" cx="50" cy="50" r="42" stroke="#10b981" stroke-width="8" stroke-dasharray="264" stroke-dashoffset="264" stroke-linecap="round" fill="none"/>
          </svg>
          <div class="percent-inner-text">
            <span class="pct-delta">+40%</span>
            <span class="pct-sub">CONVERSION</span>
          </div>
        </div>
      </div>
    `,
    customCss: `
      .percentage-stage-box { display: flex; align-items: center; justify-content: center; }
      .percent-circle-wrapper { position: relative; width: 140px; height: 140px; display: flex; align-items: center; justify-content: center; }
      .percent-svg { width: 100%; height: 100%; transform: rotate(-90deg); }
      .percent-arc { animation: pct-sweep 3s infinite var(--ease-apple); }
      .percent-inner-text { position: absolute; display: flex; flex-direction: column; align-items: center; }
      .pct-delta { font-size: 32px; font-weight: 900; color: #10b981; text-shadow: 0 0 20px rgba(16,185,129,0.5); }
      .pct-sub { font-family: monospace; font-size: 9px; letter-spacing: 0.15em; color: #94a3b8; }
      @keyframes pct-sweep { 0% { stroke-dashoffset: 264; } 40%, 80% { stroke-dashoffset: 158; } 100% { stroke-dashoffset: 264; } }
    `,
    footerNote: "Polar Coordinate Arc • Delta Highlighter",
    slug: "percentage"
  },

  // 07. Comparison
  {
    id: 7,
    badge: "ARCHETYPE #07",
    name: "Comparison",
    category: "transformations",
    categoryLabel: "Transformations & States",
    definition: "Two or more things are contrasted. “A small business versus a corporation” → split-screen comparison.",
    examplePrompt: "“Compare a traditional legacy business versus an AI-native autonomous enterprise.”",
    traitId: "trait_split_screen_versus_contrast",
    concern: "ComparativeAnalysis",
    targetScope: "split_quadrant",
    channels: "clipPath, scaleX, translateX",
    conflicts: "single_hero_focus",
    frameExpression: "contrastSplit = 0.5 + 0.05 * sin(frame * 0.1)",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18"/><rect x="3" y="5" width="8" height="14" rx="2"/><rect x="13" y="5" width="8" height="14" rx="2"/></svg>`,
    renderHtml: `
      <div class="vs-compare-box">
        <div class="vs-side vs-left">
          <span class="vs-side-title">LEGACY</span>
          <span class="vs-point">❌ 40hrs Manual Work</span>
          <span class="vs-point">❌ $2,500 Agency Fees</span>
        </div>
        <div class="vs-badge-center">VS</div>
        <div class="vs-side vs-right">
          <span class="vs-side-title">PROMETHEUS</span>
          <span class="vs-point">⚡ 3.2s Real-Time Engine</span>
          <span class="vs-point">⚡ $0 Marginal Overhead</span>
        </div>
      </div>
    `,
    customCss: `
      .vs-compare-box { display: flex; width: 90%; position: relative; border-radius: 14px; overflow: hidden; border: 1px solid rgba(255,255,255,0.12); }
      .vs-side { flex: 1; padding: 18px 14px; display: flex; flex-direction: column; gap: 8px; font-size: 12px; }
      .vs-left { background: rgba(244,63,94,0.08); border-right: 1px solid rgba(255,255,255,0.1); }
      .vs-right { background: rgba(6,182,212,0.08); }
      .vs-side-title { font-family: monospace; font-size: 12px; font-weight: 900; letter-spacing: 0.1em; }
      .vs-left .vs-side-title { color: #f43f5e; }
      .vs-right .vs-side-title { color: #06b6d4; }
      .vs-point { color: #e2e8f0; font-weight: 600; }
      .vs-badge-center { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); background: #000; border: 1px solid rgba(255,255,255,0.3); color: #fff; font-size: 11px; font-weight: 900; padding: 4px 8px; border-radius: 20px; box-shadow: 0 0 14px rgba(0,0,0,0.8); }
    `,
    footerNote: "Dual Split Pane • Friction vs Velocity Benchmark",
    slug: "comparison"
  },

  // 08. Before / After
  {
    id: 8,
    badge: "ARCHETYPE #08",
    name: "Before / After",
    category: "transformations",
    categoryLabel: "Transformations & States",
    definition: "Transformation from one state to another. “Before the system / after the system”.",
    examplePrompt: "“Here is the exact workflow before and after installing our core automation.”",
    traitId: "trait_curtain_wipe_before_after",
    concern: "StateTransformation",
    targetScope: "curtain_pane",
    channels: "clipPath, width, left",
    conflicts: "None",
    frameExpression: "curtainX = (sin(frame * 0.08) + 1) * 50",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v18"/><path d="M16 3v18"/><path d="m3 8 5-5 5 5"/><path d="m21 16-5 5-5-5"/></svg>`,
    renderHtml: `
      <div class="before-after-stage">
        <div class="ba-card-base">
          <div class="ba-state ba-after">
            <span class="ba-badge after-tag">AFTER: 60 FPS FLUID</span>
            <div class="ba-visual-after">✨ SYNCHRONIZED MASTER</div>
          </div>
          <div class="ba-state ba-before">
            <span class="ba-badge before-tag">BEFORE: CLUTTERED</span>
            <div class="ba-visual-before">⚠️ 12 BROKEN SCRIPTS</div>
          </div>
          <div class="ba-slider-line"></div>
        </div>
      </div>
    `,
    customCss: `
      .before-after-stage { width: 90%; height: 160px; position: relative; }
      .ba-card-base { width: 100%; height: 100%; position: relative; border-radius: 14px; overflow: hidden; border: 1px solid rgba(255,255,255,0.15); }
      .ba-state { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; font-weight: 800; }
      .ba-after { background: #0c1524; color: #38bdf8; }
      .ba-before { background: #261217; color: #fb7185; clip-path: polygon(0 0, 50% 0, 50% 100%, 0 100%); animation: ba-wipe 3.5s infinite ease-in-out; }
      .ba-badge { font-family: monospace; font-size: 11px; padding: 3px 8px; border-radius: 6px; }
      .after-tag { background: rgba(56,189,248,0.2); }
      .before-tag { background: rgba(251,113,133,0.2); }
      .ba-slider-line { position: absolute; top: 0; bottom: 0; left: 50%; width: 2px; background: #fff; box-shadow: 0 0 10px #fff; animation: ba-line-move 3.5s infinite ease-in-out; }
      @keyframes ba-wipe { 0%, 100% { clip-path: polygon(0 0, 20% 0, 20% 100%, 0 100%); } 50% { clip-path: polygon(0 0, 80% 0, 80% 100%, 0 100%); } }
      @keyframes ba-line-move { 0%, 100% { left: 20%; } 50% { left: 80%; } }
    `,
    footerNote: "Interactive Curtain Sweep • State Transformation",
    slug: "before-after"
  },

  // 09. Timeline / Sequence
  {
    id: 9,
    badge: "ARCHETYPE #09",
    name: "Timeline / Sequence",
    category: "processes",
    categoryLabel: "Processes & Workflows",
    definition: "Events happen in chronological order. “First X, then Y, then Z”.",
    examplePrompt: "“First, we ingested the audio, next extracted speech tokens, and finally rendered Remotion video.”",
    traitId: "trait_chronological_timeline_step",
    concern: "TemporalSequencing",
    targetScope: "node_track",
    channels: "activeNode, progressLine",
    conflicts: "None",
    frameExpression: "activeStep = floor((frame / 20) % 3)",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    renderHtml: `
      <div class="timeline-sequence-box">
        <div class="timeline-track">
          <div class="timeline-step step-act-1">
            <div class="tl-dot">1</div>
            <span class="tl-label">Ingest</span>
          </div>
          <div class="tl-line line-1"></div>
          <div class="timeline-step step-act-2">
            <div class="tl-dot">2</div>
            <span class="tl-label">Extract</span>
          </div>
          <div class="tl-line line-2"></div>
          <div class="timeline-step step-act-3">
            <div class="tl-dot">3</div>
            <span class="tl-label">Render</span>
          </div>
        </div>
      </div>
    `,
    customCss: `
      .timeline-sequence-box { width: 90%; display: flex; align-items: center; justify-content: center; }
      .timeline-track { display: flex; align-items: center; width: 100%; }
      .timeline-step { display: flex; flex-direction: column; align-items: center; gap: 6px; }
      .tl-dot { width: 36px; height: 36px; border-radius: 50%; background: #181824; border: 2px solid rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; color: #fff; transition: all 0.3s; }
      .tl-label { font-family: monospace; font-size: 11px; color: #94a3b8; font-weight: 700; }
      .tl-line { flex: 1; height: 3px; background: rgba(255,255,255,0.1); margin: 0 8px; position: relative; margin-bottom: 20px; }
      .step-act-1 .tl-dot { border-color: #06b6d4; background: rgba(6,182,212,0.2); box-shadow: 0 0 16px rgba(6,182,212,0.5); }
      .step-act-2 .tl-dot { border-color: #7c3aed; background: rgba(124,58,237,0.2); box-shadow: 0 0 16px rgba(124,58,237,0.5); }
      .step-act-3 .tl-dot { border-color: #10b981; background: rgba(16,185,129,0.2); box-shadow: 0 0 16px rgba(16,185,129,0.5); }
    `,
    footerNote: "Progressive Step Sequencer • Chronological Flow",
    slug: "timeline-sequence"
  },

  // 10. Process / Workflow
  {
    id: 10,
    badge: "ARCHETYPE #10",
    name: "Process / Workflow",
    category: "processes",
    categoryLabel: "Processes & Workflows",
    definition: "Speaker describes how something works. “Customer enters → system processes → result”.",
    examplePrompt: "“The customer submits their prompt, our neural mesh parses it, and the final cut delivers in seconds.”",
    traitId: "trait_workflow_pipeline_beam",
    concern: "WorkflowArchitecture",
    targetScope: "pipeline_stage",
    channels: "pulseBeam, nodeHighlight",
    conflicts: "None",
    frameExpression: "beamProgress = (frame % 60) / 60",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="6" height="6" rx="1"/><rect x="16" y="3" width="6" height="6" rx="1"/><rect x="9" y="15" width="6" height="6" rx="1"/><path d="M5 9v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"/><path d="M12 14v1"/></svg>`,
    renderHtml: `
      <div class="workflow-process-box">
        <div class="wf-node"><span>User Intake</span></div>
        <div class="wf-arrow">➔</div>
        <div class="wf-node wf-core"><span>Neural Mesh</span></div>
        <div class="wf-arrow">➔</div>
        <div class="wf-node"><span>Video Deliver</span></div>
      </div>
    `,
    customCss: `
      .workflow-process-box { display: flex; align-items: center; justify-content: center; gap: 10px; width: 90%; }
      .wf-node { padding: 12px 16px; border-radius: 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12); font-weight: 700; font-size: 13px; color: #fff; text-align: center; }
      .wf-core { background: rgba(124,58,237,0.15); border-color: #7c3aed; box-shadow: 0 0 20px rgba(124,58,237,0.4); }
      .wf-arrow { color: var(--accent-cyan); font-size: 16px; animation: arrow-pulse 2s infinite ease-in-out; }
      @keyframes arrow-pulse { 0%, 100% { transform: translateX(0); opacity: 0.5; } 50% { transform: translateX(4px); opacity: 1; } }
    `,
    footerNote: "Stage Process Diagram • Pulse Energy Arrows",
    slug: "process-workflow"
  },

  // 11. Flow / Pipeline
  {
    id: 11,
    badge: "ARCHETYPE #11",
    name: "Flow / Pipeline",
    category: "processes",
    categoryLabel: "Processes & Workflows",
    definition: "Information, money, people, or objects move between stages. “Data goes from the app to the database”.",
    examplePrompt: "“Raw telemetry packets stream continuously from client nodes directly into our high-speed vector DB.”",
    traitId: "trait_flow_packet_tube_conduit",
    concern: "DataPipelineVelocity",
    targetScope: "pipeline_packet",
    channels: "translateX, glowIntensity, scale",
    conflicts: "None",
    frameExpression: "packetPosition = (frame % 45) / 45",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
    renderHtml: `
      <div class="pipeline-container">
        <div class="pipe-node pipe-start">
          <span class="pipe-node-title">App Ingest</span>
          <span class="pipe-node-sub">12k req/s</span>
        </div>
        <div class="pipe-tube">
          <div class="pipe-packet p1"></div>
          <div class="pipe-packet p2"></div>
        </div>
        <div class="pipe-node pipe-end">
          <span class="pipe-node-title">Vector DB</span>
          <span class="pipe-node-sub">0.4ms index</span>
        </div>
      </div>
    `,
    customCss: `
      .pipeline-container { display: flex; align-items: center; gap: 14px; width: 90%; justify-content: center; }
      .pipe-node { padding: 12px 16px; background: rgba(14,14,24,0.9); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; display: flex; flex-direction: column; gap: 2px; }
      .pipe-start { border-color: #38bdf8; box-shadow: 0 0 16px rgba(56,189,248,0.2); }
      .pipe-end { border-color: #10b981; box-shadow: 0 0 16px rgba(16,185,129,0.2); }
      .pipe-node-title { font-weight: 800; font-size: 13px; color: #fff; }
      .pipe-node-sub { font-family: monospace; font-size: 10px; color: #94a3b8; }
      .pipe-tube { flex: 1; height: 8px; background: rgba(255,255,255,0.08); border-radius: 4px; position: relative; overflow: hidden; border: 1px solid rgba(255,255,255,0.12); }
      .pipe-packet { position: absolute; height: 100%; border-radius: 4px; }
      .p1 { width: 34px; background: #06b6d4; box-shadow: 0 0 14px #06b6d4; animation: packet-stream 2s infinite linear; }
      .p2 { width: 24px; background: #a855f7; box-shadow: 0 0 14px #a855f7; animation: packet-stream 2s 1s infinite linear; }
      @keyframes packet-stream { 0% { left: -40px; } 100% { left: 100%; } }
    `,
    footerNote: "High-Throughput Neon Conduit • Traveling Kinetic Packets",
    slug: "flow-pipeline"
  },

  // 12. Diagram / Relationship Map
  {
    id: 12,
    badge: "ARCHETYPE #12",
    name: "Diagram / Relationship Map",
    category: "structures",
    categoryLabel: "Structures & Lists",
    definition: "Entities have relationships that need visualization. “The CEO manages three departments”.",
    examplePrompt: "“The executive core directly synchronizes product engineering, creative direction, and autonomous revenue.”",
    traitId: "trait_orbital_relationship_network",
    concern: "RelationalTopology",
    targetScope: "network_nodes",
    channels: "rotate, strokeDasharray, scale",
    conflicts: "None",
    frameExpression: "orbitAngle = (frame * 0.05) % 6.28",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
    renderHtml: `
      <div class="rel-map-stage">
        <div class="rel-node ceo-node">
          <span class="node-icon">⚡</span>
          <span>CEO Core</span>
        </div>
        <div class="rel-connectors">
          <div class="rel-line l1"></div>
          <div class="rel-line l2"></div>
          <div class="rel-line l3"></div>
        </div>
        <div class="rel-sub-row">
          <div class="rel-node sub-node"><span>Eng Lead</span></div>
          <div class="rel-node sub-node"><span>Product</span></div>
          <div class="rel-node sub-node"><span>Growth</span></div>
        </div>
      </div>
    `,
    customCss: `
      .rel-map-stage { display: flex; flex-direction: column; align-items: center; gap: 8px; width: 90%; }
      .rel-node { padding: 8px 16px; border-radius: 10px; font-size: 12px; font-weight: 700; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #fff; display: flex; align-items: center; gap: 6px; }
      .ceo-node { background: rgba(6,182,212,0.18); border-color: #06b6d4; color: #06b6d4; box-shadow: 0 0 22px rgba(6,182,212,0.4); animation: ceo-pulse 2.5s infinite ease-in-out; }
      .rel-connectors { display: flex; width: 80%; justify-content: space-around; height: 18px; position: relative; }
      .rel-line { width: 2px; height: 100%; background: linear-gradient(180deg, #06b6d4, rgba(255,255,255,0.2)); }
      .rel-sub-row { display: flex; gap: 12px; }
      .sub-node { background: rgba(124,58,237,0.12); border-color: rgba(124,58,237,0.3); color: #e2e8f0; }
      @keyframes ceo-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
    `,
    footerNote: "Multi-Node Radial Star Topology • Interactive Energy Lines",
    slug: "diagram-relationship-map"
  },

  // 13. Hierarchy / Tree
  {
    id: 13,
    badge: "ARCHETYPE #13",
    name: "Hierarchy / Tree",
    category: "structures",
    categoryLabel: "Structures & Lists",
    definition: "Parent-child or organizational relationships. Company → departments → teams.",
    examplePrompt: "“From the root architecture down to our micro-worker nodes, every layer executes in deterministic hierarchy.”",
    traitId: "trait_hierarchical_branch_tree",
    concern: "TreeBranchingStructure",
    targetScope: "tree_branch",
    channels: "opacity, scaleY, translateY",
    conflicts: "None",
    frameExpression: "branchLevel = min(3, frame / 15)",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3v6M7 3v6M2 13h20M7 13v8M17 13v8"/></svg>`,
    renderHtml: `
      <div class="tree-hierarchy-stage">
        <div class="tree-root-box">
          <span class="tree-badge">ROOT</span>
          <span class="tree-name">Prometheus Core</span>
        </div>
        <div class="tree-stem"></div>
        <div class="tree-tier-2">
          <div class="tree-leaf">
            <span class="leaf-dot"></span>
            <span>Audio DSP</span>
          </div>
          <div class="tree-leaf">
            <span class="leaf-dot cyan"></span>
            <span>Kinetic GLSL</span>
          </div>
          <div class="tree-leaf">
            <span class="leaf-dot emerald"></span>
            <span>Vision ML</span>
          </div>
        </div>
      </div>
    `,
    customCss: `
      .tree-hierarchy-stage { display: flex; flex-direction: column; align-items: center; width: 88%; gap: 6px; }
      .tree-root-box { display: flex; align-items: center; gap: 8px; padding: 8px 18px; border-radius: 10px; background: rgba(124,58,237,0.2); border: 1px solid #7c3aed; box-shadow: 0 0 20px rgba(124,58,237,0.35); }
      .tree-badge { font-family: monospace; font-size: 10px; background: #7c3aed; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: 900; }
      .tree-name { font-weight: 800; font-size: 13px; color: #fff; }
      .tree-stem { width: 2px; height: 16px; background: rgba(255,255,255,0.2); }
      .tree-tier-2 { display: flex; gap: 10px; position: relative; }
      .tree-tier-2::before { content: ''; position: absolute; top: -8px; left: 20%; right: 20%; height: 2px; background: rgba(255,255,255,0.2); }
      .tree-leaf { display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); font-size: 11px; font-weight: 700; color: #e2e8f0; }
      .leaf-dot { width: 6px; height: 6px; border-radius: 50%; background: #a855f7; }
      .leaf-dot.cyan { background: #06b6d4; }
      .leaf-dot.emerald { background: #10b981; }
    `,
    footerNote: "Multi-Tier Branching Logic • Parent-Child Inheritance",
    slug: "hierarchy-tree"
  },

  // 14. Geographic / Map Asset
  {
    id: 14,
    badge: "ARCHETYPE #14",
    name: "Geographic / Map Asset",
    category: "artifacts",
    categoryLabel: "Artifacts & Entities",
    definition: "Location, movement, country, city, or region is relevant. “We expanded from Lagos to London”.",
    examplePrompt: "“Within forty-eight hours, our infrastructure expanded seamlessly from Lagos straight to London.”",
    traitId: "trait_geographic_flight_arc_telemetry",
    concern: "GeographicExpansion",
    targetScope: "flight_arc_path",
    channels: "strokeDashoffset, radarPulse",
    conflicts: "None",
    frameExpression: "flightProgress = (frame % 60) / 60",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>`,
    renderHtml: `
      <div class="geo-map-box">
        <div class="geo-header">
          <span class="geo-tag">TRANS-ATLANTIC EXPANSION</span>
          <span class="geo-route">LOS ➔ LHR</span>
        </div>
        <svg class="geo-svg" viewBox="0 0 340 100">
          <!-- Background Grid Lines -->
          <line x1="20" y1="30" x2="320" y2="30" stroke="rgba(255,255,255,0.05)" stroke-dasharray="4"/>
          <line x1="20" y1="70" x2="320" y2="70" stroke="rgba(255,255,255,0.05)" stroke-dasharray="4"/>
          <!-- Trajectory Arc -->
          <path class="geo-arc" d="M 60 75 Q 170 15 280 40" fill="none" stroke="#06b6d4" stroke-width="3" stroke-dasharray="6 4"/>
          <!-- Lagos Beacon -->
          <circle cx="60" cy="75" r="8" fill="rgba(244,63,94,0.3)" class="beacon-pulse"/>
          <circle cx="60" cy="75" r="4" fill="#f43f5e"/>
          <text x="60" y="94" fill="#fff" font-size="10" font-weight="700" text-anchor="middle" font-family="monospace">LAGOS</text>
          <!-- London Beacon -->
          <circle cx="280" cy="40" r="8" fill="rgba(16,185,129,0.3)" class="beacon-pulse delay"/>
          <circle cx="280" cy="40" r="4" fill="#10b981"/>
          <text x="280" y="24" fill="#fff" font-size="10" font-weight="700" text-anchor="middle" font-family="monospace">LONDON</text>
        </svg>
      </div>
    `,
    customCss: `
      .geo-map-box { width: 90%; background: #070a14; border: 1px solid rgba(6,182,212,0.3); border-radius: 14px; padding: 14px 18px; box-shadow: 0 10px 30px rgba(0,0,0,0.6); }
      .geo-header { display: flex; justify-content: space-between; font-family: monospace; font-size: 11px; margin-bottom: 6px; }
      .geo-tag { color: #94a3b8; font-weight: 700; }
      .geo-route { color: var(--accent-cyan); font-weight: 900; background: rgba(6,182,212,0.15); padding: 2px 6px; border-radius: 4px; }
      .geo-svg { width: 100%; height: 90px; }
      .beacon-pulse { animation: beacon-anim 1.8s infinite ease-out; transform-origin: center; }
      .beacon-pulse.delay { animation-delay: 0.9s; }
      @keyframes beacon-anim { 0% { r: 4; opacity: 1; } 100% { r: 16; opacity: 0; } }
    `,
    footerNote: "Vector Coordinate Telemetry • Transcontinental Arc",
    slug: "geographic-map-asset"
  },

  // 15. Person / Character Asset
  {
    id: 15,
    badge: "ARCHETYPE #15",
    name: "Person / Character Asset",
    category: "artifacts",
    categoryLabel: "Artifacts & Entities",
    definition: "A specific person or human archetype is mentioned. “A founder” → founder visual.",
    examplePrompt: "“When a technical founder builds without bloated agency layers, output multiplies ten-fold.”",
    traitId: "trait_person_character_silhouette_glow",
    concern: "HumanArchetypeFocus",
    targetScope: "character_avatar",
    channels: "haloGlow, frequencyRings, scale",
    conflicts: "None",
    frameExpression: "haloIntensity = 0.8 + 0.2 * sin(frame * 0.15)",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0 4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    renderHtml: `
      <div class="character-card-box">
        <div class="character-avatar-stage">
          <div class="character-halo"></div>
          <svg class="char-svg" viewBox="0 0 80 80">
            <circle cx="40" cy="30" r="16" fill="url(#charGrad)"/>
            <path d="M 16 70 C 16 52, 64 52, 64 70 Z" fill="url(#charGrad)"/>
            <defs>
              <linearGradient id="charGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#38bdf8"/>
                <stop offset="100%" stop-color="#7c3aed"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="char-meta">
          <span class="char-role">TECHNICAL FOUNDER</span>
          <span class="char-title">Autonomous Architect</span>
          <div class="char-tags">
            <span class="ctag">Systems Native</span>
            <span class="ctag cyan">10x Speed</span>
          </div>
        </div>
      </div>
    `,
    customCss: `
      .character-card-box { display: flex; align-items: center; gap: 18px; width: 85%; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.12); padding: 14px 20px; border-radius: 16px; box-shadow: 0 12px 30px rgba(0,0,0,0.5); }
      .character-avatar-stage { position: relative; width: 70px; height: 70px; display: flex; align-items: center; justify-content: center; }
      .character-halo { position: absolute; inset: -6px; border-radius: 50%; background: radial-gradient(circle, rgba(56,189,248,0.4), transparent 70%); animation: halo-pulse 3s infinite ease-in-out; }
      .char-svg { width: 64px; height: 64px; position: relative; z-index: 2; }
      .char-meta { display: flex; flex-direction: column; gap: 3px; }
      .char-role { font-family: monospace; font-size: 10px; font-weight: 800; color: var(--accent-cyan); letter-spacing: 0.15em; }
      .char-title { font-size: 16px; font-weight: 800; color: #fff; }
      .char-tags { display: flex; gap: 6px; margin-top: 4px; }
      .ctag { font-family: monospace; font-size: 10px; background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; color: #cbd5e1; }
      .ctag.cyan { background: rgba(6,182,212,0.15); color: #38bdf8; }
      @keyframes halo-pulse { 0%, 100% { transform: scale(1); opacity: 0.5; } 50% { transform: scale(1.2); opacity: 0.9; } }
    `,
    footerNote: "Depth-Matted Character Archetype • Cyber Halo Glow",
    slug: "person-character-asset"
  },

  // 16. Brand / Product Asset
  {
    id: 16,
    badge: "ARCHETYPE #16",
    name: "Brand / Product Asset",
    category: "artifacts",
    categoryLabel: "Artifacts & Entities",
    definition: "A specific product or commercial entity is referenced. “iPhone”, “Nike shoes”.",
    examplePrompt: "“The new Titanium Pro flagship device engineered with zero-compromise hardware.”",
    traitId: "trait_product_glassmorphic_showcase",
    concern: "ProductHardwareShowcase",
    targetScope: "product_device_frame",
    channels: "rotateY, specularSheen, shadowDepth",
    conflicts: "None",
    frameExpression: "sheenX = (sin(frame * 0.08) + 1) * 50",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`,
    renderHtml: `
      <div class="product-showcase-stage">
        <div class="device-mockup">
          <div class="device-notch"></div>
          <div class="device-screen">
            <span class="device-logo">PRO 16</span>
            <span class="device-badge">M3 ULTRA</span>
          </div>
          <div class="device-sheen"></div>
        </div>
        <div class="product-meta">
          <span class="p-brand">APPLE HARDWARE</span>
          <span class="p-name">iPhone 16 Pro Max</span>
          <span class="p-spec">Grade 5 Titanium • 120Hz ProMotion</span>
        </div>
      </div>
    `,
    customCss: `
      .product-showcase-stage { display: flex; align-items: center; gap: 20px; width: 85%; }
      .device-mockup { width: 70px; height: 110px; background: #000; border: 3px solid #64748b; border-radius: 16px; position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 10px 30px rgba(0,0,0,0.8); }
      .device-notch { width: 22px; height: 5px; background: #1e293b; border-radius: 4px; position: absolute; top: 5px; }
      .device-screen { display: flex; flex-direction: column; align-items: center; gap: 2px; }
      .device-logo { font-size: 10px; font-weight: 900; color: #fff; letter-spacing: 0.05em; }
      .device-badge { font-family: monospace; font-size: 8px; background: #7c3aed; color: #fff; padding: 1px 4px; border-radius: 3px; font-weight: 800; }
      .device-sheen { position: absolute; inset: 0; background: linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.25) 50%, transparent 60%); animation: sheen-pass 3.5s infinite ease-in-out; }
      .product-meta { display: flex; flex-direction: column; gap: 3px; }
      .p-brand { font-family: monospace; font-size: 10px; color: #94a3b8; font-weight: 800; letter-spacing: 0.1em; }
      .p-name { font-size: 16px; font-weight: 800; color: #fff; }
      .p-spec { font-size: 11px; color: #64748b; }
      @keyframes sheen-pass { 0% { transform: translateX(-100%); } 40%, 100% { transform: translateX(150%); } }
    `,
    footerNote: "Specular Metallic Sheen • Precision Device Framing",
    slug: "brand-product-asset"
  },

  // 17. Document / UI Asset
  {
    id: 17,
    badge: "ARCHETYPE #17",
    name: "Document / UI Asset",
    category: "artifacts",
    categoryLabel: "Artifacts & Entities",
    definition: "A document, webpage, dashboard, app, or interface is referenced. “Open your analytics dashboard”.",
    examplePrompt: "“Open your real-time analytics telemetry dashboard to audit live throughput.”",
    traitId: "trait_floating_macos_ui_window",
    concern: "InterfaceRepresentation",
    targetScope: "window_frame",
    channels: "scale, translateY, shadowGlow",
    conflicts: "None",
    frameExpression: "windowY = sin(frame * 0.08) * 4",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
    renderHtml: `
      <div class="ui-window-card">
        <div class="ui-window-titlebar">
          <div class="traffic-lights">
            <span class="t-dot red"></span>
            <span class="t-dot yellow"></span>
            <span class="t-dot green"></span>
          </div>
          <span class="window-title">analytics-telemetry.app</span>
        </div>
        <div class="ui-window-body">
          <div class="ui-stat-row">
            <div class="ui-mini-metric">
              <span class="um-label">FPS</span>
              <span class="um-val">60.0</span>
            </div>
            <div class="ui-mini-metric">
              <span class="um-label">LATENCY</span>
              <span class="um-val">3.2ms</span>
            </div>
            <div class="ui-mini-metric">
              <span class="um-label">THREADS</span>
              <span class="um-val">128</span>
            </div>
          </div>
          <div class="ui-bar-chart">
            <div class="u-bar b1"></div>
            <div class="u-bar b2"></div>
            <div class="u-bar b3"></div>
            <div class="u-bar b4"></div>
            <div class="u-bar b5"></div>
          </div>
        </div>
      </div>
    `,
    customCss: `
      .ui-window-card { width: 88%; background: #0a0c16; border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; overflow: hidden; box-shadow: 0 14px 40px rgba(0,0,0,0.7); animation: win-float 3s infinite ease-in-out; }
      .ui-window-titlebar { background: rgba(255,255,255,0.04); padding: 8px 12px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid rgba(255,255,255,0.08); }
      .traffic-lights { display: flex; gap: 5px; }
      .t-dot { width: 8px; height: 8px; border-radius: 50%; }
      .t-dot.red { background: #f43f5e; }
      .t-dot.yellow { background: #f59e0b; }
      .t-dot.green { background: #10b981; }
      .window-title { font-family: monospace; font-size: 11px; color: #94a3b8; }
      .ui-window-body { padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
      .ui-stat-row { display: flex; justify-content: space-between; }
      .ui-mini-metric { display: flex; flex-direction: column; gap: 2px; }
      .um-label { font-family: monospace; font-size: 9px; color: #64748b; font-weight: 800; }
      .um-val { font-family: monospace; font-size: 13px; font-weight: 800; color: var(--accent-cyan); }
      .ui-bar-chart { display: flex; align-items: flex-end; gap: 8px; height: 36px; padding-top: 4px; }
      .u-bar { flex: 1; background: linear-gradient(180deg, #7c3aed, #06b6d4); border-radius: 3px 3px 0 0; }
      .b1 { height: 40%; } .b2 { height: 75%; } .b3 { height: 55%; } .b4 { height: 95%; } .b5 { height: 80%; }
      @keyframes win-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
    `,
    footerNote: "Glassmorphic macOS Frame • Dynamic Telemetry Bars",
    slug: "document-ui-asset"
  },

  // 18. Screenshot / Screen State
  {
    id: 18,
    badge: "ARCHETYPE #18",
    name: "Screenshot / Screen State",
    category: "artifacts",
    categoryLabel: "Artifacts & Entities",
    definition: "An actual interface state is the best representation. Showing an Instagram profile or spreadsheet.",
    examplePrompt: "“When you inspect their live profile feed, you see instant proof of explosive virality.”",
    traitId: "trait_screen_state_instagram_profile",
    concern: "InterfaceVerification",
    targetScope: "screen_viewport",
    channels: "opacity, scale, perspectiveTilt",
    conflicts: "None",
    frameExpression: "tiltX = sin(frame * 0.05) * 3",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
    renderHtml: `
      <div class="screen-state-mock">
        <div class="ig-profile-header">
          <div class="ig-avatar"></div>
          <div class="ig-counts">
            <div class="cnt-item"><strong>48</strong><span>Posts</span></div>
            <div class="cnt-item"><strong>128K</strong><span>Followers</span></div>
            <div class="cnt-item"><strong>12</strong><span>Following</span></div>
          </div>
        </div>
        <div class="ig-grid">
          <div class="ig-post p-hero">🚀 1.2M</div>
          <div class="ig-post">⚡ 840K</div>
          <div class="ig-post">✨ 520K</div>
        </div>
      </div>
    `,
    customCss: `
      .screen-state-mock { width: 85%; background: #000; border: 1px solid rgba(255,255,255,0.18); border-radius: 14px; padding: 14px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 12px 36px rgba(0,0,0,0.8); }
      .ig-profile-header { display: flex; align-items: center; gap: 14px; }
      .ig-avatar { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #f43f5e, #f59e0b); border: 2px solid #fff; }
      .ig-counts { display: flex; gap: 12px; flex: 1; justify-content: space-around; font-size: 11px; }
      .cnt-item { display: flex; flex-direction: column; align-items: center; }
      .cnt-item strong { color: #fff; font-weight: 800; }
      .cnt-item span { color: #64748b; font-size: 9px; }
      .ig-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
      .ig-post { background: #181824; height: 48px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-family: monospace; font-size: 10px; font-weight: 800; color: #fff; border: 1px solid rgba(255,255,255,0.08); }
      .p-hero { background: rgba(6,182,212,0.2); border-color: #06b6d4; color: #06b6d4; }
    `,
    footerNote: "High-Fidelity Social State Mockup • Verified Creator Feed",
    slug: "screenshot-screen-state"
  },

  // 19. Text Artifact
  {
    id: 19,
    badge: "ARCHETYPE #19",
    name: "Text Artifact",
    category: "artifacts",
    categoryLabel: "Artifacts & Entities",
    definition: "The content itself is the visual. Quote, headline, email, tweet, sentence.",
    examplePrompt: "“A single authoritative tweet broke the entire viral algorithm in under ten minutes.”",
    traitId: "trait_framed_social_tweet_artifact",
    concern: "TextualDocumentFraming",
    targetScope: "tweet_container",
    channels: "opacity, translateY, scale",
    conflicts: "None",
    frameExpression: "tweetScale = 1.0 + 0.03 * sin(frame * 0.1)",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/></svg>`,
    renderHtml: `
      <div class="tweet-artifact-card">
        <div class="tweet-author-row">
          <div class="t-author-avatar">P</div>
          <div class="t-author-info">
            <div class="t-name-row">
              <span class="t-name">Prometheus AI</span>
              <span class="t-badge">✓</span>
            </div>
            <span class="t-handle">@prometheus_core</span>
          </div>
          <span class="t-time">2m</span>
        </div>
        <div class="tweet-body-text">
          Automating 60fps cinematic video generation is no longer research. It is now our production reality.
        </div>
        <div class="tweet-metrics-row">
          <span>❤️ 10.4K</span>
          <span>🔄 2.1K</span>
          <span>💬 482</span>
        </div>
      </div>
    `,
    customCss: `
      .tweet-artifact-card { width: 88%; background: rgba(18,18,28,0.9); border: 1px solid rgba(255,255,255,0.15); border-radius: 14px; padding: 14px 18px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 12px 36px rgba(0,0,0,0.6); }
      .tweet-author-row { display: flex; align-items: center; gap: 10px; }
      .t-author-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #7c3aed, #06b6d4); display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 13px; color: #fff; }
      .t-author-info { display: flex; flex-direction: column; flex: 1; }
      .t-name-row { display: flex; align-items: center; gap: 4px; }
      .t-name { font-weight: 800; font-size: 13px; color: #fff; }
      .t-badge { color: #38bdf8; font-size: 11px; }
      .t-handle { font-family: monospace; font-size: 10px; color: #64748b; }
      .t-time { font-family: monospace; font-size: 10px; color: #64748b; }
      .tweet-body-text { font-size: 13px; line-height: 1.4; color: #e2e8f0; font-weight: 500; }
      .tweet-metrics-row { display: flex; gap: 16px; font-family: monospace; font-size: 11px; color: #94a3b8; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 6px; }
    `,
    footerNote: "Framed Social Artifact • Verified Signature Card",
    slug: "text-artifact"
  },

  // 20. Quote / Citation Card
  {
    id: 20,
    badge: "ARCHETYPE #20",
    name: "Quote / Citation Card",
    category: "artifacts",
    categoryLabel: "Artifacts & Entities",
    definition: "Someone else's words are explicitly referenced. “As Warren Buffett said…” → quote card.",
    examplePrompt: "“As Warren Buffett famously said: Rule number one is never lose money.”",
    traitId: "trait_editorial_quote_citation_card",
    concern: "AuthoritativeAttribution",
    targetScope: "citation_card",
    channels: "opacity, blur, translateY",
    conflicts: "None",
    frameExpression: "quoteOpacity = clamp(0, 1, frame / 20)",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2H4c-1.25 0-2 .75-2 2v6c0 7 1 8 3 8z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2h-4c-1.25 0-2 .75-2 2v6c0 7 1 8 3 8z"/></svg>`,
    renderHtml: `
      <div class="quote-citation-box">
        <div class="quote-mark">“</div>
        <div class="quote-body">
          <p class="quote-text">Rule No. 1: Never lose money. Rule No. 2: Never forget rule No. 1.</p>
          <div class="quote-author-row">
            <span class="quote-dash">—</span>
            <span class="quote-name">WARREN BUFFETT</span>
            <span class="quote-cred">Berkshire Hathaway</span>
          </div>
        </div>
      </div>
    `,
    customCss: `
      .quote-citation-box { width: 88%; background: linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,215,0,0.05)); border: 1px solid rgba(255,215,0,0.3); border-radius: 14px; padding: 16px 20px; display: flex; gap: 14px; box-shadow: 0 10px 30px rgba(0,0,0,0.6); }
      .quote-mark { font-family: serif; font-size: 52px; line-height: 0.8; color: #ffd700; opacity: 0.8; }
      .quote-body { display: flex; flex-direction: column; gap: 8px; flex: 1; }
      .quote-text { font-family: "Georgia", serif; font-style: italic; font-size: 14px; line-height: 1.4; color: #f8fafc; }
      .quote-author-row { display: flex; align-items: baseline; gap: 6px; font-family: monospace; }
      .quote-dash { color: #ffd700; }
      .quote-name { font-size: 11px; font-weight: 900; color: #ffd700; letter-spacing: 0.1em; }
      .quote-cred { font-size: 9px; color: #94a3b8; }
    `,
    footerNote: "Serif Typography • Gold Editorial Citation Accent",
    slug: "quote-citation-card"
  },

  // 21. Symbol / Iconography
  {
    id: 21,
    badge: "ARCHETYPE #21",
    name: "Symbol / Iconography",
    category: "communication",
    categoryLabel: "Communication & Concepts",
    definition: "An abstract concept has a conventional visual symbol. Money → $; warning → ⚠️.",
    examplePrompt: "“From direct financial liquidity to enterprise security and critical alerts.”",
    traitId: "trait_abstract_symbol_iconography_quad",
    concern: "SymbolicRepresentation",
    targetScope: "symbol_badge",
    channels: "scale, box-shadow, rotate",
    conflicts: "None",
    frameExpression: "symbolGlow = 0.5 + 0.5 * sin(frame * 0.1)",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`,
    renderHtml: `
      <div class="symbol-quad-stage">
        <div class="sym-badge sym-money">
          <span class="sym-glyph">$</span>
          <span class="sym-lbl">LIQUIDITY</span>
        </div>
        <div class="sym-badge sym-alert">
          <span class="sym-glyph">⚠️</span>
          <span class="sym-lbl">WARNING</span>
        </div>
        <div class="sym-badge sym-speed">
          <span class="sym-glyph">⚡</span>
          <span class="sym-lbl">VELOCITY</span>
        </div>
        <div class="sym-badge sym-shield">
          <span class="sym-glyph">🛡️</span>
          <span class="sym-lbl">GOVERN</span>
        </div>
      </div>
    `,
    customCss: `
      .symbol-quad-stage { display: flex; gap: 12px; width: 90%; justify-content: center; }
      .sym-badge { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 8px; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); animation: sym-float 3s infinite ease-in-out; }
      .sym-glyph { font-size: 22px; }
      .sym-lbl { font-family: monospace; font-size: 9px; font-weight: 800; color: #94a3b8; letter-spacing: 0.05em; }
      .sym-money { border-color: rgba(16,185,129,0.3); color: #10b981; }
      .sym-alert { border-color: rgba(245,158,11,0.3); color: #f59e0b; animation-delay: 0.2s; }
      .sym-speed { border-color: rgba(6,182,212,0.3); color: #06b6d4; animation-delay: 0.4s; }
      .sym-shield { border-color: rgba(124,58,237,0.3); color: #a855f7; animation-delay: 0.6s; }
      @keyframes sym-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
    `,
    footerNote: "Multi-Glyph Semantic Array • Synchronized Ambient Pulse",
    slug: "symbol-iconography"
  },

  // 22. Metaphorical Visual
  {
    id: 22,
    badge: "ARCHETYPE #22",
    name: "Metaphorical Visual",
    category: "communication",
    categoryLabel: "Communication & Concepts",
    definition: "Figurative language can become a visual. “You're drowning in information”.",
    examplePrompt: "“Most creators are literally drowning in noisy, unstructured fragmented data.”",
    traitId: "trait_metaphorical_ocean_data_wave",
    concern: "FigurativeMetaphor",
    targetScope: "wave_mesh",
    channels: "waveAmplitude, translateY, opacity",
    conflicts: "None",
    frameExpression: "waveY = sin(frame * 0.1) * 8",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12c5-5 5 5 10 0s5 5 10 0"/></svg>`,
    renderHtml: `
      <div class="metaphor-stage">
        <div class="data-block db1">📊 Raw Data</div>
        <div class="data-block db2">📑 500 PDFs</div>
        <div class="data-block db3">⚠️ Noise</div>
        <div class="ocean-wave-crest">
          <svg viewBox="0 0 320 60" class="wave-svg">
            <path d="M 0 30 Q 80 5 160 30 T 320 30 L 320 60 L 0 60 Z" fill="rgba(6,182,212,0.35)"/>
            <path d="M 0 40 Q 80 20 160 40 T 320 40 L 320 60 L 0 60 Z" fill="rgba(56,189,248,0.5)"/>
          </svg>
        </div>
        <span class="metaphor-caption">🌊 “DROWNING IN NOISE”</span>
      </div>
    `,
    customCss: `
      .metaphor-stage { width: 90%; height: 140px; background: #060914; border: 1px solid rgba(6,182,212,0.3); border-radius: 14px; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; }
      .data-block { position: absolute; font-family: monospace; font-size: 10px; font-weight: 700; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); padding: 3px 8px; border-radius: 6px; color: #fff; animation: float-sink 3s infinite ease-in-out; }
      .db1 { top: 20px; left: 30px; animation-delay: 0s; }
      .db2 { top: 15px; right: 40px; animation-delay: 0.5s; }
      .db3 { top: 40px; left: 140px; animation-delay: 1s; color: #f43f5e; border-color: rgba(244,63,94,0.4); }
      .ocean-wave-crest { position: absolute; bottom: 0; left: 0; right: 0; height: 50px; }
      .wave-svg { width: 100%; height: 100%; }
      .metaphor-caption { position: absolute; bottom: 8px; font-family: monospace; font-size: 11px; font-weight: 900; color: #fff; text-shadow: 0 0 10px rgba(6,182,212,0.8); z-index: 10; }
      @keyframes float-sink { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(12px); opacity: 0.6; } }
    `,
    footerNote: "Conceptual Vector Waves • Kinetic Ocean Sinking Metaphor",
    slug: "metaphorical-visual"
  },

  // 23. Concept Visualization
  {
    id: 23,
    badge: "ARCHETYPE #23",
    name: "Concept Visualization",
    category: "communication",
    categoryLabel: "Communication & Concepts",
    definition: "An abstract idea needs a visual representation. “Momentum”, “discipline”, “trust”.",
    examplePrompt: "“True compounding momentum is unstoppable once your velocity threshold hits escape velocity.”",
    traitId: "trait_vector_physics_momentum_arc",
    concern: "AbstractConceptModeling",
    targetScope: "physics_particle",
    channels: "velocityVector, particleTrail, scale",
    conflicts: "None",
    frameExpression: "velocity = exp(frame * 0.05)",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
    renderHtml: `
      <div class="concept-momentum-box">
        <div class="momentum-arc-track">
          <div class="momentum-particle"></div>
          <div class="momentum-trail t1"></div>
          <div class="momentum-trail t2"></div>
        </div>
        <div class="concept-label-row">
          <span class="concept-tag">PHYSICS ENGINE</span>
          <span class="concept-title">UNSTOPPABLE MOMENTUM</span>
          <span class="concept-metric">⚡ 2.4x Multiplier</span>
        </div>
      </div>
    `,
    customCss: `
      .concept-momentum-box { width: 90%; background: #090814; border: 1px solid rgba(124,58,237,0.3); border-radius: 14px; padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; }
      .momentum-arc-track { height: 40px; position: relative; display: flex; align-items: center; border-bottom: 2px dashed rgba(255,255,255,0.1); }
      .momentum-particle { width: 14px; height: 14px; border-radius: 50%; background: #06b6d4; box-shadow: 0 0 20px #06b6d4; position: absolute; animation: particle-accel 2s infinite cubic-bezier(0.1, 0.9, 0.2, 1); }
      .concept-label-row { display: flex; justify-content: space-between; align-items: center; }
      .concept-tag { font-family: monospace; font-size: 9px; color: #64748b; font-weight: 800; }
      .concept-title { font-size: 13px; font-weight: 900; color: #fff; letter-spacing: 0.05em; }
      .concept-metric { font-family: monospace; font-size: 11px; color: var(--accent-cyan); font-weight: 800; }
      @keyframes particle-accel { 0% { left: 0%; transform: scale(0.6); } 100% { left: 90%; transform: scale(1.4); } }
    `,
    footerNote: "Vector Physics Acceleration • Kinetic Particle Trail",
    slug: "concept-visualization"
  },

  // 24. Object Transformation
  {
    id: 24,
    badge: "ARCHETYPE #24",
    name: "Object Transformation",
    category: "transformations",
    categoryLabel: "Transformations & States",
    definition: "An object changes state or form. Empty battery → full battery.",
    examplePrompt: "“Transform your exhausted team capacity into a fully charged autonomous rendering engine.”",
    traitId: "trait_battery_morph_state_charge",
    concern: "ObjectStateMorphology",
    targetScope: "battery_fill",
    channels: "width, background, filter",
    conflicts: "None",
    frameExpression: "chargePercent = (sin(frame * 0.1) + 1) * 45",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="16" height="10" rx="2" ry="2"/><line x1="22" y1="11" x2="22" y2="13"/></svg>`,
    renderHtml: `
      <div class="battery-morph-box">
        <div class="battery-shell">
          <div class="battery-fill"></div>
        </div>
        <div class="battery-readout">
          <span class="b-status">SYSTEM CAPACITY</span>
          <span class="b-pct">85% CHARGED</span>
        </div>
      </div>
    `,
    customCss: `
      .battery-morph-box { display: flex; flex-direction: column; align-items: center; gap: 10px; width: 85%; }
      .battery-shell { width: 120px; height: 50px; border: 3px solid #fff; border-radius: 10px; padding: 4px; position: relative; background: rgba(0,0,0,0.5); }
      .battery-shell::after { content: ''; position: absolute; right: -9px; top: 14px; width: 6px; height: 18px; background: #fff; border-radius: 0 3px 3px 0; }
      .battery-fill { height: 100%; border-radius: 4px; animation: batt-charge 3s infinite ease-in-out; }
      .battery-readout { display: flex; justify-content: space-between; width: 120px; font-family: monospace; font-size: 10px; font-weight: 800; }
      .b-status { color: #64748b; }
      .b-pct { color: #10b981; }
      @keyframes batt-charge { 0% { width: 15%; background: #f43f5e; box-shadow: 0 0 16px #f43f5e; } 50% { width: 85%; background: #10b981; box-shadow: 0 0 20px #10b981; } 100% { width: 15%; background: #f43f5e; box-shadow: 0 0 16px #f43f5e; } }
    `,
    footerNote: "Dynamic State Morphing • Low Battery to High Charge Transition",
    slug: "object-transformation"
  },

  // 25. State Indicator
  {
    id: 25,
    badge: "ARCHETYPE #25",
    name: "State Indicator",
    category: "transformations",
    categoryLabel: "Transformations & States",
    definition: "Something communicates status. Loading, active, failed, blocked, complete.",
    examplePrompt: "“Live system telemetry indicators constantly verify worker cluster health in real time.”",
    traitId: "trait_live_status_indicator_cluster",
    concern: "SystemStateCommunication",
    targetScope: "status_pill",
    channels: "opacity, background, pingDot",
    conflicts: "None",
    frameExpression: "pingPulse = (frame % 30) / 30",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>`,
    renderHtml: `
      <div class="state-cluster-box">
        <div class="state-pill s-active"><span class="state-dot dot-green"></span><span>RUNNING 60FPS</span></div>
        <div class="state-pill s-compiling"><span class="state-dot dot-cyan"></span><span>COMPILING GLSL</span></div>
        <div class="state-pill s-blocked"><span class="state-dot dot-red"></span><span>0 BLOCKED</span></div>
      </div>
    `,
    customCss: `
      .state-cluster-box { display: flex; gap: 10px; width: 90%; justify-content: center; }
      .state-pill { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 20px; font-family: monospace; font-size: 11px; font-weight: 800; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.6); }
      .state-dot { width: 8px; height: 8px; border-radius: 50%; position: relative; }
      .dot-green { background: #10b981; box-shadow: 0 0 10px #10b981; animation: ping-glow 1.5s infinite; }
      .dot-cyan { background: #06b6d4; box-shadow: 0 0 10px #06b6d4; animation: ping-glow 1.5s 0.5s infinite; }
      .dot-red { background: #f43f5e; opacity: 0.5; }
      .s-active { border-color: rgba(16,185,129,0.3); color: #10b981; }
      .s-compiling { border-color: rgba(6,182,212,0.3); color: #06b6d4; }
      .s-blocked { border-color: rgba(244,63,94,0.2); color: #94a3b8; }
      @keyframes ping-glow { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.4); opacity: 0.6; } }
    `,
    footerNote: "Pulsing Radar Status Beacons • Cluster State Matrix",
    slug: "state-indicator"
  },

  // 26. Progress / Completion
  {
    id: 26,
    badge: "ARCHETYPE #26",
    name: "Progress / Completion",
    category: "transformations",
    categoryLabel: "Transformations & States",
    definition: "Growth toward a target or completion. 0% → 100% progress bar.",
    examplePrompt: "“In under two seconds, the entire 40-second composition reached one hundred percent compilation.”",
    traitId: "trait_linear_progress_completion_bar",
    concern: "ProgressTowardsGoal",
    targetScope: "progress_fill",
    channels: "width, gradientShift, box-shadow",
    conflicts: "None",
    frameExpression: "progress = min(100, (frame / 45) * 100)",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    renderHtml: `
      <div class="progress-bar-stage">
        <div class="progress-info">
          <span>PIPELINE RENDER SYNTHESIS</span>
          <span class="pct-glow">100% COMPLETE</span>
        </div>
        <div class="progress-track">
          <div class="progress-bar-fill"></div>
        </div>
        <div class="progress-foot">
          <span>0.00s</span>
          <span>40.00s Master Deliverable</span>
        </div>
      </div>
    `,
    customCss: `
      .progress-bar-stage { width: 88%; display: flex; flex-direction: column; gap: 8px; }
      .progress-info { display: flex; justify-content: space-between; font-family: monospace; font-size: 11px; font-weight: 800; color: #94a3b8; }
      .pct-glow { color: var(--accent-cyan); font-weight: 900; }
      .progress-track { width: 100%; height: 12px; background: rgba(255,255,255,0.08); border-radius: 6px; overflow: hidden; border: 1px solid rgba(255,255,255,0.12); }
      .progress-bar-fill { height: 100%; background: linear-gradient(90deg, #7c3aed, #06b6d4, #10b981); box-shadow: 0 0 18px #06b6d4; animation: prog-fill 3s infinite var(--ease-apple); }
      .progress-foot { display: flex; justify-content: space-between; font-family: monospace; font-size: 10px; color: #64748b; }
      @keyframes prog-fill { 0% { width: 0%; } 55%, 85% { width: 100%; } 100% { width: 0%; } }
    `,
    footerNote: "Neon Spectrum Sweep • Deterministic Linear Completion",
    slug: "progress-completion"
  },

  // 27. Counter / Ticker
  {
    id: 27,
    badge: "ARCHETYPE #27",
    name: "Counter / Ticker",
    category: "metrics",
    categoryLabel: "Metrics & Quantitative",
    definition: "A number continuously changes. $0 → $50,000.",
    examplePrompt: "“Watch the revenue ticker continuously accelerate from zero straight to fifty thousand.”",
    traitId: "trait_3d_film_odometer_ticker",
    concern: "ContinuousNumericalRoll",
    targetScope: "digit_wheel",
    channels: "translateY, opacity",
    conflicts: "None",
    frameExpression: "digitOffset = (frame / 30) * 10",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    renderHtml: `
      <div class="ticker-roller-box">
        <span class="ticker-prefix">LIVE NET ROLL</span>
        <div class="ticker-stage">
          <span class="t-sym">$</span>
          <div class="t-reel"><span class="t-digit d1">5</span></div>
          <div class="t-reel"><span class="t-digit d2">0</span></div>
          <span class="t-comma">,</span>
          <div class="t-reel"><span class="t-digit d3">0</span></div>
          <div class="t-reel"><span class="t-digit d4">0</span></div>
          <div class="t-reel"><span class="t-digit d5">0</span></div>
        </div>
        <span class="ticker-sub">USD CONTINUOUS TICKER</span>
      </div>
    `,
    customCss: `
      .ticker-roller-box { display: flex; flex-direction: column; align-items: center; gap: 4px; }
      .ticker-prefix { font-family: monospace; font-size: 10px; font-weight: 800; color: var(--accent-cyan); letter-spacing: 0.15em; }
      .ticker-stage { display: flex; align-items: baseline; font-size: 48px; font-weight: 900; color: #fff; font-family: monospace; text-shadow: 0 0 24px rgba(6,182,212,0.6); }
      .t-sym { color: #06b6d4; font-size: 36px; margin-right: 2px; }
      .t-reel { height: 56px; overflow: hidden; display: inline-block; }
      .t-digit { display: block; animation: digit-spin 2.5s infinite ease-out; }
      .t-comma { font-size: 44px; color: #fff; margin: 0 2px; }
      .ticker-sub { font-family: monospace; font-size: 10px; color: #94a3b8; font-weight: 700; }
      @keyframes digit-spin { 0% { transform: translateY(100%); opacity: 0; } 30%, 80% { transform: translateY(0%); opacity: 1; } 100% { transform: translateY(-100%); opacity: 0; } }
    `,
    footerNote: "Mechanical Digit Wheel • Calibrated 3D Film Counter Roll",
    slug: "counter-ticker"
  },

  // 28. Gauge / Meter
  {
    id: 28,
    badge: "ARCHETYPE #28",
    name: "Gauge / Meter",
    category: "metrics",
    categoryLabel: "Metrics & Quantitative",
    definition: "Level, intensity, capacity, or score. 20/100 → 85/100.",
    examplePrompt: "“Our performance gauge spiked from twenty percent right up into the critical eighty-five percent zone.”",
    traitId: "trait_automotive_tachometer_needle_gauge",
    concern: "IntensityMeasurement",
    targetScope: "gauge_needle",
    channels: "rotate, strokeDashoffset",
    conflicts: "None",
    frameExpression: "needleAngle = -90 + (85 / 100) * 180",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>`,
    renderHtml: `
      <div class="gauge-meter-stage">
        <svg viewBox="0 0 160 90" class="gauge-svg">
          <path d="M 20 80 A 60 60 0 0 1 140 80" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="12" stroke-linecap="round"/>
          <path d="M 20 80 A 60 60 0 0 1 140 80" fill="none" stroke="url(#gaugeGrad)" stroke-width="12" stroke-linecap="round" stroke-dasharray="188" stroke-dashoffset="40"/>
          <line x1="80" y1="80" x2="125" y2="40" stroke="#f43f5e" stroke-width="3" stroke-linecap="round" class="gauge-needle"/>
          <circle cx="80" cy="80" r="6" fill="#fff"/>
          <defs>
            <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#10b981"/>
              <stop offset="60%" stop-color="#f59e0b"/>
              <stop offset="100%" stop-color="#f43f5e"/>
            </linearGradient>
          </defs>
        </svg>
        <div class="gauge-readout">
          <span class="g-val">85 / 100</span>
          <span class="g-lbl">TFLOPS INTENSITY</span>
        </div>
      </div>
    `,
    customCss: `
      .gauge-meter-stage { display: flex; flex-direction: column; align-items: center; justify-content: center; }
      .gauge-svg { width: 140px; height: 80px; }
      .gauge-needle { transform-origin: 80px 80px; animation: needle-sweep 3s infinite ease-in-out; }
      .gauge-readout { display: flex; flex-direction: column; align-items: center; margin-top: -10px; }
      .g-val { font-family: monospace; font-size: 18px; font-weight: 900; color: #fff; text-shadow: 0 0 14px rgba(244,63,94,0.6); }
      .g-lbl { font-family: monospace; font-size: 9px; color: #94a3b8; font-weight: 800; }
      @keyframes needle-sweep { 0%, 100% { transform: rotate(-40deg); } 50% { transform: rotate(35deg); } }
    `,
    footerNote: "Polar Dial Tachometer • Calibrated Radial Needle Sweep",
    slug: "gauge-meter"
  },

  // 29. Ranking / Leaderboard
  {
    id: 29,
    badge: "ARCHETYPE #29",
    name: "Ranking / Leaderboard",
    category: "structures",
    categoryLabel: "Structures & Lists",
    definition: "Things are ordered by performance. #1, #2, #3.",
    examplePrompt: "“Prometheus captured the number one global benchmark ranking across video throughput.”",
    traitId: "trait_podium_leaderboard_tier",
    concern: "ComparativeRanking",
    targetScope: "podium_card",
    channels: "translateY, scale, goldGlow",
    conflicts: "None",
    frameExpression: "podiumHeight[i] = heightValues[i]",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.45 1-1 1H7v4h10v-4h-2c-.55 0-1-.45-1-1v-2.34"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`,
    renderHtml: `
      <div class="podium-leaderboard-stage">
        <div class="podium-col col-silver">
          <span class="p-rank">#2</span>
          <div class="p-bar b-silver"><span>Seedance</span></div>
        </div>
        <div class="podium-col col-gold">
          <span class="p-crown">👑</span>
          <span class="p-rank r-gold">#1</span>
          <div class="p-bar b-gold"><span>PROMETHEUS</span></div>
        </div>
        <div class="podium-col col-bronze">
          <span class="p-rank">#3</span>
          <div class="p-bar b-bronze"><span>Legacy AI</span></div>
        </div>
      </div>
    `,
    customCss: `
      .podium-leaderboard-stage { display: flex; align-items: flex-end; gap: 12px; width: 85%; height: 130px; justify-content: center; }
      .podium-col { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; }
      .p-rank { font-family: monospace; font-size: 12px; font-weight: 900; color: #94a3b8; }
      .r-gold { color: #ffd700; font-size: 14px; text-shadow: 0 0 10px #ffd700; }
      .p-crown { font-size: 16px; animation: crown-bob 2s infinite ease-in-out; }
      .p-bar { width: 100%; border-radius: 8px 8px 0 0; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; color: #fff; }
      .b-gold { height: 80px; background: linear-gradient(180deg, #ffd700, #b45309); box-shadow: 0 0 24px rgba(255,215,0,0.4); }
      .b-silver { height: 55px; background: linear-gradient(180deg, #94a3b8, #475569); }
      .b-bronze { height: 40px; background: linear-gradient(180deg, #b45309, #78350f); }
      @keyframes crown-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
    `,
    footerNote: "3D Stepped Podium • Gold Sovereign #1 Benchmark",
    slug: "ranking-leaderboard"
  },

  // 30. Score / Rating
  {
    id: 30,
    badge: "ARCHETYPE #30",
    name: "Score / Rating",
    category: "metrics",
    categoryLabel: "Metrics & Quantitative",
    definition: "Quality or performance is expressed numerically. 9.4/10, A+, 85%.",
    examplePrompt: "“Our enterprise audit scored an authoritative nine point eight out of ten.”",
    traitId: "trait_radiant_star_score_card",
    concern: "QualitativeScoring",
    targetScope: "score_rating_card",
    channels: "scale, starStagger, goldGlow",
    conflicts: "None",
    frameExpression: "starGlow[i] = clamp(0, 1, (frame - i * 6) / 10)",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    renderHtml: `
      <div class="score-rating-card">
        <div class="score-main-row">
          <span class="score-number">9.8</span>
          <span class="score-max">/ 10</span>
        </div>
        <div class="stars-row">
          <span class="star-g">★</span>
          <span class="star-g">★</span>
          <span class="star-g">★</span>
          <span class="star-g">★</span>
          <span class="star-g">★</span>
        </div>
        <span class="score-verdict">WORLD-CLASS BENCHMARK</span>
      </div>
    `,
    customCss: `
      .score-rating-card { display: flex; flex-direction: column; align-items: center; gap: 6px; background: rgba(255,215,0,0.06); border: 1px solid rgba(255,215,0,0.35); padding: 16px 28px; border-radius: 16px; box-shadow: 0 12px 30px rgba(0,0,0,0.6); }
      .score-main-row { display: flex; align-items: baseline; gap: 4px; }
      .score-number { font-size: 46px; font-weight: 900; color: #ffd700; text-shadow: 0 0 20px rgba(255,215,0,0.6); font-family: monospace; }
      .score-max { font-size: 16px; font-weight: 700; color: #94a3b8; font-family: monospace; }
      .stars-row { display: flex; gap: 4px; font-size: 20px; color: #ffd700; }
      .score-verdict { font-family: monospace; font-size: 10px; font-weight: 900; color: #fff; letter-spacing: 0.15em; background: rgba(255,255,255,0.08); padding: 3px 8px; border-radius: 4px; }
    `,
    footerNote: "Golden Star Matrix • High-Salience Decimal Score",
    slug: "score-rating"
  },

  // 31. Table / Matrix
  {
    id: 31,
    badge: "ARCHETYPE #31",
    name: "Table / Matrix",
    category: "structures",
    categoryLabel: "Structures & Lists",
    definition: "Multiple attributes need simultaneous comparison. Product A/B/C × price/features.",
    examplePrompt: "“Comparing feature velocity across Free, Pro, and Enterprise clusters.”",
    traitId: "trait_matrix_feature_comparison_grid",
    concern: "MultiAttributeMatrix",
    targetScope: "matrix_table",
    channels: "opacity, highlightColumn, scale",
    conflicts: "None",
    frameExpression: "rowHighlight = floor((frame / 20) % 3)",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>`,
    renderHtml: `
      <div class="matrix-table-card">
        <div class="m-row m-head">
          <span>FEATURE</span>
          <span>FREE</span>
          <span class="col-prom">PROMETHEUS</span>
        </div>
        <div class="m-row">
          <span>60fps GLSL</span>
          <span class="m-cross">✕</span>
          <span class="m-check">✓ 60 FPS</span>
        </div>
        <div class="m-row">
          <span>3D Spatial DSP</span>
          <span class="m-cross">✕</span>
          <span class="m-check">✓ 5-Layer</span>
        </div>
      </div>
    `,
    customCss: `
      .matrix-table-card { width: 90%; background: #080a14; border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; overflow: hidden; font-family: monospace; font-size: 11px; }
      .m-row { display: grid; grid-template-columns: 2fr 1fr 2fr; padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.06); align-items: center; }
      .m-head { background: rgba(255,255,255,0.04); font-weight: 900; color: #94a3b8; }
      .col-prom { color: var(--accent-cyan); }
      .m-cross { color: #f43f5e; font-weight: 900; }
      .m-check { color: #10b981; font-weight: 900; }
    `,
    footerNote: "Multi-Tier Comparison Matrix • Highlight Column Focus",
    slug: "table-matrix"
  },

  // 32. Calendar / Schedule
  {
    id: 32,
    badge: "ARCHETYPE #32",
    name: "Calendar / Schedule",
    category: "structures",
    categoryLabel: "Structures & Lists",
    definition: "Dates, deadlines, frequency, or scheduling matter. “Every Monday at 9 AM”.",
    examplePrompt: "“Every Monday morning at exactly nine AM, our autonomous engine deploys.”",
    traitId: "trait_calendar_tearoff_schedule_card",
    concern: "ScheduleCadence",
    targetScope: "calendar_tile",
    channels: "rotateX, pageFlip, shadowDepth",
    conflicts: "None",
    frameExpression: "flipAngle = sin(frame * 0.1) * 10",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    renderHtml: `
      <div class="calendar-desk-widget">
        <div class="cal-header"><span>AUGUST</span></div>
        <div class="cal-body">
          <span class="cal-day">MON</span>
          <span class="cal-date">18</span>
          <div class="cal-pill">⚡ 9:00 AM SYNC</div>
        </div>
      </div>
    `,
    customCss: `
      .calendar-desk-widget { width: 120px; background: #0f1322; border: 1px solid rgba(255,255,255,0.18); border-radius: 14px; overflow: hidden; display: flex; flex-direction: column; align-items: center; box-shadow: 0 12px 30px rgba(0,0,0,0.7); }
      .cal-header { width: 100%; background: #f43f5e; padding: 6px 0; text-align: center; font-family: monospace; font-size: 11px; font-weight: 900; color: #fff; letter-spacing: 0.1em; }
      .cal-body { padding: 12px 10px; display: flex; flex-direction: column; align-items: center; gap: 2px; }
      .cal-day { font-family: monospace; font-size: 10px; font-weight: 800; color: #94a3b8; }
      .cal-date { font-size: 38px; font-weight: 900; color: #fff; line-height: 1; }
      .cal-pill { margin-top: 6px; font-family: monospace; font-size: 9px; font-weight: 800; color: var(--accent-cyan); background: rgba(6,182,212,0.15); padding: 2px 6px; border-radius: 4px; }
    `,
    footerNote: "Tear-Off Calendar Desk Widget • High-Impact Date Flip",
    slug: "calendar-schedule"
  },

  // 33. Clock / Time Asset
  {
    id: 33,
    badge: "ARCHETYPE #33",
    name: "Clock / Time Asset",
    category: "communication",
    categoryLabel: "Communication & Concepts",
    definition: "Specific duration or time pressure matters. “Only 30 seconds left”.",
    examplePrompt: "“You have only thirty seconds remaining before this window closes forever.”",
    traitId: "trait_quartz_analog_clock_dial",
    concern: "TimeElapsedDuration",
    targetScope: "clock_hands",
    channels: "rotateSecond, rotateMinute",
    conflicts: "None",
    frameExpression: "secondAngle = (frame * 6) % 360",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    renderHtml: `
      <div class="clock-dial-stage">
        <div class="analog-dial">
          <div class="clock-mark m12"></div>
          <div class="clock-mark m3"></div>
          <div class="clock-mark m6"></div>
          <div class="clock-mark m9"></div>
          <div class="clock-hand hand-min"></div>
          <div class="clock-hand hand-sec"></div>
          <div class="clock-pin"></div>
        </div>
        <div class="clock-meta">
          <span class="clk-dur">00:30.00</span>
          <span class="clk-lbl">TIME REMAINING</span>
        </div>
      </div>
    `,
    customCss: `
      .clock-dial-stage { display: flex; align-items: center; gap: 18px; }
      .analog-dial { width: 80px; height: 80px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.3); background: #0a0a14; position: relative; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 20px rgba(6,182,212,0.3); }
      .clock-pin { width: 6px; height: 6px; border-radius: 50%; background: #06b6d4; z-index: 10; }
      .clock-hand { position: absolute; bottom: 50%; left: calc(50% - 1px); transform-origin: bottom center; border-radius: 2px; }
      .hand-min { width: 3px; height: 26px; background: #fff; transform: rotate(45deg); }
      .hand-sec { width: 1.5px; height: 32px; background: #f43f5e; animation: clock-sweep 4s infinite linear; }
      .clock-mark { position: absolute; background: rgba(255,255,255,0.4); }
      .m12 { top: 4px; width: 2px; height: 6px; }
      .m6 { bottom: 4px; width: 2px; height: 6px; }
      .m3 { right: 4px; width: 6px; height: 2px; }
      .m9 { left: 4px; width: 6px; height: 2px; }
      .clock-meta { display: flex; flex-direction: column; gap: 2px; }
      .clk-dur { font-family: monospace; font-size: 20px; font-weight: 900; color: #fff; }
      .clk-lbl { font-family: monospace; font-size: 10px; color: var(--accent-cyan); font-weight: 800; }
      @keyframes clock-sweep { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `,
    footerNote: "Analog Quartz Chronometer • Smooth Sweeping Second Hand",
    slug: "clock-time-asset"
  },

  // 34. Timer / Countdown
  {
    id: 34,
    badge: "ARCHETYPE #34",
    name: "Timer / Countdown",
    category: "communication",
    categoryLabel: "Communication & Concepts",
    definition: "An explicit countdown or urgency exists. 00:10 → 00:00.",
    examplePrompt: "“Only eight seconds left before the final window locks permanently.”",
    traitId: "trait_digital_led_urgent_countdown",
    concern: "UrgencyCountdown",
    targetScope: "countdown_digits",
    channels: "textContent, glowPulse, colorShift",
    conflicts: "None",
    frameExpression: "secondsLeft = max(0, 10 - floor(frame / 30))",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 8 14"/></svg>`,
    renderHtml: `
      <div class="timer-countdown-box">
        <span class="timer-prefix">LIMITED ACCESS WINDOW</span>
        <div class="timer-digits">00:08:42</div>
        <span class="timer-urgency">⚡ CLOSING PERMANENTLY</span>
      </div>
    `,
    customCss: `
      .timer-countdown-box { display: flex; flex-direction: column; align-items: center; gap: 4px; }
      .timer-prefix { font-family: monospace; font-size: 11px; color: #f43f5e; font-weight: 800; letter-spacing: 0.15em; }
      .timer-digits { font-family: monospace; font-size: 44px; font-weight: 900; color: #fff; letter-spacing: 0.05em; text-shadow: 0 0 24px rgba(244,63,94,0.6); animation: timer-pulse 1s infinite; }
      .timer-urgency { font-family: monospace; font-size: 11px; color: #fda4af; font-weight: 700; }
      @keyframes timer-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.8; } }
    `,
    footerNote: "Digital LED Urgent Countdown • High-Intensity Tension Glow",
    slug: "timer-countdown"
  },

  // 35. Money / Financial Visualization
  {
    id: 35,
    badge: "ARCHETYPE #35",
    name: "Money / Financial Visualization",
    category: "metrics",
    categoryLabel: "Metrics & Quantitative",
    definition: "Money, cost, profit, revenue, or spending is central. Cash stacks, balance, financial ticker.",
    examplePrompt: "“Net profit margins expanded with explosive green candlestick momentum.”",
    traitId: "trait_candlestick_financial_ticker",
    concern: "FinancialLiquidityMetrics",
    targetScope: "candlestick_chart",
    channels: "candleHeight, balanceCounter",
    conflicts: "None",
    frameExpression: "balance = 50000 + sin(frame * 0.1) * 2000",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    renderHtml: `
      <div class="financial-candles-box">
        <div class="fin-head">
          <span class="fin-ticker">PROMETHEUS/USD</span>
          <span class="fin-pnl">+14,280 USD (+34%)</span>
        </div>
        <div class="candles-row">
          <div class="candle c-up c1"><div class="c-wick"></div><div class="c-body"></div></div>
          <div class="candle c-up c2"><div class="c-wick"></div><div class="c-body"></div></div>
          <div class="candle c-down c3"><div class="c-wick"></div><div class="c-body"></div></div>
          <div class="candle c-up c4"><div class="c-wick"></div><div class="c-body"></div></div>
          <div class="candle c-up c5"><div class="c-wick"></div><div class="c-body"></div></div>
        </div>
      </div>
    `,
    customCss: `
      .financial-candles-box { width: 88%; background: #070914; border: 1px solid rgba(16,185,129,0.3); border-radius: 12px; padding: 14px 18px; display: flex; flex-direction: column; gap: 10px; }
      .fin-head { display: flex; justify-content: space-between; font-family: monospace; font-size: 11px; }
      .fin-ticker { color: #94a3b8; font-weight: 800; }
      .fin-pnl { color: #10b981; font-weight: 900; }
      .candles-row { display: flex; align-items: center; justify-content: space-around; height: 60px; }
      .candle { display: flex; flex-direction: column; align-items: center; width: 14px; position: relative; }
      .c-wick { width: 2px; height: 50px; position: absolute; top: 5px; }
      .c-body { width: 12px; z-index: 2; border-radius: 2px; }
      .c-up .c-wick { background: #10b981; }
      .c-up .c-body { background: #10b981; }
      .c-down .c-wick { background: #f43f5e; }
      .c-down .c-body { background: #f43f5e; }
      .c1 .c-body { height: 24px; margin-top: 15px; }
      .c2 .c-body { height: 32px; margin-top: 8px; }
      .c3 .c-body { height: 18px; margin-top: 20px; }
      .c4 .c-body { height: 36px; margin-top: 4px; }
      .c5 .c-body { height: 42px; margin-top: 0px; box-shadow: 0 0 12px #10b981; }
    `,
    footerNote: "Live Candlestick Financial Array • Green Bull Momentum",
    slug: "money-financial-visualization"
  },

  // 36. Equation / Formula
  {
    id: 36,
    badge: "ARCHETYPE #36",
    name: "Equation / Formula",
    category: "communication",
    categoryLabel: "Communication & Concepts",
    definition: "A mathematical relationship is spoken. Revenue − Costs = Profit.",
    examplePrompt: "“When revenue outpaces marginal compute costs, net profit reaches infinity.”",
    traitId: "trait_mathematical_equation_tokens",
    concern: "MathematicalLogic",
    targetScope: "equation_tokens",
    channels: "opacity, scale, highlightPill",
    conflicts: "None",
    frameExpression: "tokenHighlight = floor((frame / 20) % 3)",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    renderHtml: `
      <div class="equation-stage-box">
        <div class="eq-pill eq-rev">REVENUE</div>
        <span class="eq-op">−</span>
        <div class="eq-pill eq-cost">COSTS</div>
        <span class="eq-op">=</span>
        <div class="eq-pill eq-profit">PROFIT</div>
      </div>
    `,
    customCss: `
      .equation-stage-box { display: flex; align-items: center; gap: 8px; font-family: monospace; }
      .eq-pill { padding: 8px 14px; border-radius: 8px; font-weight: 900; font-size: 13px; border: 1px solid rgba(255,255,255,0.15); }
      .eq-rev { background: rgba(56,189,248,0.15); border-color: #38bdf8; color: #38bdf8; }
      .eq-cost { background: rgba(244,63,94,0.15); border-color: #f43f5e; color: #f43f5e; }
      .eq-profit { background: rgba(16,185,129,0.2); border-color: #10b981; color: #10b981; box-shadow: 0 0 20px rgba(16,185,129,0.4); animation: profit-pop 2s infinite ease-in-out; }
      .eq-op { font-size: 22px; font-weight: 900; color: #fff; }
      @keyframes profit-pop { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
    `,
    footerNote: "Mathematical Semantic Equation • Syntax-Highlighted Tokens",
    slug: "equation-formula"
  },

  // 37. Code / Technical Snippet
  {
    id: 37,
    badge: "ARCHETYPE #37",
    name: "Code / Technical Snippet",
    category: "structures",
    categoryLabel: "Structures & Lists",
    definition: "Code, commands, or programming concepts are mentioned. Terminal/code window.",
    examplePrompt: "“Synthesize twenty chunks asynchronously at zero latency using Rust native routines.”",
    traitId: "trait_syntax_highlighted_ide_terminal",
    concern: "TechnicalCodeSyntax",
    targetScope: "terminal_window",
    channels: "typewriterCaret, syntaxHighlight",
    conflicts: "None",
    frameExpression: "codeCharCount = floor((frame / 2) % 80)",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
    renderHtml: `
      <div class="terminal-code-box">
        <div class="term-bar"><span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span><span class="term-title">main.rs</span></div>
        <div class="term-content"><code><span class="kw">async fn</span> <span class="fn">execute_render</span>() -&gt; <span class="typ">Result</span>&lt;()&gt; {<br/>&nbsp;&nbsp;<span class="var">engine</span>.<span class="fn">synthesize</span>(<span class="str">"60fps"</span>).<span class="kw">await</span>?<br/>}</code></div>
      </div>
    `,
    customCss: `
      .terminal-code-box { width: 88%; background: #07080f; border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; overflow: hidden; box-shadow: 0 12px 30px rgba(0,0,0,0.7); }
      .term-bar { background: rgba(255,255,255,0.04); padding: 8px 12px; display: flex; align-items: center; gap: 6px; border-bottom: 1px solid rgba(255,255,255,0.06); }
      .dot { width: 8px; height: 8px; border-radius: 50%; }
      .dot.red { background: #f43f5e; }
      .dot.yellow { background: #f59e0b; }
      .dot.green { background: #10b981; }
      .term-title { margin-left: 8px; font-family: monospace; font-size: 11px; color: #64748b; }
      .term-content { padding: 14px; font-family: "JetBrains Mono", monospace; font-size: 12px; line-height: 1.5; color: #e2e8f0; }
      .kw { color: #f43f5e; font-weight: 700; }
      .fn { color: #38bdf8; }
      .typ { color: #f59e0b; }
      .var { color: #a78bfa; }
      .str { color: #10b981; }
    `,
    footerNote: "Syntax-Highlighted Terminal • Rust Async Micro-Engine",
    slug: "code-technical-snippet"
  },

  // 38. Search / Query Visualization
  {
    id: 38,
    badge: "ARCHETYPE #38",
    name: "Search / Query Visualization",
    category: "communication",
    categoryLabel: "Communication & Concepts",
    definition: "Searching, discovering, researching, or asking is described. Search bar → results.",
    examplePrompt: "“When you search how to beat legacy video tools, our neural engine delivers the authoritative result.”",
    traitId: "trait_search_query_autocomplete_dropdown",
    concern: "SearchDiscoveryInterface",
    targetScope: "search_container",
    channels: "typewriterQuery, dropdownReveal",
    conflicts: "None",
    frameExpression: "queryProgress = clamp(0, 1, frame / 30)",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    renderHtml: `
      <div class="search-query-stage">
        <div class="sq-bar">
          <span class="sq-icon">🔍</span>
          <span class="sq-text">how to render 60fps video</span>
          <span class="sq-cursor">|</span>
        </div>
        <div class="sq-dropdown">
          <div class="sq-item active">⚡ <strong>Prometheus Core Backend</strong> — 12ms/frame</div>
          <div class="sq-item">⚙️ Remotion WebGL R3F Orchestrator</div>
        </div>
      </div>
    `,
    customCss: `
      .search-query-stage { width: 90%; display: flex; flex-direction: column; gap: 6px; }
      .sq-bar { display: flex; align-items: center; gap: 8px; background: #0c0f1d; border: 1px solid #06b6d4; padding: 10px 14px; border-radius: 10px; box-shadow: 0 0 16px rgba(6,182,212,0.3); font-size: 13px; color: #fff; }
      .sq-cursor { color: var(--accent-cyan); animation: cursor-blink 0.8s infinite; }
      .sq-dropdown { background: #090b14; border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; overflow: hidden; font-size: 11px; }
      .sq-item { padding: 8px 12px; color: #94a3b8; border-bottom: 1px solid rgba(255,255,255,0.05); }
      .sq-item.active { background: rgba(6,182,212,0.15); color: #fff; }
      @keyframes cursor-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
    `,
    footerNote: "Live Autocomplete Search Bar • Immediate Resolution Dropdown",
    slug: "search-query-visualization"
  },

  // 39. Notification / Alert
  {
    id: 39,
    badge: "ARCHETYPE #39",
    name: "Notification / Alert",
    category: "communication",
    categoryLabel: "Communication & Concepts",
    definition: "A message, alert, email, notification, or warning appears. Phone notification popping up.",
    examplePrompt: "“A high-priority notification triggers instant executive attention across all channels.”",
    traitId: "trait_floating_ios_notification_pop",
    concern: "HighSalienceAlert",
    targetScope: "notification_card",
    channels: "translateY, scale, opacity",
    conflicts: "None",
    frameExpression: "notifY = max(0, 30 - frame * 1.5)",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
    renderHtml: `
      <div class="notification-box">
        <div class="notif-icon">🔔</div>
        <div class="notif-content">
          <span class="notif-app">PROMETHEUS CORE</span>
          <span class="notif-msg">New 60fps render sequence deployed successfully.</span>
        </div>
        <span class="notif-time">now</span>
      </div>
    `,
    customCss: `
      .notification-box { display: flex; align-items: center; gap: 12px; background: rgba(20,20,30,0.85); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.18); padding: 12px 18px; border-radius: 16px; box-shadow: 0 16px 40px rgba(0,0,0,0.6); animation: notif-pop 3.2s infinite var(--ease-apple); width: 85%; }
      .notif-icon { font-size: 22px; }
      .notif-content { display: flex; flex-direction: column; gap: 2px; flex: 1; }
      .notif-app { font-family: monospace; font-size: 10px; color: var(--accent-cyan); font-weight: 800; letter-spacing: 0.1em; }
      .notif-msg { font-size: 12px; color: #fff; font-weight: 600; }
      .notif-time { font-size: 10px; color: #64748b; font-family: monospace; }
      @keyframes notif-pop { 0% { transform: translateY(-20px) scale(0.9); opacity: 0; } 30%, 80% { transform: translateY(0) scale(1); opacity: 1; } 100% { transform: translateY(20px) scale(0.9); opacity: 0; } }
    `,
    footerNote: "Spring-Damped iOS Notification • Real-Time Alert Banner",
    slug: "notification-alert"
  },

  // 40. Communication Asset
  {
    id: 40,
    badge: "ARCHETYPE #40",
    name: "Communication Asset",
    category: "communication",
    categoryLabel: "Communication & Concepts",
    definition: "Conversation or communication is central. Chat bubbles, email, phone call.",
    examplePrompt: "“When the client sends an intake query, the autonomous agent replies in sub-second time.”",
    traitId: "trait_sequential_chat_bubble_flow",
    concern: "ConversationalDialogue",
    targetScope: "chat_bubbles",
    channels: "translateY, opacity, stagger",
    conflicts: "None",
    frameExpression: "bubble1 = clamp(0, 1, frame / 15); bubble2 = clamp(0, 1, (frame - 20) / 15)",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    renderHtml: `
      <div class="chat-flow-box">
        <div class="chat-bubble user-bubble">How fast can we scale to 10k video renders?</div>
        <div class="chat-bubble ai-bubble">Under 12ms per frame with Prometheus clusters. 🚀</div>
      </div>
    `,
    customCss: `
      .chat-flow-box { display: flex; flex-direction: column; gap: 10px; width: 85%; }
      .chat-bubble { padding: 10px 14px; border-radius: 14px; font-size: 12px; font-weight: 600; max-width: 80%; line-height: 1.4; animation: chat-slide 3s infinite var(--ease-apple); }
      .user-bubble { background: rgba(255,255,255,0.1); color: #fff; align-self: flex-start; border-bottom-left-radius: 4px; }
      .ai-bubble { background: linear-gradient(135deg, #7c3aed, #06b6d4); color: #000; font-weight: 700; align-self: flex-end; border-bottom-right-radius: 4px; animation-delay: 0.3s; }
      @keyframes chat-slide { 0% { opacity: 0; transform: translateY(10px); } 20%, 80% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-10px); } }
    `,
    footerNote: "Sequential Chat Dialogue • Staggered Message Ingestion",
    slug: "communication-asset"
  },

  // 41. Social Proof
  {
    id: 41,
    badge: "ARCHETYPE #41",
    name: "Social Proof",
    category: "communication",
    categoryLabel: "Communication & Concepts",
    definition: "Reviews, comments, followers, testimonials, or likes matter. “10,000 people liked it”.",
    examplePrompt: "“Over ten thousand verified engineers starred and liked the new architecture release.”",
    traitId: "trait_social_proof_heart_burst_counter",
    concern: "SocialValidation",
    targetScope: "like_counter_badge",
    channels: "scale, heartBurst, counter",
    conflicts: "None",
    frameExpression: "likeCount = min(10420, frame * 300)",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
    renderHtml: `
      <div class="social-proof-stage">
        <div class="sp-badge">
          <span class="sp-heart">❤️</span>
          <span class="sp-count">+10,420</span>
          <span class="sp-label">LIKES & STARS</span>
        </div>
        <div class="sp-avatars-row">
          <div class="sp-av av1"></div>
          <div class="sp-av av2"></div>
          <div class="sp-av av3"></div>
          <span class="sp-more">+4.8k verified creators</span>
        </div>
      </div>
    `,
    customCss: `
      .social-proof-stage { display: flex; flex-direction: column; align-items: center; gap: 10px; }
      .sp-badge { display: flex; align-items: center; gap: 8px; background: rgba(244,63,94,0.15); border: 1px solid rgba(244,63,94,0.4); padding: 8px 18px; border-radius: 20px; box-shadow: 0 0 20px rgba(244,63,94,0.3); }
      .sp-heart { font-size: 18px; animation: heart-thump 1.2s infinite ease-in-out; }
      .sp-count { font-family: monospace; font-size: 16px; font-weight: 900; color: #fff; }
      .sp-label { font-family: monospace; font-size: 9px; font-weight: 800; color: #fda4af; }
      .sp-avatars-row { display: flex; align-items: center; gap: 6px; }
      .sp-av { width: 22px; height: 22px; border-radius: 50%; border: 2px solid #000; }
      .av1 { background: #38bdf8; } .av2 { background: #a855f7; margin-left: -10px; } .av3 { background: #10b981; margin-left: -10px; }
      .sp-more { font-family: monospace; font-size: 10px; color: #94a3b8; margin-left: 6px; }
      @keyframes heart-thump { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.3); } }
    `,
    footerNote: "Floating Social Hearts • Multiplying Verified Peer Avatars",
    slug: "social-proof"
  },

  // 42. Crowd / Volume Visualization
  {
    id: 42,
    badge: "ARCHETYPE #42",
    name: "Crowd / Volume Visualization",
    category: "communication",
    categoryLabel: "Communication & Concepts",
    definition: "A large quantity of people/things needs representation. One person → thousands of people.",
    examplePrompt: "“From a single lonely creator scaling up to an unstoppable army of thousands.”",
    traitId: "trait_crowd_volume_particle_lattice",
    concern: "VolumeDensityExpansion",
    targetScope: "crowd_lattice",
    channels: "densityCount, scale, opacity",
    conflicts: "None",
    frameExpression: "densityScale = 1.0 + (frame / 30)",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    renderHtml: `
      <div class="crowd-volume-stage">
        <div class="crowd-grid">
          <span class="c-dot">👤</span><span class="c-dot">👤</span><span class="c-dot">👤</span><span class="c-dot">👤</span><span class="c-dot">👤</span>
          <span class="c-dot">👤</span><span class="c-dot gold">👑</span><span class="c-dot">👤</span><span class="c-dot">👤</span><span class="c-dot">👤</span>
          <span class="c-dot">👤</span><span class="c-dot">👤</span><span class="c-dot">👤</span><span class="c-dot">👤</span><span class="c-dot">👤</span>
        </div>
        <div class="crowd-tag">10,000 ACTIVE CREATORS</div>
      </div>
    `,
    customCss: `
      .crowd-volume-stage { display: flex; flex-direction: column; align-items: center; gap: 10px; }
      .crowd-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; font-size: 18px; }
      .c-dot { animation: crowd-pulse 2s infinite ease-in-out; }
      .c-dot.gold { animation: crown-pop 1.5s infinite; filter: drop-shadow(0 0 8px #ffd700); }
      .crowd-tag { font-family: monospace; font-size: 11px; font-weight: 900; color: var(--accent-cyan); background: rgba(6,182,212,0.15); padding: 4px 12px; border-radius: 6px; }
      @keyframes crowd-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
      @keyframes crown-pop { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.2); } }
    `,
    footerNote: "Multiplying Avatar Density Lattice • Mass Volume Representation",
    slug: "crowd-volume-visualization"
  },

  // 43. Physical Scale Visualization
  {
    id: 43,
    badge: "ARCHETYPE #43",
    name: "Physical Scale Visualization",
    category: "transformations",
    categoryLabel: "Transformations & States",
    definition: "A difference in magnitude or size needs to be shown. Tiny startup vs massive corporation.",
    examplePrompt: "“A nimble one-person AI startup completely out-weighs a bloated five-thousand-person legacy agency.”",
    traitId: "trait_balance_beam_scale_physics",
    concern: "ScaleDisparity",
    targetScope: "balance_beam",
    channels: "rotate, weightTilt",
    conflicts: "None",
    frameExpression: "beamTilt = sin(frame * 0.08) * 12",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18M3 7l9-4 9 4M6 15l-3-8h6l-3 8zM18 15l-3-8h6l-3 8z"/></svg>`,
    renderHtml: `
      <div class="scale-stage-box">
        <div class="scale-beam">
          <div class="scale-pan pan-left">
            <span class="scale-tag cyan">1-PERSON AI</span>
            <span class="scale-weight">⚡ 100x Velocity</span>
          </div>
          <div class="scale-pan pan-right">
            <span class="scale-tag red">5,000 CORP</span>
            <span class="scale-weight">🐌 40hr Lag</span>
          </div>
        </div>
        <div class="scale-fulcrum"></div>
      </div>
    `,
    customCss: `
      .scale-stage-box { display: flex; flex-direction: column; align-items: center; width: 88%; }
      .scale-beam { width: 100%; display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #fff; padding-bottom: 10px; animation: beam-tilt 3s infinite ease-in-out; transform-origin: center bottom; }
      .scale-pan { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 14px; border-radius: 10px; background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.15); }
      .scale-tag { font-family: monospace; font-size: 10px; font-weight: 900; }
      .scale-tag.cyan { color: #38bdf8; }
      .scale-tag.red { color: #f43f5e; }
      .scale-weight { font-size: 11px; font-weight: 700; color: #fff; }
      .scale-fulcrum { width: 0; height: 0; border-left: 14px solid transparent; border-right: 14px solid transparent; border-bottom: 20px solid var(--accent-cyan); margin-top: 4px; }
      @keyframes beam-tilt { 0%, 100% { transform: rotate(-8deg); } 50% { transform: rotate(8deg); } }
    `,
    footerNote: "Dynamic Fulcrum Balance Beam • Agility vs Bloat Disparity",
    slug: "physical-scale-visualization"
  },

  // 44. Object Collection / Inventory
  {
    id: 44,
    badge: "ARCHETYPE #44",
    name: "Object Collection / Inventory",
    category: "structures",
    categoryLabel: "Structures & Lists",
    definition: "Multiple concrete objects belong together. “You have 500 files” → files accumulate.",
    examplePrompt: "“Instantly compile hundreds of discrete production asset files into one synchronized master library.”",
    traitId: "trait_stacked_isometric_card_inventory",
    concern: "InventoryAccumulation",
    targetScope: "asset_stack",
    channels: "translateZ, translateY, stagger",
    conflicts: "None",
    frameExpression: "stackDepth = min(4, frame / 15)",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
    renderHtml: `
      <div class="inventory-stack-stage">
        <div class="inv-card c-back"></div>
        <div class="inv-card c-mid"></div>
        <div class="inv-card c-front">
          <span class="inv-icon">📁</span>
          <span class="inv-name">master-asset-library</span>
          <span class="inv-badge">500 FILES INGESTED</span>
        </div>
      </div>
    `,
    customCss: `
      .inventory-stack-stage { position: relative; width: 180px; height: 90px; display: flex; align-items: center; justify-content: center; }
      .inv-card { position: absolute; width: 160px; height: 75px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.15); transition: all 0.3s; }
      .c-back { background: #070914; top: 0; transform: scale(0.9); opacity: 0.4; }
      .c-mid { background: #0d1224; top: 8px; transform: scale(0.95); opacity: 0.7; }
      .c-front { background: rgba(20,25,45,0.95); top: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; box-shadow: 0 12px 30px rgba(0,0,0,0.7); animation: inv-bob 2.5s infinite ease-in-out; }
      .inv-icon { font-size: 16px; }
      .inv-name { font-size: 11px; font-weight: 800; color: #fff; }
      .inv-badge { font-family: monospace; font-size: 8px; color: var(--accent-cyan); font-weight: 900; background: rgba(6,182,212,0.15); padding: 1px 6px; border-radius: 4px; }
      @keyframes inv-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
    `,
    footerNote: "3D Isometric Layered Stack • Concrete Asset Accumulation",
    slug: "object-collection-inventory"
  },

  // 45. Reveal / Hidden Asset
  {
    id: 45,
    badge: "ARCHETYPE #45",
    name: "Reveal / Hidden Asset",
    category: "transformations",
    categoryLabel: "Transformations & States",
    definition: "Something hidden, unknown, secret, or discovered is discussed. Locked box → reveal.",
    examplePrompt: "“Unlock the hidden competitive moat embedded deeply inside our compiler architecture.”",
    traitId: "trait_lockbox_vault_radial_reveal",
    concern: "HiddenMoatDiscovery",
    targetScope: "vault_door",
    channels: "rotateY, radialRays, scale",
    conflicts: "None",
    frameExpression: "vaultOpen = clamp(0, 1, frame / 30)",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
    renderHtml: `
      <div class="reveal-vault-stage">
        <div class="vault-rays"></div>
        <div class="vault-core">
          <span class="v-lock">🔓</span>
          <span class="v-secret">PROPRIETARY MOAT</span>
          <span class="v-tag">100% EXCLUSIVE</span>
        </div>
      </div>
    `,
    customCss: `
      .reveal-vault-stage { position: relative; width: 100%; display: flex; align-items: center; justify-content: center; }
      .vault-rays { position: absolute; width: 120px; height: 120px; background: radial-gradient(circle, rgba(255,215,0,0.3), transparent 70%); animation: rays-spin 4s infinite linear; }
      .vault-core { position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; gap: 4px; background: #0c0f1d; border: 1px solid #ffd700; padding: 14px 24px; border-radius: 14px; box-shadow: 0 0 30px rgba(255,215,0,0.4); }
      .v-lock { font-size: 24px; }
      .v-secret { font-family: monospace; font-size: 13px; font-weight: 900; color: #ffd700; letter-spacing: 0.1em; }
      .v-tag { font-family: monospace; font-size: 9px; color: #fff; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; }
      @keyframes rays-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `,
    footerNote: "Vault Door Unlock • Radiant Golden Secret Discovery",
    slug: "reveal-hidden-asset"
  },

  // 46. Cause → Effect Visualization
  {
    id: 46,
    badge: "ARCHETYPE #46",
    name: "Cause → Effect Visualization",
    category: "processes",
    categoryLabel: "Processes & Workflows",
    definition: "One action produces another outcome. Action → consequence.",
    examplePrompt: "“When you optimize ingestion speed, downstream rendering velocity explodes exponentially.”",
    traitId: "trait_domino_cascade_cause_effect",
    concern: "CausalPropagation",
    targetScope: "domino_tiles",
    channels: "rotateZ, triggerRipple",
    conflicts: "None",
    frameExpression: "dominoAngle[i] = min(75, max(0, (frame - i * 8) * 10))",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`,
    renderHtml: `
      <div class="cause-effect-box">
        <div class="ce-card ce-cause">
          <span class="ce-lbl">CAUSE</span>
          <span class="ce-txt">⚡ Low Latency</span>
        </div>
        <div class="ce-arrow">➔➔</div>
        <div class="ce-card ce-effect">
          <span class="ce-lbl">EFFECT</span>
          <span class="ce-txt">🚀 10x Retention</span>
        </div>
      </div>
    `,
    customCss: `
      .cause-effect-box { display: flex; align-items: center; gap: 14px; width: 88%; justify-content: center; }
      .ce-card { flex: 1; padding: 14px 16px; border-radius: 12px; display: flex; flex-direction: column; gap: 4px; }
      .ce-cause { background: rgba(56,189,248,0.1); border: 1px solid #38bdf8; }
      .ce-effect { background: rgba(16,185,129,0.1); border: 1px solid #10b981; box-shadow: 0 0 20px rgba(16,185,129,0.3); }
      .ce-lbl { font-family: monospace; font-size: 10px; font-weight: 900; color: #94a3b8; }
      .ce-txt { font-weight: 800; font-size: 13px; color: #fff; }
      .ce-arrow { font-size: 18px; font-weight: 900; color: var(--accent-cyan); animation: arrow-shuttle 1.5s infinite ease-in-out; }
      @keyframes arrow-shuttle { 0%, 100% { transform: translateX(0); opacity: 0.5; } 50% { transform: translateX(6px); opacity: 1; } }
    `,
    footerNote: "Action-to-Consequence Conduit • Cascading Propagation",
    slug: "cause-effect-visualization"
  },

  // 47. Problem → Solution Visualization
  {
    id: 47,
    badge: "ARCHETYPE #47",
    name: "Problem → Solution Visualization",
    category: "processes",
    categoryLabel: "Processes & Workflows",
    definition: "A pain point is followed by a resolution. Chaos → organized system.",
    examplePrompt: "“We replace fragile tangled spaghetti code with an ultra-clean deterministic grid.”",
    traitId: "trait_chaos_to_order_mesh_resolution",
    concern: "ProblemResolutionTransition",
    targetScope: "order_grid",
    channels: "noiseDeform, gridSnap, colorTransition",
    conflicts: "None",
    frameExpression: "orderRatio = clamp(0, 1, frame / 35)",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>`,
    renderHtml: `
      <div class="prob-sol-stage">
        <div class="ps-side ps-prob">
          <span class="ps-tag">⚠️ PROBLEM: CHAOS</span>
          <span class="ps-desc">12 Unsynced Scripts</span>
        </div>
        <div class="ps-trans">➔</div>
        <div class="ps-side ps-sol">
          <span class="ps-tag cyan">✨ SOLUTION: ORDER</span>
          <span class="ps-desc">1 Master Compiler</span>
        </div>
      </div>
    `,
    customCss: `
      .prob-sol-stage { display: flex; align-items: center; gap: 12px; width: 90%; justify-content: center; }
      .ps-side { flex: 1; padding: 14px 16px; border-radius: 12px; display: flex; flex-direction: column; gap: 4px; }
      .ps-prob { background: rgba(244,63,94,0.1); border: 1px solid rgba(244,63,94,0.4); }
      .ps-sol { background: rgba(6,182,212,0.15); border: 1px solid #06b6d4; box-shadow: 0 0 20px rgba(6,182,212,0.3); }
      .ps-tag { font-family: monospace; font-size: 10px; font-weight: 900; color: #f43f5e; }
      .ps-tag.cyan { color: #06b6d4; }
      .ps-desc { font-weight: 800; font-size: 12px; color: #fff; }
      .ps-trans { font-size: 20px; font-weight: 900; color: #fff; }
    `,
    footerNote: "Chaos-to-Order Resolution • Deterministic Grid Transformation",
    slug: "problem-solution-visualization"
  },

  // 48. Input → Output Visualization
  {
    id: 48,
    badge: "ARCHETYPE #48",
    name: "Input → Output Visualization",
    category: "processes",
    categoryLabel: "Processes & Workflows",
    definition: "Something enters a system and something emerges. Raw data → processed insight.",
    examplePrompt: "“Raw audio speech tokens enter our neural intake and emerge as a diamond-grade 60fps render.”",
    traitId: "trait_funnel_refinement_diamond_output",
    concern: "InputOutputSynthesis",
    targetScope: "refinement_funnel",
    channels: "scale, particleIntake, diamondGlow",
    conflicts: "None",
    frameExpression: "synthesisRate = (frame % 30) / 30",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>`,
    renderHtml: `
      <div class="funnel-io-stage">
        <div class="io-node io-in"><span>🎤 Raw Audio Tokens</span></div>
        <div class="io-funnel">🔻 SYNTHESIS</div>
        <div class="io-node io-out"><span>💎 60 FPS Master Video</span></div>
      </div>
    `,
    customCss: `
      .funnel-io-stage { display: flex; align-items: center; gap: 10px; width: 90%; justify-content: center; }
      .io-node { padding: 12px 14px; border-radius: 10px; font-size: 12px; font-weight: 800; color: #fff; }
      .io-in { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); }
      .io-funnel { font-family: monospace; font-size: 9px; font-weight: 900; color: var(--accent-cyan); background: rgba(6,182,212,0.15); padding: 4px 8px; border-radius: 4px; }
      .io-out { background: linear-gradient(135deg, rgba(124,58,237,0.3), rgba(6,182,212,0.3)); border: 1px solid #06b6d4; box-shadow: 0 0 20px rgba(6,182,212,0.4); animation: diamond-pulse 2s infinite ease-in-out; }
      @keyframes diamond-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
    `,
    footerNote: "Raw Ingestion Funnel • Diamond-Grade Synthesized Master",
    slug: "input-output-visualization"
  },

  // 49. Loop / Cycle
  {
    id: 49,
    badge: "ARCHETYPE #49",
    name: "Loop / Cycle",
    category: "processes",
    categoryLabel: "Processes & Workflows",
    definition: "A recurring behavior or feedback loop is discussed. Marketing → sales → revenue → marketing.",
    examplePrompt: "“Marketing feeds sales, sales drives revenue, and revenue powers autonomous marketing reinvestment.”",
    traitId: "trait_closed_loop_orbital_flywheel",
    concern: "FeedbackLoopCompounding",
    targetScope: "flywheel_ring",
    channels: "rotate, orbitalSpeed",
    conflicts: "None",
    frameExpression: "orbitalAngle = (frame * 3) % 360",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>`,
    renderHtml: `
      <div class="loop-cycle-stage">
        <div class="cycle-ring">
          <div class="cycle-item item-c1">Marketing</div>
          <div class="cycle-item item-c2">Sales</div>
          <div class="cycle-item item-c3">Revenue</div>
          <div class="cycle-arrow">↻</div>
        </div>
      </div>
    `,
    customCss: `
      .loop-cycle-stage { display: flex; align-items: center; justify-content: center; }
      .cycle-ring { position: relative; width: 140px; height: 140px; border: 2px dashed rgba(6,182,212,0.4); border-radius: 50%; display: flex; align-items: center; justify-content: center; animation: cycle-rotate 8s infinite linear; }
      .cycle-item { position: absolute; font-family: monospace; font-size: 10px; font-weight: 800; background: #000; border: 1px solid rgba(255,255,255,0.2); padding: 4px 8px; border-radius: 6px; color: #fff; }
      .item-c1 { top: -12px; color: #06b6d4; }
      .item-c2 { bottom: 12px; right: -16px; color: #7c3aed; }
      .item-c3 { bottom: 12px; left: -16px; color: #10b981; }
      .cycle-arrow { font-size: 24px; color: #fff; animation: cycle-counter 8s infinite linear; }
      @keyframes cycle-rotate { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      @keyframes cycle-counter { 0% { transform: rotate(0deg); } 100% { transform: rotate(-360deg); } }
    `,
    footerNote: "Continuous Compounding Flywheel • Closed Feedback Loop",
    slug: "loop-cycle"
  },

  // 50. Decision Tree / Branching
  {
    id: 50,
    badge: "ARCHETYPE #50",
    name: "Decision Tree / Branching",
    category: "processes",
    categoryLabel: "Processes & Workflows",
    definition: "Choices or conditional paths are described. “If X, do Y; otherwise do Z”.",
    examplePrompt: "“If token density exceeds threshold, trigger GPU cluster Y; otherwise execute fallback Z.”",
    traitId: "trait_conditional_decision_branch_logic",
    concern: "ConditionalBranchExecution",
    targetScope: "branch_nodes",
    channels: "activeBranch, pulseBeam",
    conflicts: "None",
    frameExpression: "selectedPath = (frame % 60) < 30 ? 1 : 0",
    svgIcon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><path d="M10 6.5h4M17.5 10v4"/></svg>`,
    renderHtml: `
      <div class="decision-tree-box">
        <div class="tree-root">Condition: If X (Density &gt; 80)</div>
        <div class="tree-branches">
          <div class="tree-branch b-true"><span class="b-tag">YES (TRUE)</span><span class="b-action">⚡ Execute Modal GPU</span></div>
          <div class="tree-branch b-false"><span class="b-tag">NO (FALSE)</span><span class="b-action">🛡️ Fast Remotion Fallback</span></div>
        </div>
      </div>
    `,
    customCss: `
      .decision-tree-box { display: flex; flex-direction: column; align-items: center; gap: 12px; width: 90%; }
      .tree-root { padding: 8px 16px; border-radius: 8px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); font-weight: 800; font-size: 12px; color: #fff; font-family: monospace; }
      .tree-branches { display: flex; gap: 14px; }
      .tree-branch { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 14px; border-radius: 10px; background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.1); font-size: 11px; }
      .b-true { border-color: #10b981; color: #10b981; box-shadow: 0 0 16px rgba(16,185,129,0.3); }
      .b-false { border-color: #f43f5e; color: #f43f5e; }
      .b-tag { font-family: monospace; font-size: 9px; font-weight: 900; }
      .b-action { font-weight: 700; color: #fff; }
    `,
    footerNote: "Dynamic Conditional Branching • Binary Decision Paths",
    slug: "decision-tree-branching"
  }
];

// Sort by ID
ARCHETYPES.sort((a, b) => a.id - b.id);

console.log(`[ARCHETYPE_BUILDER] Compiling ${ARCHETYPES.length} Authoritative Visual Asset Archetypes...`);

// Compile HTML content
const htmlContent = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Prometheus Master Visual Asset Motion Suite — All 49 Visual Archetypes (2–50)</title>
  
  <!-- WebFonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=JetBrains+Mono:wght@400;700;800&family=Outfit:wght@600;800;900&display=swap" rel="stylesheet">

  <style>
    :root {
      --bg-primary: #050508;
      --bg-secondary: #0c0d14;
      --bg-card: #12131f;
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
      padding-bottom: 90px;
      -webkit-font-smoothing: antialiased;
    }

    /* HEADER STYLES */
    header {
      position: sticky; top: 0; z-index: 100;
      background: rgba(5, 5, 8, 0.90);
      backdrop-filter: blur(24px) saturate(180%);
      border-bottom: 1px solid var(--border-subtle);
      padding: 16px 36px;
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px;
    }

    .brand { display: flex; align-items: center; gap: 14px; }
    .brand-logo {
      width: 42px; height: 42px;
      background: linear-gradient(135deg, var(--accent-purple), var(--accent-cyan));
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      font-weight: 900; font-size: 20px; color: #fff;
      box-shadow: 0 0 24px rgba(124, 58, 237, 0.5);
    }
    .brand-title h1 { font-size: 18px; font-weight: 800; letter-spacing: -0.02em; }
    .brand-title p { font-size: 12px; color: var(--text-secondary); }

    .nav-links { display: flex; align-items: center; gap: 10px; }
    .nav-btn {
      background: var(--bg-secondary); border: 1px solid var(--border-subtle);
      color: var(--text-secondary); padding: 8px 14px; border-radius: 8px;
      font-size: 12px; font-weight: 600; text-decoration: none; transition: all 0.2s;
    }
    .nav-btn:hover, .nav-btn.active { background: rgba(255, 255, 255, 0.1); color: #fff; border-color: rgba(255,255,255,0.25); }
    .nav-btn.highlight { background: rgba(6, 182, 212, 0.15); border-color: rgba(6, 182, 212, 0.4); color: var(--accent-cyan); }

    /* CONTROLS & FILTER BAR */
    .filter-bar {
      max-width: 1700px; margin: 24px auto 0 auto; padding: 0 36px;
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px;
    }

    .search-box { position: relative; flex: 1; max-width: 420px; }
    .search-box input {
      width: 100%; padding: 10px 16px; background: var(--bg-secondary);
      border: 1px solid var(--border-subtle); border-radius: 10px;
      color: #fff; font-size: 13px; outline: none; transition: all 0.2s;
    }
    .search-box input:focus { border-color: var(--accent-cyan); box-shadow: 0 0 16px rgba(6,182,212,0.3); }

    .category-chips { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .cat-chip {
      background: var(--bg-secondary); border: 1px solid var(--border-subtle);
      color: var(--text-secondary); padding: 6px 14px; border-radius: 20px;
      font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s;
    }
    .cat-chip:hover, .cat-chip.active {
      background: rgba(6, 182, 212, 0.18); border-color: var(--accent-cyan); color: var(--accent-cyan);
    }

    /* BANNER */
    .container { max-width: 1700px; margin: 0 auto; padding: 24px 36px; }

    .banner {
      background: linear-gradient(135deg, rgba(124,58,237,0.1), rgba(6,182,212,0.08));
      border: 1px solid var(--border-subtle); border-radius: 18px;
      padding: 24px 32px; margin-bottom: 32px;
      display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;
    }
    .banner-text h2 { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 4px; }
    .banner-text p { font-size: 13px; color: var(--text-secondary); max-width: 800px; }
    .banner-stats { display: flex; gap: 16px; }
    .stat-pill { background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.12); padding: 8px 16px; border-radius: 10px; font-family: var(--font-mono); font-size: 12px; }
    .stat-pill strong { color: var(--accent-cyan); }

    /* CARDS GRID */
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(460px, 1fr));
      gap: 28px;
    }

    .card {
      background: var(--bg-card); border: 1px solid var(--border-subtle);
      border-radius: 18px; overflow: hidden; display: flex; flex-direction: column;
      transition: transform 0.25s, border-color 0.25s, box-shadow 0.25s;
    }
    .card:hover {
      border-color: rgba(255, 255, 255, 0.25);
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.8), 0 0 24px rgba(6, 182, 212, 0.12);
      transform: translateY(-3px);
    }

    .card-header {
      padding: 14px 20px; display: flex; align-items: center; justify-content: space-between;
      border-bottom: 1px solid var(--border-subtle); background: rgba(0, 0, 0, 0.35);
    }
    .card-title-group { display: flex; align-items: center; gap: 10px; }
    .card-badge {
      font-family: var(--font-mono); font-size: 11px; font-weight: 800; color: #fff;
      background: rgba(255, 255, 255, 0.1); padding: 3px 8px; border-radius: 6px;
    }
    .card-title { font-size: 15px; font-weight: 700; }

    .header-actions { display: flex; align-items: center; gap: 8px; }

    .inspect-btn {
      background: rgba(6, 182, 212, 0.12); border: 1px solid rgba(6, 182, 212, 0.3);
      color: #38bdf8; border-radius: 6px; padding: 5px 10px; font-size: 11px; font-weight: 700;
      cursor: pointer; transition: all 0.2s ease;
    }
    .inspect-btn:hover { background: #06b6d4; color: #000; }

    .replay-btn {
      background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.14);
      color: var(--text-primary); border-radius: 6px; padding: 5px 10px; font-size: 11px;
      font-weight: 600; display: flex; align-items: center; gap: 5px; cursor: pointer; transition: all 0.2s ease;
    }
    .replay-btn:hover { background: #fff; color: #000; }
    .replay-btn:active { transform: scale(0.95); }

    /* PREVIEW STAGE */
    .preview-stage {
      height: 220px; background: var(--bg-preview); position: relative; overflow: hidden;
      display: flex; align-items: center; justify-content: center; padding: 20px; width: 100%;
    }

    /* TRAIT DRAWER */
    .trait-drawer {
      background: #090910; border-top: 1px solid rgba(6, 182, 212, 0.25);
      padding: 16px 20px; display: none; font-family: var(--font-mono); font-size: 11px;
      color: #cbd5e1; animation: slide-down 0.2s ease-out;
    }
    .trait-drawer.open { display: block; }
    @keyframes slide-down { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }

    .drawer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 8px; }
    .drawer-tag { display: inline-block; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; color: #fff; margin-right: 6px; font-weight: 700; }
    .drawer-code { background: #000; padding: 6px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); color: #38bdf8; overflow-x: auto; margin-top: 6px; }

    .card-footer {
      padding: 12px 20px; border-top: 1px solid var(--border-subtle);
      background: rgba(0, 0, 0, 0.2); display: flex; align-items: center; justify-content: space-between;
      font-size: 12px; color: var(--text-secondary);
    }
    .card-footer-def { font-size: 11px; color: #94a3b8; font-style: italic; max-width: 65%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    /* DYNAMIC CSS FOR ALL 49 ARCHETYPES */
    ${ARCHETYPES.map(a => a.customCss).join("\n")}
  </style>
</head>
<body>

  <header>
    <div class="brand">
      <div class="brand-logo">P</div>
      <div class="brand-title">
        <h1>Prometheus Master Motion Suite</h1>
        <p>Authoritative 49 Visual Asset Archetypes (#02 – #50)</p>
      </div>
    </div>
    <div class="nav-links">
      <a href="/typo" class="nav-btn">🎬 Typography Studio (/typo)</a>
      <a href="/mixfont" class="nav-btn">🎨 MixFont Hub (/mixfont)</a>
      <a href="/anima" class="nav-btn">✨ ANIMA Studio (/anima)</a>
      <a href="/archetypes" class="nav-btn highlight active">49 Visual Archetypes</a>
      <a href="/paste" class="nav-btn">📸 Screenshot Dropzone</a>
    </div>
  </header>

  <div class="filter-bar">
    <div class="search-box">
      <input type="text" id="searchInput" placeholder="Search 49 visual archetypes by name, prompt, or trait..." oninput="filterCards()">
    </div>
    <div class="category-chips">
      <button class="cat-chip active" data-cat="all" onclick="selectCategory('all')">All Archetypes (49)</button>
      <button class="cat-chip" data-cat="metrics" onclick="selectCategory('metrics')">Metrics & Stats</button>
      <button class="cat-chip" data-cat="structures" onclick="selectCategory('structures')">Structures & Lists</button>
      <button class="cat-chip" data-cat="processes" onclick="selectCategory('processes')">Processes & Flows</button>
      <button class="cat-chip" data-cat="transformations" onclick="selectCategory('transformations')">Transformations & States</button>
      <button class="cat-chip" data-cat="artifacts" onclick="selectCategory('artifacts')">Artifacts & Entities</button>
      <button class="cat-chip" data-cat="communication" onclick="selectCategory('communication')">Communication & Concepts</button>
    </div>
  </div>

  <div class="container">
    <div class="banner">
      <div class="banner-text">
        <h2>Complete Motion Asset Taxonomy & Kinetic Trait Matrix</h2>
        <p>Comprehensive visual registry for all 49 non-macro visual archetypes. Each archetype features formal trait governance, live mathematical motion physics, replay triggers, and high-contrast OLED dark stage rendering.</p>
      </div>
      <div class="banner-stats">
        <div class="stat-pill">Archetypes: <strong>49 Registered</strong></div>
        <div class="stat-pill">Frame Rate: <strong>60 FPS Native</strong></div>
      </div>
    </div>

    <div class="grid" id="archetypesGrid">
      ${ARCHETYPES.map(a => `
        <div class="card" data-cat="${a.category}" data-name="${a.name.toLowerCase()}" data-slug="${a.slug}">
          <div class="card-header">
            <div class="card-title-group">
              <span class="card-badge">${a.badge}</span>
              <span class="card-title">${a.name}</span>
            </div>
            <div class="header-actions">
              <button class="inspect-btn" onclick="toggleDrawer(this)">🔍 Trait Contract</button>
              <button class="replay-btn" onclick="replayCard(this)">Replay</button>
            </div>
          </div>
          <div class="preview-stage" id="stage_${a.id}">
            ${a.renderHtml}
          </div>
          <div class="trait-drawer">
            <div><span class="drawer-tag">TRAIT ID</span> <code>${a.traitId}</code></div>
            <div class="drawer-grid">
              <div><strong>Concern:</strong> ${a.concern}</div>
              <div><strong>Target Scope:</strong> ${a.targetScope}</div>
              <div><strong>Owns Channels:</strong> <code>${a.channels}</code></div>
              <div><strong>Conflicts:</strong> <code>${a.conflicts}</code></div>
            </div>
            <div class="drawer-code">FrameExpression: ${a.frameExpression}</div>
          </div>
          <div class="card-footer">
            <span class="card-footer-def" title="${a.definition}">${a.definition}</span>
            <span style="font-family:monospace; color:var(--accent-cyan); font-size:11px;">${a.footerNote}</span>
          </div>
        </div>
      `).join("\n")}
    </div>
  </div>

  <script>
    let activeCategory = 'all';

    function selectCategory(cat) {
      activeCategory = cat;
      document.querySelectorAll('.cat-chip').forEach(b => b.classList.remove('active'));
      const activeBtn = document.querySelector('.cat-chip[data-cat="' + cat + '"]');
      if (activeBtn) activeBtn.classList.add('active');
      filterCards();
    }

    function filterCards() {
      const q = document.getElementById('searchInput').value.toLowerCase().trim();
      document.querySelectorAll('.card').forEach(card => {
        const cat = card.getAttribute('data-cat');
        const text = card.innerText.toLowerCase();
        const matchesCat = (activeCategory === 'all' || cat === activeCategory);
        const matchesQuery = (!q || text.includes(q));
        card.style.display = (matchesCat && matchesQuery) ? 'flex' : 'none';
      });
    }

    function toggleDrawer(btn) {
      const card = btn.closest('.card');
      const drawer = card.querySelector('.trait-drawer');
      drawer.classList.toggle('open');
      btn.innerText = drawer.classList.contains('open') ? '✕ Close Contract' : '🔍 Trait Contract';
    }

    function replayCard(btn) {
      const card = btn.closest('.card');
      const stage = card.querySelector('.preview-stage');
      const inner = stage.innerHTML;
      stage.innerHTML = '';
      setTimeout(() => { stage.innerHTML = inner; }, 20);
    }
  </script>
</body>
</html>
`;

fs.writeFileSync(outputHtmlPath, htmlContent, "utf-8");
fs.writeFileSync(studioMirrorHtmlPath, htmlContent, "utf-8");
console.log(`[ARCHETYPE_BUILDER] Successfully generated Master Visual Archetypes Suite:`);
console.log(` -> ${outputHtmlPath}`);
console.log(` -> ${studioMirrorHtmlPath}`);
