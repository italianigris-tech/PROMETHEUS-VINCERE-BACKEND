import {describe, expect, it} from 'vitest';
import type {
  CameraMove,
  JosephBackgroundPlan,
  JosephPiPPlan,
  JosephTypography,
  JosephTypographyIntelligencePlan,
  MicroAnimationSelection,
  TextOverlay,
} from '@prometheus/shared-types';
import {
  KNOWN_JOSEPH_MICRO_ANIMATION_IDS,
  resolveBackgroundRenderContract,
  resolveCameraRenderContract,
  resolveMicroAnimationRenderContract,
  resolvePiPRenderContract,
  resolveTypographyRenderContract,
} from '../joseph-render-contract';
import {applyMatteAlphaToRgba, resolveMatteRenderContract} from '../matte-render-contract';

const baseSelection = (primitiveId: string): MicroAnimationSelection => ({
  primitiveId,
  family: primitiveId.startsWith('text-emphasis.')
    ? 'text_emphasis'
    : primitiveId.startsWith('text-mutation.')
      ? 'text_mutation'
      : primitiveId.startsWith('accent-motion.')
        ? 'accent_motion'
        : primitiveId.startsWith('spatial-motion.')
          ? 'spatial_micro_motion'
          : 'text_entry',
  role: primitiveId.startsWith('text-emphasis.')
    ? 'emphasis'
    : primitiveId.startsWith('text-mutation.')
      ? 'mutation'
      : primitiveId.startsWith('accent-motion.')
        ? 'accent'
        : primitiveId.startsWith('spatial-motion.')
          ? 'spatial'
          : 'entry',
  renderFallback: 'slide_up',
  combinationGroup: primitiveId.includes('entry') ? 'entry' : 'emphasis-mark',
  semanticRole: primitiveId.includes('caption-rail') ? 'support' : 'hero',
  parameters: {
    intensity: 0.72,
    durationMs: 360,
    delayMs: 0,
    anchor: 'word',
    direction: 'up',
  },
});

const overlayFor = (primitiveId: string): TextOverlay => ({
  text: 'WIN NOW',
  startFrame: 10,
  endFrame: 40,
  animation: 'slide_up',
  color: '#FF0040',
  microAnimation: baseSelection(primitiveId),
});

const pipPlan: JosephPiPPlan = {
  version: 'joseph-pip-v1',
  layout: 'speaker_right_text_left',
  sourceTrackId: 'primary',
  subjectAnchor: {xPercent: 51, yPercent: 34, confidence: 0.82, source: 'heuristic'},
  frame: {
    leftPercent: 58,
    topPercent: 12,
    widthPercent: 34,
    heightPercent: 38,
    borderRadiusPx: 28,
    safeMarginPercent: 4,
    depth: 'foreground',
  },
  dockingPosition: 'upper_right',
  availableMotionBehaviors: ['enter', 'dock', 'expand', 'collapse', 'handoff'],
  activeMotion: [
    {behavior: 'enter', startFrame: 0, endFrame: 20, easing: 'ease_out'},
    {behavior: 'dock', startFrame: 21, endFrame: 60, easing: 'ease_in_out'},
  ],
  typographyZones: [
    {
      role: 'hero',
      leftPercent: 7,
      topPercent: 14,
      widthPercent: 43,
      heightPercent: 28,
      align: 'left',
      minClearancePercent: 6,
    },
  ],
  backgroundLayers: [
    {role: 'backplate', leftPercent: 54, topPercent: 8, widthPercent: 42, heightPercent: 46, intensity: 0.42},
    {role: 'asset_board', leftPercent: 6, topPercent: 54, widthPercent: 36, heightPercent: 28, intensity: 0.64},
    {role: 'focus_field', leftPercent: 52, topPercent: 7, widthPercent: 44, heightPercent: 48, intensity: 0.8},
  ],
  coexistenceRules: {
    preserveSubjectFocus: true,
    protectTypography: true,
    textClearancePercent: 6,
    backgroundDefocus: 0.42,
  },
};

