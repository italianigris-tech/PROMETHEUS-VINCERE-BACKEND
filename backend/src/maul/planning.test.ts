import {describe, expect, it} from "vitest";

import {
  MAUL_V3_NATIVE_RENDER_BRANCHES,
  adaptMaulLegacyPlanningBundleV1,
  assertMaulV3TextAnimationReferences,
  buildMaulPlanningBundlePayload,
  buildMaulManifestReplayKey,
  buildMaulManifestPlanExecution,
  buildMaulPlanningPayloads,
  buildMaulTextAnimationPlanPayload,
  hashMaulPlanPayload,
  mapMaulSourceMsToOutput,
  mapMaulTranscriptWordsToOutput,
} from "./planning.js";

const sha = (character: string) => character.repeat(64);

describe("MAUL planning timestamp mapping", () => {
  it("applies the timestamp-map scale for non-1x kept segments", () => {
    expect(
      mapMaulSourceMsToOutput(
        [
          {
            sourceStartMs: 0,
            sourceEndMs: 1000,
            outputStartMs: 0,
            outputEndMs: 500,
            mode: "keep",
          },
        ],
        750,
      ),
    ).toBe(375);
  });

  it("does not map source time inside a cut", () => {
    expect(
      mapMaulSourceMsToOutput(
        [
          {
            sourceStartMs: 1000,
            sourceEndMs: 1500,
            outputStartMs: 500,
            outputEndMs: 500,
            mode: "cut",
          },
        ],
        1200,
      ),
    ).toBeNull();
  });

  it("rejects malformed legacy transcript words instead of silently dropping them", () => {
    expect(() =>
      mapMaulTranscriptWordsToOutput({
        timestampMap: [
          {
            sourceStartMs: 0,
            sourceEndMs: 1000,
            outputStartMs: 0,
            outputEndMs: 1000,
            mode: "keep",
          },
        ],
        words: [
          {text: "Valid", startMs: 0, endMs: 300, confidence: 0.99},
          {text: "", startMs: 320, endMs: 500, confidence: 0.99},
        ],
      }),
    ).toThrow(/word 1.*empty|empty.*word 1/i);
  });

  it("preserves a word portion that remains before a source cut", () => {
    expect(
      mapMaulTranscriptWordsToOutput({
        timestampMap: [
          {
            sourceStartMs: 0,
            sourceEndMs: 500,
            outputStartMs: 0,
            outputEndMs: 500,
            mode: "keep",
          },
          {
            sourceStartMs: 500,
            sourceEndMs: 700,
            outputStartMs: 500,
            outputEndMs: 500,
            mode: "cut",
          },
          {
            sourceStartMs: 700,
            sourceEndMs: 1000,
            outputStartMs: 500,
            outputEndMs: 800,
            mode: "keep",
          },
        ],
        words: [{
          transcriptWordIndex: 11,
          text: "straddles",
          startMs: 450,
          endMs: 550,
          confidence: 0.99,
        }],
      }),
    ).toEqual([
      expect.objectContaining({
        transcriptWordIndex: 11,
        sourceStartMs: 450,
        sourceEndMs: 550,
        startMs: 450,
        endMs: 500,
        outputSpans: [{outputStartMs: 450, outputEndMs: 500}],
      }),
    ]);
  });

  it("keeps one logical word with multiple output spans when a cut crosses it", () => {
    const mapped = mapMaulTranscriptWordsToOutput({
        timestampMap: [
          {
            sourceStartMs: 0,
            sourceEndMs: 500,
            outputStartMs: 0,
            outputEndMs: 500,
            mode: "keep",
          },
          {
            sourceStartMs: 500,
            sourceEndMs: 700,
            outputStartMs: 500,
            outputEndMs: 500,
            mode: "cut",
          },
          {
            sourceStartMs: 700,
            sourceEndMs: 1000,
            outputStartMs: 500,
            outputEndMs: 800,
            mode: "keep",
          },
        ],
        words: [{
          transcriptWordIndex: 12,
          text: "straddles",
          startMs: 450,
          endMs: 750,
          confidence: 0.99,
        }],
      });

    expect(mapped).toHaveLength(1);
    expect(mapped[0]).toEqual(
      expect.objectContaining({
        transcriptWordIndex: 12,
        sourceStartMs: 450,
        sourceEndMs: 750,
        startMs: 450,
        endMs: 550,
        outputSpans: [
          {outputStartMs: 450, outputEndMs: 500},
          {outputStartMs: 500, outputEndMs: 550},
        ],
      }),
    );
  });
});

