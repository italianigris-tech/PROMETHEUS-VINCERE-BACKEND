import {loadEnv} from "../../config";
import {createR2TransferService} from "../../integrations/r2";
import {FileJobRepository} from "../../repository";
import {renderMusicPreviewMix} from "../jobs/render-music-preview-mix";
import {createRemoteAudioCacheResolver} from "../renderer/remote-audio-cache";

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
  const r2Service = createR2TransferService(env);

  const result = await renderMusicPreviewMix({
    repository,
    jobId,
    overwrite: hasFlag("--overwrite"),
    remoteAudioResolver: createRemoteAudioCacheResolver({
      env,
      r2Service
    })
  });

  console.log(JSON.stringify(result, null, 2));
};

await main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
