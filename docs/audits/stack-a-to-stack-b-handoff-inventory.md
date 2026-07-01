# Stack A To Stack B Handoff Field Inventory

Status: Active inventory for GitHub #36
Created: 2026-06-29
Architecture amendment: `specs/ARCHITECTURE_AMENDMENTS.md` AM-0001

This inventory maps rich `remotion-app/src/creative-orchestration` planner fields to the live backend Director, evidence, and `UnifiedRenderManifest` surfaces. It is intentionally additive: Stack B remains the render spine, and fields that cannot render yet must either become evidence or emit a governed fallback tag.

## Source And Target Modules

| Side | Current files/modules | Role |
|---|---|---|
| Stack A source | `remotion-app/src/creative-orchestration/judgment/types.ts` | Rich planner schemas: Treatment Genome v1, Planner Audit, archive cells, beam candidates, selected path, negative grammar violations |
| Stack A source | `remotion-app/src/creative-orchestration/judgment/planning/treatment-genome.ts` | Derives retrieval intent, GOD escalation intent, archive cells, novelty/consistency bias |
| Stack A source | `remotion-app/src/creative-orchestration/judgment/planning/qd-archive.ts` | Selects QD elites by archive cell |
| Stack A source | `remotion-app/src/creative-orchestration/judgment/planning/beam-search-engine.ts` | Ranks genomes, records pruned candidates, selected path, and score breakdowns |
| Stack B target | `packages/shared-types/src/unified-render-manifest.ts` | Renderable manifest contract consumed by Joseph render path |
| Stack B target | `backend/src/director/joseph-director.ts` | Current production candidate generation and hidden doctrine branch/observation signals |
| Stack B target | `backend/src/director/joseph-manifest-compiler.ts` | Deterministic compiler seam and audit references |
| Stack B target | `backend/src/director/joseph-sequence-objective.ts` | Backend-owned sequence objective and diversity-cell scoring |
| Stack B target | `backend/src/director/joseph-sequence-discipline.ts` | Current negative-grammar-like sequence discipline checks |
| Stack B target | `backend/src/ledger/evidence-preservation.ts` | Per-job candidate, selected, rejected, verdict, audit, review, and gallery persistence |

## Handoff Matrix