describe("MAUL legacy planning adapter", () => {
  it("projects an unchanged V1 bundle through an explicit padded placement", () => {
    const planBase = {
      sourceAssetId: "artifact_source",
      analysisArtifactId: "artifact_analysis",
      timelineArtifactId: "artifact_timeline",
      candidateArtifactId: "artifact_candidate",
      treatmentGenomeArtifactId: "artifact_treatment",
      planVersion: "fixture/v1",
      replayKey: sha("1"),
      authority: {
        authorityClass: "deterministic",
        stageId: "fixture_stage",
        confidence: 1,
        inferenceReceiptId: null,
      },
      warnings: [],
      fallbacks: [{condition: "Missing V2 plan.", action: "Adapt V1.", status: "available"}],
    } as const;
    const textChunkPlan = {
      schemaVersion: "maul-shorts-text-chunk-plan/v1",
      transcriptHash: sha("a"),
      videoDurationMs: 1000,
      pacing: "measured",
      style: "editorial",
      strategy: "deterministic_fallback",
      chunks: [{
        chunkId: "chunk_legacy",
        startWordIndex: 0,
        endWordIndex: 0,
        wordCount: 1,
        text: "Legacy",
        startMs: 0,
        endMs: 1000,
        semanticRole: "proof",
        emphasis: {wordIndices: [0], text: "Legacy", level: "key"},
        rationale: "Preserve the legacy token.",
        confidence: 1,
      }],
      coverage: {totalWordCount: 1, coveredWordCount: 1, omittedWordIndices: [], duplicatedWordIndices: [], exact: true},
      inference: {
        status: "skipped_missing_credentials",
        provider: "openai_compatible",
        baseUrl: "https://example.com/v1",
        model: "fixture-model",
        requestHash: null,
        responseHash: null,
        fallbackReason: "Fixture uses deterministic fallback.",
      },
      validationFindings: [],
    } as const;
    const planningBundle = {
      ...planBase,
      schemaVersion: "maul-planning-bundle/v1",
      planArtifactIds: {
        observationSnapshot: "observation",
        candidateNarrative: "narrative",
        beatMap: "beat",
        typographyMotion: "typography",
        camera: "camera",
        visual: "visual",
        audio: "audio",
        capabilitySelection: "capability",
        adapterDecision: "adapter",
        artDirection: "art",
        contextAssembly: "context",
        shotIntentMatrix: "shot",
        textOpportunity: "opportunity",
        revision: "revision",
      },
      rendererReadiness: "governed_with_explicit_fallbacks",
      blockingReasons: [],
    } as const;
    const typographyMotion = {
      ...planBase,
      schemaVersion: "maul-typography-motion-plan/v1",
      textChunkPlan,
      textChunkAuthority: {
        authorityClass: "governed_fallback",
        decisionScope: "semantic_boundaries_roles_and_emphasis_only",
        decisionFields: [
          "textChunkPlan.chunks[].startWordIndex",
          "textChunkPlan.chunks[].endWordIndex",
          "textChunkPlan.chunks[].semanticRole",
          "textChunkPlan.chunks[].emphasis.wordIndices",
          "textChunkPlan.chunks[].emphasis.level",
        ],
        inferenceReceiptPath: "textChunkPlan.inference",
      },
      captionGroups: [{text: "Legacy", outputStartMs: 0, outputEndMs: 1000, sourceGrounded: true, role: "dialogue_caption"}],
      editorialStatements: [],
      editorialTextWithheldReason: "Legacy adapter creates no editorial copy.",
      fontResolution: {requestedRole: "utility", selectedFamily: "Arial", selectedAssetId: null, status: "governed_fallback", reason: "Legacy font resolution."},
      motionPrograms: [],
    } as const;

    const adapted = adaptMaulLegacyPlanningBundleV1({
      planningBundle,
      typographyMotion,
      mappedWords: [{
        transcriptWordIndex: 9,
        text: "Legacy",
        confidence: 1,
        sourceStartMs: 0,
        sourceEndMs: 1000,
        outputSpans: [{outputStartMs: 0, outputEndMs: 1000}],
        startMs: 0,
        endMs: 1000,
      }],
      editorialTimeline: {outputDurationMs: 1000},
    });

    expect(adapted.adapterProvenance).toEqual({
      adapterId: "adapt-maul-legacy-planning-bundle-v1",
      sourceSchemaVersion: "maul-planning-bundle/v1",
      mode: "explicit_conservative_projection",
    });
    expect(adapted.textChunkPlan.tokens[0]).toEqual(
      expect.objectContaining({transcriptWordIndex: 9, text: "Legacy"}),
    );
    expect(adapted.textPlacementPlan).toEqual(
      expect.objectContaining({
        status: "planned",
        segments: [
          expect.objectContaining({
            selectedCompositionVariantId: "caption_safe_fallback",
            variantId: "caption_safe_fallback.padded_band_v1",
            fallbackCode: "caption_safe_fallback",
          }),
        ],
      }),
    );
  });
});

