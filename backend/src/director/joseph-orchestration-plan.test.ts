import type { UnifiedRenderManifest } from "@prometheus/shared-types";
import { describe, expect, it } from "vitest";
import {
  generateJosephManifest,
  buildJosephOrchestrationPlan,
  generateCandidateGenomes,
  buildDoctrinePlans,
  DOCTRINE_BRANCHES,
} from "./joseph-director";

type CandidateGenome = UnifiedRenderManifest & {
  _doctrineBranch?: string;
  semanticIntent?: string;
};

const INPUT = {
  videoUrl: "file:///video.mp4",
  musicTrackUrl: "file:///music.mp3",
  transcript: [
    { text: "Listen", startMs: 420, endMs: 680, confidence: 0.98 },
    { text: "if", startMs: 700, endMs: 800, confidence: 0.95 },
    { text: "you", startMs: 820, endMs: 900, confidence: 0.96 },
    { text: "want", startMs: 920, endMs: 1100, confidence: 0.97 },
    { text: "to", startMs: 1120, endMs: 1200, confidence: 0.94 },
    { text: "win", startMs: 1220, endMs: 1500, confidence: 0.99 },
  ],
  beats: [500, 900, 1300, 1800, 2200, 2700, 3200, 3600],
  onsets: [420, 1220],
  energyCurve: [0.25, 0.32, 0.78, 0.41, 0.86, 0.44, 0.72, 0.91],
  durationMs: 4000,
  seed: 12345,
  profile: "joseph_aggressive" as const,
};

const normalizeManifest = ({
  jobId,
  createdAt,
  ...rest
}: UnifiedRenderManifest) => rest;

describe("buildJosephOrchestrationPlan", () => {
  it("exposes a planning snapshot between semantics and the manifest", () => {
    const plan = buildJosephOrchestrationPlan(INPUT);
    expect(plan.semanticSummary.intent).toContain("hook");
    expect(plan.visualPlan.emotionalArc.length).toBeGreaterThan(0);
    expect(plan.visualPlan.primitiveComposition.length).toBeGreaterThan(0);
    expect(plan.visualPlan.microAnimationTaxonomy).toEqual(
      expect.arrayContaining([
        "text_emphasis",
        "text_entry",
        "text_mutation",
        "accent_motion",
        "spatial_micro_motion",
      ]),
    );
    expect(plan.visualPlan.microAnimationPrimitives.length).toBeGreaterThan(0);
    expect(plan.visualPlan.pipComposition).toEqual(
      expect.arrayContaining(["pip:subject-dock"]),
    );
    expect(plan.temporalChoreography.cuts.length).toBeGreaterThan(0);
    expect(plan.temporalChoreography.sfx.length).toBeGreaterThan(0);
    expect(plan.temporalChoreography.doctrines).toEqual(
      expect.arrayContaining(["punch", "hold", "bloom", "ratchet", "glide", "suspend", "detonate"]),
    );
    expect(plan.temporalChoreography.segmentScores).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^hook:/),
        expect.stringMatching(/^cta:/),
      ]),
    );
    expect(plan.temporalChoreography.backgroundWindows.length).toBeGreaterThan(0);
    expect(plan.llmAuthority).toEqual([
      "semantic-extraction",
      "rhetorical-labeling",
    ]);
    expect(plan.directorialAuthority).toEqual([
      "primitive-composition",
      "temporal-choreography",
      "final-manifest",
    ]);
  });

  it("builds an inspectable PiP composition grammar for Joseph candidates", () => {
    const manifest = generateJosephManifest(INPUT);

    expect(manifest.josephPiP?.version).toBe("joseph-pip-v1");
    expect(manifest.videoTracks[0]?.id).toBe("primary");
    expect(manifest.josephPiP?.sourceTrackId).toBe("primary");
    expect(manifest.josephPiP?.frame.depth).toBe("subject");
    expect(manifest.josephPiP?.availableMotionBehaviors).toEqual(
      expect.arrayContaining(["enter", "dock", "expand", "collapse", "handoff"]),
    );
    expect(manifest.josephPiP?.activeMotion.map((motion) => motion.behavior)).toEqual(
      expect.arrayContaining(["enter", "dock", "handoff"]),
    );
    expect(manifest.josephPiP?.typographyZones.some((zone) => zone.role === "hero")).toBe(true);
    expect(manifest.josephPiP?.backgroundLayers.some((layer) => layer.role === "focus_field")).toBe(true);
    expect(manifest.josephPiP?.coexistenceRules.protectTypography).toBe(true);
  });

  it("threads Joseph choreography metadata through generated manifests", () => {
    const manifest = generateJosephManifest(INPUT);

    expect(manifest.josephChoreography?.version).toBe("joseph-choreography-v1");
    expect(manifest.josephChoreography?.segments.some((segment) => segment.role === "hook")).toBe(true);
    expect(manifest.josephChoreography?.segments.some((segment) => segment.role === "cta")).toBe(true);
    expect(manifest.josephChoreography?.timingPlan.backgroundWindows.length).toBeGreaterThan(0);
    expect(manifest.josephChoreography?.qualityAudit.score).toBeGreaterThanOrEqual(0);
    expect(manifest.josephChoreography?.qualityAudit.score).toBeLessThanOrEqual(1);
    expect(Array.isArray(manifest.josephChoreography?.qualityAudit.failures)).toBe(true);
  });
  it("can produce the same manifest from the same planning inputs", () => {
    const left = generateJosephManifest(INPUT);
    const right = generateJosephManifest(INPUT);
    expect(normalizeManifest(right)).toEqual(normalizeManifest(left));
  });
});

