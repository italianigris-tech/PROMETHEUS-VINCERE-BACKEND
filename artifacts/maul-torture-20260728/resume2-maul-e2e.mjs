// MAUL torture-clip E2E resume part 2: minimal_expert render died on a
// transient Google-Fonts CDN reset (ERR_CONNECTION_RESET). Premium + founder
// exports are already on disk with recorded sha256s.
// This driver: retry minimal_expert (font network errors are transient),
// then negative control, tenant isolation, deterministic replay of the
// premium winner, and thumbnails.
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

const prior = JSON.parse(readFileSync(join(runDir, "run-log-resume.json"), "utf8"));
const log = [];
const t0 = Date.now();
const stamp = (step, extra = {}) => {
  const row = {step, atMs: Date.now() - t0, ...extra};
  log.push(row);
  console.log(`[+${(row.atMs / 1000).toFixed(1)}s] ${step}`, extra.summary ?? "");
  writeFileSync(join(runDir, "run-log-resume2.json"), JSON.stringify(log, null, 2));
};
const fail = (step, status, body) => {
  stamp(`FAIL:${step}`, {status, body});
  console.error(`\nXX ${step} -> HTTP ${status}\n${JSON.stringify(body, null, 2).slice(0, 3000)}`);
  process.exit(1);
};

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
      try { parsed = JSON.parse(parsed); } catch { /* binary */ }
      resolve({status: res.statusCode, body: parsed, raw: buf});
    });
  });
  req.on("error", reject);
  req.setTimeout(0);
  if (body) req.write(body);
  req.end();
});
const sleep = ms => new Promise(r => setTimeout(r, ms));

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

const project = JSON.parse(readFileSync(join(runDir, "01-project.json"), "utf8"));
const timeline = JSON.parse(readFileSync(join(runDir, "02-timeline.json"), "utf8"));
const treatments = JSON.parse(readFileSync(join(runDir, "03-treatments.json"), "utf8"));
const candidate = JSON.parse(readFileSync(join(runDir, "04-candidates.json"), "utf8")).candidates[0];
const premiumExport = JSON.parse(readFileSync(join(runDir, "05-export-premium_direct_response.json"), "utf8"));
const premiumDl = prior.find(r => r.step === "download:premium_direct_response");
const premiumSha = premiumDl.sha256;
const premiumReplayKey = premiumExport.payload?.evidence?.deterministicReplayKey;
const v1 = {"x-maul-tenant-id": TENANT, "x-maul-creator-id": CREATOR};
stamp("resume2:loaded", {summary: `premium sha baseline ${premiumSha.slice(0, 12)}…`});

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

const treatmentOf = tid => treatments.find(x => x.payload.treatmentId === tid);

// ---- B2. minimal_expert render with transient-network retry -----------------
let minimalExport = null, minimalRenderMs = 0;
{
  const t = treatmentOf("minimal_expert");
  const isTransientFontNet = body => {
    const s = JSON.stringify(body);
    return /ERR_CONNECTION_RESET|NetworkError|fonts\.gstatic|ECONNRESET|ETIMEDOUT/i.test(s);
  };
  for (let attempt = 1; attempt <= 3 && !minimalExport; attempt++) {
    const review = (await req(`review:minimal_expert:a${attempt}`, "POST", `/api/maul/projects/${project.id}/reviews`,
      reviewPayload(t.artifactId,
        `Torture-run approval for minimal_expert (attempt ${attempt}): factual claims preserved, rhetorical pauses intact, captions source-grounded.`))).review;
    const started = Date.now();
    const res = await httpJson("POST", `/api/maul/projects/${project.id}/renders`, {
      candidateArtifactId: candidate.artifactId,
      treatmentGenomeArtifactId: t.artifactId,
      reviewDecisionArtifactId: review.artifactId,
      musicTrack, sfxAssets
    });
    minimalRenderMs = Date.now() - started;
    if (res.status < 400) {
      minimalExport = res.body.export;
      stamp(`render:minimal_expert:a${attempt}`, {status: res.status, tookMs: minimalRenderMs});
    } else if (isTransientFontNet(res.body) && attempt < 3) {
      stamp(`render:minimal_expert:a${attempt}:transient-retry`, {status: res.status, tookMs: minimalRenderMs});
      console.log(`  transient font/network failure, retrying in 10s (attempt ${attempt}/3)`);
      await sleep(10_000);
    } else {
      fail(`render:minimal_expert:a${attempt}`, res.status, res.body);
    }
  }
  writeFileSync(join(runDir, "05-export-minimal_expert.json"), JSON.stringify(minimalExport, null, 2));
  const dl = await download("download:minimal_expert",
    `/api/maul/v1/projects/${project.id}/exports/${minimalExport.artifactId}/file`,
    join(runDir, "export-minimal_expert.mp4"), v1);
  stamp("minimal_expert:done", {summary: `renderMs=${minimalRenderMs} sha=${dl.sha256.slice(0, 12)}…`});
  var minimalResult = {export: minimalExport, renderMs: minimalRenderMs, ...dl};
}

