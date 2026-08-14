import {readdirSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

export type MaulTypographySfxEventType =
  | "typography_entry"
  | "typography_emphasis"
  | "typography_motion";

export type MaulTypographySfxAsset = {
  id: string;
  storagePath: string;
  category?: string;
  eventType: MaulTypographySfxEventType;
};

export type MaulSfxCatalogAsset = Omit<MaulTypographySfxAsset, "eventType"> & {
  eventType: MaulTypographySfxEventType | null;
};

export type MaulTypographyAnimationProgram = {
  animationId: string;
  treatment: string;
  frameMotion?: {sourceIntervalMs: {startMs: number; endMs: number}};
};

export type MaulSemanticSfxMoment = {
  sourceMs: number;
  role: "hook" | "context" | "claim" | "contrast" | "transition" | "proof" | "payoff" | "cta";
  emphasisLevel?: string;
};

export type MaulSemanticSfxIntent = {
  eventType: MaulTypographySfxEventType;
  sourceMs: number;
  semanticRole: MaulSemanticSfxMoment["role"];
  reason: string;
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const fullSfxRoot = path.join(repoRoot, "SOUND FX");
const audioExtensions = new Set([".aac", ".flac", ".m4a", ".mp3", ".ogg", ".wav"]);

const entryCategories = new Set([
  "MECHANICAL CLICKS", "SNAP", "UI INTERFACE",
]);
const emphasisCategories = new Set([
  "BRAAAMS", "CINEMATIC HITS", "IMPACT HITS", "METALLIC IMPACTS",
]);
const motionCategories = new Set([
  "GLITCHES", "RISERS", "SWEEPS", "SWOOSHES", "TRANSITIONS", "WHOOSHES",
]);

const eventTypeForCategory = (category: string): MaulTypographySfxEventType | null => {
  if (entryCategories.has(category)) return "typography_entry";
  if (emphasisCategories.has(category)) return "typography_emphasis";
  if (motionCategories.has(category)) return "typography_motion";
  return null;
};

const scanSfxDirectory = (directory: string): string[] => readdirSync(directory, {withFileTypes: true})
  .flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory()
      ? scanSfxDirectory(absolute)
      : audioExtensions.has(path.extname(entry.name).toLowerCase())
        ? [absolute]
        : [];
  });

export const FULL_MAUL_SFX_CATALOG: MaulSfxCatalogAsset[] = scanSfxDirectory(fullSfxRoot)
  .sort((left, right) => left.localeCompare(right))
  .map((storagePath) => {
    const relative = path.relative(fullSfxRoot, storagePath);
    const category = relative.split(path.sep)[0] ?? "UNCATEGORIZED";
    return {
      id: `full_pack_${relative.replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`,
      storagePath,
      category,
      eventType: eventTypeForCategory(category),
    };
  });

export const DEFAULT_MAUL_TYPOGRAPHY_SFX: MaulTypographySfxAsset[] =
  FULL_MAUL_SFX_CATALOG.filter(
    (asset): asset is MaulTypographySfxAsset => asset.eventType !== null,
  );

export const selectMaulSemanticSfxIntents = ({
  semanticMoments,
  maxCues = 7,
  minimumGapMs = 900,
}: {
  semanticMoments: readonly MaulSemanticSfxMoment[];
  maxCues?: number;
  minimumGapMs?: number;
}): MaulSemanticSfxIntent[] => {
  const semanticPriority: Record<MaulSemanticSfxMoment["role"], number> = {
    hook: 4,
    context: 0,
    claim: 1,
    contrast: 4,
    transition: 4,
    proof: 2,
    payoff: 5,
    cta: 3,
  };
  const emphasisPriority = (level: string | undefined) =>
    level === "hero" ? 3 : level === "key" ? 2 : level === "supporting" ? 1 : 0;
  const strongestByRole = new Map<
    MaulSemanticSfxMoment["role"],
    MaulSemanticSfxMoment
  >();
  for (const moment of semanticMoments) {
    if (semanticPriority[moment.role] === 0) continue;
    const current = strongestByRole.get(moment.role);
    if (
      !current ||
      emphasisPriority(moment.emphasisLevel) >=
        emphasisPriority(current.emphasisLevel)
    ) {
      strongestByRole.set(moment.role, moment);
    }
  }

  const selected: MaulSemanticSfxIntent[] = [];
  const rankedMoments = [...strongestByRole.values()].sort(
    (left, right) =>
      semanticPriority[right.role] - semanticPriority[left.role] ||
      emphasisPriority(right.emphasisLevel) -
        emphasisPriority(left.emphasisLevel) ||
      left.sourceMs - right.sourceMs,
  );
  for (const moment of rankedMoments) {
    if (
      selected.some(
        (intent) => Math.abs(intent.sourceMs - moment.sourceMs) < minimumGapMs,
      )
    ) {
      continue;
    }
    const eventType: MaulTypographySfxEventType =
      moment.role === "payoff" || moment.role === "cta"
        ? "typography_emphasis"
        : moment.role === "hook" ||
            moment.role === "contrast" ||
            moment.role === "transition"
          ? "typography_motion"
          : "typography_entry";
    selected.push({
      eventType,
      sourceMs: moment.sourceMs,
      semanticRole: moment.role,
      reason: `${moment.role} semantic state change earns one ${eventType} cue.`,
    });
    if (selected.length >= maxCues) break;
  }
  return selected.sort((left, right) => left.sourceMs - right.sourceMs);
};

