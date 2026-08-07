import * as fs from "node:fs/promises";
import * as path from "node:path";
import {fileURLToPath} from "node:url";

import {
  recordReviewedCompositionEvidence,
  type ReviewedCompositionEvidence,
} from "../backend/src/maul/composition-review.js";

type ReviewFileInput = {
  publicPath: string;
  privatePath: string;
  responsePath: string;
  outputPath: string;
};

const readJson = async (filePath: string): Promise<unknown> =>
  JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;

const writeJsonAtomic = async (filePath: string, value: unknown): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), {recursive: true});
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {encoding: "utf8", flag: "wx"});
  try {
    await fs.rename(temporaryPath, filePath);
  } catch (error) {
    await fs.rm(temporaryPath, {force: true});
    throw error;
  }
};

export async function recordCompositionReviewFromFiles({
  publicPath,
  privatePath,
  responsePath,
  outputPath,
}: ReviewFileInput): Promise<ReviewedCompositionEvidence> {
  const [publicPackage, privateAssignment, response] = await Promise.all([
    readJson(publicPath),
    readJson(privatePath),
    readJson(responsePath),
  ]);
  const evidence = recordReviewedCompositionEvidence({
    publicPackage,
    privateAssignment,
    response,
  });
  await writeJsonAtomic(outputPath, evidence);
  return evidence;
}

const argumentValue = (args: string[], name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const run = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const command = args[0] === "record" ? args.shift() : "record";
  if (command !== "record") throw new Error(`Unsupported command: ${command}`);
  const publicPath = argumentValue(args, "--public");
  const privatePath = argumentValue(args, "--private");
  const responsePath = argumentValue(args, "--response");
  const outputPath = argumentValue(args, "--output");
  if (!publicPath || !privatePath || !responsePath || !outputPath) {
    throw new Error(
      "Usage: npx tsx scripts/maul-composition-review.ts record " +
      "--public <review-package.json> --private <private-assignment.json> " +
      "--response <response.json> --output <reviewed-evidence.json>",
    );
  }
  const evidence = await recordCompositionReviewFromFiles({
    publicPath: path.resolve(publicPath),
    privatePath: path.resolve(privatePath),
    responsePath: path.resolve(responsePath),
    outputPath: path.resolve(outputPath),
  });
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
};

const isDirectRun = Boolean(process.argv[1]) && path.resolve(process.argv[1]!) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  run().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
