import {createHash} from "node:crypto";
import {
  UnifiedRenderManifestSchema,
  type JosephPlannerHandoff,
  type UnifiedRenderManifest,
} from "@prometheus/shared-types";

export const JOSEPH_MANIFEST_COMPILER_VERSION = "joseph-manifest-compiler-v1" as const;

export const JOSEPH_MANIFEST_COMPILER_PRESERVED_FIELD_PATHS = [
  "source",
  "videoTracks",
  "audio",
  "timeline",
  "textOverlays",
  "textOverlays.microAnimation",
  "microAnimationAudit",
  "josephPiP",
  "josephMacroRig",
  "josephBackground",
  "josephTypography",
  "josephChoreography",
  "cameraMoves",
  "plannerHandoff",
  "plannerHandoff.retrievalIntent",
  "plannerHandoff.godEscalationIntent",
  "plannerHandoff.compiledManifestHash",
] as const;

const JOSEPH_MANIFEST_COMPILER_COMPILED_TARGET_FIELD_PATHS = [
  "textOverlays.microAnimation",
  "josephPiP",
  "josephMacroRig",
  "cameraMoves",
  "josephTypography",
  "josephBackground",
  "josephChoreography",
  "plannerHandoff",
  "plannerHandoff.retrievalIntent",
  "plannerHandoff.godEscalationIntent",
  "plannerHandoff.fallbacks",
  "plannerHandoff.inputManifestHash",
  "plannerHandoff.compiledManifestHash",
] as const;

export type JosephManifestCompilerMode = "pass_through" | "compile_manifest";
export type JosephManifestCompilerArtifactMode = "phase0_read_only";

export type JosephManifestCompilerAuditReferences = {
  candidateScoreSummary?: boolean;
  candidateScoreSummaryRef?: string;
  compilerArtifactRef?: string;
  plannerAuditRef?: string;
  candidateScoreCount?: number;
  expectedCutCount?: number;
};

export type JosephManifestCompilerAudit = {
  version: typeof JOSEPH_MANIFEST_COMPILER_VERSION;
  mode: JosephManifestCompilerMode;
  deterministic: true;
  schemaVersion: UnifiedRenderManifest["version"];
  preservedFieldPaths: string[];
  presentFieldPaths: string[];
  auditReferences: JosephManifestCompilerAuditReferences;
};

export type JosephSelectedPlannerCandidate = {
  plannerPathId: string;
  selectedCandidateId: string;
  genomeIds: string[];
  doctrineBranchIds: string[];
  archiveCellKeys: string[];
  treatmentFamily?: string;
  finalTreatment?: string;
  retrievalIntent?: "skip" | "reuse-existing" | "reuse-with-variation" | "search-deeper" | string;
  godEscalationIntent?: "forbidden" | "allowed-if-no-fit" | "preferred-for-precision" | string;
};

export type JosephManifestCompilerFallback = {
  field: string;
  tag: string;
  reason: string;
};

export type JosephManifestCompilerArtifact = {
  version: typeof JOSEPH_MANIFEST_COMPILER_VERSION;
  mode: JosephManifestCompilerArtifactMode;
  deterministic: true;
  inputPlannerIds: {
    plannerPathId: string;
    selectedCandidateId: string;
    genomeIds: string[];
    doctrineBranchIds: string[];
    archiveCellKeys: string[];
  };
  targetManifestFields: string[];
  fallbacks: JosephManifestCompilerFallback[];
  warnings: string[];
  manifestHash: string;
  artifactHash: string;
};

export type JosephManifestCompilerInput = {
  manifest: UnifiedRenderManifest;
  mode?: JosephManifestCompilerMode;
  variationKey?: string;
  auditReferences?: JosephManifestCompilerAuditReferences;
  selectedPlannerCandidate?: JosephSelectedPlannerCandidate;
};

export type JosephManifestCompilerResult = {
  manifest: UnifiedRenderManifest;
  audit: JosephManifestCompilerAudit;
  artifact?: JosephManifestCompilerArtifact;
};

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value) ?? "undefined";
};

