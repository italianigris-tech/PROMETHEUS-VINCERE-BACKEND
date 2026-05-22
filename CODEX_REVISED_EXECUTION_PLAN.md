# CODEX REVISED EXECUTION PLAN
## Based on Codebase Audit (Actual State vs Blueprint)

**Date:** May 15, 2026  
**Status:** Blueprint overestimated scope. Actual work is **tightening**, not rebuilding.  
**Scope Reduction:** 68 hours → ~12-16 focused hours

---

## EXECUTIVE SUMMARY

The original blueprint assumed major gaps. Codex's audit reveals:

| Phase | Blueprint Assumed | Actual State | Required Work |
|-------|------------------|--------------|----------------|
| **A (Motion)** | Complete rebuild needed | GSAP already active, timeline emitted, preset tagged | Diagnostics truthfulness only |
| **C (Typography)** | Major refactor needed | Font resolution works, but silent fallback leak | Hard-fail + strict diagnostics |
| **D (Authority)** | No lock-in | Partial: frontend already prevents orchestration | Add materialization verification metadata |
| **B (Audio)** | Placeholder + rebuild | Ducking already applied, SFX can be placed | Add evidence + tests, keep existing render |

**Actual execution:** NOT 4 big phases. **4 surgical tightenings.**

---

## CODEX'S AUDIT FINDINGS (TRUST THESE)

### Motion (Phase A) — Already 80% Working
**File:** `backend/src/composition/hyperframes-composition-generator.ts`

**What's working:**
- Line 479: GSAP vendor activation exists ✓
- Line 767: Real `gsap.timeline()` emitted ✓
- Line 680: Preset tagged in HTML ✓
- Line 895: Diagnostics derive flag from `gsapMotionActive` 

**The actual gap:**
- Line 895: `gsapTimelineGenerated = gsapMotionActive` is a **shortcut**
- Not verifying that HTML actually contains `gsap.timeline(...)` string
- Not checking that preset name is actually in output
- Diagnostics say "true" based on input flag, not output proof

**Fix required:** Verify diagnostics against actual HTML content, not just assume

---

### Typography (Phase C) — Real Authority Leak Confirmed
**Files:** 
- `backend/src/edit-sessions/service.ts` (lines 1375-1385)
- `backend/src/typography/typography-decision-engine.ts` (line 88)

**What's broken:**
```typescript
// service.ts line 1375-1385
const fontPair = resolveRequestedOrFallbackFontPair("Satoshi", "Canela");
if (!fontPair) {
  // Falls back silently, no hard-fail
  console.warn("Font resolution failed");
  continue; // Keeps rendering anyway
}

// typography-decision-engine.ts line 88
return {
  primaryFont: primary,
  fallbackUsed: true,
  // But render CONTINUES instead of failing when premium was requested
};
```

**The leak:**
- Manifest requests premium style: `requestedStyle: "Iman-tier"`
- Fonts fail to resolve
- System degrades to sans-serif silently
- Diagnostics report: `fallbackUsed: true` ← true but TOO LATE
- Output is NOT premium despite manifest saying it should be

**Fix required:** 
1. When `requestedStyle` includes premium markers, HARD-FAIL if fonts unavailable
2. Only allow silent fallback for neutral/non-premium styles
3. Expand diagnostics to show: requested fonts, resolved fonts, embedded fonts

---

### Phase D (Authority) — Partially Implemented
**Files:**
- `backend/src/__tests__/audio-creative-preview-session-backend-plan.test.ts` (line 4)
- `remotion-app/src/PreviewApp.tsx` (line 68)

**What's working:**
- Frontend test explicitly prevents browser orchestration when backend plan exists ✓
- PreviewApp states: backend render authority ✓
- Manifest honored at some level ✓

**What's missing:**
- No `materialChangesVerified` metadata field
- No `deviations: string[]` tracking (requested style vs actual applied)
- No HTML verification that style decisions materialized
- No test checking that manifest directives actually changed output

**Fix required:**
1. Add `materialChangesVerified: boolean` to diagnostics
2. Add `deviations: string[]` for material changes verification
3. Verify style directives actually changed HTML (motion preset, font, pacing)
4. Fail/warn if deviations detected

---

### Audio (Phase B) — Split State, Not Empty
**Files:**
- `backend/src/music/analyzer/track-analyzer.ts` (line 41) — Placeholder only
- `backend/src/music/analyzer/beat-grid-builder.ts` (line 29) — Placeholder only
- `backend/src/music/analyzer/section-detector.ts` (line 56) — Placeholder only
- `backend/src/music/renderer/mix-renderer.ts` (line 93) — Correct behavior
- `backend/src/sound-engine/filtergraph.ts` (line 289) — Ducking already applied

