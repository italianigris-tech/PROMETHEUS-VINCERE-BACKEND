export type OcularFrameInput = {
  frameId: string;
  atMs: number;
  imageRef: string;
  width: number;
  height: number;
};

export type OcularAnalysisResult = {
  frameId: string;
  compositionScore: number;
  typographyLegibilityScore: number;
  motionReadinessScore: number;
  detectedRisks: string[];
  evidence: string[];
};

export type OcularAdapter = {
  id: string;
  analyzeFrame: (frame: OcularFrameInput) => Promise<OcularAnalysisResult>;
};

export const createUnavailableOcularAdapter = (id = "future-ocular-adapter"): OcularAdapter => ({
  id,
  analyzeFrame: async (frame) => ({
    frameId: frame.frameId,
    compositionScore: 0,
    typographyLegibilityScore: 0,
    motionReadinessScore: 0,
    detectedRisks: ["ocular_adapter_unavailable"],
    evidence: [
      "Ocular seam is present, but no visual cognition adapter is configured yet."
    ]
  })
});
