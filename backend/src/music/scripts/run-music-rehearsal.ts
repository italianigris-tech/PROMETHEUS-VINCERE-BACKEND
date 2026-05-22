import {loadEnv} from "../../config";
import {FileJobRepository} from "../../repository";
import {runMusicRehearsal} from "../jobs/run-music-rehearsal";

const readArg = (flag: string): string | undefined => {
  const directMatch = process.argv.find((value) => value.startsWith(`${flag}=`));
  if (directMatch) {
    return directMatch.slice(flag.length + 1);
  }

  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
};

const readNumberArg = (flag: string): number | undefined => {
  const raw = readArg(flag);
  if (raw === undefined) {
    return undefined;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${flag} must be a finite number when provided.`);
  }

  return parsed;
};

const hasFlag = (flag: string): boolean => {
  return process.argv.includes(flag);
};

const main = async (): Promise<void> => {
  const jobId = readArg("--jobId");
  if (!jobId) {
    throw new Error("Missing required --jobId argument.");
  }

  const env = loadEnv();
  const repository = new FileJobRepository(env.STORAGE_DIR);
  await repository.initialize();

  const result = await runMusicRehearsal({
    repository,
    jobId,
    previewStartSec: readNumberArg("--previewStartSec"),
    previewEndSec: readNumberArg("--previewEndSec"),
    strict: hasFlag("--strict"),
    useCatalogCandidates: hasFlag("--useCatalogCandidates"),
    overwrite: hasFlag("--overwrite")
  });

  console.log(JSON.stringify(result, null, 2));
};

await main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
