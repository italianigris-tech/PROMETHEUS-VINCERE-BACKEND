export type SourceAnalysisDispatchRequest = {
  jobId: string;
  sourceAssetId: string;
};

export type SourceAnalysisCallStatus = {
  status: "queued" | "running" | "completed" | "failed";
  error?: string;
};

export type SourceAnalysisDispatcher = {
  spawn: (request: SourceAnalysisDispatchRequest) => Promise<{callId: string}>;
  status: (callId: string) => Promise<SourceAnalysisCallStatus>;
};

const responseJson = async (response: Response): Promise<Record<string, unknown>> => {
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      typeof body.error === "string"
        ? body.error
        : `Source analysis dispatcher returned HTTP ${response.status}.`,
    );
  }
  return body;
};

export const createHttpSourceAnalysisDispatcher = ({
  baseUrl,
  fetchImpl = fetch,
}: {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}): SourceAnalysisDispatcher => {
  const root = baseUrl.replace(/\/+$/, "");
  return {
    async spawn(request) {
      const response = await fetchImpl(`${root}/source-analysis/spawn`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({request}),
      });
      const body = await responseJson(response);
      if (typeof body.callId !== "string" || !body.callId) {
        throw new Error("Source analysis dispatcher response omitted callId.");
      }
      return {callId: body.callId};
    },
    async status(callId) {
      const response = await fetchImpl(`${root}/calls/${encodeURIComponent(callId)}`);
      return (await responseJson(response)) as SourceAnalysisCallStatus;
    },
  };
};
