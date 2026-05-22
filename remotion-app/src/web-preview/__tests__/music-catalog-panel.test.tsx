import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it, vi} from "vitest";

import {
  MusicCatalogPanel,
  getMusicLicenseBadgeText
} from "../../components/music/MusicCatalogPanel";
import {
  requestMusicTrackPreviewPlayback,
  resolveMusicPreviewPlaybackState
} from "../../components/music/MusicPreviewPlayer";
import type {MusicCatalogTrack} from "../../lib/music/music-api-types";

const previewOnlyTrack: MusicCatalogTrack = {
  id: "cinematic/trailer",
  title: "Cinematic Trailer",
  artist: "Prometheus",
  category: "cinematic",
  genreTags: ["epic"],
  moodTags: ["tense"],
  useCaseTags: ["intro"],
  avoidWhen: ["comedy"],
  previewAllowed: true,
  renderAllowed: false,
  analysisStatus: "pending",
  durationSec: 91,
  thumbnailUrl: "https://cdn.example.com/thumb.jpg",
  licenseSummary: {
    licenseType: "youtube-derived",
    commercialAllowed: false,
    attributionRequired: true,
    licenseVerified: false
  }
};

describe("Music catalog frontend bridge", () => {
  it("marks object_key_only preview responses as not browser playable", () => {
    const resolved = resolveMusicPreviewPlaybackState({
      trackId: "cinematic/trailer",
      encodedTrackId: "cinematic%2Ftrailer",
      urlMode: "object_key_only",
      playableInBrowser: false,
      audioObjectKey: "music-originals/cinematic trailer.mp3",
      reason: "Public or signed preview URL is not configured."
    });

    expect(resolved.playableInBrowser).toBe(false);
    expect(resolved.audioPreviewUrl).toBeNull();
    expect(resolved.reason).toContain("Public or signed preview URL is not configured");
  });

  it("shows preview-only license truth when renderAllowed is false", () => {
    expect(getMusicLicenseBadgeText(previewOnlyTrack)).toBe("Preview only / license not verified");

    const markup = renderToStaticMarkup(
      <MusicCatalogPanel
        initialTracks={[previewOnlyTrack]}
        initialCategories={["cinematic"]}
        initialUrlMode="object_key_only"
        enableAutoFetch={false}
      />
    );

    expect(markup).toContain("Preview only / license not verified");
  });

  it("renders mocked track cards without leaking credential-shaped fields", () => {
    const unsafeTrack = {
      ...previewOnlyTrack,
      R2_SECRET_ACCESS_KEY: "do-not-render-me"
    } as MusicCatalogTrack;

    const markup = renderToStaticMarkup(
      <MusicCatalogPanel
        initialTracks={[unsafeTrack]}
        initialCategories={["cinematic"]}
        initialUrlMode="object_key_only"
        enableAutoFetch={false}
      />
    );

    expect(markup).toContain("Cinematic Trailer");
    expect(markup).toContain("genre:epic");
    expect(markup).not.toContain("do-not-render-me");
    expect(markup).not.toContain("R2_SECRET_ACCESS_KEY");
  });

  it("requests preview URLs on demand when playback is triggered", async () => {
    const fetchPreviewUrl = vi.fn(async () => ({
      trackId: "cinematic/trailer",
      encodedTrackId: "cinematic%2Ftrailer",
      urlMode: "signed_url" as const,
      playableInBrowser: true,
      audioPreviewUrl: "https://cdn.example.com/signed.mp3",
      ttlSeconds: 900,
      reason: "Signed preview ready."
    }));

    expect(fetchPreviewUrl).not.toHaveBeenCalled();

    const resolved = await requestMusicTrackPreviewPlayback("cinematic/trailer", fetchPreviewUrl);

    expect(fetchPreviewUrl).toHaveBeenCalledTimes(1);
    expect(fetchPreviewUrl).toHaveBeenCalledWith("cinematic/trailer");
    expect(resolved.playableInBrowser).toBe(true);
    expect(resolved.audioPreviewUrl).toBe("https://cdn.example.com/signed.mp3");
  });

  it("surfaces a missing audio preview URL as an error-ready non-playable state", () => {
    const resolved = resolveMusicPreviewPlaybackState({
      trackId: "cinematic/trailer",
      encodedTrackId: "cinematic%2Ftrailer",
      urlMode: "signed_url",
      playableInBrowser: true,
      reason: "Signed preview ready, but no URL was attached."
    });

    expect(resolved.playableInBrowser).toBe(false);
    expect(resolved.reason).toContain("Signed preview ready, but no URL was attached");
  });
});
