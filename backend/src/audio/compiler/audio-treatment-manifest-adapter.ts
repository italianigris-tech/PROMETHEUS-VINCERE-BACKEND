import {createHash} from "node:crypto";

import {maulAudioTreatmentPlanSchema, type MaulAudioTreatmentPlan} from "@prometheus/shared-types";

import {soundDesignManifestSchema, type SoundDesignManifest} from "../../sound-engine/types.js";

type ResolvedAsset = {path: string; sha256: string; releaseEligible: boolean; durationMs?: number};

export type AdaptMaulAudioTreatmentInput = {
  treatment: MaulAudioTreatmentPlan;
  dialogueSource?: string;
  dialogueSpans: Array<{outputStartMs: number; outputEndMs: number}>;
  musicAssets?: Record<string, ResolvedAsset>;
  sfxAssets?: Record<string, ResolvedAsset>;
};

export type AdaptedMaulAudioTreatment = {
  manifest: SoundDesignManifest;
  replayKey: string;
  debug: {dialogueOutputSpans: Array<{outputStartMs: number; outputEndMs: number}>; treatmentInputHash: string};
};

const toSeconds = (milliseconds: number) => Number((milliseconds / 1000).toFixed(3));
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

const resolveAsset = (reference: {assetId: string; assetHash: string}, assets: Record<string, ResolvedAsset> | undefined, kind: "music" | "SFX"): ResolvedAsset => {
  const asset = assets?.[reference.assetId];
  if (!asset) throw new Error(`Selected ${kind} asset ${reference.assetId} is unavailable.`);
  if (asset.sha256.toLowerCase() !== reference.assetHash.toLowerCase()) throw new Error(`Selected ${kind} asset ${reference.assetId} hash mismatch.`);
  if (!asset.releaseEligible) throw new Error(`Selected ${kind} asset ${reference.assetId} is not release eligible.`);
  return asset;
};

export const adaptMaulAudioTreatmentToSoundDesignManifest = (input: AdaptMaulAudioTreatmentInput): AdaptedMaulAudioTreatment => {
  const treatment = maulAudioTreatmentPlanSchema.parse(input.treatment);
  const duration = toSeconds(treatment.outputDurationMs);
  const dialogue = input.dialogueSpans.map((span, index) => {
    if (span.outputEndMs <= span.outputStartMs || span.outputEndMs > treatment.outputDurationMs) throw new Error(`Dialogue timeline span ${index} is out of range.`);
    return {start: toSeconds(span.outputStartMs), end: toSeconds(span.outputEndMs), gainDb: 0, label: `editorial_timeline:${index}`};
  });
  const musicCues = treatment.music.selected.map((selection) => {
    const asset = resolveAsset(selection.asset, input.musicAssets, "music");
    const start = toSeconds(selection.outputStartMs);
    const end = toSeconds(selection.outputEndMs);
    return {
      id: selection.decisionId,
      file: asset.path,
      start,
      end,
      role: "music" as const,
      gainDb: selection.gainDb,
      sourceStart: toSeconds(selection.sourceStartMs),
      sourceEnd: toSeconds(selection.sourceEndMs),
      transitionIn: selection.fadeInMs > 0 ? {preset: "soft_overlap_in" as const, start, duration: toSeconds(selection.fadeInMs), settings: {fadeInSeconds: toSeconds(selection.fadeInMs)}} : undefined,
      transitionOut: selection.fadeOutMs > 0 ? {preset: "tail_wash_out" as const, start: toSeconds(selection.outputEndMs - selection.fadeOutMs), duration: toSeconds(selection.fadeOutMs), settings: {fadeOutSeconds: toSeconds(selection.fadeOutMs)}} : undefined,
      tags: ["maul-audio-treatment", `reason:${selection.reason}`],
    };
  });
  const sfx = treatment.sfx.selected.map((selection) => {
    const asset = resolveAsset(selection.asset, input.sfxAssets, "SFX");
    if (!asset.durationMs || asset.durationMs <= 0) throw new Error(`Selected SFX asset ${selection.asset.assetId} has no measured duration.`);
    const start = toSeconds(selection.outputMs);
    const endMs = Math.min(treatment.outputDurationMs, selection.outputMs + asset.durationMs);
    if (endMs <= selection.outputMs) throw new Error(`Selected SFX cue ${selection.eventId} is out of output range.`);
    return {id: selection.eventId, file: asset.path, start, end: toSeconds(endMs), role: "sfx" as const, gainDb: selection.gainDb, sourceStart: 0, sourceEnd: toSeconds(asset.durationMs), tags: ["maul-audio-treatment", `lifecycle:${selection.lifecycleRole}`, `timing:${selection.timingRelation}`, `visual:${selection.visualEventId}`]};
  });
  const manifest = soundDesignManifestSchema.parse({
    duration,
    dialogueSource: input.dialogueSource,
    dialogue,
    musicCues,
    sfx,
    master: {targetI: treatment.mastering.targetIntegratedLufs, truePeak: treatment.mastering.maximumTruePeakDbtp, lra: treatment.mastering.maximumLoudnessRangeLu, sampleRate: treatment.mastering.sampleRateHz},
    presetOverrides: treatment.ducking.enabled ? {dialogue_safe_bed: {duckingGainDb: treatment.ducking.attenuationDb, attackMs: treatment.ducking.attackMs, releaseMs: treatment.ducking.releaseMs}} : {},
  });
  const treatmentInputHash = hash(treatment);
  return {manifest, replayKey: hash({treatmentInputHash, manifest, catalogs: treatment.catalogs}), debug: {dialogueOutputSpans: input.dialogueSpans, treatmentInputHash}};
};