**What's working:**
- Line 93 (mix-renderer): Correctly blocks fake remote renders ✓
- Line 289 (filtergraph): Ducking via sidechain or timeline-envelope already applied ✓
- Framework exists for SFX placement ✓

**What's missing:**
- Beat detection is placeholder (OK — can stay until Python bridge)
- No evidence/tests proving ducking was applied
- No evidence/tests proving SFX timing is correct
- Diagnostics don't report ducking/SFX execution

**Fix required:**
1. Add analyzer abstraction (stub interface, can fill later)
2. Add evidence to render result: "Ducking applied to regions: [...]"
3. Add evidence to render result: "SFX injected: [list with timing]"
4. Add tests verifying ducking and SFX are in output

---

## REVISED EXECUTION PLAN

### Order (by ROI + dependencies):

**1. Typography Authority Tightening (2-3 hours)**
   - Add hard-fail for premium fonts
   - Expand diagnostics
   - Add test: premium style with missing fonts should error
   - Add test: fonts actually embedded in HTML

**2. Motion Diagnostics Truthfulness (1-2 hours)**
   - Read generated HTML in diagnostics phase
   - Verify `gsap.timeline(` string present
   - Verify preset name in output
   - Fail diagnostics if HTML doesn't match claim

**3. Authority Materialization Verification (2-3 hours)**
   - Add `materialChangesVerified: boolean` field
   - Add `deviations: string[]` field
   - Verify motion preset matches manifest
   - Verify fonts match manifest
   - Verify pacing matches manifest
   - Add tests checking end-to-end

**4. Audio Evidence + Tests (1-2 hours)**
   - Add evidence strings to render result
   - Verify ducking in manifest/filtergraph
   - Verify SFX timing metadata
   - Add tests for ducking proof, SFX proof

---

## CRITICAL CLARIFICATION: TDD EXECUTION

**Codex asked:** Blueprint says "design tests only" but TDD skill was invoked. Should I run tests or design only?

**Answer: YES, RUN STRICT TDD.**

Rationale:
- TDD skill invocation means: red-green-refactor cycle
- Design-only is insufficient for catching edge cases
- Running failing tests FIRST catches integration issues
- You won't modify codebase without test verification

**Process (per TDD skill):**
1. Write failing test FIRST (verify it fails correctly)
2. Verify failure message matches expectation
3. Implement fix
4. Verify test passes
5. No shortcuts, no "just looks right"

---

## PHASE 1: TYPOGRAPHY AUTHORITY TIGHTENING

### 1A: Understand Current Hard-Fail Potential

**File:** `backend/src/edit-sessions/service.ts`
**Current (lines 1375-1385):**
```typescript
const fontPair = resolveRequestedOrFallbackFontPair("Satoshi", "Canela");
if (!fontPair) {
  console.warn("Font fallback"); // Just logs
  // Falls through, rendering continues
}
```

**Question for verification:** Is there a `requestedStyle` flag at this point that says "premium required"?
- If YES: Hard-fail if fonts unavailable
- If NO: Silent fallback is acceptable

**Search needed:** Does `manifest.style?.requestedStyle` contain premium markers?

### 1B: TDD Test Case 1 — Premium Font Must Hard-Fail If Missing

**File:** `backend/src/__tests__/typography-authority.test.ts` (create new)

**Test (design first, write failing, then implement):**
```typescript
describe("Typography Authority: Premium Font Hard-Fail", () => {
  it("should hard-fail when premium style requested but fonts unavailable", async () => {
    // SETUP: Create manifest with premium request but empty font catalog
    const manifest = createTestManifest({
      style: { requestedStyle: "Iman-tier" }, // Premium marker
      intent: { intensity: 9 } // High intensity = premium
    });
    
    // Mock font resolver to return null (fonts unavailable)
    mockFontResolver.resolveRequestedOrFallbackFontPair = () => null;
    
    // ACT: Try to generate typography decision
    // EXPECT: Should throw error, not silently degrade
    expect(() => {
      generateTypographyDecision(manifest, { 
        hardFailOnPremiumUnavailable: true 
      });
    }).toThrowError(/Premium typography.*unavailable/);
  });
  
  it("should NOT hard-fail for neutral style even if fonts unavailable", async () => {
    const manifest = createTestManifest({
      style: { requestedStyle: "neutral" },
      intent: { intensity: 3 } // Low intensity = OK to fallback
    });
    
    mockFontResolver.resolveRequestedOrFallbackFontPair = () => null;
    
    // Should succeed with sans-serif fallback
    const decision = generateTypographyDecision(manifest, {
      hardFailOnPremiumUnavailable: true
    });
    
    expect(decision.fallbackUsed).toBe(true);
    expect(decision.fallbackReasons).toContain("fonts unavailable");
  });
});
```

