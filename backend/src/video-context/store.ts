import {createReadStream} from "node:fs";
import {appendFile, mkdir, readFile, rename, stat, writeFile} from "node:fs/promises";
import path from "node:path";

import {
  progressiveVideoContextEventSchema,
  progressiveVideoContextSnapshotSchema,
  renderGraphV2HandoffSchema,
  configurationDeltaSchema,
  type ConfigurationDelta,
  type ProgressiveVideoContextEvent,
  type ProgressiveVideoContextSnapshot,
  type RenderGraphV2Handoff
} from "./contracts";

export type VideoContextTextArtifactKey = "instructional-manual" | "frontend-briefing";

const SNAPSHOT_FILE_NAME = "context.json";
const EVENTS_FILE_NAME = "events.jsonl";
const RENDER_GRAPH_FILE_NAME = "render-graph.json";
const CONFIGURATION_DELTA_FILE_NAME = "configuration-delta.json";
const INSTRUCTIONAL_MANUAL_FILE_NAME = "instructional-manual.md";
const FRONTEND_BRIEFING_FILE_NAME = "frontend-briefing.md";

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(path.dirname(filePath), {recursive: true});
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
};

const readJson = async <T>(filePath: string): Promise<T> => JSON.parse(await readFile(filePath, "utf-8")) as T;

export class VideoContextStore {
  public constructor(private readonly storageRoot: string) {}

  public rootDir(): string {
    return path.join(this.storageRoot, "video-context");
  }

  public videoDir(videoId: string): string {
    return path.join(this.rootDir(), videoId);
  }

  public sourceDir(videoId: string): string {
    return path.join(this.videoDir(videoId), "source");
  }

  public transcriptChunksDir(videoId: string): string {
    return path.join(this.videoDir(videoId), "transcript-chunks");
  }

  public snapshotPath(videoId: string): string {
    return path.join(this.videoDir(videoId), SNAPSHOT_FILE_NAME);
  }

  public eventsPath(videoId: string): string {
    return path.join(this.videoDir(videoId), EVENTS_FILE_NAME);
  }

  public renderGraphPath(videoId: string): string {
    return path.join(this.videoDir(videoId), RENDER_GRAPH_FILE_NAME);
  }

  public configurationDeltaPath(videoId: string): string {
    return path.join(this.videoDir(videoId), CONFIGURATION_DELTA_FILE_NAME);
  }

  public textArtifactPath(videoId: string, key: VideoContextTextArtifactKey): string {
    return path.join(
      this.videoDir(videoId),
      key === "instructional-manual" ? INSTRUCTIONAL_MANUAL_FILE_NAME : FRONTEND_BRIEFING_FILE_NAME
    );
  }

  public async initialize(): Promise<void> {
    await mkdir(this.rootDir(), {recursive: true});
  }

  public async ensureVideoWorkspace(videoId: string): Promise<void> {
    await mkdir(this.sourceDir(videoId), {recursive: true});
  }

  public async persistSourceFile({
    videoId,
    sourcePath,
    fileName
  }: {
    videoId: string;
    sourcePath: string;
    fileName: string;
  }): Promise<string> {
    const destinationPath = path.join(this.sourceDir(videoId), fileName);
    await mkdir(path.dirname(destinationPath), {recursive: true});
    await rename(sourcePath, destinationPath);
    return destinationPath;
  }

  public async writeSourceBuffer({
    videoId,
    fileName,
    buffer
  }: {
    videoId: string;
    fileName: string;
    buffer: Buffer;
  }): Promise<string> {
    const destinationPath = path.join(this.sourceDir(videoId), fileName);
    await mkdir(path.dirname(destinationPath), {recursive: true});
    await writeFile(destinationPath, buffer);
    return destinationPath;
  }

  public createSourceReadStream(filePath: string) {
    return createReadStream(filePath);
  }

  public async sourceStats(filePath: string): Promise<{size: number}> {
    const stats = await stat(filePath);
    return {
      size: stats.size
    };
  }

  public async writeSnapshot(snapshot: ProgressiveVideoContextSnapshot): Promise<void> {
    const parsed = progressiveVideoContextSnapshotSchema.parse(snapshot);
    const internalSourcePath = (snapshot as ProgressiveVideoContextSnapshot & {sourcePath?: string}).sourcePath;
    await writeJson(this.snapshotPath(snapshot.videoId), {
      ...parsed,
      ...(internalSourcePath ? {sourcePath: internalSourcePath} : {})
    });
  }

  public async readSnapshot(videoId: string): Promise<ProgressiveVideoContextSnapshot & {sourcePath?: string}> {
    const raw = await readJson<ProgressiveVideoContextSnapshot & {sourcePath?: string}>(this.snapshotPath(videoId));
    const parsed = progressiveVideoContextSnapshotSchema.parse(raw);
    return raw.sourcePath ? {...parsed, sourcePath: raw.sourcePath} : parsed;
  }

  public async appendEvent(event: ProgressiveVideoContextEvent): Promise<void> {
    const parsed = progressiveVideoContextEventSchema.parse(event);
    await mkdir(path.dirname(this.eventsPath(parsed.videoId)), {recursive: true});
    await appendFile(this.eventsPath(parsed.videoId), `${JSON.stringify(parsed)}\n`, "utf-8");
  }

  public async readEvents(videoId: string, afterEventId?: string): Promise<ProgressiveVideoContextEvent[]> {
    let raw = "";
    try {
      raw = await readFile(this.eventsPath(videoId), "utf-8");
    } catch {
      return [];
    }

    const events = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => progressiveVideoContextEventSchema.parse(JSON.parse(line) as unknown));

    if (!afterEventId) {
      return events;
    }

    const index = events.findIndex((event) => event.id === afterEventId);
    return index >= 0 ? events.slice(index + 1) : events;
  }

  public async writeRenderGraph(videoId: string, renderGraph: RenderGraphV2Handoff): Promise<void> {
    await writeJson(this.renderGraphPath(videoId), renderGraphV2HandoffSchema.parse(renderGraph));
  }

  public async readRenderGraph(videoId: string): Promise<RenderGraphV2Handoff> {
    return renderGraphV2HandoffSchema.parse(await readJson<RenderGraphV2Handoff>(this.renderGraphPath(videoId)));
  }

  public async writeConfigurationDelta(videoId: string, delta: ConfigurationDelta): Promise<void> {
    await writeJson(this.configurationDeltaPath(videoId), configurationDeltaSchema.parse(delta));
  }

  public async readConfigurationDelta(videoId: string): Promise<ConfigurationDelta> {
    return configurationDeltaSchema.parse(await readJson<ConfigurationDelta>(this.configurationDeltaPath(videoId)));
  }

  public async writeTextArtifact(videoId: string, key: VideoContextTextArtifactKey, contents: string): Promise<void> {
    const filePath = this.textArtifactPath(videoId, key);
    await mkdir(path.dirname(filePath), {recursive: true});
    await writeFile(filePath, contents.endsWith("\n") ? contents : `${contents}\n`, "utf-8");
  }

  public async readTextArtifact(videoId: string, key: VideoContextTextArtifactKey): Promise<string> {
    return readFile(this.textArtifactPath(videoId, key), "utf-8");
  }

  public async artifactExists(videoId: string, key: "renderGraph" | "configurationDelta" | VideoContextTextArtifactKey): Promise<boolean> {
    const filePath =
      key === "renderGraph"
        ? this.renderGraphPath(videoId)
        : key === "configurationDelta"
          ? this.configurationDeltaPath(videoId)
          : this.textArtifactPath(videoId, key);
    try {
      await stat(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
