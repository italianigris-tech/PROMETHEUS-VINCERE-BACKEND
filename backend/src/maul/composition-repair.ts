import {createHash} from "node:crypto";

const recomputableDimensions = [
  "semanticHierarchy",
  "fontRoleAssignment",
  "shaping",
  "lineBreaks",
  "glyphBounds",
  "collision",
  "balance",
  "declaration",
] as const;

const frozenDimensions = [
  "sourceTransform",
  "sceneEvidence",
  "treatmentFamily",
  "palette",
  "motionFamily",
  "renderer",
  "seed",
  "budget",
] as const;

export type CompositionRepairDimension = typeof recomputableDimensions[number];
type FrozenCompositionDimension = typeof frozenDimensions[number];
type CompositionStateDimension = CompositionRepairDimension | FrozenCompositionDimension;

export const COMPOSITION_REPAIR_DEPENDENCY_GRAPH = {
  version: "maul-composition-repair-dependencies/v1",
  dependencies: {
    semanticHierarchy: ["fontRoleAssignment"],
    fontRoleAssignment: ["shaping"],
    shaping: ["lineBreaks"],
    lineBreaks: ["glyphBounds"],
    glyphBounds: ["collision"],
    collision: ["balance"],
    balance: ["declaration"],
    declaration: [],
  } satisfies Record<CompositionRepairDimension, CompositionRepairDimension[]>,
} as const;

export const computeRepairDependencyClosure = (
  target: CompositionRepairDimension,
): CompositionRepairDimension[] => {
  const visited = new Set<CompositionRepairDimension>();
  const visit = (dimension: CompositionRepairDimension): void => {
    if (visited.has(dimension)) return;
    visited.add(dimension);
    for (const dependent of COMPOSITION_REPAIR_DEPENDENCY_GRAPH.dependencies[dimension]) {
      visit(dependent);
    }
  };
  visit(target);
  return recomputableDimensions.filter((dimension) => visited.has(dimension));
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
const fingerprint = (value: unknown): string =>
  createHash("sha256").update(canonicalJson(value)).digest("hex");

type CompositionRepairState = Record<CompositionStateDimension, unknown>;

export type CompositionRepairLedgerEntry = {
  schemaVersion: "maul-composition-repair-ledger-entry/v1";
  repairId: string;
  parentDeclarationId: string;
  childDeclarationId: string;
  diagnosis: string;
  targetDimension: CompositionRepairDimension;
  dependencyGraphVersion: typeof COMPOSITION_REPAIR_DEPENDENCY_GRAPH.version;
  recomputedDimensions: CompositionRepairDimension[];
  changedDimensions: CompositionRepairDimension[];
  frozenDimensions: FrozenCompositionDimension[];
  beforeFingerprint: string;
  afterFingerprint: string;
  dimensionFingerprints: Record<
    CompositionStateDimension,
    {before: string; after: string; changed: boolean}
  >;
};

export const createCompositionRepairLedgerEntry = ({
  repairId,
  parentDeclarationId,
  childDeclarationId,
  targetDimension,
  before,
  after,
  diagnosis,
}: {
  repairId: string;
  parentDeclarationId: string;
  childDeclarationId: string;
  targetDimension: CompositionRepairDimension;
  before: CompositionRepairState;
  after: CompositionRepairState;
  diagnosis: string;
}): CompositionRepairLedgerEntry => {
  const recomputed = computeRepairDependencyClosure(targetDimension);
  const allDimensions: CompositionStateDimension[] = [
    ...recomputableDimensions,
    ...frozenDimensions,
  ];
  const dimensionFingerprints = Object.fromEntries(
    allDimensions.map((dimension) => {
      const beforeHash = fingerprint(before[dimension]);
      const afterHash = fingerprint(after[dimension]);
      return [dimension, {
        before: beforeHash,
        after: afterHash,
        changed: beforeHash !== afterHash,
      }];
    }),
  ) as CompositionRepairLedgerEntry["dimensionFingerprints"];

  for (const dimension of frozenDimensions) {
    if (dimensionFingerprints[dimension].changed) {
      throw new Error(
        `Composition repair is invalid because frozen dimension ${dimension} changed.`,
      );
    }
  }
  for (const dimension of recomputableDimensions) {
    if (
      dimensionFingerprints[dimension].changed &&
      !recomputed.includes(dimension)
    ) {
      throw new Error(
        `Composition repair changed ${dimension} outside the dependency closure.`,
      );
    }
  }
  if (!dimensionFingerprints[targetDimension].changed) {
    throw new Error(
      `Composition repair target ${targetDimension} did not change.`,
    );
  }

  return {
    schemaVersion: "maul-composition-repair-ledger-entry/v1",
    repairId,
    parentDeclarationId,
    childDeclarationId,
    diagnosis,
    targetDimension,
    dependencyGraphVersion: COMPOSITION_REPAIR_DEPENDENCY_GRAPH.version,
    recomputedDimensions: recomputed,
    changedDimensions: recomputableDimensions.filter(
      (dimension) => dimensionFingerprints[dimension].changed,
    ),
    frozenDimensions: [...frozenDimensions],
    beforeFingerprint: fingerprint(before),
    afterFingerprint: fingerprint(after),
    dimensionFingerprints,
  };
};
