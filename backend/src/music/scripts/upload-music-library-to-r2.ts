import {mkdir, readFile, readdir, stat, writeFile} from "node:fs/promises";
import https from "node:https";
import path from "node:path";

import {HeadBucketCommand, ListObjectsV2Command, PutObjectCommand, S3Client} from "@aws-sdk/client-s3";

import {loadEnv} from "../../config";

type UploadKind = "mp3" | "thumbnail";

type LocalAsset = {
  kind: UploadKind;
  absolutePath: string;
  category: string;
  categorySlug: string;
  title: string;
  trackSlug: string;
  extension: string;
  objectKey: string;
  fileSizeBytes: number;
};

type MusicCatalogEntry = {
  id: string;
  title: string;
  category: string;
  categorySlug: string;
  originalObjectKey: string;
  thumbnailObjectKey: string | null;
  duration: number | null;
  fileSizeBytes: number;
};

type UploadSummary = {
  totalMp3sFound: number;
  totalThumbnailsFound: number;
  uploaded: number;
  skipped: number;
  failed: number;
};

type EffectiveMusicUploadEnv = {
  cloudflareAccountId: string;
  r2AccountId: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  musicLibraryPath: string;
};

type RetryOptions = {
  attempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  operationLabel: string;
};

const TRACK_EXTENSIONS = new Set([".mp3"]);
const THUMBNAIL_EXTENSIONS = new Set([".webp", ".jpg", ".jpeg", ".png"]);
const THUMBNAIL_PRIORITY = [".webp", ".jpg", ".jpeg", ".png"];
const MAX_UPLOAD_CONCURRENCY = 1;
const CLOCK_SKEW_WARNING_MS = 4 * 60 * 1000;

const printUsage = (): void => {
  console.log(`
Usage:
  npm run music:upload:r2 -- --sourceRoot "<path>" --catalogPath "<path>" [--dryRun]
  npm run music:upload:r2 -- --doctor [--doctor-write]

Environment variables required:
  CLOUDFLARE_ACCOUNT_ID
  R2_ACCESS_KEY_ID
  R2_SECRET_ACCESS_KEY
  R2_BUCKET_NAME

Optional environment variables:
  MUSIC_LIBRARY_PATH
  R2_ENDPOINT
`);
};

const slugify = (value: string): string => {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
};

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

const requireEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const resolveMaybeRelative = (value: string, baseDir: string): string => {
  return path.isAbsolute(value) ? value : path.resolve(baseDir, value);
};

const detectContentType = (extension: string): string => {
  switch (extension) {
    case ".mp3":
      return "audio/mpeg";
    case ".webp":
      return "image/webp";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    default:
      return "application/octet-stream";
  }
};

const maskLastFour = (value: string): string => {
  if (!value) {
    return "missing";
  }

  return `***${value.slice(-4)}`;
};

const sleep = async (delayMs: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
};

const isTransientUploadError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  const errorName = error instanceof Error ? error.name : "";

  return [
    "ENOTFOUND",
    "ECONNRESET",
    "EAI_AGAIN",
    "ETIMEDOUT",
    "socket hang up",
    "timeout",
    "timed out",
    "RequestTimeout",
    "NetworkingError",
    "TimeoutError",
    "TooManyRequests",
    "SlowDown",
    "InternalError",
    "ServiceUnavailable"
  ].some((pattern) => message.includes(pattern) || errorName.includes(pattern));
};

const isClockSkewError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("request time and the server's time is too large");
};

