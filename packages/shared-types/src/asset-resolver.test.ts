import {describe, expect, it} from "vitest";
import {MediaReferenceSchema} from "./asset-resolver.js";

describe("MediaReferenceSchema", () => {
  it("accepts a browser-safe relative URL and absolute Windows file path", () => {
    const reference = MediaReferenceSchema.parse({
      assetId: "asset://source-video/job-1",
      browserUrl: "/uploads/job-1/source.mp4",
      filePath: "C:/prometheus/uploads/job-1/source.mp4",
      contentType: "video/mp4",
      sizeBytes: 1024,
    });

    expect(reference.browserUrl).toBe("/uploads/job-1/source.mp4");
    expect(reference.contentType).toBe("video/mp4");
    expect(reference.sizeBytes).toBe(1024);
  });

  it("accepts an absolute HTTP browser URL", () => {
    const reference = MediaReferenceSchema.parse({
      assetId: "asset://source-video/job-1",
      browserUrl: "http://localhost:3456/uploads/job-1/source.mp4",
      filePath: "/tmp/prometheus/uploads/job-1/source.mp4",
      contentType: "video/mp4",
      sizeBytes: 2048,
    });

    expect(reference.browserUrl).toContain("localhost:3456");
  });

  it("rejects file URLs and local filesystem paths as browser URLs", () => {
    expect(MediaReferenceSchema.safeParse({
      assetId: "asset://source-video/job-1",
      browserUrl: "file:///C:/prometheus/source.mp4",
      filePath: "C:/prometheus/source.mp4",
      contentType: "video/mp4",
      sizeBytes: 1024,
    }).success).toBe(false);

    expect(MediaReferenceSchema.safeParse({
      assetId: "asset://source-video/job-1",
      browserUrl: "C:/prometheus/source.mp4",
      filePath: "C:/prometheus/source.mp4",
      contentType: "video/mp4",
      sizeBytes: 1024,
    }).success).toBe(false);
  });

  it("rejects non-absolute file paths", () => {
    const result = MediaReferenceSchema.safeParse({
      assetId: "asset://source-video/job-1",
      browserUrl: "/uploads/job-1/source.mp4",
      filePath: "uploads/job-1/source.mp4",
      contentType: "video/mp4",
      sizeBytes: 1024,
    });

    expect(result.success).toBe(false);
  });

  it("rejects empty content type and zero-byte assets", () => {
    expect(MediaReferenceSchema.safeParse({
      assetId: "asset://source-video/job-1",
      browserUrl: "/uploads/job-1/source.mp4",
      filePath: "C:/prometheus/source.mp4",
      contentType: "",
      sizeBytes: 1024,
    }).success).toBe(false);

    expect(MediaReferenceSchema.safeParse({
      assetId: "asset://source-video/job-1",
      browserUrl: "/uploads/job-1/source.mp4",
      filePath: "C:/prometheus/source.mp4",
      contentType: "video/mp4",
      sizeBytes: 0,
    }).success).toBe(false);
  });
});
