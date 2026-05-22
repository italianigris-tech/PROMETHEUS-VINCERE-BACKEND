export type AnimatableNode = {
  id: string;
  x: number;
  y: number;
  scale: number;
  sharpOpacity: number;
  blurredOpacity: number;
  rotation: number;
  text: string;
};

export type FrameMapEntry = AnimatableNode;

export type FrameMap = Record<number, FrameMapEntry[]>;