const withRetry = async <T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const canRetry = attempt < options.attempts && (isTransientUploadError(error) || isClockSkewError(error));
      if (!canRetry) {
        throw error;
      }

      const backoffMs = Math.min(options.baseDelayMs * 2 ** (attempt - 1), options.maxDelayMs);
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(
        `Retrying ${options.operationLabel} after attempt ${attempt}/${options.attempts} ` +
        `failed (${reason}). Waiting ${backoffMs}ms.`
      );
      await sleep(backoffMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

const probeClockSkew = async (endpoint: string): Promise<void> => {
  await new Promise<void>((resolve) => {
    const request = https.request(endpoint, {method: "HEAD", timeout: 10_000}, (response) => {
      const headerValue = response.headers.date;
      if (!headerValue) {
        console.warn("Clock skew check could not read a Date header from the R2 endpoint.");
        response.resume();
        resolve();
        return;
      }

      const serverTimeMs = Date.parse(headerValue);
      if (Number.isNaN(serverTimeMs)) {
        console.warn("Clock skew check received an invalid Date header from the R2 endpoint.");
        response.resume();
        resolve();
        return;
      }

      const skewMs = Math.abs(Date.now() - serverTimeMs);
      if (skewMs >= CLOCK_SKEW_WARNING_MS) {
        console.warn(
          `Clock skew warning: local time differs from the R2 endpoint by about ${Math.round(skewMs / 1000)} seconds. ` +
          "Uploads may fail until the system clock is corrected."
        );
      }

      response.resume();
      resolve();
    });

    request.on("timeout", () => {
      console.warn("Clock skew check timed out before upload. Continuing without a hard failure.");
      request.destroy();
      resolve();
    });

    request.on("error", (error) => {
      console.warn(
        `Clock skew check could not reach the R2 endpoint (${error instanceof Error ? error.message : String(error)}). ` +
        "Continuing without a hard failure."
      );
      resolve();
    });

    request.end();
  });
};

const toEndpointHost = (endpoint: string): string => {
  try {
    return new URL(endpoint).host;
  } catch {
    return endpoint;
  }
};

const walkFiles = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, {withFileTypes: true});
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walkFiles(fullPath);
    }
    if (entry.isFile()) {
      return [fullPath];
    }
    return [];
  }));

  return files.flat();
};

const discoverLibraryAssets = async (sourceRoot: string): Promise<LocalAsset[]> => {
  const categoryEntries = await readdir(sourceRoot, {withFileTypes: true});
  const categoryDirs = categoryEntries.filter((entry) => entry.isDirectory());
  if (categoryDirs.length === 0) {
    throw new Error(`No category directories were found under ${sourceRoot}.`);
  }

  const collisions = new Map<string, string>();
  const discovered: LocalAsset[] = [];

  for (const categoryEntry of categoryDirs) {
    const category = categoryEntry.name;
    const categorySlug = slugify(category);
    const categoryPath = path.join(sourceRoot, categoryEntry.name);
    const files = await walkFiles(categoryPath);

    for (const absolutePath of files) {
      const extension = path.extname(absolutePath).toLowerCase();
      const baseName = path.basename(absolutePath, extension);
      const trackSlug = slugify(baseName);
      if (!trackSlug) {
        continue;
      }

      const fileStat = await stat(absolutePath);
      let kind: UploadKind | null = null;
      let objectKey = "";

      if (TRACK_EXTENSIONS.has(extension)) {
        kind = "mp3";
        objectKey = `music-originals/${categorySlug}/${trackSlug}${extension}`;
      } else if (THUMBNAIL_EXTENSIONS.has(extension)) {
        kind = "thumbnail";
        objectKey = `music-thumbnails/${categorySlug}/${trackSlug}${extension}`;
      }

      if (!kind) {
        continue;
      }

      const existingPath = collisions.get(objectKey);
      if (existingPath && existingPath !== absolutePath) {
        throw new Error(
          `Slug collision detected for ${objectKey} between ${existingPath} and ${absolutePath}. ` +
          "Rename one of the files before uploading."
        );
      }
      collisions.set(objectKey, absolutePath);

      discovered.push({
        kind,
        absolutePath,
        category,
        categorySlug,
        title: baseName,
        trackSlug,
        extension,
        objectKey,
        fileSizeBytes: fileStat.size
      });
    }
  }

  return discovered.sort((left, right) => left.objectKey.localeCompare(right.objectKey));
};

