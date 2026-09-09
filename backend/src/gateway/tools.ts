import { randomUUID } from "node:crypto";
import type { ToolDefinition, AuthContext } from "./types.js";
import {
  sanitizeDto,
  auditToolDocstring,
  sanitizeInputText,
  assertSandboxedPath,
  SecurityViolationError
} from "./security.js";

// In-memory tenant-scoped job store for gateway jobs
interface JobRecord {
  readonly jobId: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly title: string;
  status: "queued" | "processing" | "completed" | "failed";
  progressPercent: number;
  readonly createdAt: string;
  completedAt?: string;
  downloadUrl?: string;
}

const activeJobs = new Map<string, JobRecord>();

// Pre-seeded sample audio library (safe public DTOs)
const AUDIO_CATALOG = [
  {
    trackId: "trk_cinematic_01",
    title: "Midnight Ascension",
    artist: "Prometheus Sound Lab",
    genre: "Cinematic Tension",
    durationSeconds: 142,
    previewUrl: "https://assets.prometheus.media/audio/preview/midnight-ascension.mp3"
  },
  {
    trackId: "trk_kinetic_02",
    title: "Accelerated Pulse",
    artist: "Vincere Beats",
    genre: "High Energy Electronic",
    durationSeconds: 98,
    previewUrl: "https://assets.prometheus.media/audio/preview/accelerated-pulse.mp3"
  },
  {
    trackId: "trk_documentary_03",
    title: "Deep Thought Horizon",
    artist: "Aetheric Audio",
    genre: "Minimal Ambient",
    durationSeconds: 184,
    previewUrl: "https://assets.prometheus.media/audio/preview/deep-thought.mp3"
  }
];

export const createEditorialRenderJobTool: ToolDefinition<
  {
    scriptText: string;
    aspectRatio?: "9:16" | "16:9";
    stylePreset?: "cinematic" | "dynamic" | "minimal";
    title?: string;
  },
  {
    jobId: string;
    status: string;
    title: string;
    aspectRatio: string;
    estimatedDurationSeconds: number;
    createdAt: string;
  }
> = {
  name: "create_editorial_render_job",
  description:
    "Submits an editorial short-form rendering request with designated script text, aspect ratio, and pacing style.",
  inputSchema: {
    type: "object",
    properties: {
      scriptText: {
        type: "string",
        description: "The spoken script or caption text to realize as video."
      },
      aspectRatio: {
        type: "string",
        enum: ["9:16", "16:9"],
        description: "Visual aspect ratio of the output video. Defaults to 9:16 vertical."
      },
      stylePreset: {
        type: "string",
        enum: ["cinematic", "dynamic", "minimal"],
        description: "Visual editorial pacing and typography treatment style."
      },
      title: {
        type: "string",
        description: "Optional project title for identification."
      }
    },
    required: ["scriptText"]
  },
  execute: async (input, ctx: AuthContext) => {
    const cleanScript = sanitizeInputText(input.scriptText);
    if (!cleanScript) {
      throw new Error("Validation error: scriptText cannot be empty.");
    }

    const jobId = `job_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const title = input.title ? sanitizeInputText(input.title) : "Untitled Editorial Short";
    const aspectRatio = input.aspectRatio ?? "9:16";

    const record: JobRecord = {
      jobId,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      title,
      status: "queued",
      progressPercent: 5,
      createdAt: new Date().toISOString()
    };

    activeJobs.set(jobId, record);

    // Simulate asynchronous pipeline transition to completion for testability
    setTimeout(() => {
      const j = activeJobs.get(jobId);
      if (j) {
        j.status = "completed";
        j.progressPercent = 100;
        j.completedAt = new Date().toISOString();
        j.downloadUrl = `https://downloads.prometheus.media/export/${jobId}.mp4`;
      }
    }, 4000);

    return sanitizeDto({
      jobId,
      status: "queued",
      title,
      aspectRatio,
      estimatedDurationSeconds: Math.max(15, Math.min(60, Math.round(cleanScript.split(" ").length / 2.5))),
      createdAt: record.createdAt
    });
  }
};

export const getRenderJobStatusTool: ToolDefinition<
  { jobId: string },
  {
    jobId: string;
    status: string;
    progressPercent: number;
    title: string;
    completedAt?: string;
    downloadUrl?: string;
  }
> = {
  name: "get_render_job_status",
  description:
    "Retrieves the execution status, progress percentage, and public download URL of a previously submitted render job.",
  inputSchema: {
    type: "object",
    properties: {
      jobId: {
        type: "string",
        description: "The unique job identifier received upon submission."
      }
    },
    required: ["jobId"]
  },
  execute: async (input, ctx: AuthContext) => {
    const record = activeJobs.get(input.jobId);
    if (!record) {
      throw new Error(`Job '${input.jobId}' not found.`);
    }

    // ANTI-IDOR ENFORCEMENT:
    // Verify that the requesting tenant owns this job before exposing status
    if (ctx.authenticated && record.tenantId !== ctx.tenantId) {
      throw new SecurityViolationError("Access denied: You do not have authorization to view this job record.");
    }

    return sanitizeDto({
      jobId: record.jobId,
      status: record.status,
      progressPercent: record.progressPercent,
      title: record.title,
      completedAt: record.completedAt,
      downloadUrl: record.downloadUrl
    });
  }
};

