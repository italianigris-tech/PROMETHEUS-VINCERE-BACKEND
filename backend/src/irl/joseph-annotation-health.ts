import {existsSync, readFileSync} from "node:fs";
import path from "node:path";

/**
 * Health check for the five manual Joseph feature-extraction annotations.
 * These are the human ground truth for IRL feature vocabulary — not render authority.
 */

export const JOSEPH_ANNOTATION_REFERENCE_IDS = [
  "joseph-masterclass-01",
  "joseph-cinematic-documentary-02",
  "joseph-video-questions-03",
  "joseph-viral-reels-premiere-04",
  "joseph-viral-cinematic-reels-05",
] as const;

export type JosephAnnotationReferenceId = (typeof JOSEPH_ANNOTATION_REFERENCE_IDS)[number];

export type JosephAnnotationEvent = {
  timeSeconds?: number | [number, number] | number[];
  observed?: string;
  probableIntent?: string;
  currentFeatures?: string[];
  missingFeatures?: string[];
  trainingSafety?: string;
  verdict?: string;
  confidence?: {visual?: string; audio?: string; intent?: string};
};

export type JosephAnnotationPacket = {
  schemaVersion?: string;
  referenceId?: string;
  events?: JosephAnnotationEvent[];
  coverageEstimate?: {
    observedKeyDecisions?: number;
    explainableByCurrentCatalogApprox?: number;
    trainingSafeNowApprox?: number;
  };
};

export type JosephAnnotationPacketHealth = {
  referenceId: string;
  path: string;
  present: boolean;
  eventCount: number;
  timedEventCount: number;
  featureTaggedEventCount: number;
  trainingSafeEventCount: number;
  deferEventCount: number;
  manualReviewEventCount: number;
  catalogCoverageRatio: number | null;
  issues: string[];
  goodNature: boolean;
};

export type JosephAnnotationHealthReport = {
  version: "joseph-annotation-health-v1";
  packetCount: number;
  expectedPacketCount: 5;
  packets: JosephAnnotationPacketHealth[];
  overallGoodNature: boolean;
  summary: string;
  irlImplications: string[];
};

const defaultAuditPaths = (repoRoot: string): Record<JosephAnnotationReferenceId, string> => ({
  "joseph-masterclass-01": path.join(repoRoot, "docs", "audits", "joseph-masterclass-feature-extraction-01.events.json"),
  "joseph-cinematic-documentary-02": path.join(repoRoot, "docs", "audits", "joseph-cinematic-documentary-feature-extraction-02.events.json"),
  "joseph-video-questions-03": path.join(repoRoot, "docs", "audits", "joseph-video-questions-feature-extraction-03.events.json"),
  "joseph-viral-reels-premiere-04": path.join(repoRoot, "docs", "audits", "joseph-viral-reels-premiere-feature-extraction-04.events.json"),
  "joseph-viral-cinematic-reels-05": path.join(repoRoot, "docs", "audits", "joseph-viral-cinematic-reels-feature-extraction-05.events.json"),
});

const hasTime = (event: JosephAnnotationEvent): boolean => {
  const t = event.timeSeconds;
  if (typeof t === "number" && Number.isFinite(t)) return true;
  if (Array.isArray(t) && t.length >= 1 && typeof t[0] === "number") return true;
  return false;
};

const isTrainSafe = (safety: string | undefined): boolean => {
  if (!safety) return false;
  return /train/i.test(safety) && !/defer/i.test(safety);
};

const isDefer = (safety: string | undefined): boolean =>
  Boolean(safety && /defer/i.test(safety));

const isManual = (safety: string | undefined): boolean =>
  Boolean(safety && /manual/i.test(safety));

