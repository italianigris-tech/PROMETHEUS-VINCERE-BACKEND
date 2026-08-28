#!/usr/bin/env python3
"""
mix_transition_bed.py
=====================
Python proof-mixer for the causally-governed sound-transition plan emitted by
`sound_transition_orchestrator.ts` (`transition_scenario.json`).

It renders a deterministic stereo proof WAV that realises the four transition
devices exactly as the orchestrator scheduled them:

  * BRIDGE BEDS   - stacked beds laid under the A->B handoff (no hard switch),
                    each looped to its `loopSec` unit, seamed by equal-power fades.
  * RISER LIFT    - a synthesized noise sweep 140 -> 3400 Hz band-passed with a
                    swept spectral mask (STFT), placed as a mono pan.
  * DEAD-AIR DROP - the target bed is CUT at `cutSec`, holds silence for the
                    statement, then re-enters continuously from `resumeLoopPhase`
                    with a de-click equal-power crossfade and an 8 ms de-click
                    ramp into the cut.
  * REVERB TAIL   - a convolution reverb (decaying-noise stereo IR, seeded)
                    wet-sends the outro bed from `startSec` and rings a tail that
                    is `tailDecaySec` PAST the video end (never a hard fade).

Finally the bus is summed, normalised to the house integrated-LUFS target
(-14 LUFS, EBU R128 K-weighting via pyloudnorm) and true-peak limited to
-1.5 dBTP (4x-oversampled peak), then written as a 24-bit WAV.

Dependencies: numpy, scipy, soundfile, pyloudnorm (all installed). FFmpeg is only
used (via ffprobe) to validate the finished proof; audio is decoded by soundfile.

Determinism: every stochastic element (riser noise, reverb IR) is seeded from
`meta.seed` XOR a stable crc32 of the element id, so re-runs are byte-identical.

Usage:
    python3 mix_transition_bed.py [scenario.json] [out.wav] [--studio-root ROOT]
"""

from __future__ import annotations

import argparse
import json
import math
import os
import subprocess
import sys
import time
import zlib
from pathlib import Path

import numpy as np


try:
    import soundfile as sf
except Exception:  # pragma: no cover
    sf = None

try:
    from scipy import signal as sps
except Exception:  # pragma: no cover
    sps = None

try:
    import pyloudnorm as pyln
except Exception:  # pragma: no cover
    pyln = None


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
def db_to_linear(db: float) -> float:
    return float(10.0 ** (db / 20.0))


def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def stable_seed(seed: int, ident: str) -> np.random.SeedSequence:
    """Deterministic, platform-stable seed for a named element."""
    return np.random.SeedSequence([int(seed) & 0xFFFFFFFF, zlib.crc32(ident.encode("utf-8"))])


def equal_power_env(n: int, fade_in_n: int, fade_out_n: int) -> np.ndarray:
    """Multiplicative equal-power fade envelope (sin in, cos out)."""
    env = np.ones(n, dtype=np.float64)
    if n <= 0:
        return env
    if fade_in_n > 0:
        fi = min(fade_in_n, n)
        x = np.linspace(0.0, 1.0, fi)
        env[:fi] = np.sin(0.5 * np.pi * x)
    if fade_out_n > 0:
        fo = min(fade_out_n, n)
        x = np.linspace(0.0, 1.0, fo)
        env[n - fo:] *= np.cos(0.5 * np.pi * x)
    return env


def balance_gains(pan: float):
    """Stereo balance law: attenuate the opposite channel; centre = unity."""
    p = clamp(pan, -1.0, 1.0)
    if p <= 0.0:
        return 1.0, math.cos(p * math.pi / 2.0)
    return math.cos(p * math.pi / 2.0), 1.0


def pan_place(pan: float):
    """Constant-power mono placement across the stereo field."""
    p = clamp(pan, -1.0, 1.0)
    t = (p + 1.0) * math.pi / 4.0
    return math.cos(t), math.sin(t)


# --------------------------------------------------------------------------
# Asset decoding
# --------------------------------------------------------------------------
def _resample(data: np.ndarray, sr: int, target_sr: int, axis: int = 0) -> np.ndarray:
    if sr == target_sr:
        return data
    g = math.gcd(sr, target_sr)
    up = target_sr // g
    down = sr // g
    return sps.resample_poly(data, up, down, axis=axis)


