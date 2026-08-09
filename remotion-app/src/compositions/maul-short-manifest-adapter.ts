import {
  isMaulRendererFontCatalogEntry,
  joinShortsTextTokens,
  maulChunkTypographyBindingSchema,
  maulUnifiedShortRenderManifestV2Schema,
  maulUnifiedShortRenderManifestV3Schema,
  type MaulEditorialTimelinePayload,
  type MaulEditorialLockup,
  type MaulMinimumLegibilityPrimitive,
  type MaulNormalizedBox,
  type MaulResolvedFontAsset,
  type MaulOutputCompositionInterval,
  type MaulProfileTypographyRealization,
  type MaulTypographyProfileTransform,
  type MaulStableTextTokenV2,
  type MaulTextChunkPlanPayload,
  type MaulTextAnimationPlanPayload,
  type MaulTextAnimationProgram,
  type MaulTextPlacementPlanPayload,
  type MaulTextPlacementSegment,
  type MaulTypographyMotionPlanV2Payload,
  type MaulTypographyProfileColorResolution,
  type MaulUnifiedShortRenderManifestV1,
  type MaulUnifiedShortRenderManifestV2,
  type MaulUnifiedShortRenderManifestV3,
} from "@prometheus/shared-types";
type MaulCssStyle = Record<string, string | number>;

export type MaulCompiledLegibilityPrimitive = {
  kind: MaulMinimumLegibilityPrimitive["kind"];
  containerStyle: MaulCssStyle;
  textStyle: MaulCssStyle;
};

export const compileMaulLegibilityPrimitive = (
  primitive: MaulMinimumLegibilityPrimitive,
): MaulCompiledLegibilityPrimitive => {
  if (primitive.kind === "none") {
    return {kind: primitive.kind, containerStyle: {}, textStyle: {}};
  }
  if (primitive.kind === "outline") {
    return {
      kind: primitive.kind,
      containerStyle: {},
      textStyle: {
        WebkitTextStroke: `${primitive.widthPx}px ${primitive.color}`,
        paintOrder: "stroke fill",
      },
    };
  }
  if (primitive.kind === "shadow") {
    return {
      kind: primitive.kind,
      containerStyle: {},
      textStyle: {
        textShadow: `${primitive.offsetXPx}px ${primitive.offsetYPx}px ${primitive.blurPx}px color-mix(in srgb, ${primitive.color} ${primitive.minimumOpacity * 100}%, transparent)`,
      },
    };
  }
  return {
    kind: primitive.kind,
    containerStyle: {
      padding: `${primitive.paddingYPx}px ${primitive.paddingXPx}px`,
      borderRadius: primitive.cornerRadiusPx,
      backgroundColor: `color-mix(in srgb, ${primitive.backgroundColor} ${primitive.minimumOpacity * 100}%, transparent)`,
    },
    textStyle: {},
  };
};

export type MaulPixelBox = {
  leftPx: number;
  topPx: number;
  widthPx: number;
  heightPx: number;
};

export const toMaulPixelBox = (
  box: MaulNormalizedBox,
  output: {width: number; height: number},
): MaulPixelBox => ({
  leftPx: box.x * output.width,
  topPx: box.y * output.height,
  widthPx: box.width * output.width,
  heightPx: box.height * output.height,
});

export const toMaulFrameInterval = ({
  outputStartMs,
  outputEndMs,
  fps,
}: {
  outputStartMs: number;
  outputEndMs: number;
  fps: number;
}): {from: number; durationInFrames: number} => {
  const from = Math.ceil((outputStartMs / 1000) * fps);
  const until = Math.ceil((outputEndMs / 1000) * fps);
  return {from, durationInFrames: Math.max(1, until - from)};
};

export type MaulShortManifestAdapterResult =
  | {
      mode: "legacy";
      manifest: MaulUnifiedShortRenderManifestV1;
    }
  | {
      mode: "planned";
      manifest:
        | MaulUnifiedShortRenderManifestV2
        | MaulUnifiedShortRenderManifestV3;
    };