const sha256Json = (value: unknown): string => createHash("sha256").update(stableJson(value)).digest("hex");

const uniqueStrings = (items: string[]): string[] => [...new Set(items)];

const targetManifestFieldsFor = (manifest: UnifiedRenderManifest): string[] => uniqueStrings([
  "source",
  "videoTracks",
  "timeline",
  "textOverlays",
  ...(manifest.textOverlays.some((overlay) => Boolean(overlay.microAnimation)) ? ["textOverlays.microAnimation"] : []),
  ...(manifest.microAnimationAudit ? ["microAnimationAudit"] : []),
  ...(manifest.josephPiP ? ["josephPiP"] : []),
  ...(manifest.josephMacroRig ? ["josephMacroRig"] : []),
  ...(manifest.josephBackground ? ["josephBackground"] : []),
  ...(manifest.josephTypography ? ["josephTypography"] : []),
  ...(manifest.josephChoreography ? ["josephChoreography"] : []),
  ...(manifest.cameraMoves.length > 0 ? ["cameraMoves"] : []),
  ...(manifest.audio.sfx.length > 0 ? ["audio.sfx"] : []),
]).sort();

const compiledTargetManifestFieldsFor = (manifest: UnifiedRenderManifest): string[] => uniqueStrings([
  ...targetManifestFieldsFor(manifest),
  ...JOSEPH_MANIFEST_COMPILER_COMPILED_TARGET_FIELD_PATHS,
]).sort();

const fallbackForSelectedPlannerCandidate = (candidate: JosephSelectedPlannerCandidate): JosephManifestCompilerFallback[] => {
  const fallbacks: JosephManifestCompilerFallback[] = [];

  if (candidate.treatmentFamily) {
    fallbacks.push({
      field: "treatmentFamily",
      tag: "compiler_treatment_family_unmapped",
      reason: "Treatment family identity is preserved as compiler evidence until Stack B has a first-class renderer field.",
    });
  }

  if (candidate.finalTreatment?.includes("behind-speaker") || candidate.finalTreatment?.includes("matte")) {
    fallbacks.push({
      field: "finalTreatment",
      tag: "compiler_matte_required_unavailable",
      reason: "Behind-subject matte intent needs RVM render evidence before the compiler may assert a matte-capable render field.",
    });
  } else if (candidate.finalTreatment) {
    fallbacks.push({
      field: "finalTreatment",
      tag: "compiler_final_treatment_downgraded",
      reason: "Final treatment is represented by current manifest fields or preserved as compiler evidence.",
    });
  }

  if (candidate.retrievalIntent === "reuse-with-variation") {
    fallbacks.push({
      field: "retrievalIntent",
      tag: "asset_variation_deferred",
      reason: "Asset variation is evidence-only until governed asset variation is live.",
    });
  } else if (candidate.retrievalIntent === "search-deeper") {
    fallbacks.push({
      field: "retrievalIntent",
      tag: "deep_retrieval_deferred",
      reason: "Deep retrieval is evidence-only until a render-safe retrieval trace can be attached.",
    });
  } else if (candidate.retrievalIntent === "reuse-existing") {
    fallbacks.push({
      field: "retrievalIntent",
      tag: "asset_reuse_unresolved",
      reason: "Existing asset reuse remains evidence-only unless a render-safe manifest reference is already present.",
    });
  }

  if (candidate.godEscalationIntent === "preferred-for-precision") {
    fallbacks.push({
      field: "godEscalationIntent",
      tag: "god_precision_required_unavailable",
      reason: "GOD precision requests are blocked from mutating render output until governed generation is live.",
    });
  } else if (candidate.godEscalationIntent === "allowed-if-no-fit") {
    fallbacks.push({
      field: "godEscalationIntent",
      tag: "god_escalation_deferred",
      reason: "GOD escalation is evidence-only until retrieval miss evidence and generation governance are live.",
    });
  } else if (candidate.godEscalationIntent === "forbidden") {
    fallbacks.push({
      field: "godEscalationIntent",
      tag: "god_generation_forbidden",
      reason: "GOD generation is explicitly forbidden for this selected path.",
    });
  }

  return fallbacks;
};

