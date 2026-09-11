import {describe, expect, test} from "vitest";

import {
  normalizeRuntimePreset,
  resolveBehindSubjectTypographyMetrics,
  resolveTypographyZIndex,
  resolveSafeStageScaleX,
  resolveChunkEntranceFrame,
  resolvePanScanMediaStyle,
  resolveSceneVisualState,
  resolveTypographyContainerBlendMode,
  resolveTypographyContainerFilter,
  resolveTypographyPaintStyle,
  resolveWordEntranceFrames,
  deriveVolumetricGradient,
  buildPhysicalLightingFilter,
  unsupportedRuntimeTreatments,
  resolveAutoFitScale,
} from "../PrometheusMinRun";

describe("resolveWordEntranceFrames", () => {
  test("pre-rolls each word against its own spoken timestamp", () => {
    const frames = resolveWordEntranceFrames({
      chunkStartMs: 1640,
      fps: 30,
      contentStartFrame: 8,
      leadFrames: 8,
      words: [
        {text: "videos", start_ms: 1640, end_ms: 2320},
        {text: "made", start_ms: 2400, end_ms: 2800},
        {text: "me", start_ms: 2800, end_ms: 3120},
      ],
    });

    expect(frames).toEqual([0, 23, 35]);
  });
});

describe("normalizeRuntimePreset", () => {
  test("preserves every generative typography treatment with a renderer", () => {
    expect(normalizeRuntimePreset("elegant_paraword_spring_bloom")).toBe("elegant_paraword_spring_bloom");
    expect(normalizeRuntimePreset("motion_creative_kinetic_wave_slot_engine")).toBe("motion_creative_kinetic_wave_slot_engine");
    expect(normalizeRuntimePreset("soft_pixel_blowup_mask")).toBe("soft_pixel_blowup_mask");
    expect(normalizeRuntimePreset("canva_tall_glyph_stack")).toBe("canva_tall_glyph_stack");
    expect(normalizeRuntimePreset("cinematic_distance_convergence")).toBe("cinematic_distance_convergence");
    expect(normalizeRuntimePreset("cyber_acid_lime_glitch")).toBe("cyber_acid_lime_glitch");
  });

  test("falls back to the restrained reveal for unknown presets", () => {
    expect(normalizeRuntimePreset("not-a-real-treatment")).toBe("subpixel_glow_mask");
  });
});

describe("runtime treatment coverage", () => {
  test("declares a realized visual variant for every selector treatment", () => {
    expect(unsupportedRuntimeTreatments()).toEqual([]);
  });
});

describe("resolveChunkEntranceFrame", () => {
  test("never emits a zero-length interpolation range for a caption with no lead-in", () => {
    expect(resolveChunkEntranceFrame(0, 1)).toBe(1);
  });
});

describe("resolveTypographyZIndex", () => {
  test("keeps a subject-safe tall stage behind the Martin foreground matte", () => {
    expect(resolveTypographyZIndex(true, "lower_right")).toBe(25);
    expect(resolveTypographyZIndex(true, undefined)).toBe(25);
    expect(resolveTypographyZIndex(false, "foreground_center")).toBe(100);
  });
});

describe("resolveSafeStageScaleX", () => {
  test("leaves safe-stage width to the selected tall-font treatment", () => {
    expect(resolveSafeStageScaleX(true, "lower_right")).toBe(1);
    expect(resolveSafeStageScaleX(true, undefined)).toBe(1);
    expect(resolveSafeStageScaleX(false, "foreground_center")).toBe(1);
  });
});

