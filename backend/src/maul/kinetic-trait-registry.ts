import registryJson from "../../../kinetic_trait_registry.json" with {type: "json"};

export type KineticTraitConcern =
  | "SemanticTypographyTree"
  | "TypographicRealization"
  | "CompositionGeometry"
  | "MotionTopology"
  | "MotionPhysics"
  | "MaterialTreatment"
  | "EnclosureAndAccents"
  | "TemporalTrigger";

export type KineticTraitContract = {
  id: string;
  name: string;
  sourcePhenotype: string;
  concern: KineticTraitConcern;
  targetScope: "layer" | "phrase" | "word" | "glyph";
  targetRoles: Array<"hero" | "support" | "accent" | "tail">;
  ownsChannels: string[];
  requires: string[];
  conflictsWith: string[];
  renderMode: "frame-deterministic";
  execution:
    | {status: "contract_only"}
    | {status: "typed_adapter"; executorId: string};
  frameExpression: Record<string, string | number>;
  cost: {domNodes: number; filters: number};
  readabilityLimits: {maxWords: number};
};

export type KineticTraitRegistry = {
  schemaVersion: "prometheus-kinetic-trait-registry/v1";
  name: string;
  version: string;
  description: string;
  traits: KineticTraitContract[];
};

export type KineticTraitRegistryIssue = {
  code:
    | "duplicate_trait_id"
    | "unknown_conflict_reference"
    | "asymmetric_conflict"
    | "duplicate_owned_channel"
    | "invalid_trait_contract";
  traitId: string;
  message: string;
};

const LEGACY_TRAIT_ALIASES: Readonly<Record<string, string>> = {
  gooey_metaball_filter: "trait_liquid_gooey_morph",
  hand_drawn_svg_path: "trait_hand_drawn_underline",
  subpixel_blur_mask: "trait_blur_up_reveal",
};

const canonicalTraitId = (value: string, knownIds: ReadonlySet<string>): string => {
  if (knownIds.has(value)) return value;
  const explicitAlias = LEGACY_TRAIT_ALIASES[value];
  if (explicitAlias) return explicitAlias;
  const prefixed = `trait_${value}`;
  return knownIds.has(prefixed) ? prefixed : value;
};

export const normalizeKineticTraitRegistry = (input: unknown): KineticTraitRegistry => {
  const source = input as Omit<KineticTraitRegistry, "schemaVersion"> & {schemaVersion?: string};
  const traits = structuredClone(source.traits);
  const knownIds = new Set(traits.map((trait) => trait.id));
  for (const trait of traits) {
    trait.execution ??= {status: "contract_only"};
    trait.conflictsWith = [...new Set(trait.conflictsWith.map((conflictId) =>
      canonicalTraitId(conflictId, knownIds)
    ))];
  }
  for (const trait of traits) {
    for (const conflictId of trait.conflictsWith) {
      const conflict = traits.find((candidate) => candidate.id === conflictId);
      if (conflict && !conflict.conflictsWith.includes(trait.id)) {
        conflict.conflictsWith.push(trait.id);
      }
    }
  }
  return {
    ...source,
    schemaVersion: "prometheus-kinetic-trait-registry/v1",
    traits,
  };
};

export const KINETIC_TRAIT_REGISTRY = normalizeKineticTraitRegistry(registryJson);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const validateKineticTraitRegistry = (
  registry: KineticTraitRegistry,
): KineticTraitRegistryIssue[] => {
  const issues: KineticTraitRegistryIssue[] = [];
  const ids = new Set<string>();
  for (const trait of registry.traits) {
    if (ids.has(trait.id)) {
      issues.push({
        code: "duplicate_trait_id",
        traitId: trait.id,
        message: `Trait ID ${trait.id} is duplicated.`,
      });
    }
    ids.add(trait.id);
    if (
      !isNonEmptyString(trait.id) ||
      !isNonEmptyString(trait.sourcePhenotype) ||
      trait.renderMode !== "frame-deterministic" ||
      (trait.execution.status === "typed_adapter" &&
        !isNonEmptyString(trait.execution.executorId)) ||
      trait.targetRoles.length === 0 ||
      trait.ownsChannels.length === 0 ||
      trait.readabilityLimits.maxWords < 1
    ) {
      issues.push({
        code: "invalid_trait_contract",
        traitId: trait.id,
        message: `Trait ${trait.id} does not satisfy the executable contract.`,
      });
    }
    if (new Set(trait.ownsChannels).size !== trait.ownsChannels.length) {
      issues.push({
        code: "duplicate_owned_channel",
        traitId: trait.id,
        message: `Trait ${trait.id} owns the same render channel more than once.`,
      });
    }
  }

  for (const trait of registry.traits) {
    for (const conflictId of trait.conflictsWith) {
      if (!ids.has(conflictId)) {
        issues.push({
          code: "unknown_conflict_reference",
          traitId: trait.id,
          message: `Trait ${trait.id} references unknown conflict ${conflictId}.`,
        });
        continue;
      }
      const conflict = registry.traits.find((candidate) => candidate.id === conflictId)!;
      if (!conflict.conflictsWith.includes(trait.id)) {
        issues.push({
          code: "asymmetric_conflict",
          traitId: trait.id,
          message: `Conflict ${trait.id} <-> ${conflictId} must be symmetric.`,
        });
      }
    }
  }
  return issues;
};

