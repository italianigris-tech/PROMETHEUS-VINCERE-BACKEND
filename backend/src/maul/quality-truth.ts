import {
  maulQualityTruthProofSchema,
  maulQualityTruthResultSchema,
  type MaulQualityTruthProof,
  type MaulQualityTruthResult,
  type MaulUnifiedShortRenderManifest,
} from "@prometheus/shared-types";

export type MaulQualityTruthProofProvider = (
  manifest: MaulUnifiedShortRenderManifest,
) => Promise<MaulQualityTruthProof>;

type QualityTruthFailure = MaulQualityTruthResult["failures"][number];

type PlacementAwareManifest = Extract<
  MaulUnifiedShortRenderManifest,
  {
    schemaVersion:
      | "maul-unified-short-render-manifest/v2"
      | "maul-unified-short-render-manifest/v3";
  }
>;

const isPlacementAwareManifest = (
  manifest: MaulUnifiedShortRenderManifest,
): manifest is PlacementAwareManifest =>
  manifest.schemaVersion === "maul-unified-short-render-manifest/v2" ||
  manifest.schemaVersion === "maul-unified-short-render-manifest/v3";

export const buildUnavailableMaulQualityTruthResult = (
  manifest: MaulUnifiedShortRenderManifest,
  error: unknown,
): MaulQualityTruthResult =>
  maulQualityTruthResultSchema.parse({
    schemaVersion: "maul-quality-truth-result/v1",
    manifestReplayKey: manifest.replayKey,
    status: "blocked",
    evidenceIds: [],
    failures: [
      {
        code: "proof_unavailable",
        field: "proofProvider",
        outputStartMs: null,
        outputEndMs: null,
        message: `Runtime proof provider is unavailable: ${error instanceof Error ? error.message : String(error)}`,
        evidenceId: null,
      },
    ],
  });

