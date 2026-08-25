/**
 * Mini Landscape Runs — shared types for the long-form / 16:9 causal pipeline.
 * All stages import from here so the causal chain stays contract-stable.
 */
export const LANDSCAPE_CANVAS = {
    width: 1920,
    height: 1080,
    aspect: "16:9",
    safeMarginX: 0.06,
    safeMarginY: 0.08,
    speakerReturnMinSec: 1.6,
    transitionMinGapSec: 3.0,
};
export const JOSEPH_AUDIT_SOURCES = [
    "docs/audits/joseph-masterclass-feature-extraction-01.md",
    "docs/audits/joseph-cinematic-documentary-feature-extraction-02.md",
    "docs/audits/joseph-video-questions-feature-extraction-03.md",
    "docs/audits/joseph-viral-reels-premiere-feature-extraction-04.md",
    "docs/audits/joseph-viral-cinematic-reels-feature-extraction-05.md",
    "docs/joseph-five-audit-feature-synthesis.md",
];
