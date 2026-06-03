import type {FastifyInstance, FastifyReply} from "fastify";
import {z} from "zod";

import type {BackendEnv} from "../config";
import type {R2TransferService} from "../integrations/r2";
import type {FileJobRepository} from "../repository";
import {readR2MusicCatalogArtifact, getDefaultR2MusicCatalogArtifactPath} from "./catalog/r2-music-catalog-artifact";
import {
  encodeTrackId,
  getMusicPreviewReference,
  getMusicTrackById,
  listMusicCatalog,
  type MusicLibraryUrlMode,
  type ResolvedMusicLibraryEntry
} from "./catalog/music-library-service";
import {
  createSignedMusicPreviewUrl,
  getSignedMusicPreviewConfig,
  type MusicPreviewUrlSigner
} from "./catalog/r2-preview-url-signer";
import {
  appendMusicOverride,
  applyMusicOverridesToPlan,
  buildSoundManifestRehearsal,
  musicOverrideRequestSchema,
  readMusicOverridesArtifact,
  readVideoAwareAudioPlanArtifact,
  readVideoAwareMusicPreflightArtifact,
  readVideoAwareSoundManifestArtifact,
  renderMusicPreviewMix,
  runMusicRehearsal,
  validateMusicPreflight,
  writeVideoAwareAudioPlanArtifact,
  type R2MusicCatalog,
  type R2MusicCatalogEntry,
  type VideoAwareAudioPlan
} from "./index";
import {createRemoteAudioCacheResolver} from "./renderer/remote-audio-cache";

type MusicCatalogRouteUrlMode = MusicLibraryUrlMode;

const catalogListQuerySchema = z.object({
  category: z.string().trim().optional(),
  genre: z.string().trim().optional(),
  useCase: z.string().trim().optional(),
  search: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  includeUnsafe: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .transform((value) => value === true || value === "true")
    .default(false)
});

const trackParamsSchema = z.object({
  trackId: z.string().trim().min(1)
});

const jobParamsSchema = z.object({
  jobId: z.string().trim().min(1)
});

const rehearsalRequestSchema = z.object({
  useCatalogCandidates: z.boolean().default(true),
  previewStartSec: z.number().nonnegative().optional(),
  previewEndSec: z.number().nonnegative().optional(),
  overwrite: z.boolean().default(true),
  strict: z.boolean().default(false)
});

const preflightRequestSchema = z.object({
  strict: z.boolean().default(false),
  requireRenderReady: z.boolean().default(false)
});

const previewMixRequestSchema = z.object({
  overwrite: z.boolean().default(true)
});

const resolveCatalogPath = (env: BackendEnv): string => {
  return env.MUSIC_R2_CATALOG_PATH.trim() || getDefaultR2MusicCatalogArtifactPath();
};

const resolveMusicPublicBaseUrl = (env: BackendEnv): string | null => {
  const configured = env.MUSIC_R2_PUBLIC_BASE_URL.trim() || env.R2_PUBLIC_UPLOADS_BASE.trim();
  return configured ? configured : null;
};

const isVisibleByDefault = (entry: R2MusicCatalogEntry): boolean => {
  return entry.previewAllowed || entry.renderAllowed;
};

const buildVisibleCatalog = ({
  catalog,
  includeUnsafe
}: {
  catalog: R2MusicCatalog;
  includeUnsafe: boolean;
}): R2MusicCatalog => {
  const entries = includeUnsafe
    ? catalog.entries
    : catalog.entries.filter((entry) => isVisibleByDefault(entry));

  return {
    ...catalog,
    totalTracks: entries.length,
    entries
  };
};

