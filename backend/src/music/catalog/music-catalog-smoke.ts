import {
  getDefaultR2MusicCatalogArtifactPath,
  readR2MusicCatalogArtifact
} from "./r2-music-catalog-artifact";
import {
  createSignedMusicPreviewUrl,
  getSignedMusicPreviewConfig,
  type MusicPreviewUrlSigner
} from "./r2-preview-url-signer";
import {encodeTrackId, getMusicPreviewReference, listMusicCatalog, type MusicLibraryUrlMode} from "./music-library-service";
import {loadEnv, type BackendEnv} from "../../config";

export type MusicCatalogSmokeSummary = {
  totalTracks: number;
  categories: string[];
  previewAllowedCount: number;
  renderAllowedCount: number;
  urlMode: MusicLibraryUrlMode;
  playableInBrowser: boolean;
  signedPreviewEnabled: boolean;
  signedPreviewConfigured: boolean;
  signedPreviewTtlSeconds: number;
  exampleTrackId: string | null;
  exampleEncodedTrackId: string | null;
  examplePreviewMode: MusicLibraryUrlMode | null;
  hasAudioPreviewUrl: boolean;
  expiresAt: string | null;
};

export const buildMusicCatalogSmokeSummary = async ({
  catalogPath,
  publicBaseUrl,
  signer,
  env: providedEnv
}: {
  catalogPath?: string;
  publicBaseUrl?: string | null;
  signer?: MusicPreviewUrlSigner;
  env?: BackendEnv;
} = {}): Promise<MusicCatalogSmokeSummary> => {
  const resolvedCatalogPath = catalogPath ?? getDefaultR2MusicCatalogArtifactPath();
  const env = providedEnv ?? loadEnv();
  const signedPreviewConfig = getSignedMusicPreviewConfig(env);

  try {
    const catalog = await readR2MusicCatalogArtifact({
      inputPath: resolvedCatalogPath
    });
    const listing = await listMusicCatalog({
      catalog,
      limit: 1,
      publicBaseUrl
    });
    const previewAllowedCount = catalog.entries.filter((entry) => entry.previewAllowed).length;
    const renderAllowedCount = catalog.entries.filter((entry) => entry.renderAllowed).length;
    const exampleEntry = catalog.entries[0] ?? null;
    const signedPreviewUrl = exampleEntry &&
      !publicBaseUrl &&
      signedPreviewConfig.enabled &&
      signedPreviewConfig.configured &&
      exampleEntry.previewAllowed
      ? await (signer ?? createSignedMusicPreviewUrl)({
          bucket: exampleEntry.bucket,
          objectKey: exampleEntry.audioObjectKey,
          ttlSeconds: signedPreviewConfig.ttlSeconds,
          env
        })
      : null;
    const preview = exampleEntry
      ? getMusicPreviewReference(exampleEntry, {
          publicBaseUrl,
          signedPreviewUrl
        })
      : null;

    return {
      totalTracks: catalog.totalTracks,
      categories: [...new Set(catalog.entries.map((entry) => entry.category))].sort(),
      previewAllowedCount,
      renderAllowedCount,
      urlMode: preview?.urlMode ?? listing.urlMode,
      playableInBrowser: preview?.playableInBrowser ?? false,
      signedPreviewEnabled: signedPreviewConfig.enabled,
      signedPreviewConfigured: signedPreviewConfig.configured,
      signedPreviewTtlSeconds: signedPreviewConfig.ttlSeconds,
      exampleTrackId: exampleEntry?.id ?? null,
      exampleEncodedTrackId: exampleEntry ? encodeTrackId(exampleEntry.id) : null,
      examplePreviewMode: preview?.urlMode ?? null,
      hasAudioPreviewUrl: Boolean(preview?.audioPreviewUrl),
      expiresAt: preview?.expiresAt ?? null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Normalized music catalog not found at ${resolvedCatalogPath}. ` +
      `Run 'npm run music:catalog:normalize -- --input "../YOUTUBE MUSIC DOWNLOADER -THRAGG/downloads/music-catalog.json"' first. ` +
      `Original error: ${message}`
    );
  }
};
