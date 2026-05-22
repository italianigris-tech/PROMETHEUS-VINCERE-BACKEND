import path from "node:path";
import {mkdir, readFile, rename, stat, writeFile} from "node:fs/promises";

import type {ClipSelection, EditPlan, ExecutionPlan, JobRecord, MetadataProfile, FallbackEvent} from "./schemas";
import {jobRecordSchema} from "./schemas";

type JobArtifactKey =
  | "job"
  | "input_manifest"
  | "metadata_profile"
  | "clip_selection"
  | "edit_plan"
  | "motion_plan"
  | "execution_plan"
  | "fallback_log"
  | "video_aware_audio_plan"
  | "video_aware_sound_manifest"
  | "video_aware_music_preflight"
  | "video_aware_music_overrides"
  | "audio_render_plan";

const ARTIFACT_FILE_NAMES: Record<JobArtifactKey, string> = {
  job: "job.json",
  input_manifest: path.join("inputs", "manifest.json"),
  metadata_profile: "metadata-profile.json",
  clip_selection: "clip-selection.json",
  edit_plan: "edit-plan.json",
  motion_plan: "motion-plan.json",
  execution_plan: "execution-plan.json",
  fallback_log: "fallback-log.json",
  video_aware_audio_plan: path.join("audio", "video-aware-audio-plan.json"),
  video_aware_sound_manifest: path.join("audio", "video-aware-sound-manifest.json"),
  video_aware_music_preflight: path.join("audio", "video-aware-music-preflight.json"),
  video_aware_music_overrides: path.join("audio", "video-aware-music-overrides.json"),
  audio_render_plan: path.join("audio", "audio-render-plan.json")
};

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(path.dirname(filePath), {recursive: true});
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
};

const readJson = async <T>(filePath: string): Promise<T> => {
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
};

export class FileJobRepository {
  public readonly rootDir: string;

  public constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  public async initialize(): Promise<void> {
    await mkdir(this.jobsRootDir(), {recursive: true});
    await mkdir(this.transcriptCacheDir(), {recursive: true});
  }

  public jobsRootDir(): string {
    return path.join(this.rootDir, "jobs");
  }

  public transcriptCacheDir(): string {
    return path.join(this.rootDir, "transcripts");
  }

  public jobDir(jobId: string): string {
    return path.join(this.jobsRootDir(), jobId);
  }

  public inputsDir(jobId: string): string {
    return path.join(this.jobDir(jobId), "inputs");
  }

  public artifactPath(jobId: string, key: JobArtifactKey): string {
    return path.join(this.jobDir(jobId), ARTIFACT_FILE_NAMES[key]);
  }

  public async ensureJobWorkspace(jobId: string): Promise<void> {
    await mkdir(this.inputsDir(jobId), {recursive: true});
  }

  public async persistUploadedFile({
    jobId,
    sourcePath,
    fileName
  }: {
    jobId: string;
    sourcePath: string;
    fileName: string;
  }): Promise<string> {
    const destinationPath = path.join(this.inputsDir(jobId), fileName);
    await mkdir(path.dirname(destinationPath), {recursive: true});
    await rename(sourcePath, destinationPath);
    return destinationPath;
  }

  public async writeArtifact(jobId: string, key: JobArtifactKey, value: unknown): Promise<string> {
    const filePath = this.artifactPath(jobId, key);
    await writeJson(filePath, value);
    return filePath;
  }

  public async readArtifact<T>(jobId: string, key: JobArtifactKey): Promise<T> {
    return readJson<T>(this.artifactPath(jobId, key));
  }

  public async artifactExists(jobId: string, key: JobArtifactKey): Promise<boolean> {
    try {
      await stat(this.artifactPath(jobId, key));
      return true;
    } catch {
      return false;
    }
  }

  public async pathExists(filePath: string | null | undefined): Promise<boolean> {
    if (!filePath) {
      return false;
    }

    try {
      await stat(filePath);
      return true;
    } catch {
      return false;
    }
  }

  public async createJobRecord(record: JobRecord): Promise<JobRecord> {
    await this.writeArtifact(record.job_id, "job", record);
    return record;
  }

  public async getJobRecord(jobId: string): Promise<JobRecord> {
    return jobRecordSchema.parse(await this.readArtifact<JobRecord>(jobId, "job"));
  }

  public async updateJobRecord(
    jobId: string,
    updater: (current: JobRecord) => JobRecord
  ): Promise<JobRecord> {
    const current = await this.getJobRecord(jobId);
    const next = jobRecordSchema.parse(updater(current));
    await this.writeArtifact(jobId, "job", next);
    return next;
  }

  public async writeMetadataProfile(jobId: string, profile: MetadataProfile): Promise<string> {
    return this.writeArtifact(jobId, "metadata_profile", profile);
  }

  public async writeEditPlan(jobId: string, plan: EditPlan): Promise<string> {
    return this.writeArtifact(jobId, "edit_plan", plan);
  }

  public async writeMotionPlan(jobId: string, plan: unknown): Promise<string> {
    return this.writeArtifact(jobId, "motion_plan", plan);
  }

  public async writeClipSelection(jobId: string, selection: ClipSelection): Promise<string> {
    return this.writeArtifact(jobId, "clip_selection", selection);
  }

  public async writeExecutionPlan(jobId: string, plan: ExecutionPlan): Promise<string> {
    return this.writeArtifact(jobId, "execution_plan", plan);
  }

  public async writeFallbackLog(jobId: string, events: FallbackEvent[]): Promise<string> {
    return this.writeArtifact(jobId, "fallback_log", events);
  }

  public async writeVideoAwareAudioPlan(jobId: string, plan: unknown): Promise<string> {
    return this.writeArtifact(jobId, "video_aware_audio_plan", plan);
  }

  public async writeVideoAwareSoundManifest(jobId: string, plan: unknown): Promise<string> {
    return this.writeArtifact(jobId, "video_aware_sound_manifest", plan);
  }

  public async writeVideoAwareMusicPreflight(jobId: string, report: unknown): Promise<string> {
    return this.writeArtifact(jobId, "video_aware_music_preflight", report);
  }

  public async writeVideoAwareMusicOverrides(jobId: string, overrides: unknown): Promise<string> {
    return this.writeArtifact(jobId, "video_aware_music_overrides", overrides);
  }

  public async writeAudioRenderPlan(jobId: string, plan: unknown): Promise<string> {
    return this.writeArtifact(jobId, "audio_render_plan", plan);
  }
}