const getEffectiveEnv = (): EffectiveMusicUploadEnv => {
  const env = loadEnv();
  const cloudflareAccountId = env.CLOUDFLARE_ACCOUNT_ID.trim();
  const r2AccountId = env.R2_ACCOUNT_ID.trim();
  const accessKeyId = env.R2_ACCESS_KEY_ID.trim();
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY.trim();
  const bucketName = env.R2_BUCKET_NAME.trim();
  const endpoint = (env.R2_ENDPOINT.trim() || `https://${cloudflareAccountId || r2AccountId}.r2.cloudflarestorage.com`).trim();

  return {
    cloudflareAccountId,
    r2AccountId,
    endpoint,
    accessKeyId,
    secretAccessKey,
    bucketName,
    musicLibraryPath: env.MUSIC_LIBRARY_PATH.trim()
  };
};

const createR2Client = (effectiveEnv: EffectiveMusicUploadEnv): S3Client => {
  return new S3Client({
    region: "auto",
    endpoint: effectiveEnv.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: effectiveEnv.accessKeyId,
      secretAccessKey: effectiveEnv.secretAccessKey
    }
  });
};

const listExistingObjects = async (client: S3Client, bucket: string, prefix: string): Promise<Map<string, number>> => {
  const results = new Map<string, number>();
  let continuationToken: string | undefined;

  do {
    const response = await withRetry(() => client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken
    })), {
      attempts: 5,
      baseDelayMs: 1_000,
      maxDelayMs: 12_000,
      operationLabel: `ListObjectsV2(${prefix})`
    });

    for (const entry of response.Contents ?? []) {
      if (entry.Key) {
        results.set(entry.Key, Number(entry.Size ?? 0));
      }
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return results;
};

