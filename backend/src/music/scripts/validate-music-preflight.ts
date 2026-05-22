import {loadEnv} from "../../config";
import {FileJobRepository} from "../../repository";
import {validateMusicPreflight} from "../jobs/validate-music-preflight";

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

  const report = await validateMusicPreflight({
    repository,
    jobId,
    strict: hasFlag("--strict"),
    requireRenderReady: hasFlag("--requireRenderReady"),
    allowPlaceholders: !hasFlag("--disallowPlaceholders"),
    checkFileExists: hasFlag("--checkFileExists"),
    assetRoot: readArg("--assetRoot")
  });

  console.log(JSON.stringify(report, null, 2));
};

await main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
