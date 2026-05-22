import {
  videoAwareAudioPlanSchema,
  musicEventSchema,
  type MusicEvent,
  type VideoAwareAudioPlan
} from "../schemas/audio-plan.schema";
import type {R2MusicCatalogEntry} from "../catalog/r2-music-catalog.schema";
import {
  musicOverrideSchema,
  type MusicOverride
} from "../schemas/music-override.schema";

export class MusicOverrideUnsupportedError extends Error {
  public constructor(action: string, targetType: string) {
    super(`Override action ${action} for targetType ${targetType} is not supported in Phase 7 MVP.`);
    this.name = "MusicOverrideUnsupportedError";
  }
}

export class MusicOverrideTargetNotFoundError extends Error {
  public constructor(targetType: string, targetId?: string | null) {
    super(
      targetType === "preview"
        ? "No preview music event exists to override."
        : `Override target was not found for ${targetType}${targetId ? ` (${targetId})` : ""}.`
    );
    this.name = "MusicOverrideTargetNotFoundError";
  }
}

export class MusicOverrideTrackRequiredError extends Error {
  public constructor(action: string) {
    super(`Override action ${action} requires a trackId.`);
    this.name = "MusicOverrideTrackRequiredError";
  }
}

const isTrackReplacementAction = (action: MusicOverride["action"]): boolean => {
  return action === "use_catalog_track" || action === "replace_track";
};

const isRenderSafeEntry = (entry: R2MusicCatalogEntry): boolean => {
  return entry.renderAllowed && entry.commercialAllowed && entry.licenseVerified;
};

const getOverlapDurationSec = (
  leftStartSec: number,
  leftEndSec: number,
  rightStartSec: number,
  rightEndSec: number
): number => {
  return Math.max(0, Math.min(leftEndSec, rightEndSec) - Math.max(leftStartSec, rightStartSec));
};

const resolvePreviewTargetIndex = ({
  plan,
  musicEvents,
  override
}: {
  plan: VideoAwareAudioPlan;
  musicEvents: MusicEvent[];
  override: MusicOverride;
}): number => {
  const previewStartSec = override.startSec ?? plan.previewStartSec ?? 0;
  const previewEndSec = override.endSec ?? plan.previewEndSec ?? plan.videoDurationSec;

  const rankedMatches = musicEvents
    .map((event, index) => ({
      index,
      overlapSec: getOverlapDurationSec(
        event.videoStartSec,
        event.videoEndSec,
        previewStartSec,
        previewEndSec
      )
    }))
    .filter((candidate) => candidate.overlapSec > 0)
    .sort((left, right) => right.overlapSec - left.overlapSec || left.index - right.index);

  if (rankedMatches[0]) {
    return rankedMatches[0].index;
  }

  return musicEvents.length > 0 ? 0 : -1;
};

const replaceMusicEventTrack = ({
  event,
  entry,
  override
}: {
  event: MusicEvent;
  entry: R2MusicCatalogEntry;
  override: MusicOverride;
}): MusicEvent => {
  const renderSafe = isRenderSafeEntry(entry);
  const previewOnly = !renderSafe;

  return musicEventSchema.parse({
    ...event,
    trackId: entry.id,
    storagePath: `r2://${entry.bucket}/${entry.audioObjectKey}`,
    sourceObjectKey: entry.audioObjectKey,
    previewOnly,
    renderSafe,
    warning: [
      previewOnly ? "Preview only / license not verified." : "Render-safe catalog track selected.",
      override.reason ?? null
    ].filter(Boolean).join(" ")
  });
};

export const applyMusicOverridesToPlan = ({
  plan,
  overrides,
  catalogEntries,
  now
}: {
  plan: VideoAwareAudioPlan;
  overrides: MusicOverride[];
  catalogEntries: R2MusicCatalogEntry[];
  now?: () => string;
}): VideoAwareAudioPlan => {
  let nextPlan = videoAwareAudioPlanSchema.parse(plan);
  const catalogById = new Map(catalogEntries.map((entry) => [entry.id, entry]));

  for (const rawOverride of overrides) {
    const override = musicOverrideSchema.parse(rawOverride);
    if (!isTrackReplacementAction(override.action)) {
      throw new MusicOverrideUnsupportedError(override.action, override.targetType);
    }
    if (!override.trackId) {
      throw new MusicOverrideTrackRequiredError(override.action);
    }

    const entry = catalogById.get(override.trackId);
    if (!entry) {
      throw new Error(`Catalog track ${override.trackId} was not found.`);
    }

    const updatedMusicEvents = [...nextPlan.musicEvents];
    if (override.targetType === "preview") {
      const targetIndex = resolvePreviewTargetIndex({
        plan: nextPlan,
        musicEvents: updatedMusicEvents,
        override
      });
      if (targetIndex === -1) {
        throw new MusicOverrideTargetNotFoundError(override.targetType);
      }
      updatedMusicEvents[targetIndex] = replaceMusicEventTrack({
        event: updatedMusicEvents[targetIndex],
        entry,
        override
      });
    } else if (override.targetType === "music_event") {
      const targetIndex = updatedMusicEvents.findIndex((event) => event.id === override.targetId);
      if (targetIndex === -1) {
        throw new MusicOverrideTargetNotFoundError(override.targetType, override.targetId);
      }
      updatedMusicEvents[targetIndex] = replaceMusicEventTrack({
        event: updatedMusicEvents[targetIndex],
        entry,
        override
      });
    } else {
      throw new MusicOverrideUnsupportedError(override.action, override.targetType);
    }

    nextPlan = videoAwareAudioPlanSchema.parse({
      ...nextPlan,
      musicEvents: updatedMusicEvents,
      updatedAt: now?.() ?? new Date().toISOString(),
      renderSettings: {
        ...nextPlan.renderSettings,
        notes: [
          ...nextPlan.renderSettings.notes,
          `Applied music override ${override.id}: ${override.action} -> ${entry.id}`
        ]
      }
    });
  }

  return nextPlan;
};
