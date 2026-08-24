/**
 * Ambient shim for `@remotion/lambda` so the worker typechecks even before the
 * package is installed. Once `npm --prefix apps/worker install` runs and the
 * real package lands in node_modules, its own declarations take precedence and
 * this fallback is ignored (module resolution prefers the installed package).
 *
 * Only the surfaces used by lambda-render.ts are declared.
 */
declare module '@remotion/lambda' {
  export interface RenderMediaOnLambdaInput {
    region: string;
    functionName: string;
    serveUrl: string;
    composition: string;
    codec: 'h264';
    audioCodec?: 'aac';
    inputProps: Record<string, unknown>;
    framesPerLambda?: number | null;
    concurrencyPerLambda?: number;
    outName?: string;
    downloadBehavior?: {type: 'play-in-browser' | 'download'; fileName?: string};
  }

  export interface RenderMediaOnLambdaOutput {
    renderId: string;
    bucketName: string;
    outKey: string | null;
  }

  export function renderMediaOnLambda(input: RenderMediaOnLambdaInput): Promise<RenderMediaOnLambdaOutput>;

  export interface RenderProgress {
    overallProgress: number;
    outputFile: string | null;
    renderSize: number;
    renderMetadata: unknown;
  }

  export function getRenderProgress(params: {
    renderId: string;
    bucketName: string;
    functionName: string;
    region: string;
  }): Promise<RenderProgress>;

  export function getOrCreateBucket(params: {region: string}): Promise<{bucketName: string}>;

  export interface DeploySiteInput {
    entryPoint: string;
    bucketName: string;
    region: string;
    siteName?: string;
  }

  export function deploySite(input: DeploySiteInput): Promise<{serveUrl: string}>;
}
