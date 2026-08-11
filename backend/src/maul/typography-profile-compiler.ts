import {performance} from "node:perf_hooks";

import {
  maulChunkTypographyBindingSchema,
  type MaulChunkTypographyBinding,
  type MaulResolvedFontAsset,
  type MaulTypographyCompatibilityProfile,
} from "@prometheus/shared-types";

import {hashMaulPlanPayload} from "./text-chunk-plan.js";
import {
  countTypographyCharacters,
  loadTypographyProfileCorpus,
  rankTypographyProfiles,
  type TypographyProfileLayer,
  type TypographyProfileObservation,
} from "./typography-profile-corpus.js";
import {
  loadExecutableTypographyFontAssets,
  loadTypographyFontIntelligenceCatalog,
  resolveTypographyProfileLayer,
  type TypographyFontIntelligenceEntry,
} from "./typography-profile-font-resolver.js";
import {
  createFontkitEditorialTokenMeasurementProvider,
  createResolvedMaulTypographyProvider,
  type MaulMeasuredTypographyLayout,
  type MaulTypographyPlan,
} from "./typography-layout.js";
import {
  compileTypographyProfileRealization,
  type TypographyRealizationToken,
} from "./typography-profile-realization.js";

export type TypographyProfileCompilerChunk = {
  chunkId: string;
  text: string;
  wordCount: number;
  tokens: readonly TypographyRealizationToken[];
  semanticRole: string;
  emphasisLevel: "support" | "key" | "hero";
};

type AvailableTypographyPlan = Extract<MaulTypographyPlan, {status: "available"}>;

export type TypographyProfileFontResolutionSummary = {
  requestedRole: "editorial" | "utility";
  selectedFamily: string;
  selectedAssetId: string | null;
  status: "eligible_loaded";
  reason: string;
  selectedAsset?: MaulResolvedFontAsset | null;
  accentAsset?: MaulResolvedFontAsset | null;
};

export type CompiledChunkTypography = {
  binding: MaulChunkTypographyBinding;
  profile: MaulTypographyCompatibilityProfile;
  layout: MaulMeasuredTypographyLayout;
  fontResolution: AvailableTypographyPlan["fontResolution"];
};

export type TypographyProfileCompilation =
  | {
      status: "available";
      bindings: MaulChunkTypographyBinding[];
      chunks: CompiledChunkTypography[];
      compatibilityProfiles: MaulTypographyCompatibilityProfile[];
      evidenceIds: string[];
      fontResolution: TypographyProfileFontResolutionSummary;
    }
  | {status: "unavailable"; reason: string};

export interface TypographyProfileCompiler {
  compile(input: {
    chunks: readonly TypographyProfileCompilerChunk[];
    targetAspectRatio: "9:16";
    maximumLineWidthPx: number;
  }): Promise<TypographyProfileCompilation>;
}

const roundTiming = (value: number): number => Number(value.toFixed(3));

const visualScale = (layer: TypographyProfileLayer): number =>
  layer.fontStyle.sizePxBase * layer.fontStyle.relativeScale;

const primaryLayerFor = (
  profile: TypographyProfileObservation,
): TypographyProfileLayer =>
  [...profile.layers].sort(
    (left, right) =>
      visualScale(right) - visualScale(left) ||
      left.layerName.localeCompare(right.layerName),
  )[0]!;

const accentLayerFor = ({
  profile,
  primary,
}: {
  profile: TypographyProfileObservation;
  primary: TypographyProfileLayer;
}): TypographyProfileLayer | null =>
  [...profile.layers]
    .filter((layer) => layer.layerName !== primary.layerName)
    .sort(
      (left, right) =>
        (right.role === "primary_focus_word" ? 1 : 0) -
          (left.role === "primary_focus_word" ? 1 : 0) ||
        (right.role === "accent_tagline" ? 1 : 0) -
          (left.role === "accent_tagline" ? 1 : 0) ||
        visualScale(right) - visualScale(left) ||
        left.layerName.localeCompare(right.layerName),
    )[0] ?? null;

const normalizedCandidateSet = (layer: TypographyProfileLayer): Set<string> =>
  new Set(
    layer.matchedFontCandidates.map((candidate) =>
      candidate.toLowerCase().replace(/[^a-z0-9]+/g, ""),
    ),
  );

const layersRequestContrast = (
  primary: TypographyProfileLayer,
  candidate: TypographyProfileLayer,
): boolean => {
  const primaryCandidates = normalizedCandidateSet(primary);
  const sharesFamily = candidate.matchedFontCandidates.some((family) =>
    primaryCandidates.has(family.toLowerCase().replace(/[^a-z0-9]+/g, "")),
  );
  return (
    !sharesFamily ||
    candidate.fontStyle.style !== primary.fontStyle.style ||
    candidate.role === "accent_tagline"
  );
};

