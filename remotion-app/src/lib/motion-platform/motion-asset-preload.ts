import {useEffect, useMemo, useState} from "react";

import type {MotionAssetManifest} from "../types";
import {getUnifiedMotionAssetCatalog, selectMotionAssetsForPreview} from "./motion-asset-registry";

export type MotionPreviewWarmupState = "idle" | "warming" | "ready" | "error";

export type MotionPreviewWarmupAsset = {
  id: string;
  src: string;
};

export type MotionPreviewWarmupRequest = {
  catalog?: MotionAssetManifest[];
  selectedAssets?: MotionPreviewWarmupAsset[];
  draftPreviewUrl?: string | null;
  videoUrls?: Array<string | null | undefined>;
  fontFamilies?: string[];
  priorityLimit?: number;
};

const imageExtensionPattern = /\.(svg|png|jpe?g|webp|gif|avif)$/i;
const videoExtensionPattern = /\.(mp4|webm|mov|m4v|ogg)$/i;
const htmlExtensionPattern = /\.html?$/i;

const normalizeUrl = (value: string): string => value.trim();

const unique = (values: Array<string | null | undefined>): string[] => {
  return [...new Set(values.map((value) => normalizeUrl(String(value ?? ""))).filter(Boolean))];
};

const preloadImageUrl = async (url: string): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`Failed to preload image ${url}`));
    image.src = url;
    if (typeof image.decode === "function") {
      image.decode().then(() => resolve()).catch(() => {
        // Ignore decode failures and rely on the load event.
      });
    }
  });
};

const preloadVideoUrl = async (url: string): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error(`Failed to preload video ${url}`));
    video.src = url;
    video.load();
  });
};

const preloadHtmlUrl = async (url: string): Promise<void> => {
  const response = await fetch(url, {cache: "force-cache"});
  if (!response.ok) {
    throw new Error(`Failed to preload HTML asset ${url}`);
  }
  await response.text();
};

const preloadAssetUrl = async (url: string): Promise<void> => {
  const normalized = normalizeUrl(url);
  if (!normalized) {
    return;
  }

  if (imageExtensionPattern.test(normalized)) {
    await preloadImageUrl(normalized);
    return;
  }
  if (videoExtensionPattern.test(normalized)) {
    await preloadVideoUrl(normalized);
    return;
  }
  if (htmlExtensionPattern.test(normalized)) {
    await preloadHtmlUrl(normalized);
    return;
  }

  await fetch(normalized, {cache: "force-cache"}).then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to preload asset ${normalized}`);
    }
  });
};

const preloadFont = async (fontFamily: string): Promise<void> => {
  const normalized = fontFamily.trim();
  if (!normalized || typeof document === "undefined" || !document.fonts?.load) {
    return;
  }

  await Promise.all([
    document.fonts.load(`400 1em ${normalized}`),
    document.fonts.load(`600 1em ${normalized}`),
    document.fonts.load(`700 1em ${normalized}`)
  ]);
};

export const primeMotionPreviewWarmup = async ({
  catalog = getUnifiedMotionAssetCatalog(),
  selectedAssets = [],
  draftPreviewUrl,
  videoUrls = [],
  fontFamilies = ["Sora", "DM Sans", "DM Serif Display", "Playfair Display"],
  priorityLimit = 12
}: MotionPreviewWarmupRequest = {}): Promise<void> => {
  if (typeof window === "undefined") {
    return;
  }

  const topPriorityAssets = selectMotionAssetsForPreview({
    catalog,
    limit: priorityLimit
  });
  const candidateUrls = unique([
    ...selectedAssets.map((asset) => asset.src),
    ...topPriorityAssets.map((asset) => asset.src),
    draftPreviewUrl,
    ...videoUrls
  ]);

  await Promise.allSettled([
    ...fontFamilies.map((fontFamily) => preloadFont(fontFamily)),
    ...candidateUrls.map((url) => preloadAssetUrl(url))
  ]);
};

export const useMotionPreviewWarmup = ({
  catalog = getUnifiedMotionAssetCatalog(),
  selectedAssets = [],
  draftPreviewUrl,
  videoUrls = [],
  fontFamilies = ["Sora", "DM Sans", "DM Serif Display", "Playfair Display"],
  priorityLimit = 12
}: MotionPreviewWarmupRequest = {}): MotionPreviewWarmupState => {
  const [state, setState] = useState<MotionPreviewWarmupState>("idle");
  const warmupSignature = useMemo(() => {
    return [
      catalog.length,
      selectedAssets.map((asset) => asset.id).join(","),
      draftPreviewUrl ?? "none",
      videoUrls.filter(Boolean).join(","),
      fontFamilies.join(","),
      priorityLimit
    ].join("|");
  }, [catalog.length, draftPreviewUrl, fontFamilies, priorityLimit, selectedAssets, videoUrls]);

  useEffect(() => {
    let cancelled = false;
    setState("warming");

    const runWarmup = (): void => {
      void primeMotionPreviewWarmup({
        catalog,
        selectedAssets,
        draftPreviewUrl,
        videoUrls,
        fontFamilies,
        priorityLimit
      })
        .then(() => {
          if (!cancelled) {
            setState("ready");
          }
        })
        .catch(() => {
          if (!cancelled) {
            setState("error");
          }
        });
    };

    const scheduleWarmup = (): (() => void) => {
      if (typeof window === "undefined") {
        runWarmup();
        return () => undefined;
      }

      if (typeof window.requestIdleCallback === "function") {
        const handle = window.requestIdleCallback(() => {
          if (!cancelled) {
            runWarmup();
          }
        }, {timeout: 1200});
        return () => window.cancelIdleCallback(handle);
      }

      const timeout = window.setTimeout(() => {
        if (!cancelled) {
          runWarmup();
        }
      }, 0);
      return () => window.clearTimeout(timeout);
    };

    const cancelScheduledWarmup = scheduleWarmup();

    return () => {
      cancelled = true;
      cancelScheduledWarmup();
    };
  }, [catalog, draftPreviewUrl, fontFamilies, priorityLimit, selectedAssets, videoUrls, warmupSignature]);

  return state;
};
