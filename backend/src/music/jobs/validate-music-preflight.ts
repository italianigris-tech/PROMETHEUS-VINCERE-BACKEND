import path from "node:path";

import type {FileJobRepository} from "../../repository";
import {soundDesignManifestSchema} from "../../sound-engine/types";
import {readVideoAwareAudioPlanArtifact} from "../persistence/audio-plan-artifact";
import {readVideoAwareSoundManifestArtifact} from "../persistence/sound-manifest-artifact";
import {writeVideoAwareMusicPreflightArtifact} from "../persistence/music-preflight-artifact";
import {
  musicPreflightReportSchema,
  type MusicPreflightIssue,
  type MusicPreflightReport
} from "../schemas/music-preflight.schema";

export class MusicPreflightJobMissingError extends Error {
  public constructor(jobId: string) {
    super(`Job artifact is missing for job ${jobId}.`);
    this.name = "MusicPreflightJobMissingError";
  }
}

export class MusicPreflightAudioPlanMissingError extends Error {
  public constructor(jobId: string) {
    super(`video_aware_audio_plan is missing for job ${jobId}.`);
    this.name = "MusicPreflightAudioPlanMissingError";
  }
}

export class MusicPreflightSoundManifestMissingError extends Error {
  public constructor(jobId: string) {
    super(`video_aware_sound_manifest is missing for job ${jobId}.`);
    this.name = "MusicPreflightSoundManifestMissingError";
  }
}

export class MusicPreflightArtifactInvalidError extends Error {
  public constructor(jobId: string, artifactKey: string, reason: string) {
    super(`${artifactKey} is invalid for job ${jobId}: ${reason}`);
    this.name = "MusicPreflightArtifactInvalidError";
  }
}

export type ValidateMusicPreflightInput = {
  repository: FileJobRepository;
  jobId: string;
  strict?: boolean;
  requireRenderReady?: boolean;
  allowPlaceholders?: boolean;
  checkFileExists?: boolean;
  assetRoot?: string;
  now?: () => string;
};

const nowIso = (now?: () => string): string => {
  return now?.() ?? new Date().toISOString();
};

const isPlaceholderPath = (value: string): boolean => {
  return value.startsWith("__music_track_placeholder__/") || value.startsWith("__sfx_placeholder__/");
};

const isRemoteStorageReference = (value: string): boolean => {
  return /^r2:\/\//i.test(value) || /^https?:\/\//i.test(value) || value.startsWith("music-originals/");
};

const resolveAssetPath = ({
  filePath,
  assetRoot,
  repositoryRoot
}: {
  filePath: string;
  assetRoot?: string;
  repositoryRoot: string;
}): string => {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  return path.resolve(assetRoot ?? repositoryRoot, filePath);
};

const countIssues = (issues: MusicPreflightIssue[], predicate: (issue: MusicPreflightIssue) => boolean): number => {
  return issues.filter(predicate).length;
};

const addIssue = (
  issues: MusicPreflightIssue[],
  issue: Omit<MusicPreflightIssue, "id">
): void => {
  issues.push({
    id: `issue_${issues.length + 1}`,
    ...issue
  });
};

const hasBlockingConditions = ({
  planMode,
  requireRenderReady,
  allowPlaceholders
}: {
  planMode: "dry_run" | "render_ready";
  requireRenderReady?: boolean;
  allowPlaceholders: boolean;
}) => {
  return planMode === "render_ready" || requireRenderReady || !allowPlaceholders;
};

