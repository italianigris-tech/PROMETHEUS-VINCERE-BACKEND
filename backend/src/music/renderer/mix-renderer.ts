import path from "node:path";

import {renderMasterTrack, type SoundDesignManifest} from "../../sound-engine";
import {soundDesignManifestSchema} from "../../sound-engine/types";
import {
  adaptAudioPlanToSoundDesignManifestWithHints,
  type AdaptAudioPlanToSoundDesignManifestInput
} from "./manifest-adapter";

export type RenderAudioPlanInput = AdaptAudioPlanToSoundDesignManifestInput & {
  manifest?: SoundDesignManifest;
  outputAudioPath?: string | null;
  outputVideoPath?: string | null;
  disabled?: boolean;
  baseDir?: string;
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

export const renderAudioPlan = async (input: RenderAudioPlanInput): Promise<RenderAudioPlanResult> => {
  const adapted = input.manifest
    ? {
        manifest: soundDesignManifestSchema.parse(input.manifest),
        renderHints: {
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

  const blockedMusicSources = manifest.musicCues
    .filter((cue) => isPlaceholderPath(cue.file) || isRemoteOnlyPath(cue.file))
    .map((cue) => ({
      cueId: cue.id,
      file: cue.file,
      reason: isPlaceholderPath(cue.file)
        ? "placeholder-backed cue requires a real licensed audio asset"
        : "remote R2/HTTP source requires a local cache or download resolver"
    }));
  blockedMusicSources.forEach((source) => {
    requiredInputsMissing.push(`music cue ${source.cueId}: ${source.reason}`);
    errors.push(`Music cue ${source.cueId} cannot render from ${source.file}.`);
  });

  const droppedSfx = manifest.sfx.filter((cue) => isPlaceholderPath(cue.file) || isRemoteOnlyPath(cue.file));
  const keptSfx = manifest.sfx.filter((cue) => !isPlaceholderPath(cue.file) && !isRemoteOnlyPath(cue.file));
  droppedSfx.forEach((cue) => {
    warnings.push(`Dropped SFX cue ${cue.id} from preview mix because ${cue.file} is not locally renderable.`);
  });

  const renderableManifest: SoundDesignManifest = {
    ...manifest,
    sfx: keptSfx,
    dialogueSource:
      manifest.dialogueSource && !isRemoteOnlyPath(manifest.dialogueSource) && !isPlaceholderPath(manifest.dialogueSource)
        ? manifest.dialogueSource
        : undefined
  };
  if (manifest.dialogueSource && renderableManifest.dialogueSource !== manifest.dialogueSource) {
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

  const baseDir = resolveRenderBaseDir(input.baseDir);
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
    errors.push(error instanceof Error ? error.message : String(error));
    return {
      status: "blocked",
      manifest: renderableManifest,
      outputAudioPath: resolvedOutputAudioPath,
      outputVideoPath: input.outputVideoPath ?? null,
      warnings,
      errors,
      evidence,
      requiredInputsMissing
    };
  }
};
