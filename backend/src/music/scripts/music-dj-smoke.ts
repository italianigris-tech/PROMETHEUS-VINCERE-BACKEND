import {loadEnv} from "../../config";
import {FileJobRepository} from "../../repository";
import {
  readVideoAwareAudioPlanArtifact,
  runMusicRehearsal,
  validateMusicPreflight
} from "../index";

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

const main = async (): Promise<void> => {
  const jobId = readArg("--jobId");
  if (!jobId) {
    throw new Error("Missing required --jobId argument.");
  }

  const env = loadEnv();
  const repository = new FileJobRepository(env.STORAGE_DIR);
  await repository.initialize();

  const rehearsal = await runMusicRehearsal({
    repository,
    jobId,
    useCatalogCandidates: true,
    overwrite: true
  });
  const preflight = await validateMusicPreflight({
    repository,
    jobId,
    requireRenderReady: false
  });
  const plan = await readVideoAwareAudioPlanArtifact({
    repository,
    jobId
  });

  console.log(JSON.stringify({
    jobId,
    selectedTrackIds: [...new Set(plan.musicEvents.map((event) => event.trackId))],
    musicEventCount: plan.musicEvents.length,
    sfxEventCount: plan.sfxEvents.length,
    preflightStatus: preflight.status,
    renderAllowed: false,
    canRenderMusic: false,
    artifactPaths: {
      videoAwareAudioPlan: repository.artifactPath(jobId, "video_aware_audio_plan"),
      videoAwareSoundManifest: repository.artifactPath(jobId, "video_aware_sound_manifest"),
      videoAwareMusicPreflight: repository.artifactPath(jobId, "video_aware_music_preflight"),
      audioRenderPlanTouched: await repository.artifactExists(jobId, "audio_render_plan")
    },
    rehearsal
  }, null, 2));
};

await main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
