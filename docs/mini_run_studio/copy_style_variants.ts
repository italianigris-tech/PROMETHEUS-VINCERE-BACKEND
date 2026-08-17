import * as fs from "node:fs";
import * as path from "node:path";

const studioDir = __dirname;
const brainDir = "C:/Users/HomePC/.gemini/antigravity-cli/brain/1fe57e7b-d248-4e4b-be04-491b596ebc60";

const files = fs.readdirSync(brainDir);
const s1 = files.find(f => f.startsWith("founders_graphic_noir_style1"));
const s2 = files.find(f => f.startsWith("founders_street_caricature_style2"));
const s3 = files.find(f => f.startsWith("founders_oil_cyberpunk_style3"));

if (s1) fs.copyFileSync(path.join(brainDir, s1), path.join(studioDir, "founders_graphic_noir_style1.jpg"));
if (s2) fs.copyFileSync(path.join(brainDir, s2), path.join(studioDir, "founders_street_caricature_style2.jpg"));
if (s3) fs.copyFileSync(path.join(brainDir, s3), path.join(studioDir, "founders_oil_cyberpunk_style3.jpg"));

console.log("COPIED_DYNAMIC_STYLE_ASSETS_SUCCESSFULLY!");