export const adaptMaulShortManifest = (
  input: unknown,
): MaulShortManifestAdapterResult => {
  const schemaVersion =
    typeof input === "object" && input !== null && "schemaVersion" in input
      ? input.schemaVersion
      : null;
  if (schemaVersion === "maul-unified-short-render-manifest/v1") {
    return {mode: "legacy", manifest: input as MaulUnifiedShortRenderManifestV1};
  }
  if (schemaVersion === "maul-unified-short-render-manifest/v2") {
    const parsed = maulUnifiedShortRenderManifestV2Schema.safeParse(input);
    if (!parsed.success) {
      throw new Error(
        `Invalid or stale MAUL V2 render manifest: ${parsed.error.issues[0]?.message ?? "schema validation failed"}`,
      );
    }
    return {mode: "planned", manifest: parsed.data};
  }
  if (schemaVersion === "maul-unified-short-render-manifest/v3") {
    const parsed = maulUnifiedShortRenderManifestV3Schema.safeParse(input);
    if (!parsed.success) {
      throw new Error(
        `Invalid or stale MAUL V3 render manifest: ${parsed.error.issues[0]?.message ?? "schema validation failed"}`,
      );
    }
    return {mode: "planned", manifest: parsed.data};
  }
  throw new Error(`Unsupported MAUL manifest ${String(schemaVersion)}.`);
};

export type MaulPlannedSourceSequence = {
  from: number;
  durationInFrames: number;
  trimBefore: number;
  trimAfter: number;
  playbackRate: number;
  compositionIntervalId: string;
  cropCenterXPercent: number;
  cropCenterYPercent: number;
  crop: MaulNormalizedBox;
  scale: MaulOutputCompositionInterval["scale"];
  sourceViewport: MaulNormalizedBox;
  sourceOccupancy: MaulNormalizedBox[];
  paddedNonSourceRegions: MaulNormalizedBox[];
};