const toFrontendTrack = ({
  entry,
  urlMode
}: {
  entry: ResolvedMusicLibraryEntry;
  urlMode: MusicCatalogRouteUrlMode;
}): Record<string, unknown> => {
  const payload: Record<string, unknown> = {
    id: entry.id,
    encodedTrackId: encodeTrackId(entry.id),
    title: entry.title,
    artist: entry.artist,
    category: entry.category,
    genreTags: entry.genreTags,
    moodTags: entry.moodTags,
    useCaseTags: entry.useCaseTags,
    avoidWhen: entry.avoidWhen,
    previewAllowed: entry.previewAllowed,
    renderAllowed: entry.renderAllowed && entry.commercialAllowed && entry.licenseVerified,
    analysisStatus: entry.analysisStatus,
    durationSec: entry.durationSec,
    licenseSummary: {
      licenseType: entry.licenseType,
      commercialAllowed: entry.commercialAllowed,
      attributionRequired: entry.attributionRequired,
      licenseVerified: entry.licenseVerified
    }
  };

  if (urlMode === "public_url") {
    payload.audioPreviewUrl = entry.audioRef;
    if (entry.thumbnailRef) {
      payload.thumbnailUrl = entry.thumbnailRef;
    }
    return payload;
  }

  payload.audioObjectKey = entry.audioObjectKey;
  if (entry.thumbnailObjectKey) {
    payload.thumbnailObjectKey = entry.thumbnailObjectKey;
  }
  return payload;
};

const safeReadCatalog = async (env: BackendEnv): Promise<R2MusicCatalog | null> => {
  try {
    return await readR2MusicCatalogArtifact({
      inputPath: resolveCatalogPath(env)
    });
  } catch {
    return null;
  }
};

const safeReadAudioPlan = async (repository: FileJobRepository, jobId: string): Promise<VideoAwareAudioPlan | null> => {
  if (!(await repository.artifactExists(jobId, "video_aware_audio_plan"))) {
    return null;
  }

  return readVideoAwareAudioPlanArtifact({
    repository,
    jobId
  });
};

const safeReadSoundManifest = async (
  repository: FileJobRepository,
  jobId: string
): Promise<Awaited<ReturnType<typeof readVideoAwareSoundManifestArtifact>> | null> => {
  if (!(await repository.artifactExists(jobId, "video_aware_sound_manifest"))) {
    return null;
  }

  return readVideoAwareSoundManifestArtifact({
    repository,
    jobId
  });
};

const safeReadPreflight = async (
  repository: FileJobRepository,
  jobId: string
): Promise<Awaited<ReturnType<typeof readVideoAwareMusicPreflightArtifact>> | null> => {
  if (!(await repository.artifactExists(jobId, "video_aware_music_preflight"))) {
    return null;
  }

  return readVideoAwareMusicPreflightArtifact({
    repository,
    jobId
  });
};

const safeReadOverrides = async (
  repository: FileJobRepository,
  jobId: string
): Promise<Awaited<ReturnType<typeof readMusicOverridesArtifact>> | null> => {
  if (!(await repository.artifactExists(jobId, "video_aware_music_overrides"))) {
    return null;
  }

  return readMusicOverridesArtifact({
    repository,
    jobId
  });
};

const buildCatalogById = (catalog: R2MusicCatalog | null): Map<string, R2MusicCatalogEntry> => {
  return new Map((catalog?.entries ?? []).map((entry) => [entry.id, entry]));
};

const summarizeSoundManifestArtifact = (
  artifact: Awaited<ReturnType<typeof readVideoAwareSoundManifestArtifact>> | null
): Record<string, unknown> | null => {
  if (!artifact) {
    return null;
  }

  return {
    sourcePlanId: artifact.sourcePlanId,
    planMode: artifact.planMode,
    durationSec: artifact.manifest.duration,
    musicCueCount: artifact.manifest.musicCues.length,
    sfxCueCount: artifact.manifest.sfx.length,
    dialogueOrDuckingHintCount: artifact.renderHints.duckingRegions.length,
    placeholderCueIds: artifact.renderHints.placeholderCueIds,
    unresolvedTrackIds: artifact.renderHints.unresolvedTrackIds,
    unverifiedTrackIds: artifact.renderHints.unverifiedTrackIds,
    warnings: artifact.warnings
  };
};