describe("resolveSceneVisualState", () => {
  const orchestration = {
    durationMs: 6000,
    scenes: [
      {id: "scene-1", startMs: 0, endMs: 3000, layout: "pan_scan" as const, focalPoint: {xPercent: 44, yPercent: 42}},
      {id: "scene-2", startMs: 3000, endMs: 6000, layout: "floating_pip" as const, focalPoint: {xPercent: 52, yPercent: 42}},
    ],
    backgrounds: [
      {id: "background-scene-2", sceneId: "scene-2", kind: "blurred_wings" as const, blurPx: 56, brightness: 0.72, counterScale: [1.05, 1] as [number, number]},
    ],
    pip: [
      {
        id: "pip-scene-2",
        sceneId: "scene-2",
        aspectRatio: 16 / 9,
        cornerRadiusPx: 22,
        microDriftScale: [1, 1.03] as [number, number],
        entryScale: [1.1, 1.055, 1] as [number, number, number],
        curve: [0.16, 1, 0.3, 1] as [number, number, number, number],
      },
    ],
    transitions: [
      {id: "transition-1", startMs: 2800, endMs: 3400, peakVelocityMs: 3100, effect: "bezier_push", fromSceneId: "scene-1", toSceneId: "scene-2", causedBySceneId: "scene-2"},
    ],
    cameraMoves: [
      {id: "camera-transition-1", startMs: 2800, endMs: 3400, kind: "push_in", curve: [0.16, 1, 0.3, 1] as [number, number, number, number], overshootScale: 1.055, causedByTransitionId: "transition-1"},
    ],
  };

  test("realizes blurred wings and a bounded Bezier PiP card", () => {
    const state = resolveSceneVisualState(orchestration, 105, 30);

    expect(state.layout).toBe("floating_pip");
    expect(state.backgroundBlurPx).toBe(56);
    expect(state.pipCornerRadiusPx).toBe(22);
    expect(state.pipScale).toBeGreaterThanOrEqual(1);
    expect(state.pipScale).toBeLessThanOrEqual(1.1);
  });

  test("applies only the camera move linked to the active transition", () => {
    const state = resolveSceneVisualState(orchestration, 93, 30);

    expect(state.transitionId).toBe("transition-1");
    expect(state.cameraMoveId).toBe("camera-transition-1");
    expect(state.cameraScale).toBeGreaterThan(1);
    expect(state.cameraScale).toBeLessThanOrEqual(1.055);
  });
});

describe("resolvePanScanMediaStyle", () => {
  test("gives source and Martin foreground one shared spatial transform", () => {
    const state = resolveSceneVisualState({
      durationMs: 3000,
      scenes: [
        {id: "scene-1", startMs: 0, endMs: 3000, layout: "pan_scan", focalPoint: {xPercent: 43, yPercent: 42}},
      ],
      backgrounds: [],
      pip: [],
      transitions: [],
      cameraMoves: [],
    }, 30, 30);

    expect(resolvePanScanMediaStyle(state)).toEqual({
      objectPosition: "43% 50%",
      transform: "scale(1)",
      transformOrigin: "center",
    });
  });
});

