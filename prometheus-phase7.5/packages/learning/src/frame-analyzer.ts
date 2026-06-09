// packages/learning/src/frame-analyzer.ts
// Vision-based frame analysis for reference video technique extraction
// NOTE: This is the interface definition. The actual vision model calls
// would be implemented via GPT-5.5 / O1 Vision API in production.

import type {
  FrameAnalysisReport,
  VideoSegment,
  DetectedTechnique,
  ColorPalette,
  MotionSignature,
  PrimitiveCategory,
  EffectScope,
} from "@prometheus/registry";

export interface FrameAnalyzerConfig {
  sampleRate: number;        // Analyze every Nth frame (e.g., 6 for 30fps video)
  minSegmentDuration: number;  // Minimum segment length in seconds
  confidenceThreshold: number; // Minimum detection confidence (0-1)
}

export const defaultAnalyzerConfig: FrameAnalyzerConfig = {
  sampleRate: 6,
  minSegmentDuration: 0.5,
  confidenceThreshold: 0.7,
};

/**
 * FrameAnalyzer: Accepts a video file, outputs a structured analysis report.
 * 
 * In production, this would:
 * 1. Extract frames at sampleRate intervals
 * 2. Send frames to GPT-5.5 / O1 Vision API with a structured prompt
 * 3. Parse the vision model's response into DetectedTechnique objects
 * 4. Aggregate techniques into VideoSegments
 * 
 * For Phase 7.5C MVP, we provide the interface and a mock implementation
 * that demonstrates the expected output format.
 */
export class FrameAnalyzer {
  private config: FrameAnalyzerConfig;

  constructor(config: Partial<FrameAnalyzerConfig> = {}) {
    this.config = { ...defaultAnalyzerConfig, ...config };
  }

  async analyze(videoId: string, videoBuffer: ArrayBuffer): Promise<FrameAnalysisReport> {
    // TODO: In production, this would:
    // 1. Use ffmpeg to extract frames
    // 2. Send frames to vision API
    // 3. Parse structured response

    // Mock implementation for demonstration
    return this.mockAnalyze(videoId);
  }

  private mockAnalyze(videoId: string): FrameAnalysisReport {
    // This mock simulates analysis of a Victor Ajayi-style reel
    return {
      videoId,
      totalFrames: 900,
      analyzedFrames: 150,
      sampleRate: this.config.sampleRate,
      segments: [
        {
          id: "seg-001",
          startFrame: 0,
          endFrame: 120,
          startTime: "00:00:000",
          endTime: "00:04:000",
          description: "Background fade-in with volumetric atmosphere",
          techniques: ["volumetric-bg-v1"],
          priority: 6,
        },
        {
          id: "seg-002",
          startFrame: 120,
          endFrame: 300,
          startTime: "00:04:000",
          endTime: "00:10:000",
          description: "Hero text entrance with per-word stagger and chrome material",
          techniques: ["chrome-text-v1", "per-word-stagger-v1"],
          priority: 10,
        },
        {
          id: "seg-003",
          startFrame: 300,
          endFrame: 450,
          startTime: "00:10:000",
          endTime: "00:15:000",
          description: "Chromatic aberration on text edges, bloom glow intensifies",
          techniques: ["chromatic-aberration-per-element-v1", "bloom-v1"],
          priority: 9,
        },
        {
          id: "seg-004",
          startFrame: 450,
          endFrame: 600,
          startTime: "00:15:000",
          endTime: "00:20:000",
          description: "UI pill stack entrance with z-depth and hover micro-interactions",
          techniques: ["pill-stack-v1"],
          priority: 8,
        },
      ],
      detectedTechniques: [
        {
          techniqueName: "chrome-text",
          category: "material" as PrimitiveCategory,
          confidence: 0.92,
          scope: "per-element" as EffectScope,
          affectedElements: ["text-glyph-0", "text-glyph-1", "text-glyph-2"],
          duration: 2.0,
          delay: 0,
          easing: "power3.out",
          parameters: { metalness: 1.0, roughness: 0.1, extrudeDepth: 0.4 },
          isNovel: false,
          similarPrimitiveId: "chrome-text-v1",
        },
        {
          techniqueName: "per-word-stagger",
          category: "motion" as PrimitiveCategory,
          confidence: 0.88,
          scope: "per-element" as EffectScope,
          affectedElements: ["word-0", "word-1", "word-2", "word-3", "word-4"],
          duration: 1.2,
          delay: 0.08,
          easing: "power3.out",
          parameters: { rotationAmplitude: 15, driftY: 0.5 },
          isNovel: false,
          similarPrimitiveId: "per-word-stagger-v1",
        },
        {
          techniqueName: "chromatic-aberration",
          category: "shader-fx" as PrimitiveCategory,
          confidence: 0.85,
          scope: "per-element" as EffectScope,
          affectedElements: ["text-group-0"],
          duration: 2.5,
          delay: 0.5,
          easing: "power2.out",
          parameters: { intensity: 0.015, angle: 45 },
          isNovel: false,
          similarPrimitiveId: "chromatic-aberration-per-element-v1",
        },
        {
          techniqueName: "bloom",
          category: "shader-fx" as PrimitiveCategory,
          confidence: 0.90,
          scope: "full-screen" as EffectScope,
          affectedElements: ["frame"],
          duration: 10.0,
          delay: 0,
          easing: "none",
          parameters: { strength: 0.4, radius: 0.5, threshold: 0.8 },
          isNovel: false,
          similarPrimitiveId: "bloom-v1",
        },
        {
          techniqueName: "pill-stack",
          category: "ui-element" as PrimitiveCategory,
          confidence: 0.82,
          scope: "per-group" as EffectScope,
          affectedElements: ["ui-pill-0", "ui-pill-1", "ui-pill-2"],
          duration: 1.0,
          delay: 2.0,
          easing: "back.out(1.7)",
          parameters: { depth: 3, shadowBlur: 0.5, hoverLift: 0.2 },
          isNovel: false,
          similarPrimitiveId: "pill-stack-v1",
        },
      ],
      colorPalette: {
        dominant: ["#0a0a1a", "#1a1a3a", "#FFFFFF"],
        accents: ["#FF0040", "#0080FF"],
        background: "#0a0a1a",
      },
      motionSignature: {
        averageSpeed: 0.6,
        easingPrevalence: { "power3.out": 0.4, "back.out": 0.2, "power2.out": 0.2, "none": 0.2 },
        transitionDensity: 0.3,
      },
    };
  }
}

export default FrameAnalyzer;
