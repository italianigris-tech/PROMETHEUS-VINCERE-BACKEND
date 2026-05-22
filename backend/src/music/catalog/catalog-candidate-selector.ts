import type {VideoTimelineSegment} from "../schemas/video-timeline.schema";
import type {R2MusicCatalogEntry} from "./r2-music-catalog.schema";

export type CatalogCandidatePlanMode = "dry_run" | "render_ready";

export type CatalogCandidateMatch = {
  entry: R2MusicCatalogEntry;
  score: number;
  reasons: string[];
};

export type SelectCatalogCandidatesForTimelineInput = {
  timelineSegments: VideoTimelineSegment[];
  catalogEntries: R2MusicCatalogEntry[];
  planMode: CatalogCandidatePlanMode;
  limit?: number;
};

export type SelectCatalogCandidatesForTimelineResult = {
  entries: R2MusicCatalogEntry[];
  warnings: string[];
  rankedCandidates: CatalogCandidateMatch[];
};

const ROLE_USE_CASE_HINTS: Record<VideoTimelineSegment["role"], string[]> = {
  hook: ["hook-bed"],
  setup: ["underscore", "setup-support-bed"],
  problem: ["underscore", "tension-bed", "problem-tension-bed"],
  explanation: ["underscore", "explanation-support-bed"],
  proof: ["proof-bed", "proof-support-bed"],
  reveal: ["reveal-bed", "reveal-lift-bed"],
  transition: ["transition-bed", "transition-bridge-bed"],
  emotional_reset: ["ambient", "reset-bed"],
  cta: ["cta-bed", "cta-resolve-bed"],
  outro: ["outro-bed", "release-bed"],
  unknown: []
};

const ROLE_MOOD_HINTS: Record<VideoTimelineSegment["role"], string[]> = {
  hook: ["big-reveal", "high-energy"],
  setup: ["calm", "focused"],
  problem: ["moody", "tense", "dark"],
  explanation: ["supportive", "focused"],
  proof: ["prestige", "confident"],
  reveal: ["uplift", "breakthrough", "big-reveal"],
  transition: ["futuristic", "kinetic"],
  emotional_reset: ["ambient", "soft-focus"],
  cta: ["motivational", "uplift"],
  outro: ["resolve", "release"],
  unknown: []
};

const ROLE_CATEGORY_HINTS: Record<VideoTimelineSegment["role"], string[]> = {
  hook: ["cinematic", "epic", "trailer"],
  setup: ["lo-fi", "classical", "soft-focus"],
  problem: ["trap", "urban", "tech", "futuristic"],
  explanation: ["lo-fi", "classical", "other"],
  proof: ["classical", "prestige", "orchestral"],
  reveal: ["motivational", "epic", "uplift"],
  transition: ["tech", "futuristic"],
  emotional_reset: ["lo-fi", "ambient", "soft-focus"],
  cta: ["motivational", "uplift", "pop"],
  outro: ["classical", "other"],
  unknown: []
};

const dominantRoleForSegments = (segments: VideoTimelineSegment[]): VideoTimelineSegment["role"] => {
  const scoreByRole = new Map<VideoTimelineSegment["role"], number>();

  for (const segment of segments) {
    const durationSec = Math.max(0.1, segment.endSec - segment.startSec);
    const strength = durationSec * (1 + segment.hookStrength + segment.proofStrength + segment.ctaStrength);
    scoreByRole.set(segment.role, (scoreByRole.get(segment.role) ?? 0) + strength);
  }

  return [...scoreByRole.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "unknown";
};

const overlapCount = (left: string[], right: string[]): number => {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  const rightSet = new Set(right.map((value) => value.toLowerCase()));
  return left.filter((value) => rightSet.has(value.toLowerCase())).length;
};

export const selectCatalogCandidatesForTimeline = (
  input: SelectCatalogCandidatesForTimelineInput
): SelectCatalogCandidatesForTimelineResult => {
  const limit = Math.max(1, input.limit ?? 8);
  const dominantRole = dominantRoleForSegments(input.timelineSegments);
  const allowedEntries = input.catalogEntries.filter((entry) => {
    if (input.planMode === "render_ready") {
      return entry.renderAllowed && entry.commercialAllowed && entry.licenseVerified;
    }

    return entry.previewAllowed || entry.renderAllowed;
  });

  if (allowedEntries.length === 0) {
    return {
      entries: [],
      warnings: [
        input.planMode === "render_ready"
          ? "No render-safe R2 catalog tracks are available for render_ready mode."
          : "No previewable R2 catalog tracks are available for dry_run mode."
      ],
      rankedCandidates: []
    };
  }

  const preferredUseCases = ROLE_USE_CASE_HINTS[dominantRole];
  const preferredMoods = ROLE_MOOD_HINTS[dominantRole];
  const preferredCategoryKeywords = ROLE_CATEGORY_HINTS[dominantRole];

  const rankedCandidates = allowedEntries
    .map((entry) => {
      const reasons: string[] = [];
      let score = entry.previewAllowed ? 0.05 : 0;

      const useCaseMatches = overlapCount(entry.useCaseTags, preferredUseCases);
      if (useCaseMatches > 0) {
        score += 0.45;
        reasons.push(`Matched ${dominantRole} use-case tags.`);
      }

      const moodMatches = overlapCount(entry.moodTags, preferredMoods);
      if (moodMatches > 0) {
        score += Math.min(0.25, moodMatches * 0.12);
        reasons.push(`Matched ${dominantRole} mood hints.`);
      }

      const categoryMatches = preferredCategoryKeywords.filter((keyword) => entry.category.includes(keyword)).length;
      if (categoryMatches > 0) {
        score += Math.min(0.2, categoryMatches * 0.1);
        reasons.push(`Category aligns with ${dominantRole}.`);
      }

      if (entry.renderAllowed && entry.commercialAllowed && entry.licenseVerified) {
        score += 0.1;
        reasons.push("Track is render-safe.");
      } else if (entry.previewAllowed) {
        reasons.push("Track is preview-safe for dry-run browsing.");
      }

      return {
        entry,
        score: Number(score.toFixed(3)),
        reasons: reasons.length > 0 ? reasons : [`No strong ${dominantRole} alignment; kept as a fallback candidate.`]
      };
    })
    .sort((left, right) => right.score - left.score || left.entry.id.localeCompare(right.entry.id));

  return {
    entries: rankedCandidates.slice(0, limit).map((candidate) => candidate.entry),
    warnings: [],
    rankedCandidates: rankedCandidates.slice(0, limit)
  };
};
