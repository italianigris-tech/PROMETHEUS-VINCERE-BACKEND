import type {CreativeDecisionManifest} from "../../contracts/creative-decision-manifest";

export type RenderRequest = {
  sessionId: string;
  compositionDir: string;
  outputDir: string;
  manifest: CreativeDecisionManifest;
  sourceMediaPath?: string | null;
  preferHtmlComposition?: boolean;
};

export type RenderResult = {
  previewUrl: string;
  localPath: string;
  engine: "hyperframes" | "remotion";
  renderTimeMs: number;
  artifactKind: "html_composition" | "video";
  contentType: string;
  warnings: string[];
};

export interface RenderAdapter {
  render(request: RenderRequest): Promise<RenderResult>;
}
