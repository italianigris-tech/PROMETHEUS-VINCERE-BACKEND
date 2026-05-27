import {resolveCaptionEditorialDecision} from "../../lib/motion-platform/caption-editorial-engine";
import {
  classifyTypographyContentEnergy,
  classifyTypographySpeechPacing,
  selectTypographyTreatment,
  type TypographySelection,
  type TypographyTextRole
} from "../../lib/typography-policy";
import type {AgentProposal, CreativeAgent, CreativeContext, CreativeMoment} from "../types";
import {extractCreativeKeywords} from "../assets/asset-search";
import {clamp01, hashString, normalizeText} from "../utils";

const pickStyleToken = (moment: CreativeMoment, typography: TypographySelection): string => {
  const text = normalizeText(moment.transcriptText);
  if (/(mistake|wrong|bottleneck|risk|problem|avoid|lose)/.test(text)) {
    return "danger-red";
  }
  if (/(growth|scale|progress|increase|better|more|faster|up)/.test(text)) {
    return "hormozi-yellow";
  }
  if (typography.role === "tech-overlay") {
    return "cinematic-blue";
  }
  if (moment.momentType === "question") {
    return "cinematic-blue";
  }
  if (moment.momentType === "title" || moment.momentType === "hook") {
    return "premium-white";
  }
  return "apple-minimal";
};

const selectKeywords = (moment: CreativeMoment): string[] => {
  return extractCreativeKeywords(moment).slice(0, moment.momentType === "keyword" ? 2 : 4);
};

const mapMomentTypeToTypographyRole = (moment: CreativeMoment): TypographyTextRole => {
  if (moment.momentType === "hook") {
    return "hook";
  }
  if (moment.momentType === "title") {
    return "headline";
  }
  if (moment.momentType === "transition") {
    return "transition-card";
  }
  if (moment.momentType === "keyword" || moment.momentType === "payoff") {
    return "keyword";
  }
  if (moment.momentType === "ambient") {
    return "quote";
  }
  if (/\b(ai|data|system|workflow|prompt|code|agent|model|command|terminal)\b/i.test(moment.transcriptText)) {
    return "tech-overlay";
  }
  return "subtitle";
};

export class TextAgent implements CreativeAgent<CreativeContext> {
  id = "text-agent";
  label = "Text";