**Implementation target:**
```typescript
// In service.ts, around line 1375
const isPremiumRequired = manifest.style?.requestedStyle?.includes("Iman") ||
                          manifest.style?.requestedStyle?.includes("premium") ||
                          manifest.intent.intensity >= 8;

const fontPair = resolveRequestedOrFallbackFontPair("Satoshi", "Canela");
if (!fontPair && isPremiumRequired) {
  throw new Error(
    `Premium style "${manifest.style?.requestedStyle}" requires font pairing, ` +
    `but Satoshi/Canela are not available. Fonts must be ingested into font-intelligence/outputs/.`
  );
}
```

### 1C: TDD Test Case 2 — Fonts Embedded in HTML

**File:** `backend/src/__tests__/typography-authority.test.ts`

**Test:**
```typescript
describe("Typography Authority: Font Embedding", () => {
  it("should embed resolved fonts into composition HTML", async () => {
    const manifest = createTestManifestWithFonts({
      requestedFonts: ["Satoshi", "Canela"]
    });
    
    mockFontResolver.resolveRequestedOrFallbackFontPair = () => ({
      primary: { family: "Satoshi", filePath: "/path/to/Satoshi.ttf" },
      secondary: { family: "Canela", filePath: "/path/to/Canela.ttf" }
    });
    
    const result = await generateHyperFramesComposition(manifest);
    const htmlContent = readFileSync(result.indexHtmlPath, "utf8");
    
    // PROOF: Fonts are in HTML
    expect(htmlContent).toContain("@font-face");
    expect(htmlContent).toContain("Satoshi");
    expect(htmlContent).toContain("Canela");
    
    // PROOF: diagnostics match
    expect(result.diagnostics.fontProof.fontFilesLoadedIntoComposition).toContain("Satoshi");
    expect(result.diagnostics.fontProof.fontFilesLoadedIntoComposition).toContain("Canela");
    expect(result.diagnostics.fontProof.fallbackFontsUsed).toHaveLength(0);
  });
  
  it("should report zero fallback fonts when premium fonts resolved", async () => {
    // ... same setup ...
    
    const result = await generateHyperFramesComposition(manifest);
    
    // DIAGNOSTICS MUST BE TRUTHFUL
    expect(result.diagnostics.fontProof.fallbackFontsUsed).toEqual([]);
    expect(result.diagnostics.fontProof.fallbackReasons).toEqual([]);
  });
});
```

### 1D: Implementation Changes

**Files to modify:**
1. `backend/src/edit-sessions/service.ts` — Add hard-fail logic
2. `backend/src/typography/typography-decision-engine.ts` — Add strict mode option
3. `backend/src/contracts/render-diagnostics.ts` — Verify fontProof matches HTML

---

## PHASE 2: MOTION DIAGNOSTICS TRUTHFULNESS (1-2 hours)

### 2A: TDD Test Case — Diagnostics Verify HTML

**File:** `backend/src/__tests__/hyperframes-composition-generator.test.ts`

