import React, {useCallback, useEffect, useMemo, useState} from "react";

import "./maul-reference-review.css";

type ReviewStatus = "draft" | "approved" | "restricted" | "rejected";
type ReferenceTraits = Record<string, string[]>;

type ReferenceRecord = {
  artifactId: string;
  lineage: {
    sequence: number;
    createdAt: string;
  };
  payload: {
    source:
      | {kind: "url"; url: string}
      | {
          kind: "file";
          suppliedFileId: string;
          originalFilename: string;
          contentType: string;
        };
    rightsStatus: string;
    reviewStatus: ReviewStatus;
    attribution: string | null;
    media: {
      mediaType: string;
      platform: string | null;
      language: string | null;
      sourceQuality: string;
    };
    annotations: Record<string, string[]>;
    traitDraft: {
      traits: ReferenceTraits;
      confidence: number;
      extractorVersion: string;
    };
    approvedTraits: ReferenceTraits | null;
    forbiddenElements: string[];
    nonTransferableIdentityMarkers: string[];
    reviewNotes: string | null;
  };
};

type ReferenceSearchResponse = {
  references: ReferenceRecord[];
};

const API_BASE = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://127.0.0.1:8000"
).replace(/\/+$/, "");

const initialProjectId = (): string => {
  if (typeof window === "undefined") {
    return "";
  }
  return new URLSearchParams(window.location.search).get("projectId")?.trim() ?? "";
};

const formatReferenceLabel = (reference: ReferenceRecord): string => {
  if (reference.payload.source.kind === "file") {
    return reference.payload.source.originalFilename;
  }
  try {
    return new URL(reference.payload.source.url).hostname;
  } catch {
    return reference.payload.source.url;
  }
};

const statusLabel = (status: ReviewStatus): string =>
  status.replace(/_/g, " ").replace(/^\w/, (value) => value.toUpperCase());

