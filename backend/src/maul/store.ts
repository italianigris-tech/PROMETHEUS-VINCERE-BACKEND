import {appendFile, mkdir, readFile, rm, writeFile} from "node:fs/promises";
import path from "node:path";

import {
  maulArtifactRecordSchema,
  maulAuditEventSchema,
  maulProjectSchema,
  type MaulArtifactRecord,
  type MaulAuditEvent,
  type MaulProject
} from "@prometheus/shared-types";

const isMissingFile = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(path.dirname(filePath), {recursive: true});
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

export class MaulProjectStore {
  public constructor(public readonly rootDir: string) {}

  public maulRootDir(): string {
    return path.join(this.rootDir, "maul");
  }

  public projectsRootDir(): string {
    return path.join(this.maulRootDir(), "projects");
  }

  public projectDir(projectId: string): string {
    return path.join(this.projectsRootDir(), projectId);
  }

  public projectFilePath(projectId: string): string {
    return path.join(this.projectDir(projectId), "project.json");
  }

  public artifactFilePath(projectId: string, artifactId: string): string {
    return path.join(this.projectDir(projectId), "artifacts", `${artifactId}.json`);
  }

  public artifactOwnerFilePath(artifactId: string): string {
    return path.join(this.maulRootDir(), "artifact-index", `${artifactId}.json`);
  }

  public auditFilePath(projectId: string): string {
    return path.join(this.projectDir(projectId), "audit.ndjson");
  }

  public referenceSourceDir(projectId: string): string {
    return path.join(this.projectDir(projectId), "reference-sources");
  }

  public referenceSourceBytesPath(projectId: string, fileId: string): string {
    return path.join(this.referenceSourceDir(projectId), `${fileId}.bin`);
  }

  public referenceSourceMetadataPath(projectId: string, fileId: string): string {
    return path.join(this.referenceSourceDir(projectId), `${fileId}.json`);
  }

  public exportDir(projectId: string): string {
    return path.join(this.projectDir(projectId), "exports");
  }

  public exportBytesPath(projectId: string, fileId: string): string {
    return path.join(this.exportDir(projectId), `${fileId}.mp4`);
  }

  public exportMetadataPath(projectId: string, fileId: string): string {
    return path.join(this.exportDir(projectId), `${fileId}.json`);
  }

  public previewDir(projectId: string): string {
    return path.join(this.projectDir(projectId), "previews");
  }

  public previewBytesPath(projectId: string, fileId: string): string {
    return path.join(this.previewDir(projectId), `${fileId}.mp4`);
  }

  public previewMetadataPath(projectId: string, fileId: string): string {
    return path.join(this.previewDir(projectId), `${fileId}.json`);
  }

  public previewFramePath(
    projectId: string,
    fileId: string,
    frameId: string,
  ): string {
    return path.join(this.previewDir(projectId), `${fileId}.${frameId}.png`);
  }

  public thumbnailDir(projectId: string): string {
    return path.join(this.projectDir(projectId), "thumbnails");
  }

  public thumbnailBytesPath(projectId: string, fileId: string): string {
    return path.join(this.thumbnailDir(projectId), `${fileId}.bin`);
  }

  public thumbnailMetadataPath(projectId: string, fileId: string): string {
    return path.join(this.thumbnailDir(projectId), `${fileId}.json`);
  }

  public async initialize(): Promise<void> {
    await mkdir(this.projectsRootDir(), {recursive: true});
    await mkdir(path.join(this.maulRootDir(), "artifact-index"), {recursive: true});
  }

  public async createProject(
    project: MaulProject,
    sourceAsset: MaulArtifactRecord,
    events: MaulAuditEvent[]
  ): Promise<void> {
    const parsedProject = maulProjectSchema.parse(project);
    const parsedSource = maulArtifactRecordSchema.parse(sourceAsset);
    if (parsedSource.artifactType !== "source_asset") {
      throw new Error("A MAUL project must begin with a source asset.");
    }

    await mkdir(path.join(this.projectDir(project.id), "artifacts"), {recursive: true});
    await writeJson(this.projectFilePath(project.id), parsedProject);
    await this.writeArtifact(parsedSource);
    for (const event of events) {
      await this.appendAuditEvent(event);
    }
  }

  public async readProject(projectId: string): Promise<MaulProject> {
    const raw = await readFile(this.projectFilePath(projectId), "utf8");
    return maulProjectSchema.parse(JSON.parse(raw) as unknown);
  }

  public async writeProject(project: MaulProject): Promise<void> {
    await writeJson(this.projectFilePath(project.id), maulProjectSchema.parse(project));
  }

  public async writeArtifact(artifact: MaulArtifactRecord): Promise<void> {
    const parsed = maulArtifactRecordSchema.parse(artifact);
    await writeJson(
      this.artifactFilePath(parsed.lineage.projectId, parsed.artifactId),
      parsed
    );
    await writeJson(this.artifactOwnerFilePath(parsed.artifactId), {
      artifactId: parsed.artifactId,
      projectId: parsed.lineage.projectId
    });
  }