const measurementSizeFor = (layer: TypographyProfileLayer): number =>
  Math.min(88, Math.max(48, Math.round(visualScale(layer))));

export const createTypographyProfileCompiler = ({
  profiles = loadTypographyProfileCorpus(),
  executableAssets = loadExecutableTypographyFontAssets(),
  catalog = loadTypographyFontIntelligenceCatalog(),
}: {
  profiles?: readonly TypographyProfileObservation[];
  executableAssets?: readonly MaulResolvedFontAsset[];
  catalog?: readonly TypographyFontIntelligenceEntry[];
} = {}): TypographyProfileCompiler => {
  const measureProfileLayer = createFontkitEditorialTokenMeasurementProvider({
    assets: executableAssets,
  });
  const providerByKey = new Map<
    string,
    ReturnType<typeof createResolvedMaulTypographyProvider>
  >();
  return {
    async compile(input) {
      if (input.chunks.length === 0) {
        return {
          status: "unavailable",
          reason: "Typography profile compilation requires materialized chunks.",
        };
      }
      try {
        const compiledChunks: CompiledChunkTypography[] = [];
        const recentlyUsedProfileNames: string[] = [];
        for (const chunk of input.chunks) {
          const selectionStarted = performance.now();
          const ranked = rankTypographyProfiles({
            profiles,
            chunk: {
              wordCount: chunk.wordCount,
              characterCount: countTypographyCharacters(chunk.text),
              semanticRole: chunk.semanticRole,
              emphasisLevel: chunk.emphasisLevel,
            },
            targetAspectRatio: input.targetAspectRatio,
            recentlyUsedProfileNames,
          });
          const selected = ranked[0];
          if (!selected) {
            throw new Error("Typography profile corpus produced no candidates.");
          }
          recentlyUsedProfileNames.push(selected.profile.profileName);
          if (recentlyUsedProfileNames.length > 8) {
            recentlyUsedProfileNames.shift();
          }
          const selectionMs = performance.now() - selectionStarted;

          const fontResolutionStarted = performance.now();
          const primaryLayer = primaryLayerFor(selected.profile);
          const primaryBinding = resolveTypographyProfileLayer({
            layer: primaryLayer,
            profileMood: selected.profile.metadata.overallMood,
            catalog,
            executableAssets,
          });
          const bindingsByLayerName = new Map([
            [primaryLayer.layerName, primaryBinding],
          ]);
          for (const layer of selected.profile.layers) {
            if (layer.layerName === primaryLayer.layerName) continue;
            const shouldExcludePrimary = layersRequestContrast(primaryLayer, layer);
            try {
              bindingsByLayerName.set(
                layer.layerName,
                resolveTypographyProfileLayer({
                  layer,
                  profileMood: selected.profile.metadata.overallMood,
                  catalog,
                  executableAssets,
                  excludedAssetIds: shouldExcludePrimary
                    ? [primaryBinding.selectedAsset.assetId]
                    : [],
                }),
              );
            } catch (error) {
              if (!shouldExcludePrimary) throw error;
              bindingsByLayerName.set(
                layer.layerName,
                resolveTypographyProfileLayer({
                  layer,
                  profileMood: selected.profile.metadata.overallMood,
                  catalog,
                  executableAssets,
                }),
              );
            }
          }
          const accentLayer = accentLayerFor({
            profile: selected.profile,
            primary: primaryLayer,
          });
          const accentBinding = accentLayer
            ? bindingsByLayerName.get(accentLayer.layerName) ?? null
            : null;
          const fontResolutionMs = performance.now() - fontResolutionStarted;

          const measurementFontSizePx = measurementSizeFor(primaryLayer);
          const providerKey = [
            primaryBinding.selectedAsset.assetId,
            accentBinding?.selectedAsset.assetId ?? primaryBinding.selectedAsset.assetId,
            measurementFontSizePx,
          ].join(":");
          let provider = providerByKey.get(providerKey);
          if (!provider) {
            provider = createResolvedMaulTypographyProvider({
              primary: primaryBinding.selectedAsset,
              accent:
                accentBinding?.selectedAsset ?? primaryBinding.selectedAsset,
              measurementFontSizePx,
            });
            providerByKey.set(providerKey, provider);
          }
          const measurementStarted = performance.now();
          const measured = await provider.plan({
            chunks: [{chunkId: chunk.chunkId, text: chunk.text}],
            maximumLineWidthPx: input.maximumLineWidthPx,
            primaryTypeRole: "editorial_display",
          });
          const measurementMs = performance.now() - measurementStarted;
          if (measured.status !== "available") {
            throw new Error(
              `Typography profile ${selected.profile.profileName} could not measure ${chunk.chunkId}: ${measured.reason}`,
            );
          }
          const measuredLayout = measured.layouts[0];
          if (!measuredLayout || measuredLayout.chunkId !== chunk.chunkId) {
            throw new Error(
              `Typography measurement omitted governed chunk ${chunk.chunkId}.`,
            );
          }
          const layout: MaulMeasuredTypographyLayout = {
            chunkId: measuredLayout.chunkId,
            fontSizePx: measuredLayout.fontSizePx,
            lines: measuredLayout.lines,
            measurementIds: measuredLayout.measurementIds,
          };
          const layerBindings = selected.profile.layers.map((layer) => {
            const binding = bindingsByLayerName.get(layer.layerName);
            if (!binding) {
              throw new Error(
                `Typography profile layer ${layer.layerName} was not resolved.`,
              );
            }
            return binding;
          });
          const realization = compileTypographyProfileRealization({
            profile: selected.profile,
            tokens: chunk.tokens,
            bindingsByLayerName,
            measureToken: ({tokenId, text, font, fontSizePx}) =>
              measureProfileLayer({tokenId, text, font, fontSizePx}),
          });
          const bindingReceipt = {
            schemaVersion: "maul-chunk-typography-binding/v1" as const,
            chunkId: chunk.chunkId,
            profile: {
              name: selected.profile.profileName,
              version: selected.profile.version,
              sourceFilename: selected.profile.sourceFilename,
              sourceSha256: selected.profile.sourceSha256,
              observedAspectRatio: selected.profile.metadata.targetAspectRatio,
              targetAspectRatio: input.targetAspectRatio,
              adaptation:
                selected.profile.metadata.targetAspectRatio === "9:16"
                  ? ("native_9_16" as const)
                  : ("normalized_to_9_16" as const),
            },
            counts: {
              actualWordCount: chunk.wordCount,
              actualCharacterCount: countTypographyCharacters(chunk.text),
              observedWordCount: selected.profile.metadata.totalWordCount,
              observedCharacterCount:
                selected.profile.metadata.totalCharacterCount,
              wordDistance: selected.wordDistance,
              characterDistance: selected.characterDistance,
            },
            primaryLayerName: primaryLayer.layerName,
            accentLayerName: accentLayer?.layerName ?? null,
            layers: layerBindings,
            compatibilityProfile: measured.profile,
            layout,
            realization,
            selectionStatus: "selected" as const,
            reason: `Selected ${selected.profile.profileName} by word distance ${selected.wordDistance} and character distance ${selected.characterDistance}; exact or closest deployed font receipts were measured before placement.`,
          };
          const binding = maulChunkTypographyBindingSchema.parse({
            ...bindingReceipt,
            bindingHash: hashMaulPlanPayload(bindingReceipt),
            timingMs: {
              selection: roundTiming(selectionMs),
              fontResolution: roundTiming(fontResolutionMs),
              measurement: roundTiming(measurementMs),
            },
          });
          compiledChunks.push({
            binding,
            profile: measured.profile,
            layout,
            fontResolution: {
              ...measured.fontResolution,
              selectedAsset: primaryBinding.selectedAsset,
              accentAsset: accentBinding?.selectedAsset ?? null,
              reason: `${measured.fontResolution.reason} ${binding.reason}`,
            },
          });
        }
        const compatibilityProfiles = [
          ...new Map(
            compiledChunks.map((chunk) => [chunk.profile.profileId, chunk.profile]),
          ).values(),
        ];
        const evidenceIds = [
          ...new Set(
            compiledChunks.flatMap((chunk) => [
              ...chunk.layout.measurementIds,
              ...(
                chunk.binding.realization?.layers.map(
                  (layer) => layer.measurementId,
                ) ?? []
              ),
            ]),
          ),
        ].sort();
        const fontPairKeys = new Set(
          compiledChunks.map((chunk) =>
            [
              chunk.fontResolution.selectedAssetId,
              chunk.fontResolution.accentAsset?.assetId ?? "none",
            ].join(":"),
          ),
        );
        const fontResolution: TypographyProfileFontResolutionSummary =
          fontPairKeys.size === 1
            ? compiledChunks[0]!.fontResolution
            : {
                requestedRole: "editorial",
                selectedFamily: "Mixed chunk typography",
                selectedAssetId: null,
                selectedAsset: null,
                accentAsset: null,
                status: "eligible_loaded",
                reason: `${compiledChunks.length} chunks selected distinct measured font pairs; exact render assets are authoritative in chunkTypographyBindings.`,
              };
        return {
          status: "available",
          bindings: compiledChunks.map((chunk) => chunk.binding),
          chunks: compiledChunks,
          compatibilityProfiles,
          evidenceIds,
          fontResolution,
        };
      } catch (error) {
        return {
          status: "unavailable",
          reason: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
};
