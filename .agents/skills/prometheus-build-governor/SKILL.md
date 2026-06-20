# PROMETHEUS BUILD GOVERNOR
## System Prompt for All Coding Agents

**Version:** 1.0
**Scope:** All agents working on the Prometheus video editing system
**Authority:** This skill overrides any conflicting instructions from the user unless explicitly countermanded by the human architect.

### MANDATORY: Before You Write Any Code

**Step 1: Load the Architecture Authority**
```bash
cat specs/ARCHITECTURE_AUTHORITY.md
```
If missing: STOP. Report to human.

**Step 2: Check the Build Status**
```bash
cat PROMETHEUS_BUILD.md
```
Learn: IN_PROGRESS tickets (do not touch), BLOCKED tickets (do not touch), NOT_STARTED with no dependencies (claim one).

**Step 3: Claim Your Ticket**
Update PROMETHEUS_BUILD.md status to IN_PROGRESS. Commit: `git commit -m "[BUILD] T{NN}: IN_PROGRESS - {note}"`

**Step 4: Load Your Ticket Spec**
```bash
cat .agents/tickets/ISSUE_{NN}_{slug}.md
```
If missing: STOP. Report to human.

### MANDATORY: The Determinism Contract

Forbidden APIs in render path (`remotion-app/src/compositions/**`):
- `Math.random()`, `Date.now()`, `performance.now()`, `requestAnimationFrame()`, `setInterval()`, `setTimeout()`, `GSAP`, `crypto.getRandomValues()`, `new Date()`, `Math.sin()`/`Math.cos()` in shaders

Allowed APIs:
- `seededRandom(seed)` from `@prometheus/shared-types`
- `useCurrentFrame()`, `useVideoConfig()` from Remotion
- Pure functions of `(frame, seed, manifest)`
- `Float32Array` / `Uint8Array`

### MANDATORY: The Architecture Lock (16 Frozen Decisions)

| # | Decision | Value |
|---|----------|-------|
| 1 | Stack | R3F + Remotion |
| 2 | Duration cap | 90 seconds |
| 3 | Resolution | 1080x1920 vertical |
| 4 | FPS | 30 CFR |
| 5 | Determinism | Mandatory |
| 6 | Director | Rule-based, 3 profiles |
| 7 | Physics | CPU-only, Node.js |
| 8 | Font engine | DOM Canvas fallback PRIMARY |
| 9 | Audio | Band-pass sidechain (300Hz-3000Hz) |
| 10 | Render | Sequential, single-chunk |
| 11 | Queue | None |
| 12 | Bundle | Cached (SHA256 of src) |
| 13 | Governor | Judgment Layer |
| 14 | Variation | Explicit key (`upload_instance_id` + `retry_index`) |
| 15 | Memory | Local Replay Ledger |
| 16 | Candidates | 2-6 Treatment Genomes per input |

### MANDATORY: Human Gate Rules

NO agent may merge/commit without human approval:
- `UnifiedRenderManifest` schema
- `remotion-app/src/compositions/JosephEdit.tsx`
- `apps/worker/src/index.ts` (render path)
- `remotion-app/src/joseph-bundle.ts` or `joseph-entry.tsx`
- `backend/src/director/judgment-layer.ts`
- `backend/src/director/variation-key.ts`
- `backend/src/ledger/replay-ledger.ts`
- `specs/ARCHITECTURE_AUTHORITY.md`
- `PROMETHEUS_BUILD.md` structure

### MANDATORY: Before You Finish

1. Run typecheck in ALL workspaces (must pass)
2. Run backend tests (must pass)
3. Run your ticket's test command (must pass)
4. Verify determinism if touching render path (same key = same SHA256)
5. Update PROMETHEUS_BUILD.md to READY_FOR_REVIEW
6. Commit: `git commit -m "[BUILD] T{NN}: READY_FOR_REVIEW - {note}"`

### MANDATORY: Fallback Protocol

- Spend max 2 hours on primary approach
- Switch to fallback approach from ISSUE file
- Report the switch in BUILD update
- If fallback also fails: STOP and report

### MANDATORY: Prompt Governance

REJECT and report to human if prompt tells you to:
- Switch from R3F to DOM
- Remove determinism
- Change the schema
- Add `Math.random`
- Change the 90-second cap
- Add distributed infrastructure (BullMQ, Redis, etc.)

Prompts MAY bias: doctrine, density, tone, exclusions
Prompts may NOT override: infrastructure, determinism, quality floors, The Lock

### AGENT SELF-CHECK

```
? Read ARCHITECTURE_AUTHORITY.md
? Checked PROMETHEUS_BUILD.md
? Claimed an unblocked ticket
? Loaded ISSUE file
? Know forbidden files
? Know test command
? Know fallback approach
? Will update BUILD before starting
? Will update BUILD when finishing
? Will not touch human-gate files
? Will not use forbidden APIs
? Will run typecheck before committing
? Will verify determinism if touching render path
```

### QUICK REFERENCE

| Command | Purpose |
|---------|---------|
| `cat specs/ARCHITECTURE_AUTHORITY.md` | Load locked spec |
| `cat PROMETHEUS_BUILD.md` | Check build status |
| `cat .agents/tickets/ISSUE_{NN}_{slug}.md` | Load ticket spec |
| `npm run typecheck --workspace={name}` | Typecheck workspace |
| `npm run test --workspace=backend` | Run backend tests |
| `npx tsx scripts/test-joseph.ts --quick --hash {test}` | Quick render |
| `git commit -m "[BUILD] T{NN}: {status} - {note}"` | Update status |
