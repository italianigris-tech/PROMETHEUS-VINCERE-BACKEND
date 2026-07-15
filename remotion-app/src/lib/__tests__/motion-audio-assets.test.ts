import {existsSync, readFileSync, statSync} from "node:fs";
import path from "node:path";

import {describe, expect, it} from "vitest";

import type {MotionSoundAsset, MotionSoundLibrarySection} from "../types";

const readJson = <T>(filePath: string): T => {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
};

const publicRoot = path.resolve("public");
const dataRoot = path.resolve("src", "data");

const musicCatalog = readJson<MotionSoundAsset[]>(
  path.join(dataRoot, "music.local.json")
);
const soundFxCatalog = readJson<MotionSoundAsset[]>(
  path.join(dataRoot, "sound-fx.local.json")
);

const assetPublicPath = (asset: MotionSoundAsset): string => {
  const resolved = path.resolve(publicRoot, asset.src);
  if (!resolved.startsWith(publicRoot)) {
    throw new Error(`Audio asset escapes public root: ${asset.id} -> ${asset.src}`);
  }
  return resolved;
};

describe("motion audio asset manifests", () => {
  it("only advertises music files that exist in the Remotion public bundle", () => {
    expect(musicCatalog.length).toBeGreaterThanOrEqual(6);

    const missing = musicCatalog.filter((asset) => !existsSync(assetPublicPath(asset)));
    expect(missing).toEqual([]);

    const empty = musicCatalog.filter((asset) => statSync(assetPublicPath(asset)).size <= 0);
    expect(empty).toEqual([]);
  });

  it("only advertises SFX files that exist in the Remotion public bundle", () => {
    expect(soundFxCatalog.length).toBeGreaterThanOrEqual(12);

    const missing = soundFxCatalog.filter((asset) => !existsSync(assetPublicPath(asset)));
    expect(missing).toEqual([]);

    const empty = soundFxCatalog.filter((asset) => statSync(assetPublicPath(asset)).size <= 0);
    expect(empty).toEqual([]);
  });

  it("keeps enough SFX sections available for edit-contract renders", () => {
    const sections = new Set<MotionSoundLibrarySection>(
      soundFxCatalog.map((asset) => asset.librarySection)
    );

    expect([...sections].sort()).toEqual(expect.arrayContaining([
      "impact-hit",
      "riser",
      "text",
      "transition",
      "whoosh"
    ]));
  });
});
