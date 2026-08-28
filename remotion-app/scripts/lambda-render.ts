import {
  renderMediaOnLambda,
  getRenderProgress,
  speculateFunctionName,
} from "@remotion/lambda/client";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config();

type LambdaRenderOptions = {
  region?: string;
  functionName?: string;
  serveUrl?: string;
  compositionId?: string;
  inputProps?: Record<string, any>;
  outPath?: string;
  framesPerLambda?: number;
  concurrencyPerInstance?: number;
};

export async function runLambdaRender(options: LambdaRenderOptions = {}) {
  const region = (options.region || process.env.REMOTION_AWS_REGION || "us-east-1") as any;
  const functionName =
    options.functionName ||
    process.env.REMOTION_AWS_FUNCTION_NAME ||
    speculateFunctionName({
      diskSizeInMb: 2048,
      memorySizeInMb: 3008,
      timeoutInSeconds: 240,
    });
  const serveUrl = options.serveUrl || process.env.REMOTION_SERVE_URL;
  const compositionId = options.compositionId || "PrometheusMinRun";

  if (!serveUrl) {
    throw new Error(
      "Missing REMOTION_SERVE_URL. Run `npx remotion lambda sites create src/index.ts` or deploy a site first."
    );
  }

  console.log(`[Lambda Render] Initiating distributed render for ${compositionId} in region ${region}...`);
  console.log(`[Lambda Render] Function: ${functionName}, Serve URL: ${serveUrl}`);

  const { renderId, bucketName } = await renderMediaOnLambda({
    region,
    functionName,
    serveUrl,
    composition: compositionId,
    inputProps: options.inputProps || {},
    codec: "h264",
    framesPerLambda: options.framesPerLambda || 20,
    downloadBehavior: {
      type: "download",
      fileName: options.outPath ? path.basename(options.outPath) : "rendered-output.mp4",
    },
  });

  console.log(`[Lambda Render] Render started! Render ID: ${renderId}, Bucket: ${bucketName}`);

  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const progress = await getRenderProgress({
      renderId,
      bucketName,
      functionName,
      region,
    });

    if (progress.fatalErrorEncountered) {
      throw new Error(`[Lambda Render] Fatal error: ${progress.errors[0]?.message}`);
    }

    const percent = Math.round(progress.overallProgress * 100);
    console.log(`[Lambda Render] Progress: ${percent}% (Chunks: ${progress.chunks} rendered)`);

    if (progress.done) {
      console.log(`[Lambda Render] Render complete! Output URL: ${progress.outputFile}`);
      return {
        outputUrl: progress.outputFile,
        renderId,
        bucketName,
      };
    }
  }
}

if (process.argv[1]?.endsWith("lambda-render.ts")) {
  const manifestPath = process.argv[2];
  let inputProps = {};
  if (manifestPath && fs.existsSync(manifestPath)) {
    inputProps = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  }

  runLambdaRender({ inputProps })
    .then((res) => {
      console.log("[Lambda Render] Success:", res);
      process.exit(0);
    })
    .catch((err) => {
      console.error("[Lambda Render] Failed:", err);
      process.exit(1);
    });
}
