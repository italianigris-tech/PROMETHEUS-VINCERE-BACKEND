import {
  joinShortsTextTokens,
  maulUnifiedShortRenderManifestV2Schema,
  type MaulEditorialTimelinePayload,
  type MaulMinimumLegibilityPrimitive,
  type MaulNormalizedBox,
  type MaulOutputCompositionInterval,
  type MaulStableTextTokenV2,
  type MaulTextChunkPlanPayload,
  type MaulTextPlacementPlanPayload,
  type MaulTextPlacementSegment,
  type MaulTypographyMotionPlanV2Payload,
  type MaulUnifiedShortRenderManifestV1,
  type MaulUnifiedShortRenderManifestV2,
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

export type MaulShortManifestAdapterResult =
  | {
      mode: "legacy";
      manifest: MaulUnifiedShortRenderManifestV1;
    }
  | {
      mode: "planned";
      manifest: MaulUnifiedShortRenderManifestV2;
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
        const trimBefore = Math.round((sourceStartMs / 1000) * fps);
        return {
          from: Math.round((outputStartMs / 1000) * fps),
          durationInFrames: Math.max(
            1,
            Math.round(((outputEndMs - outputStartMs) / 1000) * fps),
          ),
          trimBefore,
          trimAfter: Math.max(
            trimBefore + 1,
            Math.round((sourceEndMs / 1000) * fps),
          ),
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
  alignment: MaulTextPlacementSegment["alignment"];
  minimumLegibilityPrimitive: MaulMinimumLegibilityPrimitive;
  font: {
    profileId: string;
    metricsFingerprint: string;
    family: "DM Sans";
    assetId: "font_google_dm_sans_700";
    weight: 700;
    fontSizePx: number;
    lineHeight: number;
    hierarchyScale: number;
  };
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
    | "textChunkPlanArtifactId"
    | "textChunkPlanHash"
  >;
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
      if (
        texts.some((text) => text === undefined) ||
        joinShortsTextTokens(texts as string[]) !== line.text
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
    const profile = textPlacementPlan.compatibilityProfiles.find(
      (candidate) => candidate.profileId === segment.compatibility.profileId,
    );
    if (
      !profile ||
      profile.family !== "DM Sans" ||
      profile.loadedFallback.family !== "DM Sans" ||
      profile.loadedFallback.assetId !== "font_google_dm_sans_700" ||
      profile.loadedFallback.weight !== 700 ||
      profile.metrics.fingerprint !==
        segment.compatibility.metricsFingerprint ||
      typographyMotion.fontResolution.selectedFamily !== "DM Sans" ||
      typographyMotion.fontResolution.selectedAssetId !==
        "font_google_dm_sans_700" ||
      typographyMotion.fontResolution.status !== "eligible_loaded"
    ) {
      throw new Error(
        `Placement ${segment.segmentId} does not resolve to pinned DM Sans metrics.`,
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
      alignment: segment.alignment,
      minimumLegibilityPrimitive: segment.minimumLegibilityPrimitive,
      font: {
        profileId: profile.profileId,
        metricsFingerprint: profile.metrics.fingerprint,
        family: profile.loadedFallback.family,
        assetId: profile.loadedFallback.assetId,
        weight: profile.loadedFallback.weight,
        fontSizePx: segment.compatibility.nominalFontSizePx,
        lineHeight: segment.compatibility.lineHeight,
        hierarchyScale: segment.compatibility.hierarchyScale,
      },
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
  manifest: MaulUnifiedShortRenderManifestV2,
): {
  textRecords: MaulPlannedTextRecord[];
  sourceSequences: MaulPlannedSourceSequence[];
} => ({
  textRecords: buildMaulPlannedTextRecords({
    textChunkPlan: manifest.plans.textChunk,
    textPlacementPlan: manifest.plans.textPlacement,
    typographyMotion: manifest.plans.typographyMotion,
    output: manifest.output,
  }),
  sourceSequences: buildMaulPlannedSourceSequences({
    timeline: manifest.timeline,
    textPlacementPlan: manifest.plans.textPlacement,
    fps: manifest.output.fps,
  }),
});