export const selectMaulTypographySfx = ({
  programs,
  assets = DEFAULT_MAUL_TYPOGRAPHY_SFX,
  maxCues = 7,
  minimumGapMs = 900,
  semanticMoments,
}: {
  programs: readonly MaulTypographyAnimationProgram[];
  assets?: readonly MaulTypographySfxAsset[];
  maxCues?: number;
  minimumGapMs?: number;
  semanticMoments?: readonly MaulSemanticSfxMoment[];
}) => {
  const byType = new Map<MaulTypographySfxEventType, MaulTypographySfxAsset[]>();
  for (const asset of assets) {
    byType.set(asset.eventType, [...(byType.get(asset.eventType) ?? []), asset]);
  }
  const emphasis = /punch|impact|focus|lock|depth|bold|stagger|cinematic|capsule/i;
  const motion = /slide|sweep|glide|arc|velocity|reveal|rail|underline|drift|rise/i;
  const selected: Array<MaulTypographySfxAsset & {
    sourceMs: number;
    semanticRole?: MaulSemanticSfxMoment["role"];
    reason: string;
  }> = [];
  const useCount = new Map<MaulTypographySfxEventType, number>();
  const semanticPrograms: Array<MaulTypographyAnimationProgram & {
    semanticIntent: MaulSemanticSfxIntent;
  }> = semanticMoments
    ? selectMaulSemanticSfxIntents({
        semanticMoments,
        maxCues,
        minimumGapMs,
      }).map((intent) => ({
        animationId: `semantic_${intent.semanticRole}_${intent.sourceMs}`,
        treatment: `semantic_${intent.eventType}`,
        frameMotion: {
          sourceIntervalMs: {
            startMs: intent.sourceMs,
            endMs: intent.sourceMs + 400,
          },
        },
        semanticIntent: intent,
      }))
    : [];
  const candidatePrograms = semanticMoments ? semanticPrograms : programs;
  for (const program of [...candidatePrograms].sort(
    (left, right) => (left.frameMotion?.sourceIntervalMs.startMs ?? Infinity) -
      (right.frameMotion?.sourceIntervalMs.startMs ?? Infinity),
  )) {
    const sourceMs = program.frameMotion?.sourceIntervalMs.startMs;
    if (sourceMs === undefined) continue;
    if (selected.some((cue) => Math.abs(cue.sourceMs - sourceMs) < minimumGapMs)) continue;
    const semanticIntent = (program as MaulTypographyAnimationProgram & {
      semanticIntent?: MaulSemanticSfxIntent;
    }).semanticIntent;
    const eventType = semanticIntent?.eventType ?? (
      emphasis.test(program.treatment)
        ? "typography_emphasis"
        : motion.test(program.treatment)
          ? "typography_motion"
          : "typography_entry"
    );
    const categoryPriority = eventType === "typography_emphasis"
      ? ["IMPACT HITS", "CINEMATIC HITS", "METALLIC IMPACTS", "BRAAAMS"]
      : eventType === "typography_motion"
        ? /sweep|underline|highlight|reveal/i.test(program.treatment)
          ? ["SWEEPS", "WHOOSHES", "SWOOSHES", "TRANSITIONS"]
          : ["WHOOSHES", "SWOOSHES", "SWEEPS", "TRANSITIONS"]
        : ["UI INTERFACE", "SNAP", "MECHANICAL CLICKS"];
    const roleCandidates = byType.get(eventType) ?? byType.get("typography_entry") ?? [];
    const candidates = [...roleCandidates].sort((left, right) => {
      const leftRank = categoryPriority.indexOf(left.category ?? "");
      const rightRank = categoryPriority.indexOf(right.category ?? "");
      return (leftRank < 0 ? categoryPriority.length : leftRank) -
        (rightRank < 0 ? categoryPriority.length : rightRank) ||
        left.storagePath.localeCompare(right.storagePath);
    });
    const count = useCount.get(eventType) ?? 0;
    const asset = candidates[count % candidates.length];
    if (!asset) continue;
    useCount.set(eventType, count + 1);
    selected.push({
      ...asset,
      id: `${asset.id}_${selected.length + 1}`,
      sourceMs,
      ...(semanticIntent
        ? {
            semanticRole: semanticIntent.semanticRole,
            reason: semanticIntent.reason,
          }
        : {reason: `${program.treatment} animation earns one restrained ${eventType} cue.`}),
    });
    if (selected.length >= maxCues) break;
  }
  return selected;
};

export const materializeAutomaticMaulSfx = (
  programs: readonly MaulTypographyAnimationProgram[],
  semanticMoments?: readonly MaulSemanticSfxMoment[],
) => selectMaulTypographySfx({programs, semanticMoments}).map((asset) => ({
  ...asset,
  licenseType: "local_user_supplied",
  commercialAllowed: true,
  licenseVerified: true,
  renderSafe: true,
}));