const backgroundPlan: JosephBackgroundPlan = {
  version: 'joseph-background-v1',
  catalogVersion: '2026.06',
  selectedPrimitiveIds: [
    'shader.depth-vignette',
    'lightfield.cinematic-bloom',
    'particles.soft-ash',
  ],
  primitives: [
    {
      primitiveId: 'shader.depth-vignette',
      family: 'shader_background',
      role: 'background',
      layer: 'foundation',
      blendMode: 'normal',
      renderStrategy: 'curated_mesh',
      parameters: {
        colorFamily: 'cinematic_cool',
        speed: 0.18,
        noiseIntensity: 0.22,
        bloomIntensity: 0.18,
        distortionAmount: 0.08,
        contrast: 0.68,
        density: 0.42,
        opacity: 0.92,
      },
    },
    {
      primitiveId: 'lightfield.cinematic-bloom',
      family: 'abstract_light_field',
      role: 'atmosphere',
      layer: 'atmosphere',
      blendMode: 'screen',
      renderStrategy: 'curated_mesh',
      parameters: {
        colorFamily: 'electric_blue',
        speed: 0.28,
        noiseIntensity: 0.34,
        bloomIntensity: 0.48,
        distortionAmount: 0.16,
        contrast: 0.58,
        density: 0.52,
        opacity: 0.62,
      },
    },
    {
      primitiveId: 'particles.soft-ash',
      family: 'particle_atmosphere',
      role: 'accent',
      layer: 'accent',
      blendMode: 'soft_light',
      renderStrategy: 'curated_mesh',
      parameters: {
        colorFamily: 'warm_spotlight',
        speed: 0.22,
        noiseIntensity: 0.38,
        bloomIntensity: 0.24,
        distortionAmount: 0.12,
        contrast: 0.5,
        density: 0.72,
        opacity: 0.52,
      },
    },
  ],
  layeringRules: {
    sourceFootageMode: 'pip_protected',
    textProtection: 'contrast_and_clearance',
    pipProtection: 'reserved_safe_zone',
    overlayInteraction: 'accent_below_text',
    maxActivePrimitives: 2,
  },
  parameterAudit: {governed: true, clampedParameterCount: 0, warnings: []},
};

const manifestTypography: JosephTypography = {
  fontId: 'hero-berylium-regular',
  fontFamily: 'Prometheus Hero Berylium',
  fontAssetUrl: '/fonts/hero/berylium-rg-67d7e31492fa.otf',
  fallbackFamily: 'Arial, sans-serif',
};
const typographyPlan: JosephTypographyIntelligencePlan = {
  version: 'joseph-typography-v1',
  stylebookId: 'aggressive_authority',
  lexicalWeights: [],
  compositionRules: {
    caseStrategy: 'hero_upper_support_title',
    lineBreakStrategy: 'phrase_stack',
    contrastMode: 'hero_crimson_support_white',
    hierarchyScale: 1.32,
    fillerTreatment: 'suppress',
    maxWordsPerLine: 3,
  },
  lines: [
    {
      text: 'WIN NOW',
      role: 'hero',
      caseTreatment: 'uppercase',
      startFrame: 10,
      endFrame: 40,
      maxCharacters: 12,
      contrastColor: '#FF0040',
      hierarchyLevel: 1,
    },
    {
      text: 'with sharper rhythm',
      role: 'support',
      caseTreatment: 'sentence_case',
      startFrame: 10,
      endFrame: 40,
      maxCharacters: 28,
      contrastColor: '#FFFFFF',
      hierarchyLevel: 2,
    },
  ],
  fontPairing: {
    primary: {
      fontId: 'hero-berylium-regular',
      family: 'Prometheus Hero Berylium',
      source: 'custom_ingested',
      role: 'hero',
    },
    secondary: {
      fontId: 'support-fraunces-regular',
      family: 'Fraunces',
      source: 'custom_ingested',
      role: 'support',
    },
    graphUsed: true,
    pairingScore: 0.91,
    reason: 'Resolved role-based hero/support pairing through the font graph.',
  },
  roleStyles: [
    {
      role: 'hero',
      fontRole: 'hero',
      trackingEm: -0.045,
      weight: 820,
      hierarchyLevel: 1,
      hierarchyScale: 1.36,
      lineHeight: 0.94,
    },
    {
      role: 'support',
      fontRole: 'support',
      trackingEm: 0.08,
      weight: 520,
      hierarchyLevel: 2,
      hierarchyScale: 1,
      lineHeight: 1.08,
    },
  ],
  qualityAudit: {score: 0.94, failures: [], warnings: []},
};

