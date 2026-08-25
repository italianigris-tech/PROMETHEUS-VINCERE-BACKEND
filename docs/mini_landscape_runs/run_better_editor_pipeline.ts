import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { runLandscapeTreatmentPipeline } from "./landscape_treatment_pipeline.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const videoPath = path.join(repoRoot, "LANDSCAPE VIDEOS FOR USE/Unedited Videos Made Me a Better Editor_ Here's How....mp4");
const outDir = path.join(__dirname, "out");

console.log("===============================================================================");
console.log("EXECUTING MINI LANDSCAPE RUN ON: 'Unedited Videos Made Me a Better Editor'");
console.log("===============================================================================\\n");

console.log(`📹 Video Input: ${videoPath}`);
console.log(`📁 Output Dir:   ${outDir}`);

// 1. Run Complete Treatment Pipeline
const manifest = runLandscapeTreatmentPipeline({
  mediaPath: videoPath,
  render: false,
  outDir,
});

const manifestPath = path.join(outDir, "landscape_treatment_manifest.json");
const runJsonPath = path.join(outDir, "landscape_run_better_editor.json");

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
fs.writeFileSync(runJsonPath, JSON.stringify(manifest, null, 2), "utf8");

console.log(`\\n✅ Generated Manifest (${manifest.sections.length} sections, ${manifest.silenceCut.outputDurationSec.toFixed(1)}s runtime)`);
console.log(`🎬 Edit Moves:            ${manifest.editMoves.length}`);
console.log(`🔍 Zoom Cues:             ${manifest.zoomCues?.length ?? 0}`);
console.log(`🖼️ Background Coverages:  ${manifest.backgroundCoverages?.length ?? 0}`);
console.log(`🎨 Photo Treatments:      ${manifest.photoTreatments?.length ?? 0} assets processed`);
console.log(`🎵 Soundtrack Selections: ${manifest.soundtrack.selections.length}`);
console.log(`🔊 SFX Cues:              ${manifest.sfxCues.length}`);

// 2. Build Interactive HTML Presentation via Stage 8 builder CLI
const htmlOutPath = path.join(outDir, "landscape_presentation_better_editor.html");
const builderScript = path.join(__dirname, "build_landscape_presentation.ts");

execSync(`npx tsx "${builderScript}" --manifest "${manifestPath}" --out "${htmlOutPath}" --run-id "better_editor"`, {
  stdio: "inherit",
  cwd: repoRoot,
});

console.log(`\\n🎉 Built Standalone Studio Presentation: ${htmlOutPath}`);
console.log(`🌐 Live URL: http://localhost:8080/landscape_p/better_editor or file://${htmlOutPath}`);