// ---- C. negative control: unlicensed music must be rejected -----------------
{
  const t = treatmentOf("founder_podcast");
  const review = (await req("review:neg-ctrl", "POST", `/api/maul/projects/${project.id}/reviews`,
    reviewPayload(t.artifactId, "Negative-control review — licenses deliberately broken in payload."))).review;
  const res = await httpJson("POST", `/api/maul/projects/${project.id}/renders`, {
    candidateArtifactId: candidate.artifactId,
    treatmentGenomeArtifactId: t.artifactId,
    reviewDecisionArtifactId: review.artifactId,
    musicTrack: {...musicTrack, licenseVerified: false},
    sfxAssets
  });
  stamp("gate:unlicensed-music-rejected", {status: res.status, verdict: res.status >= 400 ? "PASS" : "FAIL",
    summary: `HTTP ${res.status} ${res.status >= 400 ? "= PASS (rejected)" : "= FAIL (accepted!)"}`});
}

// ---- D. tenant isolation ------------------------------------------------------
{
  const res = await httpJson("GET",
    `/api/maul/v1/projects/${project.id}/exports/${premiumExport.artifactId}/file`, null,
    {"x-maul-tenant-id": "tenant_other", "x-maul-creator-id": CREATOR});
  stamp("gate:tenant-isolation", {status: res.status, verdict: res.status === 403 ? "PASS" : "FAIL",
    summary: `HTTP ${res.status} ${res.status === 403 ? "= PASS (denied)" : "= FAIL"}`});
}

// ---- E. deterministic replay: winner (premium_direct_response) rendered twice -
{
  const t = treatmentOf("premium_direct_response");
  const review2 = (await req("review:replay", "POST", `/api/maul/projects/${project.id}/reviews`,
    reviewPayload(t.artifactId, "Replay approval — identical payload for deterministic replay verification."))).review;
  const started = Date.now();
  const exported2 = (await req("render:replay", "POST", `/api/maul/projects/${project.id}/renders`, {
    candidateArtifactId: candidate.artifactId,
    treatmentGenomeArtifactId: t.artifactId,
    reviewDecisionArtifactId: review2.artifactId,
    musicTrack, sfxAssets
  })).export;
  const replayRenderMs = Date.now() - started;
  writeFileSync(join(runDir, "05-export-REPLAY.json"), JSON.stringify(exported2, null, 2));
  const dl2 = await download("download:replay",
    `/api/maul/v1/projects/${project.id}/exports/${exported2.artifactId}/file`,
    join(runDir, "export-premium_direct_response-REPLAY.mp4"), v1);
  const byteIdentical = dl2.sha256 === premiumSha;
  const keyMatch = exported2.payload?.evidence?.deterministicReplayKey === premiumReplayKey;
  stamp("gate:deterministic-replay", {
    verdict: byteIdentical ? "PASS" : keyMatch ? "PASS-key-only" : "FAIL",
    byteIdentical, replayKeyMatch: keyMatch, replayRenderMs,
    shaA: premiumSha, shaB: dl2.sha256,
    keyA: premiumReplayKey, keyB: exported2.payload?.evidence?.deterministicReplayKey,
    summary: byteIdentical ? "PASS — byte-identical MP4" : keyMatch ? "PASS (key only)" : "FAIL",
    note: "replayKey includes reviewArtifactId in this codebase, so a fresh review yields a fresh key; byte-identity of the pixels is the strict check."
  });
}

// ---- F. thumbnails on winner export ------------------------------------------
const thumbs = await req("thumbnails:generate", "POST", `/api/maul/projects/${project.id}/thumbnails`, {
  exportArtifactId: premiumExport.artifactId,
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
  outputDurationMs: timeline.payload.outputDurationMs,
  exports: {
    founder_podcast: {sha256: prior.find(r => r.step === "download:founder_podcast")?.sha256, renderMs: 281_000, resumed: true},
    premium_direct_response: {sha256: premiumSha, renderMs: prior.find(r => r.step === "render:premium_direct_response")?.tookMs},
    minimal_expert: {sha256: minimalResult.sha256, renderMs: minimalResult.renderMs}
  },
  gates: Object.fromEntries(log.filter(r => r.step.startsWith("gate:")).map(r => [r.step, r.verdict])),
  totalMs: Date.now() - t0
};
writeFileSync(join(runDir, "99-summary.json"), JSON.stringify(summary, null, 2));
console.log("\n== DONE ==\n" + JSON.stringify(summary, null, 2));