def load_asset(path: str, studio_root: Path, fs: int) -> np.ndarray:
    """Return stereo float64 audio for `path` (relative to studio_root) at `fs`."""
    full = Path(path) if Path(path).is_absolute() else studio_root / path
    if sf is not None:
        data, sr = sf.read(str(full), always_2d=True, dtype="float64")
    else:  # pragma: no cover - scipy fallback only if soundfile missing
        from scipy.io import wavfile

        sr, data = wavfile.read(full)
        scale = 1.0 if data.dtype.kind == "f" else float(2 ** (data.dtype.itemsize * 8 - 1))
        data = data.astype(np.float64) / scale
        if data.ndim == 1:
            data = data[:, None]
    if data.shape[1] == 1:
        data = np.repeat(data, 2, axis=1)
    elif data.shape[1] > 2:
        data = data[:, :2]
    data = _resample(data, sr, fs, axis=0)
    # Guard against pathological sample rates or non-finite values.
    data = np.nan_to_num(data, nan=0.0, posinf=0.0, neginf=0.0)
    return np.ascontiguousarray(data)


def make_loop_unit(asset: np.ndarray, loop_sec: float, fs: int) -> np.ndarray:
    """Build a loop unit of exactly `loop_sec` seconds.

    Longer assets are cropped to the first `loop_sec`; shorter assets are
    tiled so the nominal loop unit matches the orchestrator's `loopSec`.
    """
    n = asset.shape[0]
    target = max(1, int(round(loop_sec * fs)))
    if n >= target:
        return asset[:target].copy()
    reps = int(math.ceil(target / n))
    return np.tile(asset, (reps, 1))[:target].copy()


def tile_loop(loop: np.ndarray, n: int) -> np.ndarray:
    """Repeat the loop unit to exactly n samples (phase 0)."""
    m = loop.shape[0]
    if n <= 0:
        return np.zeros((0, loop.shape[1]), dtype=np.float64)
    reps = int(math.ceil(n / m))
    return np.ascontiguousarray(np.tile(loop, (reps, 1))[:n])


def loop_slice(loop: np.ndarray, offset: int, n: int) -> np.ndarray:
    """n samples from `loop` starting at `offset`, wrapping (phase-aware)."""
    m = loop.shape[0]
    idx = (offset + np.arange(n)) % m
    return loop[idx].copy()


# --------------------------------------------------------------------------
# Bed rendering (with optional dialogue dead-air drop)
# --------------------------------------------------------------------------
def render_bed_signal(clip, loop: np.ndarray, fs: int, dropout=None) -> np.ndarray:
    """Render the stereo source timeline of one bed clip.

    If `dropout` targets this clip's id, the source is cut at cutSec, held
    silent through the statement, then re-enters from `resumeLoopPhase`.
    """
    start, end = clip["startSec"], clip["endSec"]
    n = int(round((end - start) * fs))
    if n <= 0:
        return np.zeros((0, 2), dtype=np.float64)

    src = tile_loop(loop, n)

    if dropout and dropout.get("targetBedId") == clip["id"]:
        cut_s = int(round((dropout["cutSec"] - start) * fs))
        re_s = int(round((dropout["reEntrySec"] - start) * fs))
        cf_s = int(round(dropout.get("reEntryCrossfadeSec", 0.0) * fs))

        cut_s = int(clamp(cut_s, 0, n))
        re_s = int(clamp(re_s, 0, n))

        # 8 ms de-click ramp into the hard dead-air cut.
        declick = int(round(0.008 * fs))
        if 0 < declick < cut_s:
            x = np.linspace(0.0, 1.0, declick)
            src[cut_s - declick:cut_s] *= np.cos(0.5 * np.pi * x)[:, None]

        # Silence for the statement.
        src[cut_s:re_s] = 0.0

        if re_s < n:
            resume_offset = int(round(dropout["resumeLoopPhase"] * loop.shape[0]))
            resumed = loop_slice(loop, resume_offset, n - re_s)
            if cf_s > 0:
                seg = min(cf_s, n - re_s)
                x = np.linspace(0.0, 1.0, seg)
                # Equal-power de-click: silence -> resumed (sin crossfade).
                src[re_s:re_s + seg] = resumed[:seg] * np.sin(0.5 * np.pi * x)[:, None]
                src[re_s + seg:] = resumed[seg:]
            else:
                src[re_s:] = resumed

    return src


