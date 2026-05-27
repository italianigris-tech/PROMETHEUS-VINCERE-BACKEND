import {createFailureReport, type CognitiveFailureReport} from "../contracts/manifests";

export type TimelineIntegrityInput = {
  durationMs: number;
  fps: number;
  durationInFrames: number;
  sourceDurationMs: number;
};

export type TimelineIntegrityResult = {
  valid: boolean;
  canonicalDurationMs: number;
  expectedFrames: number;
  failures: CognitiveFailureReport[];
};

export class TimelineIntegrityValidator {
  validate(input: TimelineIntegrityInput): TimelineIntegrityResult {
    const canonicalDurationMs = Math.max(1, input.sourceDurationMs || input.durationMs);
    const expectedFrames = Math.max(1, Math.ceil((canonicalDurationMs / 1000) * input.fps));
    const failures: CognitiveFailureReport[] = [];

    if (Math.abs(input.durationMs - canonicalDurationMs) > 34) {
      failures.push(createFailureReport({
        stage: "RenderManifestStage",
        message: `Render duration ${input.durationMs}ms does not match canonical source duration ${canonicalDurationMs}ms.`,
        failingSchema: "RenderManifest.durationMs",
        invalidReasoning: ["duration-mismatch"],
        degradedSubsystems: ["timeline", "render-duration"],
        confidenceCollapse: 0.8
      }));
    }

    if (input.durationInFrames !== expectedFrames) {
      failures.push(createFailureReport({
        stage: "RenderManifestStage",
        message: `Frame count ${input.durationInFrames} does not match expected ${expectedFrames}.`,
        failingSchema: "RenderManifest.durationInFrames",
        invalidReasoning: ["frame-count-mismatch"],
        degradedSubsystems: ["timeline", "remotion-duration"],
        confidenceCollapse: 0.8
      }));
    }

    return {
      valid: failures.length === 0,
      canonicalDurationMs,
      expectedFrames,
      failures
    };
  }
}
