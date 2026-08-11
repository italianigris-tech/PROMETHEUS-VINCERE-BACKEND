import type {UnifiedRenderManifest} from "@prometheus/shared-types";

import type {MartinMatteBatchRequest} from "./maul/martin-depth.js";

export type RenderCallStatus = {
  status: "queued" | "running" | "completed" | "failed";
  outputFile?: string;
  error?: string;
};

export type RenderDispatcher = {
  spawn: (manifest: UnifiedRenderManifest) => Promise<{callId: string}>;
  status: (callId: string) => Promise<RenderCallStatus>;
};

export type MattingCallStatus = RenderCallStatus & {
  windows?: Array<{
    windowId: string;
    foregroundFile: string;
    sourceStartMs: number;
    sourceEndMs: number;
    fps: number;
    width: number;
    height: number;
  }>;
};

export type MattingDispatcher = {
  spawn: (request: MartinMatteBatchRequest) => Promise<{callId: string}>;
  status: (callId: string) => Promise<MattingCallStatus>;
};

const responseJson = async (response: Response): Promise<Record<string, unknown>> => {
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      typeof body.error === "string"
        ? body.error
        : `Render dispatcher returned HTTP ${response.status}.`,
    );
  }
  return body;
};

export const createHttpRenderDispatcher = ({
  baseUrl,
  fetchImpl = fetch,
}: {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}): RenderDispatcher => {
  const root = baseUrl.replace(/\/+$/, "");

  return {
    async spawn(manifest) {
      const response = await fetchImpl(`${root}/spawn`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({manifest}),
      });
      const body = await responseJson(response);
      if (typeof body.callId !== "string" || !body.callId) {
        throw new Error("Render dispatcher response omitted callId.");
      }
      return {callId: body.callId};
    },

    async status(callId) {
      const response = await fetchImpl(`${root}/calls/${encodeURIComponent(callId)}`);
      return (await responseJson(response)) as RenderCallStatus;
    },
  };
};

export const createHttpMattingDispatcher = ({
  baseUrl,
  fetchImpl = fetch,
}: {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}): MattingDispatcher => {
  const root = baseUrl.replace(/\/+$/, "");
  return {
    async spawn(request) {
      const response = await fetchImpl(`${root}/matte/spawn`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({request}),
      });
      const body = await responseJson(response);
      if (typeof body.callId !== "string" || !body.callId) {
        throw new Error("Matting dispatcher response omitted callId.");
      }
      return {callId: body.callId};
    },
    async status(callId) {
      const response = await fetchImpl(`${root}/calls/${encodeURIComponent(callId)}`);
      return (await responseJson(response)) as MattingCallStatus;
    },
  };
};
