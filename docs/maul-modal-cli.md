# MAUL Modal CLI

Use one command for launch renders:

```powershell
python scripts/run-maul-modal.py `
  .codex-temp\maul-modal-female-coach\modal-envelope.json `
  --output .codex-temp\maul-modal-female-coach\maul-final.mp4
```

Generate launch manifest first. `--full-scale` is mandatory for Modal output;
without it, runner intentionally creates typography-only proof policy.

```powershell
npm --prefix backend run maul:animation-proof -- `
  --media "C:\path\to\source.mp4" `
  --output .codex-temp\maul-launch `
  --plan-only `
  --full-scale

npx tsx scripts/prepare-maul-modal-manifest.ts `
  .codex-temp\maul-launch\render-manifest.json `
  .codex-temp\maul-launch\modal-envelope.json
```

Runner contract:

- validates the manifest before creating a Modal call;
- requires V3, source/camera/motion treatment layers enabled, every spoken
  chunk covered, and compiled text animation programs;
- reports whether an optional visual asset track was compiled;
- emits one JSONL state per transition: preflight, dispatch, running,
  download, complete, or failed;
- polls at a fixed cadence with a hard 45-minute timeout;
- downloads `media/<outputFile>` from `prometheus-render-artifacts`;
- verifies MP4 video/audio streams and expected 1080x1920 geometry.

Planning Bundle requests default to `typographyCoverage: "full"`. Use
`typographyCoverage: "selective"` only for an intentional proof/debug render.

Old command remains a compatibility alias:

```powershell
python scripts/run-deployed-maul-benchmark.py envelope.json --output maul-final.mp4
```

It now uses the same full-scale gate. It is not a benchmark and cannot dispatch
the old thin manifest unless `--allow-non-full-scale` is passed to the primary
runner for an explicit proof/debug run.

If preflight fails, stop. Fix the planner/manifest first. Do not rerun, poll,
or manually inspect the repository. A failed preflight creates no Modal call.
