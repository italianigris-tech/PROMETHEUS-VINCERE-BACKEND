import type {CreativeDecisionManifest} from "../contracts/manifests";

export type CinematicCritiquePatch = {
  target: "typography" | "pacing" | "motion" | "visual-density" | "emotional-continuity";
  recommendation: string;
  confidence: number;
};

export type CinematicCritiqueResult = {
  qualityScore: number;
  confidence: number;
  patches: CinematicCritiquePatch[];
  notes: string[];
};

export interface Gpt55CriticPort {
  critiqueManifest(manifest: CreativeDecisionManifest): Promise<CinematicCritiqueResult>;
}
