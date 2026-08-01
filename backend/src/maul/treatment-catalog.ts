import {createHash} from "node:crypto";

import {
  maulTreatmentGenomePayloadSchema,
  type MaulTreatmentGenomePayload
} from "@prometheus/shared-types";

export type MaulTreatmentCatalogEntry = Omit<
  MaulTreatmentGenomePayload,
  "timelineArtifactId" | "referenceCorpusArtifactIds" | "replayKey"
>;

const rubric = [
  {id: "editorial_clarity", label: "Editorial clarity", weight: 25, minimumScore: 75},
  {id: "source_fidelity", label: "Source fidelity", weight: 25, minimumScore: 90},
  {id: "pacing_fit", label: "Pacing fit", weight: 20, minimumScore: 70},
  {id: "visual_hierarchy", label: "Visual hierarchy", weight: 15, minimumScore: 75},
  {id: "accessibility", label: "Accessibility", weight: 15, minimumScore: 85}
];

export const MAUL_TREATMENT_CATALOG: readonly MaulTreatmentCatalogEntry[] = [
  {
    treatmentId: "founder_podcast",
    catalogEntryName: "Founder Podcast",
    version: "maul-treatment/founder-podcast/v1",
    purpose: "Turn an authoritative spoken claim into a credible, speaker-led argument.",
    targetViewerState: "Attentive, trusting, and ready to accept the founder's earned conclusion.",
    grammar: {
      hook: "Open on the speaker's clearest consequential claim; never manufacture urgency.",
      escalation: "Tighten framing only as the speaker increases specificity or stakes.",
      proof: "Use transcript-led proof callouts and at most one source-grounded supporting insert.",
      reveal: "Let the speaker deliver the insight before graphics restate it.",
      payoff: "Return to a clean hero frame and preserve the decisive breath before the conclusion.",
      cta: "Use a restrained verbal or end-card CTA only when the source supports it."
    },
    pacing: {
      minCutsPerMinute: 8,
      maxCutsPerMinute: 18,
      protectedPausePolicy: "Preserve rhetorical pauses around claims, proof, and payoff; never cut for density alone."
    },
    visualPolicy: {
      framing: "speaker_first",
      accents: "proof_only",
      hierarchy: "face_then_claim_then_evidence",
      safeZone: "platform_ui_balanced"
    },
    audioPolicy: {
      voicePriority: "absolute",
      musicEnergy: "low_warm_bed",
      sfx: "rare_editorial_confirmation"
    },
    rendererInputs: {
      framing: {mode: "speaker_first", safeZone: "platform_ui_balanced", maxPunchInScale: 1.16, speakerPriority: true},
      caption: {
        profile: "authority_callout",
        maxWordsPerCard: 7,
        minFontScale: 0.84,
        hierarchy: ["claim", "proof", "qualifier"],
        typographyGrammar: "Sentence case with one evidence-bearing phrase emphasized; never karaoke every word."
      },
      motion: {
        intensity: "restrained",
        permittedPrimitives: ["modest_punch_in", "proof_callout", "gentle_parallax"],
        permittedTransitions: ["hard_cut", "short_dissolve"]
      },
      bRoll: {policy: "Only source-grounded evidence that clarifies the spoken proof.", maxInsertsPerMinute: 3},
      audio: {
        musicBehavior: "Warm licensed bed with no melodic competition under claims.",
        sfxBehavior: "One restrained confirmation accent on a proof or payoff beat.",
        duckingDb: -10
      }
    },
    repetitionBudget: {maxRepeatedPrimitivePerClip: 3, maxRecentFeedReuse: 2, lookbackPosts: 10},
    brandConstraints: ["Honor supplied type, color, and logo safe-area rules.", "Keep the speaker visually primary."],
    accessibilityConstraints: ["Captions remain readable for at least 900ms.", "No meaning is conveyed by color alone."],
    prohibitedMotifs: ["fake podcast waveform", "constant zoom pumping", "unsourced authority badge", "reaction meme insert"],
    judgmentLayer: {
      minimumWeightedScore: 80,
      rubric,
      failureClasses: [
        {id: "speaker_authority_diluted", label: "Speaker authority diluted", description: "Graphics or inserts compete with the principal speaker.", severity: "blocking"},
        {id: "proof_not_source_grounded", label: "Proof not source-grounded", description: "A callout asserts evidence absent from the transcript or source.", severity: "blocking"},
        {id: "rhetorical_pause_destroyed", label: "Rhetorical pause destroyed", description: "A meaningful pause is shortened or covered by an unnecessary event.", severity: "major"},
        {id: "punch_in_fatigue", label: "Punch-in fatigue", description: "Reframing repeats without an editorial reason.", severity: "major"},
        {id: "performative_podcast_styling", label: "Performative podcast styling", description: "Canned podcast motifs substitute for actual authority.", severity: "major"}
      ]
    },
    renderFallbacks: ["Use a centered speaker crop when tracking confidence is low.", "Drop supporting visuals before compromising caption legibility."],
    provenanceRules: ["Every proof callout must map to transcript timestamps.", "Reference Corpus media is never a render source."]
  },
  {
    treatmentId: "premium_direct_response",
    catalogEntryName: "Premium Direct Response",
    version: "maul-treatment/premium-direct-response/v1",
    purpose: "Compress a source-supported benefit, proof, and payoff into a decisive conversion arc.",
    targetViewerState: "Convinced by specific evidence and ready to take the source-supported next action.",
    grammar: {
      hook: "Lead with the strongest source-supported benefit or costly problem.",
      escalation: "Alternate claim, friction, and evidence at explicit editorial beats.",
      proof: "Show quantified proof only when its exact value exists in source evidence.",
      reveal: "Use one deliberate pattern interrupt to expose the mechanism or offer.",
      payoff: "Resolve into a concrete outcome with hierarchy concentrated on the benefit.",
      cta: "Render one governed CTA after proof, never before credibility is established."
    },
    pacing: {
      minCutsPerMinute: 20,
      maxCutsPerMinute: 34,
      protectedPausePolicy: "Protect comprehension pauses after quantified proof and immediately before the offer."
    },
    visualPolicy: {
      framing: "benefit_first",
      accents: "editorial_beats",
      hierarchy: "benefit_then_proof_then_cta",
      safeZone: "platform_ui_strict"
    },
    audioPolicy: {
      voicePriority: "high",
      musicEnergy: "rising_controlled",
      sfx: "beat_confirmations_only"
    },
    rendererInputs: {
      framing: {mode: "benefit_first", safeZone: "platform_ui_strict", maxPunchInScale: 1.28, speakerPriority: true},
      caption: {
        profile: "conversion_stack",
        maxWordsPerCard: 5,
        minFontScale: 0.9,
        hierarchy: ["benefit", "proof", "mechanism", "cta"],
        typographyGrammar: "Short stacked cards; numbers receive emphasis only when directly sourced."
      },
      motion: {
        intensity: "energetic",
        permittedPrimitives: ["benefit_card", "evidence_counter", "pattern_interrupt", "cta_lockup"],
        permittedTransitions: ["hard_cut", "directional_wipe", "match_scale"]
      },
      bRoll: {policy: "Use proof-bearing product or process visuals; decorative stock is forbidden.", maxInsertsPerMinute: 8},
      audio: {
        musicBehavior: "Licensed rhythmic bed may rise across escalation but must duck under every spoken claim.",
        sfxBehavior: "Short render-safe accents only on hook, verified proof, reveal, and CTA.",
        duckingDb: -12
      }
    },
    repetitionBudget: {maxRepeatedPrimitivePerClip: 2, maxRecentFeedReuse: 1, lookbackPosts: 8},
    brandConstraints: ["CTA and benefit colors must come from the approved brand/default kit.", "Never imitate a reference creator's identity markers."],
    accessibilityConstraints: ["Maintain 4.5:1 text contrast.", "No flash sequence exceeds accessibility limits."],
    prohibitedMotifs: ["fake scarcity timer", "unsupported percentage", "casino animation", "continuous whoosh track"],
    judgmentLayer: {
      minimumWeightedScore: 84,
      rubric,
      failureClasses: [
        {id: "unsupported_claim", label: "Unsupported claim", description: "A benefit, number, or outcome is not present in source evidence.", severity: "blocking"},
        {id: "cta_before_proof", label: "CTA before proof", description: "The call to action arrives before credibility is established.", severity: "blocking"},
        {id: "pattern_interrupt_spam", label: "Pattern-interrupt spam", description: "Interrupts occur without semantic editorial beats.", severity: "major"},
        {id: "conversion_hierarchy_blur", label: "Conversion hierarchy blur", description: "Benefit, proof, and CTA compete at the same visual level.", severity: "major"},
        {id: "cheap_urgency", label: "Cheap urgency", description: "Canned urgency devices undermine premium credibility.", severity: "major"}
      ]
    },
    renderFallbacks: ["Replace unavailable proof visuals with source-timestamped typography.", "Reduce motion before reducing evidence dwell time."],
    provenanceRules: ["Quantified claims require an exact transcript or supplied-evidence pointer.", "Music and SFX must be licensed and render-safe."]
  },
  {
    treatmentId: "minimal_expert",
    catalogEntryName: "Minimal Expert",
    version: "maul-treatment/minimal-expert/v1",
    purpose: "Make a nuanced explanation feel obvious through restraint, precision, and protected thinking time.",
    targetViewerState: "Calm, oriented, and confident that the idea is understood rather than merely advertised.",
    grammar: {
      hook: "Open with the cleanest surprising distinction or useful question.",
      escalation: "Add one conceptual layer at a time without artificial stakes.",
      proof: "Use a single precise label, diagram, or source-grounded example.",
      reveal: "Allow the insight to land in speech before a minimal visual lockup.",
      payoff: "Restate the governing principle with maximum visual quiet.",
      cta: "Prefer a low-pressure next step; omit it when the source contains none."
    },
    pacing: {
      minCutsPerMinute: 4,
      maxCutsPerMinute: 10,
      protectedPausePolicy: "Preserve rhetorical, comprehension, and emotional pauses unless they exceed the quality gate."
    },
    visualPolicy: {
      framing: "clarity_first",
      accents: "one_concept_at_a_time",
      hierarchy: "idea_then_speaker_then_detail",
      safeZone: "platform_ui_balanced"
    },
    audioPolicy: {
      voicePriority: "absolute",
      musicEnergy: "near_silent_texture",
      sfx: "none_by_default"
    },
    rendererInputs: {
      framing: {mode: "clarity_first", safeZone: "platform_ui_balanced", maxPunchInScale: 1.08, speakerPriority: true},
      caption: {
        profile: "precision_minimal",
        maxWordsPerCard: 9,
        minFontScale: 0.78,
        hierarchy: ["distinction", "explanation", "principle"],
        typographyGrammar: "Quiet sentence-case captions with selective term emphasis and generous margins."
      },
      motion: {
        intensity: "sparse",
        permittedPrimitives: ["soft_fade", "term_underline", "single_axis_diagram"],
        permittedTransitions: ["hard_cut", "crossfade"]
      },
      bRoll: {policy: "Only use an insert when the idea cannot be understood as clearly from speaker and type.", maxInsertsPerMinute: 2},
      audio: {
        musicBehavior: "Optional licensed tonal texture with no rhythmic pressure.",
        sfxBehavior: "Silent by default; one soft reveal accent is the maximum.",
        duckingDb: -14
      }
    },
    repetitionBudget: {maxRepeatedPrimitivePerClip: 2, maxRecentFeedReuse: 3, lookbackPosts: 12},
    brandConstraints: ["Favor approved neutral surfaces and one brand accent.", "Preserve whitespace even when more brand elements are available."],
    accessibilityConstraints: ["Captions must never overlap the face or platform controls.", "Motion must remain understandable with reduced-motion enabled."],
    prohibitedMotifs: ["kinetic word barrage", "decorative b-roll", "impact zoom", "gratuitous gradient mesh"],
    judgmentLayer: {
      minimumWeightedScore: 82,
      rubric,
      failureClasses: [
        {id: "clarity_obscured", label: "Clarity obscured", description: "Design adds concepts or hierarchy not warranted by the explanation.", severity: "blocking"},
        {id: "pause_overridden", label: "Pause overridden", description: "Motion, music, or cutting fills necessary comprehension space.", severity: "major"},
        {id: "minimalism_as_emptiness", label: "Minimalism as emptiness", description: "Restraint removes the one visual aid required for understanding.", severity: "major"},
        {id: "typographic_imprecision", label: "Typographic imprecision", description: "Line breaks or emphasis change the meaning of the explanation.", severity: "blocking"},
        {id: "unearned_motion", label: "Unearned motion", description: "An accent appears without a semantic reveal or transition.", severity: "major"}
      ]
    },
    renderFallbacks: ["Fall back to a stable centered crop and precision captions.", "Remove the optional music bed when voice separation is uncertain."],
    provenanceRules: ["Diagrams and labels must derive only from source meaning.", "Reference traits may guide policy but reference media and identity markers are excluded."]
  }
];

export const getMaulTreatmentCatalog = (): MaulTreatmentCatalogEntry[] =>
  MAUL_TREATMENT_CATALOG.map((entry) => structuredClone(entry));

export const materializeMaulTreatment = ({
  entry,
  timelineArtifactId,
  referenceCorpusArtifactIds
}: {
  entry: MaulTreatmentCatalogEntry;
  timelineArtifactId: string;
  referenceCorpusArtifactIds: string[];
}): MaulTreatmentGenomePayload => {
  const normalizedReferenceIds = [...new Set(referenceCorpusArtifactIds)].sort();
  const replayKey = createHash("sha256")
    .update(JSON.stringify({entry, timelineArtifactId, normalizedReferenceIds}))
    .digest("hex");
  return maulTreatmentGenomePayloadSchema.parse({
    ...entry,
    timelineArtifactId,
    referenceCorpusArtifactIds: normalizedReferenceIds,
    replayKey
  });
};
