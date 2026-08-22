# Soundtrack Governance — Run Report

**Sample:** `raw_original_video.mp4` · 60.10s · 23.98fps · audio:present
**Measured loudness:** -14.4 LUFS integrated / 0.3 dBTP true peak

**Palette — bed:** `inst_loop_09` · pad: `atmos_05` · overrideApplied: true
**Program:** 66s total (60.1s video + 6.0s tail) · fade-in 2s · fade-out 2s · target -14 LUFS / -1.5 dBTP

## Governance
- [x] **causal_linkage** — All sections cite a concrete video event; none orphaned or out-of-window.
- [x] **tail_bounded** — total=66.10s video=60.10s tail=6.00s (bounds 0.5-6s)
- [x] **fade_in_out** — fade-in ends at 2.00s; fade-out starts at 58.10s (2s before end).
- [x] **loudness_governance** — target -14.0 LUFS / ceiling -1.5 dBTP
- [x] **full_bed_coverage** — bed cells cover up to 60.00s; outro fade window begins at 58.10s
- [x] **track_variance_non_hardcoded** — beds across structural variants: inst_loop_01, inst_loop_03, inst_loop_04, inst_loop_09, inst_loop_10 (5 distinct)
- [x] **sfx_plan_duration_parametric** — SFX plan rebuilds per short length (30s→60 beats, 60.1s→120 beats, 90s→180 beats) with every cue in-window
- [x] **preferred_track_override** — requested "inst_loop_09"; engine resolved bed="inst_loop_09" pad="atmos_05" overrideApplied=true

## Flagged causal gaps in the wider pipeline
- none

_Generated 2026-08-21T15:35:01.484Z_