def place_bed(bus, clip, loop, fs, dropout=None):
    """Render a bed clip, apply gain/pan/equal-power fades, sum into bus."""
    src = render_bed_signal(clip, loop, fs, dropout)
    n = src.shape[0]
    if n <= 0:
        return None, None

    lg, rg = balance_gains(clip.get("pan", 0.0))
    stereo = src.copy()
    stereo[:, 0] *= lg
    stereo[:, 1] *= rg

    fi = int(round(clip.get("fadeInSec", 0.0) * fs))
    fo = int(round(clip.get("fadeOutSec", 0.0) * fs))
    stereo *= equal_power_env(n, fi, fo)[:, None]
    stereo *= db_to_linear(clip.get("gainDb", 0.0))

    start = int(round(clip["startSec"] * fs))
    end = min(start + n, bus.shape[0])
    if end > start:
        bus[start:end] += stereo[:end - start]
    return stereo, start


# --------------------------------------------------------------------------
# Riser lift (synthesized, swept band-passed noise via STFT)
# --------------------------------------------------------------------------
def render_riser(clip, fs, seed) -> np.ndarray:
    """Deterministic freqStart->freqEnd Hz noise sweep, returned as mono (n,)."""
    start, end = clip["startSec"], clip["endSec"]
    n = int(round((end - start) * fs))
    if n <= 0:
        return np.zeros(0, dtype=np.float64)

    f0 = float(clip.get("freqStartHz", 140))
    f1 = float(clip.get("freqEndHz", 3400))
    rng = np.random.default_rng(stable_seed(seed, clip["id"]))

    noise = rng.standard_normal(n)

    nperseg = 2048
    noverlap = 1024
    if n < nperseg:
        nperseg = 512
        noverlap = 256
    f, t, Z = sps.stft(noise, fs=fs, nperseg=nperseg, noverlap=noverlap)

    # Constant-Q Gaussian band mask whose centre sweeps f0 -> f1 over the riser.
    use = f > 1.0
    valid_f = f[use]
    span = n / fs
    sigma_log = math.log(2.0)  # ~ +/-1 octave passband

    mask = np.zeros_like(Z, dtype=np.float64)
    for k in range(t.size):
        frac = np.clip(t[k] / span, 0.0, 1.0)
        center = f0 * (f1 / f0) ** frac
        if center <= 1.0:
            continue
        w = np.exp(-0.5 * ((np.log(valid_f) - np.log(center)) / sigma_log) ** 2)
        mask[use, k] = w

    Z *= mask
    _, y = sps.istft(Z, fs=fs, nperseg=nperseg, noverlap=noverlap)
    y = np.asarray(y).ravel()[:n]

    # Peak-normalise so gainDb is a real, click-free level reference (noise has a
    # high crest factor, so RMS normalisation would push the transient >0 dBFS).
    peak = np.max(np.abs(y)) + 1e-12
    y = y / peak

    # Gentle upward swell + tiny edge ramps to de-click.
    tt = np.linspace(0, 1, n)
    y *= (0.35 + 0.65 * tt)
    edge = int(round(0.010 * fs))
    if edge > 0 and n > 2 * edge:
        y[:edge] *= np.linspace(0, 1, edge)
        y[-edge:] *= np.linspace(1, 0, edge)

    return y


def place_riser(bus, clip, fs, seed, gain_db, pan):
    mono = render_riser(clip, fs, seed)
    n = mono.shape[0]
    if n <= 0:
        return
    lg, rg = pan_place(pan)
    g = db_to_linear(gain_db)
    start = int(round(clip["startSec"] * fs))
    end = min(start + n, bus.shape[0])
    if end <= start:
        return
    seg = end - start
    bus[start:end, 0] += mono[:seg] * lg * g
    bus[start:end, 1] += mono[:seg] * rg * g


