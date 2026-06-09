// packages/learning/src/primitive-forger.ts
// Generates primitive implementations from detected techniques
// This is the CODE GENERATION phase — assigned to GPT-5.5 / O1 in production

import type {
  DetectedTechnique,
  NoveltyAssessment,
  Primitive,
  PrimitiveCategory,
  EffectScope,
  TargetType,
  MaterialConfig,
  PerformanceProfile,
  Provenance,
  ConfidenceScore,
} from "@prometheus/registry";

export interface ForgerConfig {
  targetModel: "gpt-5.5" | "claude-3.5" | "o1";
  strictMode: boolean;  // If true, reject any generation with placeholders
}

export const defaultForgerConfig: ForgerConfig = {
  targetModel: "gpt-5.5",
  strictMode: true,
};

/**
 * PrimitiveForger: The CODE GENERATION engine.
 * 
 * In production, this would:
 * 1. Construct a detailed prompt for the target model (GPT-5.5 / O1)
 * 2. Include: detected technique details, reference frame, scope requirements, parameter schema
 * 3. The model generates: GLSL shaders, TypeScript logic, R3F component, tests
 * 4. Output is validated for: no placeholders, correct scope, working test scene
 * 
 * For Phase 7.5C MVP, we provide the interface and a template generator.
 */
export class PrimitiveForger {
  private config: ForgerConfig;

  constructor(config: Partial<ForgerConfig> = {}) {
    this.config = { ...defaultForgerConfig, ...config };
  }

  async forge(
    detected: DetectedTechnique,
    assessment: NoveltyAssessment,
    videoId: string,
    frameRange: [number, number]
  ): Promise<Primitive> {
    if (!assessment.isNovel && assessment.recommendation === "extend-existing") {
      throw new Error("Extension of existing primitives is not yet implemented. Use create-new or manual extension.");
    }

    const id = this.generatePrimitiveId(detected);

    return {
      id,
      name: this.generateName(detected),
      category: detected.category,
      subcategory: detected.techniqueName,
      description: `Auto-generated primitive for ${detected.techniqueName} technique from ${videoId}`,
      visualSignature: `Detected: ${detected.techniqueName} with ${Object.keys(detected.parameters).join(", ")}`,
      implementation: {
        entryPoint: "src/index.ts",
        logicModule: "src/logic.ts",
        r3fComponent: "src/component.tsx",
      },
      parameterSchema: this.generateParameterSchema(detected),
      scope: detected.scope,
      targetType: this.inferTargetType(detected),
      performanceProfile: this.estimatePerformance(detected),
      provenance: {
        sourceVideo: videoId,
        sourceVideoTitle: "Auto-extracted",
        timestampStart: "00:00:000",
        timestampEnd: "00:00:000",
        frameRange,
        extractedBy: "pipeline",
        extractionDate: new Date().toISOString(),
        visualVerification: "pending",
      },
      confidence: {
        overall: detected.confidence * 0.8,
        visualAccuracy: detected.confidence,
        codeStability: 0.7,
        reuseCount: 0,
        lastUsed: new Date().toISOString(),
        failureCount: 0,
      },
      requires: [],
      conflicts: [],
      tags: ["auto-generated", detected.techniqueName, detected.category],
    };
  }

  private generatePrimitiveId(detected: DetectedTechnique): string {
    const base = detected.techniqueName.toLowerCase().replace(/\s+/g, "-");
    const scope = detected.scope.replace(/-/g, "");
    return `${base}-${scope}-v1`;
  }

  private generateName(detected: DetectedTechnique): string {
    return detected.techniqueName
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  private generateParameterSchema(detected: DetectedTechnique) {
    const parameters = Object.entries(detected.parameters).map(([key, value]) => {
      const type = typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "color";
      return {
        key,
        type,
        default: value,
        description: `Auto-extracted parameter for ${key}`,
        impact: "noticeable" as const,
        animatable: true,
      };
    });

    return { parameters };
  }

  private inferTargetType(detected: DetectedTechnique): TargetType {
    if (detected.category === "shader-fx" && detected.scope === "full-screen") return "post-process";
    if (detected.category === "ui-element") return "ui";
    if (detected.category === "camera") return "camera";
    if (detected.category === "background") return "scene";
    return "text";
  }

  private estimatePerformance(detected: DetectedTechnique): PerformanceProfile {
    // Rough estimation based on category and scope
    const baseProfiles: Record<PrimitiveCategory, Partial<PerformanceProfile>> = {
      "shader-fx": { gpuCost: "high" as const, vramMB: 64, drawCallOverhead: 0 },
      "deformation": { gpuCost: "medium" as const, vramMB: 32, drawCallOverhead: 1 },
      "motion": { gpuCost: "low" as const, vramMB: 8, drawCallOverhead: 0 },
      "transition": { gpuCost: "medium" as const, vramMB: 32, drawCallOverhead: 1 },
      "ui-element": { gpuCost: "low" as const, vramMB: 16, drawCallOverhead: 1 },
      "background": { gpuCost: "medium" as const, vramMB: 48, drawCallOverhead: 0 },
      "camera": { gpuCost: "low" as const, vramMB: 4, drawCallOverhead: 0 },
      "lighting": { gpuCost: "medium" as const, vramMB: 32, drawCallOverhead: 0 },
      "material": { gpuCost: "medium" as const, vramMB: 64, drawCallOverhead: 1 },
    };

    const base = baseProfiles[detected.category] || { gpuCost: "medium" as const, vramMB: 32, drawCallOverhead: 1 };

    return {
      gpuCost: base.gpuCost!,
      cpuCost: "low",
      fpsImpact30: 25,
      fpsImpact60: 50,
      vramMB: base.vramMB!,
      drawCallOverhead: base.drawCallOverhead!,
      requiresWebGL2: detected.category === "shader-fx",
      postProcessCompatible: true,
    };
  }
}

export default PrimitiveForger;
