import {createReadStream} from "node:fs";
import {copyFile, mkdir, stat} from "node:fs/promises";
import http, {type Server} from "node:http";
import path from "node:path";

import {type AssetResolver, type MediaReference, MediaReferenceSchema} from "@prometheus/shared-types";

type LocalAssetResolverOptions = {
  publicDir: string;
  uploadDir: string;
  port?: number;
};

const MEDIA_CONTENT_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

const contentTypeOf = (filePath: string): string => MEDIA_CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";

const safeSegment = (value: string): string => {
  const sanitized = value
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/^[.-]+|[.-]+$/g, "");

  return sanitized || "asset";
};

const ensureFile = async (filePath: string): Promise<void> => {
  const stats = await stat(filePath);
  if (!stats.isFile()) {
    throw new Error(`Media source is not a file: ${filePath}`);
  }
};

export class LocalAssetResolver implements AssetResolver {
  private readonly publicDir: string;
  private readonly uploadDir: string;
  private readonly requestedPort?: number;
  private readonly references = new Map<string, MediaReference>();
  private server: Server | null = null;
  private serverPort: number | null = null;

  constructor(options: LocalAssetResolverOptions) {
    this.publicDir = path.resolve(options.publicDir);
    this.uploadDir = path.resolve(options.uploadDir);
    this.requestedPort = options.port;
  }

  async registerUpload(sourcePath: string, jobId: string): Promise<MediaReference> {
    const sourceFilePath = path.resolve(sourcePath);
    await ensureFile(sourceFilePath);

    const safeJobId = safeSegment(jobId);
    const safeFileName = safeSegment(path.basename(sourceFilePath));
    const assetId = `asset://source-video/${safeJobId}/${safeFileName}`;
    const jobUploadDir = path.join(this.uploadDir, safeJobId);
    const filePath = path.join(jobUploadDir, safeFileName);

    await mkdir(jobUploadDir, {recursive: true});
    await copyFile(sourceFilePath, filePath);
    const fileStats = await stat(filePath);

    const browserUrl = this.requestedPort === undefined
      ? await this.registerCopyToPublic({safeJobId, safeFileName, filePath})
      : await this.registerHttpServed({safeJobId, safeFileName});

    const reference = MediaReferenceSchema.parse({
      assetId,
      browserUrl,
      filePath,
      contentType: contentTypeOf(filePath),
      sizeBytes: fileStats.size,
    });
    this.references.set(assetId, reference);
    return reference;
  }

  resolveBrowser(assetId: string): string {
    return this.referenceOf(assetId).browserUrl;
  }

  resolveFile(assetId: string): string {
    return this.referenceOf(assetId).filePath;
  }

  async close(): Promise<void> {
    if (!this.server) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      this.server?.close((error) => error ? reject(error) : resolve());
    });
    this.server = null;
    this.serverPort = null;
  }

  private referenceOf(assetId: string): MediaReference {
    const reference = this.references.get(assetId);
    if (!reference) {
      throw new Error(`Unknown media asset: ${assetId}`);
    }
    return reference;
  }

  private async registerCopyToPublic(input: {safeJobId: string; safeFileName: string; filePath: string}): Promise<string> {
    const publicUploadDir = path.join(this.publicDir, "uploads", input.safeJobId);
    const publicFilePath = path.join(publicUploadDir, input.safeFileName);
    await mkdir(publicUploadDir, {recursive: true});
    await copyFile(input.filePath, publicFilePath);
    return `/uploads/${input.safeJobId}/${input.safeFileName}`;
  }

  private async registerHttpServed(input: {safeJobId: string; safeFileName: string}): Promise<string> {
    await this.ensureServer();
    return `http://127.0.0.1:${this.serverPort}/uploads/${input.safeJobId}/${input.safeFileName}`;
  }

  private async ensureServer(): Promise<void> {
    if (this.server && this.serverPort !== null) {
      return;
    }

    await mkdir(this.uploadDir, {recursive: true});
    this.server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (!url.pathname.startsWith("/uploads/")) {
        res.writeHead(404);
        res.end();
        return;
      }

      const relativePath = decodeURIComponent(url.pathname.slice("/uploads/".length));
      const resolvedPath = path.resolve(this.uploadDir, relativePath);
      const relativeToUploadDir = path.relative(this.uploadDir, resolvedPath);
      if (relativeToUploadDir.startsWith("..") || path.isAbsolute(relativeToUploadDir)) {
        res.writeHead(403);
        res.end();
        return;
      }

      stat(resolvedPath)
        .then((stats) => {
          if (!stats.isFile()) {
            res.writeHead(404);
            res.end();
            return;
          }
          res.writeHead(200, {
            "Content-Type": contentTypeOf(resolvedPath),
            "Content-Length": String(stats.size),
            "Cache-Control": "no-store",
          });
          createReadStream(resolvedPath).pipe(res);
        })
        .catch(() => {
          res.writeHead(404);
          res.end();
        });
    });

    await new Promise<void>((resolve, reject) => {
      this.server?.once("error", reject);
      this.server?.listen(this.requestedPort ?? 0, "127.0.0.1", () => resolve());
    });

    const address = this.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Unable to determine local media server port.");
    }
    this.serverPort = address.port;
  }
}