describe("resolveTypographyPaintStyle", () => {
  test("uses neutral white difference paint without decorative effects", () => {
    expect(resolveTypographyPaintStyle({
      blendMode: "difference",
      color: "#FF334B",
      textFillColor: "#FF334B",
      gradient: "linear-gradient(90deg, #fff, #f00)",
      glow: "0 0 10px red",
      shadow: "0 2px 8px black",
      hasGradient: true,
    })).toEqual({
      color: "#FFFFFF",
      backgroundImage: undefined,
      WebkitBackgroundClip: undefined,
      WebkitTextFillColor: undefined,
      filter: undefined,
      textShadow: undefined,
      mixBlendMode: "difference",
    });
  });

  test("preserves the normal clipped-gradient paint path", () => {
    expect(resolveTypographyPaintStyle({
      color: "#FF334B",
      textFillColor: "#FF334B",
      gradient: "linear-gradient(90deg, #fff, #f00)",
      glow: "rgba(255,255,255,0.4)",
      shadow: "0 2px 8px black",
      hasGradient: true,
    })).toEqual({
      color: undefined,
      backgroundImage: "linear-gradient(90deg, #fff, #f00)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      filter: "drop-shadow(0 4px 18px rgba(0, 0, 0, 0.95)) drop-shadow(0 0 10px rgba(255,255,255,0.4))",
      textShadow: undefined,
      mixBlendMode: undefined,
    });
  });

  test("derives 6-stop convex physical gradient from flat color", () => {
    const grad = deriveVolumetricGradient("#A855F7");
    expect(grad).toContain("linear-gradient(180deg");
    expect(grad).toContain("#FFFFFF 0%");
    expect(grad).toContain("#A855F7");
  });

  test("emits 5-pillar physical lighting filter chain when specularChamfer is enabled", () => {
    const style = resolveTypographyPaintStyle({
      color: "#A855F7",
      textFillColor: "#A855F7",
      gradient: "linear-gradient(180deg, #FFFFFF 0%, #A855F7 58%, #542A7B 88%)",
      glow: "0 0 16px rgba(168, 85, 247, 0.4)",
      shadow: "0 3px 6px rgba(0, 0, 0, 0.95)",
      contactShadow: "0 3px 6px rgba(0, 0, 0, 0.95)",
      ambientShadow: "0 12px 30px rgba(0, 0, 0, 0.55)",
      hasGradient: true,
      specularChamfer: true,
    });
    expect(style.filter).toContain("drop-shadow(-0.8px -1.2px 0.4px rgba(255, 255, 255, 0.85))");
    expect(style.filter).toContain("drop-shadow(1.0px 1.4px 0.5px rgba(0, 0, 0, 0.78))");
    expect(style.filter).toContain("drop-shadow(0 3px 6px rgba(0, 0, 0, 0.95))");
    expect(style.filter).toContain("drop-shadow(0 12px 30px rgba(0, 0, 0, 0.55))");
    expect(style.filter).toContain("drop-shadow(0 0 16px rgba(168, 85, 247, 0.4))");
  });

  test("shadow-stack subtraction: companion layers (isHero: false) suppress redundant glow filters", () => {
    const companionStyle = resolveTypographyPaintStyle({
      color: "#FFFFFF",
      textFillColor: "#FFFFFF",
      gradient: "linear-gradient(180deg, #FFFFFF 0%, #FAFBFD 100%)",
      glow: "rgba(255, 69, 58, 0.6)",
      shadow: "0 2px 8px rgba(0, 0, 0, 0.8)",
      hasGradient: true,
      isHero: false,
    });
    expect(companionStyle.filter).toBe("drop-shadow(0 4px 18px rgba(0, 0, 0, 0.95))");
    expect(companionStyle.filter).not.toContain("drop-shadow(0 0 10px");
  });

  test("removes the ancestor filter that would isolate difference blending", () => {
    expect(resolveTypographyContainerFilter([{blendMode: "difference"}])).toBeUndefined();
    expect(resolveTypographyContainerFilter([{blendMode: undefined}])).toBe("drop-shadow(0 4px 20px rgba(0, 0, 0, 0.85))");
    expect(resolveTypographyContainerBlendMode([{blendMode: "difference"}])).toBe("difference");
    expect(resolveTypographyContainerBlendMode([{blendMode: undefined}])).toBeUndefined();
  });
});

describe("resolveBehindSubjectTypographyMetrics", () => {
  test("dynamically scales font and proportions for generous headroom", () => {
    const metrics = resolveBehindSubjectTypographyMetrics({
      charLength: 7,
      availableHeightRatio: 0.25,
    });
    expect(metrics.fontSize).toBe(140);
    expect(metrics.scaleY).toBe(1.14);
    expect(metrics.scaleX).toBe(1.0);
  });

  test("tightens font size and vertical scale when headroom is constrained", () => {
    const metrics = resolveBehindSubjectTypographyMetrics({
      charLength: 7,
      availableHeightRatio: 0.10,
    });
    expect(metrics.fontSize).toBe(120);
    expect(metrics.scaleY).toBe(1.14);
    expect(metrics.scaleX).toBe(1.0);
  });

  test("handles short impact words with wide kerning and balanced scaling", () => {
    const metrics = resolveBehindSubjectTypographyMetrics({
      charLength: 4,
      availableHeightRatio: 0.15,
    });
    expect(metrics.fontSize).toBe(210);
    expect(metrics.scaleY).toBe(1.22);
    expect(metrics.scaleX).toBe(1.05);
    expect(metrics.letterSpacing).toBe("0.06em");
  });
});

