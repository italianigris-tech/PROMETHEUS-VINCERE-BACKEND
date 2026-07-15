export interface Word {
  startMs: number;
  endMs: number;
  text: string;
}

export interface Phrase {
  startMs: number;
  endMs: number;
  text: string;
  words: Word[];
}

export type DynamicBoundaryProfile = "joseph_aggressive" | "joseph_cinematic" | "joseph_minimal";

const HOOK_WINDOW_MS = 3000;
const CTA_WINDOW_MS = 3000;
const BODY_SYNC_TOLERANCE_MS = 100;
const SILENCE_MS = 300;

const PROFILE_STRIDE: Record<DynamicBoundaryProfile, number> = {
  joseph_aggressive: 1,
  joseph_cinematic: 2,
  joseph_minimal: 3,
};

export function findNearest(target: number, points: number[]): number {
  if (points.length === 0) {
    return target;
  }

  return points.reduce((nearest, point) => {
    const nearestDistance = Math.abs(nearest - target);
    const pointDistance = Math.abs(point - target);
    if (pointDistance < nearestDistance) {
      return point;
    }

    if (pointDistance === nearestDistance) {
      return Math.min(nearest, point);
    }

    return nearest;
  });
}

const sortedUnique = (points: number[]): number[] =>
  [...new Set(points.map((point) => Math.round(point)).filter((point) => Number.isFinite(point)))]
    .sort((left, right) => left - right);

const syncPoints = (beats: number[], onsets: number[], durationMs: number): number[] =>
  sortedUnique([...beats, ...onsets].filter((point) => point >= 0 && point <= durationMs));

const everyNth = (points: number[], stride: number): number[] =>
  points.filter((_, index) => index % stride === 0);

const isInsideWord = (point: number, phrases: Phrase[]): boolean =>
  phrases.some((phrase) => phrase.words.some((word) => point > word.startMs && point < word.endMs));

const safePoints = (points: number[], phrases: Phrase[]): number[] =>
  points.filter((point) => !isInsideWord(point, phrases));

const hasSilenceAfterPhrase = (phrase: Phrase, next: Phrase | undefined): boolean =>
  Boolean(next && next.startMs - phrase.endMs > SILENCE_MS);

const phraseBoundaryCandidates = (phrases: Phrase[]): number[] => {
  const boundaries: number[] = [];
  phrases.forEach((phrase, index) => {
    if (index < phrases.length - 1) {
      boundaries.push(phrase.endMs);
    }

    if (hasSilenceAfterPhrase(phrase, phrases[index + 1])) {
      boundaries.push(phrase.endMs);
      boundaries.push(phrases[index + 1].startMs);
    }
  });

  return sortedUnique(boundaries);
};

const pointsWithin = (points: number[], startMs: number, endMs: number): number[] =>
  points.filter((point) => point >= startMs && point <= endMs);

const addMinimumHookCuts = (cuts: Set<number>, selected: number[], candidates: number[]): void => {
  selected.forEach((point) => cuts.add(point));

  if (selected.length >= 2) {
    return;
  }

  candidates
    .filter((point) => !selected.includes(point))
    .slice(0, 2 - selected.length)
    .forEach((point) => cuts.add(point));
};

const addHookCuts = (
  cuts: Set<number>,
  sync: number[],
  phrases: Phrase[],
  durationMs: number,
  profile: DynamicBoundaryProfile,
): void => {
  const hookEnd = Math.min(HOOK_WINDOW_MS, durationMs);
  const stride = PROFILE_STRIDE[profile];
  const hookCandidates = safePoints(pointsWithin(sync, 0, hookEnd), phrases);
  const selected = everyNth(hookCandidates, stride);

  addMinimumHookCuts(cuts, selected, hookCandidates);
};

const addBodyCuts = (cuts: Set<number>, phrases: Phrase[], sync: number[], durationMs: number): void => {
  const bodyStart = Math.min(HOOK_WINDOW_MS, durationMs);
  const bodyEnd = Math.max(bodyStart, durationMs - CTA_WINDOW_MS);

  phraseBoundaryCandidates(phrases)
    .filter((boundary) => boundary > bodyStart && boundary < bodyEnd)
    .forEach((boundary) => {
      const nearest = findNearest(boundary, sync);
      if (Math.abs(nearest - boundary) <= BODY_SYNC_TOLERANCE_MS) {
        cuts.add(boundary);
      }
    });
};

const addCtaCuts = (
  cuts: Set<number>,
  beats: number[],
  phrases: Phrase[],
  durationMs: number,
  profile: DynamicBoundaryProfile,
): void => {
  const ctaStart = Math.max(0, durationMs - CTA_WINDOW_MS);
  const stride = PROFILE_STRIDE[profile];
  const safeBeatCandidates = safePoints(pointsWithin(sortedUnique(beats), ctaStart, durationMs), phrases);
  const selectedBeatCandidates = everyNth(safeBeatCandidates, stride);
  selectedBeatCandidates.forEach((point) => cuts.add(point));

  const terminalPhrase = phrases.at(-1);
  const terminalPoint = terminalPhrase && terminalPhrase.endMs < durationMs
    ? terminalPhrase.endMs
    : terminalPhrase?.startMs;
  const terminalPhraseEndsAtDuration = terminalPhrase?.endMs === durationMs;
  if (
    terminalPoint !== undefined
    && (selectedBeatCandidates.length === 0 || terminalPhraseEndsAtDuration)
    && terminalPoint >= ctaStart
    && terminalPoint < durationMs
    && !isInsideWord(terminalPoint, phrases)
  ) {
    cuts.add(terminalPoint);
  }
};

export function findCutPoints(
  phrases: Phrase[],
  beats: number[],
  onsets: number[],
  durationMs: number,
  profile: DynamicBoundaryProfile,
): number[] {
  if (durationMs <= 0) {
    return [];
  }

  const sync = syncPoints(beats, onsets, durationMs);
  const cuts = new Set<number>();

  addHookCuts(cuts, sync, phrases, durationMs, profile);
  addBodyCuts(cuts, phrases, sync, durationMs);
  addCtaCuts(cuts, beats, phrases, durationMs, profile);

  return sortedUnique([...cuts])
    .filter((point) => point > 0 && point < durationMs)
    .filter((point) => !isInsideWord(point, phrases));
}
