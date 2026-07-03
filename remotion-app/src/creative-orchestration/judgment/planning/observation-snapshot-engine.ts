import {hashString} from "../../utils";
import {
  observationSnapshotFactsSchema,
  observationSnapshotSchema,
  type JudgmentEngineInput,
  type ObservationSnapshot,
  type ObservationSnapshotFacts,
  type PreJudgmentSnapshot
} from "../types";

const buildObservationFacts = (
  input: JudgmentEngineInput,
  snapshot: PreJudgmentSnapshot
): ObservationSnapshotFacts => {
  const firstWord = input.moment.words[0] ?? null;
  const lastWord = input.moment.words[input.moment.words.length - 1] ?? null;

  return observationSnapshotFactsSchema.parse({
    scene: {
      segmentId: input.segmentId,
      momentId: input.moment.id,
      startMs: input.moment.startMs,
      endMs: input.moment.endMs,
      durationMs: Math.max(0, input.moment.endMs - input.moment.startMs),
      momentType: input.moment.momentType
    },
    transcript: {
      text: input.moment.transcriptText || input.transcriptSegment,
      wordCount: input.moment.words.length,
      firstWordMs: firstWord?.startMs ?? null,
      lastWordMs: lastWord?.endMs ?? null
    },
    audio: {
      energy: input.moment.energy,
      importance: input.moment.importance,
      density: input.moment.density
    },
    visual: {
      sceneDensity: input.sceneAnalysis?.sceneDensity ?? null,
      motionDensity: input.sceneAnalysis?.motionDensity ?? null,
      backgroundComplexity: input.sceneAnalysis?.backgroundComplexity ?? null,
      safeZones: input.sceneAnalysis?.safeZones ?? snapshot.spatialConstraints.safeZones,
      busyRegions: input.sceneAnalysis?.busyRegions ?? [],
      subjectRegion: input.subjectSegmentation?.subjectRegion ?? null,
      matteConfidence: input.subjectSegmentation?.matteConfidence ?? null
    },
    production: {
      assetFingerprintCount: input.assetFingerprints.length,
      retrievalResultCount: input.retrievalResults.length
    },
    constraints: {
      safeZones: snapshot.spatialConstraints.safeZones,
      riskyZones: snapshot.spatialConstraints.riskyZones,
      speakerBlockedZones: snapshot.spatialConstraints.speakerBlockedZones,
      behindSubjectTextLegal: snapshot.spatialConstraints.behindSubjectTextLegal,
      denseTextAllowed: snapshot.spatialConstraints.denseTextAllowed,
      frameNeedsRestraint: snapshot.spatialConstraints.frameNeedsRestraint,
      busyFrame: snapshot.spatialConstraints.busyFrame,
      occlusionRisk: snapshot.spatialConstraints.occlusionRisk,
      mobileReadabilityRisk: snapshot.spatialConstraints.mobileReadabilityRisk
    }
  });
};

export class ObservationSnapshotEngine {
  build(input: JudgmentEngineInput, snapshot: PreJudgmentSnapshot): ObservationSnapshot {
    const facts = buildObservationFacts(input, snapshot);
    const fingerprint = `observation-facts-${hashString(JSON.stringify(facts)).toString(16)}`;

    return observationSnapshotSchema.parse({
      version: "observation-snapshot-v1",
      id: `observation-${hashString(fingerprint).toString(16)}`,
      fingerprint,
      facts,
      segmentId: input.segmentId,
      moment: input.moment,
      speakerMetadata: input.speakerMetadata,
      sceneAnalysis: input.sceneAnalysis,
      subjectSegmentation: input.subjectSegmentation,
      spatialConstraints: snapshot.spatialConstraints,
      emphasisTargets: snapshot.emphasisTargets,
      recentDecisionPlans: snapshot.recentDecisionPlans,
      recentVisualPatterns: snapshot.recentVisualPatterns,
      recentSequenceMetrics: snapshot.recentSequenceMetrics,
      assetFingerprintCount: input.assetFingerprints.length,
      retrievalResultCount: input.retrievalResults.length
    });
  }
}