export const buildMaulPlannedSourceSequences = ({
  timeline,
  textPlacementPlan,
  fps,
}: {
  timeline: Pick<MaulEditorialTimelinePayload, "timestampMap">;
  textPlacementPlan: Pick<
    MaulTextPlacementPlanPayload,
    "compositionIntervals" | "segments"
  >;
  fps: number;
}): MaulPlannedSourceSequence[] => {
  const selectedCompositions = textPlacementPlan.segments.map((segment) => {
    const composition = textPlacementPlan.compositionIntervals.find(
      (candidate) =>
        candidate.variantId === segment.selectedCompositionVariantId &&
        candidate.transformHash === segment.selectedTransformHash &&
        candidate.sceneId === segment.sceneId &&
        candidate.discontinuityId === segment.discontinuityId &&
        candidate.outputStartMs <= segment.outputStartMs &&
        candidate.outputEndMs >= segment.outputEndMs,
    );
    if (!composition) {
      throw new Error(
        `Placement ${segment.segmentId} references a missing composition transform.`,
      );
    }
    return {segment, composition};
  });
  const uniqueCompositions = selectedCompositions.filter(
    (selection, index) =>
      selectedCompositions.findIndex(
        (candidate) =>
          candidate.composition.intervalId ===
          selection.composition.intervalId,
      ) === index,
  ).map((selection) => selection.composition);

  return timeline.timestampMap
    .filter((timelineSegment) => timelineSegment.mode !== "cut")
    .flatMap((timelineSegment) => {
      const compositions = uniqueCompositions.filter(
        (composition) =>
          composition.outputStartMs < timelineSegment.outputEndMs &&
          composition.outputEndMs > timelineSegment.outputStartMs,
      );
      const selections = selectedCompositions.filter(
        ({composition}) =>
          composition.outputStartMs < timelineSegment.outputEndMs &&
          composition.outputEndMs > timelineSegment.outputStartMs,
      );
      const boundaries = [
        timelineSegment.outputStartMs,
        timelineSegment.outputEndMs,
        ...compositions.flatMap((composition) => [
          Math.max(
            timelineSegment.outputStartMs,
            composition.outputStartMs,
          ),
          Math.min(timelineSegment.outputEndMs, composition.outputEndMs),
        ]),
        ...selections.map(({segment}) => segment.outputStartMs),
      ]
        .filter(
          (boundary) =>
            boundary >= timelineSegment.outputStartMs &&
            boundary <= timelineSegment.outputEndMs,
        )
        .filter((boundary, index, all) => all.indexOf(boundary) === index)
        .sort((left, right) => left - right);

      return boundaries.slice(0, -1).map((outputStartMs, index) => {
        const outputEndMs = boundaries[index + 1]!;
        const containingSelections = selections.filter(
          ({composition}) =>
            composition.outputStartMs <= outputStartMs &&
            composition.outputEndMs >= outputEndMs,
        );
        const activeSelection = containingSelections.find(
          ({segment}) =>
            segment.outputStartMs <= outputStartMs &&
            segment.outputEndMs >= outputEndMs,
        );
        const priorSelection = [...containingSelections]
          .reverse()
          .find(({segment}) => segment.outputStartMs <= outputStartMs);
        const nextSelection = containingSelections.find(
          ({segment}) => segment.outputStartMs > outputStartMs,
        );
        const composition =
          activeSelection?.composition ??
          priorSelection?.composition ??
          nextSelection?.composition ??
          compositions.find(
            (candidate) =>
              candidate.outputStartMs <= outputStartMs &&
              candidate.outputEndMs >= outputEndMs,
          );
        if (!composition) {
          throw new Error(
            `No selected placement composition covers ${outputStartMs}-${outputEndMs}ms.`,
          );
        }
        const playbackRate =
          (timelineSegment.sourceEndMs - timelineSegment.sourceStartMs) /
          (timelineSegment.outputEndMs - timelineSegment.outputStartMs);
        const sourceStartMs =
          timelineSegment.sourceStartMs +
          (outputStartMs - timelineSegment.outputStartMs) * playbackRate;
        const sourceEndMs =
          timelineSegment.sourceStartMs +
          (outputEndMs - timelineSegment.outputStartMs) * playbackRate;
        const frameInterval = toMaulFrameInterval({
          outputStartMs,
          outputEndMs,
          fps,
        });
        const sourceFrameInterval = toMaulFrameInterval({
          outputStartMs: sourceStartMs,
          outputEndMs: sourceEndMs,
          fps,
        });
        return {
          ...frameInterval,
          trimBefore: sourceFrameInterval.from,
          trimAfter:
            sourceFrameInterval.from + sourceFrameInterval.durationInFrames,
          playbackRate,
          compositionIntervalId: composition.intervalId,
          cropCenterXPercent:
            (composition.crop.x + composition.crop.width / 2) * 100,
          cropCenterYPercent:
            (composition.crop.y + composition.crop.height / 2) * 100,
          crop: composition.crop,
          scale: composition.scale,
          sourceViewport: composition.sourceViewport,
          sourceOccupancy: composition.sourceOccupancy,
          paddedNonSourceRegions: composition.paddedNonSourceRegions,
        };
      });
    });
};

export type MaulPlannedTextToken = Pick<
  MaulStableTextTokenV2,
  "tokenId" | "text" | "outputSpans"
>;

