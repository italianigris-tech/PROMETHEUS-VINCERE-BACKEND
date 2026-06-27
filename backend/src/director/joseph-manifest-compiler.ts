import {UnifiedRenderManifestSchema, type UnifiedRenderManifest} from "@prometheus/shared-types";

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
  "josephBackground",
  "josephTypography",
  "josephChoreography",
  "cameraMoves",
] as const;

export type JosephManifestCompilerMode = "pass_through";

export type JosephManifestCompilerAuditReferences = {
  candidateScoreSummary?: boolean;
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

export type JosephManifestCompilerInput = {
  manifest: UnifiedRenderManifest;
  auditReferences?: JosephManifestCompilerAuditReferences;
};

export type JosephManifestCompilerResult = {
  manifest: UnifiedRenderManifest;
  audit: JosephManifestCompilerAudit;
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

export const compileJosephManifest = ({
  manifest,
  auditReferences = {},
}: JosephManifestCompilerInput): JosephManifestCompilerResult => {
  UnifiedRenderManifestSchema.parse(manifest);

  const preservedFieldPaths = [...JOSEPH_MANIFEST_COMPILER_PRESERVED_FIELD_PATHS];

  return {
    manifest,
    audit: {
      version: JOSEPH_MANIFEST_COMPILER_VERSION,
      mode: "pass_through",
      deterministic: true,
      schemaVersion: manifest.version,
      preservedFieldPaths,
      presentFieldPaths: preservedFieldPaths.filter((path) => hasPreservedField(manifest, path)),
      auditReferences,
    },
  };
};
