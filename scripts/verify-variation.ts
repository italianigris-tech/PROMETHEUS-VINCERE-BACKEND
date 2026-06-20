import * as crypto from "crypto";
import {generateJosephManifest} from "../backend/src/director/joseph-director";
import type {DirectorInput} from "../backend/src/director/joseph-director";

const TEST_INPUT: DirectorInput = {
  videoUrl: "file:///test.mp4",
  musicTrackUrl: "file:///test.mp3",
  transcript: [
    {text: "Listen", startMs: 200, endMs: 420, confidence: 0.98},
    {text: "if", startMs: 430, endMs: 520, confidence: 0.95},
    {text: "you", startMs: 530, endMs: 620, confidence: 0.96},
    {text: "want", startMs: 630, endMs: 780, confidence: 0.97},
    {text: "to", startMs: 790, endMs: 860, confidence: 0.94},
    {text: "win", startMs: 870, endMs: 1080, confidence: 0.99},
  ],
  beats: [300, 620, 940, 1260],
  onsets: [200, 870],
  energyCurve: [0.25, 0.35, 0.82, 0.45],
  durationMs: 1500,
  seed: 12345,
  profile: "joseph_aggressive",
};

const stableManifest = (manifest: ReturnType<typeof generateJosephManifest>) => ({
  ...manifest,
  jobId: "<job-id>",
  createdAt: "<created-at>",
});

const sha256 = (value: unknown) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const report = (label: string, pass: boolean, detail: string) => {
  console.log(`${pass ? "PASS" : "FAIL"} ${label}: ${detail}`);
  return pass;
};

async function main() {
  const directorModule = await import("../backend/src/director/joseph-director");
  const maybeGenerateCandidateGenomes = (directorModule as Record<string, unknown>).generateCandidateGenomes;

  let checks: boolean[] = [];

  if (typeof maybeGenerateCandidateGenomes === "function") {
    const candidates = maybeGenerateCandidateGenomes(TEST_INPUT, 6) as unknown[];
    const hashes = candidates.map((candidate) => sha256(candidate));
    checks = [
      report("candidate count", candidates.length === 6, String(candidates.length)),
      report("candidate distinctness", new Set(hashes).size === 6, `${new Set(hashes).size} distinct`),
    ];
  } else {
    const aggressive = stableManifest(generateJosephManifest(TEST_INPUT));
    const cinematic = stableManifest(generateJosephManifest({...TEST_INPUT, profile: "joseph_cinematic"}));
    const minimal = stableManifest(generateJosephManifest({...TEST_INPUT, profile: "joseph_minimal"}));
    const hashes = [aggressive, cinematic, minimal].map((manifest) => sha256(manifest));

    checks = [
      report("candidate generator exported", false, "generateCandidateGenomes is missing"),
      report("profile fallback variation", new Set(hashes).size === 3, `${new Set(hashes).size} distinct profile manifests`),
    ];
  }

  const pass = checks.every(Boolean);
  console.log(pass ? "ALL VARIATION CHECKS PASSED" : "VARIATION CHECKS FAILED");
  process.exit(pass ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
