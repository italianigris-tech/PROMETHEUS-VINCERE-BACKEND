import {createHash} from "node:crypto";
import {copyFileSync, mkdtempSync, mkdirSync, rmSync} from "node:fs";
import os from "node:os";
import path from "node:path";

import type {MaulResolvedFontAsset, MaulUnifiedShortRenderManifest} from "@prometheus/shared-types";
import {afterEach, describe, expect, it} from "vitest";

import {validateMaulRenderFontReceipts} from "./render-font-preflight.js";

const roots: string[] = [];
const sourceFontPath = path.resolve(
  process.cwd(),
  "..",
  "remotion-app",
  "public",
  "fonts",
  "maul",
  "dm-sans-700.woff2",
);

const fixtureAsset = (root: string, assetId: string, publicPath: string): MaulResolvedFontAsset => {
  const localFilePath = path.join(root, "public", publicPath);
  mkdirSync(path.dirname(localFilePath), {recursive: true});
  copyFileSync(sourceFontPath, localFilePath);
  const localFileSha256 = createHash("sha256")
    .update(require("node:fs").readFileSync(localFilePath))
    .digest("hex");
  return {
    assetId,
    family: "DM Sans",
    cssFamily: "DM Sans",
    weight: 700,
    style: "normal",
    browserUrl: `/${publicPath}`,
    localFilePath,
    localFileSha256,
    format: "woff2",
    source: "bundled",
    license: {status: "bundled", evidence: ["preflight fixture"]},
  };
};

const fixtureManifest = (root: string): MaulUnifiedShortRenderManifest => {
  const selectedAsset = fixtureAsset(root, "primary_font", "fonts/maul/primary.woff2");
  const accentAsset = fixtureAsset(root, "accent_font", "fonts/maul/accent.woff2");
  return {
    schemaVersion: "maul-unified-short-render-manifest/v2",
    plans: {
      typographyMotion: {
        fontResolution: {
          requestedRole: "display",
          selectedFamily: "DM Sans",
          selectedAssetId: selectedAsset.assetId,
          selectedAsset,
          accentAsset,
          status: "eligible_loaded",
          reason: "fixture",
        },
      },
      textPlacement: {
        segments: [],
      },
    },
  } as unknown as MaulUnifiedShortRenderManifest;
};

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, {recursive: true, force: true});
});

describe("MAUL render font preflight", () => {
  it("accepts complete primary and accent receipts before render", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "maul-render-preflight-"));
    roots.push(root);
    expect(() => validateMaulRenderFontReceipts(fixtureManifest(root), {
      remotionPublicDir: path.join(root, "public"),
    })).not.toThrow();
  });

  it("fails before render when a planned receipt points at a missing public asset", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "maul-render-preflight-"));
    roots.push(root);
    const manifest = fixtureManifest(root);
    const selected = manifest.plans.typographyMotion.fontResolution.selectedAsset!;
    rmSync(path.join(root, "public", "fonts/maul/primary.woff2"));

    expect(() => validateMaulRenderFontReceipts(manifest, {
      remotionPublicDir: path.join(root, "public"),
    })).toThrow(/primary_font.*preflight|missing/i);
    expect(selected.assetId).toBe("primary_font");
  });
});
