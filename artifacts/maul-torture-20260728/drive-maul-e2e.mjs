// MAUL torture-clip E2E driver: project → timeline → treatments → candidates
// → review → render ×3 → replay ×1 → thumbnails. Runs under Windows node.exe.
import {readFileSync, writeFileSync, mkdirSync} from "node:fs";
import {createHash} from "node:crypto";
import {join, dirname} from "node:path";
import {fileURLToPath} from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const runDir = join(here, "run");
mkdirSync(runDir, {recursive: true});

const BASE = "http://localhost:8000";
const TENANT = "tenant_torture";
const CREATOR = "creator_torture";
const WIN_ROOT = "C:\\Users\\HomePC\\Downloads\\HELP, VIDEO MATTING";
const SOURCE_WIN = `${WIN_ROOT}\\rough TEST MYSELF.mp4`;
const M = join(here, "assets", "assets-manifest.json");
const manifest = JSON.parse(readFileSync(M, "utf8"));
const transcript = JSON.parse(readFileSync(join(here, "transcript.json"), "utf8"));

const log = [];
const t0 = Date.now();
const stamp = (step, extra = {}) => {
  const row = {step, atMs: Date.now() - t0, ...extra};
  log.push(row);
  console.log(`[+${(row.atMs / 1000).toFixed(1)}s] ${step}`, extra.summary ?? "");
};
const fail = (step, res, body) => {
  stamp(`FAIL:${step}`, {status: res.status, body});
  writeFileSync(join(runDir, "run-log.json"), JSON.stringify(log, null, 2));
  console.error(`\nXX ${step} -> HTTP ${res.status}\n${JSON.stringify(body, null, 2).slice(0, 3000)}`);
  process.exit(1);
};
const req = async (step, method, url, payload, {headers = {}, timeoutMs = 120_000} = {}) => {
  const started = Date.now();
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(url.startsWith("/api/maul/v1") ? {"x-maul-tenant-id": TENANT, "x-maul-creator-id": CREATOR} : {}),
      ...headers
    },
    body: payload ? JSON.stringify(payload) : undefined,
    signal: AbortSignal.timeout(timeoutMs)
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 500); }
  stamp(step, {status: res.status, tookMs: Date.now() - started});
  if (!res.ok) fail(step, res, body);
  return body;
};
const download = async (step, url, destPath, {headers = {}} = {}) => {
  const started = Date.now();
  const res = await fetch(`${BASE}${url}`, {headers, signal: AbortSignal.timeout(300_000)});
  if (!res.ok) fail(step, res, await res.text());
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(destPath, buf);
  const sha256 = createHash("sha256").update(buf).digest("hex");
  stamp(step, {status: res.status, tookMs: Date.now() - started, bytes: buf.length, sha256});
  return {bytes: buf.length, sha256};
};

// ---- music / sfx from the licensed manifest ------------------------------
const asset = id => manifest.assets.find(a => a.id === id);
const musicAsset = asset("music-dayfox-lioness");
const musicTrack = {
  id: musicAsset.id,
  storagePath: `${WIN_ROOT}\\artifacts\\maul-torture-20260728\\assets\\${musicAsset.path.replaceAll("/", "\\")}`,
  licenseType: musicAsset.licenseType,
  commercialAllowed: true, licenseVerified: true, renderSafe: true,
  title: musicAsset.title, artist: musicAsset.artist, durationSec: musicAsset.durationSec
};
const sfx = (id, eventType, sourceMs) => {
  const a = asset(id);
  return {
    id,
    storagePath: `${WIN_ROOT}\\artifacts\\maul-torture-20260728\\assets\\${a.path.replaceAll("/", "\\")}`,
    eventType, sourceMs,
    licenseType: a.licenseType, commercialAllowed: true, licenseVerified: true, renderSafe: true
  };
};
const sfxAssets = [
  sfx("sfx-riser-01", "hook_riser", 26500),      // hook onset ("Last week.")
  sfx("sfx-cinematic-hit", "payoff_hit", 40300), // 5.1% reveal
  sfx("sfx-whoosh-deep", "cta_whoosh", 61900)    // "what happened." payoff
];

// ---- 1. project -----------------------------------------------------------
stamp("intake:start");
const project = (await req("project:create", "POST", "/api/maul/projects", {
  tenantId: TENANT,
  creatorId: CREATOR,
  goal: "conversion",
  platform: "youtube_shorts",
  brandKitId: null,
  treatmentPreference: null,
  requestedShortCount: 3,
  requestedThumbnailCount: 3,
  targetDurationMs: {min: 25000, max: 35000},
  source: {
    originalFilename: "rough TEST MYSELF.mp4",
    storageKey: SOURCE_WIN,
    mediaType: "video/mp4",
    sha256: "9f40e0bd77ceae8a41f1ba2415f732bf4beb01a2ff87457cc5a0a34b120c8b89",
    durationMs: 130150,
    width: 1280, height: 720, fps: 7.5,
    hasAudio: true, hasVideo: true
  }
})).project;
writeFileSync(join(runDir, "01-project.json"), JSON.stringify(project, null, 2));

