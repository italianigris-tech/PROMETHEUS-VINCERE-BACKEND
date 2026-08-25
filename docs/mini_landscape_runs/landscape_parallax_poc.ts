/**
 * MINI LANDSCAPE RUNS — DOM 2.5D PARALLAX PROOF OF CONCEPT BUILDER
 *
 * Emits a fully self-contained `out/landscape_parallax_poc.html` that renders
 * the 2.5D parallax rig + camera system in the browser using the plain-JS math
 * mirror (`landscape_parallax_math_mirror.ts`), inlined verbatim (everything
 * above the MIRROR_EXPORT_BOUNDARY seam). Zero network, zero dependencies.
 *
 * What it proves:
 *  - The camera move math is pure math: pan/tilt/zoom/truck/pedestal/dolly/
 *    crane/roll/shake all animate a three-plane stage deterministically per
 *    frame — the same math the WebGL spine will evaluate headless on Modal.
 *  - Parallax honesty: truck/dolly separate depth ∝ ratio, pan shifts the world
 *    uniformly, zoom magnifies near planes faster, roll counter-rotates.
 *  - The ownership split is visible: the background plate (background system
 *    owned) barely moves, the midground concept cards (animation hand) shift at
 *    ratio 1.0, and the foreground HUD chrome (animation hand) shifts hardest.
 *
 * CLI:
 *   npx tsx docs/mini_landscape_runs/landscape_parallax_poc.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";

const here = __dirname;

const mirrorPath = path.join(here, "landscape_parallax_math_mirror.ts");
const mirrorSrc = fs.readFileSync(mirrorPath, "utf8");

// Inline everything above the export boundary; drop the ts-nocheck pragma so
// the browser gets clean plain JS.
const inlineJs = mirrorSrc
  .split("// MIRROR_EXPORT_BOUNDARY")[0]
  .replace(/^\/\/ @ts-nocheck\s*$/m, "")
  .replace(/\n{3,}/g, "\n\n");
const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Landscape 2.5D Parallax PoC — Camera Rig Proof of Concept</title>
<style>
  :root{--bg:#0b0e14;--panel:#12161f;--panel-2:#171c28;--ink:#e8ecf4;--dim:#8b93a7;--accent:#4da3ff;--accent-2:#7b5cff;--warn:#ffb454;--danger:#ff5d5d}
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:var(--bg);color:var(--ink);font-family:"SF Mono",ui-monospace,"Cascadia Code",Menlo,Consolas,monospace}
  body{padding:24px}
  h1{font-size:15px;letter-spacing:1.5px;text-transform:uppercase;color:var(--dim);margin:0 0 4px;font-weight:600}
  .sub{font-size:12px;color:var(--dim);margin:0 0 18px;line-height:1.5;max-width:980px}
  .sub code{color:var(--accent);background:#0f1420;padding:1px 5px;border-radius:4px}
  .layout{display:grid;grid-template-columns:1fr 320px;gap:18px;max-width:1440px}
  @media(max-width:1100px){.layout{grid-template-columns:1fr}}
  .stage-wrap{position:relative;width:100%;aspect-ratio:16/9;border-radius:10px;overflow:hidden;border:1px solid #232a3a;box-shadow:0 18px 60px rgba(0,0,0,.5)}
  .stage{position:absolute;inset:0;overflow:hidden}
  .plane{position:absolute;will-change:transform}
  .plane.bg{inset:0}
  .plane.mid,.plane.fg{border-radius:8px}
  .bg-plate{position:absolute;inset:0;background:radial-gradient(120% 90% at 30% 20%,#1b2a44 0%,#0e1522 45%,#0a0d16 100%)}
  .bg-orbs{position:absolute;inset:0;opacity:.55}
  .bg-orbs i{position:absolute;display:block;border-radius:50%;filter:blur(28px)}
  .mid-card{position:absolute;border-radius:10px;background:linear-gradient(160deg,rgba(77,163,255,.16),rgba(123,92,255,.10) 60%,rgba(12,16,26,.4));border:1px solid rgba(77,163,255,.28);padding:12px;display:flex;flex-direction:column;gap:8px}
  .mid-card .kicker{font-size:9px;text-transform:uppercase;letter-spacing:1.4px;color:var(--accent)}
  .mid-card .title{font-size:13px;font-weight:600;line-height:1.35;color:var(--ink)}
  .mid-card .bar{height:5px;border-radius:3px;background:linear-gradient(90deg,var(--accent),var(--accent-2));opacity:.85}
  .mid-card.chart .bar.l1{width:38%}.mid-card.chart .bar.l2{width:62%}.mid-card.chart .bar.l3{width:88%}
  .fg-chrome{position:absolute;inset:0;pointer-events:none}
  .fg-grain{position:absolute;inset:-4%;opacity:.16;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.9'/%3E%3C/svg%3E")}
  .fg-vignette{position:absolute;inset:0;background:radial-gradient(115% 105% at 50% 42%,transparent 55%,rgba(0,0,0,.55) 100%)}
  .fg-hud{position:absolute;top:14px;right:14px;padding:8px 10px;border:1px solid rgba(77,163,255,.35);border-radius:7px;background:rgba(10,14,22,.55);font-size:10px;color:#bcd2f0;letter-spacing:.6px}
  .fg-hud b{color:var(--ink)}
  .fg-tag{position:absolute;left:14px;bottom:12px;font-size:10px;color:var(--dim);letter-spacing:1px;text-transform:uppercase}
  .fg-tag i{font-style:normal;color:var(--accent)}
  .overlay-label{position:absolute;top:12px;left:14px;font-size:11px;color:var(--dim);letter-spacing:1.2px;text-transform:uppercase}
  .overlay-label b{color:var(--accent)}
  .progress-tick{position:absolute;bottom:0;left:0;height:3px;width:0%;background:linear-gradient(90deg,var(--accent),var(--accent-2))}
  .side{display:flex;flex-direction:column;gap:14px}
  .panel{background:var(--panel);border:1px solid #232a3a;border-radius:10px;padding:14px}
  .panel h2{margin:0 0 10px;font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:var(--dim)}
  .row{display:flex;align-items:center;gap:8px;margin-bottom:8px}
  .row label{font-size:11px;color:var(--dim);min-width:64px}
  select,input[type="range"]{width:100%}
  select{background:var(--panel-2);color:var(--ink);border:1px solid #2a3350;border-radius:6px;padding:6px 8px;font-size:12px}
  .btn{flex:1;background:var(--accent);color:#04121f;border:0;border-radius:6px;padding:8px 0;font-weight:700;font-size:12px;cursor:pointer;letter-spacing:.6px}
  .btn.secondary{background:var(--panel-2);color:var(--ink);border:1px solid #2a3350}
  .hud-grid{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;font-size:11px}
  .hud-grid .k{color:var(--dim)}
  .hud-grid .v{color:var(--ink);text-align:right}
  .chip{display:inline-block;padding:2px 7px;border-radius:999px;font-size:10px;letter-spacing:.8px;background:rgba(77,163,255,.12);color:var(--accent);border:1px solid rgba(77,163,255,.3)}
  .chip.neg{background:rgba(255,93,93,.1);color:var(--danger);border-color:rgba(255,93,93,.3)}
  .depth-legend{display:grid;grid-template-columns:1fr;gap:6px;font-size:11px}
  .depth-legend .l{display:flex;align-items:center;gap:8px;color:var(--dim)}
  .swatch{width:12px;height:12px;border-radius:3px;flex:none}
  .swatch.bg{background:#24324e}.swatch.mid{background:#4da3ff}.swatch.fg{background:#ffb454}
  .foot{margin-top:14px;font-size:10.5px;color:var(--dim);line-height:1.6;max-width:980px}
  .foot b{color:var(--ink)}
</style>
</head>
<body>
  <h1>Landscape 2.5D Parallax Rig — Camera System PoC</h1>
  <p class="sub">Pure per-frame camera + parallax math, evaluated in your browser by the <code>landscape_parallax_math_mirror.ts</code> plain-JS mirror (drift-locked to the TS module by the parity test). Background plate ratio <b>0.35</b> · midground <b>1.0</b> · foreground <b>1.65</b>.</p>

  <div class="layout">
    <div class="stage-wrap">
      <div class="stage" id="stage">
        <div class="plane bg" data-ratio="0.35">
          <div class="bg-plate"></div>
          <div class="bg-orbs">
            <i style="width:34%;height:46%;left:52%;top:18%;background:radial-gradient(circle at 40% 35%,rgba(77,163,255,.35),rgba(77,163,255,0) 70%)"></i>
            <i style="width:26%;height:38%;left:14%;top:52%;background:radial-gradient(circle at 45% 40%,rgba(123,92,255,.30),rgba(123,92,255,0) 70%)"></i>
            <i style="width:18%;height:30%;left:78%;top:60%;background:radial-gradient(circle at 45% 40%,rgba(255,180,84,.18),rgba(255,180,84,0) 70%)"></i>
          </div>
        </div>
        <div class="overlay-label">Background plate <b>· owned by background system</b></div>

        <div class="plane mid" data-ratio="1.0" style="left:6%;top:18%;width:26%;height:42%">
          <div class="mid-card" style="position:absolute;inset:0">
            <span class="kicker">List · Step 01</span>
            <span class="title">Compile the modular graph</span>
            <div class="bar"></div>
          </div>
        </div>
        <div class="plane mid" data-ratio="1.0" style="left:42%;top:26%;width:24%;height:38%">
          <div class="mid-card chart" style="position:absolute;inset:0">
            <span class="kicker">Chart · Revenue</span>
            <span class="title">Throughput surge 10×</span>
            <div class="bar l1"></div><div class="bar l2"></div><div class="bar l3"></div>
          </div>
        </div>
        <div class="plane mid" data-ratio="1.0" style="left:70%;top:20%;width:24%;height:36%">
          <div class="mid-card" style="position:absolute;inset:0">
            <span class="kicker">Concept · Engine</span>
            <span class="title">Agent ⇄ Canvas bridge</span>
            <div class="bar"></div>
          </div>
        </div>
        <div class="overlay-label" style="top:66%;left:42%">Midground concept cards <b>· placed by animation hand</b></div>

        <div class="fg-chrome">
          <div class="plane fg" data-ratio="1.65" style="inset:0">
            <div class="fg-grain"></div>
            <div class="fg-vignette"></div>
            <div class="fg-hud"><b>HUD</b> · live telemetry · 24fps</div>
            <div class="fg-tag"><i>foreground</i> · grain + vignette + HUD chrome · placed by animation hand</div>
          </div>
        </div>
        <div class="progress-tick" id="progressTick"></div>
      </div>
    </div>

    <div class="side">
      <div class="panel">
        <h2>Transport</h2>
        <div class="row"><label>Move</label><select id="kindSelect"></select></div>
        <div class="row"><label>Intensity</label><input type="range" id="intensity" min="0.1" max="1" step="0.05" value="0.7" /></div>
        <div class="row"><label>Time</label><input type="range" id="scrub" min="0" max="120" step="1" value="0" /></div>
        <div class="row"><button class="btn" id="playBtn">▶ Play</button><button class="btn secondary" id="loopBtn">Loop</button></div>
        <div class="row"><label>Seed</label><input type="range" id="seed" min="1" max="999" step="1" value="42" /></div>
      </div>
      <div class="panel">
        <h2>Camera Pose <span id="kindChip" class="chip"></span></h2>
        <div class="hud-grid" id="poseHud"></div>
      </div>
      <div class="panel">
        <h2>Depth Plane Offsets</h2>
        <div class="depth-legend">
          <div class="l"><span class="swatch bg"></span>Background · ratio 0.35</div>
          <div class="l"><span class="swatch mid"></span>Midground · ratio 1.0</div>
          <div class="l"><span class="swatch fg"></span>Foreground · ratio 1.65</div>
        </div>
        <div class="hud-grid" id="planeHud" style="margin-top:8px"></div>
      </div>
      <div class="panel">
        <h2>Physical Honesty</h2>
        <div class="sub" style="margin:0;font-size:11px;line-height:1.6">
          <b style="color:var(--ink)">Truck / dolly / crane</b> → real parallax ∝ depth ratio.<br />
          <b style="color:var(--ink)">Pan / tilt</b> → uniform world shift (true coupling).<br />
          <b style="color:var(--ink)">Zoom</b> → ratio-scaled magnification.<br />
          <b style="color:var(--ink)">Roll / dutch</b> → counter-rotation, foreground rolls most.
        </div>
      </div>
    </div>
  </div>
  <p class="foot">Backed by <b>landscape_camera_system.ts</b> (pure TS math), <b>landscape_parallax_rig.ts</b> (placement), <b>landscape_parallax_math_mirror.ts</b> (this inlined JS), and verified by <b>tests/test_landscape_camera_and_parallax.ts</b> — including a 1,000+ point mirror-parity grid. Background plane is <b>referenced only</b>; the animation hand places midground + foreground.</p>

  <script>
/* ── landscape_parallax_math_mirror.ts — inlined verbatim ───────────────── */
__MIRROR_JS__
/* ── demo driver (only here; the math above is pure) ────────────────────── */

