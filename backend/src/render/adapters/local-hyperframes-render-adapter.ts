import path from "node:path";
import {stat, writeFile} from "node:fs/promises";

import type {RenderAdapter, RenderRequest, RenderResult} from "./render-adapter";
import {runFfmpegCommand} from "../../sound-engine/ffmpeg";

const escapeDrawtextValue = (value: string): string =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/,/g, "\\,")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");

const targetDimensionsByAspectRatio = (aspectRatio: "16:9" | "9:16" | "1:1"): {width: number; height: number} => {
  if (aspectRatio === "9:16") {
    return {width: 720, height: 1280};
  }
  if (aspectRatio === "1:1") {
    return {width: 720, height: 720};
  }
  return {width: 1280, height: 720};
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const buildVideoFallbackResult = async (
  request: RenderRequest,
  warning: string
): Promise<RenderResult> => {
  const indexHtmlPath = path.join(request.compositionDir, "index.html");
  await stat(indexHtmlPath);
  return {
    previewUrl: `/api/edit-sessions/${request.sessionId}/preview-artifact`,
    localPath: indexHtmlPath,
    engine: "hyperframes",
    renderTimeMs: 0,
    artifactKind: "html_composition",
    contentType: "text/html; charset=utf-8",
    warnings: [warning]
  };
};

const buildHtmlCompositionResult = async (
  request: RenderRequest,
  warning?: string
): Promise<RenderResult> => {
  const indexHtmlPath = path.join(request.compositionDir, "index.html");
  await stat(indexHtmlPath);
  return {
    previewUrl: `/api/edit-sessions/${request.sessionId}/preview-artifact`,
    localPath: indexHtmlPath,
    engine: "hyperframes",
    renderTimeMs: 0,
    artifactKind: "html_composition",
    contentType: "text/html; charset=utf-8",
    warnings: warning ? [warning] : []
  };
};

export class LocalHyperFramesRenderAdapter implements RenderAdapter {
  public async render(request: RenderRequest): Promise<RenderResult> {
    const startedAt = Date.now();
    if (request.preferHtmlComposition) {
      const result = await buildHtmlCompositionResult(request);
      result.renderTimeMs = Date.now() - startedAt;
      return result;
    }

    const sourceMediaPath = request.sourceMediaPath?.trim() ?? "";
    if (!sourceMediaPath) {
      const fallback = await buildVideoFallbackResult(
        request,
        "No local source media path was available, so preview fell back to HTML composition."
      );
      fallback.renderTimeMs = Date.now() - startedAt;
      return fallback;
    }

    try {
      await stat(sourceMediaPath);
    } catch {
      const fallback = await buildVideoFallbackResult(
        request,
        "Source media path was missing on disk, so preview fell back to HTML composition."
      );
      fallback.renderTimeMs = Date.now() - startedAt;
      return fallback;
    }

    const outputPath = path.join(request.outputDir, "preview-artifact.mp4");
    const filterScriptPath = path.join(request.outputDir, "preview-artifact.filtergraph.txt");
    const {width, height} = targetDimensionsByAspectRatio(request.manifest.scene.aspectRatio);
    const sceneDurationSeconds = Math.max(1, request.manifest.scene.durationMs / 1000);
    const fadeInSeconds = Math.max(0.18, request.manifest.animation.entryMs / 1000);
    const fadeOutSeconds = Math.max(0.16, request.manifest.animation.exitMs / 1000);
    const visibleEndSeconds = Math.max(
      fadeInSeconds + 0.5,
      Math.min(sceneDurationSeconds, request.manifest.source.transcriptSegment.endMs / 1000 || sceneDurationSeconds)
    );
    const lineCount = Math.max(request.manifest.typography.linePlan.lines.length, 1);
    const longestLineLength = request.manifest.typography.linePlan.lines.reduce((max, line) => Math.max(max, line.length), 0);
    const maxTextWidthPx = Math.round(width * 0.76);
    const usableHeightPx = Math.round(height * 0.34);
    const widthDrivenFontPx = Math.floor(maxTextWidthPx / Math.max(longestLineLength * 0.58, 6));
    const heightDrivenFontPx = Math.floor(usableHeightPx / Math.max(lineCount * 1.16 + 0.45, 1));
    const fontSize = clamp(Math.floor(Math.min(widthDrivenFontPx, heightDrivenFontPx)), 30, 82);
    const lineGap = clamp(Math.round(fontSize * 1.16), 36, 92);
    const baseY = Math.round(height * 0.42) - Math.floor((lineCount - 1) * lineGap * 0.5);

    const filters: string[] = [
      `scale=w=${width}:h=${height}:force_original_aspect_ratio=decrease`,
      `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`
    ];

    request.manifest.typography.linePlan.lines.forEach((line, index) => {
      const lineStart = 0.18 + (request.manifest.animation.staggerMs * index) / 1000;
      const lineEnd = Math.max(lineStart + fadeInSeconds + 0.5, visibleEndSeconds);
      const alphaExpression = `if(lt(t,${lineStart.toFixed(2)}),0,if(lt(t,${(lineStart + fadeInSeconds).toFixed(2)}),(t-${lineStart.toFixed(2)})/${fadeInSeconds.toFixed(2)},if(lt(t,${Math.max(lineStart + fadeInSeconds, lineEnd - fadeOutSeconds).toFixed(2)}),1,if(lt(t,${lineEnd.toFixed(2)}),(${lineEnd.toFixed(2)}-t)/${fadeOutSeconds.toFixed(2)},0))))`;
      const fontFile = request.manifest.typography.primaryFont.fileUrl?.trim() || "";
      const escapedFontFile = escapeDrawtextValue(fontFile);
      const escapedText = escapeDrawtextValue(line);
      filters.push(
        `drawtext=fontfile='${escapedFontFile}':text='${escapedText}':fontcolor=white:fontsize=${fontSize}:line_spacing=8:borderw=2:bordercolor=black@0.45:shadowcolor=black@0.72:shadowx=0:shadowy=6:x=(w-text_w)/2:y=${baseY + index * lineGap}:alpha='${alphaExpression}'`
      );
    });

    await writeFile(filterScriptPath, `${filters.join(",\n")}\n`, "utf8");

    try {
      await runFfmpegCommand([
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        sourceMediaPath,
        "-filter_script:v",
        filterScriptPath,
        "-t",
        sceneDurationSeconds.toFixed(2),
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        "-movflags",
        "+faststart",
        outputPath
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const fallback = await buildVideoFallbackResult(
        request,
        `Local FFmpeg video render failed and preview fell back to HTML composition. ${message}`
      );
      fallback.renderTimeMs = Date.now() - startedAt;
      return fallback;
    }

    await stat(outputPath);
    return {
      previewUrl: `/api/edit-sessions/${request.sessionId}/preview-artifact`,
      localPath: outputPath,
      engine: "hyperframes",
      renderTimeMs: Date.now() - startedAt,
      artifactKind: "video",
      contentType: "video/mp4",
      warnings: []
    };
  }
}
