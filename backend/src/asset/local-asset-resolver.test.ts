import {mkdtemp, readFile, rm, stat, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {LocalAssetResolver} from "./local-asset-resolver";

describe("LocalAssetResolver", () => {
  let tempRoot: string;
  let publicDir: string;
  let uploadDir: string;
  let sourcePath: string;

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), "prometheus-asset-resolver-"));
    publicDir = path.join(tempRoot, "public");
    uploadDir = path.join(tempRoot, "uploads");
    sourcePath = path.join(tempRoot, "source.mp4");
    await writeFile(sourcePath, Buffer.from("fake-video"));
  });

  afterEach(async () => {
    await rm(tempRoot, {recursive: true, force: true});
  });

  it("copies uploaded media into a browser-accessible public upload directory", async () => {
    const resolver = new LocalAssetResolver({publicDir, uploadDir});

    const reference = await resolver.registerUpload(sourcePath, "job-1");

    expect(reference.assetId).toBe("asset://source-video/job-1/source.mp4");
    expect(reference.browserUrl).toBe("/uploads/job-1/source.mp4");
    expect(reference.contentType).toBe("video/mp4");
    expect(reference.sizeBytes).toBe(Buffer.byteLength("fake-video"));
    expect(path.isAbsolute(reference.filePath)).toBe(true);
    expect(await readFile(reference.filePath, "utf8")).toBe("fake-video");
    expect((await stat(reference.filePath)).isFile()).toBe(true);
    expect(reference.browserUrl).not.toContain("file://");
    expect(reference.browserUrl).not.toContain("C:");
  });

  it("resolves registered browser URLs and FFmpeg file paths by asset id", async () => {
    const resolver = new LocalAssetResolver({publicDir, uploadDir});
    const reference = await resolver.registerUpload(sourcePath, "job-1");

    expect(resolver.resolveBrowser(reference.assetId)).toBe(reference.browserUrl);
    expect(resolver.resolveFile(reference.assetId)).toBe(reference.filePath);
  });

  it("throws for unknown asset ids", () => {
    const resolver = new LocalAssetResolver({publicDir, uploadDir});

    expect(() => resolver.resolveBrowser("asset://missing")).toThrow(/Unknown media asset/);
    expect(() => resolver.resolveFile("asset://missing")).toThrow(/Unknown media asset/);
  });

  it("serves uploaded media over HTTP when a port is configured", async () => {
    const resolver = new LocalAssetResolver({publicDir, uploadDir, port: 0});
    const reference = await resolver.registerUpload(sourcePath, "job-1");

    try {
      expect(reference.browserUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/uploads\/job-1\/source\.mp4$/);
      expect(reference.contentType).toBe("video/mp4");
      expect(reference.sizeBytes).toBe(Buffer.byteLength("fake-video"));
      const response = await fetch(reference.browserUrl);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("video/mp4");
      expect(await response.text()).toBe("fake-video");
    } finally {
      await resolver.close();
    }
  });

  it("sanitizes job ids and file names before creating browser URLs", async () => {
    const nestedSourcePath = path.join(tempRoot, "..-source..mp4");
    await writeFile(nestedSourcePath, Buffer.from("fake-video"));
    const resolver = new LocalAssetResolver({publicDir, uploadDir});

    const reference = await resolver.registerUpload(nestedSourcePath, "../job 1");

    expect(reference.assetId).toBe("asset://source-video/job-1/source.mp4");
    expect(reference.browserUrl).toBe("/uploads/job-1/source.mp4");
    expect(reference.browserUrl).not.toContain("../");
  });
});