# --------------------------------------------------------------------------
# Reverb tail outro
# --------------------------------------------------------------------------
def make_ir(tail_decay_sec: float, fs: int, rng: np.random.Generator) -> np.ndarray:
    """Exponentially-decaying seeded noise impulse response (mono, tail_decay long)."""
    n = max(1, int(round(tail_decay_sec * fs)))
    t = np.arange(n) / fs
    ir = rng.standard_normal(n) * np.exp(-4.0 * t / tail_decay_sec)
    e = np.sqrt(np.sum(ir ** 2))
    if e > 0:
        ir = ir / e
    return ir


def render_outro_wet(outro, bed_dry, bed_start_sec, fs, seed) -> np.ndarray:
    """Convolution-reverb wet tail from the outro bed's dry send, stereo.

    Returns a stereo wet signal sampled from outro.startSec, extending
    tailDecaySec past outro.endSec (time 0 == outro.startSec).
    """
    in_start = int(round((outro["startSec"] - bed_start_sec) * fs))
    in_end = int(round((outro["endSec"] - bed_start_sec) * fs))
    in_start = int(clamp(in_start, 0, bed_dry.shape[0]))
    in_end = int(clamp(in_end, 0, bed_dry.shape[0]))
    if in_end <= in_start:
        return np.zeros((0, 2), dtype=np.float64)

    inp = bed_dry[in_start:in_end].copy()
    wet_len = inp.shape[0] + int(round(outro["tailDecaySec"] * fs)) - 1
    wet = np.zeros((wet_len, 2), dtype=np.float64)

    # Fade the reverb *send* in over 150 ms to avoid a click at the wet-out start.
    infade = int(round(0.150 * fs))
    if infade > 0 and inp.shape[0] > 0:
        inf = min(infade, inp.shape[0])
        inp[:inf] *= np.sin(0.5 * np.pi * np.linspace(0, 1, inf))[:, None]

    ir_len = int(round(outro["tailDecaySec"] * fs))
    for ch in range(2):
        ir = make_ir(outro["tailDecaySec"], fs, np.random.default_rng(stable_seed(seed, f"ir-{ch}")))[:ir_len]
        wet[:, ch] = sps.fftconvolve(inp[:, ch], ir, mode="full")[:wet_len]

    wet *= db_to_linear(outro.get("reverbMixDb", -6.0))
    return wet


# --------------------------------------------------------------------------
# Loudness governance
# --------------------------------------------------------------------------
def measure_integrated_lufs(bus, fs):
    if pyln is None:  # pragma: no cover
        return None
    meter = pyln.Meter(fs)
    return meter.integrated_loudness(bus)


def true_peak_db(bus, fs, oversample=4):
    up = sps.resample_poly(bus, oversample, 1, axis=0)
    peak = float(np.max(np.abs(up)))
    if peak <= 0:
        return -90.0
    return 20.0 * math.log10(peak)


def apply_tp_limiter(x, ceiling_lin, fs):
    """Deterministic lookahead soft-knee limiter at `ceiling_lin` (linear peak).

    Computes a gain envelope from the max(|L|,|R|) that dips before transients
    (lookahead via a minimum filter) with an instant attack and an ~80 ms
    release, then applies it to both channels. Returns a new array in [-1, 1].
    """
    env = np.maximum(np.abs(x[:, 0]), np.abs(x[:, 1]))
    inst = np.minimum(1.0, ceiling_lin / (env + 1e-9))

    la = max(1, int(round(0.003 * fs)))  # 3 ms lookahead
    from scipy.ndimage import minimum_filter1d

    g_look = minimum_filter1d(inst, size=2 * la + 1, mode="nearest")
    g_look = np.concatenate([g_look[la:], np.full(la, g_look[-1])])
    g_look = np.minimum(g_look, 1.0)

    rel = max(1, int(round(0.080 * fs)))  # 80 ms release time constant
    alpha = 1.0 - math.exp(-1.0 / rel)
    g = np.empty(g_look.shape, dtype=np.float64)
    prev = 1.0
    for i in range(g_look.shape[0]):
        if g_look[i] < prev:
            prev = g_look[i]                     # instant attack
        else:
            prev = alpha * prev + (1.0 - alpha) * g_look[i]  # slow release
        g[i] = prev
    return x * g[:, None]