export type MaulPlannedTextRecord = {
  segmentId: string;
  outputStartMs: number;
  outputEndMs: number;
  boxPx: MaulPixelBox;
  family: MaulTextPlacementSegment["family"];
  variantId: string;
  fallbackCode: string | null;
  fallbackReason: string | null;
  editorialLockup?: MaulEditorialLockup;
  alignment: MaulTextPlacementSegment["alignment"];
  profileRealization?: MaulProfileTypographyRealization;
  profileTransform?: MaulTypographyProfileTransform;
  profileColorResolution?: MaulTypographyProfileColorResolution;
  minimumLegibilityPrimitive: MaulMinimumLegibilityPrimitive;
  animationProgram?: MaulTextAnimationProgram | null;
  animationPrograms?: readonly MaulTextAnimationProgram[] | null;
  font: {
    profileId: string;
    metricsFingerprint: string;
    family: string;
    assetId: string;
    weight: number;
    fontSizePx: number;
    lineHeight: number;
    hierarchyScale: number;
    cssFamily?: string;
    browserUrl?: string;
    localFileSha256?: string;
    format?: MaulResolvedFontAsset["format"];
    source?: MaulResolvedFontAsset["source"];
    style?: MaulResolvedFontAsset["style"];
    license?: MaulResolvedFontAsset["license"];
  };
  accentFont?: MaulResolvedFontAsset;
  lines: Array<{
    lineId: string;
    text: string;
    tokens: MaulPlannedTextToken[];
  }>;
};