const CAMERA_SPECS = {
  dolly_in: { easing: "easeOut", durationSec: 4 },
  dolly_out: { easing: "easeOut", durationSec: 4 },
  push_in: { easing: "easeOut", durationSec: 4 },
  zoom_in: { easing: "easeInOut", durationSec: 4 },
  zoom_out: { easing: "easeInOut", durationSec: 4 },
  pan_left: { easing: "easeInOut", durationSec: 4 },
  pan_right: { easing: "easeInOut", durationSec: 4 },
  tilt_up: { easing: "easeInOut", durationSec: 4 },
  tilt_down: { easing: "easeInOut", durationSec: 4 },
  truck_left: { easing: "easeInOut", durationSec: 4 },
  truck_right: { easing: "easeInOut", durationSec: 4 },
  pedestal_up: { easing: "easeInOut", durationSec: 4 },
  pedestal_down: { easing: "easeInOut", durationSec: 4 },
  crane_up: { easing: "easeOut", durationSec: 4 },
  crane_down: { easing: "easeOut", durationSec: 4 },
  tracking_follow: { easing: "easeInOut", durationSec: 4 },
  cinematic_drift: { easing: "easeInOut", durationSec: 4 },
  shake: { easing: "linear", durationSec: 4 },
  dutch_tilt: { easing: "easeInOut", durationSec: 4 },
  roll_clockwise: { easing: "easeInOut", durationSec: 4 },
  roll_counterclockwise: { easing: "easeInOut", durationSec: 4 },
  static: { easing: "linear", durationSec: 4 },
};