export const evaluateMaulQualityTruth = (
  manifest: MaulUnifiedShortRenderManifest,
  proofInput: unknown,
): MaulQualityTruthResult => {
  const parsedProof = maulQualityTruthProofSchema.safeParse(proofInput);
  if (!parsedProof.success) {
    const issue = parsedProof.error.issues[0];
    const field = issue?.path.join(".") || "proof";
    const missingPlacementProof =
      isPlacementAwareManifest(manifest) &&
      issue?.path[0] === "placementSegments";
    return maulQualityTruthResultSchema.parse({
      schemaVersion: "maul-quality-truth-result/v1",
      manifestReplayKey: manifest.replayKey,
      status: "blocked",
      evidenceIds: [],
      failures: [
        {
          code: missingPlacementProof
            ? "placement_evidence_missing"
            : "proof_invalid",
          field,
          outputStartMs: null,
          outputEndMs: null,
          message: `Runtime proof failed its required schema: ${issue?.message ?? "unknown validation error"}`,
          evidenceId: null,
        },
      ],
    });
  }
  const proof = parsedProof.data;
  const failures: QualityTruthFailure[] = [];
  const fail = (
    code: QualityTruthFailure["code"],
    field: string,
    message: string,
    evidenceId: string | null = null,
    outputStartMs: number | null = null,
    outputEndMs: number | null = null,
  ) => {
    failures.push({
      code,
      field,
      outputStartMs,
      outputEndMs,
      message,
      evidenceId,
    });
  };

  if (proof.manifestReplayKey !== manifest.replayKey) {
    fail(
      "proof_manifest_mismatch",
      "manifestReplayKey",
      "Runtime proof does not belong to this compiled manifest.",
    );
  }

  if (
    isPlacementAwareManifest(manifest) &&
    proof.schemaVersion !== "maul-quality-truth-proof/v2"
  ) {
    fail(
      "placement_evidence_missing",
      "schemaVersion",
      "A placement-aware manifest requires Quality Truth V2 evidence.",
    );
  }

  const safe = manifest.plans.adapterDecision.safeRegion;
  const captionIndices = new Set(
    proof.captionLayout.boxes.map((box) => box.captionIndex),
  );
  const captionBoxesComplete =
    proof.captionLayout.boxes.length === manifest.captions.length &&
    captionIndices.size === manifest.captions.length &&
    manifest.captions.every((_caption, index) => captionIndices.has(index));
  if (proof.captionLayout.status !== "verified" || !captionBoxesComplete) {
    fail(
      "caption_bounds_unverified",
      "captions",
      "Every caption requires measured final-pixel bounds.",
      proof.captionLayout.evidenceId,
    );
  } else {
    for (const box of proof.captionLayout.boxes) {
      if (
        box.leftPx < safe.leftPx ||
        box.topPx < safe.topPx ||
        box.rightPx > manifest.output.width - safe.rightPx ||
        box.bottomPx > manifest.output.height - safe.bottomPx ||
        box.rightPx <= box.leftPx ||
        box.bottomPx <= box.topPx
      ) {
        const caption = manifest.captions[box.captionIndex];
        fail(
          "caption_outside_safe_region",
          `captions.${box.captionIndex}`,
          "Measured caption bounds leave the governed portrait safe region.",
          proof.captionLayout.evidenceId,
          caption?.startMs ?? null,
          caption?.endMs ?? null,
        );
      }
    }
  }

  const plannedFamily =
    manifest.plans.typographyMotion.fontResolution.selectedFamily;
  const plannedAssetId =
    manifest.plans.typographyMotion.fontResolution.selectedAssetId;
  const plannedFontStatus =
    manifest.plans.typographyMotion.fontResolution.status;
  const chunkTypographyBindings =
    manifest.plans.typographyMotion.chunkTypographyBindings ?? [];
  const forbiddenGenericFamily = /^(arial|helvetica|sans-serif|serif|system-ui|ui-sans-serif)$/i.test(
    plannedFamily.trim(),
  );
  if (
    plannedFontStatus !== "eligible_loaded" ||
    forbiddenGenericFamily ||
    proof.fontRuntime.status === "fallback"
  ) {
    fail(
      "font_fallback_forbidden",
      "plans.typographyMotion.fontResolution",
      "System font fallback cannot enter the MAUL renderer.",
      proof.fontRuntime.evidenceId,
    );
  } else if (chunkTypographyBindings.length > 0) {
    const bindingByChunkId = new Map(
      chunkTypographyBindings.map((binding) => [binding.chunkId, binding]),
    );
    const expectedAssets = new Map<string, {family: string; assetId: string}>();
    const placementSegments =
      "textPlacement" in manifest.plans
        ? manifest.plans.textPlacement.segments
        : [];
    for (const segment of placementSegments) {
      const binding = bindingByChunkId.get(segment.chunkId);
      if (binding?.realization) {
        for (const layer of binding.realization.layers) {
          expectedAssets.set(layer.selectedAsset.assetId, layer.selectedAsset);
        }
      } else {
        const primary = binding?.layers.find(
          (layer) => layer.layerName === binding.primaryLayerName,
        )?.selectedAsset;
        if (primary) expectedAssets.set(primary.assetId, primary);
        if (
          binding?.accentLayerName &&
          (segment.editorialLockup?.accentTokenIds.length ?? 0) > 0
        ) {
          const accent = binding.layers.find(
            (layer) => layer.layerName === binding.accentLayerName,
          )?.selectedAsset;
          if (accent) expectedAssets.set(accent.assetId, accent);
        }
      }
    }
    const runtimeAssetById = new Map(
      proof.fontRuntime.assets.map((asset) => [asset.assetId, asset]),
    );
    const missingAssets = [...expectedAssets.values()].filter((asset) => {
      const runtime = runtimeAssetById.get(asset.assetId);
      return !runtime || runtime.family !== asset.family || !runtime.evidenceId;
    });
    if (
      expectedAssets.size === 0 ||
      missingAssets.length > 0 ||
      proof.fontRuntime.status !== "eligible_loaded"
    ) {
      fail(
        "font_load_unverified",
        "plans.typographyMotion.chunkTypographyBindings",
        "Every chunk-selected typography asset requires matching loaded-font proof.",
        proof.fontRuntime.evidenceId,
      );
    }
  } else if (
    !plannedAssetId ||
    proof.fontRuntime.status !== "eligible_loaded" ||
    proof.fontRuntime.family !== plannedFamily ||
    proof.fontRuntime.assetId !== plannedAssetId
  ) {
    fail(
      "font_load_unverified",
      "plans.typographyMotion.fontResolution",
      "Selected typography lacks matching loaded-font proof.",
      proof.fontRuntime.evidenceId,
    );
  }

  const selectedPlacementCompositions: Array<{
    intervalId: string;
    outputStartMs: number;
    outputEndMs: number;
    crop: {x: number; y: number; width: number; height: number};
  }> = [];
  if (
    isPlacementAwareManifest(manifest) &&
    proof.schemaVersion === "maul-quality-truth-proof/v2"
  ) {
    const placement = manifest.plans.textPlacement;
    const proofBySegmentId = new Map(
      proof.placementSegments.map((record) => [
        record.placementSegmentId,
        record,
      ]),
    );
    if (
      proofBySegmentId.size !== placement.segments.length ||
      proof.placementSegments.length !== placement.segments.length
    ) {
      fail(
        "placement_evidence_missing",
        "placementSegments",
        "Every planned placement segment requires exactly one runtime proof record.",
      );
    }

    for (const segment of placement.segments) {
      const record = proofBySegmentId.get(segment.segmentId);
      const composition = placement.compositionIntervals.find(
        (interval) =>
          interval.variantId === segment.selectedCompositionVariantId &&
          interval.transformHash === segment.selectedTransformHash &&
          interval.sceneId === segment.sceneId &&
          interval.discontinuityId === segment.discontinuityId &&
          interval.outputStartMs <= segment.outputStartMs &&
          interval.outputEndMs >= segment.outputEndMs,
      );
      if (
        composition &&
        !selectedPlacementCompositions.some(
          (selected) => selected.intervalId === composition.intervalId,
        )
      ) {
        selectedPlacementCompositions.push(composition);
      }
      if (!record || record.status !== "verified" || !record.evidenceId) {
        fail(
          "placement_evidence_missing",
          `placementSegments.${segment.segmentId}`,
          "Planned placement segment lacks verified runtime evidence.",
          record?.evidenceId ?? null,
          segment.outputStartMs,
          segment.outputEndMs,
        );
        continue;
      }
      const profile = placement.compatibilityProfiles.find(
        (candidate) =>
          candidate.profileId === segment.compatibility.profileId,
      );
      const chunkBinding = chunkTypographyBindings.find(
        (binding) => binding.chunkId === segment.chunkId,
      );
      const expectedFontAssetId =
        chunkBinding?.layers.find(
          (layer) => layer.layerName === chunkBinding.primaryLayerName,
        )?.selectedAsset.assetId ?? plannedAssetId;
      if (
        !composition ||
        record.textPlacementPlanArtifactId !==
          manifest.planArtifactIds.textPlacement ||
        record.compositionIntervalId !== composition.intervalId ||
        record.compositionVariantId !==
          segment.selectedCompositionVariantId ||
        record.compositionTransformHash !== segment.selectedTransformHash ||
        record.compatibilityProfileId !== segment.compatibility.profileId ||
        record.metricsFingerprint !==
          segment.compatibility.metricsFingerprint ||
        !profile ||
        profile.metrics.fingerprint !== record.metricsFingerprint ||
        record.exactFontAssetId !== expectedFontAssetId
      ) {
        fail(
          "placement_reference_mismatch",
          `placementSegments.${segment.segmentId}`,
          "Placement proof does not match the selected plan, transform, or typography profile.",
          record.evidenceId,
          segment.outputStartMs,
          segment.outputEndMs,
        );
      }

      const envelope = segment.maximumEnvelope;
      const measured = record.measuredBox;
      const leftPx = envelope.x * manifest.output.width;
      const topPx = envelope.y * manifest.output.height;
      const rightPx = (envelope.x + envelope.width) * manifest.output.width;
      const bottomPx =
        (envelope.y + envelope.height) * manifest.output.height;
      if (
        measured.leftPx < leftPx ||
        measured.topPx < topPx ||
        measured.rightPx > rightPx ||
        measured.bottomPx > bottomPx
      ) {
        fail(
          "placement_bounds_mismatch",
          `placementSegments.${segment.segmentId}.measuredBox`,
          "Measured text bounds exceed the planned maximum envelope.",
          record.evidenceId,
          segment.outputStartMs,
          segment.outputEndMs,
        );
      }
      if (
        JSON.stringify(record.compiledLegibilityPrimitive) !==
        JSON.stringify(segment.minimumLegibilityPrimitive)
      ) {
        fail(
          "placement_primitive_mismatch",
          `placementSegments.${segment.segmentId}.compiledLegibilityPrimitive`,
          "Compiled legibility primitive does not match the planned minimum.",
          record.evidenceId,
          segment.outputStartMs,
          segment.outputEndMs,
        );
      }
    }
  }

  const expectedCrops =
    isPlacementAwareManifest(manifest)
      ? selectedPlacementCompositions.map((composition) => ({
          outputStartMs: composition.outputStartMs,
          outputEndMs: composition.outputEndMs,
          ...composition.crop,
        }))
      : manifest.timeline.speakerCropTracks.map((track) => ({
          outputStartMs: track.outputStartMs,
          outputEndMs: track.outputEndMs,
          ...track.crop,
        }));
  const cropProofMatchesManifest =
    proof.cropAndMask.crops.length === expectedCrops.length &&
    expectedCrops.every((expectedCrop) =>
      proof.cropAndMask.crops.some(
        (crop) =>
          crop.outputStartMs === expectedCrop.outputStartMs &&
          crop.outputEndMs === expectedCrop.outputEndMs &&
          crop.x === expectedCrop.x &&
          crop.y === expectedCrop.y &&
          crop.width === expectedCrop.width &&
          crop.height === expectedCrop.height,
      ),
    );
  if (
    proof.cropAndMask.status !== "verified" ||
    !cropProofMatchesManifest ||
    (proof.cropAndMask.maskingRequired &&
      proof.cropAndMask.maskingStatus !== "verified")
  ) {
    fail(
      "crop_or_mask_unverified",
      isPlacementAwareManifest(manifest)
        ? "plans.textPlacement.compositionIntervals"
        : "timeline.speakerCropTracks",
      "Crop and required masking need matching runtime evidence.",
      proof.cropAndMask.evidenceId,
    );
  }
  for (const crop of proof.cropAndMask.crops) {
    if (
      crop.x + crop.width > 1 ||
      crop.y + crop.height > 1 ||
      crop.outputEndMs <= crop.outputStartMs ||
      crop.outputEndMs > manifest.timeline.outputDurationMs
    ) {
      fail(
        "crop_outside_source",
        "timeline.speakerCropTracks",
        "Crop leaves normalized source bounds or the authoritative output timeline.",
        proof.cropAndMask.evidenceId,
        crop.outputStartMs,
        crop.outputEndMs,
      );
    }
  }

  if (proof.cameraContinuity.status === "restart_detected") {
    if (proof.cameraContinuity.resetOutputMs.length === 0) {
      fail(
        "camera_zoom_restart",
        "plans.camera.events",
        "Camera scale restart was detected without a reported output time.",
        proof.cameraContinuity.evidenceId,
      );
    }
  } else if (proof.cameraContinuity.status !== "verified_continuous") {
    fail(
      "camera_continuity_unverified",
      "plans.camera.events",
      "Continuous camera state lacks runtime proof.",
      proof.cameraContinuity.evidenceId,
    );
  }
  for (const outputMs of proof.cameraContinuity.resetOutputMs) {
    fail(
      "camera_zoom_restart",
      "plans.camera.events",
      "Camera scale restarts at an implementation boundary.",
      proof.cameraContinuity.evidenceId,
      outputMs,
      outputMs,
    );
  }

  const selectedCapabilityIds = new Set([
    ...manifest.plans.capabilitySelection.selections
      .filter((entry) => entry.selected)
      .map((entry) => entry.capabilityId),
    ...manifest.plans.typographyMotion.motionPrograms.map(
      (entry) => entry.capabilityId,
    ),
  ]);
  for (const capabilityId of selectedCapabilityIds) {
    const capability = proof.capabilities.find(
      (entry) => entry.capabilityId === capabilityId,
    );
    if (capability?.status === "unsupported") {
      fail(
        "capability_unsupported",
        `capabilities.${capabilityId}`,
        "Selected capability is not native-render-safe.",
        capability.evidenceId,
      );
    } else if (
      capability?.status !== "native_render_safe" ||
      !capability.evidenceId
    ) {
      fail(
        "capability_evidence_missing",
        `capabilities.${capabilityId}`,
        "Selected capability lacks native branch evidence.",
        capability?.evidenceId ?? null,
      );
    }
  }

  for (const execution of manifest.planExecution.filter(
    (entry) => entry.executionStatus === "governed_fallback",
  )) {
    const fallback = proof.fallbacks.find(
      (entry) => entry.planType === execution.planType,
    );
    if (!fallback?.evidenceId) {
      fail(
        "silent_fallback",
        `planExecution.${execution.planType}`,
        "Selected governed fallback lacks observable evidence.",
      );
    }
  }

  return maulQualityTruthResultSchema.parse({
    schemaVersion: "maul-quality-truth-result/v1",
    manifestReplayKey: manifest.replayKey,
    status: failures.length === 0 ? "pass" : "blocked",
    evidenceIds: [
      proof.captionLayout.evidenceId,
      proof.fontRuntime.evidenceId,
      proof.cropAndMask.evidenceId,
      proof.cameraContinuity.evidenceId,
      ...proof.capabilities.map((capability) => capability.evidenceId),
      ...proof.fallbacks.map((fallback) => fallback.evidenceId),
      ...(proof.schemaVersion === "maul-quality-truth-proof/v2"
        ? proof.placementSegments.map((segment) => segment.evidenceId)
        : []),
    ]
      .filter((evidenceId): evidenceId is string => evidenceId !== null)
      .filter((evidenceId, index, all) => all.indexOf(evidenceId) === index)
      .sort(),
    failures,
  });
};

