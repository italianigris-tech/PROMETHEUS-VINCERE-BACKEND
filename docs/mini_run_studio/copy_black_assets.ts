import * as fs from "node:fs";
import * as path from "node:path";

const studioDir = __dirname;
const brainDir = "C:/Users/HomePC/.gemini/antigravity-cli/brain/1fe57e7b-d248-4e4b-be04-491b596ebc60";

const files = fs.readdirSync(brainDir);
const eiffelBlack = files.find(f => f.startsWith("eiffel_tower_black_bg"));
const gearsBlack = files.find(f => f.startsWith("industrial_gears_black_bg"));
const teamBlack = files.find(f => f.startsWith("corporate_team_black_bg"));

if (eiffelBlack) fs.copyFileSync(path.join(brainDir, eiffelBlack), path.join(studioDir, "eiffel_tower_black.jpg"));
if (gearsBlack) fs.copyFileSync(path.join(brainDir, gearsBlack), path.join(studioDir, "industrial_gears_black.jpg"));
if (teamBlack) fs.copyFileSync(path.join(brainDir, teamBlack), path.join(studioDir, "corporate_team_black.jpg"));

console.log("COPIED_BLACK_BG_ASSETS_SUCCESSFULLY!");
