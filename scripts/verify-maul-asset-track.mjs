import {execFile} from "node:child_process";
import {createHash} from "node:crypto";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {fileURLToPath} from "node:url";

import {maulUnifiedShortRenderManifestV3Schema} from "../packages/shared-types/dist/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const remotionRoot = path.join(repoRoot, "remotion-app");
const proofRoot = path.join(repoRoot, "artifacts", "maul-asset-track");
const fixtureRoot = path.join(remotionRoot, "public", ".maul-proofs");
const manifestPath = path.join(proofRoot, "backend-v3-manifest.json");
const ffmpeg = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
const ffprobe = process.platform === "win32" ? "ffprobe.exe" : "ffprobe";

const run = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    execFile(command, args, {windowsHide: true, maxBuffer: 16 * 1024 * 1024, ...options}, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`${path.basename(command)} ${args[0] ?? ""} failed: ${stderr.trim() || error.message}`));
        return;
      }
      resolve({stdout, stderr});
    });
  });

const sha256 = async (filePath) =>
  createHash("sha256").update(await readFile(filePath)).digest("hex");

const writeJson = (filePath, value) =>
  writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");

const captureBackendManifest = async () => {
  const command = "npm.cmd --workspace @prometheus/backend test -- --testTimeout=120000 src/__tests__/maul-short-render-path.test.ts";
  await run(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", command], {
    cwd: repoRoot,
    env: {...process.env, MAUL_CAPTURE_MANIFEST_PATH: manifestPath},
    timeout: 180_000,
  });
};

const createTechnicalFixtures = async () => {
  await mkdir(fixtureRoot, {recursive: true});
  const source = path.join(fixtureRoot, "source.mp4");
  const bRoll = path.join(fixtureRoot, "b-roll.mp4");
  const evidence = path.join(fixtureRoot, "evidence.png");
  const music = path.join(fixtureRoot, "music.m4a");
  const durationSeconds = "4";

  await run(ffmpeg, [
    "-f", "lavfi", "-i", "color=c=0x091218:s=1080x1920:r=30",
    "-f", "lavfi", "-i", "sine=frequency=180:sample_rate=48000",
    "-t", durationSeconds,
    "-vf", "drawbox=x=96:y=420:w=888:h=4:color=0x00e5ff@0.8:t=fill,drawbox=x=96:y=1500:w=888:h=4:color=0xf06424@0.8:t=fill,drawtext=text=SPEAKER:fontcolor=white:fontsize=42:x=(w-text_w)/2:y=120:box=1:boxcolor=0x10182099:boxborderw=18",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", "-y", source,
  ]);
  await run(ffmpeg, [
    "-f", "lavfi", "-i", "color=c=0x16444c:s=1080x1920:r=30",
    "-t", durationSeconds,
    "-vf", "drawbox=x=96:y=600:w=888:h=560:color=0x00e5ff@0.18:t=fill,drawbox=x=96:y=600:w=888:h=560:color=0x9ce8e0@0.8:t=12,drawtext=text=B-ROLL:fontcolor=white:fontsize=42:x=(w-text_w)/2:y=h-180:box=1:boxcolor=0x167c8099:boxborderw=18",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", "-y", bRoll,
  ]);
  await run(ffmpeg, [
    "-f", "lavfi", "-i", "color=c=0x101820:s=1080x1920",
    "-frames:v", "1",
    "-vf", "drawbox=x=72:y=300:w=936:h=1320:color=0x00e5ff@0.12:t=fill,drawbox=x=72:y=300:w=936:h=1320:color=0x00e5ff@0.85:t=12,drawtext=text=PROOF:fontcolor=0x00e5ff:fontsize=68:x=(w-text_w)/2:y=760,drawtext=text=EVIDENCE:fontcolor=white:fontsize=32:x=(w-text_w)/2:y=900",
    "-y", evidence,
  ]);
  await run(ffmpeg, [
    "-f", "lavfi", "-i", "sine=frequency=110:sample_rate=48000",
    "-t", durationSeconds,
    "-c:a", "aac", "-b:a", "128k", "-y", music,
  ]);
  return {source, bRoll, evidence, music};
};

