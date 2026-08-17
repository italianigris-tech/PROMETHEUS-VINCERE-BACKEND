import * as fs from "node:fs";
import * as path from "node:path";

const srcDir = "C:/Users/HomePC/.gemini/antigravity-cli/brain/1fe57e7b-d248-4e4b-be04-491b596ebc60";
const destDir = "C:/Users/HomePC/Downloads/HELP, VIDEO MATTING/docs/mini_run_studio";

const files = fs.readdirSync(srcDir);
const eiffel = files.find(f => f.startsWith("eiffel_tower_cutout"));
const gears = files.find(f => f.startsWith("industrial_gears_cutout"));
const team = files.find(f => f.startsWith("corporate_team_cutout"));

if (eiffel) fs.copyFileSync(path.join(srcDir, eiffel), path.join(destDir, "eiffel_tower_cutout.jpg"));
if (gears) fs.copyFileSync(path.join(srcDir, gears), path.join(destDir, "industrial_gears_cutout.jpg"));
if (team) fs.copyFileSync(path.join(srcDir, team), path.join(destDir, "corporate_team_cutout.jpg"));

console.log("SYNC_COPIED_ASSETS_SUCCESSFULLY!");
