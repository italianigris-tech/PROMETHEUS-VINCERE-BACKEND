import {create} from "zustand";

type FrameStore = {
  frame: number;
  setFrame: (frame: number) => void;
};

export type PreviewFrameSource = {
  getFrame: () => number;
  setFrame: (frame: number) => void;
  subscribe: (listener: (frame: number) => void) => () => void;
  useFrame: () => number;
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

const createZustandFrameSource = (
  store: typeof useFrameStore
): PreviewFrameSource => ({
  getFrame: () => store.getState().frame,
  setFrame: (frame) => {
    store.getState().setFrame(frame);
  },
  subscribe: (listener) => store.subscribe((state) => {
    listener(state.frame);
  }),
  useFrame: () => store((state) => state.frame)
});

export const nativePreviewFrameSource = createZustandFrameSource(useFrameStore);

export const createPreviewFrameSource = (): PreviewFrameSource => {
  const store = create<FrameStore>((set) => ({
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

  return createZustandFrameSource(store);
};

export const frameToPreviewTimeMs = ({
  frame,
  fps
}: {
  frame: number;
  fps: number;
}): number => {
  const safeFps = Number.isFinite(fps) && fps > 0 ? fps : null;
  return safeFps ? (frame / safeFps) * 1000 : 0;
};

export const usePreviewCurrentTimeMs = (
  fps: number,
  frameSource: PreviewFrameSource = nativePreviewFrameSource
): number => {
  const frame = frameSource.useFrame();
  return frameToPreviewTimeMs({frame, fps});
};