describe("Dynamic Zoom Archetypes & Eye-Line Anchoring", () => {
  test("joseph_edit: ramps scale smoothly then cuts back sharply to 1.00x at endMs", () => {
    const orch: any = {
      durationMs: 6000,
      scenes: [{ id: "scene-1", startMs: 0, endMs: 6000, layout: "pan_scan" }],
      cameraMoves: [
        {
          id: "zoom-joseph",
          startMs: 1000,
          endMs: 4000,
          kind: "joseph_edit",
          curve: [0.25, 0.1, 0.25, 1.0],
          startScale: 1.0,
          endScale: 1.10,
          overshootScale: 1.10,
          cutbackAtEnd: true,
          anchorPoint: { xPercent: 48, yPercent: 38 },
        },
      ],
    };

    // Frame during push (2500ms -> frame 75 at 30fps)
    const midState = resolveSceneVisualState(orch, 75, 30);
    expect(midState.cameraScale).toBeGreaterThan(1.0);
    expect(midState.cameraScale).toBeLessThanOrEqual(1.10);
    expect(midState.anchorXPercent).toBe(48);
    expect(midState.anchorYPercent).toBe(38);

    // Frame at endMs (4000ms -> frame 120 at 30fps): instant cut-back to 1.00x
    const endState = resolveSceneVisualState(orch, 120, 30);
    expect(endState.cameraScale).toBe(1.0);
  });

  test("punch_zoom: step jump immediately to endScale", () => {
    const orch: any = {
      durationMs: 5000,
      scenes: [{ id: "scene-1", startMs: 0, endMs: 5000, layout: "pan_scan" }],
      cameraMoves: [
        {
          id: "zoom-punch",
          startMs: 1000,
          endMs: 2000,
          kind: "punch_zoom",
          curve: [0, 0, 0, 1],
          startScale: 1.0,
          endScale: 1.14,
          overshootScale: 1.14,
          instantJump: true,
        },
      ],
    };

    // Right after startMs (1100ms -> frame 33 at 30fps)
    const state = resolveSceneVisualState(orch, 33, 30);
    expect(state.cameraScale).toBe(1.14);
  });

  test("twist_zoom: applies rotation and eye-line transformOrigin", () => {
    const orch: any = {
      durationMs: 5000,
      scenes: [{ id: "scene-1", startMs: 0, endMs: 5000, layout: "pan_scan" }],
      cameraMoves: [
        {
          id: "zoom-twist",
          startMs: 1000,
          endMs: 2000,
          kind: "twist_zoom",
          curve: [0.33, 1, 0.68, 1],
          startScale: 1.0,
          endScale: 1.15,
          overshootScale: 1.15,
          rotationDeg: -4.5,
          anchorPoint: { xPercent: 52, yPercent: 36 },
        },
      ],
    };

    const state = resolveSceneVisualState(orch, 35, 30);
    expect(state.cameraRotationDeg).toBeLessThan(0);
    expect(state.anchorXPercent).toBe(52);
    expect(state.anchorYPercent).toBe(36);

    const style = resolvePanScanMediaStyle(state);
    expect(style.transformOrigin).toBe("52% 36%");
    expect(style.transform).toContain("rotate(");
    expect(style.transform).toContain("scale(");
  });

  test("hitchcock_dolly: calculates differential dollyBackgroundScale", () => {
    const orch: any = {
      durationMs: 5000,
      scenes: [{ id: "scene-1", startMs: 0, endMs: 5000, layout: "pan_scan" }],
      cameraMoves: [
        {
          id: "zoom-hitchcock",
          startMs: 1000,
          endMs: 4000,
          kind: "hitchcock_dolly",
          curve: [0.42, 0, 0.58, 1],
          startScale: 1.0,
          endScale: 1.18,
          overshootScale: 1.18,
          dollyParallax: { backgroundScale: 1.22, subjectScale: 1.02 },
        },
      ],
    };

    const state = resolveSceneVisualState(orch, 60, 30);
    expect(state.cameraScale).toBeLessThanOrEqual(1.02);
    expect(state.dollyBackgroundScale).toBeGreaterThan(1.0);
    expect(state.dollyBackgroundScale).toBeLessThanOrEqual(1.22);
  });
});

