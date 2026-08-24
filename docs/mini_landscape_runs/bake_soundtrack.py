#!/usr/bin/env python3
"""
bake_soundtrack.py — render the ACTUAL soundtrack for a landscape treatment.

The song-selection layer (landscape_song_selector.ts) picks a seed track per
section. The seed catalogue carries fingerprints but NO audio files, so this
bridge maps each selected seed track to a REAL literal song from the Cloudflare
R2 music library (bucket prometheus-music, music-originals/ — classical,
cinematic trailer, hip-hop, lo-fi, motivational) downloaded into ./music/,
and renders the per-section SONGS into a full audio mix:

  AUD-01  loudness            -14 LUFS integrated / -1.5 dBTP ceiling
  AUD-03  fades               2.0s program fade in/out
  AUD-04  voice ducking       music -6dB under speech (sidechain)
  AUD-06  emotional insert    payoff song insert honored (alt track)
  AUD-08  bed stays empty     no general bed, only per-section songs
  AUD-09  transition beds     subtle synthesized riser under each song change
  blends  lowpass_sweep / beat_crossfade realized as windowed fades
  SONG-07 single-song        adjacent same-track windows merge into one (no
                             internal dips); short-form runs are one song

Usage:
  python3 docs/mini_landscape_runs/bake_soundtrack.py \\
      --manifest docs/mini_landscape_runs/out/<run>/landscape_treatment_manifest.json \\
      --video <silence-cut.mp4> \\
      --out <out.mp4>
"""
import argparse
import json
import os
import subprocess
import sys

MUSIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "music")

# --- Seed-track -> REAL SONG (Cloudflare R2 music-originals/) ---
# Each seed-track is an abstract vibe placeholder; this mapping bridges it to
# an actual literal song — classical, cinematic, hip-hop, etc. — that matches
# the seed's semantic fingerprint (energy/momentum/warmth/clarity/prestige).
SEED_TO_REAL: dict[str, str] = {
    "seed_cinematic_braam_04":     "epic-cinematic-dramatic-adventure-trailer.mp3",  # hook/payoff - epic cinematic
    "seed_soft_desk_piano_01":     "passacaglia-handel-halvorsen-relaxing-piano-music.mp3",  # setup - calm piano
    "seed_executive_board_02":     "vivaldi-the-four-seasons-summer-violin-concerto-in-g-minor-op-8-2-rv-315-iii-presto.mp3",  # explain - premium classical
    "seed_documentary_emotive_07": "triumph.mp3",  # demonstrate - emotive uplift
    "seed_luxe_ambient_pad_08":    "the-way-instrumental.mp3",  # outro - ambient chill
}

# Alternate song per seed (used so an emotional_insert accent is a different
# real song than the hosting section's song of the same track).
SEED_TO_REAL_ALT: dict[str, str] = {
    "seed_cinematic_braam_04": "epic-inspiration.mp3",
}

SECTION_GATE_FADE = 1.5   # seconds of fade at each section edge (blend realization)
PROGRAM_FADE = 2.0        # AUD-03 program fades


def real_path(track_id: str, alt: bool = False) -> str:
    name = SEED_TO_REAL_ALT.get(track_id) if alt else None
    name = name or SEED_TO_REAL[track_id]
    return os.path.join(MUSIC_DIR, name)


