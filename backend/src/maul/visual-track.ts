import {
  maulNormalizedBoxSchema,
  maulVisualAssetPackSchema,
  maulVisualTrackSchema,
  type MaulVisualAssetPack,
  type MaulVisualTrack,
} from "@prometheus/shared-types";

type VisualBeat = {
  beatId: string;
  outputStartMs: number;
  outputEndMs: number;
  sourceStartMs?: number;
  sourceEndMs?: number;
  role: "hook" | "proof" | "payoff";
  spokenIdea: string;
  protectedPause?: boolean;
  visualMode?: "speaker_hero" | "b_roll" | "evidence_image" | "split_proof" | "editorial_graphic" | "quiet_hold";
};

export type MaulVisualTrackInput = {
  projectId: string;
  rootSourceAssetId: string;
  sourceAssetId: string;
  outputDurationMs: number;
  beats: readonly VisualBeat[];
  assets: readonly unknown[];
  treatment?: {maxInsertsPerMinute?: number};
  crop?: {x: number; y: number; width: number; height: number};
};

const defaultCrop = {x: 0, y: 0, width: 1, height: 1} as const;

const hasRole = (asset: MaulVisualAssetPack["assets"][number], role: string) =>
  asset.permittedRoles.includes(role as (typeof asset.permittedRoles)[number]);

const intervalFor = ({
  beat,
  mode,
  assetId,
  secondaryAssetId = null,
  crop,
}: {
  beat: VisualBeat;
  mode: MaulVisualTrack["intervals"][number]["mode"];
  assetId: string | null;
  secondaryAssetId?: string | null;
  crop: MaulVisualTrack["intervals"][number]["crop"];
}) => ({
  intervalId: `maul_visual_${beat.beatId}`,
  outputStartMs: beat.outputStartMs,
  outputEndMs: beat.outputEndMs,
  sourceStartMs:
    mode === "speaker_hero" || mode === "quiet_hold" || mode === "split_proof"
      ? beat.sourceStartMs ?? null
      : null,
  sourceEndMs:
    mode === "speaker_hero" || mode === "quiet_hold" || mode === "split_proof"
      ? beat.sourceEndMs ?? null
      : null,
  mode,
  assetId,
  secondaryAssetId,
  crop,
  purpose:
    mode === "speaker_hero"
      ? `Keep the principal speaker authoritative for: ${beat.spokenIdea}.`
      : beat.spokenIdea,
  evidenceRationale:
    mode === "speaker_hero"
      ? "No approved visual asset was selected; retain source fidelity."
      : `Approved project asset selected to clarify the ${beat.role} beat.`,
  transition: {type: "hard_cut" as const, durationMs: 0},
});

export const buildMaulVisualTrack = (
  input: MaulVisualTrackInput,
): MaulVisualTrack => {
  const crop = maulNormalizedBoxSchema.parse(input.crop ?? defaultCrop);
  const pack = maulVisualAssetPackSchema.parse({
    schemaVersion: "maul-visual-asset-pack/v1",
    projectId: input.projectId,
    rootSourceAssetId: input.rootSourceAssetId,
    sourceAssetId: input.sourceAssetId,
    assets: input.assets,
  });
  const source = pack.assets.find((asset) => asset.assetId === pack.sourceAssetId)!;
  const bRoll = pack.assets.filter(
    (asset) => asset.assetId !== source.assetId && asset.mediaKind === "video" && hasRole(asset, "b_roll"),
  );
  const evidence = pack.assets.filter(
    (asset) => asset.assetId !== source.assetId && asset.mediaKind === "image" && hasRole(asset, "evidence_image"),
  );
  const splitProof = pack.assets.filter(
    (asset) => asset.assetId !== source.assetId && asset.mediaKind === "image" && hasRole(asset, "split_proof"),
  );
  const roleAssets = (role: MaulVisualTrack["intervals"][number]["mode"]) =>
    pack.assets.filter((asset) => asset.assetId !== source.assetId && hasRole(asset, role));
  const maxInserts = Math.max(
    0,
    Math.ceil(((input.treatment?.maxInsertsPerMinute ?? 2) * input.outputDurationMs) / 60_000),
  );
  let inserts = 0;
  const intervals = input.beats.map((beat, index) => {
    const requested =
      beat.protectedPause
        ? "quiet_hold"
        : beat.visualMode ??
          (beat.role === "proof"
            ? "b_roll"
            : beat.role === "payoff"
              ? "evidence_image"
              : undefined);
    let mode: MaulVisualTrack["intervals"][number]["mode"] = "speaker_hero";
    let assetId: string | null = source.assetId;
    let secondaryAssetId: string | null = null;

    if (requested === "b_roll" && inserts < maxInserts) {
      if (roleAssets("b_roll").length > 0 && bRoll.length === 0) {
        throw new Error("B-roll visual role requires a governed video asset.");
      }
      const selected = bRoll[index % Math.max(1, bRoll.length)];
      if (selected) {
        mode = "b_roll";
        assetId = selected.assetId;
        inserts += 1;
      }
    } else if (requested === "evidence_image" && inserts < maxInserts) {
      if (roleAssets("evidence_image").length > 0 && evidence.length === 0) {
        throw new Error("Evidence visual role requires a governed image asset.");
      }
      const selected = evidence[index % Math.max(1, evidence.length)];
      if (selected) {
        mode = "evidence_image";
        assetId = selected.assetId;
        inserts += 1;
      }
    } else if (requested === "split_proof" && inserts < maxInserts) {
      const selected = splitProof[index % Math.max(1, splitProof.length)];
      if (selected) {
        mode = "split_proof";
        assetId = source.assetId;
        secondaryAssetId = selected.assetId;
        inserts += 1;
      }
    } else if (requested === "quiet_hold") {
      mode = "quiet_hold";
      assetId = source.assetId;
    } else if (requested === "editorial_graphic" && inserts < maxInserts) {
      mode = "editorial_graphic";
      assetId = null;
      inserts += 1;
    }

    return intervalFor({beat, mode, assetId, secondaryAssetId, crop});
  });
  const track = maulVisualTrackSchema.parse({
    schemaVersion: "maul-visual-track/v1",
    projectId: input.projectId,
    rootSourceAssetId: input.rootSourceAssetId,
    sourceAssetId: input.sourceAssetId,
    outputDurationMs: input.outputDurationMs,
    assets: pack.assets,
    intervals,
  });
  return track;
};
