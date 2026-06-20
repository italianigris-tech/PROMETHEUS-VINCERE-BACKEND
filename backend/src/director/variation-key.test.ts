import {beforeAll, describe, expect, it} from "vitest";
import * as fs from "fs";
import * as path from "path";

const targetPath = path.resolve(__dirname, "variation-key.ts");
const describeIfPresent = fs.existsSync(targetPath) ? describe : describe.skip;

describeIfPresent("Variation Key contract", () => {
  let buildVariationKey: any;

  beforeAll(async () => {
    ({buildVariationKey} = await import(new URL("./variation-key.ts", import.meta.url).href));
  });

  it("keeps identical upload instance and retry index stable", () => {
    const left = buildVariationKey({
      sourcePath: "file:///test.mp4",
      prompt: "Make it intense",
      uploadInstanceId: "upload-1",
      retryIndex: 0,
    });
    const right = buildVariationKey({
      sourcePath: "file:///test.mp4",
      prompt: "Make it intense",
      uploadInstanceId: "upload-1",
      retryIndex: 0,
    });

    expect(right).toEqual(left);
  });

  it("changes when retry index changes", () => {
    const first = buildVariationKey({
      sourcePath: "file:///test.mp4",
      prompt: "Make it intense",
      uploadInstanceId: "upload-1",
      retryIndex: 0,
    });
    const retry = buildVariationKey({
      sourcePath: "file:///test.mp4",
      prompt: "Make it intense",
      uploadInstanceId: "upload-1",
      retryIndex: 1,
    });

    expect(retry).not.toEqual(first);
  });

  it("makes upload_instance_id and retry_index explicit", () => {
    const key = buildVariationKey({
      sourcePath: "file:///test.mp4",
      prompt: "Make it intense",
      uploadInstanceId: "upload-1",
      retryIndex: 2,
    });

    expect(key.uploadInstanceId ?? key.upload_instance_id).toBe("upload-1");
    expect(key.retryIndex ?? key.retry_index).toBe(2);
  });
});
