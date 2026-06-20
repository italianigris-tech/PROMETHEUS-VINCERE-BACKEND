# AGENT_SKILLS.md — Prometheus Core
# These skills are available to all sub-agents spawned by the Macro Boss

## SKILL: diagnose
When tests fail or build breaks:
1. Read the exact error message and stack trace
2. Identify the file and line number
3. Determine if it's a type error, logic error, or dependency error
4. Check SKILL.md for relevant constraints
5. Propose fix, apply it, re-run test/build
6. If fix fails, escalate to Macro Boss with full context

## SKILL: tdd
When implementing a new module:
1. Write the test file FIRST (red phase)
2. Write the minimum implementation to make tests pass (green phase)
3. Refactor while keeping tests green
4. Ensure coverage: happy path, error path, edge cases, determinism
5. Mock all external dependencies (FFmpeg, Remotion, fs, child_process)

## SKILL: improve_architecture
When code smells detected:
1. Check for violations of SKILL.md constraints
2. Look for duplicated logic → extract shared utility
3. Look for tight coupling → introduce interface/abstraction
4. Look for any in render path → eliminate or add @ts-ignore with justification
5. Ensure cross-package imports use workspace aliases

## SKILL: strategic_compact
When codebase grows:
1. Identify dead code (unused imports, commented blocks, old schemas)
2. Consolidate similar types (avoid parallel type hierarchies)
3. Ensure each file has single responsibility
4. Keep test files co-located with source files

## SKILL: systematic_debug
When end-to-end fails:
1. Isolate: test each component independently
2. Verify: schema → director → audio → visual → worker → script
3. Check: determinism (same seed = same output)
4. Check: variation (different uploadIndex = different output)
5. Use console.log or structured logging, never debugger in render path

## SKILL: dependency_resolve
When npm install or import fails:
1. Check package.json for missing dependency
2. Check if workspace alias is correct (@prometheus/*)
3. If cross-package import fails, add to exports/dependencies
4. Run npm install at root
5. Verify with tsc --noEmit

## SKILL: auto_execute_policy
- Code modifications: AUTO (no human review)
- Terminal commands: AUTO (no human review)
- Package installations: AUTO (no human review)
- File deletions: ASK (confirm before deleting)
- Git commits: ASK (stage only, do not auto-commit)