const summarizeMusicEvent = (
  event: VideoAwareAudioPlan["musicEvents"][number],
  catalogById: Map<string, R2MusicCatalogEntry>
): Record<string, unknown> => {
  const entry = catalogById.get(event.trackId);

  return {
    id: event.id,
    trackId: event.trackId,
    encodedTrackId: encodeTrackId(event.trackId),
    title: entry?.title ?? (event.trackId === "placeholder-music-bed" ? "Placeholder music bed" : event.trackId),
    artist: entry?.artist ?? null,
    category: entry?.category ?? null,
    videoStartSec: event.videoStartSec,
    videoEndSec: event.videoEndSec,
    trackStartSec: event.trackStartSec,
    trackEndSec: event.trackEndSec,
    purpose: event.purpose,
    sectionRole: event.sectionRole,
    duckingEnabled: event.duckingEnabled,
    volumeDb: event.volumeDb,
    storagePath: event.storagePath,
    sourceObjectKey: event.sourceObjectKey,
    previewOnly: event.previewOnly,
    renderSafe: event.renderSafe,
    warning: event.warning,
    licenseSummary: entry
      ? {
          licenseType: entry.licenseType,
          commercialAllowed: entry.commercialAllowed,
          attributionRequired: entry.attributionRequired,
          licenseVerified: entry.licenseVerified
        }
      : null
  };
};

const summarizeSelectedTracks = (
  plan: VideoAwareAudioPlan | null,
  catalogById: Map<string, R2MusicCatalogEntry>
): Array<Record<string, unknown>> => {
  if (!plan) {
    return [];
  }

  const seen = new Set<string>();
  const selected: Array<Record<string, unknown>> = [];
  for (const event of plan.musicEvents) {
    if (seen.has(event.trackId)) {
      continue;
    }
    seen.add(event.trackId);
    selected.push(summarizeMusicEvent(event, catalogById));
  }
  return selected;
};

const buildMusicStateResponse = ({
  jobId,
  plan,
  soundManifest,
  preflight,
  catalog,
  previewMixPath
}: {
  jobId: string;
  plan: VideoAwareAudioPlan | null;
  soundManifest: Awaited<ReturnType<typeof readVideoAwareSoundManifestArtifact>> | null;
  preflight: Awaited<ReturnType<typeof readVideoAwareMusicPreflightArtifact>> | null;
  catalog: R2MusicCatalog | null;
  previewMixPath?: string | null;
}): Record<string, unknown> => {
  const catalogById = buildCatalogById(catalog);
  const warnings = [...new Set([
    ...(plan?.renderSettings.notes ?? []),
    ...(soundManifest?.warnings ?? []),
    ...(preflight?.warnings ?? [])
  ])];

  const reason = !plan
    ? "No dry-run music rehearsal artifacts exist yet."
    : plan.planMode === "dry_run"
      ? "Dry-run preview only / licenses not verified."
      : "Music export remains disabled in this phase.";

  return {
    jobId,
    hasAudioPlan: Boolean(plan),
    hasSoundManifest: Boolean(soundManifest),
    hasPreflight: Boolean(preflight),
    audioPlan: plan ?? undefined,
    soundManifestSummary: summarizeSoundManifestArtifact(soundManifest) ?? undefined,
    preflight: preflight ?? undefined,
    selectedTracks: summarizeSelectedTracks(plan, catalogById),
    musicEvents: plan?.musicEvents.map((event) => summarizeMusicEvent(event, catalogById)) ?? [],
    sfxEvents: plan?.sfxEvents.map((event) => ({
      id: event.id,
      assetId: event.assetId,
      type: event.type,
      videoStartSec: event.videoStartSec,
      videoEndSec: event.videoEndSec,
      intensity: event.intensity,
      reason: event.reason,
      triggerText: event.triggerText,
      mixRole: event.mixRole,
      durationSec: event.durationSec,
      volumeDb: event.volumeDb
    })) ?? [],
    warnings,
    previewMix: previewMixPath
      ? {
          status: "rendered",
          artifactPath: previewMixPath
        }
      : {
          status: "missing",
          artifactPath: null
        },
    renderAllowed: false,
    canRenderMusic: false,
    reason
  };
};

