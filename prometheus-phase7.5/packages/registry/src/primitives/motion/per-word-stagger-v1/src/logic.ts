// packages/registry/src/primitives/motion/per-word-stagger-v1/src/logic.ts
import gsap from "gsap";
import type { Object3D } from "three";

export interface PerWordStaggerParams {
  delay: number;
  rotationAmplitude: number;
  driftX: number;
  driftY: number;
  driftZ: number;
  duration: number;
  ease: string;
}

export const defaultStaggerParams: PerWordStaggerParams = {
  delay: 0.08,
  rotationAmplitude: 15,
  driftX: 0,
  driftY: 0.5,
  driftZ: 0,
  duration: 1.2,
  ease: "power3.out",
};

/**
 * Build a GSAP timeline that staggers the entrance of an array of word meshes.
 * Each word starts offset (drift + rotation) and animates to identity.
 */
export function buildStaggerTimeline(
  words: Object3D[],
  params: Partial<PerWordStaggerParams> = {}
): gsap.core.Timeline {
  const p = { ...defaultStaggerParams, ...params };
  const tl = gsap.timeline();

  words.forEach((word, i) => {
    // Set initial state
    gsap.set(word, {
      x: word.position.x + p.driftX,
      y: word.position.y - p.driftY,
      z: word.position.z + p.driftZ,
      rotationX: p.rotationAmplitude * (Math.random() > 0.5 ? 1 : -1),
      opacity: 0,
    });

    // Animate to final state
    tl.to(
      word,
      {
        x: word.position.x,
        y: word.position.y,
        z: word.position.z,
        rotationX: 0,
        opacity: 1,
        duration: p.duration,
        ease: p.ease,
      },
      i * p.delay
    );
  });

  return tl;
}

/**
 * Split a text string into word meshes. This is a utility that the component uses.
 * In practice, the Director's Notes would pre-split text into word groups.
 */
export function splitTextToWords(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.length > 0);
}
