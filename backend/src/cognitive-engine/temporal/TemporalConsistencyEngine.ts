import type {TemporalStateGraph} from "../contracts/manifests";

export type TemporalSceneInput = {
  id: string;
  startMs: number;
  endMs: number;
  emotionalTone: string;
  requestedIntensity: number;
  typographyEscalation: number;
  cameraEscalation: number;
  overlayEscalation: number;
  soundEscalation: number;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export class TemporalConsistencyEngine {
  buildTemporalStateGraph(scenes: TemporalSceneInput[]): TemporalStateGraph {
    const orderedScenes = [...scenes].sort((left, right) => left.startMs - right.startMs);
    const intensityCurve = orderedScenes.map((scene, index) => {
      const previous = orderedScenes[index - 1];
      const previousIntensity = previous ? clamp01(previous.requestedIntensity) : clamp01(scene.requestedIntensity);
      return clamp01(previousIntensity * 0.32 + clamp01(scene.requestedIntensity) * 0.68);
    });
    const pacingCurve = orderedScenes.map((scene, index) => {
      const durationMs = Math.max(1, scene.endMs - scene.startMs);
      const previous = orderedScenes[index - 1];
      const gapMs = previous ? Math.max(0, scene.startMs - previous.endMs) : 0;
      return clamp01(1 - Math.min(1, (durationMs + gapMs * 0.4) / 8000));
    });
    const repetitionHeatmap = orderedScenes.map((scene, index) => {
      const window = orderedScenes.slice(Math.max(0, index - 3), index);
      const repeatedToneCount = window.filter((candidate) => candidate.emotionalTone === scene.emotionalTone).length;
      return clamp01(repeatedToneCount / 3);
    });
    const rhythmContinuity = orderedScenes.length <= 1
      ? 1
      : clamp01(1 - intensityCurve.reduce((total, value, index) => {
        if (index === 0) {
          return total;
        }
        return total + Math.abs(value - intensityCurve[index - 1]!);
      }, 0) / Math.max(1, orderedScenes.length - 1));

    return {
      intensityCurve,
      pacingCurve,
      repetitionHeatmap,
      rhythmContinuity,
      escalationMemory: orderedScenes.map((scene) => ({
        sceneId: scene.id,
        typography: clamp01(scene.typographyEscalation),
        camera: clamp01(scene.cameraEscalation),
        overlay: clamp01(scene.overlayEscalation),
        sound: clamp01(scene.soundEscalation)
      })),
      emotionalStateTimeline: orderedScenes.map((scene, index) => ({
        sceneId: scene.id,
        emotion: scene.emotionalTone,
        intensity: intensityCurve[index] ?? 0
      }))
    };
  }
}