  public async readArtifact(
    projectId: string,
    artifactId: string
  ): Promise<MaulArtifactRecord> {
    const raw = await readFile(this.artifactFilePath(projectId, artifactId), "utf8");
    return maulArtifactRecordSchema.parse(JSON.parse(raw) as unknown);
  }

  public async readArtifacts(project: MaulProject): Promise<MaulArtifactRecord[]> {
    return Promise.all(
      project.artifactIds.map((artifactId) => this.readArtifact(project.id, artifactId))
    );
  }

  public async readArtifactOwner(artifactId: string): Promise<string | null> {
    try {
      const raw = await readFile(this.artifactOwnerFilePath(artifactId), "utf8");
      const parsed = JSON.parse(raw) as {artifactId?: unknown; projectId?: unknown};
      if (parsed.artifactId !== artifactId || typeof parsed.projectId !== "string") {
        throw new Error(`Invalid artifact ownership index for ${artifactId}.`);
      }
      return parsed.projectId;
    } catch (error) {
      if (isMissingFile(error)) {
        return null;
      }
      throw error;
    }
  }

  public async appendAuditEvent(event: MaulAuditEvent): Promise<void> {
    const parsed = maulAuditEventSchema.parse(event);
    await mkdir(this.projectDir(parsed.projectId), {recursive: true});
    await appendFile(this.auditFilePath(parsed.projectId), `${JSON.stringify(parsed)}\n`, "utf8");
  }

