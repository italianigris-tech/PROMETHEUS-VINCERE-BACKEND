import path from "node:path";
import {mkdtemp, readFile, rm, stat} from "node:fs/promises";
import os from "node:os";

import AdmZip from "adm-zip";
import {describe, expect, it} from "vitest";

describe("zilliz font materializer", () => {
  it("extracts font files from a zip archive and returns root-relative browser URLs", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "zilliz-font-materializer-"));
    try {
      const zip = new AdmZip();
      zip.addFile("Aesthetic-Bold.ttf", Buffer.from("bold-font"));
      zip.addFile("Aesthetic-Regular.ttf", Buffer.from("regular-font"));
      const zipBuffer = zip.toBuffer();

      const {materializeRetrievedFontAsset} = await import("../zilliz-font-materializer");
      const results = await materializeRetrievedFontAsset({
        family: "aesthetic",
        sourceUrl: "https://r2.example.com/aesthetic-font.zip",
        targetRootDir: tempRoot,
        fetchImpl: async () => ({
          ok: true,
          arrayBuffer: async () => zipBuffer.buffer.slice(zipBuffer.byteOffset, zipBuffer.byteOffset + zipBuffer.byteLength)
        } as Response)
      });

      expect(results).toHaveLength(2);
      expect(results[0]?.browserUrl).toMatch(/^\/fonts\/retrieved\/aesthetic\//);
      const boldPath = path.join(tempRoot, "aesthetic", "Aesthetic-Bold.ttf");
      const regularPath = path.join(tempRoot, "aesthetic", "Aesthetic-Regular.ttf");
      await expect(stat(boldPath)).resolves.toBeDefined();
      await expect(stat(regularPath)).resolves.toBeDefined();
      expect(await readFile(boldPath, "utf8")).toBe("bold-font");
      expect(results.some((entry) => entry.browserUrl === "/fonts/retrieved/aesthetic/Aesthetic-Bold.ttf")).toBe(true);
    } finally {
      await rm(tempRoot, {recursive: true, force: true});
    }
  });
  it("accepts otf and woff2 assets from a zip archive", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "zilliz-font-materializer-modern-"));
    try {
      const zip = new AdmZip();
      zip.addFile("Ageya-Regular.otf", Buffer.from("otf-font"));
      zip.addFile("Ageya-Regular.woff2", Buffer.from("woff2-font"));
      const zipBuffer = zip.toBuffer();

      const {materializeRetrievedFontAsset} = await import("../zilliz-font-materializer");
      const results = await materializeRetrievedFontAsset({
        family: "ageya",
        sourceUrl: "https://r2.example.com/ageya-font.zip",
        targetRootDir: tempRoot,
        fetchImpl: async () => ({
          ok: true,
          arrayBuffer: async () => zipBuffer.buffer.slice(zipBuffer.byteOffset, zipBuffer.byteOffset + zipBuffer.byteLength)
        } as Response)
      });

      expect(results.map((result) => result.format).sort()).toEqual(["otf", "woff2"]);
      await expect(stat(path.join(tempRoot, "ageya", "Ageya-Regular.otf"))).resolves.toBeDefined();
      await expect(stat(path.join(tempRoot, "ageya", "Ageya-Regular.woff2"))).resolves.toBeDefined();
    } finally {
      await rm(tempRoot, {recursive: true, force: true});
    }
  });

  it("writes a raw font file directly without zip extraction", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "zilliz-font-materializer-raw-"));
    try {
      const rawBuffer = Buffer.from("ttf-font");

      const {materializeRetrievedFontAsset} = await import("../zilliz-font-materializer");
      const results = await materializeRetrievedFontAsset({
        family: "ageya",
        sourceUrl: "https://r2.example.com/Ageya-Regular.ttf",
        targetRootDir: tempRoot,
        fetchImpl: async () => ({
          ok: true,
          arrayBuffer: async () => rawBuffer.buffer.slice(rawBuffer.byteOffset, rawBuffer.byteOffset + rawBuffer.byteLength)
        } as Response)
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.browserUrl).toBe("/fonts/retrieved/ageya/Ageya-Regular.ttf");
      const outputPath = path.join(tempRoot, "ageya", "Ageya-Regular.ttf");
      await expect(stat(outputPath)).resolves.toBeDefined();
      expect(await readFile(outputPath, "utf8")).toBe("ttf-font");
    } finally {
      await rm(tempRoot, {recursive: true, force: true});
    }
  });
});
