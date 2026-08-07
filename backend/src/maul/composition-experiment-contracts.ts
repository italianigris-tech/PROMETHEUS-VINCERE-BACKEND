import {createHash} from "node:crypto";

import {z} from "zod";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const boxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().positive().max(1),
  height: z.number().positive().max(1),
}).strict();

const declaredCompositionSchema = z.object({
  declarationId: z.string().min(1),
  parentDeclarationId: z.string().min(1).nullable(),
  fixtureId: z.string().min(1),
  sourceGroup: z.string().min(1),
  sourceSha256: sha256Schema,
  causalLineage: z.object({
    fixtureEvidenceIds: z.array(z.string().min(1)).min(1),
    referenceObservationIds: z.array(z.string().min(1)).min(1),
    semanticTreeId: z.string().min(1),
    semanticHypothesisId: z.string().min(1),
    treatmentGenomeArtifactId: z.string().min(1),
    planningBundleArtifactId: z.string().min(1),
    visualRealizationId: z.string().min(1),
  }).strict(),
  typography: z.object({
    roles: z.array(z.object({
      role: z.enum(["hero", "support", "accent", "tail"]),
      tokenIds: z.array(z.string().min(1)).min(1),
      font: z.object({
        assetId: z.string().min(1),
        family: z.string().min(1),
        sha256: sha256Schema,
        status: z.enum(["verified", "unverified"]),
      }).strict(),
    }).strict()).min(1),
    lineBreaks: z.array(z.array(z.string().min(1)).min(1)).min(1),
    shapedBoundsPx: z.object({
      left: z.number().nonnegative(),
      top: z.number().nonnegative(),
      width: z.number().positive(),
      height: z.number().positive(),
    }).strict(),
  }).strict(),
  placement: z.object({
    box: boxSchema,
    depthMode: z.enum(["front", "behind_subject", "integrated", "avoid_subject"]),
    sceneEvidenceIds: z.array(z.string().min(1)).min(1),
  }).strict(),
  treatment: z.object({
    family: z.string().min(1),
    primitives: z.array(z.string().min(1)).min(1),
    colors: z.array(z.string().min(1)).min(1),
  }).strict(),
  motion: z.object({
    family: z.string().min(1),
    trajectorySamples: z.array(z.object({
      outputMs: z.number().nonnegative(),
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
    }).strict()).min(1),
  }).strict(),
  sourceTransform: z.record(z.string(), z.unknown()),
  requiredObservations: z.array(z.string().min(1)).min(1),
  presentationFields: z.array(z.string().min(1)).min(1),
  capabilityVerification: z.array(z.object({
    capabilityId: z.string().min(1),
    status: z.enum(["verified", "degraded", "blocked"]),
    supports: z.array(z.string().min(1)).min(1),
    evidenceIds: z.array(z.string().min(1)).min(1),
  }).strict()).min(1),
  fallbacks: z.array(z.object({
    trigger: z.string().min(1),
    substitutedBehavior: z.string().min(1),
    affectedField: z.string().min(1),
    verified: z.boolean(),
  }).strict()),
  versions: z.object({
    declaration: z.string().min(1),
    renderer: z.string().min(1),
    observer: z.string().min(1),
    policy: z.string().min(1),
  }).strict(),
}).strict();

export type DeclaredCompositionInput = z.input<typeof declaredCompositionSchema>;
export type DeclaredComposition = z.output<typeof declaredCompositionSchema> & {
  schemaVersion: "maul-declared-composition/v1";
  declarationSha256: string;
};

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
};

const canonicalJson = (value: unknown): string => JSON.stringify(canonicalize(value));

const deepFreeze = <T>(value: T): T => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  return value;
};

export const freezeDeclaredComposition = (
  input: DeclaredCompositionInput,
): DeclaredComposition => {
  if (input.placement.sceneEvidenceIds.length === 0) {
    throw new Error("Declared Composition requires scene evidence for placement.");
  }
  const parsed = declaredCompositionSchema.parse(input);
  if (parsed.causalLineage.fixtureEvidenceIds.length === 0) {
    throw new Error("Declared Composition requires scene fixture evidence.");
  }
  if (parsed.placement.sceneEvidenceIds.length === 0) {
    throw new Error("Declared Composition requires scene evidence for placement.");
  }
  if (parsed.typography.roles.some((role) => role.font.status !== "verified")) {
    throw new Error("Declared Composition requires every selected font to be verified.");
  }
  for (const fallback of parsed.fallbacks) {
    if (!fallback.verified) {
      throw new Error(
        `Declared Composition contains an unverified fallback for ${fallback.affectedField}.`,
      );
    }
  }
  const capabilitiesByField = new Map<string, Array<{status: string; capabilityId: string}>>();
  for (const capability of parsed.capabilityVerification) {
    for (const field of capability.supports) {
      const providers = capabilitiesByField.get(field) ?? [];
      providers.push({status: capability.status, capabilityId: capability.capabilityId});
      capabilitiesByField.set(field, providers);
    }
  }
  for (const field of parsed.presentationFields) {
    const providers = capabilitiesByField.get(field) ?? [];
    if (providers.length === 0) {
      throw new Error(`No verified capability maps presentation field ${field}.`);
    }
    if (!providers.some((provider) => provider.status === "verified")) {
      throw new Error(
        `Presentation field ${field} has no verified capability; provider state is ${providers.map((provider) => provider.status).join(", ")}.`,
      );
    }
  }
  const declarationBody = {
    schemaVersion: "maul-declared-composition/v1" as const,
    ...parsed,
  };
  const declarationSha256 = createHash("sha256")
    .update(canonicalJson(declarationBody))
    .digest("hex");
  return deepFreeze({...declarationBody, declarationSha256});
};