const DEMO_KINDS = Object.keys(CAMERA_SPECS);
const MOVE_LABELS = {
  dolly_in: "Dolly In — lens pushes forward", dolly_out: "Dolly Out", push_in: "Push In — toward thesis",
  zoom_in: "Zoom In — magnify near faster", zoom_out: "Zoom Out", pan_left: "Pan Left — uniform world shift",
  pan_right: "Pan Right", tilt_up: "Tilt Up", tilt_down: "Tilt Down", truck_left: "Truck Left — depth separation",
  truck_right: "Truck Right", pedestal_up: "Pedestal Up", pedestal_down: "Pedestal Down", crane_up: "Crane Up",
  crane_down: "Crane Down", tracking_follow: "Tracking Follow", cinematic_drift: "Cinematic Drift",
  shake: "Shake — seeded jitter", dutch_tilt: "Dutch Tilt", roll_clockwise: "Roll CW — foreground rolls most",
  roll_counterclockwise: "Roll CCW", static: "Static Anchor",
};

const RATIOS = [0.35, 1.0, 1.65];
const FPS = 24;
const TOTAL_FRAMES = 120;

const stage = document.getElementById("stage");
const kindSelect = document.getElementById("kindSelect");
const intensitySlider = document.getElementById("intensity");
const scrub = document.getElementById("scrub");
const seedSlider = document.getElementById("seed");
const playBtn = document.getElementById("playBtn");
const loopBtn = document.getElementById("loopBtn");
const progressTick = document.getElementById("progressTick");
const poseHud = document.getElementById("poseHud");
const planeHud = document.getElementById("planeHud");
const kindChip = document.getElementById("kindChip");