export const evaluateJosephAnnotationPacket = (
  referenceId: string,
  packetPath: string,
): JosephAnnotationPacketHealth => {
  const issues: string[] = [];
  if (!existsSync(packetPath)) {
    return {
      referenceId,
      path: packetPath,
      present: false,
      eventCount: 0,
      timedEventCount: 0,
      featureTaggedEventCount: 0,
      trainingSafeEventCount: 0,
      deferEventCount: 0,
      manualReviewEventCount: 0,
      catalogCoverageRatio: null,
      issues: ["missing_annotation_packet"],
      goodNature: false,
    };
  }

  let packet: JosephAnnotationPacket;
  try {
    packet = JSON.parse(readFileSync(packetPath, "utf8")) as JosephAnnotationPacket;
  } catch {
    return {
      referenceId,
      path: packetPath,
      present: true,
      eventCount: 0,
      timedEventCount: 0,
      featureTaggedEventCount: 0,
      trainingSafeEventCount: 0,
      deferEventCount: 0,
      manualReviewEventCount: 0,
      catalogCoverageRatio: null,
      issues: ["invalid_json"],
      goodNature: false,
    };
  }

  if (packet.schemaVersion !== "manual-feature-extraction-v1") {
    issues.push("unexpected_schema_version");
  }
  if (packet.referenceId && packet.referenceId !== referenceId) {
    issues.push("reference_id_mismatch");
  }

  const events = Array.isArray(packet.events) ? packet.events : [];
  if (events.length < 8) {
    issues.push("too_few_events");
  }

  const timedEventCount = events.filter(hasTime).length;
  const featureTaggedEventCount = events.filter((event) => (event.currentFeatures?.length ?? 0) > 0).length;
  const trainingSafeEventCount = events.filter((event) => isTrainSafe(event.trainingSafety)).length;
  const deferEventCount = events.filter((event) => isDefer(event.trainingSafety)).length;
  const manualReviewEventCount = events.filter((event) => isManual(event.trainingSafety)).length;

  if (timedEventCount < Math.floor(events.length * 0.9)) {
    issues.push("many_events_missing_time");
  }
  if (featureTaggedEventCount < Math.floor(events.length * 0.5)) {
    issues.push("many_events_missing_current_features");
  }

  const observed = packet.coverageEstimate?.observedKeyDecisions ?? events.length;
  const explainable = packet.coverageEstimate?.explainableByCurrentCatalogApprox;
  const catalogCoverageRatio = typeof explainable === "number" && observed > 0
    ? explainable / observed
    : featureTaggedEventCount / Math.max(1, events.length);

  // Good nature: discovery-grade human labels with timing + feature mapping.
  // Not the same as "ready for MaxEnt training without artifact verification."
  const goodNature = issues.length === 0
    && events.length >= 8
    && timedEventCount >= 8
    && featureTaggedEventCount >= 5;

  return {
    referenceId,
    path: packetPath,
    present: true,
    eventCount: events.length,
    timedEventCount,
    featureTaggedEventCount,
    trainingSafeEventCount,
    deferEventCount,
    manualReviewEventCount,
    catalogCoverageRatio,
    issues,
    goodNature,
  };
};

export const evaluateJosephAnnotationHealth = (repoRoot: string): JosephAnnotationHealthReport => {
  const paths = defaultAuditPaths(repoRoot);
  const packets = JOSEPH_ANNOTATION_REFERENCE_IDS.map((referenceId) =>
    evaluateJosephAnnotationPacket(referenceId, paths[referenceId]),
  );
  const overallGoodNature = packets.every((packet) => packet.goodNature);
  const totalEvents = packets.reduce((sum, packet) => sum + packet.eventCount, 0);
  const trainSafe = packets.reduce((sum, packet) => sum + packet.trainingSafeEventCount, 0);
  const deferred = packets.reduce((sum, packet) => sum + packet.deferEventCount, 0);

  const irlImplications = [
    "Annotations are discovery labels for feature vocabulary and audit windows — correct for extraction targeting.",
    "Do not train MaxEnt IRL on annotation text alone; require validated trajectory + audio/frame evidence.",
    deferred > trainSafe
      ? "Majority of events are deferred/manual — keep compact catalog; do not invent features for every missing tag."
      : "Train-safe event share is healthy for first measured trajectory windows.",
    "Local evidence extraction must window on annotation timeSeconds (already the local producer contract).",
  ];

  return {
    version: "joseph-annotation-health-v1",
    packetCount: packets.filter((packet) => packet.present).length,
    expectedPacketCount: 5,
    packets,
    overallGoodNature,
    summary: overallGoodNature
      ? `All 5 Joseph annotation packets are discovery-healthy (${totalEvents} events; ${trainSafe} train-tagged; ${deferred} deferred).`
      : `Joseph annotation set is incomplete or malformed (${packets.filter((p) => !p.goodNature).map((p) => p.referenceId).join(", ")}).`,
    irlImplications,
  };
};
