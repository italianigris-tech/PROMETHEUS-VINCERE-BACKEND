import type {JosephMacroRigPlan, JosephPiPPlan, Word} from "@prometheus/shared-types";

export type JosephMacroRigSemanticSummary = {
  intent: string;
  rhetoricalArc: string;
  tone: string;
};

export type JosephTalkingHeadMacroRigInput = {
  semanticSummary: JosephMacroRigSemanticSummary;
  transcript: readonly Word[];
  pipPlan: JosephPiPPlan;
};

const PROOF_SIGNALS = new Set([
  "proof",
  "prove",
  "evidence",
  "shown",
  "shows",
  "because",
]);
const DATA_SIGNALS = new Set([
  "data",
  "metric",
  "metrics",
  "number",
  "numbers",
  "percent",
  "percentage",
  "chart",
  "graph",
  "result",
  "results",
]);
const EXHIBIT_SIGNALS = new Set([
  "exhibit",
  "case",
  "study",
  "example",
  "report",
  "dashboard",
  "breakdown",
]);

const normalizeSignal = (value: string): string => value.toLowerCase().replace(/[^a-z0-9%]+/g, "");

const uniqueStrings = (items: readonly string[]): string[] => [...new Set(items.filter((item) => item.length > 0))];

const matchedSignalsFor = ({semanticSummary, transcript}: Pick<JosephTalkingHeadMacroRigInput, "semanticSummary" | "transcript">): string[] => {
  const semanticText = [semanticSummary.intent, semanticSummary.rhetoricalArc, semanticSummary.tone].join(" ");
  const words = [
    ...transcript.map((word) => word.text),
    ...semanticText.split(/\s+/),
  ].map(normalizeSignal);
  return uniqueStrings(words.filter((word) => (
    PROOF_SIGNALS.has(word) || DATA_SIGNALS.has(word) || EXHIBIT_SIGNALS.has(word)
  )));
};

const hasCategory = (matchedSignals: readonly string[], category: ReadonlySet<string>): boolean => (
  matchedSignals.some((signal) => category.has(signal))
);

const confidenceFor = (matchedSignals: readonly string[]): number => Math.min(1, Number((0.55 + matchedSignals.length * 0.12).toFixed(2)));

const proofTextFor = (transcript: readonly Word[], matchedSignals: readonly string[]): string => {
  const firstMatchedIndex = transcript.findIndex((word) => matchedSignals.includes(normalizeSignal(word.text)));
  const start = firstMatchedIndex >= 0 ? Math.max(0, firstMatchedIndex - 1) : 0;
  const words = transcript.slice(start, start + 4).map((word) => word.text.replace(/[.!?]+$/g, ""));
  return words.length > 0 ? words.join(" ") : matchedSignals.slice(0, 3).join(" ");
};

export const buildJosephTalkingHeadMacroRig = ({
  semanticSummary,
  transcript,
  pipPlan,
}: JosephTalkingHeadMacroRigInput): JosephMacroRigPlan | null => {
  const matchedSignals = matchedSignalsFor({semanticSummary, transcript});
  const valid = hasCategory(matchedSignals, PROOF_SIGNALS) && (
    hasCategory(matchedSignals, DATA_SIGNALS) || hasCategory(matchedSignals, EXHIBIT_SIGNALS)
  );

  if (!valid) {
    return null;
  }

  const heroZone = pipPlan.typographyZones.find((zone) => zone.role === "hero") ?? pipPlan.typographyZones[0];
  const supportZone = pipPlan.typographyZones.find((zone) => zone.role === "support") ?? heroZone;
  const captionZone = pipPlan.typographyZones.find((zone) => zone.role === "caption") ?? supportZone ?? heroZone;
  const assetBoard = pipPlan.backgroundLayers.find((layer) => layer.role === "asset_board");

  const typographySlots = [
    {
      role: "proof_headline" as const,
      text: "PROOF",
      leftPercent: heroZone?.leftPercent ?? 7,
      topPercent: heroZone?.topPercent ?? 14,
      widthPercent: heroZone?.widthPercent ?? 43,
      heightPercent: Math.max(10, Math.min(18, heroZone?.heightPercent ?? 12)),
      zIndex: 42,
    },
    {
      role: "data_label" as const,
      text: matchedSignals.find((signal) => DATA_SIGNALS.has(signal))?.toUpperCase() ?? "DATA",
      leftPercent: supportZone?.leftPercent ?? 8,
      topPercent: supportZone?.topPercent ?? 45,
      widthPercent: supportZone?.widthPercent ?? 38,
      heightPercent: Math.max(8, Math.min(14, supportZone?.heightPercent ?? 10)),
      zIndex: 41,
    },
    {
      role: "exhibit_caption" as const,
      text: proofTextFor(transcript, matchedSignals),
      leftPercent: captionZone?.leftPercent ?? 8,
      topPercent: captionZone?.topPercent ?? 82,
      widthPercent: captionZone?.widthPercent ?? 42,
      heightPercent: Math.max(8, Math.min(12, captionZone?.heightPercent ?? 10)),
      zIndex: 40,
    },
  ];

  const assetPlacements = assetBoard
    ? [{
      role: "exhibit_board" as const,
      leftPercent: assetBoard.leftPercent,
      topPercent: assetBoard.topPercent,
      widthPercent: assetBoard.widthPercent,
      heightPercent: assetBoard.heightPercent,
      zIndex: 24,
    }]
    : [];

  return {
    version: "joseph-macro-rig-v1",
    rigId: "talking-head-proof-data-exhibit",
    semanticTrigger: {
      valid: true,
      triggerKind: "proof_data_exhibit",
      matchedSignals,
      confidence: confidenceFor(matchedSignals),
    },
    inputs: {
      sourceTrackId: pipPlan.sourceTrackId ?? "primary",
      requiredSceneRoles: ["talking_head", "proof", "data_exhibit"],
      semanticSignals: matchedSignals,
    },
    sceneFacts: {
      momentKind: "proof_data_exhibit",
      talkingHeadPresent: true,
      exhibitAnchors: matchedSignals,
      proofText: proofTextFor(transcript, matchedSignals),
    },
    assetRequirements: [
      {
        role: "speaker_source",
        required: true,
        acceptableFallback: "omit_macro_rig",
        semanticNeed: "Talking-head source track must be available for a proof/data/exhibit rig.",
      },
      {
        role: "exhibit_board",
        required: false,
        acceptableFallback: "typography_only_exhibit",
        semanticNeed: "Proof/data evidence needs a visible exhibit surface when an asset board exists.",
      },
      {
        role: "proof_typography",
        required: true,
        acceptableFallback: "use_pip_safe_zone",
        semanticNeed: "Proof and data labels must remain readable beside the talking head.",
      },
    ],
    renderFields: {
      pipPlan,
      typographySlots,
      assetPlacements,
    },
    failureFallbacks: [
      {
        tag: "macro_rig_semantic_trigger_missing",
        reason: "Do not render the rig unless proof/data/exhibit semantics are present.",
        action: "omit_macro_rig",
      },
      {
        tag: "macro_rig_exhibit_asset_unavailable",
        reason: "Use typography if no exhibit asset is resolved.",
        action: "use_typography_only_exhibit",
      },
      {
        tag: "macro_rig_typography_collision",
        reason: "Keep proof/data typography inside PiP-safe zones if the subject frame overlaps.",
        action: "use_pip_safe_zone",
      },
    ],
  };
};
