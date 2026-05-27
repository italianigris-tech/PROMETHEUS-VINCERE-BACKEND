import {
  createFailureReport,
  createStageDiagnostics,
  type TypographyManifest
} from "../contracts/manifests";
import {
  createDefaultLocalPremiumFontRegistry,
  type LocalPremiumFontRegistry
} from "./LocalPremiumFontRegistry";

export interface TypographyVectorPort {
  resolveFontsByVibe(input: {
    intentTags: string[];
    role: "display" | "support" | "accent";
  }): Promise<{
    familyId: string;
    familyName: string;
    publicUrls: string[];
  } | null>;
}

export class TypographyOrchestrator {
  constructor(
    private readonly vectorPort: TypographyVectorPort | null,
    private readonly localRegistry: LocalPremiumFontRegistry = createDefaultLocalPremiumFontRegistry()
  ) {}

  async createTypographyManifest(input: {
    intentTags: string[];
  }): Promise<TypographyManifest> {
    const startedAt = Date.now();
    const selectedFamilies: TypographyManifest["selectedFamilies"] = [];
    let degradation: TypographyManifest["degradation"] = null;

    try {
      const display = await this.vectorPort?.resolveFontsByVibe({
        intentTags: input.intentTags,
        role: "display"
      });

      if (display) {
        selectedFamilies.push({
          role: "display",
          familyId: display.familyId,
          familyName: display.familyName,
          source: "zilliz",
          publicUrls: display.publicUrls
        });
      }
    } catch (error) {
      degradation = createFailureReport({
        stage: "TypographyStage",
        message: error instanceof Error ? error.message : String(error),
        failingSchema: "TypographyVectorPort.resolveFontsByVibe",
        fallbackRationale: "Zilliz typography retrieval failed; using visible local premium registry degradation path.",
        confidenceCollapse: 0.38,
        degradedSubsystems: ["zilliz", "typography-retrieval"]
      });
    }

    if (selectedFamilies.length === 0) {
      const localDisplay = this.localRegistry.findByIntent(input.intentTags, "display");
      if (localDisplay) {
        selectedFamilies.push({
          role: "display",
          familyId: localDisplay.familyId,
          familyName: localDisplay.familyName,
          source: "local-premium-registry",
          publicUrls: localDisplay.publicUrls
        });
      }
    }

    const localSupport = this.localRegistry.findByIntent(input.intentTags, "support");
    if (localSupport) {
      selectedFamilies.push({
        role: "support",
        familyId: localSupport.familyId,
        familyName: localSupport.familyName,
        source: "local-premium-registry",
        publicUrls: localSupport.publicUrls
      });
    }

    return {
      selectedFamilies,
      diagnostics: createStageDiagnostics({
        stage: "TypographyStage",
        health: degradation ? "degraded" : "healthy",
        healthScore: degradation ? 0.72 : 1,
        confidence: degradation ? 0.62 : 0.9,
        latencyMs: Date.now() - startedAt,
        fallbackActivated: degradation !== null,
        fallbackReason: degradation?.fallbackRationale ?? null,
        warnings: degradation ? [degradation.message] : []
      }),
      degradation
    };
  }
}
