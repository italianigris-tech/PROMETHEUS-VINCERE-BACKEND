import {createHash} from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import type {MaulResolvedFontAsset} from "@prometheus/shared-types";
import {afterEach, describe, expect, it} from "vitest";

import {resolveMaulFontReceipt} from "./font-asset-resolution.js";

const sourceFontPath = path.resolve(
  process.cwd(),
  "..",
  "remotion-app",
  "public",
  "fonts",
  "maul",
  "dm-sans-700.woff2",
);

const tempRoots: string[] = [];

const createFixture = () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "maul-font-resolution-"));
  tempRoots.push(root);
  const publicDir = path.join(root, "public");
  const relativePath = "fonts/maul/dm-sans-700.woff2";
  const localFilePath = path.join(publicDir, relativePath);
  mkdirSync(path.dirname(localFilePath), {recursive: true});
  copyFileSync(sourceFontPath, localFilePath);
  const localFileSha256 = createHash("sha256")
    .update(require("node:fs").readFileSync(localFilePath))
    .digest("hex");
  const asset: MaulResolvedFontAsset = {
    assetId: "font_google_dm_sans_700",
    family: "DM Sans",
    cssFamily: "DM Sans",
    weight: 700,
    style: "normal",
    browserUrl: `/${relativePath}`,
    localFilePath,
    localFileSha256,
    format: "woff2",
    source: "bundled",
    license: {status: "bundled", evidence: ["repository fixture"]},
  };
  return {publicDir, localFilePath, asset};
};

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, {recursive: true, force: true});
  }
});

describe("MAUL font asset resolution", () => {
  it("verifies the receipt local file and public URL resolve to the same binary", () => {
    const {publicDir, asset} = createFixture();

    expect(resolveMaulFontReceipt(asset, {remotionPublicDir: publicDir})).toEqual(asset);
  });

  it.each([
    ["https://cdn.example.com/font.woff2", "remote browser URL"],
    ["/fonts/../secret.woff2", "path traversal"],
    ["/fonts/font.woff2?cache=1", "query string"],
    ["/fonts/font.woff2#face", "fragment"],
  ])("rejects %s (%s)", (browserUrl) => {
    const {publicDir, asset} = createFixture();

    expect(() => resolveMaulFontReceipt(
      {...asset, browserUrl},
      {remotionPublicDir: publicDir},
    )).toThrow(/font_google_dm_sans_700/);
  });

  it("rejects a local file whose hash differs from the receipt", () => {
    const {publicDir, asset, localFilePath} = createFixture();
    require("node:fs").writeFileSync(localFilePath, Buffer.from("not the font"));

    expect(() => resolveMaulFontReceipt(asset, {remotionPublicDir: publicDir}))
      .toThrow(/hash/i);
  });

  it("rejects a receipt when its local path is not the public asset", () => {
    const {publicDir, asset} = createFixture();

    expect(() => resolveMaulFontReceipt(
      {...asset, localFilePath: "/tmp/different-font.woff2"},
      {remotionPublicDir: publicDir},
    )).toThrow(/public|local|asset/i);
  });
});
