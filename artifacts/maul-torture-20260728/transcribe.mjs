// AssemblyAI word-level transcription for the MAUL torture clip.
// Runs under Windows node.exe. Writes transcript.json in this directory.
import {readFileSync, writeFileSync} from "node:fs";
import {join, dirname} from "node:path";
import {fileURLToPath} from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const envText = readFileSync(join(root, "remotion-app", ".env"), "utf8");
const apiKey = envText.match(/^ASSEMBLYAI_API_KEY=(.+)$/m)[1].trim();
const sourcePath = join(root, "rough TEST MYSELF.mp4");

const base = "https://api.assemblyai.com/v2";
const headers = {authorization: apiKey};

console.log("[1/3] uploading", sourcePath);
const audio = readFileSync(sourcePath);
const up = await fetch(`${base}/upload`, {method: "POST", headers, body: audio});
if (!up.ok) throw new Error(`upload failed ${up.status}: ${await up.text()}`);
const {upload_url} = await up.json();
console.log("uploaded:", upload_url.slice(0, 60));

console.log("[2/3] requesting transcript");
const req = await fetch(`${base}/transcript`, {
  method: "POST",
  headers: {...headers, "content-type": "application/json"},
  body: JSON.stringify({audio_url: upload_url, speech_models: ["universal-2"]})
});
if (!req.ok) throw new Error(`transcript request failed ${req.status}: ${await req.text()}`);
const {id} = await req.json();
console.log("transcript id:", id);

console.log("[3/3] polling");
let result;
for (;;) {
  await new Promise(r => setTimeout(r, 3000));
  const poll = await fetch(`${base}/transcript/${id}`, {headers});
  result = await poll.json();
  if (result.status === "completed") break;
  if (result.status === "error") throw new Error(`transcription error: ${result.error}`);
  process.stdout.write(`\rstatus=${result.status}   `);
}
console.log("\ncompleted. words:", result.words.length, "confidence(avg):", result.confidence);

const words = result.words.map(w => ({
  text: w.text,
  startMs: w.start,
  endMs: w.end,
  confidence: w.confidence
}));
const lowConf = words.filter(w => w.confidence < 0.6);
writeFileSync(join(here, "transcript.json"), JSON.stringify({
  provider: "assemblyai",
  transcriptId: id,
  language: result.language_code,
  text: result.text,
  words,
  lowConfidenceWords: lowConf
}, null, 2));
console.log("low-confidence words (<0.6):", lowConf.map(w => `${w.text}@${w.startMs}(${w.confidence})`).join(", ") || "none");
console.log("wrote transcript.json");