const buildAudioPlanSummary = ({
  plan,
  catalog
}: {
  plan: VideoAwareAudioPlan;
  catalog: R2MusicCatalog | null;
}): Record<string, unknown> => {
  const catalogById = buildCatalogById(catalog);
  return {
    jobId: plan.jobId,
    planId: plan.id,
    planMode: plan.planMode,
    musicEventCount: plan.musicEvents.length,
    selectedTracks: summarizeSelectedTracks(plan, catalogById),
    warnings: plan.renderSettings.notes
  };
};

const readRequiredCatalog = async (env: BackendEnv): Promise<R2MusicCatalog> => {
  return readR2MusicCatalogArtifact({
    inputPath: resolveCatalogPath(env)
  });
};

const verifyCatalogTrack = (catalog: R2MusicCatalog, trackId: string): R2MusicCatalogEntry => {
  const entry = catalog.entries.find((candidate) => candidate.id === trackId);
  if (!entry) {
    throw new Error(`Catalog track ${trackId} was not found.`);
  }
  return entry;
};

const rebuildPlanWithOverrides = async ({
  repository,
  env,
  jobId
}: {
  repository: FileJobRepository;
  env: BackendEnv;
  jobId: string;
}): Promise<{
  plan: VideoAwareAudioPlan;
  preflight: Awaited<ReturnType<typeof validateMusicPreflight>>;
  warnings: string[];
  catalog: R2MusicCatalog;
}> => {
  const catalog = await readRequiredCatalog(env);
  const overridesArtifact = await safeReadOverrides(repository, jobId);
  await runMusicRehearsal({
    repository,
    jobId,
    useCatalogCandidates: true,
    catalogEntries: catalog.entries,
    overwrite: true
  });
  const freshPlan = await readVideoAwareAudioPlanArtifact({
    repository,
    jobId
  });
  const overriddenPlan = overridesArtifact
    ? applyMusicOverridesToPlan({
        plan: freshPlan,
        overrides: overridesArtifact.overrides,
        catalogEntries: catalog.entries
      })
    : freshPlan;
  await writeVideoAwareAudioPlanArtifact({
    repository,
    jobId,
    plan: overriddenPlan
  });
  await buildSoundManifestRehearsal({
    repository,
    jobId
  });
  const preflight = await validateMusicPreflight({
    repository,
    jobId
  });

  return {
    plan: overriddenPlan,
    preflight,
    warnings: [...overriddenPlan.renderSettings.notes, ...preflight.warnings],
    catalog
  };
};

const isNotFoundError = (message: string): boolean => {
  return /not found|is missing|no preview music event exists/i.test(message);
};

const handleRouteError = ({
  reply,
  error
}: {
  reply: FastifyReply;
  error: unknown;
}): {error: string} => {
  const message = error instanceof Error ? error.message : String(error);
  reply.code(isNotFoundError(message) ? 404 : 400);
  return {
    error: message
  };
};

