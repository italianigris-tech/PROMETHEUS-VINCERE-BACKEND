import React, {useEffect, useMemo, useState} from "react";

import {
  getMusicPreviewUrl,
  listMusicCatalog,
  type MusicApiError
} from "../../lib/music/music-api";
import type {
  MusicCatalogListResponse,
  MusicCatalogQueryParams,
  MusicCatalogTrack,
  MusicPreviewUrlResponse
} from "../../lib/music/music-api-types";
import {MusicPreviewPlayer} from "./MusicPreviewPlayer";

export const isMusicCatalogPanelEnabled = (): boolean => {
  const importMetaEnv =
    typeof import.meta !== "undefined"
      ? (import.meta.env as Record<string, string | boolean | undefined> | undefined)
      : undefined;

  const value =
    (typeof importMetaEnv?.NEXT_PUBLIC_ENABLE_MUSIC_CATALOG_PANEL === "string"
      ? importMetaEnv.NEXT_PUBLIC_ENABLE_MUSIC_CATALOG_PANEL
      : undefined) ??
    (typeof importMetaEnv?.VITE_ENABLE_MUSIC_CATALOG_PANEL === "string"
      ? importMetaEnv.VITE_ENABLE_MUSIC_CATALOG_PANEL
      : undefined);

  return value === "true";
};

export const getMusicLicenseBadgeText = (track: MusicCatalogTrack): string => {
  return track.renderAllowed ? "Render-safe / license verified" : "Preview only / license not verified";
};

export const describeMusicCatalogLoadError = (error: unknown): string => {
  const candidate = error as MusicApiError | Error | undefined;
  if (candidate instanceof Error && candidate.message.trim().length > 0) {
    return candidate.message;
  }
  return "Music catalog unavailable.";
};

type MusicCatalogPanelProps = {
  readonly fetchCatalog?: (params: MusicCatalogQueryParams) => Promise<MusicCatalogListResponse>;
  readonly fetchPreviewUrl?: (trackId: string) => Promise<MusicPreviewUrlResponse>;
  readonly initialTracks?: MusicCatalogTrack[];
  readonly initialCategories?: string[];
  readonly initialUrlMode?: string;
  readonly enableAutoFetch?: boolean;
  readonly selectedTrackId?: string | null;
  readonly onTrackFocus?: (track: MusicCatalogTrack | null) => void;
};

const panelStyles: React.CSSProperties = {
  display: "grid",
  gap: 16,
  padding: 18,
  borderRadius: 24,
  border: "1px solid rgba(148, 163, 184, 0.18)",
  background: "rgba(2, 6, 23, 0.8)",
  color: "#e2e8f0"
};

const sectionTitleStyles: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
  lineHeight: 1.2
};

const badgeStyles: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  borderRadius: 999,
  padding: "5px 10px",
  border: "1px solid rgba(148, 163, 184, 0.18)",
  fontSize: 12
};

const actionButtonStyles: React.CSSProperties = {
  border: "1px solid rgba(148, 163, 184, 0.18)",
  borderRadius: 999,
  background: "#111827",
  color: "#f8fafc",
  padding: "8px 12px",
  cursor: "pointer"
};