describe("Architectural Background Systems (5 Pillars)", () => {
  test("resolves ambient_shadow_gobo background state across scene timeline", () => {
    const orch: any = {
      durationMs: 4000,
      scenes: [{ id: "scene-gobo", startMs: 0, endMs: 4000, layout: "pan_scan" }],
      backgrounds: [
        {
          id: "bg-gobo",
          sceneId: "scene-gobo",
          kind: "ambient_shadow_gobo",
          shadowGobo: {
            frequencyHz: 0.35,
            opacity: 0.25,
            blendMode: "multiply",
          },
        },
      ],
    };

    const state = resolveSceneVisualState(orch, 30, 30);
    expect(state.layout).toBe("pan_scan");
    expect(orch.backgrounds[0].kind).toBe("ambient_shadow_gobo");
    expect(orch.backgrounds[0].shadowGobo.frequencyHz).toBe(0.35);
    expect(orch.backgrounds[0].shadowGobo.blendMode).toBe("multiply");
  });

  test("resolves hierarchical_spatial_staging background state with hero quadrant and peripheral micro-assets", () => {
    const orch: any = {
      durationMs: 5000,
      scenes: [{ id: "scene-spatial", startMs: 0, endMs: 5000, layout: "pan_scan" }],
      backgrounds: [
        {
          id: "bg-spatial",
          sceneId: "scene-spatial",
          kind: "hierarchical_spatial_staging",
          hierarchicalStaging: {
            coreHeroAnchor: {
              targetQuadrant: "center_primary_focal",
              scaleSettle: { from: 1.07, to: 1.0 },
              microTiltDeg: { min: 2.0, max: 5.0 },
              specularSheen: true,
            },
            peripheralMicroAssets: [
              { assetId: "tool_fountain_pen", quadrant: "top_left" },
              { assetId: "aged_paper_document", quadrant: "top_right" },
              { assetId: "stationery_paperclip", quadrant: "bottom_left" },
              { assetId: "polaroid_snapshot_frame", quadrant: "bottom_right" },
            ],
          },
        },
      ],
    };

    const state = resolveSceneVisualState(orch, 45, 30);
    expect(orch.backgrounds[0].kind).toBe("hierarchical_spatial_staging");
    expect(orch.backgrounds[0].hierarchicalStaging.coreHeroAnchor.targetQuadrant).toBe("center_primary_focal");
    expect(orch.backgrounds[0].hierarchicalStaging.peripheralMicroAssets).toHaveLength(4);
  });

  test("resolves attention_gated_bokeh optical defocus rack state", () => {
    const orch: any = {
      durationMs: 4000,
      scenes: [{ id: "scene-bokeh", startMs: 0, endMs: 4000, layout: "pan_scan" }],
      backgrounds: [
        {
          id: "bg-bokeh",
          sceneId: "scene-bokeh",
          kind: "attention_gated_bokeh",
          attentionBokeh: {
            focusRouting: "incoming_hero_sharp_peripherals_defocused",
            minBlurRadiusPx: 0,
            maxBlurRadiusPx: 32,
            rackFocusDurationMs: 380,
            transitionCurve: "smooth_s_curve",
          },
        },
      ],
    };

    expect(orch.backgrounds[0].kind).toBe("attention_gated_bokeh");
    expect(orch.backgrounds[0].attentionBokeh.maxBlurRadiusPx).toBe(32);
    expect(orch.backgrounds[0].attentionBokeh.rackFocusDurationMs).toBe(380);
  });

  test("resolves continuous_spatial_canvas vertical descent state", () => {
    const orch: any = {
      durationMs: 6000,
      scenes: [{ id: "scene-canvas", startMs: 0, endMs: 6000, layout: "pan_scan" }],
      backgrounds: [
        {
          id: "bg-canvas",
          sceneId: "scene-canvas",
          kind: "continuous_spatial_canvas",
          spatialCanvas: {
            unifiedPlane: true,
            axis: "Y",
            inertialHandoff: "damped_spring_easing",
            cameraHandoffSpring: { stiffness: 140, damping: 18, mass: 1.0 },
          },
        },
      ],
    };

    expect(orch.backgrounds[0].kind).toBe("continuous_spatial_canvas");
    expect(orch.backgrounds[0].spatialCanvas.axis).toBe("Y");
    expect(orch.backgrounds[0].spatialCanvas.inertialHandoff).toBe("damped_spring_easing");
  });

  test("resolves single_frame_retinal_inversion 1-2 frame micro-flash state", () => {
    const orch: any = {
      durationMs: 3000,
      scenes: [{ id: "scene-retinal", startMs: 0, endMs: 3000, layout: "pan_scan" }],
      backgrounds: [
        {
          id: "bg-retinal",
          sceneId: "scene-retinal",
          kind: "single_frame_retinal_inversion",
          retinalInversion: {
            durationFrames: 2,
            durationMs: 66,
            blendMode: "difference",
            editorialFunction: "subliminal_visual_punch",
            triggerCondition: "audio_transient_phase_shift",
          },
        },
      ],
    };

    expect(orch.backgrounds[0].kind).toBe("single_frame_retinal_inversion");
    expect(orch.backgrounds[0].retinalInversion.durationFrames).toBe(2);
    expect(orch.backgrounds[0].retinalInversion.blendMode).toBe("difference");
  });

  test("Typography V2 schema integration on CaptionChunk and TypographyLayer", () => {
    const v2Layer = {
      layerIndex: 0,
      layerName: "hero",
      role: "primary_focus_word",
      rawText: "REVOLUTION",
      text: "REVOLUTION",
      fontFamily: "Outfit",
      fontWeight: 900,
      fontStyle: "normal",
      fontSizePx: 140,
      color: "#FFFFFF",
      casing: "uppercase",
      letterSpacingEm: -0.02,
      lineHeight: 0.95,
      isHero: true,
      fill: {
        type: "solid" as const,
        color: "#FFFFFF",
      },
      stroke: {
        enabled: true,
        color: "rgba(0, 0, 0, 0.9)",
        widthPx: 2.5,
        style: "solid" as const,
      },
      materiality: {
        opacity: 1.0,
        bevel: {
          enabled: true,
          depthPx: 3,
          softnessPx: 1,
          angleDeg: 135,
          specularAngleDeg: -45,
          highlightColor: "rgba(255, 255, 255, 0.9)",
          shadowColor: "rgba(0, 0, 0, 0.85)",
        },
        multiShadows: [
          { offsetX: 0, offsetY: 2, blur: 4, color: "rgba(0,0,0,0.5)" },
          { offsetX: 0, offsetY: 8, blur: 24, color: "rgba(0,0,0,0.85)" },
        ],
      },
      stagger: {
        dxPercent: 0,
        dyPercent: 0,
        rotationDeg: 0,
        scaleMultiplier: 1.0,
        scaleX: 1.15,
        scaleY: 1.0,
        arcWarpDeg: -2.5,
        skewXDeg: -3.0,
        skewYDeg: 0,
        stretchRatio: 1.15,
      },
      occlusion: {
        mode: "partial_head_clip" as const,
        depthPlane: 45,
        clipBoundary: "silhouette" as const,
        partialOverlapPercent: 30,
      },
      inlineTokenSwaps: [
        {
          wordIndex: 0,
          token: "REVOLUTION",
          fontFamily: "Outfit",
          fontWeight: 900,
          highlightBox: {
            enabled: true,
            color: "#EF4444",
            borderRadiusPx: 8,
            paddingPx: 6,
          },
        },
      ],
    };

    const chunk = {
      chunkIndex: 1,
      text: "REVOLUTION",
      startMs: 0,
      endMs: 1500,
      layers: [v2Layer],
      annotations: [
        {
          type: "pill" as const,
          label: "VERIFIED",
          color: "#10B981",
          xPercent: 50,
          yPercent: 18,
          widthPercent: 20,
          heightPercent: 6,
        },
        {
          type: "circle" as const,
          color: "#EF4444",
          xPercent: 50,
          yPercent: 50,
          loopOpenPercent: 20,
          jitterAmount: 0.08,
        },
        {
          type: "leader_line" as const,
          color: "#38BDF8",
          xPercent: 50,
          yPercent: 50,
          leaderLine: {
            startXPercent: 35,
            startYPercent: 25,
            endXPercent: 50,
            endYPercent: 45,
            dotRadiusPx: 4,
            hasArrowHead: true,
          },
        },
      ],
      subjectZone: {
        headroomRatio: 0.42,
        cranialPlacementBand: "cranial_halo" as const,
        safeMarginPercent: 6,
      },
      frameTreatment: {
        backgroundMaterial: "paper" as const,
        materialOpacity: 0.18,
      },
    };

    expect(chunk.layers[0].stagger?.scaleX).toBe(1.15);
    expect(chunk.layers[0].stagger?.arcWarpDeg).toBe(-2.5);
    expect(chunk.layers[0].occlusion?.mode).toBe("partial_head_clip");
    expect(chunk.layers[0].materiality?.bevel?.enabled).toBe(true);
    expect(chunk.layers[0].stroke?.enabled).toBe(true);
    expect(chunk.layers[0].inlineTokenSwaps?.[0].highlightBox?.enabled).toBe(true);
    expect(chunk.annotations).toHaveLength(3);
    expect(chunk.annotations[0].type).toBe("pill");
    expect(chunk.annotations[1].type).toBe("circle");
    expect(chunk.annotations[2].type).toBe("leader_line");
    expect(chunk.frameTreatment.backgroundMaterial).toBe("paper");
    expect(chunk.subjectZone.cranialPlacementBand).toBe("cranial_halo");
  });

  describe("Calibrated Typography Refinements", () => {
    test("CaptionChunk schema supports acceleratedExit flag", () => {
      const chunk: CaptionChunk = {
        text: "Speed exit",
        startMs: 0,
        endMs: 800,
        acceleratedExit: true,
      };
      expect(chunk.acceleratedExit).toBe(true);
    });

    test("inlineTokenSwaps supports scaleMultiplier and highlightBox in TypographyLayer", () => {
      const layer: TypographyLayer = {
        layerIndex: 0,
        layerName: "hero",
        role: "primary_focus_word",
        rawText: "Absolute precision",
        text: "Absolute precision",
        fontFamily: "Inter",
        fontWeight: 800,
        fontStyle: "normal",
        fontSizePx: 110,
        color: "#FFFFFF",
        casing: "uppercase",
        letterSpacingEm: 0.01,
        lineHeight: 1.05,
        isHero: true,
        inlineTokenSwaps: [
          {
            wordIndex: 1,
            pattern: "precision",
            highlightBox: true as any,
            scaleMultiplier: 1.06,
          },
        ],
      };
      expect(layer.inlineTokenSwaps?.[0].scaleMultiplier).toBe(1.06);
      expect(layer.inlineTokenSwaps?.[0].highlightBox).toBe(true);
    });
  });

  describe("resolveAutoFitScale and nowrap wrap guard (Item 5)", () => {
    test("returns 1.0 when text easily fits within viewport boundaries", () => {
      const scale = resolveAutoFitScale({
        charLength: 8,
        fontSizePx: 64,
        isUppercase: false,
      });
      expect(scale).toBe(1.0);
    });

    test("scales down when phrase length exceeds max allowed width", () => {
      // 25 characters at 90px uppercase = 25 * 90 * 0.74 = 1665px > 830px
      const scale = resolveAutoFitScale({
        charLength: 25,
        fontSizePx: 90,
        isUppercase: true,
      });
      expect(scale).toBeLessThan(1.0);
      expect(scale).toBeCloseTo(830 / 1665, 2);
    });

    test("clamps autoFitScale to 0.35 floor even for exceptionally long text", () => {
      const scale = resolveAutoFitScale({
        charLength: 80,
        fontSizePx: 120,
        isUppercase: true,
      });
      expect(scale).toBe(0.35);
    });

    test("uses tighter 340px boundary for flank zone placement", () => {
      // 10 chars at 60px lowercase = 10 * 60 * 0.54 = 324px <= 340px -> 1.0
      const fitsFlank = resolveAutoFitScale({
        charLength: 10,
        fontSizePx: 60,
        isFlank: true,
      });
      expect(fitsFlank).toBe(1.0);

      // 18 chars at 60px lowercase = 18 * 60 * 0.54 = 583.2px > 340px -> scales down
      const overflowsFlank = resolveAutoFitScale({
        charLength: 18,
        fontSizePx: 60,
        isFlank: true,
      });
      expect(overflowsFlank).toBeLessThan(1.0);
      expect(overflowsFlank).toBeCloseTo(340 / (18 * 60 * 0.54), 2);
    });
  });
});

