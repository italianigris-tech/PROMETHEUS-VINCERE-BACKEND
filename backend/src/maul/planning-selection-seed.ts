import {createHash} from "node:crypto";

export type MaulPlanningSelectionWord = {
  text: string;
  startMs: number;
  endMs: number;
};

export const buildMaulPlanningSelectionSeed = ({
  sourceSha256,
  treatmentId,
  candidateWords,
}: {
  sourceSha256: string;
  treatmentId: string;
  candidateWords: MaulPlanningSelectionWord[];
}): string => createHash("sha256")
  .update(JSON.stringify({
    sourceSha256,
    treatmentId,
    candidateWords,
  }))
  .digest("hex");
