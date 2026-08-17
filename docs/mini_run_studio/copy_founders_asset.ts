import * as fs from "node:fs";
import * as path from "node:path";

const studioDir = __dirname;
const brainDir = "C:/Users/HomePC/.gemini/antigravity-cli/brain/1fe57e7b-d248-4e4b-be04-491b596ebc60";

const files = fs.readdirSync(brainDir);
const foundersAsset = files.find(f => f.startsWith("tech_founders_vintage_trio"));

if (foundersAsset) {
  fs.copyFileSync(path.join(brainDir, foundersAsset), path.join(studioDir, "tech_founders_vintage_trio.jpg"));
  console.log("COPIED_TECH_FOUNDERS_TRIO_ASSET_SUCCESSFULLY!");
} else {
  console.error("FOUNDERS_ASSET_NOT_FOUND!");
}