const visualAsset = ({
  assetId,
  mediaKind,
  storagePath,
  sha,
  width,
  height,
  durationMs,
  provenanceReceiptId,
  permittedRoles,
  rootSourceAssetId,
  projectId,
  provenanceKind = "project_owned",
}) => ({
  assetId,
  projectId,
  rootSourceAssetId,
  mediaKind,
  storagePath,
  sha256: sha,
  width,
  height,
  durationMs,
  rights: {verified: true, receiptId: `rights_${assetId}`},
  provenance: {kind: provenanceKind, provenanceReceiptId},
  permittedRoles,
});

const makeInterval = ({id, start, end, mode, assetId, secondaryAssetId = null, purpose, graphic}) => {
  const sourceBacked =
    mode === "speaker_hero" || mode === "quiet_hold" || mode === "split_proof";
  return {
    intervalId: id,
    outputStartMs: start,
    outputEndMs: end,
    sourceStartMs: sourceBacked ? start : null,
    sourceEndMs: sourceBacked ? end : null,
    mode,
    assetId,
    secondaryAssetId,
    crop: {x: 0, y: 0, width: 1, height: 1},
    ...(graphic ? {graphic} : {}),
    purpose,
    evidenceRationale: mode === "speaker_hero" || mode === "quiet_hold"
      ? "Canonical source retained for clarity and source fidelity."
      : "Verified project-scoped technical fixture selected for this proof mode.",
    transition: {type: "hard_cut", durationMs: 0},
  };
};

const makeTrack = ({base, assets, intervals}) => ({
  schemaVersion: "maul-visual-track/v1",
  projectId: base.projectId,
  rootSourceAssetId: base.rootSourceAssetId,
  sourceAssetId: base.sourceAssetId,
  outputDurationMs: base.outputDurationMs,
  assets,
  intervals,
});

const makeManifest = ({captured, name, fixtures, intervals}) => {
  const outputDurationMs = captured.timeline.outputDurationMs;
  const existingTrack = captured.plans.visual.visualTrack;
  const projectId = existingTrack.projectId;
  const rootSourceAssetId = existingTrack.rootSourceAssetId;
  const sourceAssetId = existingTrack.sourceAssetId;
  const sourcePath = ".maul-proofs/source.mp4";
  const bRollPath = ".maul-proofs/b-roll.mp4";
  const evidencePath = ".maul-proofs/evidence.png";
  const assets = [
    visualAsset({
      assetId: sourceAssetId,
      mediaKind: "video",
      storagePath: sourcePath,
      sha: fixtures.sourceSha,
      width: 1080,
      height: 1920,
      durationMs: 4_000,
      provenanceReceiptId: null,
      permittedRoles: ["speaker_hero", "quiet_hold", "split_proof"],
      rootSourceAssetId,
      projectId,
      provenanceKind: "source",
    }),
    visualAsset({
      assetId: "proof_b_roll",
      mediaKind: "video",
      storagePath: bRollPath,
      sha: fixtures.bRollSha,
      width: 1080,
      height: 1920,
      durationMs: 4_000,
      provenanceReceiptId: "fixture_b_roll_receipt",
      permittedRoles: ["b_roll"],
      rootSourceAssetId,
      projectId,
    }),
    visualAsset({
      assetId: "proof_evidence",
      mediaKind: "image",
      storagePath: evidencePath,
      sha: fixtures.evidenceSha,
      width: 1080,
      height: 1920,
      durationMs: null,
      provenanceReceiptId: "fixture_evidence_receipt",
      permittedRoles: ["evidence_image", "split_proof"],
      rootSourceAssetId,
      projectId,
    }),
  ];
  const visualTrack = makeTrack({
    base: {projectId, rootSourceAssetId, sourceAssetId, outputDurationMs},
    assets,
    intervals,
  });
  return maulUnifiedShortRenderManifestV3Schema.parse({
    ...captured,
    source: {
      ...captured.source,
      storagePath: sourcePath,
      sha256: fixtures.sourceSha,
    },
    audio: {
      ...captured.audio,
      musicTrack: {...captured.audio.musicTrack, storagePath: ".maul-proofs/music.m4a"},
      sfxAssets: [],
    },
    plans: {
      ...captured.plans,
      visual: {...captured.plans.visual, visualTrack},
    },
    replayKey: createHash("sha256").update(`${captured.replayKey}:${name}`).digest("hex"),
  });
};

