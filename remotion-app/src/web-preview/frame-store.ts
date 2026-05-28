import {create} from "zustand";

type FrameStore = {
  frame: number;
  setFrame: (frame: number) => void;
};

const normalizeFrame = (frame: number): number => {
  if (!Number.isFinite(frame) || frame <= 0) {
    return 0;
  }

  return Math.round(frame);
};

export const useFrameStore = create<FrameStore>((set) => ({
  frame: 0,
  setFrame: (frame) => {
    const nextFrame = normalizeFrame(frame);
    set((state) => (
      state.frame === nextFrame
        ? state
        : {frame: nextFrame}
    ));
  }
}));

export const usePreviewCurrentTimeMs = (fps: number): number => {
  const safeFps = Number.isFinite(fps) && fps > 0 ? fps : null;
  return useFrameStore((state) => (safeFps ? (state.frame / safeFps) * 1000 : 0));
};
