---
name: systematic-debugging
description: >-
  Enforces a rigid, 4-phase root-cause debugging methodology. Use whenever diagnosing bugs,
  unexpected runtime behaviors, broken UI interactions, API failures, or regressions to prevent
  guessing and superficial patches.
---

# Systematic Debugging Protocol

When encountering any bug, failure, or unexpected behavior, adhere strictly to this 4-phase diagnostic workflow. Do not apply guesswork or unverified fixes.

---

## Phase 1: Problem Definition & Symptom Characterization
1. **Identify the exact symptom**: What did the user observe? What was expected vs. what actually occurred?
2. **Isolate the failure trigger**: What user action, input, or event initiates the problem?
3. **Map the Critical Path**: Identify every system boundary and module involved from origin to execution:
   - UI Element / DOM Trigger -> Event Handler -> Network Payload -> Backend API Route -> Storage/State Mutation -> Response Serialization -> Client State Update & DOM Re-render.

---

## Phase 2: Root Cause Tracing & Hypothesis Formulation
1. **Trace Each Node on the Path**:
   - Inspect the exact line of code handling the event.
   - Check if event listeners are attached, if ID selectors match, if DOM elements exist at execution time.
   - Verify request payload structure, HTTP method, and route path.
   - Verify server-side handling (permissions, synchronous vs asynchronous file mutations, exception handling).
   - Check response status code, content-type, and client response deserialization.
   - Check post-operation UI state synchronization (are cached DOM nodes removed, or is stale state re-rendered?).
2. **Formulate Falsifiable Hypotheses**:
   - Identify the exact point of divergence between expected and actual execution.

---

## Phase 3: Minimal, Deterministic Remediation
1. **Apply targeted fix**:
   - Address the root cause directly without superficial workarounds.
   - Ensure clean error handling, status codes, and deterministic state updates.
2. **Verify Client-Server Contract**:
   - Ensure client and server data schemas and lifecycle assumptions match 100%.

---

## Phase 4: Verification & Regression Proof
1. **Test the exact failing scenario**:
   - Trigger the action programmatically and verify end-to-end success.
2. **Verify adjacent features**:
   - Confirm related features continue to work without regression.
3. **Document proof**:
   - Provide concrete proof (logs, curl responses, file counts) confirming complete resolution.
