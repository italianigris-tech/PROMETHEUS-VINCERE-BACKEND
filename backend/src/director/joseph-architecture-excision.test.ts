import {describe, expect, it} from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const repoRoot = path.resolve(__dirname, "../../..");
const legacyCreativeOrchestrationRoot = path.join(repoRoot, "remotion-app", "src", "creative-orchestration");
const forbiddenLegacyImport = /creative-orchestration|CoreJudgmentEngine|SteppingStonePlanner|ExistingAgentOrchestratorAdapter|NegativeGrammarEngine|QualityDiversityArchive/;

const readUtf8 = (filePath: string): string => fs.readFileSync(filePath, "utf8");

const collectFiles = (root: string, predicate: (filePath: string) => boolean): string[] => {
  if (!fs.existsSync(root)) {
    return [];
  }

  return fs.readdirSync(root, {withFileTypes: true}).flatMap((entry) => {
    const filePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      return collectFiles(filePath, predicate);
    }

    return predicate(filePath) ? [filePath] : [];
  });
};

const relative = (filePath: string): string => path.relative(repoRoot, filePath).replace(/\\/g, "/");

describe("Joseph architecture excision", () => {
  it("keeps the live Joseph render spine free of the archived creative-orchestration apparatus", () => {
    const liveRoots = [
      path.join(repoRoot, "backend", "src", "director"),
      path.join(repoRoot, "apps", "worker", "src"),
      path.join(repoRoot, "scripts"),
    ];
    const liveFiles = [
      ...liveRoots.flatMap((root) => collectFiles(root, (filePath) => /\.(ts|tsx)$/.test(filePath) && !filePath.endsWith(".test.ts"))),
      path.join(repoRoot, "remotion-app", "src", "entries", "joseph-entry.tsx"),
      path.join(repoRoot, "remotion-app", "src", "compositions", "JosephEdit.tsx"),
      path.join(repoRoot, "remotion-app", "src", "compositions", "VideoPlane.tsx"),
      path.join(repoRoot, "remotion-app", "src", "compositions", "joseph-render-contract.ts"),
      path.join(repoRoot, "remotion-app", "src", "compositions", "joseph-default-manifest.ts"),
    ].filter((filePath) => fs.existsSync(filePath));

    const offenders = liveFiles
      .map((filePath) => ({filePath, contents: readUtf8(filePath)}))
      .filter(({contents}) => forbiddenLegacyImport.test(contents))
      .map(({filePath}) => relative(filePath));

    expect(offenders).toEqual([]);
  });

  it("keeps ported Stack A algorithms covered in the live backend and renderer path", () => {
    const requiredProofs = [
      "backend/src/director/joseph-sequence-discipline.contract.test.ts",
      "backend/src/director/judgment-layer-sequence-objective.test.ts",
      "backend/src/director/joseph-sequence-objective.test.ts",
      "backend/src/director/orchestrator-sequence-objective-summary.test.ts",
      "backend/src/director/orchestrator-candidate-score-summary.test.ts",
      "backend/src/director/orchestrator-manifest-compiler.test.ts",
      "backend/src/director/joseph-manifest-compiler.test.ts",
      "remotion-app/src/compositions/__tests__/joseph-render-contract.test.ts",
    ];

    expect(requiredProofs.filter((filePath) => !fs.existsSync(path.join(repoRoot, filePath)))).toEqual([]);
  });

  it("reserves Planner Audit for the archived rich trace and Candidate Score Summary for backend scoring", () => {
    const backendDirectorSources = collectFiles(
      path.join(repoRoot, "backend", "src", "director"),
      (filePath) => /\.(ts|tsx)$/.test(filePath) && !filePath.endsWith(".test.ts"),
    );
    const plannerAuditOffenders = backendDirectorSources
      .filter((filePath) => /PlannerAudit/.test(readUtf8(filePath)))
      .map(relative);

    const orchestratorSource = readUtf8(path.join(repoRoot, "backend", "src", "director", "orchestrator.ts"));

    expect(plannerAuditOffenders).toEqual([]);
    expect(orchestratorSource).toContain("export interface CandidateScoreSummary");
    expect(orchestratorSource).toContain("candidateScoreSummary: CandidateScoreSummary");
  });

  it("archives the surviving browser-preview orchestration stack with explicit non-Joseph ownership", () => {
    const legacyReadmePath = path.join(legacyCreativeOrchestrationRoot, "LEGACY.md");
    const legacyReadme = readUtf8(legacyReadmePath);

    expect(legacyReadme).toContain("legacy browser-preview");
    expect(legacyReadme).toContain("not the Joseph production spine");
    expect(legacyReadme).toContain("backend/src/director");
    expect(legacyReadme).toContain("Candidate Score Summary");
    expect(legacyReadme).toContain("Planner Audit");
  });
});
