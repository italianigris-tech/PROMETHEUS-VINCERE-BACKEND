# Prometheus Architecture Amendment Registry

Status: Active registry
Created: 2026-06-29
Authority: `specs/ARCHITECTURE_AUTHORITY.md` remains the locked ground truth.

This registry records roadmap items that extend, pressure, or conflict with the locked v8.1 authority. It does not amend v8.1 by itself. An item becomes current authority only when a human explicitly approves it and updates the locked authority document or records an approval here with owner, date, scope, and rollback rule.

## Use This Registry When

- An issue touches a human-gate file listed in `specs/ARCHITECTURE_AUTHORITY.md`.
- An issue changes stack, resolution, FPS, duration cap, render path, queue/runtime topology, Director authority, Judgment Layer authority, Variation Key behavior, Replay Ledger semantics, or render-path determinism.
- A roadmap item adds future architecture that is valid later but not valid for the current MVP lock.
- An implementation could be either additive seam work or a destructive rewrite of working v8.1/v8.2 behavior.

## Required Issue Reference

Any issue that changes locked files or architecture rules must include this line in its body or first implementation comment:

```markdown
Architecture amendment registry: `specs/ARCHITECTURE_AMENDMENTS.md`
```

If the issue depends on a specific amendment entry, include:

```markdown
Amendment entry: `AM-0000`
```

## Amendment Classes

| Class | Meaning | Implementation Rule |
|---|---|---|
| Additive seam | Extends the architecture behind an adapter, compiler, evidence artifact, or optional field without changing current authority. | Allowed when tests prove existing behavior is preserved. |
| Human-gate proposal | Describes a future authority change that conflicts with the current lock. | Do not implement as current authority until approved. |
| Approved amendment | Human has approved a scoped authority change. | Implement only within approved scope and rollback rule. |
| Rejected amendment | Human has rejected the change. | Do not reopen without new evidence. |
| Superseded amendment | Later registry entry or authority update replaces this entry. | Link to the successor entry. |

## Current Entries

### AM-0001: Manifest Compiler And Planner-Renderer Seam

**Class:** Additive seam
**Status:** Proposed for implementation
**Related issues:** #35, #36, #37, #38, #39, #40, #41, #42, #43

**Pressure on v8.1:**
The roadmap requires rich planner artifacts to reach `UnifiedRenderManifest` and `JosephEdit`, while v8.1 already has a working Director, Judgment Layer, Replay Ledger, Evidence Preservation, and render body path.

**Allowed now:**
- Add a Manifest Compiler as a deterministic adapter.
- Preserve existing `UnifiedRenderManifest` behavior.
- Persist compiler artifacts and Planner Audit pointers as evidence.
- Add render contract tests proving manifest fields produce observable behavior or explicit fallbacks.

**Not allowed without approval:**
- Delete working Director/Judgment/Replay/Evidence paths before compiler parity is proven.
- Let renderer fallback logic silently replace compiler behavior.
- Treat schema fields as authority without Judgment Layer approval.

**Approval needed for:**
Destructive removal of Stack A or Stack B modules.

### AM-0002: Multi-Orientation And Non-Vertical Output

**Class:** Human-gate proposal
**Status:** Deferred
**Related issues:** #31, #94, #95, #96

**Pressure on v8.1:**
The locked resolution is `1080x1920 vertical`. Multi-vehicle work may eventually need landscape, square, or vehicle-specific formats.

**Allowed now:**
- Document vehicle-specific output needs.
- Keep all production Joseph output vertical.
- Add detection or planning metadata that does not change rendered output dimensions.

**Not allowed without approval:**
- Make landscape or square output equal authority with vertical.
- Change default output dimensions.
- Add tests that expect non-vertical production output as current authority.

**Approval needed for:**
Any source change that alters production output orientation, dimensions, or v8.1 vertical contract.

### AM-0003: Queue Durability And Distributed Workers

**Class:** Human-gate proposal
**Status:** Deferred for MVP, expected for production scale
**Related issues:** #31, #100, #101

**Pressure on v8.1:**
The locked queue decision is `None`: no BullMQ, Redis, monitor process, or distributed worker in MVP. v8.2 notes that the in-process queue is volatile and production durability will eventually require a durable queue.