def normalize_bus(bus, target_lufs, tp_ceiling_db, fs, max_iter=5):
    """Normalise to `target_lufs` integrated while keeping true peak <= ceiling.

    A static gain cannot satisfy both on high-crest-content, so a lookahead peak
    limiter is applied iteratively with loudness remeasurement, mirroring the
    house ffmpeg `loudnorm=I=..:TP=..` behaviour.
    """
    # Never start from a clipping master.
    tp0 = true_peak_db(bus, fs)
    if tp0 > tp_ceiling_db:
        bus = bus * db_to_linear(tp_ceiling_db - tp0)

    measured = measure_integrated_lufs(bus, fs)
    if measured is None or not math.isclose(measured, 0.0, abs_tol=1e-6):
        for _ in range(max_iter):
            if measured is None or abs(measured - target_lufs) < 0.25:
                break
            bus = bus * db_to_linear(target_lufs - measured)
            bus = apply_tp_limiter(bus, db_to_linear(tp_ceiling_db - 0.6), fs)
            measured = measure_integrated_lufs(bus, fs)

    # Final safety trim so the oversampled true peak respects the ceiling.
    tp = true_peak_db(bus, fs)
    if tp > tp_ceiling_db:
        bus = bus * db_to_linear(tp_ceiling_db - tp)
        tp = true_peak_db(bus, fs)  # re-measure after trim

    return bus, measured, tp