const renderProof = async ({name, manifest, frameTimesMs}) => {
  const outputPath = path.join(proofRoot, `${name}.mp4`);
  const propsPath = path.join(proofRoot, `${name}.props.json`);
  await writeJson(propsPath, {manifest});
  await run(process.execPath, [
    path.join(remotionRoot, "node_modules", "@remotion", "cli", "remotion-cli.js"),
    "render", "src/index.ts", "MaulShort", outputPath,
    `--props=${propsPath}`, "--codec=h264", "--audio-codec=aac", "--concurrency=1", "--overwrite",
  ], {cwd: remotionRoot, timeout: 15 * 60 * 1000});

  const probe = JSON.parse((await run(ffprobe, [
    "-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height", "-of", "json", outputPath,
  ])).stdout);
  const video = probe.streams.find((stream) => stream.codec_type === "video");
  const audio = probe.streams.find((stream) => stream.codec_type === "audio");
  if (video?.codec_name !== "h264" || video.width !== 1080 || video.height !== 1920 || audio?.codec_name !== "aac") {
    throw new Error(`${name} did not encode as 1080x1920 H.264/AAC.`);
  }

  const frames = [];
  for (const outputMs of frameTimesMs) {
    const framePath = path.join(proofRoot, `${name}-${outputMs}ms.png`);
    await run(ffmpeg, ["-ss", (outputMs / 1000).toFixed(3), "-i", outputPath, "-frames:v", "1", "-y", framePath]);
    frames.push({outputMs, file: path.basename(framePath), sha256: await sha256(framePath)});
  }
  return {outputPath, probe: {video, audio}, frames};
};

await mkdir(proofRoot, {recursive: true});
await captureBackendManifest();
const captured = JSON.parse(await readFile(manifestPath, "utf8"));
const fixtureFiles = await createTechnicalFixtures();
const fixtures = {
  ...fixtureFiles,
  sourceSha: await sha256(fixtureFiles.source),
  bRollSha: await sha256(fixtureFiles.bRoll),
  evidenceSha: await sha256(fixtureFiles.evidence),
};
const sourceId = captured.plans.visual.visualTrack.sourceAssetId;
const outputEnd = captured.timeline.outputDurationMs;