describe("doctrine branches (acceptance criterion: shared semantics, divergent planning)", () => {
  it("exposes a named doctrine-branch catalog", () => {
    expect(DOCTRINE_BRANCHES.length).toBeGreaterThanOrEqual(3);
    for (const branch of DOCTRINE_BRANCHES) {
      expect(typeof branch.id).toBe("string");
      expect(branch.id.length).toBeGreaterThan(0);
      expect(Array.isArray(branch.primitiveComposition)).toBe(true);
      expect(branch.primitiveComposition.length).toBeGreaterThan(0);
    }
    // every branch id is unique
    const ids = DOCTRINE_BRANCHES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("buildDoctrinePlans emits one plan per doctrine branch, all sharing the same observation", () => {
    const plans = buildDoctrinePlans(INPUT);
    expect(plans.length).toBe(DOCTRINE_BRANCHES.length);

    // Observation snapshot is shared (deterministic facts about the source).
    const observations = new Set(
      plans.map((p) => JSON.stringify(p.observationSnapshot)),
    );
    expect(observations.size).toBe(1);

    // Each plan declares a distinct doctrine branch.
    const branchIds = plans.map((p) => p.doctrineBranch.id);
    expect(new Set(branchIds).size).toBe(branchIds.length);

    // Primitive composition differs across doctrines (this is the divergent planning).
    const compositions = plans.map((p) =>
      JSON.stringify(p.visualPlan.primitiveComposition),
    );
    expect(new Set(compositions).size).toBeGreaterThan(1);
  });

  it("candidates share semantics but differ meaningfully in visual planning", () => {
    const candidates = generateCandidateGenomes(
      INPUT,
      DOCTRINE_BRANCHES.length,
    ) as CandidateGenome[];
    expect(candidates.length).toBeGreaterThanOrEqual(3);

    // Same semantics: every candidate shares the same semantic profile.
    const profiles = new Set(candidates.map((c) => c.creativeProfile.name));
    expect(profiles.size).toBe(1);

    // Same semantic intent derived from the same observation.
    const intents = new Set(candidates.map((c) => c.semanticIntent ?? ""));
    expect(candidates.some((c) => (c.semanticIntent ?? "").length > 0)).toBe(
      true,
    );
    expect(intents.size).toBe(1);

    // Divergent visual planning: distinct doctrine branches across the candidate set.
    const branches = candidates.map((c) => c._doctrineBranch ?? "");
    const uniqueBranches = new Set(branches);
    expect(uniqueBranches.size).toBeGreaterThan(1);

    // The candidate text treatments actually differ (the point of divergent planning).
    const textSignatures = new Set(
      candidates.map((c) =>
        JSON.stringify(c.textOverlays.map((o) => o.animation)),
      ),
    );
    expect(textSignatures.size).toBeGreaterThan(1);

    const primitiveSignatures = new Set(
      candidates.map((c) =>
        JSON.stringify(
          c.textOverlays.map((o) => o.microAnimation?.primitiveId ?? ""),
        ),
      ),
    );
    expect(primitiveSignatures.size).toBeGreaterThan(1);
    expect(
      candidates.every(
        (candidate) =>
          candidate.microAnimationAudit?.taxonomyVersion ===
            "joseph-micro-animation-v1" &&
          candidate.microAnimationAudit.primitiveIds.length > 0,
      ),
    ).toBe(true);
  });

  it("the same seed + doctrine branch reproduces the same manifest", () => {
    const plans = buildDoctrinePlans(INPUT);
    const left = buildDoctrinePlans(INPUT);
    expect(left.map((p) => JSON.stringify(p))).toEqual(
      plans.map((p) => JSON.stringify(p)),
    );

    const first = generateJosephManifest(INPUT);
    const second = generateJosephManifest(INPUT);
    expect(normalizeManifest(second)).toEqual(normalizeManifest(first));
  });
});
