import * as fs from "node:fs";
import * as path from "node:path";

const studioDir = __dirname;
const brainDir = "C:/Users/HomePC/.gemini/antigravity-cli/brain/1fe57e7b-d248-4e4b-be04-491b596ebc60";

const files = fs.readdirSync(brainDir);
const cleanAsset = files.find(f => f.startsWith("founders_oil_cyberpunk_clean"));

if (cleanAsset) {
  fs.copyFileSync(path.join(brainDir, cleanAsset), path.join(studioDir, "founders_oil_cyberpunk_clean.jpg"));
  console.log("COPIED_CLEAN_TEXTLESS_CYBERPUNK_OIL_ASSET_SUCCESSFULLY!");
} else {
  console.error("CLEAN_ASSET_NOT_FOUND!");
}
