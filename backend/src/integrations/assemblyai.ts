import {readFile} from "node:fs/promises";
import {z} from "zod";

import type {TranscribedWord} from "../schemas";

type FetchLike = typeof fetch;

const uploadResponseSchema = z.object({
  upload_url: z.string().url()
});

const createTranscriptResponseSchema = z.object({
  id: z.string()
});

const transcriptStatusSchema = z.object({
  id: z.string(),
  status: z.enum(["queued", "processing", "completed", "error"]),
  error: z.string().nullable().optional(),
  words: z
    .array(
      z.object({
        text: z.string(),
        start: z.number(),
        end: z.number(),
        confidence: z.number().optional()
      })
    )
    .nullable()
    .optional()
});

const transcriptionBaseUrl = "https://api.assemblyai.com/v2";
const streamingBaseUrl = "https://streaming.assemblyai.com";

const timedFetch = async ({
  fetchImpl,
  url,
  init,
  timeoutMs,
  timeoutCode,
  label,
  onActivity
}: {
  fetchImpl: FetchLike;
  url: string;
  init: RequestInit;
  timeoutMs: number;
  timeoutCode: string;
  label: string;
  onActivity?: (detail: string) => void | Promise<void>;
}): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await onActivity?.(`${label}: request started`);
    const response = await fetchImpl(url, {
      ...init,
      signal: controller.signal
    });
    await onActivity?.(`${label}: response ${response.status}`);
    return response;
  } catch (error) {
    if ((error as {name?: string})?.name === "AbortError") {
      throw new Error(`${timeoutCode}: ${label} exceeded ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const jsonHeaders = (apiKey: string): HeadersInit => ({
  authorization: apiKey,
  "content-type": "application/json"
});

const uploadHeaders = (apiKey: string): HeadersInit => ({
  authorization: apiKey,
  "content-type": "application/octet-stream"
});

export const transcribeWithAssemblyAI = async ({
  filePath,
  apiKey,
  fetchImpl = fetch,
  pollIntervalMs = 2500,
  maxPollAttempts = 240,
  onPoll,
  timeoutMs = 60000,
  onActivity
}: {
  filePath: string;
  apiKey: string;
  fetchImpl?: FetchLike;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
  timeoutMs?: number;
  onPoll?: (info: {
    attempt: number;
    maxPollAttempts: number;
    status: "queued" | "processing" | "completed" | "error";
    transcriptId: string;
    words: number;
  }) => void | Promise<void>;
  onActivity?: (detail: string) => void | Promise<void>;
}): Promise<TranscribedWord[]> => {
  const fileBuffer = await readFile(filePath);
  const uploadResponse = await timedFetch({
    fetchImpl,
    url: `${transcriptionBaseUrl}/upload`,
    init: {
      method: "POST",
      headers: uploadHeaders(apiKey),
      body: fileBuffer
    },
    timeoutMs,
    timeoutCode: "TRANSCRIPT_UPLOAD_TIMEOUT",
    label: "AssemblyAI upload",
    onActivity
  });
  if (!uploadResponse.ok) {
    throw new Error(`AssemblyAI upload failed (${uploadResponse.status}): ${await uploadResponse.text()}`);
  }
  const uploadPayload = uploadResponseSchema.parse(await uploadResponse.json());

  const createResponse = await timedFetch({
    fetchImpl,
    url: `${transcriptionBaseUrl}/transcript`,
    init: {
      method: "POST",
      headers: jsonHeaders(apiKey),
      body: JSON.stringify({
        audio_url: uploadPayload.upload_url,
        speech_model: "best"
      })
    },
    timeoutMs,
    timeoutCode: "TRANSCRIPT_CREATE_TIMEOUT",
    label: "AssemblyAI transcript create",
    onActivity
  });
  if (!createResponse.ok) {
    throw new Error(`AssemblyAI transcript create failed (${createResponse.status}): ${await createResponse.text()}`);
  }
  const createPayload = createTranscriptResponseSchema.parse(await createResponse.json());

  for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
    const statusResponse = await timedFetch({
      fetchImpl,
      url: `${transcriptionBaseUrl}/transcript/${createPayload.id}`,
      init: {
        method: "GET",
        headers: {authorization: apiKey}
      },
      timeoutMs,
      timeoutCode: "TRANSCRIPT_POLL_TIMEOUT",
      label: `AssemblyAI transcript poll ${attempt}/${maxPollAttempts}`,
      onActivity
    });
    if (!statusResponse.ok) {
      throw new Error(
        `AssemblyAI transcript polling failed (${statusResponse.status}): ${await statusResponse.text()}`
      );
    }

    const transcript = transcriptStatusSchema.parse(await statusResponse.json());
    void Promise.resolve(
      onPoll?.({
        attempt,
        maxPollAttempts,
        status: transcript.status,
        transcriptId: createPayload.id,
        words: transcript.words?.length ?? 0
      })
    );
    if (transcript.status === "completed") {
      const words = transcript.words ?? [];
      return words.map((word) => ({
        text: word.text.trim(),
        start_ms: word.start,
        end_ms: word.end,
        confidence: word.confidence
      }));
    }

    if (transcript.status === "error") {
      throw new Error(`AssemblyAI transcription error: ${transcript.error ?? "Unknown error"}`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`AssemblyAI transcription timed out for transcript ID ${createPayload.id}.`);
};

const streamingTokenResponseSchema = z.object({
  token: z.string(),
  expires_in_seconds: z.number().int().positive()
});

const streamingBeginMessageSchema = z.object({
  type: z.literal("Begin"),
  id: z.string(),
  expires_at: z.number().optional()
});

const streamingTurnWordSchema = z.object({
  start: z.number().nonnegative().optional(),
  end: z.number().nonnegative().optional(),
  text: z.string(),
  confidence: z.number().optional(),
  word_is_final: z.boolean().optional()
});

const streamingTurnMessageSchema = z.object({
  type: z.literal("Turn"),
  turn_order: z.number().int().nonnegative().optional(),
  turn_is_formatted: z.boolean().optional(),
  end_of_turn: z.boolean().optional(),
  transcript: z.string().default(""),
  end_of_turn_confidence: z.number().optional(),
  words: z.array(streamingTurnWordSchema).default([]),
  utterance: z.string().default("")
});

const streamingTerminationMessageSchema = z.object({
  type: z.literal("Termination"),
  audio_duration_seconds: z.number().optional()
});

export type AssemblyAIStreamingTurnWord = z.infer<typeof streamingTurnWordSchema>;

export type AssemblyAIStreamingTurnMessage = {
  turnOrder: number | null;
  transcript: string;
  utterance: string;
  endOfTurn: boolean;
  endOfTurnConfidence: number | null;
  words: AssemblyAIStreamingTurnWord[];
  isFormatted: boolean;
};

export type AssemblyAIStreamingCallbacks = {
  onBegin?: (payload: {sessionId: string; expiresAt: number | null}) => void | Promise<void>;
  onTurn?: (payload: AssemblyAIStreamingTurnMessage) => void | Promise<void>;
  onTermination?: (payload: {audioDurationSeconds: number | null}) => void | Promise<void>;
  onError?: (error: Error) => void | Promise<void>;
};

export const streamAudioBufferWithAssemblyAI = async ({
  audioBuffer,
  apiKey,
  fetchImpl = fetch,
  sampleRate = 16000,
  speechModel = "u3-rt-pro",
  chunkMs = 50,
  chunkDelayMs = 0,
  formatTurns = true,
  inactivityTimeoutSeconds = 30,
  endOfTurnConfidenceThreshold = 0.35,
  tokenExpiresInSeconds = 60,
  callbacks = {}
}: {
  audioBuffer: Buffer;
  apiKey: string;
  fetchImpl?: FetchLike;
  sampleRate?: number;
  speechModel?: string;
  chunkMs?: number;
  chunkDelayMs?: number;
  formatTurns?: boolean;
  inactivityTimeoutSeconds?: number;
  endOfTurnConfidenceThreshold?: number;
  tokenExpiresInSeconds?: number;
  callbacks?: AssemblyAIStreamingCallbacks;
}): Promise<void> => {
  if (!apiKey.trim()) {
    throw new Error("AssemblyAI streaming requires an API key.");
  }

  const tokenResponse = await fetchImpl(`${streamingBaseUrl}/v3/token?expires_in_seconds=${encodeURIComponent(String(tokenExpiresInSeconds))}`, {
    method: "GET",
    headers: {
      authorization: apiKey
    }
  });
  if (!tokenResponse.ok) {
    throw new Error(`AssemblyAI token request failed (${tokenResponse.status}): ${await tokenResponse.text()}`);
  }
  const tokenPayload = streamingTokenResponseSchema.parse(await tokenResponse.json());

  if (typeof WebSocket === "undefined") {
    throw new Error("WebSocket is not available in this runtime.");
  }

  const params = new URLSearchParams({
    token: tokenPayload.token,
    speech_model: speechModel,
    sample_rate: String(sampleRate),
    encoding: "pcm_s16le",
    format_turns: formatTurns ? "true" : "false",
    inactivity_timeout: String(inactivityTimeoutSeconds),
    end_of_turn_confidence_threshold: String(endOfTurnConfidenceThreshold)
  });
  const websocketUrl = `wss://streaming.assemblyai.com/v3/ws?${params.toString()}`;
  const chunkSizeBytes = Math.max(2, Math.floor((sampleRate * 2 * chunkMs) / 1000));
  const chunks: Buffer[] = [];
  for (let offset = 0; offset < audioBuffer.length; offset += chunkSizeBytes) {
    chunks.push(audioBuffer.subarray(offset, Math.min(audioBuffer.length, offset + chunkSizeBytes)));
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    const finish = (error?: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    const ws = new WebSocket(websocketUrl);

    ws.addEventListener("open", () => {
      const sendChunks = async (): Promise<void> => {
        try {
          for (const chunk of chunks) {
            if (ws.readyState !== WebSocket.OPEN) {
              break;
            }
            ws.send(chunk);
            if (chunkDelayMs > 0) {
              await new Promise((resolveDelay) => setTimeout(resolveDelay, chunkDelayMs));
            }
          }
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({type: "Terminate"}));
          }
        } catch (error) {
          finish(error instanceof Error ? error : new Error(String(error)));
        }
      };

      void sendChunks();
    });

    ws.addEventListener("message", (event) => {
      try {
        const raw =
          typeof event.data === "string"
            ? event.data
            : Buffer.isBuffer(event.data)
              ? event.data.toString("utf-8")
              : event.data instanceof ArrayBuffer
                ? Buffer.from(event.data).toString("utf-8")
                : "";
        if (!raw) {
          return;
        }
        const parsed = JSON.parse(raw) as unknown;
        if (streamingBeginMessageSchema.safeParse(parsed).success) {
          const begin = streamingBeginMessageSchema.parse(parsed);
          void Promise.resolve(
            callbacks.onBegin?.({
              sessionId: begin.id,
              expiresAt: begin.expires_at ?? null
            })
          );
          return;
        }

        if (streamingTurnMessageSchema.safeParse(parsed).success) {
          const turn = streamingTurnMessageSchema.parse(parsed);
          void Promise.resolve(
            callbacks.onTurn?.({
              turnOrder: turn.turn_order ?? null,
              transcript: turn.transcript,
              utterance: turn.utterance,
              endOfTurn: Boolean(turn.end_of_turn),
              endOfTurnConfidence: turn.end_of_turn_confidence ?? null,
              words: turn.words,
              isFormatted: Boolean(turn.turn_is_formatted)
            })
          );
          return;
        }

        if (streamingTerminationMessageSchema.safeParse(parsed).success) {
          const termination = streamingTerminationMessageSchema.parse(parsed);
          void Promise.resolve(
            callbacks.onTermination?.({
              audioDurationSeconds: termination.audio_duration_seconds ?? null
            })
          );
          ws.close();
          finish();
        }
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)));
      }
    });

    ws.addEventListener("error", () => {
      const error = new Error("AssemblyAI streaming websocket error.");
      void Promise.resolve(callbacks.onError?.(error));
      finish(error);
    });

    ws.addEventListener("close", () => {
      finish();
    });

    timeoutHandle = setTimeout(() => {
      if (settled) {
        return;
      }
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      } catch {
        // Ignore cleanup failures.
      }
    }, Math.max(1000, chunkDelayMs * chunks.length + 15000));
  });
};