export const searchAudioCatalogTool: ToolDefinition<
  { query: string; genre?: string; limit?: number },
  {
    totalMatches: number;
    tracks: Array<{
      trackId: string;
      title: string;
      artist: string;
      genre: string;
      durationSeconds: number;
      previewUrl: string;
    }>;
  }
> = {
  name: "search_audio_catalog",
  description:
    "Searches the approved production music and acoustic library by keyword, genre, or mood description.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search keyword describing mood, atmosphere, or style (e.g. 'cinematic tension')."
      },
      genre: {
        type: "string",
        description: "Optional genre filter."
      },
      limit: {
        type: "number",
        description: "Maximum results to return (default 5, max 10)."
      }
    },
    required: ["query"]
  },
  execute: async (input) => {
    const cleanQuery = sanitizeInputText(input.query).toLowerCase();
    const limit = Math.min(Math.max(1, input.limit ?? 5), 10);

    const matches = AUDIO_CATALOG.filter((t) => {
      const matchQuery =
        t.title.toLowerCase().includes(cleanQuery) ||
        t.genre.toLowerCase().includes(cleanQuery) ||
        t.artist.toLowerCase().includes(cleanQuery);
      if (input.genre) {
        return matchQuery && t.genre.toLowerCase().includes(input.genre.toLowerCase());
      }
      return matchQuery;
    }).slice(0, limit);

    return sanitizeDto({
      totalMatches: matches.length,
      tracks: matches
    });
  }
};

export const planKineticCaptionsTool: ToolDefinition<
  { scriptText: string; wordsPerChunk?: number },
  {
    totalWords: number;
    chunkCount: number;
    chunks: Array<{
      phrase: string;
      emphasisRole: "hero" | "support" | "accent";
      estimatedDurationMs: number;
    }>;
  }
> = {
  name: "plan_kinetic_captions",
  description:
    "Transforms raw spoken script text into structured typographic phrases with semantic hierarchy roles for kinetic display.",
  inputSchema: {
    type: "object",
    properties: {
      scriptText: {
        type: "string",
        description: "The spoken script to partition into rhythmic caption phrases."
      },
      wordsPerChunk: {
        type: "number",
        description: "Target number of words per on-screen phrase group (between 2 and 5)."
      }
    },
    required: ["scriptText"]
  },
  execute: async (input) => {
    const text = sanitizeInputText(input.scriptText);
    const words = text.split(/\s+/).filter(Boolean);
    const chunkSize = Math.max(2, Math.min(5, input.wordsPerChunk ?? 3));

    const chunks: Array<{
      phrase: string;
      emphasisRole: "hero" | "support" | "accent";
      estimatedDurationMs: number;
    }> = [];

    for (let i = 0; i < words.length; i += chunkSize) {
      const phraseWords = words.slice(i, i + chunkSize);
      const phrase = phraseWords.join(" ");

      // Deterministic semantic role assignment based on position in cadence
      const index = chunks.length;
      const emphasisRole: "hero" | "support" | "accent" =
        index === 0
          ? "hero"
          : index % 3 === 0
            ? "accent"
            : "support";

      const estimatedDurationMs = Math.round((phraseWords.length / 2.6) * 1000);

      chunks.push({
        phrase,
        emphasisRole,
        estimatedDurationMs
      });
    }

    return sanitizeDto({
      totalWords: words.length,
      chunkCount: chunks.length,
      chunks
    });
  }
};

export const getAssetMetadataTool: ToolDefinition<
  { relativeAssetPath: string },
  {
    assetName: string;
    extension: string;
    sizeBytes: number;
    sanitizedPath: string;
  }
> = {
  name: "get_asset_metadata",
  description:
    "Inspects safe file metadata (name, format, file size) for an asset stored within the sandbox creative repository.",
  inputSchema: {
    type: "object",
    properties: {
      relativeAssetPath: {
        type: "string",
        description: "Relative file path inside the safe project assets directory."
      }
    },
    required: ["relativeAssetPath"]
  },
  execute: async (input) => {
    const sandboxDirectory = "assets";
    // Path traversal verification
    const safePath = assertSandboxedPath(input.relativeAssetPath, sandboxDirectory);

    return sanitizeDto({
      assetName: safePath.split(/[\\/]/).pop() || "unknown",
      extension: safePath.split(".").pop() || "",
      sizeBytes: 1048576, // 1MB mock for sandbox metadata
      sanitizedPath: `sandbox://assets/${input.relativeAssetPath.replace(/^[\\/]+/, "")}`
    });
  }
};

// All registered tools
export const REGISTERED_TOOLS: ToolDefinition<any, any>[] = [
  createEditorialRenderJobTool,
  getRenderJobStatusTool,
  searchAudioCatalogTool,
  planKineticCaptionsTool,
  getAssetMetadataTool
];

// Audit all tool docstrings on startup
for (const tool of REGISTERED_TOOLS) {
  auditToolDocstring(tool.description, tool.name);
}
