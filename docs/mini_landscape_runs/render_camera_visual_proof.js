/**
 * MINI LANDSCAPE RUNS — CAMERA SYSTEM VISUAL PROOF RENDERER
 *
 * Renders `out/landscape_camera_visual_proof.mp4`: a literal video of the
 * landscape camera system + 2.5D parallax rig in motion. Every frame is a pure
 * function of the SAME math that runs in the browser PoC and the render spine:
 *
 *   mirrorPose(plan, fps, frame, seed, specs)       -> camera pose + progress
 *   mirrorOffsets(plan, progress, depthRatio, seed) -> per-plane parallax offset
 *
 * A three-depth-plane stage (background R0.35 / midground R1.0 / foreground
 * R1.65) is rasterized in software (zero native deps), and raw RGB24 frames are
 * piped straight into ffmpeg for H.264 encoding. Text/HUD is drawn with an
 * embedded 5×7 bitmap font so the video is fully self-contained.
 *
 * Usage:
 *   npx tsx docs/mini_landscape_runs/render_camera_visual_proof.ts
 *   # optional: --kinds truck_left,dolly_in,roll_clockwise --fps 24 --amp 2.5
 */
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { PARALLAX_MATH_MIRROR } from "./landscape_parallax_math_mirror.js";
import { CAMERA_MOVE_CATALOG } from "./landscape_camera_system.js";
const { mirrorProgress, mirrorPose, mirrorOffsets, mirrorSpecsFromCatalog } = PARALLAX_MATH_MIRROR;
// ---------------------------------------------------------------------------
// Render config
// ---------------------------------------------------------------------------
const W = 1280;
const H = 720;
const FPS = 24;
const SEED = 42;
const AMP = 2.5; // visual exaggeration of normalized offsets (labelled in-video)
const INTRO_SEC = 2.5;
const OUT_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), "out");
const RATIO_BG = 0.35;
const RATIO_MID = 1.0;
const RATIO_FG = 1.65;
function parseArgs(argv) {
    const args = {};
    for (let i = 2; i < argv.length; i++) {
        if (argv[i].startsWith("--")) {
            args[argv[i].slice(2)] = argv[i + 1] ?? "";
            i++;
        }
    }
    return args;
}
// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------
const C = {
    bgTop: [10, 15, 30],
    bgHorizon: [16, 27, 48],
    bgBottom: [7, 10, 18],
    white: [226, 232, 240],
    dim: [138, 153, 173],
    cyan: [79, 224, 255],
    violet: [139, 124, 255],
    amber: [255, 180, 84],
    pink: [255, 92, 122],
    cardABody: [14, 24, 44],
    cardAHead: [18, 48, 64],
    cardBBody: [18, 14, 38],
    cardBHead: [37, 26, 62],
    cardCBody: [32, 25, 16],
    cardCHead: [48, 37, 16],
    cardABorder: [79, 224, 255],
    cardBBorder: [139, 124, 255],
    cardCBorder: [255, 180, 84],
};
// ---------------------------------------------------------------------------
// Embedded 5×7 bitmap font (uppercase, digits, punctuation)
// ---------------------------------------------------------------------------
const FONT = {
    A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
    B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
    C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
    D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
    E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
    F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
    G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
    H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
    I: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x1f],
    J: [0x07, 0x02, 0x02, 0x02, 0x12, 0x12, 0x0c],
    K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
    L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
    M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
    N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
    O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
    P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
    Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
    R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
    S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
    T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
    U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
    V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
    W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
    X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
    Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
    Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
    "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
    "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
    "2": [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
    "3": [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
    "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
    "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
    "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
    "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
    "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
    "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
    " ": [0, 0, 0, 0, 0, 0, 0],
    "-": [0, 0, 0, 0x0e, 0, 0, 0],
    ".": [0, 0, 0, 0, 0, 0x0c, 0x0c],
    ":": [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
    "/": [0x01, 0x01, 0x02, 0x04, 0x08, 0x10, 0x10],
    "%": [0x13, 0x13, 0x02, 0x04, 0x08, 0x19, 0x19],
    "(": [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
    ")": [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
    "_": [0, 0, 0, 0, 0, 0, 0x1f],
    ">": [0x08, 0x04, 0x02, 0x01, 0x02, 0x04, 0x08],
    "=": [0, 0, 0x1f, 0, 0x1f, 0, 0],
    "+": [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0],
    "°": [0x0e, 0x11, 0x11, 0x0e, 0, 0, 0],
    "[": [0x0f, 0x08, 0x08, 0x08, 0x08, 0x08, 0x0f],
    "]": [0x1e, 0x02, 0x02, 0x02, 0x02, 0x02, 0x1e],
    "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
    ",": [0, 0, 0, 0, 0x0c, 0x0c, 0x08],
    "&": [0x0e, 0x11, 0x12, 0x0c, 0x12, 0x11, 0x0d],
    "*": [0, 0x0a, 0x04, 0x0e, 0x04, 0x0a, 0],
    "~": [0, 0, 0x12, 0x0d, 0, 0, 0],
};
// ---------------------------------------------------------------------------
// Pixel helpers (direct Uint8Array RGB24 access)
// ---------------------------------------------------------------------------
const clampByte = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
function blendPixel(dst, i, rgb, a) {
    if (a >= 1) {
        dst[i] = rgb[0];
        dst[i + 1] = rgb[1];
        dst[i + 2] = rgb[2];
    }
    else if (a > 0) {
        dst[i] = dst[i] + (rgb[0] - dst[i]) * a;
        dst[i + 1] = dst[i + 1] + (rgb[1] - dst[i + 1]) * a;
        dst[i + 2] = dst[i + 2] + (rgb[2] - dst[i + 2]) * a;
    }
}
/** Blit an RGBA tile onto dst at (ox, oy), alpha composited. */
function blitTile(dst, tile, tileW, ox, oy) {
    const oxi = ox | 0;
    const oyi = oy | 0;
    const x0 = Math.max(0, oxi);
    const y0 = Math.max(0, oyi);
    const x1 = Math.min(W, oxi + tileW);
    const y1 = Math.min(H, oyi + tileW);
    for (let y = y0; y < y1; y++) {
        const ty = y - oyi;
        const rowDst = y * W * 3;
        const rowSrc = ty * tileW * 4;
        for (let x = x0; x < x1; x++) {
            const tx = x - oxi;
            const si = rowSrc + tx * 4;
            const a = tile[si + 3] / 255;
            if (a > 0)
                blendPixel(dst, rowDst + x * 3, [tile[si], tile[si + 1], tile[si + 2]], a);
        }
    }
}
/** Copy a region of a larger plate onto dst at (ox, oy). */
function blitPlate(dst, plate, pw, ph, ox, oy) {
    const srcX = -ox | 0;
    const srcY = -oy | 0;
    if (srcX < 0 || srcY < 0 || srcX + W > pw || srcY + H > ph)
        return;
    for (let y = 0; y < H; y++) {
        const srcRow = (srcY + y) * pw * 3;
        const dstRow = y * W * 3;
        dst.set(plate.subarray(srcRow, srcRow + W * 3), dstRow);
    }
}
function fillRect(dst, x0, y0, x1, y1, rgb, a = 1) {
    const rx0 = Math.max(0, x0 | 0);
    const ry0 = Math.max(0, y0 | 0);
    const rx1 = Math.min(W - 1, x1 | 0);
    const ry1 = Math.min(H - 1, y1 | 0);
    for (let y = ry0; y <= ry1; y++) {
        const row = y * W * 3;
        for (let x = rx0; x <= rx1; x++)
            blendPixel(dst, row + x * 3, rgb, a);
    }
}
function hLine(dst, x0, x1, y, rgb, a = 1) {
    const rx0 = Math.max(0, x0 | 0);
    const rx1 = Math.min(W - 1, x1 | 0);
    const ry = y | 0;
    if (ry < 0 || ry >= H)
        return;
    const row = ry * W * 3;
    for (let x = rx0; x <= rx1; x++)
        blendPixel(dst, row + x * 3, rgb, a);
}
function vLine(dst, x, y0, y1, rgb, a = 1) {
    const rx = x | 0;
    const ry0 = Math.max(0, y0 | 0);
    const ry1 = Math.min(H - 1, y1 | 0);
    if (rx < 0 || rx >= W)
        return;
    for (let y = ry0; y <= ry1; y++)
        blendPixel(dst, y * W * 3 + rx * 3, rgb, a);
}
/** Axis-aligned rectangle rotated about its centre. */
function fillRectRot(dst, cx, cy, w, h, rotDeg, rgb, a = 1) {
    if (Math.abs(rotDeg) < 0.02) {
        fillRect(dst, cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2, rgb, a);
        return;
    }
    const rad = (-rotDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const hw = w / 2;
    const hh = h / 2;
    const span = Math.ceil((Math.abs(w) + Math.abs(h)) / 2) + 4;
    const x0 = Math.max(0, Math.round(cx - span));
    const x1 = Math.min(W - 1, Math.round(cx + span));
    const y0 = Math.max(0, Math.round(cy - span));
    const y1 = Math.min(H - 1, Math.round(cy + span));
    for (let y = y0; y <= y1; y++) {
        const row = y * W * 3;
        const dy = y - cy;
        for (let x = x0; x <= x1; x++) {
            const dx = x - cx;
            const lx = dx * cos - dy * sin;
            const ly = dx * sin + dy * cos;
            if (lx >= -hw && lx <= hw && ly >= -hh && ly <= hh) {
                blendPixel(dst, row + x * 3, rgb, a);
            }
        }
    }
}
// ---------------------------------------------------------------------------
// Text (embedded 5×7 bitmap font)
// ---------------------------------------------------------------------------
function textWidth(str, scale) {
    return str.length * 6 * scale;
}
function drawText(dst, str, x, y, scale, rgb, a = 1) {
    let cx = x;
    for (const ch of str.toUpperCase()) {
        const g = FONT[ch] ?? FONT[" "];
        for (let r = 0; r < 7; r++) {
            const row = g[r];
            if (row === 0)
                continue;
            for (let c = 0; c < 5; c++) {
                if (row & (16 >> c)) {
                    fillRect(dst, cx + c * scale, y + r * scale, cx + c * scale + scale - 1, y + r * scale + scale - 1, rgb, a);
                }
            }
        }
        cx += 6 * scale;
    }
}
function drawChip(dst, x, y, text, color) {
    const w = textWidth(text, 1);
    fillRect(dst, x - 2, y - 1, x + w + 1, y + 8, [0, 0, 0], 0.78);
    drawText(dst, text, x, y, 1, color, 1);
}
// ---------------------------------------------------------------------------
// Pre-rendered plates
// ---------------------------------------------------------------------------
const PADX = 700;
const PADY = 420;
const plateW = W + PADX * 2;
const plateH = H + PADY * 2;
/** Vertical gradient sky + soft radial glow. */
function buildBackgroundPlate() {
    const plate = new Uint8Array(plateW * plateH * 3);
    const horizonNy = 0.5;
    for (let py = 0; py < plateH; py++) {
        const ny = py / plateH;
        const top = ny < horizonNy;
        const t = top ? ny / horizonNy : (ny - horizonNy) / (1 - horizonNy);
        let r, g, b;
        if (top) {
            r = C.bgTop[0] + (C.bgHorizon[0] - C.bgTop[0]) * t;
            g = C.bgTop[1] + (C.bgHorizon[1] - C.bgTop[1]) * t;
            b = C.bgTop[2] + (C.bgHorizon[2] - C.bgTop[2]) * t;
        }
        else {
            r = C.bgHorizon[0] + (C.bgBottom[0] - C.bgHorizon[0]) * t;
            g = C.bgHorizon[1] + (C.bgBottom[1] - C.bgHorizon[1]) * t;
            b = C.bgHorizon[2] + (C.bgBottom[2] - C.bgHorizon[2]) * t;
        }
        const row = py * plateW * 3;
        for (let px = 0; px < plateW; px++) {
            const nx = px / plateW - 0.5;
            const rad = Math.sqrt(nx * nx * 1.6 + (ny - 0.34) * (ny - 0.34) * 3.2);
            const glow = Math.exp(-rad * 3.1) * 26;
            const i = row + px * 3;
            plate[i] = clampByte(r + glow * 0.9);
            plate[i + 1] = clampByte(g + glow * 1.0);
            plate[i + 2] = clampByte(b + glow * 1.3);
        }
    }
    return plate;
}
const TILE = 300;
/** Soft radial glow tile (RGBA). */
function buildOrbTile(color, core) {
    const tile = new Uint8Array(TILE * TILE * 4);
    const half = TILE / 2;
    for (let ty = 0; ty < TILE; ty++) {
        for (let tx = 0; tx < TILE; tx++) {
            const dx = (tx - half) / half;
            const dy = (ty - half) / half;
            const d = Math.sqrt(dx * dx + dy * dy);
            const a = d < 0.18 ? 1 : Math.pow(Math.max(0, 1 - d / 0.95), 1.7);
            const i = (ty * TILE + tx) * 4;
            const mix = Math.max(0, 1 - d / 0.28);
            tile[i] = color[0] + (core[0] - color[0]) * mix;
            tile[i + 1] = color[1] + (core[1] - color[1]) * mix;
            tile[i + 2] = color[2] + (core[2] - color[2]) * mix;
            tile[i + 3] = Math.round(a * 255);
        }
    }
    return tile;
}
function buildVignette() {
    const v = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
        const ny = (y - H / 2) / (H / 2);
        for (let x = 0; x < W; x++) {
            const nx = (x - W / 2) / (W / 2);
            const d = Math.sqrt(nx * nx + ny * ny);
            v[y * W + x] = clampByte(255 * Math.max(0.42, 1 - 0.52 * Math.pow(Math.max(0, d - 0.58), 1.55)));
        }
    }
    return v;
}
const bgPlate = buildBackgroundPlate();
const orbCyan = buildOrbTile([40, 140, 190], [170, 235, 255]);
const orbViolet = buildOrbTile([70, 60, 150], [180, 160, 255]);
const orbAmber = buildOrbTile([150, 95, 30], [255, 210, 140]);
const vignette = buildVignette();
// ---------------------------------------------------------------------------
// Scene transform (mirror offsets → screen space)
// ---------------------------------------------------------------------------
let AMP_V = AMP;
let FPS_V = FPS;
function ampOff(off) {
    return {
        dx: off.dx * W * AMP_V,
        dy: off.dy * H * AMP_V,
        scale: 1 + (off.scale - 1) * AMP_V,
        rotationDeg: off.rotationDeg * AMP_V,
    };
}
/** Apply plane transform (zoom about centre → roll about centre → translate). */
function place(x, y, off) {
    const cx = W / 2;
    const cy = H / 2;
    const rad = (off.rotationDeg * Math.PI) / 180;
    const dx = x - cx;
    const dy = y - cy;
    const rx = (dx * Math.cos(rad) - dy * Math.sin(rad)) * off.scale;
    const ry = (dx * Math.sin(rad) + dy * Math.cos(rad)) * off.scale;
    return [cx + rx + off.dx, cy + ry + off.dy];
}
function line(dst, x0, y0, x1, y1, rgb, a) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.max(1, Math.abs(dx), Math.abs(dy));
    for (let t = 0; t <= len; t++) {
        const x = Math.round(x0 + (dx * t) / len);
        const y = Math.round(y0 + (dy * t) / len);
        if (x >= 0 && x < W && y >= 0 && y < H)
            blendPixel(dst, y * W * 3 + x * 3, rgb, a);
    }
}
function familyColor(f) {
    switch (f) {
        case "lens":
            return C.amber;
        case "rig_translation":
            return C.cyan;
        case "crane":
            return C.violet;
        case "handheld":
            return C.pink;
        case "composite":
            return C.cyan;
        case "static":
            return C.dim;
        default:
            return C.pink;
    }
}
// ---------------------------------------------------------------------------
// Scene layout
// ---------------------------------------------------------------------------
const CARD_DEFS = [
    { cx: 0.2 * W, cy: 0.52 * H, w: 240, h: 150, body: C.cardABody, head: C.cardAHead, border: C.cardABorder, label: "MID A" },
    { cx: 0.5 * W, cy: 0.58 * H, w: 300, h: 185, body: C.cardBBody, head: C.cardBHead, border: C.cardBBorder, label: "MID B" },
    { cx: 0.8 * W, cy: 0.5 * H, w: 225, h: 140, body: C.cardCBody, head: C.cardCHead, border: C.cardCBorder, label: "MID C" },
];
const ORB_DEFS = [
    { cx: 0.22 * W, cy: 0.26 * H, tile: () => orbCyan },
    { cx: 0.7 * W, cy: 0.2 * H, tile: () => orbViolet },
    { cx: 0.48 * W, cy: 0.13 * H, tile: () => orbAmber },
];
const GRID_H = [0.66, 0.74, 0.82].map((v) => v * H);
const GRID_V = [0.12, 0.3, 0.48, 0.66, 0.84].map((v) => v * W);
function buildSegments(kinds) {
    let t = INTRO_SEC;
    const list = [...CAMERA_MOVE_CATALOG].filter((d) => !kinds || kinds.includes(d.kind));
    return list.map((def, i) => {
        const durationSec = Math.min(3.4, Math.max(2.4, def.defaultDurationSec));
        const seg = {
            def,
            startSec: t,
            endSec: t + durationSec,
            durationSec,
            plan: { kind: def.kind, startSec: t, endSec: t + durationSec, intensity: def.defaultIntensity },
            index: i + 1,
            total: list.length,
        };
        t += durationSec;
        return seg;
    });
}
const specs = mirrorSpecsFromCatalog(CAMERA_MOVE_CATALOG);
function findSegment(segs, sec) {
    if (sec < INTRO_SEC)
        return segs[0];
    for (const s of segs)
        if (sec < s.endSec)
            return s;
    return segs[segs.length - 1];
}
const fmt = (v, d) => v.toFixed(d);
// ---------------------------------------------------------------------------
// Per-frame scene render
// ---------------------------------------------------------------------------
function drawScene(dst, offBG, offMID, offFG) {
    // background plate
    blitPlate(dst, bgPlate, plateW, plateH, -PADX + offBG.dx, -PADY + offBG.dy);
    // background grid (rotates/scales/translates with the bg plane)
    for (const gy of GRID_H) {
        const [ax, ay] = place(0, gy, offBG);
        const [bx, by] = place(W - 1, gy, offBG);
        line(dst, ax, ay, bx, by, C.dim, 0.18);
    }
    for (const gx of GRID_V) {
        const [ax, ay] = place(gx, 0, offBG);
        const [bx, by] = place(gx, H - 1, offBG);
        line(dst, ax, ay, bx, by, C.dim, 0.12);
    }
    // background orbs
    for (const orb of ORB_DEFS) {
        const [px, py] = place(orb.cx, orb.cy, offBG);
        blitTile(dst, orb.tile(), TILE, px - TILE / 2, py - TILE / 2);
    }
    {
        const [px, py] = place(0.22 * W, 0.26 * H, offBG);
        drawChip(dst, px - 14, py + 26, "BG R0.35", C.cyan);
    }
    // midground cards (real depth layer — shifts ∝ ratio 1.0)
    for (const card of CARD_DEFS) {
        const [cx, cy] = place(card.cx, card.cy, offMID);
        const s = offMID.scale;
        const w = card.w * s;
        const h = card.h * s;
        const rot = offMID.rotationDeg;
        fillRectRot(dst, cx + 10, cy + 16, w, h, rot, [0, 0, 0], 0.5);
        fillRectRot(dst, cx, cy, w, h, rot, card.border, 1);
        fillRectRot(dst, cx, cy, w - 4, h - 4, rot, card.body, 1);
        fillRectRot(dst, cx, cy - h / 2 + 14, w - 4, 28, rot, card.head, 1);
        fillRectRot(dst, cx, cy - h / 2 + 30, w - 4, 2, rot, card.border, 0.9);
        drawChip(dst, cx + w / 2 - 56, cy - h / 2 - 14, card.label + " R1.0", C.violet);
    }
    // foreground reticle + chip (fastest layer — shifts ∝ ratio 1.65)
    {
        const [cx, cy] = place(W / 2, H / 2, offFG);
        const rad = (offFG.rotationDeg * Math.PI) / 180;
        for (const base of [0, 1, 2, 3]) {
            const a = rad + (base * Math.PI) / 2;
            const x0 = cx + Math.cos(a) * 8;
            const y0 = cy + Math.sin(a) * 8;
            const x1 = cx + Math.cos(a) * 30;
            const y1 = cy + Math.sin(a) * 30;
            line(dst, x0, y0, x1, y1, C.cyan, 0.85);
        }
        fillRect(dst, cx - 2, cy - 2, cx + 2, cy + 2, C.cyan, 1);
        drawChip(dst, cx - 20, cy + 36, "FG R1.65", C.amber);
    }
}
/** Displacement tracker (ghost = base position, solid = current position). */
function drawTracker(dst, offBG, offMID, offFG) {
    const rows = [
        ["BG", C.cyan, offBG],
        ["MID", C.violet, offMID],
        ["FG", C.amber, offFG],
    ];
    const baseX = 0.05 * W;
    const baseY0 = 0.09 * H;
    rows.forEach(([label, color, off], i) => {
        const y = baseY0 + i * 0.045 * H;
        const [curX, curY] = place(baseX, y, off);
        vLine(dst, baseX, y - 6, y + 6, C.white, 0.28);
        line(dst, baseX, y, curX, curY, color, 0.35);
        vLine(dst, curX, curY - 7, curY + 7, color, 1);
        drawText(dst, label, baseX - 40, y - 3, 1, color, 1);
    });
}
/** Fixed telemetry HUD (screen space — the reference against which planes move). */
function drawHud(dst, frame, totalFrames, seg, p, pose, offBG, offMID, offFG) {
    const accent = familyColor(seg.def.family);
    drawText(dst, `${seg.def.kind}`, 24, 10, 1, C.dim, 1);
    drawText(dst, `FAMILY ${seg.def.family} · EASING ${seg.def.defaultEasing} · ${seg.durationSec.toFixed(1)}S · AMP x${AMP_V.toFixed(1)}`, 24, 24, 1, C.dim, 1);
    const fc = `FRAME ${String(frame).padStart(4, "0")} / ${totalFrames}`;
    drawText(dst, fc, W - textWidth(fc, 1) - 24, 10, 1, C.dim, 1);
    // big centered label + description + progress
    const big = seg.def.label.toUpperCase();
    const bigW = textWidth(big, 3);
    drawText(dst, big, W / 2 - bigW / 2, 64, 3, C.white, 1);
    const dw = textWidth(seg.def.description, 1);
    drawText(dst, seg.def.description, W / 2 - dw / 2, 108, 1, C.dim, 1);
    fillRect(dst, W / 2 - bigW / 2, 90, W / 2 + bigW / 2, 92, accent, 1);
    drawProgressBar(dst, W / 2, 128, 320, p, accent);
    const mc = `MOVE ${seg.index}/${seg.total}`;
    drawText(dst, mc, W / 2 - textWidth(mc, 1) / 2, 140, 1, accent, 1);
    // bottom-left: per-plane displacement meter
    const rows = [
        ["BG", C.cyan, offBG],
        ["MID", C.violet, offMID],
        ["FG", C.amber, offFG],
    ];
    const barX0 = 78;
    const barW = 240;
    rows.forEach(([label, color, off], i) => {
        const y = H - 84 + i * 22;
        drawText(dst, label, 24, y, 1, color, 1);
        fillRect(dst, barX0, y + 1, barX0 + barW, y + 8, [30, 38, 56], 1);
        const mag = Math.min(1, Math.sqrt(off.dx * off.dx + off.dy * off.dy) / 260);
        fillRect(dst, barX0, y + 1, barX0 + barW * mag, y + 8, color, 1);
        drawText(dst, `DX ${fmt(off.dx, 1)}PX DY ${fmt(off.dy, 1)}PX`, barX0 + barW + 12, y, 1, color, 1);
    });
    const scaleLine = `SCALE  BG ${fmt(offBG.scale, 3)}  MID ${fmt(offMID.scale, 3)}  FG ${fmt(offFG.scale, 3)}`;
    drawText(dst, scaleLine, 24, H - 18, 1, C.dim, 1);
    // bottom-right: camera pose readout
    const pos = pose.position;
    const rot = pose.rotation;
    const p1 = `POSE  X ${fmt(pos[0], 2)}  Y ${fmt(pos[1], 2)}  Z ${fmt(pos[2], 2)}`;
    const p2 = `ROT   RX ${fmt(rot[0], 2)}  RY ${fmt(rot[1], 2)}  RZ ${fmt(rot[2], 2)}`;
    const p3 = `FOV ${fmt(pose.fov, 1)}  P ${fmt(p, 2)}  ROTD BG ${fmt(offBG.rotationDeg, 1)} MID ${fmt(offMID.rotationDeg, 1)} FG ${fmt(offFG.rotationDeg, 1)}`;
    drawText(dst, p1, W - textWidth(p1, 1) - 24, H - 84, 1, C.dim, 1);
    drawText(dst, p2, W - textWidth(p2, 1) - 24, H - 62, 1, C.dim, 1);
    drawText(dst, p3, W - textWidth(p3, 1) - 24, H - 40, 1, C.dim, 1);
}
function drawProgressBar(dst, cx, y, w, p, color) {
    fillRect(dst, cx - w / 2, y, cx + w / 2, y + 6, [30, 38, 56], 1);
    fillRect(dst, cx - w / 2, y, cx - w / 2 + w * Math.min(1, Math.max(0, p)), y + 6, color, 1);
    hLine(dst, cx - w / 2, cx + w / 2, y, C.white, 0.35);
    hLine(dst, cx - w / 2, cx + w / 2, y + 6, C.white, 0.35);
    vLine(dst, cx - w / 2, y, y + 6, C.white, 0.35);
    vLine(dst, cx + w / 2, y, y + 6, C.white, 0.35);
}
// ---------------------------------------------------------------------------
// Intro title card
// ---------------------------------------------------------------------------
function renderIntroCard(dst, frame) {
    const zero = { dx: 0, dy: 0, scale: 1, rotationDeg: 0 };
    drawScene(dst, zero, zero, zero);
    applyVignette(dst);
    const fade = Math.min(1, frame / (FPS_V * 0.7));
    const lines = [
        ["LANDSCAPE CAMERA SYSTEM", 3, C.white],
        ["DETERMINISTIC CAMERA MOVES + 2.5D PARALLAX — VISUAL PROOF", 1, C.dim],
        ["3 DEPTH PLANES · BG R0.35 / MID R1.0 / FG R1.65 · 22 MOVES", 1, C.dim],
        ["EVERY FRAME = MIRRORPOSE(PLAN, FPS, FRAME, SEED) + MIRROROFFSETS(...)", 1, C.dim],
        [`CAMERA OFFSETS AMPLIFIED x${AMP_V.toFixed(1)} FOR CLARITY`, 1, C.pink],
    ];
    const ys = [280, 330, 356, 382, 408];
    for (let i = 0; i < lines.length; i++) {
        const [txt, sc, col] = lines[i];
        const tw = textWidth(txt, sc);
        drawText(dst, txt, W / 2 - tw / 2, ys[i], sc, col, fade);
    }
    fillRect(dst, W / 2 - 300, 468, W / 2 + 300, 470, C.cyan, fade * 0.8);
    const g = `GENERATING ${totalFrames} FRAMES @ ${FPS_V}FPS ...`;
    drawText(dst, g, W / 2 - textWidth(g, 1) / 2, 484, 1, C.cyan, fade);
}
function applyVignette(dst) {
    for (let i = 0; i < W * H; i++) {
        const m = vignette[i] / 255;
        const j = i * 3;
        dst[j] *= m;
        dst[j + 1] *= m;
        dst[j + 2] *= m;
    }
}
function addGrain(dst, frame) {
    for (let y = 0; y < H; y += 2) {
        const row = y * W * 3;
        for (let x = 0; x < W; x += 2) {
            const h = ((frame * 31 + x * 7 + y * 13) % 9) - 4;
            const i = row + x * 3;
            dst[i] = clampByte(dst[i] + h * 2.4);
            dst[i + 1] = clampByte(dst[i + 1] + h * 2.4);
            dst[i + 2] = clampByte(dst[i + 2] + h * 2.4);
        }
    }
}
// ---------------------------------------------------------------------------
// Frame driver
// ---------------------------------------------------------------------------
function renderFrame(frame, segs, totalFrames) {
    const dst = new Uint8Array(W * H * 3);
    const sec = frame / FPS_V;
    if (sec < INTRO_SEC) {
        renderIntroCard(dst, frame);
        return dst;
    }
    const seg = findSegment(segs, sec);
    const plan = seg.plan;
    const p = mirrorProgress(plan, FPS_V, frame, specs);
    const { pose } = mirrorPose(plan, FPS_V, frame, SEED, specs);
    const offBG = ampOff(mirrorOffsets(plan, p, RATIO_BG, SEED));
    const offMID = ampOff(mirrorOffsets(plan, p, RATIO_MID, SEED));
    const offFG = ampOff(mirrorOffsets(plan, p, RATIO_FG, SEED));
    drawScene(dst, offBG, offMID, offFG);
    drawTracker(dst, offBG, offMID, offFG);
    applyVignette(dst);
    addGrain(dst, frame);
    drawHud(dst, frame, totalFrames, seg, p, pose, offBG, offMID, offFG);
    return dst;
}
// ---------------------------------------------------------------------------
// Main: render frames → pipe raw RGB24 → ffmpeg H.264
// ---------------------------------------------------------------------------
async function main() {
    const args = parseArgs(process.argv);
    const kinds = args.kinds ? args.kinds.split(",").filter(Boolean) : undefined;
    if (args.fps)
        FPS_V = Math.max(12, Math.min(60, parseInt(args.fps, 10)));
    if (args.amp)
        AMP_V = Math.max(1, Math.min(6, parseFloat(args.amp)));
    const segs = buildSegments(kinds);
    const totalSec = segs[segs.length - 1].endSec;
    totalFrames = Math.round(totalSec * FPS_V);
    const outPath = args.out ?? path.join(OUT_DIR, "landscape_camera_visual_proof.mp4");
    mkdirSync(path.dirname(outPath), { recursive: true });
    console.error(`[camera-proof] ${segs.length} moves → ${totalSec.toFixed(1)}s @ ${FPS_V}fps = ${totalFrames} frames, AMP x${AMP_V}`);
    console.error(`[camera-proof] encoding → ${outPath}`);
    const ff = spawn("ffmpeg", [
        "-y",
        "-loglevel", "error",
        "-f", "rawvideo",
        "-pix_fmt", "rgb24",
        "-s", `${W}x${H}`,
        "-r", String(FPS_V),
        "-i", "pipe:0",
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "20",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        outPath,
    ], { stdio: ["pipe", "ignore", "inherit"] });
    if (!ff.stdin)
        throw new Error("no stdin");
    const t0 = Date.now();
    for (let frame = 0; frame < totalFrames; frame++) {
        const buf = renderFrame(frame, segs, totalFrames);
        if (!ff.stdin.write(buf))
            await once(ff.stdin, "drain");
        if (frame % 60 === 0 || frame === totalFrames - 1) {
            const secs = ((Date.now() - t0) / 1000).toFixed(1);
            console.error(`[camera-proof] frame ${frame + 1}/${totalFrames}  (${secs}s)`);
        }
    }
    ff.stdin.end();
    const code = await new Promise((resolve) => ff.on("close", resolve));
    if (code !== 0)
        throw new Error(`ffmpeg exited ${code}`);
    console.error(`[camera-proof] DONE in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${outPath}`);
}
let totalFrames = 0;
void main().catch((err) => {
    console.error("[camera-proof] FAILED:", err);
    process.exit(1);
});