DEMO_KINDS.forEach((k) => {
  const opt = document.createElement("option");
  opt.value = k;
  opt.textContent = MOVE_LABELS[k] || k;
  kindSelect.appendChild(opt);
});
kindSelect.value = "truck_right";

let playing = false;
let loop = true;
let currentKind = kindSelect.value;

function makePlan(kind, intensity, startSec, endSec) {
  return {
    moveId: "poc_" + kind,
    sectionId: "poc",
    startSec, endSec,
    kind,
    intensity,
    parallaxDepthRatios: { background: 0.35, middleGround: 1.0, foreground: 1.65 },
    pairedWithText: false,
    causalIntent: "PoC preview",
    cause: { gate: "camera_move_trigger", reason: "PoC", sectionId: "poc", timeSec: startSec },
  };
}

function tick() {
  const plan = makePlan(currentKind, parseFloat(intensitySlider.value), 0, 4);
  const seed = parseInt(seedSlider.value, 10);
  const frame = parseInt(scrub.value, 10);
  const { pose, progress, rawProgress } = mirrorPose(plan, FPS, frame, seed, CAMERA_SPECS);

  document.querySelectorAll(".plane").forEach((el) => {
    const ratio = parseFloat(el.dataset.ratio);
    const off = mirrorOffsets(plan, progress, ratio, seed);
    el.style.transformOrigin = "50% 50%";
    el.style.transform =
      "translate(" + (off.dx * 100).toFixed(3) + "%," + (off.dy * 100).toFixed(3) + "%) " +
      "scale(" + off.scale.toFixed(5) + ") rotate(" + off.rotationDeg.toFixed(3) + "deg)";
  });

  progressTick.style.width = ((frame / TOTAL_FRAMES) * 100).toFixed(2) + "%";
  kindChip.textContent = currentKind;
  kindChip.className = "chip" + (currentKind === "static" ? " neg" : "");

  poseHud.innerHTML =
    '<div class="k">kind</div><div class="v">' + currentKind + "</div>" +
    '<div class="k">easing</div><div class="v">' + CAMERA_SPECS[currentKind].easing + "</div>" +
    '<div class="k">intensity</div><div class="v">' + plan.intensity.toFixed(2) + "</div>" +
    '<div class="k">progress</div><div class="v">' + progress.toFixed(4) + " (" + rawProgress.toFixed(4) + " raw)</div>" +
    '<div class="k">position</div><div class="v">[' + pose.position.map((v) => v.toFixed(3)).join(", ") + "]</div>" +
    '<div class="k">rotation</div><div class="v">[' + pose.rotation.map((v) => v.toFixed(3)).join(", ") + "]</div>" +
    '<div class="k">fov</div><div class="v">' + pose.fov.toFixed(2) + "°</div>";

  planeHud.innerHTML = RATIOS.map((r, i) => {
    const off = mirrorOffsets(plan, progress, r, seed);
    const names = ["Background", "Midground", "Foreground"];
    return '<div class="k">' + names[i] + ' dx</div><div class="v">' + off.dx.toFixed(4) + '</div>' +
           '<div class="k">' + names[i] + ' scale</div><div class="v">' + off.scale.toFixed(4) + '</div>' +
           '<div class="k">' + names[i] + ' rot°</div><div class="v">' + off.rotationDeg.toFixed(2) + '</div>';
  }).join("");
}

