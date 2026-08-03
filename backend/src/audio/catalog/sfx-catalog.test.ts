import {mkdtemp, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {describe, expect, it} from "vitest";

import {assertReleaseEligibleSfx, fileSha256, verifySfxCatalogFiles} from "./sfx-catalog.js";

const asset = (sha256: string) => ({assetId: "click", sha256, objectKey: "click.mp3", durationMs: 100, format: "mp3", analysis: {provider: "ffprobe", inputHash: sha256, durationStatus: "measured", loudnessLufs: null, truePeakDbtp: null, onsetMs: null, tailMs: null, status: "metadata_only"}, lifecycleRoles: ["entry"], material: "digital", direction: "neutral", intensity: "soft", semanticTags: ["click"], rights: {state: "unknown", usage: "preview_only", sourceEvidence: null, licenseEvidence: null}});

describe("Joseph SFX catalog", () => {
  it("rejects duplicate IDs and hashes", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "sfx-catalog-"));
    await writeFile(path.join(root, "click.mp3"), "audio");
    const hash = await fileSha256(path.join(root, "click.mp3"));
    await expect(verifySfxCatalogFiles({root, catalog: {schemaVersion: "joseph-sfx-catalog/v1", catalogId: "test", assets: [asset(hash), asset(hash)]}})).rejects.toThrow(/unique/i);
  });

  it("rejects missing files and release without evidence", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "sfx-catalog-"));
    const hash = "a".repeat(64);
    await expect(verifySfxCatalogFiles({root, catalog: {schemaVersion: "joseph-sfx-catalog/v1", catalogId: "test", assets: [asset(hash)]}})).rejects.toThrow();
    expect(() => assertReleaseEligibleSfx(asset(hash) as never)).toThrow(/preview-only/i);
  });
});