const fallbackForMissingCompiledFields = (manifest: UnifiedRenderManifest): JosephManifestCompilerFallback[] => {
  const fallbacks: JosephManifestCompilerFallback[] = [];
  const push = (field: string, tag: string, reason: string) => fallbacks.push({field, tag, reason});

  if (!manifest.textOverlays.some((overlay) => Boolean(overlay.microAnimation))) {
    push(
      "textOverlays.microAnimation",
      "compiler_micro_animation_missing",
      "Planner-selected micro-animation intent had no renderable micro-animation field; renderer must not invent one silently.",
    );
  }

  if (!manifest.josephPiP) {
    push("josephPiP", "compiler_pip_missing", "Planner-selected PiP intent had no renderable PiP plan.");
  }

  if (manifest.cameraMoves.length === 0) {
    push("cameraMoves", "compiler_camera_missing", "Planner-selected camera intent had no renderable camera move field.");
  }

  if (!manifest.josephTypography) {
    push("josephTypography", "compiler_typography_missing", "Planner-selected typography intent had no Joseph typography plan.");
  }

  if (!manifest.josephBackground) {
    push("josephBackground", "compiler_background_missing", "Planner-selected background intent had no Joseph background plan.");
  }

  if (!manifest.josephChoreography) {
    push("josephChoreography", "compiler_choreography_missing", "Planner-selected choreography intent had no Joseph choreography plan.");
  }

  return fallbacks;
};

const buildPhase0Artifact = ({
  manifest,
  selectedPlannerCandidate,
}: {
  manifest: UnifiedRenderManifest;
  selectedPlannerCandidate: JosephSelectedPlannerCandidate;
}): JosephManifestCompilerArtifact => {
  const withoutHash = {
    version: JOSEPH_MANIFEST_COMPILER_VERSION,
    mode: "phase0_read_only" as const,
    deterministic: true as const,
    inputPlannerIds: {
      plannerPathId: selectedPlannerCandidate.plannerPathId,
      selectedCandidateId: selectedPlannerCandidate.selectedCandidateId,
      genomeIds: [...selectedPlannerCandidate.genomeIds],
      doctrineBranchIds: [...selectedPlannerCandidate.doctrineBranchIds],
      archiveCellKeys: [...selectedPlannerCandidate.archiveCellKeys],
    },
    targetManifestFields: targetManifestFieldsFor(manifest),
    fallbacks: fallbackForSelectedPlannerCandidate(selectedPlannerCandidate),
    warnings: ["Phase 0 compiler artifact only; manifest output was not mutated."],
    manifestHash: sha256Json(manifest),
  };

  return {
    ...withoutHash,
    artifactHash: sha256Json(withoutHash),
  };
};

const optionalPlannerIntentFields = (candidate: JosephSelectedPlannerCandidate) => ({
  ...(candidate.treatmentFamily ? {treatmentFamily: candidate.treatmentFamily} : {}),
  ...(candidate.finalTreatment ? {finalTreatment: candidate.finalTreatment} : {}),
  ...(candidate.retrievalIntent ? {retrievalIntent: candidate.retrievalIntent} : {}),
  ...(candidate.godEscalationIntent ? {godEscalationIntent: candidate.godEscalationIntent} : {}),
});

