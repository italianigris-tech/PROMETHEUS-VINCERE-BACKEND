import path from "node:path";

import {renderMasterTrack, type SoundDesignManifest} from "../../sound-engine";
import {soundDesignManifestSchema} from "../../sound-engine/types";
import {
  adaptAudioPlanToSoundDesignManifestWithHints,
  type AdaptedSoundDesignRenderHints,
  type AdaptAudioPlanToSoundDesignManifestInput
} from "./manifest-adapter";
import type {RemoteAudioCacheResolver, RemoteAudioRole} from "./remote-audio-cache";

export type RenderAudioPlanInput = AdaptAudioPlanToSoundDesignManifestInput & {
  manifest?: SoundDesignManifest;
  outputAudioPath?: string | null;
  outputVideoPath?: string | null;
  disabled?: boolean;
  baseDir?: string;
  renderHints?: AdaptedSoundDesignRenderHints;
  remoteAudioResolver?: RemoteAudioCacheResolver;
  remoteAudioCacheDir?: string;
};

export type RenderAudioPlanResult = {
  status: "rendered" | "blocked" | "skipped";
  manifest: SoundDesignManifest;
  outputAudioPath?: string;
  outputVideoPath?: string | null;
  warnings: string[];
  errors: string[];
  evidence: string[];
  requiredInputsMissing: string[];
};

const isPlaceholderPath = (value: string): boolean =>
  value.startsWith("__music_track_placeholder__/") || value.startsWith("__sfx_placeholder__/");

const isRemoteOnlyPath = (value: string): boolean =>
  /^r2:\/\//i.test(value) || /^https?:\/\//i.test(value) || value.startsWith("music-originals/");

const resolveRenderBaseDir = (baseDir?: string): string => path.resolve(baseDir ?? process.cwd());

const resolveRemoteAudioSource = async ({
  source,
  cueId,
  role,
  cacheDir,
  resolver
}: {
  source: string;
  cueId: string;
  role: RemoteAudioRole;
  cacheDir: string;
  resolver?: RemoteAudioCacheResolver;
}): Promise<{file: string; evidence: string[]}> => {
  if (!isRemoteOnlyPath(source)) {
    return {
      file: source,
      evidence: []
    };
  }

  if (!resolver) {
    throw new Error(
      `RemoteAudioRenderError: ${role} cue ${cueId} uses remote audio ${source}, but no remote audio cache resolver was configured.`
    );
  }

  const cached = await resolver({
    source,
    cueId,
    role,
    cacheDir
  });
  const localPath = cached.localPath.trim();
  if (!localPath || isRemoteOnlyPath(localPath)) {
    throw new Error(`RemoteAudioRenderError: ${role} cue ${cueId} did not resolve to a local audio file.`);
  }

  return {
    file: localPath,
    evidence: cached.evidence
  };
};