def build_ffmpeg_args(manifest: dict, video: str, out_path: str, music_only: bool = False) -> list[str]:
    T = manifest["silenceCut"]["outputDurationSec"]
    selections = manifest["soundtrack"]["selections"]
    sections = manifest["sections"]

    # Build per-section song windows (selection covers the section role's window)
    songs: list[dict] = []
    sec_song_track: dict[str, str] = {}
    for sel in selections:
        sec = next((s for s in sections if s["sectionId"] == sel["sectionId"]), None)
        if not sec:
            continue
        sec_song_track[sel["sectionId"]] = sel["trackId"]
        songs.append({"trackId": sel["trackId"], "start": sec["startSec"], "end": sec["endSec"], "gainDb": -16.0})

    # emotional_insert from the soundtrack envelope (AUD-06).
    # If the insert duplicates the hosting section's song track, use the alt
    # real asset so the accent is audible rather than stacked-identical.
    for env in manifest["soundtrack"]["sections"]:
        if env["role"] == "emotional_insert" and env["assetId"] != "songbed_empty":
            host = next((s for s in sections if s["startSec"] <= env["startSec"] < s["endSec"]), None)
            use_alt = host is not None and sec_song_track.get(host["sectionId"]) == env["assetId"]
            songs.append({"trackId": env["assetId"], "start": env["startSec"], "end": env["endSec"],
                          "gainDb": env.get("gainDb", -16.0), "alt": use_alt})

    # Dedup: same track+window should not render twice
    dedup, seen = [], set()
    for s in songs:
        key = (s["trackId"], round(s["start"], 1), round(s["end"], 1))
        if key not in seen:
            seen.add(key); dedup.append(s)
    songs = dedup

    # Merge adjacent/overlapping windows that share the SAME real asset + gain,
    # so a continuous run of one song (SONG-07 single-song short-form, or a
    # "none"-blend continuation) renders as ONE window with no internal gate
    # fades — the one song plays clean end-to-end instead of dipping at every
    # section boundary.
    songs.sort(key=lambda s: (s["start"], s["end"]))
    merged: list[dict] = []
    for s in songs:
        if (
            merged
            and merged[-1]["trackId"] == s["trackId"]
            and merged[-1].get("alt") == s.get("alt")
            and abs(merged[-1]["gainDb"] - s["gainDb"]) < 0.01
            and s["start"] <= merged[-1]["end"] + 0.05
        ):
            merged[-1]["end"] = max(merged[-1]["end"], s["end"])
        else:
            merged.append(dict(s))
    songs = merged

    # Inputs: 0 = video+voice, then one per unique real file
    unique_files = []
    for s in songs:
        p = real_path(s["trackId"], s.get("alt", False))
        if p not in unique_files:
            unique_files.append(p)

    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", video]
    for p in unique_files:
        cmd += ["-stream_loop", "-1", "-i", p]

    fc = []  # filtergraph expressions
    if not music_only:
        fc.append("[0:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit=2[vout][vkey]")

    # One gate per song window
    mix_inputs = []
    for i, s in enumerate(songs):
        idx = unique_files.index(real_path(s["trackId"], s.get("alt", False))) + 1
        dur = s["end"] - s["start"]
        label = f"s{i}"
        chain = f"[{idx}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:{dur:.3f},asetpts=PTS-STARTPTS"
        if dur > SECTION_GATE_FADE * 2 + 0.5:
            chain += f",afade=t=in:st=0:d={SECTION_GATE_FADE},afade=t=out:st={dur - SECTION_GATE_FADE:.3f}:d={SECTION_GATE_FADE}"
        chain += f",volume={s['gainDb']}dB"
        ms = int(round(s["start"] * 1000))
        chain += f",adelay={ms}|{ms}"
        pad = max(0, int(round((T - s["start"]) * 1000)))
        chain += f",apad=pad_dur={pad / 1000:.3f}[{label}]"
        fc.append(chain)
        mix_inputs.append(f"[{label}]")

    # AUD-09: transition beds (risers) prime song-change boundaries. Each bed is
    # a low-to-high tone sweep with a swell envelope, placed so it PEAKS at the
    # boundary and fades out just after it. Synthesized (no samples on disk),
    # mixed at a low level under the music — it primes the seam without being a
    # hardcoded sound effect.
    for i, bed in enumerate(manifest["soundtrack"].get("transitionBeds", [])):
        rs = float(bed.get("riserSec", 2.2))
        lvl = float(bed.get("levelDb", -25.0))
        boundary = float(bed["boundarySec"])
        # Riser: rises over `rs`, peaks AT the boundary, then decays for 1.0s
        # so it bridges the incoming song's natural lead-in (no dead-air hole).
        dur = rs + 1.0
        start_ms = int(round((boundary - rs) * 1000))
        if start_ms < 0:
            continue
        # Sweep 90 Hz -> 590 Hz by the boundary: phase = 2*pi*(90*t + K*t^3/3)
        # with K = 500/rs^2, so f(rs) = 90 + 500 = 590 Hz. + a soft 2nd partial.
        sweep = f"2*PI*(90*t+{500.0 / (3 * rs * rs):.4f}*t*t*t)"
        expr = f"0.6*sin({sweep})+0.15*sin(2*{sweep})"
        label = f"r{i}"
        chain = f"aevalsrc=exprs='{expr}':s=48000:d={dur:.3f}"
        chain += f",afade=t=in:st=0:d={rs:.3f}"
        chain += f",afade=t=out:st={rs:.3f}:d=1.0"
        chain += f",volume={lvl}dB"
        chain += f",aformat=sample_rates=48000:channel_layouts=stereo"
        chain += f",adelay={start_ms}|{start_ms}[{label}]"
        fc.append(chain)
        mix_inputs.append(f"[{label}]")

    # Music bus: mix all songs, no normalization (per-song gain is preserved)
    fc.append(f"{''.join(mix_inputs)}amix=inputs={len(mix_inputs)}:normalize=0:dropout_transition=0:duration=longest[mixraw]")

    # AUD-03 program fades
    fc.append(f"[mixraw]afade=t=in:st=0:d={PROGRAM_FADE},afade=t=out:st={T - PROGRAM_FADE:.3f}:d={PROGRAM_FADE}[mixfade]")

    if music_only:
        # Pure music stem (songs only, no voice, no ducking) — for auditioning
        fc.append(f"[mixfade]loudnorm=I=-14:TP=-1.5:LRA=11[mixout]")
        cmd += ["-filter_complex", ";".join(fc)]
        cmd += ["-map", "[mixout]"]
        cmd += ["-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-t", f"{T:.3f}", out_path]
        return cmd

    # AUD-04 voice ducking (-6dB under speech) via sidechain compressor
    fc.append("[mixfade][vkey]sidechaincompress=threshold=0.015:ratio=3.5:attack=40:release=250:makeup=1[duck]")

    # AUD-01 loudness normalize + true peak ceiling
    fc.append(f"[duck]loudnorm=I=-14:TP=-1.5:LRA=11[mixout]")

    # Final mix with voice (voice passes through) — lock 48k negotiation
    fc.append("[mixout][vout]amix=inputs=2:normalize=0:duration=longest[aout]")

    cmd += ["-filter_complex", ";".join(fc)]
    cmd += ["-map", "0:v", "-map", "[aout]"]
    # -t forces hard stop at video duration: -shortest is unreliable when
    # -stream_loop inputs never EOF. Sample rate locked to 48k (aac default max).
    cmd += ["-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-t", f"{T:.3f}", out_path]
    return cmd


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--video", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--music-stem", default="", help="optional path for a music-only audition stem (m4a)")
    args = ap.parse_args()

    with open(args.manifest, encoding="utf-8") as fh:
        manifest = json.load(fh)

    cmd = build_ffmpeg_args(manifest, args.video, args.out)
    print("=== FFmpeg bake ===")
    print(" ".join(cmd[:8]) + " ...")
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print("STDERR:\n" + r.stderr[-4000:], file=sys.stderr)
        return r.returncode

    if args.music_stem:
        stem_cmd = build_ffmpeg_args(manifest, args.video, args.music_stem, music_only=True)
        print("\n=== Music-only stem ===")
        print(" ".join(stem_cmd[:8]) + " ...")
        rs = subprocess.run(stem_cmd, capture_output=True, text=True)
        if rs.returncode != 0:
            print("STEM STDERR:\n" + rs.stderr[-3000:], file=sys.stderr)
            return rs.returncode
        print(f"  written : {args.music_stem}")

    print("\n=== BAKED SOUNDTRACK ===")
    for sel in manifest["soundtrack"]["selections"]:
        sec = next((s for s in manifest["sections"] if s["sectionId"] == sel["sectionId"]), None)
        print(f"  {sel['sectionId']:14s} {sel['title']:24s} -> {SEED_TO_REAL.get(sel['trackId'], '???')}")
    for env in manifest["soundtrack"]["sections"]:
        if env["role"] == "emotional_insert" and env["assetId"] != "songbed_empty":
            host = next((s for s in manifest["sections"] if s["startSec"] <= env["startSec"] < s["endSec"]), None)
            host_track = next((sl["trackId"] for sl in manifest["soundtrack"]["selections"] if sl["sectionId"] == host["sectionId"]), None) if host else None
            use_alt = host_track == env["assetId"]
            real = SEED_TO_REAL_ALT.get(env["assetId"]) if use_alt else SEED_TO_REAL.get(env["assetId"], "???")
            print(f"  emotional_insert      {env['assetId']:24s} -> {real}  {'(alt asset)' if use_alt else ''}")
    for bed in manifest["soundtrack"].get("transitionBeds", []):
        print(f"  transition bed                                   at {bed['boundarySec']:5.1f}s ({bed['fromSectionId']} -> {bed['toSectionId']})  riser {bed.get('riserSec', 2.2)}s @ {bed.get('levelDb', -25)}dB")
    print(f"\n  video  : {args.video}")
    print(f"  output : {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
