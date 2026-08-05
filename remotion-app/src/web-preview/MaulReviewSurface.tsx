import React, {useEffect, useMemo, useState} from "react";

import "./maul-review-surface.css";

type ReviewVerdict = "winner" | "acceptable" | "loser";

type FeedbackPayload = {
  subjectArtifactId: string;
  treatmentId: string;
  verdict: ReviewVerdict;
  rating: number;
  failureClasses: string[];
  notes: string;
  explicitCreatorPreference: boolean;
};

type SubmitMaulFeedbackInput = {
  projectId: string;
  tenantId: string;
  creatorId: string;
  payload: FeedbackPayload;
  fetchImpl?: typeof fetch;
};

export type MaulVisualDirectionOutcome =
  | "ART_DIRECTED"
  | "CONSTRAINED_ART_DIRECTED"
  | "SAFE_CAPTION_FALLBACK"
  | "PLACEMENT_UNRESOLVED"
  | "VISUAL_EVIDENCE_UNAVAILABLE";

export type MaulVisualDirectionStatus = {
  outcome: MaulVisualDirectionOutcome;
  reviewState: "approved" | "awaiting_human_review" | "blocked";
  degradationReason: string;
  preview: {artifactId: string} | null;
  perceptualTruth: {payload: {failureLabels: string[]}} | null;
  urls?: {preview?: string} | null;
};

export const visualDirectionPresentation = (
  outcome: MaulVisualDirectionOutcome,
): {label: string; artDirected: boolean} => {
  if (outcome === "ART_DIRECTED") {
    return {label: "Art directed", artDirected: true};
  }
  if (outcome === "CONSTRAINED_ART_DIRECTED") {
    return {label: "Constrained art direction", artDirected: false};
  }
  if (outcome === "SAFE_CAPTION_FALLBACK") {
    return {label: "Safe caption fallback", artDirected: false};
  }
  if (outcome === "PLACEMENT_UNRESOLVED") {
    return {label: "Placement unresolved", artDirected: false};
  }
  return {label: "Visual evidence unavailable", artDirected: false};
};

export const fetchMaulVisualDirection = async ({
  projectId,
  candidateArtifactId,
  tenantId,
  creatorId,
  fetchImpl = fetch,
}: {
  projectId: string;
  candidateArtifactId: string;
  tenantId: string;
  creatorId: string;
  fetchImpl?: typeof fetch;
}): Promise<MaulVisualDirectionStatus> => {
  const response = await fetchImpl(
    `/api/maul/projects/${encodeURIComponent(projectId)}/visual-direction?candidateArtifactId=${encodeURIComponent(candidateArtifactId)}`,
    {
      headers: {
        "x-maul-tenant-id": tenantId,
        "x-maul-creator-id": creatorId,
      },
    },
  );
  if (!response.ok) {
    throw new Error(`Visual direction lookup failed (${response.status}).`);
  }
  return response.json() as Promise<MaulVisualDirectionStatus>;
};

export const submitMaulFeedback = async ({
  projectId,
  tenantId,
  creatorId,
  payload,
  fetchImpl = fetch
}: SubmitMaulFeedbackInput): Promise<unknown> => {
  const response = await fetchImpl(`/api/maul/v1/projects/${encodeURIComponent(projectId)}/feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-maul-tenant-id": tenantId,
      "x-maul-creator-id": creatorId
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Feedback submission failed (${response.status}).`);
  }

  return response.json();
};

const TREATMENTS = [
  {
    id: "founder_podcast",
    name: "Founder Podcast",
    purpose: "Preserve intelligence, warmth, and the speaker's natural cadence.",
    pacing: "Measured cuts · protected rhetorical pauses",
    failures: ["overcutting", "generic_captions", "performative_motion"]
  },
  {
    id: "premium_direct_response",
    name: "Premium Direct Response",
    purpose: "Maximize clarity and momentum without cheapening the speaker.",
    pacing: "Tight hook · proof-led escalation",
    failures: ["cheap_urgency", "context_collapse", "visual_noise"]
  },
  {
    id: "minimal_expert",
    name: "Minimal Expert",
    purpose: "Make restraint, authority, and precise language do the work.",
    pacing: "Sparse interventions · deliberate breathing room",
    failures: ["sterile_restraint", "weak_hook", "under_signposting"]
  }
] as const;

