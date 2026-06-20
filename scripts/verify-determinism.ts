import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
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

const repoRoot = path.resolve(__dirname, "..");

const stableManifest = (manifest: ReturnType<typeof generateJosephManifest>) => ({
  ...manifest,
  jobId: "<job-id>",
  createdAt: "<created-at>",
});

const sha256 = (value: unknown) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

const scanForbiddenRenderApis = () => {
  const compositionsDir = path.join(repoRoot, "remotion-app/src/compositions");
  const forbidden = /\bMath\.random\s*\(|\bDate\.now\s*\(|\bperformance\.now\s*\(|\brequestAnimationFrame\s*\(|\bsetInterval\s*\(|\bsetTimeout\s*\(|\bcrypto\.getRandomValues\s*\(|\bnew Date\s*\(|\bgsap\b/i;
  const violations: string[] = [];

  for (const file of fs.readdirSync(compositionsDir)) {
    if (!/\.(ts|tsx)$/.test(file)) {
      continue;
    }
    const content = fs.readFileSync(path.join(compositionsDir, file), "utf8");
    if (forbidden.test(content)) {
      violations.push(file);
    }
  }

  return violations;
};

const report = (label: string, pass: boolean, detail: string) => {
  console.log(`${pass ? "PASS" : "FAIL"} ${label}: ${detail}`);
  return pass;
};

const manifestA = stableManifest(generateJosephManifest(TEST_INPUT));
const manifestB = stableManifest(generateJosephManifest(TEST_INPUT));
const manifestC = stableManifest(generateJosephManifest({...TEST_INPUT, seed: 99999}));
const hashA = sha256(manifestA);
const hashB = sha256(manifestB);
const hashC = sha256(manifestC);
const violations = scanForbiddenRenderApis();

const checks = [
  report("same seed manifest", hashA === hashB, `${hashA.slice(0, 16)} vs ${hashB.slice(0, 16)}`),
  report("different seed manifest", hashA !== hashC, `${hashA.slice(0, 16)} vs ${hashC.slice(0, 16)}`),
  report("vertical metadata", manifestA.width === 1080 && manifestA.height === 1920, `${manifestA.width}x${manifestA.height}`),
  report("no forbidden composition APIs", violations.length === 0, violations.length === 0 ? "none" : violations.join(", ")),
];

const pass = checks.every(Boolean);
console.log(pass ? "ALL DETERMINISM CHECKS PASSED" : "DETERMINISM CHECKS FAILED");
process.exit(pass ? 0 : 1);