export const registerMusicCatalogRoutes = async (
  app: FastifyInstance,
  {
    env,
    repository,
    signMusicPreviewUrl,
    r2Service
  }: {
    env: BackendEnv;
    repository: FileJobRepository;
    signMusicPreviewUrl?: MusicPreviewUrlSigner;
    r2Service: R2TransferService;
  }
): Promise<void> => {
  const remoteAudioResolver = createRemoteAudioCacheResolver({
    env,
    r2Service
  });
  app.get("/api/music/catalog", async (req, reply) => {
    try {
      const query = catalogListQuerySchema.parse(req.query ?? {});
      const sourceCatalog = await readRequiredCatalog(env);
      const visibleCatalog = buildVisibleCatalog({
        catalog: sourceCatalog,
        includeUnsafe: query.includeUnsafe
      });
      const publicBaseUrl = resolveMusicPublicBaseUrl(env);
      const filtered = await listMusicCatalog({
        catalog: visibleCatalog,
        category: query.category,
        genreTag: query.genre,
        useCaseTag: query.useCase,
        search: query.search,
        limit: Math.max(1, visibleCatalog.entries.length),
        publicBaseUrl
      });
      const pagedTracks = filtered.entries
        .slice(query.offset, query.offset + query.limit)
        .map((entry) => toFrontendTrack({
          entry,
          urlMode: filtered.urlMode
        }));
      const categories = [...new Set(filtered.entries.map((entry) => entry.category))].sort();

      return {
        tracks: pagedTracks,
        total: filtered.total,
        limit: query.limit,
        offset: query.offset,
        urlMode: filtered.urlMode,
        categories
      };
    } catch (error) {
      return handleRouteError({reply, error});
    }
  });

  app.get("/api/music/catalog/:trackId/preview-url", async (req, reply) => {
    try {
      const params = trackParamsSchema.parse(req.params ?? {});
      const sourceCatalog = await readRequiredCatalog(env);
      const publicBaseUrl = resolveMusicPublicBaseUrl(env);
      const entry = await getMusicTrackById({
        id: params.trackId,
        catalog: sourceCatalog,
        publicBaseUrl
      });

      if (!entry) {
        reply.code(404);
        return {
          error: "Music track not found."
        };
      }

      if (!entry.previewAllowed) {
        reply.code(403);
        return {
          trackId: entry.id,
          encodedTrackId: encodeTrackId(entry.id),
          urlMode: "object_key_only",
          playableInBrowser: false,
          audioPreviewUrl: null,
          audioObjectKey: entry.audioObjectKey,
          reason: "Preview is disabled for this track."
        };
      }

      const signedPreviewConfig = getSignedMusicPreviewConfig(env);
      const signedPreviewUrl =
        !publicBaseUrl &&
        signedPreviewConfig.enabled &&
        signedPreviewConfig.configured
          ? await (signMusicPreviewUrl ?? createSignedMusicPreviewUrl)({
              bucket: entry.bucket,
              objectKey: entry.audioObjectKey,
              ttlSeconds: signedPreviewConfig.ttlSeconds,
              env
            })
          : null;
      const preview = getMusicPreviewReference(entry, {
        publicBaseUrl,
        signedPreviewUrl
      });

      return preview;
    } catch (error) {
      return handleRouteError({reply, error});
    }
  });

  app.get("/api/music/catalog/:trackId", async (req, reply) => {
    try {
      const params = trackParamsSchema.parse(req.params ?? {});
      const sourceCatalog = await readRequiredCatalog(env);
      const visibleCatalog = buildVisibleCatalog({
        catalog: sourceCatalog,
        includeUnsafe: false
      });
      const publicBaseUrl = resolveMusicPublicBaseUrl(env);
      const entry = await getMusicTrackById({
        id: params.trackId,
        catalog: visibleCatalog,
        publicBaseUrl
      });

      if (!entry) {
        reply.code(404);
        return {
          error: "Music track not found."
        };
      }

      return toFrontendTrack({
        entry,
        urlMode: entry.urlMode
      });
    } catch (error) {
      return handleRouteError({reply, error});
    }
  });

  app.get("/api/jobs/:jobId/music/state", async (req, reply) => {
    try {
      const params = jobParamsSchema.parse(req.params ?? {});
      if (!(await repository.artifactExists(params.jobId, "job"))) {
        reply.code(404);
        return {
          error: "Job not found."
        };
      }

      const [plan, soundManifest, preflight, catalog, jobRecord] = await Promise.all([
        safeReadAudioPlan(repository, params.jobId),
        safeReadSoundManifest(repository, params.jobId),
        safeReadPreflight(repository, params.jobId),
        safeReadCatalog(env),
        repository.getJobRecord(params.jobId)
      ]);

      return buildMusicStateResponse({
        jobId: params.jobId,
        plan,
        soundManifest,
        preflight,
        catalog,
        previewMixPath: jobRecord.artifact_paths.video_aware_audio_preview_mix
      });
    } catch (error) {
      return handleRouteError({reply, error});
    }
  });

  app.get("/api/jobs/:jobId/video-aware-audio-plan", async (req, reply) => {
    try {
      const params = jobParamsSchema.parse(req.params ?? {});
      return await readVideoAwareAudioPlanArtifact({
        repository,
        jobId: params.jobId
      });
    } catch (error) {
      return handleRouteError({reply, error});
    }
  });

  app.get("/api/jobs/:jobId/video-aware-sound-manifest", async (req, reply) => {
    try {
      const params = jobParamsSchema.parse(req.params ?? {});
      return await readVideoAwareSoundManifestArtifact({
        repository,
        jobId: params.jobId
      });
    } catch (error) {
      return handleRouteError({reply, error});
    }
  });

  app.get("/api/jobs/:jobId/music-preflight", async (req, reply) => {
    try {
      const params = jobParamsSchema.parse(req.params ?? {});
      return await readVideoAwareMusicPreflightArtifact({
        repository,
        jobId: params.jobId
      });
    } catch (error) {
      return handleRouteError({reply, error});
    }
  });

  app.post("/api/jobs/:jobId/music/rehearsal", async (req, reply) => {
    try {
      const params = jobParamsSchema.parse(req.params ?? {});
      const body = rehearsalRequestSchema.parse(req.body ?? {});
      const catalog = body.useCatalogCandidates ? await safeReadCatalog(env) : null;
      const result = await runMusicRehearsal({
        repository,
        jobId: params.jobId,
        useCatalogCandidates: body.useCatalogCandidates,
        catalogEntries: body.useCatalogCandidates ? (catalog?.entries ?? undefined) : undefined,
        previewStartSec: body.previewStartSec,
        previewEndSec: body.previewEndSec,
        overwrite: body.overwrite,
        strict: body.strict
      });

      return {
        ...result,
        dryRunOnly: true,
        audioRenderPlanTouched: false,
        reason: "This endpoint only rebuilds dry-run rehearsal artifacts."
      };
    } catch (error) {
      return handleRouteError({reply, error});
    }
  });

  app.post("/api/jobs/:jobId/music/preflight", async (req, reply) => {
    try {
      const params = jobParamsSchema.parse(req.params ?? {});
      const body = preflightRequestSchema.parse(req.body ?? {});
      return await validateMusicPreflight({
        repository,
        jobId: params.jobId,
        strict: body.strict,
        requireRenderReady: body.requireRenderReady
      });
    } catch (error) {
      return handleRouteError({reply, error});
    }
  });

  app.post("/api/jobs/:jobId/music/preview-mix", async (req, reply) => {
    try {
      const params = jobParamsSchema.parse(req.params ?? {});
      const body = previewMixRequestSchema.parse(req.body ?? {});
      return await renderMusicPreviewMix({
        repository,
        jobId: params.jobId,
        overwrite: body.overwrite,
        remoteAudioResolver
      });
    } catch (error) {
      return handleRouteError({reply, error});
    }
  });

  app.post("/api/jobs/:jobId/music/overrides", async (req, reply) => {
    try {
      const params = jobParamsSchema.parse(req.params ?? {});
      const body = musicOverrideRequestSchema.parse(req.body ?? {});

      if (body.action === "use_catalog_track" || body.action === "replace_track") {
        if (!body.trackId) {
          reply.code(400);
          return {
            error: `Override action ${body.action} requires a trackId.`
          };
        }
      }

      const catalog = await readRequiredCatalog(env);
      if ((body.action === "use_catalog_track" || body.action === "replace_track") && body.trackId) {
        verifyCatalogTrack(catalog, body.trackId);
      }

      const appended = await appendMusicOverride({
        repository,
        jobId: params.jobId,
        request: body
      });

      if (!body.rebuildPlan) {
        return {
          override: appended.override,
          warnings: ["Override saved. Rebuild was skipped because rebuildPlan=false."],
          updatedAudioPlanSummary: null,
          preflightStatus: null
        };
      }

      const rebuilt = await rebuildPlanWithOverrides({
        repository,
        env,
        jobId: params.jobId
      });

      return {
        override: appended.override,
        updatedAudioPlanSummary: buildAudioPlanSummary({
          plan: rebuilt.plan,
          catalog: rebuilt.catalog
        }),
        preflightStatus: rebuilt.preflight.status,
        warnings: [...new Set(rebuilt.warnings)],
        renderAllowed: false,
        canRenderMusic: false,
        reason: "Manual music overrides affect dry-run planning only. Export remains disabled."
      };
    } catch (error) {
      return handleRouteError({reply, error});
    }
  });
};