| Stack A field/object | Source meaning | Stack B target | Current partial satisfaction | Governed fallback and failure tag |
|---|---|---|---|---|
| `TreatmentGenomeV1.family` | Planner treatment family such as safe premium, expressive premium, luxury minimal, aggressive conversion | `creativeProfile.name`, `candidateScoreSummary.sequenceObjective.candidates[].doctrineBranchId`, future Manifest Compiler treatment reference | Partial: Stack B has Joseph profiles and doctrine branches, but not Stack A treatment-family identity | Persist in audit only; tag `compiler_treatment_family_unmapped` if a render decision depends on it |
| `TreatmentGenomeV1.finalTreatment` | Render intent such as caption-only, asset-supported, title-card, background-overlay, cinematic-transition, behind-speaker-depth | `timeline`, `textOverlays`, `josephPiP`, `josephBackground`, `cameraMoves`, `audio.sfx` | Partial: Stack B can express text, background, PiP, camera, SFX, and transitions, but not every Stack A treatment enum is a direct branch | Use nearest current primitive; tag `compiler_final_treatment_downgraded` with original treatment |
| `typographyMode`, `emphasisMode` | How text should be selected, emphasized, and staged | `josephTypography`, `textOverlays[].microAnimation`, `microAnimationAudit`, `timeline` text events | Partial: typography intelligence and micro-animation primitives exist in Stack B | Fallback to existing overlay animation and record `compiler_typography_mode_downgraded` |
| `motionMode` | Motion grammar requested by planner | `cameraMoves`, `textOverlays[].microAnimation`, `josephChoreography.timingPlan`, `microAnimationAudit` | Partial: camera moves, choreography, and micro-animation selections exist | Fallback to closest seeded motion primitive; tag `compiler_motion_mode_downgraded` |
| `matteUsage` | Whether behind-subject/depth treatment is required | `josephPiP`, future matte/RVM evidence, `videoTracks`, render proof bundle | Partial: PiP/depth plan exists; true behind-subject matte proof is not yet attached | Render without matte only if governed; tag `compiler_matte_required_unavailable` |
| `backgroundTextMode` | Whether support or hero background text should exist | `josephBackground.layeringRules`, `textOverlays`, `josephTypography.lines` | Partial: background primitives and typography lines exist; background text is not a first-class renderer branch yet | Suppress or convert to foreground support text; tag `compiler_background_text_downgraded` |
| `placementMode` | Spatial layout intent: center-stage, anchors, behind-subject, full-frame, callout | `textOverlays.position`, `josephPiP.typographyZones`, `josephBackground.layeringRules` | Partial: text positions and PiP zones exist | Clamp into safe zones; tag `compiler_placement_clamped` |
| `intensity` | Minimal/restrained/balanced/expressive edit force | `creativeProfile.cutDensity`, `textDensity`, `sfxDensity`, `cameraAggression`, `josephChoreography.segments[].intensity` | Strong partial: Stack B profiles and choreography already encode intensity | Clamp to closest profile value; tag `compiler_intensity_clamped` only when outside current profile authority |
| `allowedProposalTypes`, `blockedProposalTypes` | Which subsystems may contribute | Manifest Compiler audit and Judgment Layer floor, not renderer fields | Partial: prompt governance and quality floor exist, but proposal-type governance is not a manifest field | Preserve in audit; tag `compiler_proposal_type_blocked` when a required renderer lane is forbidden |
| `preferredProposalIds`, `preferredLibraries` | Preferred assets/libraries | `audio.musicReference`, font/materialized asset refs, future asset resolver evidence | Partial: music/font/asset resolver surfaces exist, but no generic preferred library map | Use existing asset resolver if exact asset is render-safe; tag `asset_preference_unresolved` |
| `reasoning` | Planner explanation text | `candidateScoreSummary`, `audit.json`, `review-artifact.json` | Yes for evidence, not render | Evidence-only; no render tag unless required field is missing |
| `doctrineBranchId` | Chosen bounded editorial doctrine branch | `candidateScoreSummary.sequenceObjective.candidates[].doctrineBranchId`, `selectedPath.doctrineBranchIds`, evidence audit | Strong partial: backend `_doctrineBranch` and sequence objective already carry branch IDs | If absent, fall back to `creativeProfile.name`; tag `compiler_doctrine_branch_missing` |
| `retrievalIntent = skip` | No retrieval needed | Manifest Compiler audit; no manifest change | Partial: Stack B can proceed without retrieval | Evidence-only; no failure if render-safe assets are already present |
| `retrievalIntent = reuse-existing` | Use existing library asset | Asset resolver refs, `josephBackground`, `josephPiP`, `typography.fontAssetUrl`, `audio.musicReference` | Partial: asset, music, and font references exist, but not one planner-native retrieval contract | Use available render-safe asset or fallback; tag `asset_reuse_unresolved` |
| `retrievalIntent = reuse-with-variation` | Reuse asset with controlled variation | Future GOD/asset-variation evidence, Pattern Memory, render proof | Not live in Stack B | Do not generate silently; tag `asset_variation_deferred` |
| `retrievalIntent = search-deeper` | Search beyond current library before render | Future retrieval trace and review/evidence artifacts | Not live in Stack B | Continue only with explicit fallback; tag `deep_retrieval_deferred` |
| `godEscalationIntent = forbidden` | GOD must not generate | Prompt governance and Manifest Compiler audit | Partial: prompt governance blocks infrastructure overrides, not GOD escalation yet | Evidence-only; tag `god_generation_forbidden` if a branch requests generation anyway |
| `godEscalationIntent = allowed-if-no-fit` | GOD may generate only after retrieval misses | Future GOD request/evidence surface | Not live in Stack B | Do not generate in current MVP; tag `god_escalation_deferred` |
| `godEscalationIntent = preferred-for-precision` | Planner prefers GOD for precise assets | Future GOD request/evidence surface | Not live in Stack B | Use library fallback or block for human review; tag `god_precision_required_unavailable` |
| `noveltyBias`, `consistencyBias` | Planner taste pressure for freshness vs consistency | `candidateScoreSummary.sequenceObjective`, Replay Ledger similarity, future Creator Taste Memory | Partial: Replay Ledger and sequence objective provide novelty pressure, but not these explicit bias scalars | Preserve in audit; tag `planner_bias_evidence_only` |
| `archiveCell.intensity` | QD archive intensity axis | `candidateScoreSummary.sequenceObjective.archiveEntries[].archiveCell.intensity` | Strong partial with compatible axis | Normalize enum; tag `archive_intensity_normalized` only if value changes |
| `archiveCell.visualDensity` | QD visual density axis (`quiet`, `balanced`, `loud`) | Backend `JosephArchiveCell.visualDensity` (`sparse`, `balanced`, `dense`) | Partial: same concept, different enum names | Map `quiet -> sparse`, `loud -> dense`; tag `archive_visual_density_normalized` |
| `archiveCell.motionEnergy` | QD motion energy axis | Backend `JosephArchiveCell.motionEnergy` | Strong partial | Evidence-only if not selected |
| `archiveCell.editorialRole` | QD role axis (`setup`, `explain`, `tension`, `payoff`) | Backend `JosephArchiveCell.editorialRole` (`setup`, `tension`, `payoff`) | Partial: `explain` has no backend enum | Map `explain -> setup` until backend expands; tag `archive_editorial_role_downgraded` |
| `ArchiveEntry.cell`, `ArchiveEntry.genome`, `ArchiveEntry.score` | QD elite candidate per behavior cell | `candidateScoreSummary.sequenceObjective.archiveEntries`, `audit.json` | Partial: backend stores live-candidate diversity cell entries per job | Preserve per job; tag `qd_archive_not_persistent` until #85 adds cross-job archive |
| `NegativeGrammarViolation.ruleId` | Named rule failure | `CandidateScore.floorFailures`, `sequenceDiscipline.violations[].ruleId`, `verdict.failureTags` | Partial: Stack B has quality floor failures and sequence discipline rule IDs | Convert to failure tag; blocking violations reject candidate with `negative_grammar_blocked` |
| `NegativeGrammarViolation.message` | Human explanation | `candidateScoreSummary.sequenceDiscipline[].violationRuleIds`, future review note | Partial: backend currently preserves rule IDs, not every message | Preserve message in audit when available; tag `negative_grammar_message_dropped` if not stored |
| `NegativeGrammarViolation.severity`, `blocking`, `penalty` | Governance strength | Judgment Layer pass/fail, score penalty, verdict failure tags | Partial: Stack B has penalties and nonblocking sequence discipline | Blocking maps to rejection; nonblocking maps to penalty. Tags: `negative_grammar_blocked`, `negative_grammar_penalized` |
| `NegativeGrammarViolation.candidateId`, `affectedRegions` | Candidate and spatial blame | Evidence audit, future frame proof/overlap diagnostics | Partial: candidate IDs exist; affected regions are not first-class render proof yet | Preserve in audit; tag `negative_grammar_region_evidence_only` |
| `PlannerBeamCandidate.genomeId` | Candidate identity in beam search | Candidate manifest `jobId`, `candidateScoreSummary.sequenceObjective.candidates[].candidateId` | Partial: backend candidates have deterministic job IDs, not Stack A genome IDs | Store original genome ID in evidence before changing job ID; tag `beam_genome_id_remapped` |
| `PlannerBeamCandidate.doctrineBranchId` | Branch identity used for ranking | `sequenceObjective.candidates[].doctrineBranchId`, `selectedPath.doctrineBranchIds` | Strong partial | Same fallback as `doctrineBranchId` |
| `PlannerBeamCandidate.archiveCellKey` | QD behavior cell key | `sequenceObjective.candidates[].archiveCell.key` | Strong partial after enum normalization | Tag only if normalized |
| `PlannerBeamCandidate.scoreBreakdown` | Sequence objective scores | `sequenceObjective.candidates[].scoreBreakdown` | Strong partial with backend score dimensions | Preserve unsupported score dimensions in audit; tag `beam_score_dimension_dropped` |
| `PlannerBeamCandidate.pruned` | Candidate was removed by beam budget | `rejected` evidence plus future `candidateScoreSummary` pruned flag | Partial: rejected candidates are preserved, but pruned reason is not explicit | Store in audit; tag `beam_candidate_pruned` |
| `PlannerBeamCandidate.reasons` | Ranking explanation | `candidateScoreSummary.sequenceObjective.candidates[].reasons`, `audit.json` | Strong partial | Evidence-only |
| `PlannerSelectedPath.genomeIds` | Winning path genome IDs | `selected` manifest, `sequenceObjective.selectedPath.candidateIds`, `audit.json` | Partial: backend selected path uses candidate IDs, not original genome IDs | Preserve remap in audit; tag `selected_path_genome_id_remapped` |
| `PlannerSelectedPath.doctrineBranchIds` | Winning doctrine path | `sequenceObjective.selectedPath.doctrineBranchIds` | Strong partial | Same fallback as `doctrineBranchId` |
| `PlannerSelectedPath.scoreBreakdown` | Winning path score | `sequenceObjective.selectedPath.finalScore`, candidate score breakdown | Partial: backend selected path stores final score, detailed breakdown lives on candidate | Evidence-only; tag `selected_path_breakdown_split` |
| `PlannerSelectedPath.lookaheadMomentsEvaluated` | Adaptive planning horizon depth | Candidate Score Summary audit extension, not renderer | Not live in Stack B | Preserve in audit only; tag `adaptive_horizon_downgraded` |
| `PlannerAudit.observationSnapshot` | Facts planner cannot rewrite | Evidence audit, future Observation Snapshot artifact | Partial: backend has `JosephObservationSnapshot` internally | Preserve as audit artifact; tag `observation_snapshot_evidence_only` |
| `PlannerAudit.planningSnapshot` | Search space, doctrine branches, budgets | Evidence audit, Manifest Compiler audit references | Partial: backend has profile/doctrine branch generation but no rich planning snapshot artifact | Preserve as audit artifact; tag `planning_snapshot_evidence_only` |
| `PlannerAudit.shortlist` | Candidate genomes handed to compiler | `candidates.json`, `candidateScoreSummary.candidateScores` | Partial: backend preserves candidates, not Stack A genome fields | Preserve full shortlist in audit; tag `shortlist_genome_fields_evidence_only` |
| `PlannerAudit.fallbackUsed` | Planner could not produce full shortlist | `verdict.failureTags`, `review-artifact.json`, Manifest Compiler audit | Partial: failure tags exist | Tag `planner_fallback_used` |
| `PlannerAudit.trace` | Human-readable execution trace | `audit.json`, `review-artifact.json` | Partial: evidence audit stores candidate score summary; rich trace not yet current | Preserve trace when present; tag `planner_trace_evidence_only` |

