import {useEffect, useMemo, useState} from "react";
import {cancelRender, continueRender, delayRender} from "remotion";
import * as THREE from "three";

type VideoFrameCallbackMetadata = {
  mediaTime: number;
  presentedFrames: number;
};

type VideoFrameCallback = (now: number, metadata: VideoFrameCallbackMetadata) => void;

type FrameLockedVideoElement = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: VideoFrameCallback) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

export type UseVideoTextureSyncInput = {
  url: string;
  frame: number;
  fps: number;
  durationInFrames: number;
  format?: "video" | "imageSequence";
};

export const resolveImageSequenceFrameUrl = (pattern: string, frame: number): string => {
  const frameNumber = String(frame + 1).padStart(4, "0");
  return pattern.replace(/\[frame\]|\{frame\}/g, frameNumber);
};

const waitForEvent = (video: HTMLVideoElement, eventName: keyof HTMLMediaElementEventMap): Promise<void> =>
  new Promise((resolve, reject) => {
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(video.error?.message || `Video failed while waiting for ${eventName}`));
    };
    const cleanup = () => {
      video.removeEventListener(eventName, onEvent);
      video.removeEventListener("error", onError);
    };

    video.addEventListener(eventName, onEvent, {once: true});
    video.addEventListener("error", onError, {once: true});
  });

const waitForPresentedFrame = (video: FrameLockedVideoElement): Promise<void> =>
  new Promise((resolve) => {
    if (typeof video.requestVideoFrameCallback === "function") {
      let settled = false;
      const handle = video.requestVideoFrameCallback(() => {
        if (settled) {
          return;
        }
        settled = true;
        resolve();
      });
      window.setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        video.cancelVideoFrameCallback?.(handle);
        console.warn("[video-sync] requestVideoFrameCallback timed out after 600ms; forcing frame release");
        resolve();
      }, 600);
      return;
    }

    window.setTimeout(() => resolve(), 0);
  });

export const useVideoTextureSync = ({
  url,
  frame,
  fps,
  durationInFrames,
  format = "video"
}: UseVideoTextureSyncInput): THREE.Texture => {
  const video = useMemo<FrameLockedVideoElement>(() => {
    const element = document.createElement("video") as FrameLockedVideoElement;
    element.crossOrigin = "anonymous";
    element.muted = true;
    element.playsInline = true;
    element.preload = "auto";
    return element;
  }, []);
  const canvas = useMemo<HTMLCanvasElement>(() => {
    const element = document.createElement("canvas");
    element.width = 1;
    element.height = 1;
    return element;
  }, []);
  const texture = useMemo(() => {
    const canvasTexture = new THREE.CanvasTexture(canvas);
    canvasTexture.colorSpace = THREE.SRGBColorSpace;
    canvasTexture.generateMipmaps = false;
    canvasTexture.minFilter = THREE.LinearFilter;
    canvasTexture.magFilter = THREE.LinearFilter;
    return canvasTexture;
  }, [canvas]);
  const loader = useMemo(() => new THREE.TextureLoader(), []);
  const [imageTexture, setImageTexture] = useState<THREE.Texture | null>(null);
  const [metadataReady, setMetadataReady] = useState(false);

  useEffect(() => {
    if (format !== "imageSequence") {
      return;
    }

    let cancelled = false;
    let released = false;
    const handle = delayRender(`image-sequence-frame:${frame}`);
    const frameUrl = resolveImageSequenceFrameUrl(url, frame);
    const release = () => {
      if (released) {
        return;
      }
      released = true;
      continueRender(handle);
    };

    loader.load(
      frameUrl,
      (texture) => {
        if (cancelled) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.generateMipmaps = false;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        setImageTexture((previous) => {
          previous?.dispose();
          return texture;
        });
        release();
      },
      undefined,
      (error) => {
        release();
        cancelRender(error instanceof Error ? error : new Error(`Failed to load image sequence frame ${frameUrl}`));
      }
    );

    return () => {
      cancelled = true;
      release();
    };
  }, [format, frame, loader, url]);

  useEffect(() => {
    if (format === "imageSequence") {
      setMetadataReady(false);
      return;
    }

    let cancelled = false;
    let released = false;
    const handle = delayRender("matte-video-metadata");
    const release = () => {
      if (released) {
        return;
      }
      released = true;
      continueRender(handle);
    };

    setMetadataReady(false);
    video.pause();
    video.src = url;
    video.load();

    const loadMetadata = async () => {
      try {
        if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
          await waitForEvent(video, "loadedmetadata");
        }
        if (cancelled) {
          return;
        }
        canvas.width = video.videoWidth || canvas.width || 1;
        canvas.height = video.videoHeight || canvas.height || 1;

        const expectedDuration = durationInFrames / fps;
        if (Number.isFinite(video.duration) && Math.abs(video.duration - expectedDuration) > 1 / fps) {
          cancelRender(
            new Error(
              `Matte duration ${video.duration.toFixed(3)}s does not match manifest duration ${expectedDuration.toFixed(3)}s`
            )
          );
          return;
        }

        setMetadataReady(true);
        release();
      } catch (error) {
        cancelRender(error instanceof Error ? error : new Error(String(error)));
      }
    };

    void loadMetadata();

    return () => {
      cancelled = true;
      release();
    };
  }, [canvas, durationInFrames, format, fps, url, video]);

  useEffect(() => {
    if (format === "imageSequence" || !metadataReady) {
      return;
    }

    let released = false;
    let cancelled = false;
    const handle = delayRender(`matte-video-frame:${frame}`);
    const targetTime = Math.min(frame / fps, Math.max(0, durationInFrames - 1) / fps);

    const release = () => {
      if (released) {
        return;
      }
      released = true;
      const ctx = canvas.getContext("2d");
      if (ctx && canvas.width > 0 && canvas.height > 0) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      texture.needsUpdate = true;
      continueRender(handle);
    };

    const syncFrame = async () => {
      try {
        video.pause();
        if (Math.abs(video.currentTime - targetTime) > 0.0005 || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          video.currentTime = targetTime;
          await waitForEvent(video, "seeked");
        }
        if (cancelled) {
          return;
        }
        await waitForPresentedFrame(video);
        if (!cancelled) {
          release();
        }
      } catch (error) {
        cancelRender(error instanceof Error ? error : new Error(String(error)));
      }
    };

    void syncFrame();

    return () => {
      cancelled = true;
      release();
    };
  }, [canvas, durationInFrames, format, fps, frame, metadataReady, texture, video]);

  useEffect(() => {
    return () => {
      setImageTexture((previous) => {
        previous?.dispose();
        return null;
      });
      video.pause();
      video.removeAttribute("src");
      video.load();
      texture.dispose();
    };
  }, [texture, video]);

  return imageTexture ?? texture;
};
