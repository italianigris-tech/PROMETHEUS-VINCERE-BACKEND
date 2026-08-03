# MAUL Worker Orchestration Design

## Goal

Make one leased `render_short` job execute the governed MAUL path from an existing project through render and Quality Truth evidence.

## Scope

Merge `feature/maul-premium-short-form` into `main`. Add a worker executor that leases durable control-plane jobs, dispatches `render_short`, records the resulting artifact identifiers and Quality Truth result, and reports failure through existing retry policy.

## Flow

`lease -> timeline -> treatment catalog -> candidate -> planning bundle -> render -> Quality Truth -> complete`

The executor calls existing `MaulProjectService` methods. Planner and renderer authority remain unchanged. A failed stage calls `control.fail`; successful work calls `control.complete`. The result contains only stable artifact identifiers and Quality Truth status.

## Boundaries

- `render_short` is the only new end-to-end operation.
- Other existing operation names remain unsupported by this executor until separately specified.
- The worker does not bypass artifact lineage, review gates, quota checks, or Quality Truth.
- No persistence migration; existing durable control-plane storage remains the job source of truth.

## Verification

Tests prove a leased job completes the full artifact chain and that a dispatch failure is returned to the durable retry path. Existing MAUL render-path tests must remain green.