const proofs = [
  {
    name: "cursive-editorial",
    frameTimesMs: [450, 1800, 2850],
    intervals: [
      makeInterval({id: "cursive_hero", start: 0, end: 1_250, mode: "speaker_hero", assetId: sourceId, purpose: "Source-led editorial opening."}),
      makeInterval({id: "cursive_graphic", start: 1_250, end: 2_150, mode: "editorial_graphic", assetId: null, purpose: "Source-grounded editorial emphasis.", graphic: {headline: "MAKE IT\nBREATHE", detail: "A restrained text lockup preserves the spoken point.", accentColor: "#00e5ff"}}),
      makeInterval({id: "cursive_hold", start: 2_150, end: outputEnd, mode: "quiet_hold", assetId: sourceId, purpose: "Return to the speaker for the final line."}),
    ],
  },
  {
    name: "strong-text",
    frameTimesMs: [350, 1500, 2700],
    intervals: [
      makeInterval({id: "text_hero", start: 0, end: 1_000, mode: "speaker_hero", assetId: sourceId, purpose: "Strong source-led phrase presentation."}),
      makeInterval({id: "text_proof", start: 1_000, end: 2_000, mode: "evidence_image", assetId: "proof_evidence", purpose: "Verified evidence supports the spoken claim."}),
      makeInterval({id: "text_return", start: 2_000, end: outputEnd, mode: "speaker_hero", assetId: sourceId, purpose: "Speaker remains the authority for resolution."}),
    ],
  },
  {
    name: "cinematic-asset-track",
    frameTimesMs: [300, 850, 1400, 2000, 2600, 3050],
    intervals: [
      makeInterval({id: "cinematic_hero", start: 0, end: 550, mode: "speaker_hero", assetId: sourceId, purpose: "Anchor the edit in the canonical speaker."}),
      makeInterval({id: "cinematic_broll", start: 550, end: 1_100, mode: "b_roll", assetId: "proof_b_roll", purpose: "Approved B-roll clarifies the proof beat."}),
      makeInterval({id: "cinematic_evidence", start: 1_100, end: 1_650, mode: "evidence_image", assetId: "proof_evidence", purpose: "Verified evidence image makes the claim inspectable."}),
      makeInterval({id: "cinematic_split", start: 1_650, end: 2_250, mode: "split_proof", assetId: sourceId, secondaryAssetId: "proof_evidence", purpose: "Keep the speaker and proof visible together."}),
      makeInterval({id: "cinematic_graphic", start: 2_250, end: 2_750, mode: "editorial_graphic", assetId: null, purpose: "Deliver one concise editorial synthesis.", graphic: {headline: "PROOF\nOVER NOISE", detail: "Declared graphic data only.", accentColor: "#f06424"}}),
      makeInterval({id: "cinematic_hold", start: 2_750, end: outputEnd, mode: "quiet_hold", assetId: sourceId, purpose: "Settle on the source for the close."}),
    ],
  },
];

const onlyArgument = process.argv.find((argument) => argument.startsWith("--only="));
const requestedProofNames = onlyArgument
  ? new Set(onlyArgument.slice("--only=".length).split(",").filter(Boolean))
  : null;
const proofsToRender = requestedProofNames
  ? proofs.filter((proof) => requestedProofNames.has(proof.name))
  : proofs;
if (proofsToRender.length === 0) {
  throw new Error("--only must name at least one known MAUL proof.");
}

const receipts = [];
for (const proof of proofsToRender) {
  const manifest = makeManifest({captured, name: proof.name, fixtures, intervals: proof.intervals});
  const result = await renderProof({...proof, manifest});
  const receipt = {
    schemaVersion: "maul-asset-track-proof-receipt/v1",
    proof: proof.name,
    output: {
      file: path.basename(result.outputPath),
      width: result.probe.video.width,
      height: result.probe.video.height,
      videoCodec: result.probe.video.codec_name,
      audioCodec: result.probe.audio.codec_name,
      sha256: await sha256(result.outputPath),
    },
    visualTrack: proof.intervals.map((interval) => ({
      mode: interval.mode,
      outputStartMs: interval.outputStartMs,
      outputEndMs: interval.outputEndMs,
    })),
    frames: result.frames,
    inputs: {
      referenceCorpusUsed: false,
      generatedProviderUsed: false,
      fixtureClass: "self-created technical media for renderer verification only",
    },
  };
  await writeJson(path.join(proofRoot, `${proof.name}.receipt.json`), receipt);
  receipts.push(receipt);
}

const retainedReceipts = requestedProofNames
  ? await Promise.all(
      proofs
        .filter((proof) => !requestedProofNames.has(proof.name))
        .map(async (proof) => JSON.parse(await readFile(path.join(proofRoot, `${proof.name}.receipt.json`), "utf8"))),
    )
  : [];
const allReceipts = [...retainedReceipts, ...receipts];
await writeJson(path.join(proofRoot, "receipt-index.json"), {
  schemaVersion: "maul-asset-track-proof-index/v1",
  proofs: allReceipts.map((receipt) => ({proof: receipt.proof, output: receipt.output, visualTrack: receipt.visualTrack})),
  referenceCorpusUsed: false,
  generatedProviderUsed: false,
});

console.log(`MAUL asset-track proof verified: ${allReceipts.map((receipt) => receipt.proof).join(", ")}`);