const buildPlannerHandoff = ({
  manifest,
  selectedPlannerCandidate,
  variationKey,
}: {
  manifest: UnifiedRenderManifest;
  selectedPlannerCandidate: JosephSelectedPlannerCandidate;
  variationKey: string;
}): JosephPlannerHandoff => {
  const fallbacks = [
    ...fallbackForMissingCompiledFields(manifest),
    ...fallbackForSelectedPlannerCandidate(selectedPlannerCandidate),
  ];
  const handoffWithoutHash = {
    version: "joseph-planner-handoff-v1" as const,
    compilerVersion: JOSEPH_MANIFEST_COMPILER_VERSION,
    deterministic: true as const,
    plannerPathId: selectedPlannerCandidate.plannerPathId,
    selectedCandidateId: selectedPlannerCandidate.selectedCandidateId,
    genomeIds: [...selectedPlannerCandidate.genomeIds],
    doctrineBranchIds: [...selectedPlannerCandidate.doctrineBranchIds],
    archiveCellKeys: [...selectedPlannerCandidate.archiveCellKeys],
    targetManifestFields: compiledTargetManifestFieldsFor(manifest),
    ...optionalPlannerIntentFields(selectedPlannerCandidate),
    variationKey,
    fallbacks,
    warnings: fallbacks.length > 0
      ? ["Compiled manifest contains governed fallbacks; renderer must not invent omitted planner intent."]
      : [],
    inputManifestHash: sha256Json(manifest),
  };
  const compiledManifestHash = sha256Json({
    manifest: {
      ...manifest,
      plannerHandoff: {
        ...handoffWithoutHash,
        compiledManifestHash: "0".repeat(64),
      },
    },
    variationKey,
  });

  return {
    ...handoffWithoutHash,
    compiledManifestHash,
  };
};

const buildCompiledManifest = ({
  manifest,
  selectedPlannerCandidate,
  variationKey,
}: {
  manifest: UnifiedRenderManifest;
  selectedPlannerCandidate: JosephSelectedPlannerCandidate;
  variationKey: string;
}): UnifiedRenderManifest => {
  const plannerHandoff = buildPlannerHandoff({manifest, selectedPlannerCandidate, variationKey});
  return UnifiedRenderManifestSchema.parse({
    ...manifest,
    plannerHandoff,
  });
};

const hasPreservedField = (manifest: UnifiedRenderManifest, path: string): boolean => {
  if (path === "textOverlays.microAnimation") {
    return manifest.textOverlays.some((overlay) => Boolean(overlay.microAnimation));
  }

  return path.split(".").every((_, index, segments) => {
    const target = segments.slice(0, index + 1).reduce<unknown>((value, key) => {
      if (value && typeof value === "object" && key in value) {
        return (value as Record<string, unknown>)[key];
      }

      return undefined;
    }, manifest);

    return target !== undefined;
  });
};

const buildAudit = ({
  manifest,
  mode,
  auditReferences,
}: {
  manifest: UnifiedRenderManifest;
  mode: JosephManifestCompilerMode;
  auditReferences: JosephManifestCompilerAuditReferences;
}): JosephManifestCompilerAudit => {
  const preservedFieldPaths = [...JOSEPH_MANIFEST_COMPILER_PRESERVED_FIELD_PATHS];
  return {
    version: JOSEPH_MANIFEST_COMPILER_VERSION,
    mode,
    deterministic: true,
    schemaVersion: manifest.version,
    preservedFieldPaths,
    presentFieldPaths: preservedFieldPaths.filter((path) => hasPreservedField(manifest, path)),
    auditReferences,
  };
};

export const compileJosephManifest = ({
  manifest,
  mode = "pass_through",
  variationKey,
  auditReferences = {},
  selectedPlannerCandidate,
}: JosephManifestCompilerInput): JosephManifestCompilerResult => {
  const parsedManifest = UnifiedRenderManifestSchema.parse(manifest);

  if (mode === "compile_manifest") {
    if (!selectedPlannerCandidate) {
      throw new Error("compile_manifest mode requires a selected planner candidate.");
    }

    const compiledManifest = buildCompiledManifest({
      manifest: parsedManifest,
      selectedPlannerCandidate,
      variationKey: variationKey ?? `${parsedManifest.jobId}:${parsedManifest.seed}`,
    });

    return {
      manifest: compiledManifest,
      audit: buildAudit({manifest: compiledManifest, mode, auditReferences}),
    };
  }

  const result: JosephManifestCompilerResult = {
    manifest,
    audit: buildAudit({manifest, mode, auditReferences}),
  };

  if (selectedPlannerCandidate) {
    result.artifact = buildPhase0Artifact({manifest: parsedManifest, selectedPlannerCandidate});
  }

  return result;
};