export const validateMusicPreflight = async (
  input: ValidateMusicPreflightInput
): Promise<MusicPreflightReport> => {
  const jobId = input.jobId.trim();
  if (!(await input.repository.artifactExists(jobId, "job"))) {
    throw new MusicPreflightJobMissingError(jobId);
  }
  if (!(await input.repository.artifactExists(jobId, "video_aware_audio_plan"))) {
    throw new MusicPreflightAudioPlanMissingError(jobId);
  }
  if (!(await input.repository.artifactExists(jobId, "video_aware_sound_manifest"))) {
    throw new MusicPreflightSoundManifestMissingError(jobId);
  }

  let plan;
  let soundManifestArtifact;
  try {
    plan = await readVideoAwareAudioPlanArtifact({
      repository: input.repository,
      jobId
    });
  } catch (error) {
    throw new MusicPreflightArtifactInvalidError(
      jobId,
      "video_aware_audio_plan",
      error instanceof Error ? error.message : String(error)
    );
  }
  try {
    soundManifestArtifact = await readVideoAwareSoundManifestArtifact({
      repository: input.repository,
      jobId
    });
  } catch (error) {
    throw new MusicPreflightArtifactInvalidError(
      jobId,
      "video_aware_sound_manifest",
      error instanceof Error ? error.message : String(error)
    );
  }

  const issues: MusicPreflightIssue[] = [];
  const allowPlaceholders = input.allowPlaceholders ?? true;
  const blockingPlaceholderPolicy = hasBlockingConditions({
    planMode: plan.planMode,
    requireRenderReady: input.requireRenderReady,
    allowPlaceholders
  });
  const soundManifestPath = input.repository.artifactPath(jobId, "video_aware_sound_manifest");

  if (soundManifestArtifact.sourcePlanId !== plan.id) {
    addIssue(issues, {
      severity: "error",
      code: "manifest.source_plan_mismatch",
      message: `video_aware_sound_manifest was built from ${soundManifestArtifact.sourcePlanId}, but the current audio plan is ${plan.id}.`,
      suggestion: "Rebuild the rehearsal manifest after updating the VideoAwareAudioPlan."
    });
  }
  if (soundManifestArtifact.planMode !== plan.planMode) {
    addIssue(issues, {
      severity: "error",
      code: "manifest.plan_mode_mismatch",
      message: `video_aware_sound_manifest is ${soundManifestArtifact.planMode}, but the current audio plan is ${plan.planMode}.`,
      suggestion: "Rebuild the rehearsal manifest so planMode stays aligned across artifacts."
    });
  }

  if (input.requireRenderReady && plan.planMode !== "render_ready") {
    addIssue(issues, {
      severity: "error",
      code: "plan.mode.not_render_ready",
      message: `Plan ${plan.id} is ${plan.planMode} and cannot be treated as render-ready.`,
      suggestion: "Promote the audio plan to render_ready only after replacing placeholders and verifying licenses."
    });
  } else if (plan.planMode === "dry_run") {
    addIssue(issues, {
      severity: "warning",
      code: "plan.mode.dry_run",
      message: `Plan ${plan.id} is still marked dry_run.`,
      suggestion: "Use this report for rehearsal only, then promote the plan to render_ready after resolving asset gaps."
    });
  }

  const manifestValidation = soundDesignManifestSchema.safeParse(soundManifestArtifact.manifest);
  if (!manifestValidation.success) {
    addIssue(issues, {
      severity: "error",
      code: "manifest.invalid",
      message: "video_aware_sound_manifest is not structurally valid for future sound-engine rendering.",
      path: "manifest",
      suggestion: "Rebuild the rehearsal manifest from a valid VideoAwareAudioPlan."
    });
  }

  const checkTimedWindow = ({
    startSec,
    endSec,
    maxSec,
    code,
    label,
    eventId,
    path: issuePath
  }: {
    startSec: number;
    endSec: number;
    maxSec: number;
    code: string;
    label: string;
    eventId: string;
    path: string;
  }) => {
    if (startSec < 0 || endSec < 0 || startSec > maxSec || endSec > maxSec) {
      addIssue(issues, {
        severity: "error",
        code,
        message: `${label} timing must stay inside the video duration (${maxSec}s).`,
        path: issuePath,
        eventId,
        suggestion: "Clamp or rewrite the event window before attempting a render-ready handoff."
      });
    }
    if (endSec <= startSec) {
      addIssue(issues, {
        severity: "error",
        code: `${code}.duration`,
        message: `${label} must have a positive duration.`,
        path: issuePath,
        eventId,
        suggestion: "Ensure event end is greater than start."
      });
    }
  };

  plan.musicEvents.forEach((event, index) => {
    checkTimedWindow({
      startSec: event.videoStartSec,
      endSec: event.videoEndSec,
      maxSec: plan.videoDurationSec,
      code: "timing.music_event.out_of_bounds",
      label: `Music event ${event.id}`,
      eventId: event.id,
      path: `musicEvents.${index}`
    });
    if (event.volumeDb < -48 || event.volumeDb > 6) {
      addIssue(issues, {
        severity: "warning",
        code: "volume.music_event.out_of_range",
        message: `Music event ${event.id} volumeDb=${event.volumeDb} is outside the recommended range.`,
        path: `musicEvents.${index}.volumeDb`,
        eventId: event.id,
        trackId: event.trackId,
        suggestion: "Keep music bed levels between about -48 dB and +6 dB before mastering."
      });
    }
    if (event.trackId !== "placeholder-music-bed" && !event.storagePath && !event.sourceObjectKey) {
      addIssue(issues, {
        severity: blockingPlaceholderPolicy ? "error" : "warning",
        code: "music.track_storage_missing",
        message: `Music event ${event.id} does not preserve a storagePath or sourceObjectKey for track ${event.trackId}.`,
        path: `musicEvents.${index}`,
        eventId: event.id,
        trackId: event.trackId,
        suggestion: "Preserve an R2 storage path or object key before promoting this plan."
      });
    }
  });

  plan.sfxEvents.forEach((event, index) => {
    checkTimedWindow({
      startSec: event.videoStartSec,
      endSec: event.videoEndSec,
      maxSec: plan.videoDurationSec,
      code: "timing.sfx_event.out_of_bounds",
      label: `SFX event ${event.id}`,
      eventId: event.id,
      path: `sfxEvents.${index}`
    });
    if (event.volumeDb < -48 || event.volumeDb > 6) {
      addIssue(issues, {
        severity: "warning",
        code: "volume.sfx_event.out_of_range",
        message: `SFX event ${event.id} volumeDb=${event.volumeDb} is outside the recommended range.`,
        path: `sfxEvents.${index}.volumeDb`,
        eventId: event.id,
        assetId: event.assetId,
        suggestion: "Keep one-shot and impact SFX inside sane gain bounds before final mastering."
      });
    }
  });

  plan.transitionEvents.forEach((event, index) => {
    if (event.videoStartSec < 0 || event.videoEndSec > plan.videoDurationSec) {
      addIssue(issues, {
        severity: "error",
        code: "timing.transition_event.out_of_bounds",
        message: `Transition event ${event.id} extends outside the video duration.`,
        path: `transitionEvents.${index}`,
        eventId: event.id,
        suggestion: "Move transition timing fully inside the video window."
      });
    }
  });

  plan.duckingRegions.forEach((region, index) => {
    checkTimedWindow({
      startSec: region.videoStartSec,
      endSec: region.videoEndSec,
      maxSec: plan.videoDurationSec,
      code: "timing.ducking_region.out_of_bounds",
      label: `Ducking region ${region.id}`,
      eventId: region.id,
      path: `duckingRegions.${index}`
    });
  });

  const previewDurationSec = Math.max(
    0,
    (plan.previewEndSec ?? plan.videoDurationSec) - (plan.previewStartSec ?? 0)
  );
  if (previewDurationSec > 0 && previewDurationSec <= 20 && plan.sfxEvents.length > 5) {
    addIssue(issues, {
      severity: "warning",
      code: "sfx.preview_density.high",
      message: `Preview window contains ${plan.sfxEvents.length} SFX events across ${previewDurationSec.toFixed(1)} seconds.`,
      suggestion: "Reduce SFX density before a render-ready pass to avoid cluttering the preview mix."
    });
  }

  soundManifestArtifact.renderHints.placeholderCueIds.forEach((cueId) => {
    const matchingEvent = plan.musicEvents.find((event) => event.id === cueId);
    addIssue(issues, {
      severity: blockingPlaceholderPolicy ? "error" : "warning",
      code: "music.placeholder",
      message: `Music cue ${cueId} is still placeholder-backed and not mapped to export-safe audio.`,
      eventId: cueId,
      trackId: matchingEvent?.trackId,
      suggestion: "Replace placeholder music with a licensed, verified track before render-ready promotion."
    });
  });

  soundManifestArtifact.renderHints.unverifiedTrackIds.forEach((trackId) => {
    addIssue(issues, {
      severity: blockingPlaceholderPolicy ? "error" : "warning",
      code: "license.track_not_export_safe",
      message: `Track ${trackId} is not export-safe because license verification or commercial rights are missing.`,
      trackId,
      suggestion: "Verify the license and confirm commercialAllowed=true before render-ready use."
    });
  });

  soundManifestArtifact.renderHints.unresolvedTrackIds.forEach((trackId) => {
    addIssue(issues, {
      severity: blockingPlaceholderPolicy ? "error" : "warning",
      code: "music.track_unresolved",
      message: `Track ${trackId} could not be resolved to a concrete audio file during manifest adaptation.`,
      trackId,
      suggestion: "Resolve the track to a real storagePath before future rendering."
    });
  });

  const fileMissingSeverity = blockingPlaceholderPolicy ? "error" : "warning";
  for (const cue of soundManifestArtifact.manifest.musicCues) {
    if (cue.start < 0 || cue.end > soundManifestArtifact.manifest.duration || cue.end <= cue.start) {
      addIssue(issues, {
        severity: "error",
        code: "timing.manifest_music_cue.invalid",
        message: `Manifest music cue ${cue.id} has invalid timing.`,
        path: `manifest.musicCues.${cue.id}`,
        eventId: cue.id,
        suggestion: "Rebuild the sound manifest from a bounded audio plan."
      });
    }
    if (cue.gainDb < -48 || cue.gainDb > 6) {
      addIssue(issues, {
        severity: "warning",
        code: "volume.manifest_music_cue.out_of_range",
        message: `Manifest music cue ${cue.id} gainDb=${cue.gainDb} is outside the recommended range.`,
        path: `manifest.musicCues.${cue.id}.gainDb`,
        eventId: cue.id
      });
    }
    if (input.checkFileExists && !isPlaceholderPath(cue.file) && !isRemoteStorageReference(cue.file)) {
      const resolvedPath = resolveAssetPath({
        filePath: cue.file,
        assetRoot: input.assetRoot,
        repositoryRoot: input.repository.rootDir
      });
      if (!(await input.repository.pathExists(resolvedPath))) {
        addIssue(issues, {
          severity: fileMissingSeverity,
          code: "file.music_cue.missing",
          message: `Manifest music cue ${cue.id} points to a missing file.`,
          path: resolvedPath,
          eventId: cue.id,
          suggestion: "Restore the referenced music file or rewrite the cue path before rendering."
        });
      }
    }
  }

  for (const cue of soundManifestArtifact.manifest.sfx) {
    if (cue.start < 0 || cue.end > soundManifestArtifact.manifest.duration || cue.end <= cue.start) {
      addIssue(issues, {
        severity: "error",
        code: "timing.manifest_sfx_cue.invalid",
        message: `Manifest SFX cue ${cue.id} has invalid timing.`,
        path: `manifest.sfx.${cue.id}`,
        eventId: cue.id,
        suggestion: "Rebuild the sound manifest from a bounded audio plan."
      });
    }
    if (isPlaceholderPath(cue.file)) {
      addIssue(issues, {
        severity: fileMissingSeverity,
        code: "file.sfx_placeholder",
        message: `Manifest SFX cue ${cue.id} still uses a placeholder asset path.`,
        path: cue.file,
        eventId: cue.id,
        suggestion: "Map each rehearsal SFX cue to a real asset before render-ready handoff."
      });
      continue;
    }
    if (input.checkFileExists) {
      const resolvedPath = resolveAssetPath({
        filePath: cue.file,
        assetRoot: input.assetRoot,
        repositoryRoot: input.repository.rootDir
      });
      if (!(await input.repository.pathExists(resolvedPath))) {
        addIssue(issues, {
          severity: fileMissingSeverity,
          code: "file.sfx_cue.missing",
          message: `Manifest SFX cue ${cue.id} points to a missing file.`,
          path: resolvedPath,
          eventId: cue.id,
          suggestion: "Restore or remap the referenced SFX asset before rendering."
        });
      }
    }
  }

  const errorCount = countIssues(issues, (issue) => issue.severity === "error");
  const warningCount = countIssues(issues, (issue) => issue.severity === "warning");
  const status = errorCount > 0 || (input.strict && warningCount > 0)
    ? "block"
    : plan.planMode === "render_ready" && warningCount === 0
      ? "pass"
      : "warn";
  const canRender = status === "pass" && plan.planMode === "render_ready";

  const warnings = [
    ...soundManifestArtifact.warnings,
    ...issues.filter((issue) => issue.severity === "warning").map((issue) => issue.message)
  ];
  const nextActions = [...new Set([
    ...issues.map((issue) => issue.suggestion).filter((value): value is string => Boolean(value)),
    !input.checkFileExists ? "Rerun the preflight with file existence checks before any future render step." : "",
    status === "pass" ? "Manual render bridge is structurally ready for a future non-FFmpeg handoff." : ""
  ].filter(Boolean))];

  const report = musicPreflightReportSchema.parse({
    artifactType: "video_aware_music_preflight",
    jobId,
    sourceAudioPlanId: plan.id,
    sourceSoundManifestArtifactPath: soundManifestPath,
    status,
    canRender,
    planMode: plan.planMode,
    checkedAt: nowIso(input.now),
    summary: {
      musicEventCount: plan.musicEvents.length,
      sfxEventCount: plan.sfxEvents.length,
      transitionEventCount: plan.transitionEvents.length,
      placeholderMusicCount: soundManifestArtifact.renderHints.placeholderCueIds.length,
      unverifiedTrackCount: soundManifestArtifact.renderHints.unverifiedTrackIds.length,
      missingFileCount: countIssues(issues, (issue) => issue.code.startsWith("file.")),
      timingIssueCount: countIssues(issues, (issue) => issue.code.startsWith("timing.")),
      licenseIssueCount: countIssues(issues, (issue) => issue.code.startsWith("license."))
    },
    issues,
    warnings,
    nextActions
  });

  const artifactPath = await writeVideoAwareMusicPreflightArtifact({
    repository: input.repository,
    jobId,
    report
  });
  await input.repository.updateJobRecord(jobId, (current) => ({
    ...current,
    artifact_paths: {
      ...current.artifact_paths,
      video_aware_music_preflight: artifactPath
    }
  }));

  return report;
};