export const buildMaulPlannedTextRecords = ({
  textChunkPlan,
  textPlacementPlan,
  typographyMotion,
  textAnimationPlan,
  output,
}: {
  textChunkPlan: Pick<MaulTextChunkPlanPayload, "tokens" | "chunks">;
  textPlacementPlan: Pick<
    MaulTextPlacementPlanPayload,
    | "segments"
    | "compatibilityProfiles"
    | "compositionIntervals"
    | "status"
    | "textChunkPlanArtifactId"
    | "textChunkPlanHash"
  >;
  typographyMotion: Pick<
    MaulTypographyMotionPlanV2Payload,
    | "fontResolution"
    | "chunkTypographyBindings"
    | "textChunkPlanArtifactId"
    | "textChunkPlanHash"
  >;
  textAnimationPlan?: Pick<MaulTextAnimationPlanPayload, "programs">;
  output: {width: number; height: number};
}): MaulPlannedTextRecord[] => {
  if (textPlacementPlan.status !== "planned") {
    throw new Error("Blocked placement cannot enter planned text rendering.");
  }
  if (
    typographyMotion.textChunkPlanArtifactId !==
      textPlacementPlan.textChunkPlanArtifactId ||
    typographyMotion.textChunkPlanHash !== textPlacementPlan.textChunkPlanHash
  ) {
    throw new Error(
      "Typography and placement chunk plan hashes and artifact IDs must match.",
    );
  }
  const tokenById = new Map(
    textChunkPlan.tokens.map((token) => [token.tokenId, token]),
  );
  const chunkById = new Map(
    textChunkPlan.chunks.map((chunk) => [chunk.chunkId, chunk]),
  );
  const chunkTypographyBindingById = new Map<
    string,
    ReturnType<typeof maulChunkTypographyBindingSchema.parse>
  >();
  for (const inputBinding of typographyMotion.chunkTypographyBindings ?? []) {
    const binding = maulChunkTypographyBindingSchema.parse(inputBinding);
    if (chunkTypographyBindingById.has(binding.chunkId)) {
      throw new Error(
        `Duplicate chunk typography binding for ${binding.chunkId}.`,
      );
    }
    chunkTypographyBindingById.set(binding.chunkId, binding);
  }
  const usesChunkTypographyBindings = chunkTypographyBindingById.size > 0;
  const animationProgramsBySegmentId = new Map<string, MaulTextAnimationProgram[]>();
  for (const program of textAnimationPlan?.programs ?? []) {
    const programs = animationProgramsBySegmentId.get(program.target.placementSegmentId) ?? [];
    programs.push(program);
    animationProgramsBySegmentId.set(program.target.placementSegmentId, programs);
  }

  return textPlacementPlan.segments.map((segment) => {
    const chunk = chunkById.get(segment.chunkId);
    if (
      !chunk ||
      chunk.tokenIds.length !== segment.tokenIds.length ||
      chunk.tokenIds.some(
        (tokenId, index) => tokenId !== segment.tokenIds[index],
      )
    ) {
      throw new Error(
        `Placement ${segment.segmentId} does not match its governed chunk token sequence.`,
      );
    }
    const lineTokenIds = segment.lines.flatMap((line) => line.tokenIds);
    if (
      lineTokenIds.length !== segment.tokenIds.length ||
      lineTokenIds.some(
        (tokenId, index) => tokenId !== segment.tokenIds[index],
      )
    ) {
      throw new Error(
        `Placement ${segment.segmentId} line token order is not exact.`,
      );
    }
    for (const line of segment.lines) {
      const texts = line.tokenIds.map((tokenId) => tokenById.get(tokenId)?.text);
      const realizedLayerText = chunkTypographyBindingById
        .get(segment.chunkId)
        ?.realization?.layers.find(
          (layer) =>
            layer.tokenIds.length === line.tokenIds.length &&
            layer.tokenIds.every(
              (tokenId, index) => tokenId === line.tokenIds[index],
            ),
        )?.text;
      if (
        texts.some((text) => text === undefined) ||
        (joinShortsTextTokens(texts as string[]) !== line.text &&
          realizedLayerText !== line.text)
      ) {
        throw new Error(
          `Placement ${segment.segmentId} line text does not match its governed tokens.`,
        );
      }
    }
    if (segment.hardGates.some((gate) => gate.status !== "pass")) {
      throw new Error(
        `Placement ${segment.segmentId} has a non-passing hard gate.`,
      );
    }
    const selectedComposition = textPlacementPlan.compositionIntervals.find(
      (composition) =>
        composition.variantId === segment.selectedCompositionVariantId &&
        composition.transformHash === segment.selectedTransformHash &&
        composition.sceneId === segment.sceneId &&
        composition.discontinuityId === segment.discontinuityId &&
        composition.outputStartMs <= segment.outputStartMs &&
        composition.outputEndMs >= segment.outputEndMs,
    );
    if (!selectedComposition) {
      throw new Error(
        `Placement ${segment.segmentId} has no matching composition transform.`,
      );
    }
    const animationPrograms = animationProgramsBySegmentId.get(segment.segmentId) ?? [];
    const animationProgram = animationPrograms[0] ?? null;
    if (
      textAnimationPlan &&
      (animationPrograms.length === 0 ||
        animationPrograms.some((program) => program.target.tokenIds.some(
          (tokenId) => !segment.tokenIds.includes(tokenId),
        )))
    ) {
      throw new Error(
        `Placement ${segment.segmentId} has no matching governed animation program.`,
      );
    }
    const profile = textPlacementPlan.compatibilityProfiles.find(
      (candidate) => candidate.profileId === segment.compatibility.profileId,
    );
    const chunkTypographyBinding = chunkTypographyBindingById.get(
      segment.chunkId,
    );
    if (usesChunkTypographyBindings && !chunkTypographyBinding) {
      throw new Error(
        `Placement ${segment.segmentId} is missing its chunk typography binding for ${segment.chunkId}.`,
      );
    }
    const primaryLayer = chunkTypographyBinding?.layers.find(
      (layer) => layer.layerName === chunkTypographyBinding.primaryLayerName,
    );
    const accentLayer = chunkTypographyBinding?.accentLayerName
      ? chunkTypographyBinding.layers.find(
          (layer) => layer.layerName === chunkTypographyBinding.accentLayerName,
        )
      : null;
    if (
      chunkTypographyBinding &&
      (chunkTypographyBinding.compatibilityProfile.profileId !==
        segment.compatibility.profileId ||
        chunkTypographyBinding.compatibilityProfile.metrics.fingerprint !==
          segment.compatibility.metricsFingerprint ||
        chunkTypographyBinding.layout.chunkId !== segment.chunkId)
    ) {
      throw new Error(
        `Chunk typography binding for ${segment.chunkId} does not match placement ${segment.segmentId}.`,
      );
    }
    const selectedAsset = profile?.approvedFontAssets.find(
      (asset) =>
        asset.assetId ===
        (primaryLayer?.selectedAsset.assetId ??
          typographyMotion.fontResolution.selectedAssetId),
    );
    const selectedResolvedAsset = primaryLayer?.selectedAsset ??
      typographyMotion.fontResolution.selectedAsset;
    const accentResolvedAsset = accentLayer?.selectedAsset ??
      typographyMotion.fontResolution.accentAsset;
    const resolvedAssetMatches = Boolean(
      selectedResolvedAsset &&
      selectedAsset &&
      selectedResolvedAsset.assetId === selectedAsset.assetId &&
      selectedResolvedAsset.family === profile?.family &&
      selectedResolvedAsset.weight === profile?.loadedFallback.weight,
    );
    const declaredSafeCaptionFallback =
      segment.fallbackCode === "caption_safe_fallback" &&
      typographyMotion.fontResolution.status === "governed_fallback";
    if (
      !profile ||
      !selectedAsset ||
      selectedAsset.family !== profile.family ||
      profile.loadedFallback.family !== profile.family ||
      profile.loadedFallback.assetId !== selectedAsset.assetId ||
      !selectedAsset.weights.includes(profile.loadedFallback.weight) ||
      profile.metrics.fingerprint !== segment.compatibility.metricsFingerprint ||
      (!chunkTypographyBinding &&
        typographyMotion.fontResolution.selectedFamily !== profile.family) ||
      (typographyMotion.fontResolution.status !== "eligible_loaded" &&
        !declaredSafeCaptionFallback)
    ) {
      throw new Error(
        `Placement ${segment.segmentId} does not resolve to its governed measured font profile.`,
      );
    }
    if (
      !resolvedAssetMatches &&
      !isMaulRendererFontCatalogEntry({
        assetId: selectedAsset.assetId,
        family: profile.loadedFallback.family,
        weight: profile.loadedFallback.weight,
      })
    ) {
      throw new Error(
        `Placement ${segment.segmentId} selects a font unavailable in the MAUL renderer.`,
      );
    }

    if (segment.editorialLockup) {
      const lockupReceiptByRole = new Map([
        [
          "primary",
          {
            assetId: selectedResolvedAsset?.assetId ?? profile.loadedFallback.assetId,
            family: selectedResolvedAsset?.family ?? profile.loadedFallback.family,
            weight: selectedResolvedAsset?.weight ?? profile.loadedFallback.weight,
            style: selectedResolvedAsset?.style ??
              (profile.loadedFallback.assetId.includes("_italic_")
                ? "italic"
                : "normal"),
          },
        ],
        ...(accentResolvedAsset
          ? [[
              "accent",
              {
                assetId: accentResolvedAsset.assetId,
                family: accentResolvedAsset.family,
                weight: accentResolvedAsset.weight,
                style: accentResolvedAsset.style,
              },
            ] as const]
          : []),
      ]);
      if (segment.editorialLockup.accentTokenIds.length > 0 && !accentResolvedAsset) {
        throw new Error(
          `Placement ${segment.segmentId} editorial lockup has no resolved accent font receipt.`,
        );
      }
      for (const style of segment.editorialLockup.tokenStyles) {
        const receipt = lockupReceiptByRole.get(style.role);
        if (
          !receipt ||
          style.fontAssetId !== receipt.assetId ||
          style.fontFamily !== receipt.family ||
          style.fontWeight !== receipt.weight ||
          style.fontStyle !== receipt.style
        ) {
          throw new Error(
            `Placement ${segment.segmentId} editorial lockup font receipt does not match its resolved ${style.role} font.`,
          );
        }
      }
    }

    const profileRealization = chunkTypographyBinding?.realization;
    if (profileRealization && !segment.profileTransform) {
      throw new Error(
        `Placement ${segment.segmentId} has an authoritative realization without a profile transform.`,
      );
    }
    if (segment.profileTransform && !profileRealization) {
      throw new Error(
        `Placement ${segment.segmentId} has a profile transform without an authoritative realization.`,
      );
    }
    if (
      profileRealization &&
      segment.profileTransform &&
      (Math.abs(
        segment.profileTransform.intrinsicWidthPx -
          profileRealization.intrinsicSizePx.width,
      ) > 0.01 ||
        Math.abs(
          segment.profileTransform.intrinsicHeightPx -
            profileRealization.intrinsicSizePx.height,
        ) > 0.01)
    ) {
      throw new Error(
        `Placement ${segment.segmentId} profile transform does not match its realization dimensions.`,
      );
    }

    return {
      segmentId: segment.segmentId,
      outputStartMs: segment.outputStartMs,
      outputEndMs: segment.outputEndMs,
      boxPx: toMaulPixelBox(segment.box, output),
      family: segment.family,
      variantId: segment.variantId,
      fallbackCode: segment.fallbackCode,
      fallbackReason: segment.fallbackReason,
      editorialLockup: segment.editorialLockup,
      alignment: segment.alignment,
      profileRealization,
      profileTransform: segment.profileTransform,
      profileColorResolution: segment.profileColorResolution,
      minimumLegibilityPrimitive: segment.minimumLegibilityPrimitive,
      animationProgram,
      animationPrograms,
      font: {
        profileId: profile.profileId,
        metricsFingerprint: profile.metrics.fingerprint,
        family: profile.loadedFallback.family,
        assetId: profile.loadedFallback.assetId,
        weight: profile.loadedFallback.weight,
        fontSizePx: segment.compatibility.nominalFontSizePx,
        lineHeight: segment.compatibility.lineHeight,
        hierarchyScale: segment.compatibility.hierarchyScale,
        ...(selectedResolvedAsset
          ? {
              cssFamily: selectedResolvedAsset.cssFamily,
              browserUrl: selectedResolvedAsset.browserUrl,
              localFileSha256: selectedResolvedAsset.localFileSha256,
              format: selectedResolvedAsset.format,
              source: selectedResolvedAsset.source,
              style: selectedResolvedAsset.style,
              license: selectedResolvedAsset.license,
            }
          : {}),
      },
      accentFont: accentResolvedAsset ?? undefined,
      lines: segment.lines.map((line) => ({
        lineId: line.lineId,
        text: line.text,
        tokens: line.tokenIds.map((tokenId) => {
          const token = tokenById.get(tokenId);
          if (!token) {
            throw new Error(`Placement references missing token ${tokenId}.`);
          }
          return token;
        }),
      })),
    };
  });
};

export const buildMaulPlannedRenderModel = (
  manifest:
    | MaulUnifiedShortRenderManifestV2
    | MaulUnifiedShortRenderManifestV3,
): {
  textRecords: MaulPlannedTextRecord[];
  sourceSequences: MaulPlannedSourceSequence[];
} => ({
  textRecords: buildMaulPlannedTextRecords({
    textChunkPlan: manifest.plans.textChunk,
    textPlacementPlan: manifest.plans.textPlacement,
    typographyMotion: manifest.plans.typographyMotion,
    textAnimationPlan:
      manifest.schemaVersion === "maul-unified-short-render-manifest/v3"
        ? manifest.plans.textAnimation
        : undefined,
    output: manifest.output,
  }),
  sourceSequences: buildMaulPlannedSourceSequences({
    timeline: manifest.timeline,
    textPlacementPlan: manifest.plans.textPlacement,
    fps: manifest.output.fps,
  }),
});
