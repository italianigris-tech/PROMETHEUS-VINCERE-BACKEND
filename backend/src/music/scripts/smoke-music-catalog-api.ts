import {loadEnv} from "../../config";
import {buildMusicCatalogSmokeSummary} from "../catalog/music-catalog-smoke";

const main = async (): Promise<void> => {
  const env = loadEnv();
  const summary = await buildMusicCatalogSmokeSummary({
    catalogPath: env.MUSIC_R2_CATALOG_PATH.trim() || undefined,
    publicBaseUrl: env.MUSIC_R2_PUBLIC_BASE_URL.trim() || env.R2_PUBLIC_UPLOADS_BASE.trim() || null
  });

  console.log(JSON.stringify(summary, null, 2));
};

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
