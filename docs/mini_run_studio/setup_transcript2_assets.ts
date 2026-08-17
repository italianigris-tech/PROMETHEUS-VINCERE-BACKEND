import * as fs from "node:fs";
import * as path from "node:path";

const studioDir = __dirname;
const brainDir = "C:/Users/HomePC/.gemini/antigravity-cli/brain/1fe57e7b-d248-4e4b-be04-491b596ebc60";

const files = fs.readdirSync(brainDir);

// 1. Atomic Flywheel
const flywheel = files.find(f => f.startsWith("consistency_atomic_flywheel_clean"));
if (flywheel) {
  fs.copyFileSync(path.join(brainDir, flywheel), path.join(studioDir, "consistency_atomic_flywheel_clean.jpg"));
  console.log("COPIED_FLYWHEEL:", flywheel);
}

// 2. Industrial Mechanical Gears Machine
const gears = path.join(studioDir, "industrial_gears_black.jpg");
console.log("GEARS_EXISTS:", fs.existsSync(gears));

// 3. Cyberpunk Oil Founder Trio
const founders = path.join(studioDir, "founders_oil_cyberpunk_clean.jpg");
console.log("FOUNDERS_EXISTS:", fs.existsSync(founders));
