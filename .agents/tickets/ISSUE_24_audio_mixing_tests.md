# ISSUE 24: Audio Mixing Tests

## Objective
Audio filtergraph, voice ducking, SFX ducking, missing-file, and FFmpeg failure paths are covered.

## Files You May Edit
- `backend/src/audio/mix-audio.test.ts`

## Files You Must NOT Edit
- `backend/src/audio/mix-audio.ts`

## Primary Approach
Use the existing `mix-audio` public interface and mocked `fs`/`spawn` dependencies to verify filtergraph behavior without editing audio logic.

## Fallback Approach
If FFmpeg behavior changes, keep tests on generated args and process error contract.

## Test Command
```bash
npm.cmd --prefix backend test -- src/audio/mix-audio.test.ts
```

## Success Criterion
Audio filtergraph, ducking, SFX missing-file, and FFmpeg failure paths covered.

## Current Status
READY_FOR_REVIEW: 5 tests pass.