  async propose(context: CreativeContext, moment: CreativeMoment): Promise<AgentProposal[]> {
    const directive = context.judgmentDirectives?.[moment.id];
    const approvedTypographyCandidate = directive?.approvedAssetCandidates.find((candidate) => candidate.selected && !candidate.inspirationOnly && candidate.assetType === "typography") ?? null;
    const keywords = selectKeywords(moment);
    const editorialDecision = resolveCaptionEditorialDecision({
      chunk: context.chunks.find((chunk) => moment.chunkIds?.includes(chunk.id)) ?? context.chunks[0]!,
      captionProfileId: context.captionProfileId ?? undefined,
      motionTier: context.motionTier ?? undefined,
      sequencePlan: context.sequencePlan
    });

    const basePriority = Math.round(moment.importance * 100);
    const baseConfidence = clamp01(0.55 + moment.importance * 0.35 + moment.energy * 0.1);
    const keywordText = directive?.editorialDoctrine.heroText ?? directive?.emphasisTargets.punchWord ?? keywords[0] ?? moment.transcriptText;
    const supportText = directive?.editorialDoctrine.supportText ?? moment.transcriptText;
    const captain = directive?.editorialDoctrine.captain ?? "text";
    const allowIndependentTypography = directive?.editorialDoctrine.allowIndependentTypography ?? true;
    const conceptReductionMode = directive?.editorialDoctrine.conceptReductionMode ?? "literal-caption";
    const keywordVisualRole = captain === "text" ? "captain" : captain === "restraint" ? "restraint" : "support";
    const captionVisualRole = captain === "text" && conceptReductionMode === "literal-caption" ? "captain" : "support";
    const hasOcclusionRisk = moment.momentType === "hook" || moment.momentType === "title" || moment.importance >= 0.9;
    const contentEnergy = classifyTypographyContentEnergy(moment.energy);
    const speechPacing = classifyTypographySpeechPacing({
      durationMs: Math.max(1, moment.endMs - moment.startMs),
      wordCount: Math.max(1, moment.words.length)
    });
    const textRole = mapMomentTypeToTypographyRole(moment);
    const keywordTypography = selectTypographyTreatment({
      text: keywordText,
      role: textRole,
      contentEnergy,
      speechPacing,
      wordCount: Math.max(1, keywordText.split(/\s+/).filter(Boolean).length),
      emphasisWordCount: Math.min(2, keywords.length),
      semanticIntent: context.chunks.find((chunk) => moment.chunkIds?.includes(chunk.id))?.semantic?.intent ?? null
    });
    const captionTypography = selectTypographyTreatment({
      text: moment.transcriptText,
      role: "subtitle",
      contentEnergy,
      speechPacing,
      wordCount: Math.max(1, moment.words.length),
      emphasisWordCount: Math.min(3, keywords.length),
      semanticIntent: context.chunks.find((chunk) => moment.chunkIds?.includes(chunk.id))?.semantic?.intent ?? null
    });

    const proposals: AgentProposal[] = [
      {
        id: `proposal-text-${moment.id}-keyword`,
        agentId: this.id,
        momentId: moment.id,
        type: "text",
        startMs: moment.startMs,
        endMs: moment.endMs,
        priority: basePriority + 22 + (directive?.emphasisTargets.isolatePunchWord ? 8 : 0) + (captain === "text" ? 14 : captain === "restraint" ? -20 : -8),
        confidence: baseConfidence,
        renderCost: "low",
        requiresMatting: hasOcclusionRisk && directive?.spatialConstraints.behindSubjectTextLegal !== false,
        requiresVideoFrames: false,
        compatibleWith: ["motion", "sound", "background", "asset"],
        payload: {
          mode: "keyword-only",
          text: keywordText,
          emphasizedWords: keywords.slice(0, 2),
          animation: keywordTypography.pattern.id,
          styleToken: approvedTypographyCandidate?.styleFamily.some((entry) => /hormozi/i.test(entry))
            ? "hormozi-yellow"
            : pickStyleToken(moment, keywordTypography),
          positionIntent: directive?.requestedPlacementModes[0] ?? (hasOcclusionRisk ? "hero-center" : "center"),
          requiresMatting: hasOcclusionRisk && directive?.spatialConstraints.behindSubjectTextLegal !== false,
          isolatePunchWord: directive?.emphasisTargets.isolatePunchWord ?? false,
          visualRole: keywordVisualRole,
          supportText: captain === "text" ? null : supportText,
          accentColor: editorialDecision.textColor,
          contrastRequirement: editorialDecision.surfaceTone === "dark" ? "light-on-dark" : editorialDecision.surfaceTone === "light" ? "dark-on-light" : "auto",
          typography: keywordTypography,
          approvedRetrievedCandidateId: approvedTypographyCandidate?.assetId,
          approvedRetrievedCandidateIds: approvedTypographyCandidate ? [approvedTypographyCandidate.assetId] : []
        },
        reasoning: approvedTypographyCandidate
          ? `Moment ${moment.momentType} uses approved typography candidate ${approvedTypographyCandidate.assetId} alongside ${keywordTypography.pattern.id}.`
          : `Moment ${moment.momentType} with importance ${moment.importance.toFixed(2)} favors ${keywordTypography.pattern.id} for a ${keywordTypography.role} treatment.`,
        conflictsWith: moment.momentType === "ambient" ? ["title-card"] : undefined
      } satisfies AgentProposal,
      {
        id: `proposal-text-${moment.id}-caption`,
        agentId: this.id,
        momentId: moment.id,
        type: "text",
        startMs: moment.startMs,
        endMs: moment.endMs,
        priority: basePriority + 8 - (directive?.spatialConstraints.denseTextAllowed === false ? 12 : 0) + (captionVisualRole === "captain" ? 10 : captain === "restraint" ? -6 : 0),
        confidence: Math.max(0.42, baseConfidence - 0.1),
        renderCost: "low",
        payload: {
          mode: "full-caption",
          text: supportText,
          emphasizedWords: keywords.slice(0, 3),
          animation: captionTypography.pattern.id,
          styleToken: pickStyleToken(moment, captionTypography),
          positionIntent: "lower-third",
          requiresMatting: false,
          visualRole: captionVisualRole,
          accentColor: editorialDecision.textColor,
          contrastRequirement: "auto",
          typography: captionTypography,
          approvedRetrievedCandidateId: approvedTypographyCandidate?.assetId,
          approvedRetrievedCandidateIds: approvedTypographyCandidate ? [approvedTypographyCandidate.assetId] : []
        },
        reasoning: `Fallback caption treatment preserves clarity with ${captionTypography.pattern.id} instead of a generic subtitle animation.`
      } satisfies AgentProposal
    ];

    if ((moment.momentType === "title" || moment.momentType === "hook" || moment.momentType === "payoff") && allowIndependentTypography) {
      const titleTypography = selectTypographyTreatment({
        text: moment.transcriptText,
        role: moment.momentType === "payoff" ? "cta" : "headline",
        contentEnergy,
        speechPacing,
        wordCount: Math.max(1, moment.words.length),
        emphasisWordCount: Math.min(2, keywords.length),
        semanticIntent: context.chunks.find((chunk) => moment.chunkIds?.includes(chunk.id))?.semantic?.intent ?? null
      });
      proposals.push({
        id: `proposal-text-${moment.id}-title`,
        agentId: this.id,
        momentId: moment.id,
        type: "text",
        startMs: moment.startMs,
        endMs: moment.endMs,
        priority: basePriority + 30 + (hashString(moment.id) % 6) - (directive?.spatialConstraints.denseTextAllowed === false ? 18 : 0),
        confidence: Math.min(0.97, baseConfidence + 0.08),
        renderCost: "medium",
        requiresMatting: hasOcclusionRisk && directive?.spatialConstraints.behindSubjectTextLegal !== false,
        payload: {
          mode: "title-card",
          text: moment.transcriptText.toUpperCase(),
          emphasizedWords: keywords.slice(0, 2),
          animation: titleTypography.pattern.id,
          styleToken: moment.momentType === "payoff" || approvedTypographyCandidate?.styleFamily.some((entry) => /hormozi/i.test(entry))
            ? "hormozi-yellow"
            : pickStyleToken(moment, titleTypography),
          positionIntent: directive?.requestedPlacementModes[0] ?? "hero-center",
          requiresMatting: hasOcclusionRisk && directive?.spatialConstraints.behindSubjectTextLegal !== false,
          visualRole: "captain",
          accentColor: editorialDecision.textColor,
          contrastRequirement: editorialDecision.surfaceTone === "dark" ? "light-on-dark" : "auto",
          typography: titleTypography,
          approvedRetrievedCandidateId: approvedTypographyCandidate?.assetId,
          approvedRetrievedCandidateIds: approvedTypographyCandidate ? [approvedTypographyCandidate.assetId] : []
        },
        reasoning: `Short high-impact moments can carry ${titleTypography.pattern.id} as a title-card treatment instead of generic captions.`
      } satisfies AgentProposal);
    }

    if (moment.momentType === "ambient" || moment.energy < 0.34 || directive?.minimalismLevel === "minimal") {
      proposals.push({
        id: `proposal-text-${moment.id}-none`,
        agentId: this.id,
        momentId: moment.id,
        type: "text",
        startMs: moment.startMs,
        endMs: moment.endMs,
        priority: Math.max(1, basePriority - 12 + (directive?.minimalismLevel === "minimal" ? 24 : 0)),
        confidence: 0.74,
        renderCost: "low",
        payload: {
          mode: "no-text",
          text: "",
          emphasizedWords: [],
          animation: "none",
          styleToken: "hidden",
          positionIntent: "center",
          requiresMatting: false,
          visualRole: "restraint",
          accentColor: editorialDecision.textColor,
          contrastRequirement: "auto",
          approvedRetrievedCandidateId: approvedTypographyCandidate?.assetId,
          approvedRetrievedCandidateIds: approvedTypographyCandidate ? [approvedTypographyCandidate.assetId] : []
        },
        reasoning: `This moment is better left to motion, background, or sound than to another visible caption.`
      } satisfies AgentProposal);
    }

    const filtered = directive?.spatialConstraints.denseTextAllowed === false
      ? proposals.filter((proposal) => String(proposal.payload["mode"] ?? "") !== "full-caption" || moment.words.length <= 6)
      : proposals;

    return !allowIndependentTypography && captain !== "text"
      ? filtered.filter((proposal) => String(proposal.payload["mode"] ?? "") !== "title-card")
      : filtered;
  }
}