const ALL_FAILURES = Array.from(new Set(TREATMENTS.flatMap((treatment) => treatment.failures)));

const queryValue = (key: string, fallback: string): string => {
  if (typeof window === "undefined") {
    return fallback;
  }

  return new URLSearchParams(window.location.search).get(key) || fallback;
};

export const MaulReviewSurface: React.FC<{
  visualDirection?: MaulVisualDirectionStatus | null;
}> = ({visualDirection: initialVisualDirection = null}) => {
  const [projectId, setProjectId] = useState(() => queryValue("project", "project_1"));
  const [tenantId, setTenantId] = useState(() => queryValue("tenant", "tenant_1"));
  const [creatorId, setCreatorId] = useState(() => queryValue("creator", "creator_1"));
  const [subjectArtifactId, setSubjectArtifactId] = useState(() => queryValue("artifact", "candidate_1"));
  const [treatmentId, setTreatmentId] = useState<(typeof TREATMENTS)[number]["id"]>("minimal_expert");
  const [verdict, setVerdict] = useState<ReviewVerdict>("winner");
  const [rating, setRating] = useState(5);
  const [notes, setNotes] = useState("");
  const [explicitPreference, setExplicitPreference] = useState(false);
  const [failureClasses, setFailureClasses] = useState<string[]>([]);
  const [status, setStatus] = useState("Ready for a human decision.");
  const [submitting, setSubmitting] = useState(false);
  const [visualDirection, setVisualDirection] = useState<MaulVisualDirectionStatus | null>(
    initialVisualDirection,
  );

  const activeTreatment = useMemo(
    () => TREATMENTS.find((treatment) => treatment.id === treatmentId) ?? TREATMENTS[2],
    [treatmentId]
  );

  useEffect(() => {
    if (initialVisualDirection || !projectId || !subjectArtifactId) return;
    let current = true;
    void fetchMaulVisualDirection({
      projectId,
      candidateArtifactId: subjectArtifactId,
      tenantId,
      creatorId,
    })
      .then((result) => {
        if (current) setVisualDirection(result);
      })
      .catch(() => {
        if (current) setVisualDirection(null);
      });
    return () => {
      current = false;
    };
  }, [creatorId, initialVisualDirection, projectId, subjectArtifactId, tenantId]);

  const directionPresentation = visualDirection
    ? visualDirectionPresentation(visualDirection.outcome)
    : null;

  const toggleFailure = (failure: string): void => {
    setFailureClasses((current) => current.includes(failure)
      ? current.filter((item) => item !== failure)
      : [...current, failure]);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSubmitting(true);
    setStatus("Submitting explicit feedback…");
    try {
      await submitMaulFeedback({
        projectId,
        tenantId,
        creatorId,
        payload: {
          subjectArtifactId,
          treatmentId,
          verdict,
          rating,
          failureClasses,
          notes,
          explicitCreatorPreference: explicitPreference
        }
      });
      setStatus("Feedback recorded. Taste memory remains advisory.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Feedback submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="maul-review">
      <header className="maul-review__hero">
        <p className="maul-review__eyebrow">MAUL · HUMAN REVIEW SURFACE</p>
        <h1>Choose with judgment, not autocomplete.</h1>
        <p>
          Compare the three treatment policies, name what failed, and make the creator's preference explicit.
        </p>
      </header>

      {visualDirection && directionPresentation ? (
        <section className="maul-review__direction" aria-label="Visual direction status">
          <div>
            <p className="maul-review__step">Rendered-frame truth</p>
            <h2 data-maul-placement-outcome={visualDirection.outcome}>
              {directionPresentation.label}
            </h2>
            <p>{visualDirection.degradationReason}</p>
          </div>
          <div className="maul-review__direction-meta">
            <span>{visualDirection.reviewState.replaceAll("_", " ")}</span>
            {visualDirection.perceptualTruth?.payload.failureLabels.map((label) => (
              <code key={label}>{label}</code>
            ))}
          </div>
          {visualDirection.preview && visualDirection.urls?.preview ? (
            <video
              className="maul-review__preview"
              controls
              preload="metadata"
              src={visualDirection.urls.preview}
            />
          ) : null}
        </section>
      ) : null}

      <section className="maul-review__section" aria-labelledby="treatments-title">
        <div className="maul-review__section-heading">
          <div>
            <p className="maul-review__step">01 · Treatment policies</p>
            <h2 id="treatments-title">Three distinct editorial bets</h2>
          </div>
          <span className="maul-review__count">3 policies</span>
        </div>
        <div className="maul-review__treatment-grid">
          {TREATMENTS.map((treatment, index) => (
            <button
              className={`maul-review__treatment ${treatmentId === treatment.id ? "is-active" : ""}`}
              key={treatment.id}
              onClick={() => setTreatmentId(treatment.id)}
              type="button"
            >
              <span className="maul-review__treatment-number">0{index + 1}</span>
              <strong>{treatment.name}</strong>
              <span>{treatment.purpose}</span>
              <small>{treatment.pacing}</small>
            </button>
          ))}
        </div>
      </section>

      <form className="maul-review__section maul-review__form" onSubmit={submit}>
        <div className="maul-review__section-heading">
          <div>
            <p className="maul-review__step">02 · Judgment Layer</p>
            <h2>Review {activeTreatment.name}</h2>
          </div>
          <span className="maul-review__status" aria-live="polite">{status}</span>
        </div>

        <div className="maul-review__identity-grid">
          <label>Project ID<input value={projectId} onChange={(event) => setProjectId(event.target.value)} required /></label>
          <label>Tenant ID<input value={tenantId} onChange={(event) => setTenantId(event.target.value)} required /></label>
          <label>Creator ID<input value={creatorId} onChange={(event) => setCreatorId(event.target.value)} required /></label>
          <label>Artifact ID<input value={subjectArtifactId} onChange={(event) => setSubjectArtifactId(event.target.value)} required /></label>
        </div>

        <fieldset className="maul-review__fieldset">
          <legend>Decision</legend>
          <div className="maul-review__segmented">
            {(["winner", "acceptable", "loser"] as const).map((value) => (
              <label key={value}>
                <input
                  checked={verdict === value}
                  name="verdict"
                  onChange={() => setVerdict(value)}
                  type="radio"
                />
                <span>{value}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="maul-review__rating">
          <span>Review rating</span>
          <input
            aria-label="Review rating"
            max={5}
            min={1}
            onChange={(event) => setRating(Number(event.target.value))}
            type="range"
            value={rating}
          />
          <output>{rating}/5</output>
        </label>

        <fieldset className="maul-review__fieldset">
          <legend>Named failure classes</legend>
          <div className="maul-review__failures">
            {ALL_FAILURES.map((failure) => (
              <label key={failure}>
                <input
                  checked={failureClasses.includes(failure)}
                  onChange={() => toggleFailure(failure)}
                  type="checkbox"
                />
                <span>{failure.replaceAll("_", " ")}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="maul-review__notes">
          Review notes
          <textarea
            onChange={(event) => setNotes(event.target.value)}
            placeholder="What should the system learn—and what must remain a human call?"
            rows={4}
            value={notes}
          />
        </label>

        <label className="maul-review__preference">
          <input
            checked={explicitPreference}
            onChange={(event) => setExplicitPreference(event.target.checked)}
            type="checkbox"
          />
          <span>
            <strong>Record as an explicit creator preference</strong>
            Creator Taste Memory is advisory. It cannot silently mutate project intent.
          </span>
        </label>

        <button className="maul-review__submit" disabled={submitting} type="submit">
          {submitting ? "Submitting…" : "Submit review feedback"}
        </button>
      </form>
    </main>
  );
};