**Add new test (don't run yet):**
```typescript
describe("HyperFramesCompositionGenerator: Diagnostics Truthfulness", () => {
  it("should only report gsapTimelineGenerated=true if HTML contains gsap.timeline", async () => {
    const manifest = createTestManifest({
      style: { requestedStyle: "premium" }
    });
    
    const result = await generateHyperFramesComposition(manifest);
    const htmlContent = readFileSync(result.indexHtmlPath, "utf8");
    
    // DIAGNOSTICS MUST MATCH OUTPUT
    const hasGsapTimeline = htmlContent.includes("gsap.timeline");
    expect(result.diagnostics.animationProof.gsapTimelineGenerated).toBe(hasGsapTimeline);
    
    // If GSAP is claimed, preset must be in HTML
    if (result.diagnostics.animationProof.gsapTimelineGenerated) {
      expect(htmlContent).toContain("whipIn") || 
      expect(htmlContent).toContain("arcRise") ||
      expect(htmlContent).toContain("softSlideLeft");
      
      // CANNOT have CSS fallback
      expect(htmlContent).not.toContain("@keyframes fadeUp");
    }
  });
  
  it("should report fallbackAnimationUsed=true only if CSS @keyframes in HTML", async () => {
    const manifest = createTestManifestWithoutPremiumStyle({
      style: { requestedStyle: "basic" }
    });
    
    const result = await generateHyperFramesComposition(manifest);
    const htmlContent = readFileSync(result.indexHtmlPath, "utf8");
    
    const hasCssFallback = htmlContent.includes("@keyframes");
    expect(result.diagnostics.animationProof.fallbackAnimationUsed).toBe(hasCssFallback);
  });
});
```

### 2B: Implementation Change

**File:** `backend/src/composition/hyperframes-composition-generator.ts`
**Around line 895, diagnostics section:**

**Current (shortcut):**
```typescript
gsapTimelineGenerated: gsapMotionActive, // Derived from flag, not verified
```

**Fix:**
```typescript
// READ the actual HTML to verify what's in output
const generatedHtmlContent = readFileSync(result.indexHtmlPath, "utf8");
const hasGsapTimelineInHtml = generatedHtmlContent.includes("gsap.timeline");
const hasCssKeyframesInHtml = generatedHtmlContent.includes("@keyframes");

gsapTimelineGenerated: hasGsapTimelineInHtml,
cssFallbackUsed: hasCssFallbackInHtml && !hasGsapTimelineInHtml,
```

---

## PHASE 3: AUTHORITY MATERIALIZATION VERIFICATION (2-3 hours)

### 3A: Extend Render Diagnostics Schema

**File:** `backend/src/contracts/render-diagnostics.ts`

**Add fields:**
```typescript
export type RenderStyleAuthority = {
  requestedStyle: string | null;
  appliedStyle: string;
  materialChangesVerified: boolean; // NEW
  deviations: string[]; // NEW
};

// deviations examples:
// "Requested aggressive motion but soft animation found"
// "Requested premium fonts but sans-serif used"
// "Requested fast pacing but standard timing used"
```

### 3B: TDD Test Case — Materialization Verification

**File:** `backend/src/__tests__/render-authority.test.ts` (create new)

**Test:**
```typescript
describe("Render Authority: Material Changes Verification", () => {
  it("should verify that aggressive style produces aggressive motion", async () => {
    const manifest = createTestManifest({
      style: { requestedStyle: "aggressive-high-contrast" },
      intent: { intensity: 9 }
    });
    
    const result = await generateHyperFramesComposition(manifest);
    const htmlContent = readFileSync(result.indexHtmlPath, "utf8");
    
    // VERIFY: Material change for aggressive style
    expect(htmlContent).toContain("whipIn") || 
    expect(htmlContent).toContain("arcRise");
    
    // DIAGNOSTICS: No deviations if verified
    expect(result.diagnostics.styleAuthority.materialChangesVerified).toBe(true);
    expect(result.diagnostics.styleAuthority.deviations).toEqual([]);
  });
  
  it("should flag deviation if requested style cannot materialize", async () => {
    const manifest = createTestManifest({
      style: { requestedStyle: "Iman-tier" }
      // But fonts will be unavailable
    });
    
    mockFontResolver.returns = null;
    
    // Either: should throw (hard-fail from Phase 1)
    // Or: should materialize partial and flag deviation
    
    const result = await generateHyperFramesComposition(manifest);
    
    expect(result.diagnostics.styleAuthority.materialChangesVerified).toBe(false);
    expect(result.diagnostics.styleAuthority.deviations).toContain(
      expect.stringMatching(/fonts.*unavailable/)
    );
  });
});
```

### 3C: Implementation

**File:** `backend/src/composition/hyperframes-composition-generator.ts`

**Add materialization verification function:**
```typescript
const verifyMaterialChanges = (
  manifest: CreativeDecisionManifest,
  generatedHtml: string
): RenderStyleAuthority => {
  const requestedStyle = manifest.style?.requestedStyle || "";
  const deviations: string[] = [];
  
  // Check 1: Motion preset
  if (requestedStyle.includes("aggressive")) {
    if (!generatedHtml.includes("whipIn") && !generatedHtml.includes("arcRise")) {
      deviations.push("Aggressive motion requested but not found in output");
    }
  }
  
  // Check 2: Typography
  if (requestedStyle.includes("premium") || requestedStyle.includes("Iman")) {
    if (!generatedHtml.includes("Satoshi") && !generatedHtml.includes("Canela")) {
      deviations.push("Premium fonts requested but premium fonts not loaded");
    }
  }
  
  // Check 3: Pacing
  if (manifest.style?.pacingStyle === "aggressive") {
    if (!generatedHtml.includes("stagger: 0.08")) {
      deviations.push("Aggressive pacing requested but standard timing used");
    }
  }
  
  return {
    requestedStyle,
    appliedStyle: deriveAppliedStyle(manifest),
    materialChangesVerified: deviations.length === 0,
    deviations
  };
};
```

---

## PHASE 4: AUDIO EVIDENCE + TESTS (1-2 hours)

### 4A: TDD Test Case — Ducking Evidence

**File:** `backend/src/__tests__/music-audio-renderer.test.ts`

**Add test:**
```typescript
describe("Audio Mix Rendering: Ducking Evidence", () => {
  it("should produce evidence that ducking was applied", async () => {
    const manifest = createTestManifestWithSpeech({
      speechRegions: [{ startMs: 1000, endMs: 3500 }],
      musicCues: [{ id: "music-1", file: "track.mp3", startMs: 0 }]
    });
    
    const result = await renderAudioPlan({
      plan: manifest,
      outputAudioPath: "output.wav"
    });
    
    // EVIDENCE: Ducking applied
    expect(result.evidence).toContain(
      expect.stringMatching(/Ducking applied.*1000.*3500/)
    );
    
    // MANIFEST: Ducking gain set
    expect(result.manifest.musicCues[0].duckingGainDb).toBeLessThan(-6);
  });
  
  it("should produce evidence that SFX were injected", async () => {
    const manifest = createTestManifestWithSFX({
      sfx: [{ id: "whoosh", file: "sfx.mp3", tiedToVisualEventMs: 2000 }],
      motionEvents: [{ eventMs: 2000 }]
    });
    
    const result = await renderAudioPlan({
      plan: manifest,
      outputAudioPath: "output.wav"
    });
    
    // EVIDENCE: SFX injected with timing
    expect(result.evidence).toContain(
      expect.stringMatching(/SFX.*whoosh.*injected.*timing/)
    );
  });
});
```

### 4B: Implementation Changes

**File:** `backend/src/music/renderer/mix-renderer.ts`

**Add evidence collection:**
```typescript
const evidenceList: string[] = [];

// When ducking is applied:
duckingRegions.forEach(region => {
  evidenceList.push(
    `Ducking applied to music cues in region ${region.startMs}-${region.endMs}ms`
  );
});

// When SFX are injected:
manifest.sfx.forEach(sfx => {
  if (sfx.tiedToVisualEventMs) {
    evidenceList.push(
      `SFX ${sfx.id} injected at ${sfx.tiedToVisualEventMs - 100}ms ` +
      `(100ms lead before visual event)`
    );
  }
});

return {
  ...result,
  evidence: evidenceList
};
```

---

## SUMMARY: WHAT CODEX SHOULD DO NOW

### Execute in this order (12-16 hours total):

**Phase 1: Typography (2-3 hours)**
- [ ] Write test: hard-fail when premium fonts unavailable
- [ ] Run test, verify it FAILS correctly
- [ ] Implement hard-fail logic in service.ts
- [ ] Verify test PASSES
- [ ] Write test: fonts embedded in HTML
- [ ] Implement font embedding verification
- [ ] Verify test PASSES

**Phase 2: Motion Diagnostics (1-2 hours)**
- [ ] Write test: diagnostics verify HTML contains gsap.timeline
- [ ] Run test, verify it FAILS
- [ ] Implement HTML verification in diagnostics
- [ ] Verify test PASSES

**Phase 3: Authority Materialization (2-3 hours)**
- [ ] Extend render-diagnostics schema with materialChangesVerified + deviations
- [ ] Write test: no deviations when style materializes correctly
- [ ] Write test: flag deviations when style cannot materialize
- [ ] Implement verification function
- [ ] Verify both tests PASS

**Phase 4: Audio Evidence (1-2 hours)**
- [ ] Write test: ducking evidence in result
- [ ] Write test: SFX evidence with timing
- [ ] Implement evidence collection in mix-renderer
- [ ] Verify both tests PASS

---

## EXECUTION RULES (STRICT)

1. **TDD Only:** Write failing test FIRST, verify failure, implement, verify pass
2. **No Silent Fallbacks:** Hard-fail for premium when requirements unmet
3. **Diagnostics = Truth:** Verify output, don't derive from flags
4. **Evidence Required:** Ducking, SFX, fonts, motion must have proof in result
5. **No Changes Without Tests:** Every modification requires failing test first

---

## Expected Result: 32% → 90%

After all 4 phases:
- ✓ GSAP motion verified in HTML
- ✓ Premium fonts hard-enforced or error
- ✓ Style authority verified end-to-end
- ✓ Audio ducking + SFX evidenced
- ✓ Zero fake premium claims
- ✓ All diagnostics truthful

Readiness: **90%+ Iman Gadzhi scale**
