import {createHash} from "node:crypto";
import {mkdtemp, rm, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {afterEach, describe, expect, it} from "vitest";

import {runMaulMediaObservation} from "./mediapipe-observation.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, {recursive: true, force: true})
    ),
  );
});

const sha256 = (value: string | Buffer): string =>
  createHash("sha256").update(value).digest("hex");

const fixture = async (scriptBody: string) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "maul-observation-"));
  temporaryDirectories.push(directory);
  const sourcePath = path.join(directory, "source.mp4");
  const observationScript = path.join(directory, "observe.mjs");
  const sourceBytes = Buffer.from("controlled-video-fixture");
  await Promise.all([
    writeFile(sourcePath, sourceBytes),
    writeFile(observationScript, scriptBody, "utf8"),
  ]);
  return {sourcePath, observationScript, sourceSha256: sha256(sourceBytes)};
};

const validScript = (providerId = "mediapipe_opencv") => `
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
const sourceIndex = process.argv.indexOf("--source") + 1;
const sourcePath = process.argv[sourceIndex];
const sourceSha256 = createHash("sha256").update(readFileSync(sourcePath)).digest("hex");
process.stdout.write(JSON.stringify({
  schemaVersion: "maul-media-observation/v1",
  sourceSha256,
  detector: {
    providerId: ${JSON.stringify(providerId)},
    mediapipeVersion: "0.10.21",
    opencvVersion: "4.11.0",
    configurationSha256: "b".repeat(64)
  },
  frames: [{
    sourceMs: 0,
    faceBox: {x: 0.4, y: 0.1, width: 0.2, height: 0.2},
    poseLandmarks: [{name: "nose", x: 0.5, y: 0.2, confidence: 0.99}],
    subjectBox: {x: 0.3, y: 0.08, width: 0.4, height: 0.82},
    luminanceGrid: {columns: 12, rows: 20, samples: Array(240).fill(0.25)}
  }],
  missingSpans: []
}));
`;

const run = async ({
  sourcePath,
  observationScript,
}: {
  sourcePath: string;
  observationScript: string;
}) => runMaulMediaObservation({
  sourcePath,
  durationMs: 20_000,
  outputWidth: 1080,
  outputHeight: 1920,
  sampleEveryFrames: 6,
  pythonBin: process.execPath,
  observationScript,
});

describe("MAUL MediaPipe observation adapter", () => {
  it("validates normalized real-subprocess observations and attaches a receipt", async () => {
    const input = await fixture(validScript());

    const result = await run(input);

    expect(result.sourceSha256).toBe(input.sourceSha256);
    expect(result.detector).toMatchObject({
      providerId: "mediapipe_opencv",
      mediapipeVersion: "0.10.21",
      opencvVersion: "4.11.0",
    });
    expect(result.frames[0]?.subjectBox).toEqual({
      x: 0.3,
      y: 0.08,
      width: 0.4,
      height: 0.82,
    });
    expect(result.receipt).toMatchObject({
      stage: "media_observation",
      cache: "miss",
      inputSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      outputSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      failure: null,
    });
  });

  it("accepts bounded MediaPipe setup progress before the JSON payload", async () => {
    const script = validScript().replace(
      "const sourceIndex",
      'process.stdout.write("Downloading vision model...\\n");\nconst sourceIndex',
    );
    const input = await fixture(script);

    const result = await run(input);

    expect(result.detector.providerId).toBe("mediapipe_opencv");
  });

  it("rejects malformed subprocess output", async () => {
    const input = await fixture('process.stdout.write("not-json");');

    await expect(run(input)).rejects.toThrow(/JSON|observation.*output/i);
  });

  it("reports a bounded subprocess failure without treating stderr as evidence", async () => {
    const input = await fixture(`
process.stderr.write(JSON.stringify({code: "missing_dependency", message: "mediapipe unavailable"}));
process.exit(2);
`);

    await expect(run(input)).rejects.toThrow(/missing_dependency|mediapipe unavailable/i);
  });

  it("rejects speaker-track or heuristic output claiming the observation seam", async () => {
    const input = await fixture(validScript("speaker_track_heuristic"));

    await expect(run(input)).rejects.toThrow(/mediapipe_opencv|provider/i);
  });

  it("hashes identical observations identically across subprocess runs", async () => {
    const input = await fixture(validScript());

    const first = await run(input);
    const second = await run(input);

    expect(first.receipt.outputSha256).toBe(second.receipt.outputSha256);
  });
});
