import {createHash} from "node:crypto";
import {createWriteStream} from "node:fs";
import {mkdir, stat, writeFile} from "node:fs/promises";
import path from "node:path";
import {pipeline as streamPipeline} from "node:stream/promises";

import type {BackendEnv} from "../../config";
import type {R2TransferService} from "../../integrations/r2";

export type RemoteAudioRole = "music" | "sfx" | "dialogue";

export type RemoteAudioCacheRequest = {
  source: string;
  cueId: string;
  role: RemoteAudioRole;
  cacheDir: string;
};

export type RemoteAudioCacheResult = {
  localPath: string;
  evidence: string[];
};

export type RemoteAudioCacheResolver = (
  input: RemoteAudioCacheRequest
) => Promise<RemoteAudioCacheResult>;

const sanitizeSegment = (value: string, fallback: string): string => {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || fallback;
};

const inferAudioExtension = (source: string): string => {
  const sourcePath = source.startsWith("r2://")
    ? source.slice("r2://".length)
    : source;
  const ext = path.extname(sourcePath.split("?")[0] ?? "").toLowerCase();
  return /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(ext) ? ext : ".audio";
};

const cachePathForSource = ({
  source,
  cueId,
  role,
  cacheDir
}: RemoteAudioCacheRequest): string => {
  const digest = createHash("sha256").update(source).digest("hex").slice(0, 16);
  const fileName = `${role}-${sanitizeSegment(cueId, "cue")}-${digest}${inferAudioExtension(source)}`;
  return path.join(cacheDir, fileName);
};

const assertCachedAudioExists = async (filePath: string, source: string): Promise<void> => {
  const fileStats = await stat(filePath).catch(() => null);
  if (!fileStats?.isFile() || fileStats.size <= 0) {
    throw new Error(`RemoteAudioCacheError: cached audio for ${source} was not written to ${filePath}.`);
  }
};

const parseR2Source = (
  source: string,
  env: BackendEnv
): {bucket: string; key: string} | null => {
  if (/^r2:\/\//i.test(source)) {
    const withoutScheme = source.replace(/^r2:\/\//i, "");
    const slashIndex = withoutScheme.indexOf("/");
    if (slashIndex <= 0) {
      throw new Error(`RemoteAudioCacheError: invalid R2 audio source ${source}.`);
    }
    return {
      bucket: withoutScheme.slice(0, slashIndex),
      key: withoutScheme.slice(slashIndex + 1)
    };
  }

  if (source.startsWith("music-originals/")) {
    const bucket = env.R2_BUCKET_NAME.trim() || env.R2_BUCKET.trim() || env.R2_UPLOAD_BUCKET.trim();
    if (!bucket) {
      throw new Error("RemoteAudioCacheError: music object key needs R2_BUCKET_NAME, R2_BUCKET, or R2_UPLOAD_BUCKET.");
    }
    return {
      bucket,
      key: source
    };
  }

  return null;
};

export const createRemoteAudioCacheResolver = ({
  env,
  r2Service,
  fetchImpl = fetch
}: {
  env: BackendEnv;
  r2Service: R2TransferService;
  fetchImpl?: typeof fetch;
}): RemoteAudioCacheResolver => {
  return async (input) => {
    const source = input.source.trim();
    if (!source) {
      throw new Error("RemoteAudioCacheError: empty remote audio source.");
    }

    await mkdir(input.cacheDir, {recursive: true});
    const localPath = cachePathForSource(input);
    const cachedStats = await stat(localPath).catch(() => null);
    if (cachedStats?.isFile() && cachedStats.size > 0) {
      return {
        localPath,
        evidence: [`Remote ${input.role} cue ${input.cueId} reused cached audio at ${localPath}.`]
      };
    }

    const r2Source = parseR2Source(source, env);
    if (r2Source) {
      await r2Service.downloadObject({
        bucket: r2Source.bucket,
        key: r2Source.key,
        destinationPath: localPath
      });
      await assertCachedAudioExists(localPath, source);
      return {
        localPath,
        evidence: [`Remote ${input.role} cue ${input.cueId} downloaded from R2 ${r2Source.bucket}/${r2Source.key}.`]
      };
    }

    if (/^https?:\/\//i.test(source)) {
      const response = await fetchImpl(source);
      if (!response.ok) {
        throw new Error(`RemoteAudioCacheError: failed to download ${source} (${response.status}).`);
      }

      const body = response.body as unknown as NodeJS.ReadableStream | null;
      if (body) {
        await streamPipeline(body, createWriteStream(localPath));
      } else {
        await writeFile(localPath, Buffer.from(await response.arrayBuffer()));
      }
      await assertCachedAudioExists(localPath, source);
      return {
        localPath,
        evidence: [`Remote ${input.role} cue ${input.cueId} downloaded over HTTP(S).`]
      };
    }

    throw new Error(`RemoteAudioCacheError: unsupported remote audio source ${source}.`);
  };
};
