import {createHash} from "node:crypto";
import {mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {LocalAssetResolver} from "../asset/local-asset-resolver";
import {ingestReferenceEdit} from "./ingestion";
import {referenceEditRegistryEntrySchema, type ReferenceEditRegistryEntry} from "./registry";

const makeApprovedEntry = (overrides: Partial<ReferenceEditRegistryEntry> = {}): ReferenceEditRegistryEntry => {
  const entry = referenceEditRegistryEntrySchema.parse({
    registryId: "ref_joseph_licensed_001",
    title: "Licensed Joseph reference 001",
    source: {
      kind: "licensed_asset",
      assetId: "asset_licensed_001",
      storageUri: "r2://prometheus-corpus/licensed-001.mp4",
      provenanceNote: "Licensed production corpus asset."
    },
    license: {
      posture: "licensed_production",
      commercialUse: "allowed",
      evidence: "Creator license agreement LIC-001."
    },
    creatorStyle: {
      creatorId: "joseph",
      styleLabel: "joseph",
      vehicle: "talking_head"
    },
    quality: {
      tier: "elite",
      sourceQuality: "high",
      compressionRisk: "low"
    },
    curation: {
      status: "approved_golden_candidate",
      annotationStatus: "complete",
      trajectoryStatus: "validated"
    }
  });

  return {...entry, ...overrides};
};

describe("reference edit ingestion", () => {
  let tempRoot: string;
  let publicDir: string;
  let uploadDir: string;
  let sourcePath: string;

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), "prometheus-reference-ingest-"));
    publicDir = path.join(tempRoot, "public");
    uploadDir = path.join(tempRoot, "uploads");
    sourcePath = path.join(tempRoot, "Joseph Reference.mp4");
    await writeFile(sourcePath, Buffer.from("reference-video-bytes"));
  });

  afterEach(async () => {
    await rm(tempRoot, {recursive: true, force: true});
  });

  it("ingests an approved registry entry through browser-safe and FFmpeg-safe media references", async () => {
    const resolver = new LocalAssetResolver({publicDir, uploadDir});

    const artifact = await ingestReferenceEdit({
      registryEntry: makeApprovedEntry(),
      localMediaPath: sourcePath,
      assetResolver: resolver,
      probeVideoMetadata: async () => ({
        width: 1920,
        height: 1080,
        fps: 30,
        duration_seconds: 12.5,
        duration_in_frames: 375,
        has_audio: true,
        codec_video: "h264",
        container_format: "mov,mp4,m4a,3gp,3g2,mj2",
        bitrate_video: 8000000
      })
    });

    const copiedBytes = await readFile(artifact.media.filePath);
    const expectedHash = createHash("sha256").update(Buffer.from("reference-video-bytes")).digest("hex");

    expect(artifact.registryId).toBe("ref_joseph_licensed_001");
    expect(artifact.analysisJob.id).toBe("analysis://reference-edit/ref_joseph_licensed_001");
    expect(artifact.media.assetId).toBe("asset://source-video/ref_joseph_licensed_001/Joseph-Reference.mp4");
    expect(artifact.media.browserUrl).toBe("/uploads/ref_joseph_licensed_001/Joseph-Reference.mp4");
    expect(artifact.media.browserUrl).not.toMatch(/^file:\/\//);
    expect(artifact.media.browserUrl).not.toMatch(/^[A-Za-z]:[\\/]/);
    expect(path.isAbsolute(artifact.media.filePath)).toBe(true);
    expect(copiedBytes.toString("utf8")).toBe("reference-video-bytes");
    expect(artifact.mediaMetadata).toEqual({
      durationSeconds: 12.5,
      width: 1920,
      height: 1080,
      fps: 30,
      durationFrames: 375,
      hasAudio: true,
      sourceHash: `sha256:${expectedHash}`
    });
  });

  it("rejects registry entries that are not production corpus eligible", async () => {
    const resolver = new LocalAssetResolver({publicDir, uploadDir});
    const researchOnly = referenceEditRegistryEntrySchema.parse({
      registryId: "ref_research_only",
      title: "Research-only public reference",
      source: {
        kind: "youtube_research",
        url: "https://www.youtube.com/watch?v=research002",
        provenanceNote: "Style study only."
      },
      license: {
        posture: "research_only",
        commercialUse: "blocked",
        evidence: "No production license."
      },
      creatorStyle: {
        creatorId: "joseph",
        styleLabel: "joseph",
        vehicle: "talking_head"
      },
      quality: {
        tier: "elite",
        sourceQuality: "high",
        compressionRisk: "low"
      },
      curation: {
        status: "approved_golden_candidate",
        annotationStatus: "complete",
        trajectoryStatus: "validated"
      }
    });

    await expect(
      ingestReferenceEdit({
        registryEntry: researchOnly,
        localMediaPath: sourcePath,
        assetResolver: resolver,
        probeVideoMetadata: async () => {
          throw new Error("probe should not run for ineligible references");
        }
      })
    ).rejects.toThrow(/not eligible for production corpus ingestion/i);
  });
});