export const renderAudioPlan = async (input: RenderAudioPlanInput): Promise<RenderAudioPlanResult> => {
  const adapted = input.manifest
    ? {
        manifest: soundDesignManifestSchema.parse(input.manifest),
        renderHints: input.renderHints ?? {
          planMode: input.plan.planMode,
          unresolvedTrackIds: [],
          placeholderCueIds: [],
          unverifiedTrackIds: [],
          orphanTransitionEvents: [],
          duckingRegions: [],
          warnings: []
        }
      }
    : adaptAudioPlanToSoundDesignManifestWithHints(input);
  const manifest = adapted.manifest;
  const warnings = [...adapted.renderHints.warnings];
  const errors: string[] = [];
  const evidence: string[] = [];
  const requiredInputsMissing: string[] = [];
  const baseDir = resolveRenderBaseDir(input.baseDir);
  const remoteAudioCacheDir = path.resolve(input.remoteAudioCacheDir ?? path.join(baseDir, ".cache", "remote-audio"));

  if (input.disabled) {
    return {
      status: "skipped",
      manifest,
      outputAudioPath: input.outputAudioPath ?? undefined,
      outputVideoPath: input.outputVideoPath ?? null,
      warnings,
      errors,
      evidence: ["Audio preview rendering was explicitly disabled for this invocation."],
      requiredInputsMissing
    };
  }

  const outputAudioPath = input.outputAudioPath?.trim() ?? input.plan.outputAudioPath?.trim() ?? "";
  if (!outputAudioPath) {
    requiredInputsMissing.push("outputAudioPath");
  }

  if (input.plan.planMode === "render_ready" && adapted.renderHints.unverifiedTrackIds.length > 0) {
    errors.push(
      `Render-ready handoff is blocked because unverified tracks remain: ${adapted.renderHints.unverifiedTrackIds.join(", ")}.`
    );
  } else if (adapted.renderHints.unverifiedTrackIds.length > 0) {
    warnings.push(
      `Rendering a dry-run preview mix with preview-only tracks: ${adapted.renderHints.unverifiedTrackIds.join(", ")}.`
    );
  }

  const localizedMusicCues = await Promise.all(manifest.musicCues.map(async (cue) => {
    const resolved = await resolveRemoteAudioSource({
      source: cue.file,
      cueId: cue.id,
      role: "music",
      cacheDir: remoteAudioCacheDir,
      resolver: input.remoteAudioResolver
    });
    evidence.push(...resolved.evidence);
    return {
      ...cue,
      file: resolved.file
    };
  }));
  const localizedSfxCues = await Promise.all(manifest.sfx.map(async (cue) => {
    const resolved = await resolveRemoteAudioSource({
      source: cue.file,
      cueId: cue.id,
      role: "sfx",
      cacheDir: remoteAudioCacheDir,
      resolver: input.remoteAudioResolver
    });
    evidence.push(...resolved.evidence);
    return {
      ...cue,
      file: resolved.file
    };
  }));
  const localizedDialogueSource = manifest.dialogueSource
    ? (await resolveRemoteAudioSource({
        source: manifest.dialogueSource,
        cueId: "dialogue_source",
        role: "dialogue",
        cacheDir: remoteAudioCacheDir,
        resolver: input.remoteAudioResolver
      }))
    : null;
  if (localizedDialogueSource) {
    evidence.push(...localizedDialogueSource.evidence);
  }

  const localizedManifest: SoundDesignManifest = {
    ...manifest,
    musicCues: localizedMusicCues,
    sfx: localizedSfxCues,
    dialogueSource: localizedDialogueSource?.file ?? manifest.dialogueSource
  };

  const blockedMusicSources = localizedManifest.musicCues
    .filter((cue) => isPlaceholderPath(cue.file))
    .map((cue) => ({
      cueId: cue.id,
      file: cue.file,
      reason: "placeholder-backed cue requires a real licensed audio asset"
    }));
  blockedMusicSources.forEach((source) => {
    requiredInputsMissing.push(`music cue ${source.cueId}: ${source.reason}`);
    errors.push(`Music cue ${source.cueId} cannot render from ${source.file}.`);
  });

  const blockedSfxSources = localizedManifest.sfx.filter((cue) => isPlaceholderPath(cue.file));
  blockedSfxSources.forEach((cue) => {
    requiredInputsMissing.push(`sfx cue ${cue.id}: placeholder-backed cue requires a real sound effect asset`);
    errors.push(`SFX cue ${cue.id} cannot render from ${cue.file}.`);
  });

  const renderableManifest: SoundDesignManifest = {
    ...localizedManifest,
    dialogueSource:
      localizedManifest.dialogueSource && !isPlaceholderPath(localizedManifest.dialogueSource)
        ? localizedManifest.dialogueSource
        : undefined
  };
  if (localizedManifest.dialogueSource && renderableManifest.dialogueSource !== localizedManifest.dialogueSource) {
    warnings.push("Dialogue source was omitted from the preview mix because it was not locally renderable.");
  }

  if (renderableManifest.musicCues.length === 0 && renderableManifest.sfx.length === 0) {
    errors.push("Preview mix rendering requires at least one locally renderable music or SFX cue.");
  }

  if (requiredInputsMissing.length > 0 || errors.length > 0) {
    return {
      status: "blocked",
      manifest: renderableManifest,
      outputAudioPath: outputAudioPath || undefined,
      outputVideoPath: input.outputVideoPath ?? null,
      warnings,
      errors,
      evidence,
      requiredInputsMissing
    };
  }

  const resolvedOutputAudioPath = path.resolve(outputAudioPath);
  const previewMixPath = resolvedOutputAudioPath;
  const masterPath = path.join(path.dirname(resolvedOutputAudioPath), `${path.parse(resolvedOutputAudioPath).name}.master.wav`);

  try {
    const result = await renderMasterTrack(renderableManifest, masterPath, {
      baseDir,
      previewMixPath,
      logCommand: () => undefined
    });
    evidence.push(`Rendered preview mix via sound-engine to ${previewMixPath}.`);
    evidence.push(`Master intermediary path: ${result.masterPath}.`);
    if (result.previewFfmpegCommand) {
      evidence.push("Preview mix used the sound-engine preview filtergraph path.");
    }
    if (adapted.renderHints.duckingRegions.length > 0 && renderableManifest.musicCues.length > 0) {
      const duckingMode = result.compilation.filterComplexScript.includes("sidechaincompress")
        ? "sidechaincompress"
        : "timeline-envelope ducking";
      evidence.push(
        `Ducking applied across ${adapted.renderHints.duckingRegions.length} dialogue region(s) via ${duckingMode}.`
      );
    }
    if (renderableManifest.sfx.length > 0) {
      evidence.push(`SFX mixed into render: ${renderableManifest.sfx.map((cue) => cue.id).join(", ")}.`);
    }

    return {
      status: "rendered",
      manifest: renderableManifest,
      outputAudioPath: result.previewMixPath ?? result.masterPath,
      outputVideoPath: input.outputVideoPath ?? null,
      warnings: [...warnings, ...result.warnings],
      errors,
      evidence,
      requiredInputsMissing
    };
  } catch (error) {
    throw new Error(`AudioRenderFatalError: FFmpeg audio preview mix failed. ${error instanceof Error ? error.message : String(error)}`);
  }
};
