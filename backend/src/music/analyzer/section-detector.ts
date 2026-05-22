import {
  beatGridSchema,
  musicTrackSectionSchema,
  type BeatGrid,
  type MusicTrackSection
} from "../schemas/music-track.schema";

export type DetectSectionsInput = {
  trackId: string;
  durationSec: number;
  beatGrid?: BeatGrid | null;
  energy?: number;
  tension?: number;
};

const clamp = (value: number): number => {
  return Math.max(0, Math.min(1, value));
};

export const detectSections = (input: DetectSectionsInput): MusicTrackSection[] => {
  const durationSec = Math.max(input.durationSec, 1);
  const beatGrid = input.beatGrid ? beatGridSchema.parse(input.beatGrid) : null;
  const sectionCount = durationSec < 45 ? 2 : durationSec < 120 ? 3 : 4;
  const sectionLengthSec = durationSec / sectionCount;
  const sections: MusicTrackSection[] = [];

  for (let index = 0; index < sectionCount; index += 1) {
    const startSec = Number((index * sectionLengthSec).toFixed(3));
    const endSec = Number(((index + 1) * sectionLengthSec).toFixed(3));
    const isFirst = index === 0;
    const isLast = index === sectionCount - 1;
    const role =
      isFirst ? "intro" : isLast ? "outro" : index === 1 ? "verse" : index === 2 ? "chorus" : "bridge";
    const downbeatCount =
      beatGrid?.downbeatTimesSec.filter((timeSec) => timeSec >= startSec && timeSec < endSec).length ?? 0;
    const density = clamp(downbeatCount > 0 ? downbeatCount / Math.max(1, sectionLengthSec / 2) : 0.5);

    sections.push(
      musicTrackSectionSchema.parse({
        id: `${input.trackId}-section-${String(index + 1).padStart(2, "0")}`,
        trackId: input.trackId,
        startSec,
        endSec: Number(Math.min(durationSec, endSec).toFixed(3)),
        role,
        energy: clamp(input.energy ?? (isFirst ? 0.35 : isLast ? 0.4 : 0.65)),
        density,
        tension: clamp(input.tension ?? (isLast ? 0.3 : 0.55)),
        bestFor: isFirst ? ["setup", "explanation"] : isLast ? ["cta", "outro"] : ["hook", "proof"],
        avoidWhen: isFirst ? ["hard_reveal"] : isLast ? ["new_problem_setup"] : [],
        transitionInSuitability: clamp(isFirst ? 0.2 : 0.65),
        transitionOutSuitability: clamp(isLast ? 0.75 : 0.45)
      })
    );
  }

  // TODO: Replace placeholder segmentation with Python-side librosa/Essentia section analysis.
  return sections;
};