## Compiler Rules For #37

1. Do not let renderer fallback logic silently invent missing planner intent.
2. A field either maps to `UnifiedRenderManifest`, maps to per-job evidence, or emits one of the fallback tags above.
3. Stack A enum differences must be normalized in the compiler audit, not hidden in renderer code.
4. Original Stack A IDs must be preserved when candidates are canonicalized into Stack B job IDs.
5. GOD and deeper retrieval intents are evidence-only until a live governed GOD/retrieval path exists.
6. QD archive entries are per-job evidence until #85 creates durable cross-job archive behavior.

## Fields Already Partially Covered

| Capability | Current partial module |
|---|---|
| Doctrine branch identity | `backend/src/director/joseph-director.ts`, `backend/src/director/joseph-sequence-objective.ts` |
| QD archive cell scoring | `backend/src/director/joseph-sequence-objective.ts` |
| Negative grammar pressure | `backend/src/director/joseph-sequence-discipline.ts`, `backend/src/director/judgment-layer.ts` |
| Typography and emphasis | `packages/shared-types/src/unified-render-manifest.ts`, `backend/src/director/joseph-typography-intelligence.ts`, `backend/src/director/micro-animation-primitives.ts` |
| PiP/depth planning | `packages/shared-types/src/unified-render-manifest.ts`, `backend/src/director/joseph-pip-composition.ts` |
| Background support | `packages/shared-types/src/unified-render-manifest.ts`, `backend/src/director/joseph-background-primitives.ts` |
| Choreography/sequence timing | `packages/shared-types/src/unified-render-manifest.ts`, `backend/src/director/joseph-audio-visual-choreography.ts` |
| Evidence persistence | `backend/src/ledger/evidence-preservation.ts`, `backend/src/ledger/joseph-oversight-review.ts` |
| Compiler audit seam | `backend/src/director/joseph-manifest-compiler.ts` |

## Open Risks

- Stack A `explain` archive role has no exact Stack B QD role yet.
- Retrieval and GOD intents are not render authority in the current MVP.
- Beam pruning reasons are not yet distinct from ordinary rejected candidates.
- Observation Snapshot and Planning Snapshot are not first-class backend evidence artifacts yet.
- Behind-subject matte intent still needs render proof and RVM/matte evidence before it can be trusted as a production field.