export const buildUnverifiedMaulQualityTruthProof = (
  manifest: MaulUnifiedShortRenderManifest,
): MaulQualityTruthProof =>
  maulQualityTruthProofSchema.parse({
    schemaVersion:
      isPlacementAwareManifest(manifest)
        ? "maul-quality-truth-proof/v2"
        : "maul-quality-truth-proof/v1",
    manifestReplayKey: manifest.replayKey,
    captionLayout: {status: "unverified", evidenceId: null, boxes: []},
    fontRuntime: {
      status: "fallback",
      family:
        manifest.plans.typographyMotion.fontResolution.selectedFamily,
      assetId: null,
      evidenceId: null,
    },
    cropAndMask: {
      status: "unverified",
      evidenceId: null,
      maskingRequired: false,
      maskingStatus: "not_required",
      crops:
        isPlacementAwareManifest(manifest)
          ? manifest.plans.textPlacement.compositionIntervals.map(
              (interval) => ({
                outputStartMs: interval.outputStartMs,
                outputEndMs: interval.outputEndMs,
                ...interval.crop,
              }),
            )
          : manifest.timeline.speakerCropTracks.map((track) => ({
              outputStartMs: track.outputStartMs,
              outputEndMs: track.outputEndMs,
              ...track.crop,
            })),
    },
    cameraContinuity: {
      status: "unverified",
      evidenceId: null,
      resetOutputMs: [],
    },
    capabilities:
      manifest.plans.capabilitySelection.selections
        .filter((entry) => entry.selected)
        .map((entry) => ({
          capabilityId: entry.capabilityId,
          status: "unverified",
          evidenceId: null,
        })),
    fallbacks: [],
    ...(isPlacementAwareManifest(manifest)
      ? {
          placementSegments: manifest.plans.textPlacement.segments.map(
            (segment) => {
              const composition =
                manifest.plans.textPlacement.compositionIntervals.find(
                  (interval) =>
                    interval.variantId ===
                      segment.selectedCompositionVariantId &&
                    interval.transformHash ===
                      segment.selectedTransformHash &&
                    interval.sceneId === segment.sceneId &&
                    interval.discontinuityId === segment.discontinuityId &&
                    interval.outputStartMs <= segment.outputStartMs &&
                    interval.outputEndMs >= segment.outputEndMs,
                )!;
              const envelope = segment.maximumEnvelope;
              const typographyBinding =
                manifest.plans.typographyMotion.chunkTypographyBindings.find(
                  (binding) => binding.chunkId === segment.chunkId,
                );
              return {
                status: "unverified",
                evidenceId: null,
                textPlacementPlanArtifactId:
                  manifest.planArtifactIds.textPlacement,
                placementSegmentId: segment.segmentId,
                compositionIntervalId: composition.intervalId,
                compositionVariantId: segment.selectedCompositionVariantId,
                compositionTransformHash: segment.selectedTransformHash,
                compatibilityProfileId: segment.compatibility.profileId,
                metricsFingerprint:
                  segment.compatibility.metricsFingerprint,
                exactFontAssetId:
                  typographyBinding?.layers.find(
                    (layer) =>
                      layer.layerName === typographyBinding.primaryLayerName,
                  )?.selectedAsset.assetId ??
                  manifest.plans.typographyMotion.fontResolution.selectedAssetId,
                compiledLegibilityPrimitive:
                  segment.minimumLegibilityPrimitive,
                measuredBox: {
                  leftPx: envelope.x * manifest.output.width,
                  topPx: envelope.y * manifest.output.height,
                  rightPx:
                    (envelope.x + envelope.width) * manifest.output.width,
                  bottomPx:
                    (envelope.y + envelope.height) * manifest.output.height,
                },
              };
            },
          ),
        }
      : {}),
  });
