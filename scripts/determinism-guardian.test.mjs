import assert from "node:assert/strict";
import {mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import test from "node:test";

import {runDeterminismGuardianAudit} from "./determinism-guardian.mjs";

test("determinism guardian fails on forbidden render-path APIs and writes an artifact", async () => {
  const root = await mkdtemp(join(tmpdir(), "determinism-guardian-bad-"));
  try {
    const renderDir = join(root, "render");
    const variationDir = join(root, "variation");
    await writeFile(join(root, "placeholder"), "");
    await writeFile(join(renderDir, "BadRender.tsx"), "// Math.random() in this comment should not create a violation.\nexport const x = Math.random() + Date.now();\n", {flag: "wx"}).catch(async (error) => {
      if (error.code !== "ENOENT") throw error;
      await import("node:fs/promises").then(({mkdir}) => mkdir(renderDir, {recursive: true}));
      await writeFile(join(renderDir, "BadRender.tsx"), "// Math.random() in this comment should not create a violation.\nexport const x = Math.random() + Date.now();\n");
    });
    await import("node:fs/promises").then(({mkdir}) => mkdir(variationDir, {recursive: true}));
    await writeFile(join(variationDir, "SeededChoice.ts"), "import {seededRandom} from '@prometheus/shared-types';\nconst rng = seededRandom(1);\nexport const pick = rng();\n");

    const reportPath = join(root, "artifact", "determinism-guardian-report.json");
    const report = await runDeterminismGuardianAudit({
      repoRoot: root,
      renderPaths: [renderDir],
      variationPaths: [variationDir],
      reportPath,
    });

    assert.equal(report.pass, false);
    assert.deepEqual(report.violations.map((violation) => violation.ruleId).sort(), [
      "no-date-now",
      "no-math-random",
    ]);
    const artifact = JSON.parse(await readFile(reportPath, "utf8"));
    assert.equal(artifact.pass, false);
    assert.equal(artifact.scannedFiles.length, 2);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("determinism guardian passes when render-visible variation uses seeded PRNG", async () => {
  const root = await mkdtemp(join(tmpdir(), "determinism-guardian-good-"));
  try {
    const renderDir = join(root, "render");
    const variationDir = join(root, "variation");
    await import("node:fs/promises").then(({mkdir}) => Promise.all([
      mkdir(renderDir, {recursive: true}),
      mkdir(variationDir, {recursive: true}),
    ]));
    await writeFile(join(renderDir, "GoodRender.tsx"), "export const x = 1;\n");
    await writeFile(join(variationDir, "SeededChoice.ts"), "import {seededPick, seededRandom} from '@prometheus/shared-types';\nconst rng = seededRandom(42);\nexport const choice = seededPick(rng, ['a', 'b']);\n");

    const report = await runDeterminismGuardianAudit({
      repoRoot: root,
      renderPaths: [renderDir],
      variationPaths: [variationDir],
      reportPath: join(root, "artifact", "determinism-guardian-report.json"),
    });

    assert.equal(report.pass, true);
    assert.equal(report.seededVariation.ok, true);
    assert.equal(report.seededVariation.seededUsageCount, 2);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