export const MusicCatalogPanel: React.FC<MusicCatalogPanelProps> = ({
  fetchCatalog = listMusicCatalog,
  fetchPreviewUrl = getMusicPreviewUrl,
  initialTracks = [],
  initialCategories = [],
  initialUrlMode,
  enableAutoFetch = true,
  selectedTrackId = null,
  onTrackFocus
}) => {
  const [tracks, setTracks] = useState<MusicCatalogTrack[]>(initialTracks);
  const [categories, setCategories] = useState<string[]>(initialCategories);
  const [urlMode, setUrlMode] = useState<string | undefined>(initialUrlMode);
  const [isLoading, setIsLoading] = useState(enableAutoFetch && initialTracks.length === 0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [activeTrack, setActiveTrack] = useState<MusicCatalogTrack | null>(initialTracks[0] ?? null);
  const [playRequestNonce, setPlayRequestNonce] = useState(0);

  useEffect(() => {
    if (!enableAutoFetch) {
      return;
    }

    let cancelled = false;

    const run = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const response = await fetchCatalog({
          ...(category !== "all" ? {category} : {}),
          ...(search.trim() ? {search: search.trim()} : {}),
          limit: 50,
          offset: 0
        });

        if (cancelled) {
          return;
        }

        setTracks(response.tracks);
        setCategories(response.categories);
        setUrlMode(response.urlMode);
        setErrorMessage(null);
        setActiveTrack((current) => {
          if (current && response.tracks.some((track) => track.id === current.id)) {
            return current;
          }
          return response.tracks[0] ?? null;
        });
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(describeMusicCatalogLoadError(error));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [category, enableAutoFetch, fetchCatalog, search]);

  useEffect(() => {
    onTrackFocus?.(activeTrack);
  }, [activeTrack, onTrackFocus]);

  const visibleCategories = useMemo(() => {
    const categorySet = new Set<string>(initialCategories);
    categories.forEach((value) => categorySet.add(value));
    tracks.forEach((track) => categorySet.add(track.category));
    return ["all", ...Array.from(categorySet.values()).filter(Boolean)];
  }, [categories, initialCategories, tracks]);

  return (
    <section style={panelStyles} data-music-catalog-panel="true">
      <header style={{display: "grid", gap: 6}}>
        <p style={{margin: 0, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "#94a3b8"}}>
          Dev Music Catalog
        </p>
        <h2 style={sectionTitleStyles}>Video-aware music browser</h2>
        <p style={{margin: 0, color: "#94a3b8"}}>
          Preview URLs are requested only when you click play. Catalog rows stay lightweight and license truth stays explicit.
        </p>
      </header>

      <div style={{display: "grid", gap: 10}}>
        <label style={{display: "grid", gap: 6}}>
          <span style={{fontSize: 13, color: "#cbd5e1"}}>Search</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, category, or tags"
            style={{borderRadius: 12, border: "1px solid rgba(148, 163, 184, 0.2)", padding: "10px 12px", background: "#0f172a", color: "#f8fafc"}}
          />
        </label>

        <div style={{display: "flex", flexWrap: "wrap", gap: 8}}>
          {visibleCategories.map((value) => (
            <button
              key={value}
              type="button"
              style={{
                ...actionButtonStyles,
                background: category === value ? "#1d4ed8" : "#111827"
              }}
              onClick={() => setCategory(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div style={{display: "flex", flexWrap: "wrap", gap: 10, fontSize: 12, color: "#94a3b8"}}>
        <span style={badgeStyles}>Tracks: {tracks.length}</span>
        <span style={badgeStyles}>URL mode: {urlMode ?? "unknown"}</span>
      </div>

      {errorMessage ? (
        <p style={{margin: 0, color: "#fca5a5"}}>{errorMessage}</p>
      ) : null}

      {isLoading ? (
        <p style={{margin: 0, color: "#94a3b8"}}>Loading music catalog…</p>
      ) : null}

      <MusicPreviewPlayer
        activeTrack={activeTrack}
        playRequestNonce={playRequestNonce}
        fetchPreviewUrl={fetchPreviewUrl}
      />

      <div style={{display: "grid", gap: 12}}>
        {tracks.map((track) => (
          <article
            key={track.id}
            style={{
              display: "grid",
              gridTemplateColumns: track.thumbnailUrl ? "96px minmax(0, 1fr)" : "minmax(0, 1fr)",
              gap: 14,
              padding: 14,
              borderRadius: 18,
              border:
                activeTrack?.id === track.id
                  ? "1px solid rgba(59, 130, 246, 0.6)"
                  : selectedTrackId === track.id
                    ? "1px solid rgba(34, 197, 94, 0.55)"
                    : "1px solid rgba(148, 163, 184, 0.16)",
              background: selectedTrackId === track.id ? "rgba(6, 78, 59, 0.34)" : "rgba(15, 23, 42, 0.64)"
            }}
          >
            {track.thumbnailUrl ? (
              <img
                src={track.thumbnailUrl}
                alt={`${track.title} thumbnail`}
                style={{width: 96, height: 96, objectFit: "cover", borderRadius: 14}}
              />
            ) : null}

            <div style={{display: "grid", gap: 8}}>
              <div style={{display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start"}}>
                <div>
                  <strong>{track.title}</strong>
                  <div style={{marginTop: 4, color: "#94a3b8", fontSize: 13}}>
                    {track.category}
                    {track.artist ? ` · ${track.artist}` : ""}
                  </div>
                </div>
                <div style={{display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "end"}}>
                  {selectedTrackId === track.id ? <span style={badgeStyles}>Active override track</span> : null}
                  <span style={badgeStyles}>{track.previewAllowed ? "Preview allowed" : "Preview blocked"}</span>
                  <span style={badgeStyles}>{getMusicLicenseBadgeText(track)}</span>
                </div>
              </div>

              <div style={{display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12, color: "#cbd5e1"}}>
                {track.genreTags.map((tag) => (
                  <span key={`${track.id}-genre-${tag}`} style={badgeStyles}>genre:{tag}</span>
                ))}
                {track.useCaseTags.map((tag) => (
                  <span key={`${track.id}-use-${tag}`} style={badgeStyles}>use:{tag}</span>
                ))}
                {track.moodTags.map((tag) => (
                  <span key={`${track.id}-mood-${tag}`} style={badgeStyles}>mood:{tag}</span>
                ))}
              </div>

              {track.avoidWhen.length > 0 ? (
                <p style={{margin: 0, fontSize: 12, color: "#fda4af"}}>
                  Avoid when: {track.avoidWhen.join(", ")}
                </p>
              ) : null}

              <div style={{display: "flex", gap: 10, flexWrap: "wrap"}}>
                <button
                  type="button"
                  style={actionButtonStyles}
                  disabled={!track.previewAllowed}
                  onClick={() => {
                    setActiveTrack(track);
                    setPlayRequestNonce((value) => value + 1);
                  }}
                >
                  {track.previewAllowed ? "Play preview" : "Preview unavailable"}
                </button>
                <button
                  type="button"
                  style={actionButtonStyles}
                  onClick={() => setActiveTrack(track)}
                >
                  Focus player
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
