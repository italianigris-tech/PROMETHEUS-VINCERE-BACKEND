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
    return maulQualityTruthResultSchema.parse({
      schemaVersion: "maul-quality-truth-result/v1",
      manifestReplayKey: manifest.replayKey,
      status: "blocked",
      evidenceIds: [],
      failures: [
        {
          code: "proof_invalid",
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

  const cropProofMatchesManifest =
    proof.cropAndMask.crops.length ===
      manifest.timeline.speakerCropTracks.length &&
    manifest.timeline.speakerCropTracks.every((track) =>
      proof.cropAndMask.crops.some(
        (crop) =>
          crop.outputStartMs === track.outputStartMs &&
          crop.outputEndMs === track.outputEndMs &&
          crop.x === track.crop.x &&
          crop.y === track.crop.y &&
          crop.width === track.crop.width &&
          crop.height === track.crop.height,
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
      "timeline.speakerCropTracks",
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
    schemaVersion: "maul-quality-truth-proof/v1",
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
      crops: manifest.timeline.speakerCropTracks.map((track) => ({
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
  });