export const MaulReferenceReview: React.FC = () => {
  const [projectId, setProjectId] = useState(initialProjectId);
  const [query, setQuery] = useState("");
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus | "">("");
  const [references, setReferences] = useState<ReferenceRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [approvedTraitsJson, setApprovedTraitsJson] = useState("{}");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Enter a project ID to review its Reference Corpus.");
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => references.find((reference) => reference.artifactId === selectedId) ?? references[0] ?? null,
    [references, selectedId]
  );

  useEffect(() => {
    if (!selected) {
      setApprovedTraitsJson("{}");
      return;
    }
    setApprovedTraitsJson(
      JSON.stringify(selected.payload.approvedTraits ?? selected.payload.traitDraft.traits, null, 2)
    );
    setNotes(selected.payload.reviewNotes ?? "");
    setSelectedId(selected.artifactId);
  }, [selected?.artifactId]);

  const loadReferences = useCallback(async (): Promise<void> => {
    const normalizedProjectId = projectId.trim();
    if (!normalizedProjectId) {
      setError("Project ID is required before references can be loaded.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) {
        params.set("q", query.trim());
      }
      if (reviewStatus) {
        params.set("reviewStatus", reviewStatus);
      }
      const suffix = params.size > 0 ? `?${params.toString()}` : "";
      const response = await fetch(
        `${API_BASE}/api/maul/projects/${encodeURIComponent(normalizedProjectId)}/references${suffix}`,
        {cache: "no-store"}
      );
      const body = await response.json() as ReferenceSearchResponse & {error?: string};
      if (!response.ok) {
        throw new Error(body.error ?? `Reference search failed with ${response.status}.`);
      }
      setReferences(body.references);
      setSelectedId((current) =>
        body.references.some((reference) => reference.artifactId === current)
          ? current
          : body.references[0]?.artifactId ?? null
      );
      setMessage(
        body.references.length === 0
          ? "No latest-version references match these filters."
          : `${body.references.length} latest-version reference${body.references.length === 1 ? "" : "s"} loaded.`
      );
    } catch (cause) {
      setReferences([]);
      setSelectedId(null);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }, [projectId, query, reviewStatus]);

  useEffect(() => {
    if (projectId) {
      void loadReferences();
    }
  }, []);

  const submitDecision = async (
    decision: Exclude<ReviewStatus, "draft">
  ): Promise<void> => {
    if (!selected) {
      return;
    }
    if (!notes.trim()) {
      setError("Review notes are required so later audits can explain the decision.");
      return;
    }

    let approvedTraits: ReferenceTraits | undefined;
    if (decision === "approved") {
      try {
        approvedTraits = JSON.parse(approvedTraitsJson) as ReferenceTraits;
      } catch {
        setError("Approved traits must be valid JSON before approval.");
        return;
      }
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_BASE}/api/maul/projects/${encodeURIComponent(projectId.trim())}/references/${encodeURIComponent(selected.artifactId)}/review`,
        {
          method: "POST",
          headers: {"content-type": "application/json"},
          body: JSON.stringify({
            decision,
            reviewerId: "maul-review-surface",
            notes: notes.trim(),
            ...(approvedTraits ? {approvedTraits} : {})
          })
        }
      );
      const body = await response.json() as {error?: string};
      if (!response.ok) {
        throw new Error(body.error ?? `Review failed with ${response.status}.`);
      }
      setMessage(`Reference ${statusLabel(decision).toLowerCase()} and recorded as a new immutable version.`);
      await loadReferences();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="maul-review-shell">
      <header className="maul-review-header">
        <div>
          <p className="maul-review-kicker">MAUL / Reference Corpus</p>
          <h1>Approve traits, never replicas.</h1>
          <p className="maul-review-subtitle">
            Inspect rights, annotations, identity exclusions, and abstract editorial traits before
            they can inform a governed treatment.
          </p>
        </div>
        <div className="maul-review-status" aria-live="polite">
          {error ? <span className="maul-review-error">{error}</span> : <span>{message}</span>}
        </div>
      </header>

      <section className="maul-review-toolbar" aria-label="Reference search">
        <div className="maul-review-field">
          <label htmlFor="maul-project-id">Project ID</label>
          <input
            id="maul-project-id"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            placeholder="maul_project_..."
            autoComplete="off"
          />
        </div>
        <div className="maul-review-field">
          <label htmlFor="maul-reference-query">Search traits and annotations</label>
          <input
            id="maul-reference-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="pacing, punch-in, payoff..."
          />
        </div>
        <div className="maul-review-field">
          <label htmlFor="maul-review-status-filter">Review status</label>
          <select
            id="maul-review-status-filter"
            value={reviewStatus}
            onChange={(event) => setReviewStatus(event.target.value as ReviewStatus | "")}
          >
            <option value="">All latest records</option>
            <option value="draft">Draft</option>
            <option value="approved">Approved</option>
            <option value="restricted">Restricted</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <button type="button" onClick={() => void loadReferences()} disabled={busy}>
          {busy ? "Loading…" : "Load references"}
        </button>
      </section>

      <section className="maul-review-workspace">
        <aside className="maul-review-list" aria-label="Latest Reference Corpus records">
          <div className="maul-review-panel-heading">
            <span>Latest records</span>
            <strong>{references.length}</strong>
          </div>
          {references.length === 0 ? (
            <p className="maul-review-empty">
              No records loaded. Use the project and search controls above.
            </p>
          ) : references.map((reference) => (
            <button
              type="button"
              key={reference.artifactId}
              className="maul-reference-row"
              aria-pressed={selected?.artifactId === reference.artifactId}
              onClick={() => setSelectedId(reference.artifactId)}
            >
              <span className={`maul-status-token maul-status-token--${reference.payload.reviewStatus}`}>
                {statusLabel(reference.payload.reviewStatus)}
              </span>
              <strong>{formatReferenceLabel(reference)}</strong>
              <small>{reference.payload.media.mediaType} · {reference.payload.rightsStatus}</small>
            </button>
          ))}
        </aside>

        <article className="maul-review-detail">
          {!selected ? (
            <div className="maul-review-empty maul-review-empty--detail">
              Select a reference to inspect its governed trait record.
            </div>
          ) : (
            <>
              <div className="maul-review-detail-header">
                <div>
                  <p className="maul-review-eyebrow">Reference rights</p>
                  <h2>{formatReferenceLabel(selected)}</h2>
                </div>
                <dl className="maul-review-facts">
                  <div><dt>Rights</dt><dd>{selected.payload.rightsStatus}</dd></div>
                  <div><dt>Quality</dt><dd>{selected.payload.media.sourceQuality}</dd></div>
                  <div><dt>Confidence</dt><dd>{Math.round(selected.payload.traitDraft.confidence * 100)}%</dd></div>
                </dl>
              </div>

              <section className="maul-review-card">
                <h3>Provenance and exclusions</h3>
                <p>{selected.payload.attribution ?? "No internal attribution supplied."}</p>
                {selected.payload.source.kind === "url" ? (
                  <a href={selected.payload.source.url} target="_blank" rel="noreferrer">
                    Open supplied source URL
                  </a>
                ) : (
                  <a
                    href={`${API_BASE}/api/maul/projects/${encodeURIComponent(projectId.trim())}/references/${encodeURIComponent(selected.artifactId)}/source`}
                  >
                    Open supplied source file
                  </a>
                )}
                <div className="maul-review-warning-grid">
                  <div>
                    <strong>Forbidden elements</strong>
                    <span>{selected.payload.forbiddenElements.join(", ") || "None declared"}</span>
                  </div>
                  <div>
                    <strong>Identity markers</strong>
                    <span>{selected.payload.nonTransferableIdentityMarkers.join(", ") || "None declared"}</span>
                  </div>
                </div>
              </section>

              <section className="maul-review-card">
                <h3>Structured annotations</h3>
                <div className="maul-annotation-grid">
                  {Object.entries(selected.payload.annotations).map(([key, values]) => (
                    <div key={key}>
                      <strong>{key.replace(/([A-Z])/g, " $1")}</strong>
                      <span>{values.join(" · ") || "Not observed"}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="maul-review-card">
                <div className="maul-review-field maul-review-field--wide">
                  <label htmlFor="maul-approved-traits">Corrected abstract traits</label>
                  <textarea
                    id="maul-approved-traits"
                    value={approvedTraitsJson}
                    onChange={(event) => setApprovedTraitsJson(event.target.value)}
                    spellCheck={false}
                    rows={16}
                  />
                  <small>
                    Only abstract traits are approved. Source clips, logos, phrases, fonts, and
                    identity markers never enter export lineage.
                  </small>
                </div>
                <div className="maul-review-field maul-review-field--wide">
                  <label htmlFor="maul-review-notes">Review notes</label>
                  <textarea
                    id="maul-review-notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={3}
                    placeholder="Explain corrections, restrictions, or rejection."
                  />
                </div>
              </section>

              <footer className="maul-review-actions">
                <button
                  type="button"
                  className="maul-action maul-action--primary"
                  disabled={busy || selected.payload.reviewStatus !== "draft"}
                  onClick={() => void submitDecision("approved")}
                >
                  Approve traits
                </button>
                <button
                  type="button"
                  className="maul-action maul-action--secondary"
                  disabled={busy || selected.payload.reviewStatus !== "draft"}
                  onClick={() => void submitDecision("restricted")}
                >
                  Mark restricted
                </button>
                <button
                  type="button"
                  className="maul-action maul-action--danger"
                  disabled={busy || selected.payload.reviewStatus !== "draft"}
                  onClick={() => void submitDecision("rejected")}
                >
                  Reject reference
                </button>
              </footer>
            </>
          )}
        </article>
      </section>
    </main>
  );
};
