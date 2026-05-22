# CODEX EXHAUSTIVE CINEMATIC EXECUTION BLUEPRINT
## Prometheus Backend: 32% → 90% Iman Gadzhi Scale

**CRITICAL PREFACE:** You are NOT to modify the codebase. You will analyze, understand, and generate a comprehensive execution playbook. This document IS the target playbook Codex will execute.

---

## PART 0: THE BRUTAL TRUTH

Current readiness on Iman Gadzhi cinematic scale: **32%**
- Intelligence & Architecture: 85% (The brain exists)
- Motion Execution: 20% (CSS lies, not GSAP)
- Sound Design: 10% (Planning exists, render doesn't)
- Typography: 15% (Falls back to sans-serif)
- Authority Enforcement: 40% (Metadata exists, unused)

The system is a Ferrari engine driving a tricycle.

**Target:** 90%+ cinematic readiness, meaning:
- Text whips/arcs/eases like After Effects, not CSS fade
- Audio pulses with the visual—beats sync, ducking is frame-perfect
- Typography is premium-branded paired fonts with word-level kinetic reveal
- Each creative decision manifests materially in final output

---

## PART 1: THE ROOT CAUSE MAP

### 1A. Motion "Soul" Leak — THE CSS FALLBACK TRAP
**File:** `backend/src/composition/hyperframes-composition-generator.ts`
**Current Crime:**
- Line ~450-500: Builds generic CSS @keyframes `fadeUpDefault` (720ms linear fade)
- Line ~600-650: Injects these CSS @keyframes into HTML `<style>` block
- Line ~700+: Never actually uses the GSAP motion engine (`js/engine/motion-engine.js`)
- Line ~800+: Diagnostics LIE: `gsapTimelineGenerated: true` even when only CSS is used

**Evidence of the lie:**
```typescript
// Current broken pattern:
const animationProof = {
  gsapTimelineGenerated: true,  // LIE! Only CSS was emitted
  fallbackAnimationUsed: false
};
// But the HTML only has:
// <style>
//   @keyframes fadeUp { /* CSS, not GSAP */ }
// </style>
```

**Impact:** Premium motion presets (`whipIn`, `arcRise`, `dropSettle`) are never actually used. Motion preset choice logic exists but is discarded. The final HTML has zero GSAP timeline, zero CustomEase curves, zero physics.

---

### 1B. Audio DJ "Phase 1 Trap" — PLANNING WITHOUT EXECUTION
**Files:** 
- `backend/src/music/renderer/mix-renderer.ts` (lines 30-90)
- `backend/src/music/analyzer/track-analyzer.ts` (lines 35-60)
- `backend/src/music/analyzer/beat-grid-builder.ts` (lines 20-50)
- `backend/src/music/analyzer/section-detector.ts` (lines 50-80)

**Current Crime:**
- Beat detection: Placeholder inference, not real librosa/Essentia
- Audio render: Defaults to SKIPPED when music is remote/R2-only (line 85-100 in mix-renderer)
- Ducking: Never actually applied to speech regions
- SFX: Planned but never injected into FFmpeg render
- Comment at line 41 in track-analyzer: `// TODO: Use Python-side librosa/Essentia features for BPM, key, and section confidence.`
- Comment at line 29 in beat-grid-builder: `// TODO: Replace placeholder beat inference with Python-side librosa/Essentia analysis.`

**Impact:** The DJ system is "intelligent planning that cannot execute." Music plays under video, speech is not ducked, SFX do not hit the screen on time, text does not land on beats.

---

### 1C. Typography "Random Walk" — SERIF DISAPPEARS
**Files:**
- `backend/src/edit-sessions/service.ts` (lines 100-140)
- `backend/src/typography/font-file-resolver.ts` (all)
- `backend/src/typography/typography-decision-engine.ts` (all)

**Current Crime:**
- Manifest requests premium pairing: "Satoshi + Canela"
- Font resolver tries to find font files in `font-intelligence/outputs/font-manifest.json`
- Font path resolution fails silently on Windows (path separator bugs)
- Typography decision engine accepts fallback silently: line 75 in service.ts does NOT throw error when fonts are missing
- Falls back to hardcoded "sans-serif" (typography-decision-engine.ts line 80)
- `fallbackUsed: true` flag is set, but render continues anyway
- Result: Premium pairing never reaches the browser

**Impact:** All text is system sans-serif, no premium hierarchy, no visual brand identity.

---

### 1D. Authority Split Brain — FRONTEND GUESSING
**Files:**
- `remotion-app/src/web-preview/` (Preview flow ignores manifest)
- `backend/src/contracts/creative-decision-manifest.ts` (Manifest exists but frontend doesn't enforce it)

**Current Crime:**
- Backend builds rich `CreativeDecisionManifest` with:
  - `requestedStyle`, `appliedStyle`
  - `motionTier`, `typographyProfile`, `pacing`
  - Premium metadata
- Frontend preview receives manifest but ignores it
- Frontend's browser overlay makes up composition on the fly
- No strict "manifest → render" path enforcement

**Impact:** Backend intelligence is lost. Frontend is a seat-of-the-pants editor, not a master producer.

---

## PART 2: THE BLUEPRINT — FOUR PHASES TO 90%

### PHASE A: KILL CSS, ENFORCE GSAP (MOTION FIX)
**Goal:** Replace every CSS @keyframes fallback with real GSAP timeline execution.
**Timeline:** 2-3 hours focused work

#### Step A1: Audit Current Motion Path
**File to read:** `backend/src/composition/hyperframes-composition-generator.ts`
**What to look for:**
- Search for `@keyframes` string → find where CSS is generated
- Search for `gsap.min.js` → current GSAP injection attempt
- Search for `generateHyperFramesComposition` → the main generator function
- Search for `resolvePremiumMotionPlan` → where motion preset is chosen but then ignored

**Evidence you need:**
```
[Line XXX] CSS @keyframes generated but GSAP never invoked
[Line YYY] Motion preset selected but choice lost
[Line ZZZ] Timeline never written to HTML
```

#### Step A2: Motion Preset Integration Test
**Test file:** `backend/src/__tests__/hyperframes-composition-generator.test.ts`
**Add test case (do NOT run, only design):**
```typescript
describe("HyperFramesCompositionGenerator: GSAP Motion Execution", () => {
  it("should emit GSAP timeline when premiumMotionPreset is 'whipIn'", async () => {
    const manifest = createTestManifest({
      style: { requestedStyle: "Iman-tier" }
    });
    
    const result = await generateHyperFramesComposition(manifest);
    
    // DIAGNOSTIC TEST: Motion must be in HTML script, not CSS
    const htmlContent = await readFile(result.indexHtmlPath, "utf8");
    
    expect(htmlContent).toContain("gsap.timeline");
    expect(htmlContent).toContain("whipIn"); // Preset name must appear
    expect(htmlContent).toContain("CustomEase"); // Easing must be GSAP-based
    expect(htmlContent).not.toContain("@keyframes fadeUp"); // NO CSS fallback
    
    expect(result.diagnostics.animationProof.gsapTimelineGenerated).toBe(true);
    expect(result.diagnostics.animationProof.fallbackAnimationUsed).toBe(false);
  });
});
```

#### Step A3: Refactor the HTML Generation Path
**File to modify:** `backend/src/composition/hyperframes-composition-generator.ts`
**Current broken section (approximate lines 550-650):**
```typescript
// BROKEN: Generates CSS, skips GSAP
const buildAnimationStyleBlock = (): string => {
  return `<style>
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
  </style>`;
};
```

**Required refactor pattern:**
1. Read the resolved motion preset from `resolvePremiumMotionPlan()` result
2. Extract the `motionPreset` (e.g., "whipIn")
3. Generate GSAP script block INSTEAD of CSS
4. Write GSAP inline with CustomEase parameters
5. Emit diagnostics: `gsapTimelineGenerated = true` ONLY if timeline is actually in HTML

**Pseudo-code for the fix:**
```typescript
const buildGsapScriptBlock = (preset: PremiumMotionPreset, manifest: CreativeDecisionManifest): string => {
  // 1. Load motion-presets.js runtime definition
  const motionPresetsCode = readSync("js/engine/motion-presets.js"); 
  
  // 2. Load GSAP library (already copied to assets)
  const gsapLibUrl = "assets/vendor/gsap.min.js";
  
  // 3. Generate timeline script that:
  //    - Creates GSAP timeline
  //    - Registers preset (whipIn, arcRise, etc.)
  //    - Applies preset to text elements
  //    - Uses speech rate & intensity to modulate timing
  
  return `<script src="${gsapLibUrl}"></script>
    <script>
      ${motionPresetsCode}
      
      const engine = CinematicMotion.createMotionEngine({
        stageSelector: '.stage',
        defaultDuration: 1.2,
        stagger: ${computeStaggerFromSpeechRate(manifest)}
      });
      
      // Add each text line to motion engine
      document.querySelectorAll('[data-line]').forEach((el, idx) => {
        engine.addObject({
          selector: el,
          preset: '${preset}',
          fromRule: '${computeFromRule(manifest, idx)}',
          timing: { at: ${idx * staggerMs}, delay: 0 }
        });
      });
      
      engine.buildTimeline();
      engine.play();
    </script>`;
};
```

#### Step A4: Fix Diagnostics Truthfulness
**File:** `backend/src/composition/hyperframes-composition-generator.ts` (diagnostics section)
**Current lie (example line 850):**
```typescript
gsapTimelineGenerated: manifest.style?.requestedStyle !== undefined, // LIE: always true if style exists
```

**Fix:**
```typescript
// Check if HTML actually contains GSAP timeline
const htmlContent = readSync(indexHtmlPath);
const hasGsapTimeline = htmlContent.includes("gsap.timeline");
const hasCssFallback = htmlContent.includes("@keyframes");

return {
  gsapTimelineGenerated: hasGsapTimeline,
  cssFallbackUsed: hasCssFallback,
  fallbackReasons: hasGsapTimeline ? [] : ["GSAP timeline could not be generated, CSS fallback used"]
};
```

#### Step A5: Validate Motion Preset Selection
**File:** `backend/src/composition/hyperframes-composition-generator.ts`
**Function:** `resolvePremiumMotionPlan()`
**Current behavior (lines 270-320):** Chooses preset based on style/intensity but then discards choice
**Fix:** Ensure chosen preset is ACTUALLY USED in the GSAP script block
**Validation:**
- `whipIn` for aggressive/high-energy
- `arcRise` for premium/luxury reveal
- `softSlideLeft/Right` for modern authority
- `dropSettle` for impact/emphasis

---

### PHASE B: THE PYTHON AUDIO BRIDGE (SOUND DESIGN FIX)
**Goal:** Replace placeholder beat detection with real librosa analysis, render audio mix with ducking/SFX
**Timeline:** 3-4 hours (includes Python integration)

#### Step B1: Understand Current Placeholder State
**Files to audit:**
- `backend/src/music/analyzer/track-analyzer.ts` (lines 35-80)
- `backend/src/music/analyzer/beat-grid-builder.ts` (lines 20-80)
- `backend/src/music/analyzer/section-detector.ts` (lines 50-100)
- `backend/src/music/renderer/mix-renderer.ts` (lines 30-120)

**Evidence you need:**
```
[Line XXX] Current beat detection uses placeholder heuristic (e.g., fixed bpm, no analysis)
[Line YYY] Mix render skips execution when music is remote/R2
[Line ZZZ] Ducking is never applied
[Line QQQ] SFX are planned but never injected
```

**Read test file:** `backend/src/__tests__/music-audio-renderer.test.ts`
**Look for:**
- Dry-run vs render-ready distinction
- What mock data is used (tells you what's real vs placeholder)

#### Step B2: Design the Python Bridge Protocol
**Create analysis:** What inputs does beat detection need?
1. Audio file path (local or downloaded from R2)
2. Output format: Beat times, bar boundaries, tempo changes
3. Section markers: Verse/chorus/bridge confidence

**Design output contract:**
```typescript
type LibrosaBeatAnalysisResult = {
  bpm: number;
  tempoChanges: Array<{ timeMs: number; bpm: number }>;
  beats: Array<{ timeMs: number; confidence: number }>;
  bars: Array<{ startMs: number; endMs: number }>;
  sections: Array<{
    type: "intro" | "verse" | "chorus" | "bridge" | "outro";
    startMs: number;
    endMs: number;
    confidence: number;
  }>;
};
```

**Implementation strategy:**
- Do NOT build full Python pipeline yet
- Instead: Add abstraction layer in TypeScript
- Interface: `interface AudioAnalyzerBackend { analyze(file: string): Promise<LibrosaBeatAnalysisResult> }`
- Implement stub that returns placeholder analysis
- Later: Python subprocess can fill real implementation
- Benefit: Decouples audio prep from Python availability

#### Step B3: Ducking Implementation (Immediate High-ROI)
**File:** `backend/src/music/renderer/mix-renderer.ts`
**Goal:** When rendering, detect speech regions and reduce music volume
**Current state (line 80-120):** Skips audio rendering entirely

**Fix pattern:**
```typescript
const duckingRegions = detectSpeechRegions(manifest); // From transcript timing

for (const region of duckingRegions) {
  // Apply FFmpeg filter to reduce music volume during speech
  // Pseudo-FFmpeg: afftdenoise + volume reduction from +region.startMs to +region.endMs
  manifest.musicCues.forEach(cue => {
    if (cueOverlapsSpeech(cue, region)) {
      cue.duckingGainDb = -8; // Reduce music by 8dB during speech
    }
  });
}
```

#### Step B4: SFX Injection Mechanism
**File:** `backend/src/sound-engine/render.ts` (line 120-200)
**Current state:** SFX loop but never actually placed

**Required fix:**
```typescript
// For each SFX cue with timing tied to visual event:
for (const sfx of manifest.sfx) {
  // Example: "whoosh" should hit 100ms BEFORE text animation start
  const tiedEventTime = sfx.tiedToVisualEventMs || 0;
  const actualAudioStart = tiedEventTime - 100; // Lead time
  
  // Inject into FFmpeg filter graph with exact timing
  ffmpegFilterGraph.addCue({
    file: sfx.file,
    startTimeMs: actualAudioStart,
    durationMs: sfx.durationMs,
    gainDb: sfx.gainDb || 0,
    pan: sfx.pan || 0
  });
}
```

#### Step B5: Test Design for Audio Mix Rendering
**Test file:** `backend/src/__tests__/music-audio-renderer.test.ts`
**New test case (design only, do NOT run):**
```typescript
describe("Audio Mix Rendering: Ducking + SFX", () => {
  it("should duck music during speech regions", async () => {
    const manifest = createTestManifestWithSpeech({
      speechRegions: [
        { startMs: 1000, endMs: 3500, transcript: "..." }
      ],
      musicCues: [{
        id: "music-1",
        file: "path/to/background-track.mp3",
        startMs: 0,
        duckingGainDb: undefined // Before rendering
      }]
    });
    
    const result = await renderAudioPlan({
      plan: manifest,
      outputAudioPath: "output.wav"
    });
    
    // PROOF: Ducking was applied
    const appliedManifest = result.manifest;
    expect(appliedManifest.musicCues[0].duckingGainDb).toBeLessThan(-6);
    
    // PROOF: FFmpeg command includes dynamic ducking filter
    expect(result.warnings).toContain("Ducking applied during regions: [1000-3500]");
    
    // Diagnostics MUST show audio was rendered, not skipped
    expect(result.status).toBe("rendered");
  });
  
  it("should inject SFX at visual event timing", async () => {
    const manifest = createTestManifestWithSFX({
      sfx: [{
        id: "sfx-whoosh",
        file: "assets/sfx/whoosh.mp3",
        tiedToVisualEventMs: 2000, // Text lands at 2000ms
        durationMs: 200
      }],
      motionEvents: [{ eventMs: 2000, type: "text-whip" }]
    });
    
    const result = await renderAudioPlan({ plan: manifest });
    
    // PROOF: SFX was injected into render
    expect(result.evidence).toContain("SFX injected: sfx-whoosh at 1900ms (100ms lead)");
  });
});
```

---

### PHASE C: STRICT TYPOGRAPHY AUTHORITY (STYLE FIX)
**Goal:** Eliminate font fallback, guarantee premium pairing reaches browser
**Timeline:** 1-2 hours

#### Step C1: Font Resolution Hard-Fail Pattern
**File:** `backend/src/edit-sessions/service.ts`
**Current behavior (lines 100-140):**
```typescript
// BROKEN: Silent fallback
const fontPair = resolveRequestedOrFallbackFontPair("Satoshi", "Canela");
if (!fontPair) {
  console.warn("Font fallback"); // Just logs, continues anyway
}
```

**Fix to implement (hard-fail approach):**
```typescript
const fontPair = resolveRequestedOrFallbackFontPair("Satoshi", "Canela");
if (!fontPair) {
  // Option 1: Hard fail (puristic)
  throw new Error(
    `Premium typography requested but font resolution failed. ` +
    `Required fonts: Satoshi, Canela. ` +
    `Available: ${availableFontList}. ` +
    `Fix: Ingest fonts into font-intelligence/outputs/font-manifest.json`
  );
}

// Option 2: Degrade to safe preset (pragmatic)
// Only if Iman-tier is NOT requested
if (manifest.style?.requestedStyle?.includes("Iman") && !fontPair) {
  throw new Error("Iman-tier premium edit requires premium font pairing.");
}
```

#### Step C2: Font File Path Fix (Windows Separator Bug)
**File:** `backend/src/typography/font-file-resolver.ts`
**Current issue:** Windows path separators leak into browser URLs
**Problem line (line 65):** 
```typescript
const filePath = observed.extractedAbsolutePath?.trim() ?? ""; // May contain C:\Path\To\Font.ttf
```
**Browser receives:** `<link href="C:\Path\To\Font.ttf">` → breaks
**Fix:**
```typescript
// Normalize all paths to forward slashes
const normalizePathForBrowser = (absPath: string): string => {
  return absPath.replace(/\\/g, "/"); // C:\Path\To\Font.ttf → C:/Path/To/Font.ttf
};

const copiedPath = await copyLocalAsset({
  sourcePath: localPath,
  targetDir: fontsDir
});

// Return browser-safe URL
return {
  requestedPath: trimmed,
  browserUrl: `assets/fonts/${sanitizeFileName(path.basename(copiedPath))}`,
  copiedPath: normalizePathForBrowser(copiedPath)
};
```

#### Step C3: Typography Decision Engine Strictness
**File:** `backend/src/typography/typography-decision-engine.ts`
**Current behavior (lines 70-85):** Accepts fallback silently
**Fix pattern:**
```typescript
export const generateTypographyDecision = (
  input: TypographyDecisionInput,
  options?: { hardFailOnFallback?: boolean }
): TypographyDecision => {
  const customFonts = input.availableFonts.filter((f) => f.source === "custom_ingested");
  
  if (customFonts.length === 0 && options?.hardFailOnFallback) {
    throw new Error(
      `Premium typography requested but no custom fonts available. ` +
      `Fallback to system fonts is not permitted in strict mode.`
    );
  }
  
  // Existing fallback logic continues, but with audit trail
  const fallbackUsed = customFonts.length === 0;
  const fallbackReasons = fallbackUsed ? ["No custom ingested fonts available"] : [];
  
  return {
    primaryFont: primary,
    fallbackUsed,
    fallbackReasons, // MUST be populated
    // ...rest
  };
};
```

#### Step C4: Font Loading Verification in HTML
**File:** `backend/src/composition/hyperframes-composition-generator.ts`
**Add HTML font loading check:**
```typescript
const fontLoadingValidation = `<script>
  document.fonts.ready.then(() => {
    const fontFamilies = ['Satoshi', 'Canela'];
    const missing = fontFamilies.filter(family => !document.fonts.check('12px ' + family));
    if (missing.length > 0) {
      console.error('Font loading failed:', missing);
      window.fontLoadingStatus = 'FAILED';
    } else {
      window.fontLoadingStatus = 'SUCCESS';
    }
  });
</script>`;

// Add to HTML output
htmlContent += fontLoadingValidation;
```

#### Step C5: Diagnostics Proof for Typography
**File:** `backend/src/contracts/render-diagnostics.ts`
**Add typography diagnostics:**
```typescript
fontProof: {
  fontsRequestedFromManifest: string[]; // ["Satoshi", "Canela"]
  fontFilesResolved: string[]; // ["/path/to/Satoshi.ttf", "/path/to/Canela.ttf"]
  fontFilesLoadedIntoComposition: string[]; // ["assets/fonts/Satoshi.ttf", ...]
  fontCssGenerated: boolean; // true if @font-face declarations exist
  fallbackFontsUsed: string[]; // Empty if premium
  fallbackReasons: string[]; // Empty if premium
}
```

**Validation in diagnostics:**
```typescript
const premiumFontDiagnostics = result.diagnostics.fontProof;
expect(premiumFontDiagnostics.fallbackFontsUsed).toHaveLength(0);
expect(premiumFontDiagnostics.fallbackReasons).toHaveLength(0);
expect(premiumFontDiagnostics.fontFilesLoadedIntoComposition.length)
  .toBeGreaterThanOrEqual(2);
```

---

### PHASE D: RENDER AUTHORITY ENFORCEMENT (MANIFEST CONTROL)
**Goal:** Make style choices ACTUALLY VISIBLE in rendered output
**Timeline:** 1-2 hours

#### Step D1: CreativeDecisionManifest Authority Path
**File:** `backend/src/contracts/creative-decision-manifest.ts`
**Current state:** Manifest exists but frontend ignores it
**Fix: Add enforcement layer**
```typescript
export type RenderStyleAuthority = {
  requestedStyle: string | null;
  appliedStyle: string;
  materialChangesVerified: boolean;
  deviations: string[];
};
```

#### Step D2: Material Changes Verification
**File:** `backend/src/composition/hyperframes-composition-generator.ts`
**Add verification that style actually changed output:**
```typescript
const verifyStyleMaterialization = (
  manifest: CreativeDecisionManifest,
  generatedHtml: string
): RenderStyleAuthority => {
  const requestedStyle = deriveRequestedStyle(manifest);
  const appliedStyle = resolveAppliedStyle(manifest);
  const deviations: string[] = [];
  
  // Verify motion changed
  if (requestedStyle.includes("aggressive")) {
    if (!generatedHtml.includes("whipIn") && !generatedHtml.includes("arcRise")) {
      deviations.push("Requested aggressive motion but no whipIn/arcRise found in output");
    }
  }
  
  // Verify typography changed
  if (requestedStyle.includes("premium") || requestedStyle.includes("Iman")) {
    if (!generatedHtml.includes("Satoshi") && !generatedHtml.includes("Canela")) {
      deviations.push("Requested premium typography but premium fonts not loaded");
    }
  }
  
  // Verify pacing changed
  if (manifest.style?.pacingStyle === "aggressive") {
    const expectedStagger = 0.08; // Faster stagger
    if (!generatedHtml.includes(`stagger: ${expectedStagger}`)) {
      deviations.push("Requested aggressive pacing but standard stagger used");
    }
  }
  
  return {
    requestedStyle,
    appliedStyle,
    materialChangesVerified: deviations.length === 0,
    deviations
  };
};
```

#### Step D3: Frontend Bridge Lock-In
**File:** `remotion-app/src/web-preview/` (entire flow)
**Current issue:** Frontend ignores manifest, makes up composition
**Fix pattern:**
```typescript
// Frontend MUST receive and honor manifest
const applyManifestAuthority = (
  manifest: CreativeDecisionManifest,
  previewConfig: PreviewCompositionConfig
): PreviewCompositionConfig => {
  return {
    ...previewConfig,
    // Override frontend guesses with manifest authority
    motionPreset: manifest.style?.motionPreset || previewConfig.motionPreset,
    typographyProfile: manifest.typography.typographyProfile,
    pacingStyle: manifest.style?.pacingStyle,
    
    // Enforce premium if requested
    isPremiumMode: manifest.intent.intensity >= 8 || 
                   manifest.style?.requestedStyle?.includes("premium")
  };
};
```

---

## PART 3: DIAGNOSTIC CRITERIA FOR SUCCESS

### Motion Fix Validation (Phase A)
**Diagnostic signal:** `animationProof.gsapTimelineGenerated === true`
**HTML signal:** Output contains `gsap.timeline({` and NO `@keyframes`
**Preset signal:** Output contains the actual preset name (e.g., `"whipIn"`)
**Manifest signal:** No `fallbackAnimationUsed` or `fallbackReasons`
**Browser proof:** Text elements animate with easing curves, not linear CSS

### Audio Mix Validation (Phase B)
**Diagnostic signal:** `manifest.musicCues.every(cue => cue.duckingGainDb !== undefined)`
**Status signal:** `result.status === "rendered"` (not "skipped")
**Evidence signal:** `result.evidence.includes("Ducking applied")`
**Evidence signal:** `result.evidence.some(e => e.includes("SFX injected"))`
**Render proof:** Output audio has perceptibly reduced music during speech

### Typography Validation (Phase C)
**Diagnostic signal:** `fontProof.fallbackFontsUsed.length === 0`
**Diagnostic signal:** `fontProof.fontFilesLoadedIntoComposition.length >= 2`
**HTML signal:** `<link href="assets/fonts/Satoshi.ttf">` (not system font)
**Diagnostic signal:** `fontCssGenerated === true`
**Browser proof:** Text displays premium pairing, not generic sans-serif

### Authority Validation (Phase D)
**Diagnostic signal:** `styleAuthority.materialChangesVerified === true`
**Diagnostic signal:** `styleAuthority.deviations.length === 0`
**Manifest signal:** `appliedStyle === requestedStyle` (or close)
**Proof path:** End-to-end from manifest decision → HTML output → visual result

---

## PART 4: IMPLEMENTATION ORDER & DEPENDENCY MAP

### Execution Sequence (for max ROI):
1. **Phase A (Motion)** — Highest impact, no dependencies. 2-3 hours.
2. **Phase C (Typography)** — Fast, improves visual identity immediately. 1-2 hours.
3. **Phase D (Authority)** — Locks in both A+C, requires both. 1-2 hours.
4. **Phase B (Audio)** — Highest technical complexity, can run in parallel if needed. 3-4 hours.

### Dependencies:
```
Phase A (GSAP)
├─ Requires: js/engine/motion-presets.js (already exists)
├─ Requires: GSAP vendor (already copied)
└─ Requires: No Python, no external deps

Phase C (Typography)
├─ Requires: Font manifests (already exist)
├─ Requires: Path normalization fix (simple)
└─ Requires: No Python, no external deps

Phase D (Authority)
├─ Requires: Phase A output
├─ Requires: Phase C output
└─ Requires: Manifest contracts (already exist)

Phase B (Audio)
├─ Requires: Optional Python bridge (defer implementation)
├─ Requires: FFmpeg (already available)
├─ Requires: Speech ducking logic (can stub)
└─ Requires: SFX timing metadata (already in manifest)
```

---

## PART 5: RED FLAGS & FALLBACK PATTERNS TO KILL

### Patterns to FIND and ELIMINATE:
1. **CSS @keyframes as "premium" motion** → Kill, replace with GSAP
2. **Font fallback without error** → Fail hard if premium requested
3. **Audio render defaulting to SKIP** → Render by default, fail explicitly if blocked
4. **Manifest ignored by frontend** → Frontend MUST apply manifest authority
5. **Diagnostics lying about what was rendered** → Diagnostics must check HTML/output
6. **Speech regions unducked** → Ducking mandatory for render-ready
7. **SFX planned but not injected** → SFX must appear in FFmpeg filter graph

### Validation Checkpoints:
- **After Phase A:** `grep "gsap.timeline" output.html` → Must find 1+ matches
- **After Phase C:** `grep "Satoshi\|Canela" output.html` → Must find matches
- **After Phase B:** `ffprobe output.wav` → Must show ducking in waveform
- **After Phase D:** Diagnostics match visual output exactly

---

## PART 6: TEST STRATEGY (DESIGN ONLY, DO NOT EXECUTE)

### Test Architecture:
**Do NOT run tests yet.** Only DESIGN and ADD tests.
Each test should:
1. Set up a minimal manifest
2. Call the target function
3. Verify both HTML/output AND diagnostics match

### Critical Tests to Add:

**File:** `backend/src/__tests__/hyperframes-composition-generator.test.ts`
```typescript
describe("HyperFramesCompositionGenerator: Cinematic Authority", () => {
  describe("GSAP Motion Execution", () => {
    it("should emit GSAP timeline for whipIn preset", async () => { /* Design above */ });
    it("should emit GSAP timeline for arcRise preset", async () => { /* ... */ });
    it("should use speech rate to modulate stagger", async () => { /* ... */ });
    it("should NOT emit CSS @keyframes when GSAP is active", async () => { /* ... */ });
    it("should set gsapTimelineGenerated=true ONLY when GSAP is in HTML", async () => { /* ... */ });
  });
  
  describe("Motion Preset Selection", () => {
    it("should choose arcRise for luxury/premium style", async () => { /* ... */ });
    it("should choose whipIn for aggressive style", async () => { /* ... */ });
    it("should choose softSlideLeft for modern-authority", async () => { /* ... */ });
  });
});
```

**File:** `backend/src/__tests__/typography-authority.test.ts` (new file)
```typescript
describe("Typography Authority Enforcement", () => {
  describe("Font Resolution", () => {
    it("should hard-fail if premium fonts cannot be resolved with premium requested", async () => { /* ... */ });
    it("should load both Satoshi and Canela when available", async () => { /* ... */ });
    it("should normalize Windows paths to forward slashes for browser", async () => { /* ... */ });
  });
  
  describe("Font Proof", () => {
    it("should populate fontProof with exact files loaded", async () => { /* ... */ });
    it("should report zero fallback fonts when premium succeeds", async () => { /* ... */ });
    it("should include @font-face declarations in HTML", async () => { /* ... */ });
  });
});
```

**File:** `backend/src/__tests__/music-audio-authority.test.ts` (new file)
```typescript
describe("Audio Mix Authority", () => {
  describe("Ducking Enforcement", () => {
    it("should apply ducking to music during speech regions", async () => { /* Design above */ });
    it("should set duckingGainDb on affected cues", async () => { /* ... */ });
    it("should include ducking in FFmpeg filter graph", async () => { /* ... */ });
  });
  
  describe("SFX Timing", () => {
    it("should inject SFX 100ms before visual event", async () => { /* Design above */ });
    it("should NOT skip SFX when music is render-ready", async () => { /* ... */ });
  });
});
```

---

## PART 7: SUCCESS METRICS & FINAL READINESS CALCULATION

### Component Readiness (Post-Implementation):

| Component | Current | Phase A | Phase C | Phase B | Phase D | Target |
|-----------|---------|---------|---------|---------|---------|--------|
| Motion | 20% | 85% | 85% | 85% | 90% | 90%+ |
| Typography | 15% | 15% | 85% | 85% | 90% | 90%+ |
| Audio Design | 10% | 10% | 10% | 70% | 85% | 85%+ |
| Authority Enforce. | 40% | 50% | 60% | 70% | 95% | 95%+ |
| **Overall** | **32%** | **45%** | **65%** | **80%** | **90%** | **90%+** |

### Success Criteria (ALL must pass):
- [ ] Zero CSS @keyframes in premium composition output
- [ ] GSAP timeline present and functional in final HTML
- [ ] Both requested fonts loaded and rendered (not fallback)
- [ ] Audio mix rendered with ducking applied (not skipped)
- [ ] SFX injected into audio at visual event timing
- [ ] All diagnostics truthful (match actual output)
- [ ] No "fake premium" claims in diagnostics
- [ ] Style authority verified with zero deviations

### Iman Gadzhi Scale: **32% → 90%** ✓

---

## PART 8: CODEX EXECUTION CHECKLIST

### Before Starting:
- [ ] Read this entire document completely
- [ ] Do NOT modify any code yet
- [ ] Create a detailed implementation plan (design first, code after)
- [ ] Set up isolated test branches if modifying existing tests

### Phase A Execution:
- [ ] Audit hyperframes-composition-generator.ts for CSS patterns
- [ ] Design GSAP script generation function (pseudocode first)
- [ ] Design diagnostics truthfulness checks
- [ ] Write test cases (design, no run)
- [ ] Implement GSAP path (one commit per function)
- [ ] Verify no CSS @keyframes remain in premium path
- [ ] Verify diagnostics match output

### Phase C Execution:
- [ ] Audit font resolution path
- [ ] Fix Windows path separator bug
- [ ] Design hard-fail strategy for missing fonts
- [ ] Implement font loading validation in HTML
- [ ] Write test cases (design, no run)
- [ ] Verify premium fonts are loaded
- [ ] Verify diagnostics are accurate

### Phase B Execution:
- [ ] Audit current beat detection (placeholder evidence)
- [ ] Design audio analyzer abstraction layer
- [ ] Implement ducking region detection
- [ ] Implement SFX timing and injection
- [ ] Write test cases (design, no run)
- [ ] Verify audio renders (not skipped)
- [ ] Verify ducking and SFX in output

### Phase D Execution:
- [ ] Design style authority verification
- [ ] Implement material changes check
- [ ] Lock frontend to manifest authority
- [ ] Add diagnostics deviations reporting
- [ ] Write test cases (design, no run)
- [ ] Verify zero deviations for valid manifests

### Final Validation:
- [ ] All diagnostic signals present
- [ ] No fallback lies remain
- [ ] 90%+ readiness verified
- [ ] Next phase blockers documented

---

## PART 9: KNOWN BLOCKERS & WORKAROUNDS

### Blocker: Python librosa/Essentia not integrated
**Impact:** Beat detection still placeholder
**Workaround:** Design abstraction layer, stub implementation, Python can fill later
**Action:** Do NOT block Phase B on Python availability

### Blocker: Final MP4 export still uses FFmpeg drawtext
**Impact:** GSAP/premium typography doesn't bake into video
**Workaround:** Accept HTML preview as "cinematic proof", MP4 export remains mechanical fallback
**Action:** Document that final export is preview-only until browser-render-to-video pipeline exists

### Blocker: R2/remote music sources need local caching
**Impact:** Audio render blocked for cloud-sourced tracks
**Workaround:** Allow dry-run preview-only mode, require local file for render-ready
**Action:** Enforce license safety, don't bypass

### Blocker: Font manifests may be incomplete
**Impact:** Premium fonts requested but not in catalog
**Workaround:** Hard-fail with clear error message (don't silently fallback)
**Action:** Force user to ingest fonts into font-intelligence/outputs/

---

## PART 10: SUCCESS LOOKS LIKE

### After Phase A:
User renders premium composition → text WHIPS across screen with easing curves, NOT linear fade
HTML source shows `gsap.timeline` with actual preset names, ZERO CSS animations
Diagnostics truthfully report: `gsapTimelineGenerated: true, fallbackUsed: false`

### After Phase C:
User renders with premium pairing → text displays in Satoshi/Canela, NOT generic sans-serif
Font loading validation runs, all fonts present
Diagnostics truthfully report: `fontFilesLoadedIntoComposition: [Satoshi, Canela]`

### After Phase B:
User renders with background music → speech is ducked (music quieter during dialog)
Text SFX hits exactly when text animation lands
Diagnostics truthfully report: `audioMixRendered: true, duckingApplied: true, sfxApplied: true`

### After Phase D:
User requests "Iman-tier" style → all material changes verified present in output
Diagnostics: `materialChangesVerified: true, deviations: []`
Motion is premium, typography is premium, audio is premium → **not a lie**

### Final Result:
Prometheus produces premium cinematic video compositions that rival professional editors.
No fake placeholder behavior.
No fallback lies in diagnostics.
**Iman Gadzhi scale: 90%+ ✓**

---

## END OF EXHAUSTIVE BLUEPRINT

**For Codex:** This document is your complete specification. Implementation should follow this structure exactly. Do not deviate. The goal is 32% → 90% with zero fake premium behavior.

**For Humans:** This is the roadmap. Codex will execute Phase A-D in order. Expect substantial motion, typography, and audio improvements. Remaining 10% gap is architectural (MP4 baking, full Python bridge, real-time preview) and handled later.
