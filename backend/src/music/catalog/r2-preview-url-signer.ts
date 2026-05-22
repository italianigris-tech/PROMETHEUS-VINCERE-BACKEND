import path from "node:path";

import {GetObjectCommand, S3Client} from "@aws-sdk/client-s3";
import {getSignedUrl} from "@aws-sdk/s3-request-presigner";

import {loadEnv, type BackendEnv} from "../../config";

export type SignedMusicPreviewUrlInput = {
  bucket: string;
  objectKey: string;
  ttlSeconds: number;
  contentType?: string;
  env?: BackendEnv;
};

export type SignedMusicPreviewUrlResult = {
  url: string;
  expiresAt: string;
  ttlSeconds: number;
};

export type MusicPreviewUrlSigner = (
  input: SignedMusicPreviewUrlInput
) => Promise<SignedMusicPreviewUrlResult>;

export type SignedMusicPreviewConfig = {
  enabled: boolean;
  configured: boolean;
  ttlSeconds: number;
};

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const resolveR2Endpoint = (env: BackendEnv): string => {
  const explicit = env.R2_ENDPOINT.trim();
  if (explicit) {
    return trimTrailingSlash(explicit);
  }

  const accountId = env.R2_ACCOUNT_ID.trim();
  if (accountId) {
    return `https://${accountId}.r2.cloudflarestorage.com`;
  }

  return "";
};

const inferContentType = (objectKey: string): string | undefined => {
  switch (path.extname(objectKey).toLowerCase()) {
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
      return "audio/wav";
    case ".m4a":
      return "audio/mp4";
    case ".ogg":
      return "audio/ogg";
    default:
      return undefined;
  }
};

export const getSignedMusicPreviewConfig = (env: BackendEnv): SignedMusicPreviewConfig => {
  const endpoint = resolveR2Endpoint(env);
  const configured = Boolean(endpoint) &&
    Boolean(env.R2_ACCESS_KEY_ID.trim()) &&
    Boolean(env.R2_SECRET_ACCESS_KEY.trim());

  return {
    enabled: env.MUSIC_R2_SIGNED_PREVIEW_URLS_ENABLED,
    configured,
    ttlSeconds: env.MUSIC_R2_SIGNED_PREVIEW_TTL_SECONDS
  };
};

export const createSignedMusicPreviewUrl: MusicPreviewUrlSigner = async (input) => {
  const env = input.env ?? loadEnv();
  const endpoint = resolveR2Endpoint(env);
  if (!endpoint || !env.R2_ACCESS_KEY_ID.trim() || !env.R2_SECRET_ACCESS_KEY.trim()) {
    throw new Error(
      "Signed music preview URLs are not configured. Set R2_ENDPOINT or R2_ACCOUNT_ID plus R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY."
    );
  }

  const ttlSeconds = Math.max(1, input.ttlSeconds);
  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID.trim(),
      secretAccessKey: env.R2_SECRET_ACCESS_KEY.trim()
    }
  });
  const url = await getSignedUrl(client, new GetObjectCommand({
    Bucket: input.bucket,
    Key: input.objectKey,
    ResponseContentType: input.contentType?.trim() || inferContentType(input.objectKey)
  }), {
    expiresIn: ttlSeconds
  });

  return {
    url,
    expiresAt: new Date(Date.now() + (ttlSeconds * 1000)).toISOString(),
    ttlSeconds
  };
};