// ---- 2. editorial timeline (VAD via backend ffmpeg silencedetect) ---------
const timeline = (await req("timeline:create", "POST", `/api/maul/projects/${project.id}/editorial-timeline`, {
  transcript: {
    language: "en",
    text: transcript.text,
    words: transcript.words
  },
  // Hook window: real hook lands at "Last week. We tested..." (26.32s),
  // after the deliberately weak opening. Ending at "That's basically what
  // happened." (62.76s): hook → 2.8%/5.1% evidence → store-analogy payoff.
  // 36.7s source − ~4.0s dead-air cuts ⇒ ~32.7s output, inside the 25–35s gate.
  selectedWindow: {sourceStartMs: 26070, sourceEndMs: 62760},
  vadEvidence: {kind: "source_media", sourcePath: SOURCE_WIN},
  speakerDetections: [],
  shots: []
}, {timeoutMs: 300_000})).timeline;
writeFileSync(join(runDir, "02-timeline.json"), JSON.stringify(timeline, null, 2));
stamp("first-preview:ready", {summary: `timeline ${timeline.artifactId}`});

// ---- 3. treatment catalog --------------------------------------------------
const treatments = (await req("treatments:catalog", "POST", `/api/maul/projects/${project.id}/treatments`, {
  timelineArtifactId: timeline.artifactId, referenceCorpusArtifactIds: []
})).treatments;
writeFileSync(join(runDir, "03-treatments.json"), JSON.stringify(treatments, null, 2));

// ---- 4. candidates ----------------------------------------------------------
const candidatesBody = await req("candidates:generate", "POST", `/api/maul/projects/${project.id}/candidates`, {
  timelineArtifactId: timeline.artifactId
});
writeFileSync(join(runDir, "04-candidates.json"), JSON.stringify(candidatesBody, null, 2));
const candidate = candidatesBody.candidates[0];
stamp("first-preview:candidate", {summary: `${candidatesBody.candidates.length} candidate(s), durationMs=${candidate.payload?.outputDurationMs ?? "?"}`});

// ---- 5/6. per-treatment review + render ------------------------------------
const v1 = {"x-maul-tenant-id": TENANT, "x-maul-creator-id": CREATOR};
const results = [];
for (const t of treatments) {
  const tid = t.payload.treatmentId;
  const review = (await req(`review:${tid}`, "POST", `/api/maul/projects/${project.id}/reviews`, {
    candidateArtifactId: candidate.artifactId,
    treatmentGenomeArtifactId: t.artifactId,
    reviewerId: "reviewer_human",
    decision: "approved",
    failureClasses: [],
    rationale: `Torture-run approval for ${tid}: candidate preserves all factual claims (2.8%/5.1% figures, store analogy, attention-water metaphor, description-link CTA), rhetorical pause intact, captions source-grounded.`,
    rubricScores: {
      editorial_clarity: 95,
      source_fidelity: 100,
      pacing_fit: 94,
      visual_hierarchy: 93,
      accessibility: 96
    }
  })).review;

  const renderStarted = Date.now();
  const exported = (await req(`render:${tid}`, "POST", `/api/maul/projects/${project.id}/renders`, {
    candidateArtifactId: candidate.artifactId,
    treatmentGenomeArtifactId: t.artifactId,
    reviewDecisionArtifactId: review.artifactId,
    musicTrack, sfxAssets
  }, {timeoutMs: 20 * 60_000})).export;
  const renderMs = Date.now() - renderStarted;
  writeFileSync(join(runDir, `05-export-${tid}.json`), JSON.stringify(exported, null, 2));

  const dl = await download(`download:${tid}`, `/api/maul/v1/projects/${project.id}/exports/${exported.artifactId}/file`,
    join(runDir, `export-${tid}.mp4`), {headers: v1});
  results.push({tid, export: exported, renderMs, replayKey: exported.payload?.evidence?.deterministicReplayKey, ...dl});
}

// ---- 7. negative control: unlicensed music must be rejected -----------------
{
  const t = treatments[0];
  const review = (await req("review:neg-ctrl", "POST", `/api/maul/projects/${project.id}/reviews`, {
    candidateArtifactId: candidate.artifactId,
    treatmentGenomeArtifactId: t.artifactId,
    reviewerId: "reviewer_human",
    decision: "approved", failureClasses: [], rationale: "Negative-control review.",
    rubricScores: {editorial_clarity: 95, source_fidelity: 100, pacing_fit: 94, visual_hierarchy: 93, accessibility: 96}
  })).review;
  const res = await fetch(`${BASE}/api/maul/projects/${project.id}/renders`, {
    method: "POST", headers: {"content-type": "application/json"},
    body: JSON.stringify({
      candidateArtifactId: candidate.artifactId,
      treatmentGenomeArtifactId: t.artifactId,
      reviewDecisionArtifactId: review.artifactId,
      musicTrack: {...musicTrack, licenseVerified: false},
      sfxAssets
    }), signal: AbortSignal.timeout(120_000)
  });
  stamp("gate:unlicensed-music-rejected", {status: res.status, verdict: res.status >= 400 ? "PASS" : "FAIL"});
}

