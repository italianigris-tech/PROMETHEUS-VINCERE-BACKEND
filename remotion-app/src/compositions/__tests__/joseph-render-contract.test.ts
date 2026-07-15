import {describe, expect, it} from 'vitest';
import type {
  CameraMove,
  JosephBackgroundPlan,
  JosephMacroRigPlan,
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
  resolveKineticTextLayout,
  resolveMacroRigRenderContract,
  resolveMicroAnimationRenderContract,
  resolvePiPRenderContract,
  resolveSourcePresentationContract,
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
    {
      role: 'support',
      leftPercent: 8,
      topPercent: 45,
      widthPercent: 38,
      heightPercent: 18,
      align: 'left',
      minClearancePercent: 5,
    },
    {
      role: 'caption',
      leftPercent: 8,
      topPercent: 82,
      widthPercent: 42,
      heightPercent: 10,
      align: 'left',
      minClearancePercent: 4,
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

const macroRigPlan: JosephMacroRigPlan = {
  version: 'joseph-macro-rig-v1',
  rigId: 'talking-head-proof-data-exhibit',
  semanticTrigger: {
    valid: true,
    triggerKind: 'proof_data_exhibit',
    matchedSignals: ['proof', 'data', 'exhibit'],
    confidence: 0.91,
  },
  inputs: {
    sourceTrackId: 'primary',
    requiredSceneRoles: ['talking_head', 'proof', 'data_exhibit'],
    semanticSignals: ['proof', 'data', 'exhibit'],
  },
  sceneFacts: {
    momentKind: 'proof_data_exhibit',
    talkingHeadPresent: true,
    exhibitAnchors: ['proof', 'data', 'exhibit'],
    proofText: 'Proof data exhibit',
  },
  assetRequirements: [
    {
      role: 'speaker_source',
      required: true,
      acceptableFallback: 'omit_macro_rig',
      semanticNeed: 'Talking-head source track must be available.',
    },
    {
      role: 'exhibit_board',
      required: false,
      acceptableFallback: 'typography_only_exhibit',
      semanticNeed: 'Proof/data evidence needs a visible exhibit surface.',
    },
  ],
  renderFields: {
    pipPlan,
    typographySlots: [
      {role: 'proof_headline', text: 'PROOF', leftPercent: 7, topPercent: 14, widthPercent: 43, heightPercent: 12, zIndex: 42},
      {role: 'data_label', text: 'DATA', leftPercent: 8, topPercent: 45, widthPercent: 38, heightPercent: 10, zIndex: 41},
    ],
    assetPlacements: [
      {role: 'exhibit_board', leftPercent: 7, topPercent: 65, widthPercent: 39, heightPercent: 18, zIndex: 24},
    ],
  },
  failureFallbacks: [
    {
      tag: 'macro_rig_exhibit_asset_unavailable',
      reason: 'Use typography if no exhibit asset is resolved.',
      action: 'use_typography_only_exhibit',
    },
    {
      tag: 'macro_rig_semantic_trigger_missing',
      reason: 'Do not render the rig unless proof/data/exhibit semantics are present.',
      action: 'omit_macro_rig',
    },
  ],
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
      fontAssetUrl: '/fonts/hero/berylium-rg-67d7e31492fa.otf',
      source: 'custom_ingested',
      role: 'hero',
    },
    secondary: {
      fontId: 'support-fraunces-regular',
      family: 'Fraunces',
      fontAssetUrl: '/fonts/hero/goudybookletter1911-29a7765f69d5.otf',
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
    expect(fallback.failureTags).toEqual(['micro_animation_unsupported_variant']);
    expect(fallback.evidencePointer).toBe('render-contract://micro-animation/text-entry.unknown-future-primitive/fallback/glitch');
  });

  it('renders the top six premium primitives with individual observable contracts', () => {
    const topSix = [
      {primitiveId: 'text-emphasis.sweep-highlight', branch: 'sweep-highlight', accentKind: 'sweep'},
      {primitiveId: 'text-mutation.weight-escalation', branch: 'weight-escalation', accentKind: 'none'},
      {primitiveId: 'text-emphasis.capsule-highlight', branch: 'capsule-highlight', accentKind: 'capsule'},
      {primitiveId: 'text-entry.clipped-mask-reveal', branch: 'clipped-mask-reveal', accentKind: 'none'},
      {primitiveId: 'accent-motion.bracket-lock', branch: 'bracket-lock', accentKind: 'bracket'},
      {primitiveId: 'text-emphasis.semantic-glow', branch: 'semantic-glow', accentKind: 'glow'},
    ] as const;

    for (const fixture of topSix) {
      const first = resolveMicroAnimationRenderContract({
        overlay: overlayFor(fixture.primitiveId),
        frame: 24,
        wordIndex: 0,
        wordCount: 2,
      });
      const second = resolveMicroAnimationRenderContract({
        overlay: overlayFor(fixture.primitiveId),
        frame: 24,
        wordIndex: 0,
        wordCount: 2,
      });

      expect(first).toEqual(second);
      expect(first).toMatchObject({
        primitiveId: fixture.primitiveId,
        renderBranch: fixture.branch,
        fallbackUsed: false,
        failureTags: [],
        evidencePointer: `render-contract://micro-animation/${fixture.primitiveId}/${fixture.branch}`,
      });
      expect(first.observable.accentKind).toBe(fixture.accentKind);
      expect(first.transform.position[2]).toBeGreaterThanOrEqual(0.35);

      if (fixture.branch === 'weight-escalation') {
        expect(first.observable.fontSizeScale).toBeGreaterThan(1);
        expect(first.observable.renderOrder).toBe(42);
      } else if (fixture.branch === 'clipped-mask-reveal') {
        expect(first.observable.clipProgress).toBeGreaterThan(0);
        expect(first.transform.reveal).toBeGreaterThan(0);
      } else if (fixture.branch === 'semantic-glow') {
        expect(first.observable.glowOpacity).toBeGreaterThan(0);
      } else {
        expect(first.observable.accentOpacity).toBeGreaterThan(0);
      }
    }
  });

  it('turns PiP depth, matte, z-order, and populated layers into observable scene values', () => {
    const contract = resolvePiPRenderContract({
      plan: pipPlan,
      frame: 10,
      matte: {available: true, planeZ: 0.46, fallbackTags: []},
    });

    expect(contract.frame.depth).toBe('foreground');
    expect(contract.frame.sourceZ).toBeGreaterThan(0.5);
    expect(contract.frame.chromeZ).toBeGreaterThan(contract.frame.sourceZ);
    expect(contract.frame.matteOpacity).toBeGreaterThan(0.3);
    expect(contract.frame.cornerRadiusRatio).toBeGreaterThan(0);
    expect(contract.coexistence.protectTypography).toBe(true);
    expect(contract.layers.map((layer) => layer.role)).toEqual(['backplate', 'asset_board', 'focus_field']);
    expect(contract.layers[2]?.z).toBeGreaterThan(contract.layers[0]?.z ?? 0);
    expect(contract.motion.scale).toBeGreaterThan(0.96);
    expect(contract.compositor.subjectMatte).toMatchObject({
      available: true,
      alphaSource: 'rvm_matte',
      planeZ: 0.46,
      renderOrder: contract.frame.renderOrder,
    });
    expect(contract.compositor.visibleLayerOrder.map((layer) => layer.role)).toEqual([
      'backplate',
      'asset_board',
      'focus_field',
      'subject',
      'frame_chrome',
    ]);
    expect(contract.compositor.visibleLayerOrder.at(-1)).toMatchObject({
      role: 'frame_chrome',
      renderOrder: contract.frame.renderOrder + 1,
    });
  });

  it('proves 2.5D PiP compositor visibility changes with depth and matte choices', () => {
    const flatBackground = resolvePiPRenderContract({
      plan: {
        ...pipPlan,
        frame: {...pipPlan.frame, depth: 'background'},
      },
      frame: 18,
      matte: {available: false, fallbackTags: ['compiler_matte_unavailable']},
    });
    const matteForeground = resolvePiPRenderContract({
      plan: {
        ...pipPlan,
        frame: {...pipPlan.frame, depth: 'foreground'},
      },
      frame: 18,
      matte: {available: true, planeZ: 0.46, fallbackTags: []},
    });

    const flatSubject = flatBackground.compositor.visibleLayerOrder.find((layer) => layer.role === 'subject');
    const matteSubject = matteForeground.compositor.visibleLayerOrder.find((layer) => layer.role === 'subject');

    expect(matteForeground.frame.renderOrder).toBeGreaterThan(flatBackground.frame.renderOrder);
    expect(matteSubject?.z).toBeGreaterThan(flatSubject?.z ?? 0);
    expect(matteSubject?.respectsSubjectMatte).toBe(true);
    expect(flatSubject?.respectsSubjectMatte).toBe(false);
    expect(flatBackground.compositor.subjectMatte.alphaSource).toBe('flat_subject');
    expect(flatBackground.compositor.subjectMatte.fallbackTags).toContain('compiler_matte_unavailable');
    expect(matteForeground.compositor.depthSignature).not.toBe(flatBackground.compositor.depthSignature);
  });

  it('activates the macro-rig render contract only for a valid semantic trigger', () => {
    const active = resolveMacroRigRenderContract({macroRig: macroRigPlan, frame: 10});
    const inactive = resolveMacroRigRenderContract({
      macroRig: {
        ...macroRigPlan,
        semanticTrigger: {
          valid: false,
          triggerKind: 'proof_data_exhibit',
          matchedSignals: [],
          confidence: 0,
        },
      },
      frame: 10,
    });

    expect(active.active).toBe(true);
    expect(active.rigId).toBe('talking-head-proof-data-exhibit');
    expect(active.layers.map((layer) => layer.role)).toEqual(
      expect.arrayContaining(['speaker_pip', 'exhibit_board', 'proof_headline', 'data_label']),
    );
    expect(active.fallbackTags).toEqual(
      expect.arrayContaining(['macro_rig_exhibit_asset_unavailable', 'macro_rig_semantic_trigger_missing']),
    );
    expect(active.pixelProofSignature).toContain('talking-head-proof-data-exhibit:proof,data,exhibit');
    expect(inactive.active).toBe(false);
    expect(inactive.layers).toEqual([]);
    expect(inactive.fallbackTags).toContain('macro_rig_semantic_trigger_missing');
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
    expect(contract.compositor.failureTags).toEqual(contract.clearance.failureTags);
    expect(contract.compositor.depthSignature).toContain('subject');
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
      fontAssetUrl: '/fonts/hero/berylium-rg-67d7e31492fa.otf',
      fontWeight: 820,
      letterSpacing: '-0.045em',
      lineHeight: 0.94,
      hierarchyScale: 1.36,
      renderOrder: 42,
    });
    expect(contract.observable.roleStyles.support).toMatchObject({
      fontFamily: 'Fraunces',
      fontAssetUrl: '/fonts/hero/goudybookletter1911-29a7765f69d5.otf',
      fontWeight: 520,
      letterSpacing: '0.080em',
      lineHeight: 1.08,
      hierarchyScale: 1,
      renderOrder: 40,
    });
  });

  it('proves role typography changes rendered pixels through line-level render signatures', () => {
    const contract = resolveTypographyRenderContract(manifestTypography, typographyPlan, pipPlan);
    const heroLine = contract.observable.lines.find((line) => line.role === 'hero');
    const supportLine = contract.observable.lines.find((line) => line.role === 'support');

    expect(heroLine).toMatchObject({
      text: 'WIN NOW',
      fontFamily: 'Prometheus Hero Berylium',
      fontAssetUrl: '/fonts/hero/berylium-rg-67d7e31492fa.otf',
      fontWeight: 820,
      trackingEm: -0.045,
      letterSpacing: '-0.045em',
      renderOrder: 42,
      textClipped: false,
      intersectsProtectedSubject: false,
    });
    expect(supportLine).toMatchObject({
      text: 'with sharper rhythm',
      fontFamily: 'Fraunces',
      fontAssetUrl: '/fonts/hero/goudybookletter1911-29a7765f69d5.otf',
      fontWeight: 520,
      trackingEm: 0.08,
      letterSpacing: '0.080em',
      renderOrder: 40,
      textClipped: false,
      intersectsProtectedSubject: false,
    });
    expect(contract.observable.pixelProofSignature).toContain('hero:WIN NOW:Prometheus Hero Berylium:/fonts/hero/berylium-rg-67d7e31492fa.otf:820:-0.045');
    expect(contract.observable.pixelProofSignature).toContain('support:with sharper rhythm:Fraunces:/fonts/hero/goudybookletter1911-29a7765f69d5.otf:520:0.080');
    expect(contract.observable.readability.failureTags).toEqual([]);
  });

  it('catches typography clipping and PiP overlap through readability failure tags', () => {
    const unsafePlan: JosephTypographyIntelligencePlan = {
      ...typographyPlan,
      lines: [
        {
          ...typographyPlan.lines[0]!,
          text: 'WIN NOW WITH AN ABSURDLY LONG HERO LINE THAT CANNOT FIT',
          maxCharacters: 12,
        },
      ],
    };
    const unsafePipPlan: JosephPiPPlan = {
      ...pipPlan,
      typographyZones: [
        {
          ...pipPlan.typographyZones[0]!,
          leftPercent: 44,
          topPercent: 18,
          widthPercent: 34,
          heightPercent: 24,
          minClearancePercent: 8,
        },
      ],
    };

    const contract = resolveTypographyRenderContract(manifestTypography, unsafePlan, unsafePipPlan);

    expect(contract.observable.lines[0]?.textClipped).toBe(true);
    expect(contract.observable.lines[0]?.intersectsProtectedSubject).toBe(true);
    expect(contract.observable.readability.failureTags).toEqual(
      expect.arrayContaining(['typography_line_clipping', 'typography_pip_overlap']),
    );
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

  it('promotes a PiP plan to full-bleed source footage when no matte is available', () => {
    const contract = resolveSourcePresentationContract({
      pipPlan,
      matteAvailable: false,
      sourceVideoOpacity: 0.92,
    });

    expect(contract).toEqual({
      mode: 'full_bleed',
      frameRect: undefined,
      opacity: 1,
      showPiPScaffolding: false,
      fallbackTags: ['compiler_matte_unavailable', 'flat_pip_promoted_to_full_bleed'],
    });
  });

  it('fits animated hero text inside the visible portrait safe area', () => {
    const layout = resolveKineticTextLayout({
      text: 'Animations',
      viewportWidth: 2.33,
      viewportHeight: 4.14,
      preferredFontSize: 0.58,
      textScale: 1.4,
      trackingEm: 0,
      normalizedPosition: {x: 0.5, y: 0.15},
      motionPosition: [0, 0.9, 0.4],
    });
    const halfWidth = layout.renderedWidth / 2;
    const halfHeight = layout.renderedHeight / 2;

    expect(layout.renderedWidth).toBeLessThanOrEqual(layout.maxWidth);
    expect(layout.position[0] - halfWidth).toBeGreaterThanOrEqual(-2.33 / 2 + layout.safeMarginX);
    expect(layout.position[0] + halfWidth).toBeLessThanOrEqual(2.33 / 2 - layout.safeMarginX);
    expect(layout.position[1] - halfHeight).toBeGreaterThanOrEqual(-4.14 / 2 + layout.safeMarginY);
    expect(layout.position[1] + halfHeight).toBeLessThanOrEqual(4.14 / 2 - layout.safeMarginY);
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