**Allowed now:**
- Document crash-recovery gaps.
- Add telemetry around in-process queue behavior.
- Build adapters that can later accept a durable queue without changing current runtime.

**Not allowed without approval:**
- Introduce Redis, BullMQ, a monitor process, or multi-worker leasing as MVP authority.
- Make local development require external queue services.

**Approval needed for:**
Any runtime dependency on Redis/BullMQ or equivalent durable queue infrastructure.

### AM-0004: GPU-First Render Infrastructure With Swangle Fallback

**Class:** Human-gate proposal
**Status:** Research and proof allowed
**Related issues:** #100, #101

**Pressure on v8.1:**
v8.1 locks sequential, single-chunk rendering and deterministic output. The roadmap proposes Linux swangle parity and GPU-first rendering with swangle fallback for unit economics.

**Allowed now:**
- Run isolated render infrastructure proofs.
- Add telemetry fields such as `render_path`.
- Prove Linux swangle parity and GPU fallback behavior without changing the default production path.

**Not allowed without approval:**
- Make GPU rendering the only production path.
- Remove swangle fallback.
- Change render determinism tolerances without explicit evidence and approval.
- Add parallel chunking to MVP render authority.

**Approval needed for:**
Switching the default production render path, adding GPU-only requirements, or changing chunking strategy.

### AM-0005: Learned Reward, IRL, And Preference Models

**Class:** Human-gate proposal
**Status:** Blocked by Golden 100 and Judgment Layer gates
**Related issues:** #50, #56, #78, #82, #83, #84, #85, #89, #90

**Pressure on v8.1:**
v8.1 locks the Director as rule-based with no IRL or multi-agent policy in Phase 1. The roadmap adds MaxEnt IRL, pairwise preference reward, QD exploration, and style-conditioned reward.

**Allowed now:**
- Build data surfaces, review ledgers, corpus registries, feature audits, and hard gates.
- Train or evaluate reward models only after the gated issues are satisfied.
- Use learned scores as ranking signals under the Judgment Layer.

**Not allowed without approval:**
- Let learned reward replace the hand-coded Judgment Layer floor.
- Let IRL or preference models directly author timings, render transforms, camera paths, shader code, or final edit authority.
- Run MaxEnt IRL before the Golden 100 and feature-validation gates are satisfied.

**Approval needed for:**
Any production path where learned reward changes final selection without deterministic replay, evidence, and Judgment Layer veto.

### AM-0006: Multi-Vehicle Scene-Type Routing

**Class:** Additive seam with future human-gate expansions
**Status:** Proposed for post-talking-head breadth
**Related issues:** #94, #95, #96

**Pressure on v8.1:**
The current Joseph path is talking-head and vertical. The roadmap expands to property, drone, product, and document-exhibit vehicles.

**Allowed now:**
- Add scene-type detection metadata.
- Define per-vehicle scene models and extraction adapters.
- Keep non-talking-head support behind explicit router decisions.

**Not allowed without approval:**
- Force all vehicles through talking-head manifest assumptions.
- Transfer talking-head reward weights across vehicles as current authority.
- Change production output orientation without AM-0002 approval.

**Approval needed for:**
First production non-talking-head vehicle launch and any vehicle-specific authority that conflicts with v8.1.

## Required Cross-References For Imported Roadmap Issues

The following GitHub issues currently change or gate architecture authority and must reference this registry before implementation:

| Issue | Required entry |
|---|---|
| #35 Disambiguate Planner Audit Schemas Across Stacks | AM-0001 |
| #43 Prove End-To-End Seam Through Orchestrator Worker And JosephEdit | AM-0001 |
| #78 Integrate Negative Evaluator Into Judgment Layer | AM-0005 |
| #94 Build Multi-Vehicle Scene-Type Detection Router | AM-0002, AM-0006 |
| #100 Prove Linux Swangle Parity And GPU-First Fallback | AM-0003, AM-0004 |

## Approval Record Template

```markdown
### AM-0000 Decision: <short title>

**Decision:** Approved | Rejected | Superseded
**Owner:** <human owner>
**Date:** YYYY-MM-DD
**Scope:** <exact files, runtime paths, or issue range>
**Rationale:** <why the current authority changes or does not change>
**Rollback Rule:** <how to return to locked behavior>
```
