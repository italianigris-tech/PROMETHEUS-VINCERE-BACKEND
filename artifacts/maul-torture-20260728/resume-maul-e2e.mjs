// MAUL torture-clip E2E RESUME driver: v5's project/timeline/treatments/candidate
// already exist server-side; founder_podcast export already rendered + registered
// (client died on undici's 300s headers timeout; server finished anyway).
// This driver: downloads the existing founder_podcast export, renders the other
// two treatments, replays the winner, runs the negative/tenant gates, thumbnails.
// Uses node:http directly so long renders are never killed by client timeouts.
import {readFileSync, writeFileSync, mkdirSync} from "node:fs";
import {createHash} from "node:crypto";
import {join, dirname} from "node:path";
import {fileURLToPath} from "node:url";
import http from "node:http";

const here = dirname(fileURLToPath(import.meta.url));
const runDir = join(here, "run");
mkdirSync(runDir, {recursive: true});

const BASE = "http://localhost:8000";
const TENANT = "tenant_torture";
const CREATOR = "creator_torture";
const WIN_ROOT = "C:\\Users\\HomePC\\Downloads\\HELP, VIDEO MATTING";
const M = join(here, "assets", "assets-manifest.json");
const manifest = JSON.parse(readFileSync(M, "utf8"));

const log = [];
const t0 = Date.now();
const stamp = (step, extra = {}) => {
  const row = {step, atMs: Date.now() - t0, ...extra};
  log.push(row);
  console.log(`[+${(row.atMs / 1000).toFixed(1)}s] ${step}`, extra.summary ?? "");
  writeFileSync(join(runDir, "run-log-resume.json"), JSON.stringify(log, null, 2));
};
const fail = (step, status, body) => {
  stamp(`FAIL:${step}`, {status, body});
  console.error(`\nXX ${step} -> HTTP ${status}\n${JSON.stringify(body, null, 2).slice(0, 4000)}`);
  process.exit(1);
};

// node:http request with NO socket/header timeout — long renders are fine.
const httpJson = (method, url, payload, headers = {}) => new Promise((resolve, reject) => {
  const u = new URL(`${BASE}${url}`);
  const body = payload ? JSON.stringify(payload) : null;
  const req = http.request({
    hostname: u.hostname, port: u.port, path: u.pathname + u.search, method,
    headers: {
      ...(body ? {"content-type": "application/json", "content-length": Buffer.byteLength(body)} : {}),
      ...headers
    },
    timeout: 0,
    agent: false
  }, (res) => {
    const chunks = [];
    res.on("data", (c) => chunks.push(c));
    res.on("end", () => {
      const buf = Buffer.concat(chunks);
      let parsed = buf.toString("utf8");
      try { parsed = JSON.parse(parsed); } catch { /* binary or plain text */ }
      resolve({status: res.statusCode, body: parsed, raw: buf});
    });
  });
  req.on("error", reject);
  req.setTimeout(0);
  if (body) req.write(body);
  req.end();
});

const req = async (step, method, url, payload, {headers = {}} = {}) => {
  const started = Date.now();
  const h = url.startsWith("/api/maul/v1")
    ? {"x-maul-tenant-id": TENANT, "x-maul-creator-id": CREATOR, ...headers}
    : headers;
  const res = await httpJson(method, url, payload, h);
  stamp(step, {status: res.status, tookMs: Date.now() - started});
  if (res.status >= 400) fail(step, res.status, res.body);
  return res.body;
};
const download = async (step, url, destPath, headers = {}) => {
  const started = Date.now();
  const res = await httpJson("GET", url, null, headers);
  if (res.status >= 400) fail(step, res.status, typeof res.body === "string" ? res.body.slice(0, 500) : res.body);
  writeFileSync(destPath, res.raw);
  const sha256 = createHash("sha256").update(res.raw).digest("hex");
  stamp(step, {status: res.status, tookMs: Date.now() - started, bytes: res.raw.length, sha256});
  return {bytes: res.raw.length, sha256};
};

