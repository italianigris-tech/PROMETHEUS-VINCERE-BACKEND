# ISSUE 31: Quality-Diversity Archive Producer Pipeline

## Objective
Turn render verdicts and preserved candidate evidence into Quality-Diversity Archive entries without mixing archive logic with Variation Key or Replay Ledger responsibilities.

## Files You May Edit
- `backend/src/creative-variation/index.ts`
- `backend/src/creative-variation/archive-producer.ts`
- `backend/src/creative-variation/archive-producer.test.ts`

## Files You Must NOT Edit
- `backend/src/director/variation-key.ts`
- `backend/src/ledger/replay-ledger.ts`
- `remotion-app/src/compositions/JosephEdit.tsx`

## Primary Approach
Add an archive producer that converts selected and rejected candidate evidence into `VariationGenome` records, then updates the existing MAP-Elites archive across intensity, visual density, motion energy, and editorial novelty.

## Fallback Approach (if primary fails after 2 hours)
Ship a pure converter from Judgment verdicts to `VariationGenome` records first, and defer archive persistence/update wiring to a follow-up ticket.

## Test Command
```bash
npm.cmd --prefix backend test -- src/creative-variation/archive-producer.test.ts
```

## Success Criterion
The archive producer consumes preserved render verdicts, emits valid `VariationGenome` records, updates the Quality-Diversity Archive deterministically, and keeps variation-key logic outside the archive.

## Gate
Gate 7

## Dependencies
- T11 Judgment Layer
- T12 Replay Ledger
- T19 Evidence Preservation

## Notes
- Update `PROMETHEUS_BUILD.md` to `IN_PROGRESS` before starting.
- Treat Quality-Diversity Archive fitness as one signal for the Judgment Layer, not as the final authority.
- Preserve the v8.1 Determinism Contract.
