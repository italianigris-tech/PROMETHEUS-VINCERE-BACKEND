export type OcularFrameAnalysisRequest = {
  jobId: string;
  frameUrls: string[];
  requestedSignals: Array<
    | "frame-analysis"
    | "typography-density"
    | "cinematic-reference-comparison"
    | "composition-analysis"
    | "motion-analysis"
  >;
};

export type OcularFrameAnalysisResult = {
  provider: string;
  confidence: number;
  frameSignals: Array<{
    frameUrl: string;
    compositionScore: number;
    typographyDensity: number;
    motionEnergy: number;
    notes: string[];
  }>;
};

export interface OcularAnalysisPort {
  analyzeFrames(request: OcularFrameAnalysisRequest): Promise<OcularFrameAnalysisResult>;
}