// ---- existing v5 state ------------------------------------------------------
const project = JSON.parse(readFileSync(join(runDir, "01-project.json"), "utf8"));
const timeline = JSON.parse(readFileSync(join(runDir, "02-timeline.json"), "utf8"));
const treatments = JSON.parse(readFileSync(join(runDir, "03-treatments.json"), "utf8"));
const candidatesBody = JSON.parse(readFileSync(join(runDir, "04-candidates.json"), "utf8"));
const candidate = candidatesBody.candidates[0];
const v1 = {"x-maul-tenant-id": TENANT, "x-maul-creator-id": CREATOR};
stamp("resume:loaded", {summary: `project ${project.id}, candidate ${candidate.artifactId}`});

// ---- music / sfx (same payload shape as v5) ---------------------------------
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
  sfx("sfx-riser-01", "hook_riser", 26500),
  sfx("sfx-cinematic-hit", "payoff_hit", 40300),
  sfx("sfx-whoosh-deep", "cta_whoosh", 61900)
];

const reviewPayload = (tid, rationale) => ({
  candidateArtifactId: candidate.artifactId,
  treatmentGenomeArtifactId: tid,
  reviewerId: "reviewer_human",
  decision: "approved",
  failureClasses: [],
  rationale,
  rubricScores: {
    editorial_clarity: 95, source_fidelity: 100, pacing_fit: 94,
    visual_hierarchy: 93, accessibility: 96
  }
});

const results = [];

// ---- A. founder_podcast: export already registered server-side in v5 --------
{
  const t = treatments.find(x => x.payload.treatmentId === "founder_podcast");
  const P = `backend/data/maul/projects/${project.id}/artifacts`;
  const {readdirSync} = await import("node:fs");
  const exportArtifact = readdirSync(join(here, "..", "..", P))
    .map(f => JSON.parse(readFileSync(join(here, "..", "..", P, f), "utf8")))
    .find(a => a.artifactType === "export_artifact"
      && a.payload.treatmentGenomeArtifactId === t.artifactId);
  if (!exportArtifact) fail("resume:founder-export-lookup", 500, {error: "export_artifact not found on disk"});
  writeFileSync(join(runDir, "05-export-founder_podcast.json"), JSON.stringify(exportArtifact, null, 2));
  const dl = await download("download:founder_podcast",
    `/api/maul/v1/projects/${project.id}/exports/${exportArtifact.artifactId}/file`,
    join(runDir, "export-founder_podcast.mp4"), v1);
  results.push({
    tid: "founder_podcast", export: exportArtifact, renderMs: 281_000 /* server-side, v5 */,
    replayKey: exportArtifact.payload.evidence?.deterministicReplayKey, resumed: true, ...dl
  });
}

// ---- B. render the remaining two treatments ---------------------------------
for (const tid of ["premium_direct_response", "minimal_expert"]) {
  const t = treatments.find(x => x.payload.treatmentId === tid);
  const review = (await req(`review:${tid}`, "POST", `/api/maul/projects/${project.id}/reviews`,
    reviewPayload(t.artifactId,
      `Torture-run approval for ${tid}: candidate preserves all factual claims (2.8%/5.1% figures, store analogy), rhetorical pauses intact, captions source-grounded.`))).review;
  const renderStarted = Date.now();
  const exported = (await req(`render:${tid}`, "POST", `/api/maul/projects/${project.id}/renders`, {
    candidateArtifactId: candidate.artifactId,
    treatmentGenomeArtifactId: t.artifactId,
    reviewDecisionArtifactId: review.artifactId,
    musicTrack, sfxAssets
  })).export;
  const renderMs = Date.now() - renderStarted;
  writeFileSync(join(runDir, `05-export-${tid}.json`), JSON.stringify(exported, null, 2));
  const dl = await download(`download:${tid}`,
    `/api/maul/v1/projects/${project.id}/exports/${exported.artifactId}/file`,
    join(runDir, `export-${tid}.mp4`), v1);
  results.push({tid, export: exported, renderMs, replayKey: exported.payload?.evidence?.deterministicReplayKey, ...dl});
}

