import path from "node:path";
import {stat} from "node:fs/promises";

import type {CreativeDecisionManifest} from "../contracts/creative-decision-manifest";
import {
  type RenderFeatureActivation,
  type RenderStyleAuthority
} from "../contracts/render-diagnostics";
import {generateHyperFramesComposition} from "../composition/hyperframes-composition-generator";
import type {RenderAdapter} from "./adapters/render-adapter";
import {LocalHyperFramesRenderAdapter} from "./adapters/local-hyperframes-render-adapter";

export type PreviewArtifactResult = {
  previewUrl: string;
  localPath: string;
  renderTimeMs: number;
  engine: "hyperframes" | "remotion";
  artifactKind: "html_composition" | "video";
  contentType: string;
  compositionGenerationTimeMs: number;
  diagnostics: {
    warnings: string[];
    compositionDir: string;
    fontProof: {
      fontsRequestedFromManifest: string[];
      fontFilesResolved: string[];
      fontFilesLoadedIntoComposition: string[];
      fontCssGenerated: boolean;
      fallbackFontsUsed: string[];
      fallbackReasons: string[];
    };
    animationProof: {
      animationRequestedFromManifest: string | null;
      animationRetrievedFromMilvus: boolean;
      retrievedAnimationId: string | null;
      gsapTimelineGenerated: boolean;
      fallbackAnimationUsed: boolean;
      fallbackReasons: string[];
    };
    features: {
      gsap: RenderFeatureActivation;
      kineticTypography: RenderFeatureActivation;
      fonts: RenderFeatureActivation;
    };
    styleAuthority: RenderStyleAuthority;
  };
};

const mergeFeatureActivation = ({
  requested,
  activated,
  fallbackReason,
  artifactPath,
  evidence
}: {
  requested: boolean;
  activated: boolean;
  fallbackReason?: string;
  artifactPath?: string;
  evidence?: string[];
}): RenderFeatureActivation => ({
  requested,
  activated,
  fallbackUsed: requested && !activated,
  fallbackReason: requested && !activated ? fallbackReason : undefined,
  artifactPath,
  evidence: evidence ?? []
});

export class PreviewRenderService {
  private readonly adapter: RenderAdapter;

  public constructor(adapter?: RenderAdapter) {
    this.adapter = adapter ?? new LocalHyperFramesRenderAdapter();
  }

  public async createPreviewArtifact({
    manifest,
    sessionRenderDir,
    sourceMediaPath,
    enableGsapMotion = true,
    enableKineticTypography = true,
    preferHtmlComposition = false
  }: {
    manifest: CreativeDecisionManifest;
    sessionRenderDir: string;
    sourceMediaPath?: string | null;
    enableGsapMotion?: boolean;
    enableKineticTypography?: boolean;
    preferHtmlComposition?: boolean;
  }): Promise<PreviewArtifactResult> {
    const composition = await generateHyperFramesComposition({
      manifest,
      outputRootDir: sessionRenderDir,
      enableGsapMotion,
      enableKineticTypography
    });
    const renderResult = await this.adapter.render({
      sessionId: manifest.jobId,
      compositionDir: composition.compositionDir,
      outputDir: sessionRenderDir,
      manifest,
      sourceMediaPath,
      preferHtmlComposition
    });
    await stat(renderResult.localPath);
    const compositionEvidence = composition.diagnostics.features.gsap.evidence;
    const actualArtifactPath = path.relative(sessionRenderDir, renderResult.localPath) || path.basename(renderResult.localPath);
    const htmlArtifactActivated = renderResult.artifactKind === "html_composition";
    const actualGsapFeature = mergeFeatureActivation({
      requested: composition.diagnostics.features.gsap.requested,
      activated: htmlArtifactActivated && composition.diagnostics.features.gsap.activated,
      fallbackReason: "The preview artifact was rendered through the FFmpeg drawtext video path, so browser GSAP choreography was bypassed.",
      artifactPath: actualArtifactPath,
      evidence: htmlArtifactActivated
        ? compositionEvidence
        : [`Preview artifact kind ${renderResult.artifactKind} does not execute browser GSAP.`]
    });
    const actualKineticFeature = mergeFeatureActivation({
      requested: composition.diagnostics.features.kineticTypography.requested,
      activated: htmlArtifactActivated && composition.diagnostics.features.kineticTypography.activated,
      fallbackReason: "The preview artifact did not use the browser word-timed composition path.",
      artifactPath: actualArtifactPath,
      evidence: htmlArtifactActivated
        ? composition.diagnostics.features.kineticTypography.evidence
        : [`Preview artifact kind ${renderResult.artifactKind} flattened caption motion into the rendered video path.`]
    });
    const actualFontFeature = mergeFeatureActivation({
      requested: composition.diagnostics.features.fonts.requested,
      activated: composition.diagnostics.features.fonts.activated,
      fallbackReason: composition.diagnostics.features.fonts.fallbackReason,
      artifactPath: actualArtifactPath,
      evidence: composition.diagnostics.features.fonts.evidence
    });
    const actualStyleAuthority: RenderStyleAuthority = {
      ...composition.diagnostics.styleAuthority,
      styleDeviationWarnings: htmlArtifactActivated
        ? composition.diagnostics.styleAuthority.styleDeviationWarnings
        : [
            ...composition.diagnostics.styleAuthority.styleDeviationWarnings,
            "Preview artifact rendered through the video fallback path, so browser GSAP/kinetic premium styling was only partially applied."
          ],
      evidence: htmlArtifactActivated
        ? composition.diagnostics.styleAuthority.evidence
        : [
            ...composition.diagnostics.styleAuthority.evidence,
            `Actual artifact kind ${renderResult.artifactKind} bypassed browser-executed premium motion.`
          ]
    };

    return {
      previewUrl: renderResult.previewUrl,
      localPath: renderResult.localPath,
      renderTimeMs: renderResult.renderTimeMs,
      engine: renderResult.engine,
      artifactKind: renderResult.artifactKind,
      contentType: renderResult.contentType,
      compositionGenerationTimeMs: composition.compositionGenerationTimeMs,
      diagnostics: {
        warnings: renderResult.warnings,
        compositionDir: path.relative(sessionRenderDir, composition.compositionDir) || "composition",
        fontProof: composition.diagnostics?.fontProof ?? {
          fontsRequestedFromManifest: [],
          fontFilesResolved: [],
          fontFilesLoadedIntoComposition: [],
          fontCssGenerated: false,
          fallbackFontsUsed: [],
          fallbackReasons: []
        },
        animationProof: {
          animationRequestedFromManifest:
            composition.diagnostics?.animationProof.animationRequestedFromManifest ?? null,
          animationRetrievedFromMilvus:
            composition.diagnostics?.animationProof.animationRetrievedFromMilvus ?? false,
          retrievedAnimationId:
            composition.diagnostics?.animationProof.retrievedAnimationId ?? null,
          gsapTimelineGenerated: actualGsapFeature.activated,
          fallbackAnimationUsed: actualGsapFeature.fallbackUsed,
          fallbackReasons: actualGsapFeature.fallbackReason ? [actualGsapFeature.fallbackReason] : []
        },
        features: {
          gsap: actualGsapFeature,
          kineticTypography: actualKineticFeature,
          fonts: actualFontFeature
        },
        styleAuthority: actualStyleAuthority
      }
    };
  }
}