# --------------------------------------------------------------------------
# Orchestration
# --------------------------------------------------------------------------
def cli(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Render the transition plan to a proof WAV.")
    ap.add_argument("scenario", nargs="?", default=None, help="Path to transition_scenario.json")
    ap.add_argument("out", nargs="?", default=None, help="Output WAV path")
    ap.add_argument("--studio-root", default=None, help="Repo root holding the SOUND FX assets")
    args = ap.parse_args(argv)

    here = Path(__file__).resolve().parent
    studio_root = Path(args.studio_root).resolve() if args.studio_root else here.parents[1]
    scenario_path = Path(args.scenario).resolve() if args.scenario else here / "transition_scenario.json"
    out_path = Path(args.out).resolve() if args.out else here / "transition_proof_mix.wav"

    if not scenario_path.exists():
        print(f"x scenario not found: {scenario_path}")
        return 1

    with open(scenario_path, "r", encoding="utf-8") as fh:
        plan = json.load(fh)

    meta = plan.get("meta", {})
    fs = int(meta.get("sampleRate", 44100))
    target_lufs = float(meta.get("integratedTargetLufs", -14))
    tp_ceiling_db = float(meta.get("truePeakCeilingDb", -1.5))
    seed = int(meta.get("seed", 0))
    outro = plan.get("outro", {})
    dropouts = plan.get("dropouts", [])

    bus_len = 0
    for c in plan.get("mixClips", []):
        bus_len = max(bus_len, int(math.ceil(float(c["endSec"]) * fs)))
    if outro:
        bus_len = max(bus_len, int(math.ceil((float(outro.get("endSec", 0)) + float(outro.get("tailDecaySec", 0))) * fs)))
    bus_len = max(bus_len, 1)
    bus = np.zeros((bus_len, 2), dtype=np.float64)

    t0 = time.time()

    # Cache assets + loop units so repeated beds share a decode.
    asset_cache = {}
    loop_cache = {}

    def get_asset_and_loop(clip):
        path = clip["assetPath"]
        if path not in asset_cache:
            asset_cache[path] = load_asset(path, studio_root, fs)
        if path not in loop_cache:
            loop_cache[path] = make_loop_unit(asset_cache[path], clip["loopSec"], fs)
        return asset_cache[path], loop_cache[path]

    bed_by_id = {}
    for clip in plan.get("mixClips", []):
        kind = clip.get("kind")
        if kind == "bed":
            asset, loop = get_asset_and_loop(clip)
            drop = next((d for d in dropouts if d.get("targetBedId") == clip["id"]), None)
            rendered, start = place_bed(bus, clip, loop, fs, drop)
            bed_by_id[clip["id"]] = (rendered, clip)
            print(f"  bed  {clip['id']:<14} [{clip['startSec']:>5.2f},{clip['endSec']:>5.2f}] "
                  f"gain {clip['gainDb']:>5.1f}dB pan {clip['pan']:>4.2f} loop {len(loop)/fs:.2f}s")
        elif kind == "riser":
            place_riser(bus, clip, fs, seed, clip.get("gainDb", 0.0), clip.get("pan", 0.0))
            print(f"  riser {clip['id']:<14} [{clip['startSec']:>5.2f},{clip['endSec']:>5.2f}] "
                  f"{clip.get('freqStartHz')}->{clip.get('freqEndHz')}Hz gain {clip['gainDb']:>5.1f}dB")


    # Apply the reverb-tail outro as a wet send on the outro bed's dry signal.
    if outro and bed_by_id.get(outro.get("bedId")):
        dry, dry_clip = bed_by_id[outro["bedId"]]
        if dry is not None:
            wet = render_outro_wet(outro, dry, dry_clip["startSec"], fs, seed)
            if wet.shape[0] > 0:
                ostart = int(round(outro["startSec"] * fs))
                oend = min(ostart + wet.shape[0], bus.shape[0])
                if oend > ostart:
                    bus[ostart:oend] += wet[:oend - ostart]
            print(f"  outro reverb wet-out on {outro['bedId']} [{outro['startSec']:.2f}->{outro['endSec']:.2f}] "
                  f"tail {outro.get('tailDecaySec')}s mix {outro.get('reverbMixDb')}dB")

    for did in dropouts:
        print(f"  drop  {did['targetBedId']} cut@{did['cutSec']}s dead-air "
              f"{did.get('statementSec')}s re-enter@{did.get('reEntrySec')}s phase {did.get('resumeLoopPhase')}")

    # ---- Loudness normalization (integrated LUFS + true-peak limiter) ----
    lufs_before = measure_integrated_lufs(bus, fs)
    bus, lufs_after, tp_after = normalize_bus(bus, target_lufs, tp_ceiling_db, fs)
    bus = np.clip(bus, -1.0, 1.0)
    dur = bus.shape[0] / fs

    os.makedirs(out_path.parent, exist_ok=True)
    if sf is not None:
        sf.write(str(out_path), bus, fs, subtype="PCM_24")
    else:  # pragma: no cover
        from scipy.io import wavfile

        wavfile.write(str(out_path), fs, (bus * 32767).astype(np.int16))

    print("  ------------------------------------------------------------------")
    print(f"  output      : {out_path}")
    print(f"  duration    : {dur:.3f}s @ {fs} Hz, {bus.shape[1]} ch (24-bit)")
    print(f"  integrated  : {round(lufs_before,2) if lufs_before is not None else 'n/a'} LUFS -> "
          f"{round(lufs_after,2) if lufs_after is not None else 'n/a'} LUFS (target {target_lufs})")
    print(f"  true peak   : {round(tp_after,2)} dBTP (ceiling {tp_ceiling_db})")
    print(f"  render time : {time.time()-t0:.2f}s")


    # ---- Optional ffprobe validation ----
    try:
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries",
             "stream=sample_rate,channels,codec_name,duration:format=duration",
             "-of", "json", str(out_path)],
            capture_output=True, text=True, timeout=60,
        )
        if probe.returncode == 0:
            info = json.loads(probe.stdout or "{}")
            st = (info.get("streams") or [{}])[0]
            print(f"  ffprobe     : {st.get('codec_name')} {st.get('sample_rate')}Hz "
                  f"{st.get('channels')}ch dur={float(st.get('duration', 0)):.3f}s")
        else:
            print(f"  ffprobe     : {probe.stderr.strip() or 'error'}")
    except Exception as exc:  # pragma: no cover
        print(f"  ffprobe     : skipped ({exc})")

    return 0


if __name__ == "__main__":
    sys.exit(cli())

