import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";

import {type AssetResolver, type MediaReference} from "@prometheus/shared-types";

import {type ReferenceEditRegistryEntry} from "./registry";

export type ReferenceEditProbeResult = {
  width: number;
  height: number;
  fps: number;
  duration_seconds: number;
  duration_in_frames: number;
  has_audio?: boolean;
};

export type ReferenceEditIngestionRequest = {
  registryEntry: ReferenceEditRegistryEntry;
  localMediaPath: string;
  assetResolver: AssetResolver;
  probeVideoMetadata: (mediaPath: string) => Promise<ReferenceEditProbeResult>;
};

export type ReferenceEditIngestionArtifact = {
  registryId: string;
  media: MediaReference;
  mediaMetadata: {
    durationSeconds: number;
    width: number;
    height: number;
    fps: number;
    durationFrames: number;
    hasAudio: boolean;
    sourceHash: string;
  };
  analysisJob: {
    id: string;
    status: "queued";
    inputAssetId: string;
  };
};

const hashFileSha256 = async (filePath: string): Promise<string> => {
  const bytes = await readFile(filePath);
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
};

const assertProductionEligible = (entry: ReferenceEditRegistryEntry): void => {
  if (!entry.corpusEligibility.productionCorpus) {
    throw new Error(`Reference edit ${entry.registryId} is not eligible for production corpus ingestion.`);
  }
  if (entry.curation.status !== "approved_golden_candidate") {
    throw new Error(`Reference edit ${entry.registryId} is not approved for ingestion.`);
  }
};

export async function ingestReferenceEdit(
  request: ReferenceEditIngestionRequest
): Promise<ReferenceEditIngestionArtifact> {
  assertProductionEligible(request.registryEntry);

  const media = await request.assetResolver.registerUpload(request.localMediaPath, request.registryEntry.registryId);
  const [probe, sourceHash] = await Promise.all([
    request.probeVideoMetadata(media.filePath),
    hashFileSha256(media.filePath)
  ]);

  return {
    registryId: request.registryEntry.registryId,
    media,
    mediaMetadata: {
      durationSeconds: probe.duration_seconds,
      width: probe.width,
      height: probe.height,
      fps: probe.fps,
      durationFrames: probe.duration_in_frames,
      hasAudio: probe.has_audio ?? false,
      sourceHash
    },
    analysisJob: {
      id: `analysis://reference-edit/${request.registryEntry.registryId}`,
      status: "queued",
      inputAssetId: media.assetId
    }
  };
}