describe("MAUL V3 text animation planning", () => {
  const treatmentArtifact = {
    artifactId: "artifact_treatment",
    payload: {treatmentId: "minimal_expert", replayKey: sha("2")},
  };
  const inputs = {
    source: {artifactId: "artifact_source", payload: {sha256: sha("1")}},
    analysis: {artifactId: "artifact_analysis"},
    timeline: {artifactId: "artifact_timeline"},
    candidate: {artifactId: "artifact_candidate"},
    treatment: treatmentArtifact,
    textChunkPlan: null,
  } as never;
  const textChunkPlan = {
    tokens: [
      {tokenId: "token_a"},
      {tokenId: "token_b"},
    ],
    chunks: [
      {
        chunkId: "chunk_a",
        tokenIds: ["token_a", "token_b"],
        emphasis: {tokenIds: ["token_b"]},
      },
    ],
  } as never;
  const textPlacementPlan = {
    segments: [
      {
        segmentId: "placement_a",
        chunkId: "chunk_a",
        tokenIds: ["token_a", "token_b"],
        outputStartMs: 100,
        outputEndMs: 1100,
      },
    ],
  } as never;
  const textChunkPlanHash = hashMaulPlanPayload(textChunkPlan);
  const textPlacementPlanHash = hashMaulPlanPayload(textPlacementPlan);
  const textChunkArtifact = {
    artifactId: "artifact_text_chunk",
    payload: textChunkPlan,
  } as any;
  const textPlacementArtifact = {
    artifactId: "artifact_text_placement",
    payload: textPlacementPlan,
  } as any;
  const references = {
    textChunkPlanArtifactId: textChunkArtifact.artifactId,
    textChunkPlanHash,
    textPlacementPlanArtifactId: textPlacementArtifact.artifactId,
    textPlacementPlanHash,
  };

  it.each(["fade_rise", "keyword_pop", "continuous_push"] as const)(
    "builds an explicit %s entry, hold, and exit program",
    (treatment) => {
      const plan = buildMaulTextAnimationPlanPayload({
        inputs,
        textChunkPlan: textChunkArtifact,
        textPlacementPlan: textPlacementArtifact,
        treatment,
        outputDurationMs: 1200,
      });

      expect(plan.schemaVersion).toBe("maul-text-animation-plan/v1");
      expect(plan).toMatchObject({
        textChunkPlanArtifactId: textChunkArtifact.artifactId,
        textChunkPlanHash,
        textPlacementPlanArtifactId: textPlacementArtifact.artifactId,
        textPlacementPlanHash,
      });
      expect(plan.programs[0]).toMatchObject({
        treatment,
        target: {
          placementSegmentId: "placement_a",
          tokenIds: treatment === "keyword_pop" ? ["token_b"] : ["token_a", "token_b"],
          scope: treatment === "keyword_pop" ? "tokens" : "segment",
        },
      });
      expect([
        plan.programs[0]!.phases.entry.easing,
        plan.programs[0]!.phases.hold.easing,
        plan.programs[0]!.phases.exit.easing,
      ]).toEqual([
        expect.objectContaining({type: expect.any(String)}),
        expect.objectContaining({type: expect.any(String)}),
        expect.objectContaining({type: expect.any(String)}),
      ]);
    },
  );

  it("makes keyword scale peak then settle and continuous push monotonic", () => {
    const keyword = buildMaulTextAnimationPlanPayload({
      inputs,
      textChunkPlan: textChunkArtifact,
      textPlacementPlan: textPlacementArtifact,
      treatment: "keyword_pop",
      outputDurationMs: 1200,
    }).programs[0]!;
    expect(keyword.phases.entry.to.scale).toBeGreaterThan(1);
    expect(keyword.phases.hold.to.scale).toBe(1);

    const push = buildMaulTextAnimationPlanPayload({
      inputs,
      textChunkPlan: textChunkArtifact,
      textPlacementPlan: textPlacementArtifact,
      treatment: "continuous_push",
      outputDurationMs: 1200,
    }).programs[0]!;
    expect([
      push.phases.entry.from.translateXPx,
      push.phases.entry.to.translateXPx,
      push.phases.hold.to.translateXPx,
      push.phases.exit.to.translateXPx,
    ]).toEqual([...[
      push.phases.entry.from.translateXPx,
      push.phases.entry.to.translateXPx,
      push.phases.hold.to.translateXPx,
      push.phases.exit.to.translateXPx,
    ]].sort((left, right) => left - right));
  });


  it("gives the core word a restrained second treatment without breaking its supporting phrase", () => {
    const options = {
      inputs,
      textChunkPlan: textChunkArtifact,
      textPlacementPlan: textPlacementArtifact,
      selectionSeed: "maul-editorial-variation-proof",
      outputDurationMs: 1200,
    };

    const first = buildMaulTextAnimationPlanPayload(options);
    const second = buildMaulTextAnimationPlanPayload(options);

    expect(first.programs).toEqual(second.programs);
    expect(first.programs).toHaveLength(2);
    expect(first.programs[0]).toMatchObject({
      target: {
        placementSegmentId: "placement_a",
        scope: "segment",
        tokenIds: ["token_a", "token_b"],
      },
    });
    expect(first.programs[1]).toMatchObject({
      target: {
        placementSegmentId: "placement_a",
        scope: "tokens",
        tokenIds: ["token_b"],
      },
    });
    expect(first.programs[1]!.treatment).not.toBe(first.programs[0]!.treatment);
  });

  it("builds the 17-artifact V3 bundle without registering audio treatment", () => {
    const planArtifactIds = {
      observationSnapshot: "observation",
      candidateNarrative: "narrative",
      beatMap: "beat",
      typographyMotion: "typography",
      camera: "camera",
      visual: "visual",
      audio: "audio",
      capabilitySelection: "capability",
      adapterDecision: "adapter",
      artDirection: "art",
      contextAssembly: "context",
      shotIntentMatrix: "shot",
      textOpportunity: "opportunity",
      revision: "revision",
      textChunk: "text_chunk",
      textPlacement: "text_placement",
      textAnimation: "text_animation",
    } as const;

    const bundle = buildMaulPlanningBundlePayload({
      inputs,
      planArtifactIds,
    });

    expect(bundle.schemaVersion).toBe("maul-planning-bundle/v3");
    expect(Object.keys(bundle.planArtifactIds)).toEqual([
      "observationSnapshot",
      "candidateNarrative",
      "beatMap",
      "typographyMotion",
      "camera",
      "visual",
      "audio",
      "capabilitySelection",
      "adapterDecision",
      "artDirection",
      "contextAssembly",
      "shotIntentMatrix",
      "textOpportunity",
      "revision",
      "textChunk",
      "textPlacement",
      "textAnimation",
    ]);
    expect(new Set(Object.values(bundle.planArtifactIds)).size).toBe(17);
    expect(bundle.planArtifactIds).not.toHaveProperty("audioTreatment");

    const changedBundle = buildMaulPlanningBundlePayload({
      inputs,
      planArtifactIds: {...planArtifactIds, textAnimation: "text_animation_b"},
    });
    expect(changedBundle.replayKey).not.toBe(bundle.replayKey);
  });

  it("preserves legacy replay preimages and binds V3 render-affecting plans", () => {
    const replayInputs = {
      sourceSha256: sha("1"),
      timelineReplay: [{sourceStartMs: 0, outputStartMs: 0}],
      treatmentReplayKey: sha("2"),
      planningBundleReplayKey: sha("3"),
      textChunkPlan: {chunks: ["proof"]},
      textPlacementPlan: {segments: ["center"]},
      typographyMotionPlan: {font: "Inter"},
      textAnimationPlan: null,
      audioPlanId: "audio_plan",
      musicTrackId: "music_track",
      sfx: [["sfx_a", 240] as const],
    };
    const legacyExpected = hashMaulPlanPayload({
      sourceSha256: replayInputs.sourceSha256,
      timelineReplay: replayInputs.timelineReplay,
      treatmentReplayKey: replayInputs.treatmentReplayKey,
      planningBundleReplayKey: replayInputs.planningBundleReplayKey,
      textChunkPlanHash: hashMaulPlanPayload(replayInputs.textChunkPlan),
      textPlacementPlanHash: hashMaulPlanPayload(
        replayInputs.textPlacementPlan,
      ),
      audioPlanId: replayInputs.audioPlanId,
      musicTrackId: replayInputs.musicTrackId,
      sfx: replayInputs.sfx,
    });

    expect(
      buildMaulManifestReplayKey({
        ...replayInputs,
        schemaVersion: "maul-planning-bundle/v1",
      }),
    ).toBe(legacyExpected);
    expect(
      buildMaulManifestReplayKey({
        ...replayInputs,
        schemaVersion: "maul-planning-bundle/v2",
      }),
    ).toBe(legacyExpected);

    const v3Inputs = {
      ...replayInputs,
      schemaVersion: "maul-planning-bundle/v3" as const,
      textAnimationPlan: {programs: ["fade_rise"]},
    };
    const replayKey = buildMaulManifestReplayKey(v3Inputs);
    expect(
      buildMaulManifestReplayKey({
        ...v3Inputs,
        typographyMotionPlan: {font: "Roboto"},
      }),
    ).not.toBe(replayKey);
    expect(
      buildMaulManifestReplayKey({
        ...v3Inputs,
        textAnimationPlan: {programs: ["continuous_push"]},
      }),
    ).not.toBe(replayKey);
  });

  it("rejects a stale animation artifact hash before manifest compilation", () => {
    const animationPayload = buildMaulTextAnimationPlanPayload({
      inputs,
      textChunkPlan: textChunkArtifact,
      textPlacementPlan: textPlacementArtifact,
      treatment: "fade_rise",
      outputDurationMs: 1200,
    });
    const fixture = {
      textChunk: textChunkArtifact,
      textPlacement: textPlacementArtifact,
      treatmentGenome: treatmentArtifact,
      textAnimation: {
        artifactId: "artifact_text_animation",
        payload: animationPayload,
      },
      typographyMotion: {
        payload: {
          textChunkPlanArtifactId: references.textChunkPlanArtifactId,
          textChunkPlanHash,
          textPlacementPlanArtifactId: references.textPlacementPlanArtifactId,
          textPlacementPlanHash,
          textAnimationPlanArtifactId: "artifact_text_animation",
          textAnimationPlanHash: hashMaulPlanPayload(animationPayload),
        },
      },
    };

    expect(() => assertMaulV3TextAnimationReferences(fixture)).not.toThrow();
    fixture.typographyMotion.payload.textAnimationPlanHash = sha("f");
    expect(() => assertMaulV3TextAnimationReferences(fixture)).toThrow(
      /stale.*hash|hash.*stale/i,
    );
  });

  it("rejects a stale treatment genome with the same artifact ID", () => {
    const animationPayload = buildMaulTextAnimationPlanPayload({
      inputs,
      textChunkPlan: textChunkArtifact,
      textPlacementPlan: textPlacementArtifact,
      treatment: "fade_rise",
      outputDurationMs: 1200,
    });
    expect(() =>
      assertMaulV3TextAnimationReferences({
        textChunk: textChunkArtifact,
        textPlacement: textPlacementArtifact,
        treatmentGenome: {
          artifactId: treatmentArtifact.artifactId,
          payload: {...treatmentArtifact.payload, replayKey: sha("3")},
        },
        textAnimation: {
          artifactId: "artifact_text_animation",
          payload: animationPayload,
        },
        typographyMotion: {
          payload: {
            ...references,
            textAnimationPlanArtifactId: "artifact_text_animation",
            textAnimationPlanHash: hashMaulPlanPayload(animationPayload),
          },
        },
      }),
    ).toThrow(/stale.*parent.*hash|parent.*hash.*stale/i);
  });

  it("names only renderer branches that V3 executes", () => {
    expect(Object.values(MAUL_V3_NATIVE_RENDER_BRANCHES)).toEqual([
      "MaulPlannedTextLayer.governedTransforms",
      "MaulShort.SourceSegment.globalCameraScale",
    ]);
    expect(
      Object.values(MAUL_V3_NATIVE_RENDER_BRANCHES).some((branch) =>
        /spring|continuousPush/.test(branch),
      ),
    ).toBe(false);
  });

  it("emits Typography Motion V3 and truthful camera/caption execution declarations", () => {
    const planningInputs = {
      project: {intake: {platform: "instagram_reels"}},
      source: {
        artifactId: "artifact_source",
        payload: {
          sha256: sha("1"),
          durationMs: 1000,
          width: 1920,
          height: 1080,
          fps: 30,
        },
      },
      analysis: {
        artifactId: "artifact_analysis",
        payload: {
          transcript: {
            language: "en",
            text: "Proof works.",
            words: [
              {text: "Proof", startMs: 0, endMs: 400, confidence: 1},
              {text: "works.", startMs: 400, endMs: 900, confidence: 1},
            ],
          },
          voiceSpans: [],
          silenceSpans: [],
          shots: [],
          speakerTracks: [],
        },
      },
      timeline: {
        artifactId: "artifact_timeline",
        payload: {
          outputDurationMs: 1000,
          timestampMap: [
            {
              sourceStartMs: 0,
              sourceEndMs: 500,
              outputStartMs: 0,
              outputEndMs: 500,
              mode: "keep",
            },
            {
              sourceStartMs: 500,
              sourceEndMs: 1000,
              outputStartMs: 500,
              outputEndMs: 1000,
              mode: "keep",
            },
          ],
          speakerCropTracks: [],
        },
      },
      candidate: {
        artifactId: "artifact_candidate",
        payload: {
          sourceStartMs: 0,
          sourceEndMs: 1000,
          transcriptText: "Proof works.",
        },
      },
      treatment: {
        artifactId: "artifact_treatment",
        payload: {
          treatmentId: "minimal_expert",
          catalogEntryName: "Minimal Expert",
          replayKey: sha("2"),
          rendererInputs: {
            framing: {maxPunchInScale: 1.08},
            audio: {musicBehavior: "Dialogue first.", duckingDb: -8},
          },
        },
      },
      textChunkPlan: null,
    } as never;
    const payloads = buildMaulPlanningPayloads(
      planningInputs,
      {
        ...references,
        textAnimationPlanArtifactId: "artifact_text_animation",
        textAnimationPlanHash: sha("9"),
      },
    );

    expect(payloads.typographyMotion.schemaVersion).toBe(
      "maul-typography-motion-plan/v3",
    );
    expect(payloads.typographyMotion.fontResolution).toMatchObject({
      selectedFamily: "DM Sans",
      selectedAssetId: "font_google_dm_sans_700",
      status: "governed_fallback",
    });
    expect(payloads.typographyMotion.warnings).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/measured typography/i),
      ]),
    );
    expect(
      payloads.typographyMotion.motionPrograms[0]?.execution.nativeBranch,
    ).toBe(MAUL_V3_NATIVE_RENDER_BRANCHES.textAnimation);
    expect(payloads.camera.events[0]?.execution.nativeBranch).toBe(
      MAUL_V3_NATIVE_RENDER_BRANCHES.camera,
    );
    expect(payloads.camera.events).toHaveLength(2);
    expect(payloads.camera.events[1]?.startScale).toBe(
      payloads.camera.events[0]?.endScale,
    );
    expect(payloads.camera.events[1]?.endScale).toBeGreaterThanOrEqual(
      payloads.camera.events[1]?.startScale ?? 0,
    );
    expect(
      JSON.stringify(payloads).match(/CaptionPage\.spring|continuousPush/g),
    ).toBeNull();

    const v2Payloads = buildMaulPlanningPayloads(planningInputs, references);
    expect(v2Payloads.camera.events).toSatisfy(
      (events: Array<{execution: {executionStatus: string}}>) =>
        events.every(
          (event) => event.execution.executionStatus === "governed_fallback",
        ),
    );
    expect(v2Payloads.camera.continuityPolicy).not.toMatch(/carries across/i);
  });

  it("compiles one truthful execution entry for each V3 artifact", () => {
    const artifact = (artifactId: string) => ({artifactId});
    const planningArtifacts = {
      observationSnapshot: artifact("observation"),
      candidateNarrative: artifact("narrative"),
      beatMap: artifact("beats"),
      typographyMotion: artifact("typography"),
      camera: artifact("camera"),
      visual: artifact("visual"),
      audio: artifact("audio"),
      capabilitySelection: artifact("capability"),
      adapterDecision: artifact("adapter"),
      artDirection: artifact("art"),
      contextAssembly: artifact("context"),
      shotIntentMatrix: artifact("shots"),
      textOpportunity: artifact("opportunity"),
      revision: artifact("revision"),
      textChunk: artifact("text_chunk"),
      textPlacement: artifact("text_placement"),
      textAnimation: artifact("text_animation"),
    } as never;
    const entries = buildMaulManifestPlanExecution({
      schemaVersion: "maul-unified-short-render-manifest/v3",
      planningArtifacts,
    });

    expect(entries).toHaveLength(17);
    expect(new Set(entries.map((entry) => entry.planType)).size).toBe(17);
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          planType: "typography_motion_plan",
          nativeBranch: "MaulPlannedTextLayer.staticPlacement",
        }),
        expect.objectContaining({
          planType: "framing_camera_plan",
          nativeBranch: MAUL_V3_NATIVE_RENDER_BRANCHES.camera,
        }),
        expect.objectContaining({
          planType: "text_animation_plan",
          nativeBranch: MAUL_V3_NATIVE_RENDER_BRANCHES.textAnimation,
        }),
      ]),
    );
    expect(JSON.stringify(entries)).not.toMatch(/CaptionPage\.spring|continuousPush/);

    const legacyEntries = buildMaulManifestPlanExecution({
      schemaVersion: "maul-unified-short-render-manifest/v2",
      planningArtifacts,
    });
    expect(legacyEntries).toContainEqual(
      expect.objectContaining({
        planType: "text_opportunity_plan",
        executionStatus: "governed_fallback",
        nativeBranch: null,
      }),
    );
    expect(JSON.stringify(legacyEntries)).not.toMatch(/CaptionPage\.spring/);
  });
});
