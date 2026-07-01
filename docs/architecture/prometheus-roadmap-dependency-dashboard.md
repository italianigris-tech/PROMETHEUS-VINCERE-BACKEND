# Prometheus Roadmap Dependency Dashboard

Status: Active execution dashboard
Created: 2026-06-29
Source roadmap: `ROADMAP_TOWARD_BEATING_SEEDANCE.md`
Issue range: GitHub #30-#101

This dashboard turns the Seedance roadmap dependency map into a project-control surface. It is intentionally issue-numbered with the imported GitHub tracker numbers, not the logical issue numbers from `PROMETHEUS_ISSUES_v1.md`.

## Keystone

| Program | GitHub issues | Target quarter | Status | Blocking issues | Why it matters |
|---|---:|---|---|---|---|
| Program 16: Stack Consolidation And The Manifest Compiler | #35-#43 | Q3-Q4 2026 | In progress | #35, #36, #37, #38, #39, #40, #41, #42 | This is the planner-to-renderer seam. Until #43 proves rich planner decisions reach `JosephEdit` through `UnifiedRenderManifest`, downstream intelligence is decorative. |

## Epic Dependency Board

| Epic | GitHub issues | Target quarter | Status | Primary blockers | Unblocks |
|---|---:|---|---|---|---|
| Roadmap Governance And Import | #30-#34 | Q3 2026 | In progress | None; #30 and #31 closed | All imported roadmap work |
| Stack Consolidation And Manifest Compiler | #35-#43 | Q3-Q4 2026 | Ready after #31 | #35 -> #36 -> #37 -> #38/#39 -> #43 | Studio depth, planning core, visual systems, learning |
| Fast Feedback And Evidence Studio | #44-#49 | Q4 2026 | Blocked by seam proof | #43, then #44 -> #45 -> #46/#47/#48 -> #49 | Pairwise preference data, diagnostics, regression gallery |
| Golden Corpus And IRL Phase Gates | #50-#56 | Q4 2026 | Partially parallel | #50 starts after #30/#32; #56 requires #55 | Learned reward eligibility |
| Feature Audit And Feature Space Discipline | #57-#61 | Q4 2026-Q1 2027 | Blocked by Studio/corpus starts | #49/#50 -> #57 -> #58/#59 -> #60 -> #61 | Trajectory extraction, IRL, vehicle adapters |
| Graph Planner And Multi-Modal Sync Matrix | #62-#67 | Q1 2027 | Blocked by seam and audio features | #43, #59, #62, #63 | Sequence objective, diagnostics, visual pacing |
| Visual Fidelity Systems | #68-#76 | Q4 2026-Q2 2027 | Blocked by compiler contracts | #38/#39/#43/#63/#64 | Premium typography, PiP, camera, pacing, macro-rigs |
| Negative Evaluator Judgment Replay And Evidence | #77-#81 | Q1 2027 | Blocked by diagnostics and grammar | #67/#69 -> #77 -> #78 -> #79/#80/#81 | Learned reward governance, deterministic evidence |
| Learned Reward Exploration And Creator Taste | #82-#89 | Q2-Q3 2027 | Blocked by IRL gates | #56, #60, #61, #78, #81 | Taste moat, QD exploration, creator memory |
| Style Architecture And Brand Ingestion | #90-#93 | Q3-Q4 2027 | Blocked by hybrid reward | #43, #84, #89 -> #90 | Multi-style and brand onboarding |
| Multi-Vehicle And Platform Surface | #94-#97 | Q4 2027-Q1 2028 | Blocked by planner and style memory | #62/#64 -> #94; #87/#88 -> #97 | 1B-person breadth and analytics feedback |
| Dry-Run Graduation And Render Infrastructure | #98-#101 | Q2 2027 | Partially parallel after audio/determinism gates | #59 -> #98/#99; #81 -> #100 -> #101 | Live audio analysis, render cost, scale hardening |

## Corrected Execution Order

| Phase | Roadmap intent | Status | Must finish first | Main issue path |
|---|---|---|---|---|
| Phase A: Premium MVP, single vehicle | Build the seam, matte, typography, top primitives, Studio depth | In progress | #30, #31, #32, then #43 | #35-#43, #44-#49, #68, #70, #71, #72 |
| Phase B: The moat | Golden corpus, feature audit, MaxEnt IRL, pairwise reward, QD exploration | Blocked by Phase A proof and gates | #49, #56, #61, #78, #81 | #50-#61, #82-#89 |
| Phase C: Breadth | Second style, prompt style routing, brand ingestion, first new vehicle, analytics feedback | Blocked by moat path | #84, #87, #88, #90 | #90-#97 |
| Phase D: Premium polish | 6DoF, inverse rendering, high-variance premium research | Deferred | Phase B moat and selected Phase C breadth | Not imported as immediate AFK issues; create later after evidence |

## Immediate Next Queue

| Order | Issue | Why next |
|---:|---|---|
| 1 | #32 Publish Program Dependency Dashboard | Current issue; closes the project-control surface. |
| 2 | #33 Establish Determinism Guardian Baseline Audit | Parallel governance guardrail before compiler/render work deepens. |
| 3 | #34 Audit Evidence And Replay Oversight Coverage | Parallel governance guardrail before compiler artifacts and review data expand. |
| 4 | #35 Disambiguate Planner Audit Schemas Across Stacks | First Program 16 implementation blocker. |
| 5 | #36 Inventory Stack A To Stack B Handoff Fields | Defines what the Manifest Compiler must carry or explicitly downgrade. |

## Work That Must Not Jump Ahead

| Do not start | Until | Reason |
|---|---|---|
| Deep Studio diagnostics (#46, #67) | #43 seam proof | Studio cannot show planner decisions until the renderer reads compiled planner intent. |
| MaxEnt IRL training (#82) | #56 Golden 100 gate, #60 feature validation, #61 feature versioning, #78 Judgment integration | IRL on weak data or ungoverned output produces false confidence. |
| Hybrid reward (#84) | #82 and #83 | Pairwise and absolute learning are separate data shapes. |
| Style routing (#92) | #91 second style | There is nothing meaningful to infer before at least two trained styles exist. |
| Multi-vehicle production (#95/#96) | #94 router and amendment gates | Vehicles are different scene models, not profile configs. |
| GPU-first production render (#100/#101) | #81 determinism proof and AM-0004 approval | Render economics cannot override deterministic authority. |

## Amendment-Gated Work

| Issue | Registry entry | Gate |
|---|---|---|
| #35, #43 | AM-0001 | Additive Manifest Compiler seam only; no destructive stack removal before parity. |
| #78 | AM-0005 | Learned/evaluator signals remain under Judgment Layer authority. |
| #94 | AM-0002, AM-0006 | No non-vertical authority or vehicle launch without approval. |
| #100 | AM-0003, AM-0004 | No queue/runtime or GPU-default authority change without approval. |

## Status Legend

| Status | Meaning |
|---|---|
| Closed | Acceptance criteria are completed and the GitHub issue is closed. |
| In progress | Current active work or partially completed governance foundation. |
| Ready | Can start once listed blockers are closed. |
| Blocked | Must not start until listed blockers are closed or human-gate approval is recorded. |
| Deferred | Intentionally out of scope for the current phase. |