  public async readAudit(projectId: string): Promise<MaulAuditEvent[]> {
    try {
      const raw = await readFile(this.auditFilePath(projectId), "utf8");
      return raw
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => maulAuditEventSchema.parse(JSON.parse(line) as unknown));
    } catch (error) {
      if (isMissingFile(error)) {
        return [];
      }
      throw error;
    }
  }

  public async writeReferenceFile({
    projectId,
    fileId,
    originalFilename,
    contentType,
    bytes
  }: {
    projectId: string;
    fileId: string;
    originalFilename: string;
    contentType: string;
    bytes: Buffer;
  }): Promise<void> {
    await mkdir(this.referenceSourceDir(projectId), {recursive: true});
    await writeFile(this.referenceSourceBytesPath(projectId, fileId), bytes);
    await writeJson(this.referenceSourceMetadataPath(projectId, fileId), {
      fileId,
      originalFilename,
      contentType,
      sizeBytes: bytes.length
    });
  }

  public async readReferenceFile(projectId: string, fileId: string): Promise<{
    fileId: string;
    originalFilename: string;
    contentType: string;
    sizeBytes: number;
    bytes: Buffer;
  }> {
    const metadata = JSON.parse(
      await readFile(this.referenceSourceMetadataPath(projectId, fileId), "utf8")
    ) as Record<string, unknown>;
    if (
      metadata.fileId !== fileId
      || typeof metadata.originalFilename !== "string"
      || typeof metadata.contentType !== "string"
      || typeof metadata.sizeBytes !== "number"
    ) {
      throw new Error(`Invalid MAUL reference file metadata for ${fileId}.`);
    }
    const bytes = await readFile(this.referenceSourceBytesPath(projectId, fileId));
    if (bytes.length !== metadata.sizeBytes) {
      throw new Error(`MAUL reference file ${fileId} failed its size integrity check.`);
    }
    return {
      fileId,
      originalFilename: metadata.originalFilename,
      contentType: metadata.contentType,
      sizeBytes: metadata.sizeBytes,
      bytes
    };
  }

  public async writeExportFile({
    projectId,
    fileId,
    filename,
    bytes,
    sha256
  }: {
    projectId: string;
    fileId: string;
    filename: string;
    bytes: Buffer;
    sha256: string;
  }): Promise<void> {
    await mkdir(this.exportDir(projectId), {recursive: true});
    await writeFile(this.exportBytesPath(projectId, fileId), bytes);
    await writeJson(this.exportMetadataPath(projectId, fileId), {
      fileId,
      filename,
      contentType: "video/mp4",
      sizeBytes: bytes.length,
      sha256
    });
  }

  public async readExportFile(projectId: string, fileId: string): Promise<{
    filename: string;
    contentType: "video/mp4";
    sizeBytes: number;
    sha256: string;
    bytes: Buffer;
  }> {
    const metadata = JSON.parse(
      await readFile(this.exportMetadataPath(projectId, fileId), "utf8")
    ) as Record<string, unknown>;
    if (
      metadata.fileId !== fileId
      || typeof metadata.filename !== "string"
      || metadata.contentType !== "video/mp4"
      || typeof metadata.sizeBytes !== "number"
      || typeof metadata.sha256 !== "string"
    ) {
      throw new Error(`Invalid MAUL export file metadata for ${fileId}.`);
    }
    const bytes = await readFile(this.exportBytesPath(projectId, fileId));
    if (bytes.length !== metadata.sizeBytes) {
      throw new Error(`MAUL export file ${fileId} failed its size integrity check.`);
    }
    return {
      filename: metadata.filename,
      contentType: "video/mp4",
      sizeBytes: metadata.sizeBytes,
      sha256: metadata.sha256,
      bytes
    };
  }

  public async writePreviewFile({
    projectId,
    fileId,
    bytes,
    sha256,
    frames,
  }: {
    projectId: string;
    fileId: string;
    bytes: Buffer;
    sha256: string;
    frames: Array<{
      frameId: string;
      outputMs: number;
      bytes: Buffer;
      sha256: string;
    }>;
  }): Promise<void> {
    await mkdir(this.previewDir(projectId), {recursive: true});
    await writeFile(this.previewBytesPath(projectId, fileId), bytes);
    await Promise.all(
      frames.map((frame) =>
        writeFile(
          this.previewFramePath(projectId, fileId, frame.frameId),
          frame.bytes,
        ),
      ),
    );
    await writeJson(this.previewMetadataPath(projectId, fileId), {
      fileId,
      contentType: "video/mp4",
      sizeBytes: bytes.length,
      sha256,
      frames: frames.map((frame) => ({
        frameId: frame.frameId,
        outputMs: frame.outputMs,
        contentType: "image/png",
        sizeBytes: frame.bytes.length,
        sha256: frame.sha256,
      })),
    });
  }

  public async readPreviewFile(projectId: string, fileId: string): Promise<{
    contentType: "video/mp4";
    sizeBytes: number;
    sha256: string;
    bytes: Buffer;
  }> {
    const metadata = JSON.parse(
      await readFile(this.previewMetadataPath(projectId, fileId), "utf8"),
    ) as Record<string, unknown>;
    if (
      metadata.fileId !== fileId ||
      metadata.contentType !== "video/mp4" ||
      typeof metadata.sizeBytes !== "number" ||
      typeof metadata.sha256 !== "string"
    ) {
      throw new Error(`Invalid MAUL preview file metadata for ${fileId}.`);
    }
    const bytes = await readFile(this.previewBytesPath(projectId, fileId));
    if (bytes.length !== metadata.sizeBytes) {
      throw new Error(`MAUL preview file ${fileId} failed its size integrity check.`);
    }
    return {
      contentType: "video/mp4",
      sizeBytes: metadata.sizeBytes,
      sha256: metadata.sha256,
      bytes,
    };
  }

  public async readPreviewFrame(
    projectId: string,
    fileId: string,
    frameId: string,
  ): Promise<{contentType: "image/png"; bytes: Buffer}> {
    return {
      contentType: "image/png",
      bytes: await readFile(this.previewFramePath(projectId, fileId, frameId)),
    };
  }

  public async writeThumbnailFile({
    projectId,
    fileId,
    filename,
    contentType,
    bytes,
    sha256
  }: {
    projectId: string;
    fileId: string;
    filename: string;
    contentType: "image/png" | "image/jpeg" | "image/svg+xml";
    bytes: Buffer;
    sha256: string;
  }): Promise<void> {
    await mkdir(this.thumbnailDir(projectId), {recursive: true});
    await writeFile(this.thumbnailBytesPath(projectId, fileId), bytes);
    await writeJson(this.thumbnailMetadataPath(projectId, fileId), {
      fileId,
      filename,
      contentType,
      sizeBytes: bytes.length,
      sha256
    });
  }

  public async readThumbnailFile(projectId: string, fileId: string): Promise<{
    filename: string;
    contentType: "image/png" | "image/jpeg" | "image/svg+xml";
    sizeBytes: number;
    sha256: string;
    bytes: Buffer;
  }> {
    const metadata = JSON.parse(
      await readFile(this.thumbnailMetadataPath(projectId, fileId), "utf8")
    ) as Record<string, unknown>;
    if (
      metadata.fileId !== fileId
      || typeof metadata.filename !== "string"
      || !["image/png", "image/jpeg", "image/svg+xml"].includes(String(metadata.contentType))
      || typeof metadata.sizeBytes !== "number"
      || typeof metadata.sha256 !== "string"
    ) {
      throw new Error(`Invalid MAUL thumbnail metadata for ${fileId}.`);
    }
    const bytes = await readFile(this.thumbnailBytesPath(projectId, fileId));
    if (bytes.length !== metadata.sizeBytes) {
      throw new Error(`MAUL thumbnail ${fileId} failed its size integrity check.`);
    }
    return {
      filename: metadata.filename,
      contentType: metadata.contentType as "image/png" | "image/jpeg" | "image/svg+xml",
      sizeBytes: metadata.sizeBytes,
      sha256: metadata.sha256,
      bytes
    };
  }

  public async deleteProjectPermanently(project: MaulProject): Promise<void> {
    const projectsRoot = path.resolve(this.projectsRootDir());
    const target = path.resolve(this.projectDir(project.id));
    const relative = path.relative(projectsRoot, target);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("Refusing unsafe MAUL project deletion target.");
    }
    await rm(target, {recursive: true, force: false});
    for (const artifactId of project.artifactIds) {
      await rm(this.artifactOwnerFilePath(artifactId), {force: true});
    }
  }
}