const shippedIssues = validateKineticTraitRegistry(KINETIC_TRAIT_REGISTRY);
if (shippedIssues.length > 0) {
  throw new Error(
    `Kinetic trait registry is invalid: ${shippedIssues.map((issue) => issue.message).join(" ")}`,
  );
}

const traitsById = new Map(
  KINETIC_TRAIT_REGISTRY.traits.map((trait) => [trait.id, trait]),
);

export const getKineticTrait = (traitId: string): KineticTraitContract | null =>
  traitsById.get(traitId) ?? null;

export type ExecutableKineticTrait = KineticTraitContract & {
  execution: {status: "typed_adapter"; executorId: string};
};

export const getExecutableKineticTrait = (
  traitId: string,
): ExecutableKineticTrait => {
  const trait = getKineticTrait(traitId);
  if (!trait) {
    throw new Error(`Unknown kinetic trait ${traitId}.`);
  }
  if (trait.execution.status !== "typed_adapter") {
    throw new Error(
      `Kinetic trait ${traitId} is contract-only and has no typed renderer adapter.`,
    );
  }
  return trait as ExecutableKineticTrait;
};

export const assertKineticTraitCompatibility = (traitIds: string[]): void => {
  const traits = traitIds.map((traitId) => {
    const trait = getKineticTrait(traitId);
    if (!trait) throw new Error(`Unknown kinetic trait ${traitId}.`);
    return trait;
  });
  for (let leftIndex = 0; leftIndex < traits.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < traits.length; rightIndex += 1) {
      const left = traits[leftIndex]!;
      const right = traits[rightIndex]!;
      const sharedChannels = left.ownsChannels.filter((channel) =>
        right.ownsChannels.includes(channel),
      );
      if (left.conflictsWith.includes(right.id) || sharedChannels.length > 0) {
        throw new Error(
          `Kinetic traits ${left.id} and ${right.id} conflict on ${sharedChannels.join(", ") || "declared compatibility policy"}.`,
        );
      }
    }
  }
};

export type NumericKineticEvidence = {
  kind: "currency" | "percentage" | "plain_quantity" | "year_or_date";
  sourceText: string;
  parsedValue: number;
  format: "integer" | "currency_usd" | "percentage" | "year";
};

export const parseNumericKineticEvidence = (
  sourceText: string,
): NumericKineticEvidence | null => {
  const text = sourceText.trim();
  if (/^\+?[\d\s()-]{8,}$/u.test(text)) return null;
  const currency = text.match(/^\$\s*(-?[\d,]+(?:\.\d+)?)\s*([kmb])?$/iu);
  const percentage = text.match(/^(-?[\d,]+(?:\.\d+)?)\s*%$/u);
  const plain = text.match(/^(-?[\d,]+(?:\.\d+)?)\s*([kmb])?$/iu);
  const match = currency ?? percentage ?? plain;
  if (!match) return null;
  const baseValue = Number(match[1]!.replaceAll(",", ""));
  if (!Number.isFinite(baseValue)) return null;
  const suffix = match[2]?.toLowerCase();
  const multiplier = suffix === "k"
    ? 1_000
    : suffix === "m"
      ? 1_000_000
      : suffix === "b"
        ? 1_000_000_000
        : 1;
  const parsedValue = baseValue * multiplier;
  if (currency) {
    return {kind: "currency", sourceText: text, parsedValue, format: "currency_usd"};
  }
  if (percentage) {
    return {kind: "percentage", sourceText: text, parsedValue, format: "percentage"};
  }
  const isYear = Number.isInteger(parsedValue) && parsedValue >= 1000 && parsedValue <= 2099;
  return {
    kind: isYear ? "year_or_date" : "plain_quantity",
    sourceText: text,
    parsedValue,
    format: isYear ? "year" : "integer",
  };
};
