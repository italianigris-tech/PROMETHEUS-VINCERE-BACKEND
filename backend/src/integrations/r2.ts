import {randomUUID} from "node:crypto";
import {createWriteStream} from "node:fs";
import {mkdir, stat} from "node:fs/promises";
import path from "node:path";
import {pipeline as streamPipeline} from "node:stream/promises";

import {
  AbortMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import {getSignedUrl} from "@aws-sdk/s3-request-presigner";

import type {BackendEnv} from "../config";

export type R2UploadUrlInput = {
  filename: string;
  contentType: string;
  userId?: string;
};

export type R2DownloadInput = {
  bucket: string;
  key: string;
  destinationPath: string;
};

export type R2UploadUrlResult = {
  uploadUrl: string;
  key: string;
  bucket: string;
  publicUrl: string | null;
  expiresInSeconds: number;
  requiredHeaders: {
    "Content-Type": string;
  };
};

export type R2TransferService = {
  isConfigured: boolean;
  createUploadUrl(input: R2UploadUrlInput): Promise<R2UploadUrlResult>;
  downloadObject(input: R2DownloadInput): Promise<{
    bucket: string;
    key: string;
    destinationPath: string;
    sizeBytes: number;
  }>;
  cleanupSourceUpload?(input: {bucket: string; key: string; uploadId?: string | null}): Promise<void>;
};

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const sanitizeSegment = (value: string, fallback: string): string => {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.length > 0 ? cleaned : fallback;
};

const sanitizeFileName = (value: string): string => {
  const fileName = path.basename(value.trim());
  return sanitizeSegment(fileName, "upload.bin");
};

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

const resolvePublicUrlBase = (env: BackendEnv): string => {
  const base = env.R2_PUBLIC_UPLOADS_BASE.trim();
  return base ? trimTrailingSlash(base) : "";
};

const buildObjectKey = (input: R2UploadUrlInput): string => {
  const userId = sanitizeSegment(input.userId?.trim() || "anonymous", "anonymous");
  const fileName = sanitizeFileName(input.filename);
  return `uploads/${userId}/${Date.now()}-${randomUUID()}-${fileName}`;
};

export const createR2TransferService = (env: BackendEnv): R2TransferService => {
  const endpoint = resolveR2Endpoint(env);
  const configured =
    Boolean(endpoint) &&
    Boolean(env.R2_ACCESS_KEY_ID.trim()) &&
    Boolean(env.R2_SECRET_ACCESS_KEY.trim()) &&
    Boolean(env.R2_UPLOAD_BUCKET.trim());

  const client = configured
    ? new S3Client({
        region: "auto",
        endpoint,
        credentials: {
          accessKeyId: env.R2_ACCESS_KEY_ID.trim(),
          secretAccessKey: env.R2_SECRET_ACCESS_KEY.trim()
        }
      })
    : null;

  const ensureConfigured = (): S3Client => {
    if (!client) {
      throw new Error(
        "R2 upload is not configured. Set R2_ENDPOINT or R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_UPLOAD_BUCKET."
      );
    }

    return client;
  };

  return {
    isConfigured: configured,
    async createUploadUrl(input) {
      const s3 = ensureConfigured();
      const key = buildObjectKey(input);
      const command = new PutObjectCommand({
        Bucket: env.R2_UPLOAD_BUCKET.trim(),
        Key: key,
        ContentType: input.contentType
      });
      const uploadUrl = await getSignedUrl(s3, command, {
        expiresIn: env.R2_UPLOAD_URL_EXPIRES_SECONDS
      });

      const publicBase = resolvePublicUrlBase(env);
      return {
        uploadUrl,
        key,
        bucket: env.R2_UPLOAD_BUCKET.trim(),
        publicUrl: publicBase ? `${publicBase}/${key}` : null,
        expiresInSeconds: env.R2_UPLOAD_URL_EXPIRES_SECONDS,
        requiredHeaders: {
          "Content-Type": input.contentType
        }
      };
    },
    async downloadObject(input) {
      const s3 = ensureConfigured();
      await mkdir(path.dirname(input.destinationPath), {recursive: true});

      const response = await s3.send(
        new GetObjectCommand({
          Bucket: input.bucket,
          Key: input.key
        })
      );

      const body = response.Body as NodeJS.ReadableStream | undefined;
      if (!body) {
        throw new Error(`R2 object ${input.bucket}/${input.key} did not return a readable body.`);
      }

      await streamPipeline(body, createWriteStream(input.destinationPath));

      const written = await stat(input.destinationPath);
      return {
        bucket: input.bucket,
        key: input.key,
        destinationPath: input.destinationPath,
        sizeBytes: written.size
      };
    },
    async cleanupSourceUpload(input) {
      const s3 = ensureConfigured();
      if (input.uploadId) {
        try {
          await s3.send(new AbortMultipartUploadCommand({
            Bucket: input.bucket,
            Key: input.key,
            UploadId: input.uploadId
          }));
        } catch (error) {
          const status = (error as {$metadata?: {httpStatusCode?: number}}).$metadata?.httpStatusCode;
          if (status !== 404) throw error;
        }
      }
      await s3.send(new DeleteObjectCommand({Bucket: input.bucket, Key: input.key}));
    }
  };
};