function step() {
  if (!playing) return;
  let next = parseInt(scrub.value, 10) + 1;
  if (next > TOTAL_FRAMES) {
    if (loop) next = 0;
    else { playing = false; playBtn.textContent = "▶ Play"; return; }
  }
  scrub.value = next;
  tick();
  requestAnimationFrame(step);
}

playBtn.addEventListener("click", () => {
  playing = !playing;
  playBtn.textContent = playing ? "⏸ Pause" : "▶ Play";
  if (playing) requestAnimationFrame(step);
});

loopBtn.addEventListener("click", () => {
  loop = !loop;
  loopBtn.classList.toggle("secondary", !loop);
  loopBtn.textContent = loop ? "Loop: on" : "Loop: off";
});

kindSelect.addEventListener("change", () => {
  currentKind = kindSelect.value;
  tick();
});
intensitySlider.addEventListener("input", tick);
seedSlider.addEventListener("input", tick);
scrub.addEventListener("input", tick);

tick();
  </script>
</body>
</html>
`;


// ---------------------------------------------------------------------------
// Assemble & write
// ---------------------------------------------------------------------------

const builtHtml = HTML.replace("__MIRROR_JS__", inlineJs);

const outDir = path.join(here, "out");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "landscape_parallax_poc.html");
fs.writeFileSync(outPath, builtHtml, "utf8");

console.log(`Wrote ${outPath}`);
console.log(`  - mirror inlined: ${inlineJs.length} chars of plain JS (MIRROR_EXPORT_BOUNDARY stripped)`);
console.log(`  - total size: ${builtHtml.length.toLocaleString()} chars`);
console.log("  - open in a browser (file:// works, zero dependencies).");
