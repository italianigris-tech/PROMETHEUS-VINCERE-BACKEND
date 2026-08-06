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
      expect(results[0]?.browserUrl).toMatch(/^\/fonts\/retrieved\/[a-f0-9]{64}\//);
      const bold = results.find((entry) => entry.fileName === "Aesthetic-Bold.ttf");
      const regular = results.find((entry) => entry.fileName === "Aesthetic-Regular.ttf");
      await expect(stat(bold!.filePath)).resolves.toBeDefined();
      await expect(stat(regular!.filePath)).resolves.toBeDefined();
      expect(await readFile(bold!.filePath, "utf8")).toBe("bold-font");
      expect(bold?.browserUrl).toMatch(/^\/fonts\/retrieved\/[a-f0-9]{64}\/Aesthetic-Bold\.ttf$/);
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
      await expect(stat(results.find((entry) => entry.fileName === "Ageya-Regular.otf")!.filePath)).resolves.toBeDefined();
      await expect(stat(results.find((entry) => entry.fileName === "Ageya-Regular.woff2")!.filePath)).resolves.toBeDefined();
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
      expect(results[0]?.browserUrl).toMatch(/^\/fonts\/retrieved\/[a-f0-9]{64}\/Ageya-Regular\.ttf$/);
      await expect(stat(results[0]!.filePath)).resolves.toBeDefined();
      expect(await readFile(results[0]!.filePath, "utf8")).toBe("ttf-font");
    } finally {
      await rm(tempRoot, {recursive: true, force: true});
    }
  });

  it("uses a content-hashed public path so two sources cannot overwrite a planned font", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "zilliz-font-materializer-hash-"));
    try {
      const {materializeRetrievedFontAsset} = await import("../zilliz-font-materializer");
      const first = await materializeRetrievedFontAsset({
        family: "Editorial",
        sourceUrl: "https://r2.example.com/Editorial-Regular.ttf",
        targetRootDir: tempRoot,
        fetchImpl: async () => new Response(Buffer.from("first-font-binary")),
      });
      const second = await materializeRetrievedFontAsset({
        family: "Editorial",
        sourceUrl: "https://r2.example.com/Editorial-Regular.ttf",
        targetRootDir: tempRoot,
        fetchImpl: async () => new Response(Buffer.from("second-font-binary")),
      });

      expect(first[0]?.browserUrl).toMatch(/^\/fonts\/retrieved\/[a-f0-9]{64}\//);
      expect(second[0]?.browserUrl).toMatch(/^\/fonts\/retrieved\/[a-f0-9]{64}\//);
      expect(first[0]?.browserUrl).not.toBe(second[0]?.browserUrl);
      expect(first[0]?.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(await readFile(first[0]!.filePath, "utf8")).toBe("first-font-binary");
      expect(await readFile(second[0]!.filePath, "utf8")).toBe("second-font-binary");
    } finally {
      await rm(tempRoot, {recursive: true, force: true});
    }
  });
});
