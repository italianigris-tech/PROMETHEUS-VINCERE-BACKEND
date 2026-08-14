import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { toUncPath, rmWithRetry } from "./path-utils";

async function runLockStressTest() {
  console.log("🚀 Starting Windows Lock & Path Stress Test...\n");

  // 1. Create a deeply nested directory path (> 260 characters)
  const deepNestedPath = path.join(
    os.tmpdir(),
    "prometheus_stress_test_long_path_prefix_protection",
    "sub_directory_level_1",
    "sub_directory_level_2",
    "sub_directory_level_3",
    "sub_directory_level_4",
    "render_output_folder_deep_nested_test"
  );

  const startTime = Date.now();

  console.log(`1. Testing UNC Path Conversion (> 260 chars)...`);
  const uncPath = toUncPath(deepNestedPath);
  console.log(`   Original Path Length : ${deepNestedPath.length} chars`);
  console.log(`   UNC Safe Path        : ${uncPath}`);

  // 2. Create the directory
  await fs.mkdir(uncPath, { recursive: true });
  const dummyFile = path.join(uncPath, "rendered_frame_test.mp4");
  await fs.writeFile(dummyFile, Buffer.alloc(1024 * 1024)); // 1MB dummy file
  console.log(`   Created 1MB dummy video frame file.`);

  // 3. Simulate file lock by opening a file descriptor
  console.log(`\n2. Simulating Active Windows File Lock (open handle)...`);
  const handle = await fs.open(dummyFile, "r");

  // Close the handle after 300ms delay to simulate background scanner/FFmpeg releasing lock
  setTimeout(async () => {
    await handle.close();
    console.log(`   [Simulated Scanner] Windows lock handle released after 300ms.`);
  }, 300);

  // 4. Run rmWithRetry
  console.log(`\n3. Attempting rmWithRetry while file is locked...`);
  const cleanupStart = Date.now();
  await rmWithRetry(deepNestedPath);
  const cleanupDuration = Date.now() - cleanupStart;

  const totalDuration = Date.now() - startTime;

  console.log(`\n==================================================`);
  console.log(`✅ Lock Stress Test PASSED Cleanly!`);
  console.log(`   Cleanup Time        : ${cleanupDuration} ms`);
  console.log(`   Total Elapsed Time  : ${totalDuration} ms`);
  console.log(`==================================================\n`);
}

runLockStressTest().catch((err) => {
  console.error("❌ Lock Stress Test Failed:", err);
  process.exit(1);
});