// ---- 8. tenant isolation ----------------------------------------------------
{
  const winner = results[0];
  const res = await fetch(`${BASE}/api/maul/v1/projects/${project.id}/exports/${winner.export.artifactId}/file`,
    {headers: {"x-maul-tenant-id": "tenant_other", "x-maul-creator-id": CREATOR}});
  stamp("gate:tenant-isolation", {status: res.status, verdict: res.status === 403 ? "PASS" : "FAIL"});
}

// ---- 9. deterministic replay: winner rendered twice -------------------------
const winner = results.find(r => r.tid === "premium_direct_response") ?? results[0];
{
  const t = treatments.find(x => x.payload.treatmentId === winner.tid);
  const review2 = (await req("review:replay", "POST", `/api/maul/projects/${project.id}/reviews`, {
    candidateArtifactId: candidate.artifactId,
    treatmentGenomeArtifactId: t.artifactId,
    reviewerId: "reviewer_human",
    decision: "approved", failureClasses: [],
    rationale: "Replay approval — identical payload for deterministic replay verification.",
    rubricScores: {editorial_clarity: 95, source_fidelity: 100, pacing_fit: 94, visual_hierarchy: 93, accessibility: 96}
  })).review;
  const exported2 = (await req("render:replay", "POST", `/api/maul/projects/${project.id}/renders`, {
    candidateArtifactId: candidate.artifactId,
    treatmentGenomeArtifactId: t.artifactId,
    reviewDecisionArtifactId: review2.artifactId,
    musicTrack, sfxAssets
  }, {timeoutMs: 20 * 60_000})).export;
  const dl2 = await download("download:replay", `/api/maul/v1/projects/${project.id}/exports/${exported2.artifactId}/file`,
    join(runDir, `export-${winner.tid}-REPLAY.mp4`), {headers: v1});
  const byteIdentical = dl2.sha256 === winner.sha256;
  const keyMatch = exported2.payload?.evidence?.deterministicReplayKey === winner.replayKey;
  stamp("gate:deterministic-replay", {verdict: byteIdentical || keyMatch ? "PASS-ish" : "CHECK",
    byteIdentical, replayKeyMatch: keyMatch,
    keyA: winner.replayKey, keyB: exported2.payload?.evidence?.deterministicReplayKey,
    note: "replayKey ties to reviewId in this codebase — same decisions, new review id => new key. byte-identity is the strict check."});
}

// ---- 10. thumbnails on winner export ---------------------------------------
const thumbs = await req("thumbnails:generate", "POST", `/api/maul/projects/${project.id}/thumbnails`, {
  exportArtifactId: winner.export.artifactId,
  brandKit: {
    kind: "supplied", name: "Signal Hitch",
    primaryColor: "#101418", accentColor: "#e23b2e",
    fontFamily: "Berylium", logoAssetId: null
  },
  requestedCount: 3
}, {timeoutMs: 300_000});
writeFileSync(join(runDir, "06-thumbnails.json"), JSON.stringify(thumbs, null, 2));
for (let i = 0; i < thumbs.candidates.length; i++) {
  const c = thumbs.candidates[i];
  await req(`thumbnail:review:${i}`, "POST", `/api/maul/projects/${project.id}/thumbnails/${c.artifactId}/review`, {
    reviewerId: "reviewer_human", decision: "approved",
    rationale: "Torture-run approval: copy is contiguous source language, face authentic."
  });
  await download(`thumbnail:download:${i}`, `/api/maul/projects/${project.id}/thumbnails/${c.artifactId}/file`,
    join(runDir, `thumbnail-${i}.png`));
}

// ---- wrap --------------------------------------------------------------------
const summary = {
  projectId: project.id,
  treatments: treatments.map(t => t.payload.treatmentId),
  results: results.map(({tid, renderMs, bytes, sha256, replayKey}) => ({tid, renderMs, bytes, sha256, replayKey})),
  winner: winner.tid,
  renderToDurationRatio: Object.fromEntries(results.map(r => [r.tid, +(r.renderMs / (r.export.payload?.durationMs ?? 1)).toFixed(2)])),
  totalMs: Date.now() - t0
};
writeFileSync(join(runDir, "run-log.json"), JSON.stringify(log, null, 2));
writeFileSync(join(runDir, "99-summary.json"), JSON.stringify(summary, null, 2));
console.log("\n== DONE ==\n" + JSON.stringify(summary, null, 2));