// ---- C. negative control: unlicensed music must be rejected -----------------
{
  const t = treatments.find(x => x.payload.treatmentId === "founder_podcast");
  const review = (await req("review:neg-ctrl", "POST", `/api/maul/projects/${project.id}/reviews`,
    reviewPayload(t.artifactId, "Negative-control review."))).review;
  const res = await httpJson("POST", `/api/maul/projects/${project.id}/renders`, {
    candidateArtifactId: candidate.artifactId,
    treatmentGenomeArtifactId: t.artifactId,
    reviewDecisionArtifactId: review.artifactId,
    musicTrack: {...musicTrack, licenseVerified: false},
    sfxAssets
  });
  stamp("gate:unlicensed-music-rejected", {status: res.status, verdict: res.status >= 400 ? "PASS" : "FAIL"});
}

// ---- D. tenant isolation ------------------------------------------------------
{
  const winnerR = results.find(r => r.tid === "premium_direct_response") ?? results[0];
  const res = await httpJson("GET",
    `/api/maul/v1/projects/${winnerR.export.artifactId}/file`, null,
    {"x-maul-tenant-id": "tenant_other", "x-maul-creator-id": CREATOR});
  // note: correct path uses project id — do it properly:
  const res2 = await httpJson("GET",
    `/api/maul/v1/projects/${project.id}/exports/${winnerR.export.artifactId}/file`, null,
    {"x-maul-tenant-id": "tenant_other", "x-maul-creator-id": CREATOR});
  stamp("gate:tenant-isolation", {status: res2.status, verdict: res2.status === 403 ? "PASS" : "FAIL"});
}

// ---- E. deterministic replay: winner rendered twice ---------------------------
const winner = results.find(r => r.tid === "premium_direct_response") ?? results[0];
{
  const t = treatments.find(x => x.payload.treatmentId === winner.tid);
  const review2 = (await req("review:replay", "POST", `/api/maul/projects/${project.id}/reviews`,
    reviewPayload(t.artifactId, "Replay approval — identical payload for deterministic replay verification."))).review;
  const renderStarted = Date.now();
  const exported2 = (await req("render:replay", "POST", `/api/maul/projects/${project.id}/renders`, {
    candidateArtifactId: candidate.artifactId,
    treatmentGenomeArtifactId: t.artifactId,
    reviewDecisionArtifactId: review2.artifactId,
    musicTrack, sfxAssets
  })).export;
  const replayRenderMs = Date.now() - renderStarted;
  writeFileSync(join(runDir, "05-export-REPLAY.json"), JSON.stringify(exported2, null, 2));
  const dl2 = await download("download:replay",
    `/api/maul/v1/projects/${project.id}/exports/${exported2.artifactId}/file`,
    join(runDir, `export-${winner.tid}-REPLAY.mp4`), v1);
  const byteIdentical = dl2.sha256 === winner.sha256;
  const keyMatch = exported2.payload?.evidence?.deterministicReplayKey === winner.replayKey;
  stamp("gate:deterministic-replay", {
    verdict: byteIdentical ? "PASS" : keyMatch ? "PASS-key-only" : "FAIL",
    byteIdentical, replayKeyMatch: keyMatch, replayRenderMs,
    keyA: winner.replayKey, keyB: exported2.payload?.evidence?.deterministicReplayKey,
    note: "replayKey ties to reviewId in this codebase — same decisions, new review id => new key. byte-identity is the strict check."
  });
}

// ---- F. thumbnails on winner export ------------------------------------------
const thumbs = await req("thumbnails:generate", "POST", `/api/maul/projects/${project.id}/thumbnails`, {
  exportArtifactId: winner.export.artifactId,
  brandKit: {
    kind: "supplied", name: "Signal Hitch",
    primaryColor: "#101418", accentColor: "#e23b2e",
    fontFamily: "Berylium", logoAssetId: null
  },
  requestedCount: 3
});
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

// ---- wrap ---------------------------------------------------------------------
const summary = {
  projectId: project.id,
  resumedFrom: "v5 (founder_podcast export recovered from server-side completion)",
  outputDurationMs: timeline.payload.outputDurationMs,
  treatments: treatments.map(t => t.payload.treatmentId),
  results: results.map(({tid, renderMs, bytes, sha256, replayKey, resumed}) => ({tid, renderMs, bytes, sha256, replayKey, resumed: !!resumed})),
  winner: winner.tid,
  totalMs: Date.now() - t0
};
writeFileSync(join(runDir, "99-summary.json"), JSON.stringify(summary, null, 2));
console.log("\n== DONE ==\n" + JSON.stringify(summary, null, 2));