describe('Joseph renderer manifest contract', () => {
  it('maps every curated Joseph micro-animation primitive to a render branch or governed fallback', () => {
    expect(KNOWN_JOSEPH_MICRO_ANIMATION_IDS).toHaveLength(15);

    for (const primitiveId of KNOWN_JOSEPH_MICRO_ANIMATION_IDS) {
      const contract = resolveMicroAnimationRenderContract({
        overlay: overlayFor(primitiveId),
        frame: 20,
        wordIndex: 0,
        wordCount: 2,
      });

      expect(contract.primitiveId).toBe(primitiveId);
      expect(contract.fallbackUsed).toBe(false);
      expect(contract.renderBranch).not.toBe('governed-fallback');
      expect(contract.transform.position[2]).toBeGreaterThanOrEqual(0.3);
      expect(contract.observable.opacity).toBeGreaterThan(0);
    }

    const fallback = resolveMicroAnimationRenderContract({
      overlay: {
        ...overlayFor('text-entry.unknown-future-primitive'),
        animation: 'glitch',
        microAnimation: {
          ...baseSelection('text-entry.unknown-future-primitive'),
          renderFallback: 'glitch',
        },
      },
      frame: 20,
      wordIndex: 0,
      wordCount: 2,
    });

    expect(fallback.fallbackUsed).toBe(true);
    expect(fallback.renderBranch).toBe('governed-fallback');
    expect(fallback.governedFallback).toBe('glitch');
  });

  it('turns PiP depth, matte, z-order, and populated layers into observable scene values', () => {
    const contract = resolvePiPRenderContract({plan: pipPlan, frame: 10});

    expect(contract.frame.depth).toBe('foreground');
    expect(contract.frame.sourceZ).toBeGreaterThan(0.5);
    expect(contract.frame.chromeZ).toBeGreaterThan(contract.frame.sourceZ);
    expect(contract.frame.matteOpacity).toBeGreaterThan(0.3);
    expect(contract.frame.cornerRadiusRatio).toBeGreaterThan(0);
    expect(contract.coexistence.protectTypography).toBe(true);
    expect(contract.layers.map((layer) => layer.role)).toEqual(['backplate', 'asset_board', 'focus_field']);
    expect(contract.layers[2]?.z).toBeGreaterThan(contract.layers[0]?.z ?? 0);
    expect(contract.motion.scale).toBeGreaterThan(0.96);
  });

  it('emits a governed matte fallback tag when the manifest has no matte asset', () => {
    const contract = resolveMatteRenderContract({
      jobId: 'job-missing-matte',
      source: {
        videoUrl: '/source.mp4',
        transcript: [],
        durationMs: 3000,
        width: 1080,
        height: 1920,
        fps: 30,
      },
      fps: 30,
      durationFrames: 90,
    });

    expect(contract.available).toBe(false);
    expect(contract.matteUrl).toBeNull();
    expect(contract.fallbackTags).toContain('compiler_matte_unavailable');
  });

  it('proves subject separation changes rendered source pixels through matte alpha', () => {
    const source = new Uint8ClampedArray([
      20, 40, 60, 255,
      80, 100, 120, 255,
      140, 160, 180, 255,
      200, 220, 240, 255,
    ]);
    const matte = new Uint8ClampedArray([
      255, 255, 255, 255,
      0, 0, 0, 255,
      128, 128, 128, 255,
      64, 64, 64, 255,
    ]);

    const flat = applyMatteAlphaToRgba({source});
    const separated = applyMatteAlphaToRgba({source, matte});

    expect(Array.from(separated)).not.toEqual(Array.from(flat));
    expect([separated[3], separated[7], separated[11], separated[15]]).toEqual([255, 0, 128, 64]);
  });
  it('tags protected PiP subject collisions from typography zones and high-risk camera motion', () => {
    const unsafePlan: JosephPiPPlan = {
      ...pipPlan,
      frame: {
        ...pipPlan.frame,
        leftPercent: 46,
        topPercent: 18,
        widthPercent: 38,
        heightPercent: 38,
        safeMarginPercent: 6,
      },
      typographyZones: [
        {
          role: 'hero',
          leftPercent: 42,
          topPercent: 16,
          widthPercent: 35,
          heightPercent: 22,
          align: 'left',
          minClearancePercent: 8,
        },
      ],
      coexistenceRules: {
        ...pipPlan.coexistenceRules,
        preserveSubjectFocus: true,
        protectTypography: true,
        textClearancePercent: 8,
      },
    };

    const contract = resolvePiPRenderContract({
      plan: unsafePlan,
      frame: 20,
      cameraMoves: [
        {type: 'shake', startFrame: 10, endFrame: 40, entryVelocity: 0.92, exitVelocity: 0.95},
      ],
    });

    expect(contract.clearance.protectedSubjectRect).toMatchObject({
      leftPercent: 38,
      topPercent: 10,
      widthPercent: 54,
      heightPercent: 54,
    });
    expect(contract.clearance.typographyZones[0]?.intersectsProtectedSubject).toBe(true);
    expect(contract.clearance.failureTags).toEqual(
      expect.arrayContaining([
        'pip_typography_subject_occlusion',
        'pip_camera_subject_focus_risk',
      ]),
    );
  });
  it('applies camera entry and exit velocity hints across the active move', () => {
    const move: CameraMove = {
      type: 'push_in',
      startFrame: 10,
      endFrame: 40,
      entryVelocity: 0.25,
      exitVelocity: 0.8,
    };

    const idle = resolveCameraRenderContract({cameraMoves: [move], frame: 0, seed: 7});
    const entry = resolveCameraRenderContract({cameraMoves: [move], frame: 10, seed: 7});
    const exit = resolveCameraRenderContract({cameraMoves: [move], frame: 40, seed: 7});

    expect(idle.activeMove).toBeNull();
    expect(entry.velocity.entryVelocity).toBe(0.25);
    expect(entry.velocity.currentVelocity).toBeCloseTo(0.25, 4);
    expect(exit.velocity.exitVelocity).toBe(0.8);
    expect(exit.velocity.currentVelocity).toBeCloseTo(0.8, 4);
    expect(exit.position[2]).toBeLessThan(entry.position[2]);
  });

  it('turns typography manifest fields into observable font output or explicit fallback', () => {
    const contract = resolveTypographyRenderContract(manifestTypography);

    expect(contract.fallbackUsed).toBe(false);
    expect(contract.fallbackReason).toBeNull();
    expect(contract.fontId).toBe('hero-berylium-regular');
    expect(contract.fontFamily).toBe('Prometheus Hero Berylium');
    expect(contract.fontAssetUrl).toBe('/fonts/hero/berylium-rg-67d7e31492fa.otf');
    expect(contract.observable.textFontFamily).toBe('Prometheus Hero Berylium');
    expect(contract.observable.fallbackFamily).toBe('Arial, sans-serif');
    expect(contract.observable.fontAssetUrl).toBe('/fonts/hero/berylium-rg-67d7e31492fa.otf');
    expect(contract.observable.renderOrder).toBe(40);

    const unsafe = resolveTypographyRenderContract({
      ...manifestTypography,
      fontAssetUrl: 'C:/unsafe/local-font.otf',
    });

    expect(unsafe.fallbackUsed).toBe(true);
    expect(unsafe.fallbackReason).toBe('local_font_asset_not_browser_safe');
    expect(unsafe.governedFallback.fontId).toBe('hero-berylium-regular');
    expect(unsafe.fontAssetUrl).toBe('/fonts/hero/berylium-rg-67d7e31492fa.otf');
  });

  it('turns role typography math into observable renderer styles', () => {
    const contract = resolveTypographyRenderContract(manifestTypography, typographyPlan);

    expect(contract.observable.roleStyles.hero).toMatchObject({
      fontFamily: 'Prometheus Hero Berylium',
      fontWeight: 820,
      letterSpacing: '-0.045em',
      lineHeight: 0.94,
      hierarchyScale: 1.36,
      renderOrder: 42,
    });
    expect(contract.observable.roleStyles.support).toMatchObject({
      fontFamily: 'Fraunces',
      fontWeight: 520,
      letterSpacing: '0.080em',
      lineHeight: 1.08,
      hierarchyScale: 1,
      renderOrder: 40,
    });
  });

  it('turns background primitive layering rules into bounded render layers', () => {
    const contract = resolveBackgroundRenderContract(backgroundPlan);

    expect(contract.layers).toHaveLength(2);
    expect(contract.layers.map((layer) => layer.primitiveId)).toEqual([
      'shader.depth-vignette',
      'lightfield.cinematic-bloom',
    ]);
    expect(contract.layers[0]?.z).toBeLessThan(contract.layers[1]?.z ?? 0);
    expect(contract.rules.sourceVideoOpacity).toBeLessThan(1);
    expect(contract.rules.contrastScrimOpacity).toBeGreaterThan(0);
    expect(contract.rules.reservePiPSafeZone).toBe(true);
    expect(contract.rules.accentRenderOrder).toBeLessThan(contract.rules.textRenderOrder);
  });

  it('is deterministic for identical manifest fields', () => {
    const left = {
      micro: resolveMicroAnimationRenderContract({overlay: overlayFor('text-emphasis.sweep-highlight'), frame: 18, wordIndex: 1, wordCount: 2}),
      pip: resolvePiPRenderContract({plan: pipPlan, frame: 18}),
      camera: resolveCameraRenderContract({cameraMoves: [{type: 'shake', startFrame: 12, endFrame: 30, entryVelocity: 0.6, exitVelocity: 0.4}], frame: 18, seed: 123}),
      background: resolveBackgroundRenderContract(backgroundPlan),
    };
    const right = {
      micro: resolveMicroAnimationRenderContract({overlay: overlayFor('text-emphasis.sweep-highlight'), frame: 18, wordIndex: 1, wordCount: 2}),
      pip: resolvePiPRenderContract({plan: pipPlan, frame: 18}),
      camera: resolveCameraRenderContract({cameraMoves: [{type: 'shake', startFrame: 12, endFrame: 30, entryVelocity: 0.6, exitVelocity: 0.4}], frame: 18, seed: 123}),
      background: resolveBackgroundRenderContract(backgroundPlan),
    };

    expect(right).toEqual(left);
  });
});