const runDoctor = async ({
  client,
  effectiveEnv,
  doctorWrite
}: {
  client: S3Client;
  effectiveEnv: EffectiveMusicUploadEnv;
  doctorWrite: boolean;
}): Promise<void> => {
  const doctorResult: Record<string, unknown> = {
    env: {
      CLOUDFLARE_API_TOKEN: Boolean(process.env.CLOUDFLARE_API_TOKEN?.trim()),
      CLOUDFLARE_ACCOUNT_ID: Boolean(effectiveEnv.cloudflareAccountId),
      R2_ACCOUNT_ID: Boolean(effectiveEnv.r2AccountId),
      R2_ENDPOINT: Boolean(effectiveEnv.endpoint),
      R2_ACCESS_KEY_ID: Boolean(effectiveEnv.accessKeyId),
      R2_SECRET_ACCESS_KEY: Boolean(effectiveEnv.secretAccessKey),
      R2_BUCKET_NAME: Boolean(effectiveEnv.bucketName)
    },
    accountIdLast4: maskLastFour(effectiveEnv.cloudflareAccountId || effectiveEnv.r2AccountId),
    endpointHost: toEndpointHost(effectiveEnv.endpoint),
    bucketName: effectiveEnv.bucketName
  };

  try {
    const response = await client.send(new HeadBucketCommand({
      Bucket: effectiveEnv.bucketName
    }));
    doctorResult.headBucket = {
      success: true,
      httpStatusCode: response.$metadata.httpStatusCode ?? null
    };
  } catch (error) {
    doctorResult.headBucket = {
      success: false,
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error)
    };
  }

  try {
    const response = await client.send(new ListObjectsV2Command({
      Bucket: effectiveEnv.bucketName,
      Prefix: "music-originals/",
      MaxKeys: 1
    }));
    doctorResult.listObjectsV2 = {
      success: true,
      httpStatusCode: response.$metadata.httpStatusCode ?? null
    };
  } catch (error) {
    doctorResult.listObjectsV2 = {
      success: false,
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error)
    };
  }

  if (doctorWrite) {
    try {
      const key = `music-previews/__doctor__/music-upload-doctor-${Date.now()}.txt`;
      const response = await client.send(new PutObjectCommand({
        Bucket: effectiveEnv.bucketName,
        Key: key,
        Body: "doctor write probe",
        ContentType: "text/plain"
      }));
      doctorResult.putObject = {
        success: true,
        key,
        httpStatusCode: response.$metadata.httpStatusCode ?? null
      };
    } catch (error) {
      doctorResult.putObject = {
        success: false,
        name: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }

  console.log(JSON.stringify(doctorResult, null, 2));
};

const uploadAssets = async ({
  client,
  bucket,
  assets,
  dryRun,
  checkRemote,
  endpoint
}: {
  client: S3Client;
  bucket: string;
  assets: LocalAsset[];
  dryRun: boolean;
  checkRemote: boolean;
  endpoint: string;
}): Promise<{
  summary: UploadSummary;
  uploadedOrPresentKeys: Set<string>;
}> => {
  const summary: UploadSummary = {
    totalMp3sFound: assets.filter((asset) => asset.kind === "mp3").length,
    totalThumbnailsFound: assets.filter((asset) => asset.kind === "thumbnail").length,
    uploaded: 0,
    skipped: 0,
    failed: 0
  };
  const uploadedOrPresentKeys = new Set<string>();

  if (!dryRun) {
    if (MAX_UPLOAD_CONCURRENCY !== 1) {
      console.warn(`Upload concurrency is ${MAX_UPLOAD_CONCURRENCY}, but this script is currently running sequentially.`);
    }
    await probeClockSkew(endpoint);
  }

  const existingOriginals = checkRemote
    ? await listExistingObjects(client, bucket, "music-originals/")
    : new Map<string, number>();
  const existingThumbnails = checkRemote
    ? await listExistingObjects(client, bucket, "music-thumbnails/")
    : new Map<string, number>();

  for (const asset of assets) {
    const existingSize = checkRemote
      ? (asset.kind === "mp3" ? existingOriginals : existingThumbnails).get(asset.objectKey)
      : undefined;
    if (checkRemote && existingSize === asset.fileSizeBytes) {
      summary.skipped += 1;
      uploadedOrPresentKeys.add(asset.objectKey);
      continue;
    }

    if (dryRun) {
      summary.uploaded += 1;
      uploadedOrPresentKeys.add(asset.objectKey);
      continue;
    }

    try {
      const body = await readFile(asset.absolutePath);
      await withRetry(() => client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: asset.objectKey,
        Body: body,
        ContentType: detectContentType(asset.extension)
      })), {
        attempts: 5,
        baseDelayMs: 1_000,
        maxDelayMs: 12_000,
        operationLabel: `PutObject(${asset.objectKey})`
      });
      summary.uploaded += 1;
      uploadedOrPresentKeys.add(asset.objectKey);
    } catch (error) {
      summary.failed += 1;
      if (isClockSkewError(error)) {
        console.error(
          `UPLOAD FAILED ${asset.objectKey}: clock skew was reported by R2. ` +
          "Check the local system clock before retrying again."
        );
        continue;
      }
      console.error(`UPLOAD FAILED ${asset.objectKey}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    summary,
    uploadedOrPresentKeys
  };
};

const buildCatalog = ({
  assets,
  uploadedOrPresentKeys
}: {
  assets: LocalAsset[];
  uploadedOrPresentKeys: Set<string>;
}): MusicCatalogEntry[] => {
  const thumbnailMap = new Map<string, string>();

  const thumbnailAssets = assets
    .filter((asset) => asset.kind === "thumbnail" && uploadedOrPresentKeys.has(asset.objectKey))
    .sort((left, right) => {
      const leftPriority = THUMBNAIL_PRIORITY.indexOf(left.extension);
      const rightPriority = THUMBNAIL_PRIORITY.indexOf(right.extension);
      return (leftPriority === -1 ? 999 : leftPriority) - (rightPriority === -1 ? 999 : rightPriority);
    });

  for (const asset of thumbnailAssets) {
    const thumbnailId = `${asset.categorySlug}/${asset.trackSlug}`;
    if (!thumbnailMap.has(thumbnailId)) {
      thumbnailMap.set(thumbnailId, asset.objectKey);
    }
  }

  return assets
    .filter((asset) => asset.kind === "mp3")
    .map((asset) => ({
      id: `${asset.categorySlug}/${asset.trackSlug}`,
      title: asset.title,
      category: asset.category,
      categorySlug: asset.categorySlug,
      originalObjectKey: asset.objectKey,
      thumbnailObjectKey: thumbnailMap.get(`${asset.categorySlug}/${asset.trackSlug}`) ?? null,
      duration: null,
      fileSizeBytes: asset.fileSizeBytes
    }));
};

const main = async (): Promise<void> => {
  if (hasFlag("--help")) {
    printUsage();
    return;
  }

  const effectiveEnv = getEffectiveEnv();
  const doctor = hasFlag("--doctor");
  const doctorWrite = hasFlag("--doctor-write");
  const dryRun = hasFlag("--dryRun");
  const checkRemote = hasFlag("--checkRemote") || !dryRun;

  if (doctor && dryRun) {
    throw new Error("--doctor and --dryRun cannot be used together.");
  }

  const backendRoot = process.cwd();
  const workspaceRoot = path.resolve(backendRoot, "..");
  const sourceRootArg = readArg("--sourceRoot") ?? effectiveEnv.musicLibraryPath;
  if (!sourceRootArg.trim()) {
    throw new Error("Missing music library source path. Provide --sourceRoot or set MUSIC_LIBRARY_PATH.");
  }

  const sourceRoot = resolveMaybeRelative(sourceRootArg.trim(), workspaceRoot);
  const catalogPath = resolveMaybeRelative(
    readArg("--catalogPath") ?? path.join(sourceRoot, "music-catalog.json"),
    workspaceRoot
  );
  const cloudflareAccountId = effectiveEnv.cloudflareAccountId || requireEnv("CLOUDFLARE_ACCOUNT_ID");
  const r2AccountId = effectiveEnv.r2AccountId || requireEnv("R2_ACCOUNT_ID");
  const bucket = effectiveEnv.bucketName || requireEnv("R2_BUCKET_NAME");
  const endpoint = effectiveEnv.endpoint || `https://${cloudflareAccountId || r2AccountId}.r2.cloudflarestorage.com`;
  const client = createR2Client({
    ...effectiveEnv,
    cloudflareAccountId,
    r2AccountId,
    bucketName: bucket,
    endpoint
  });

  if (doctor) {
    await runDoctor({
      client,
      effectiveEnv: {
        ...effectiveEnv,
        cloudflareAccountId,
        r2AccountId,
        bucketName: bucket,
        endpoint
      },
      doctorWrite
    });
    return;
  }

  const assets = await discoverLibraryAssets(sourceRoot);
  const {summary, uploadedOrPresentKeys} = await uploadAssets({
    client,
    bucket,
    assets,
    dryRun,
    checkRemote,
    endpoint
  });

  const catalog = buildCatalog({
    assets,
    uploadedOrPresentKeys
  });
  await mkdir(path.dirname(catalogPath), {recursive: true});
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf-8");

  console.log(JSON.stringify({
    bucket,
    endpointHost: toEndpointHost(endpoint),
    sourceRoot,
    catalogPath,
    dryRun,
    checkRemote,
    totalMp3sFound: summary.totalMp3sFound,
    totalThumbnailsFound: summary.totalThumbnailsFound,
    uploaded: summary.uploaded,
    skipped: summary.skipped,
    failed: summary.failed,
    plannedObjectKeys: dryRun ? assets.map((asset) => asset.objectKey) : undefined
  }, null, 2));
};

await main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
