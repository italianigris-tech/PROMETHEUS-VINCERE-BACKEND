import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it, vi} from "vitest";

import {
  MaulReviewSurface,
  submitMaulFeedback,
  visualDirectionPresentation,
} from "../MaulReviewSurface";
import {resolveWebPreviewRootRoute, shouldPreloadWebPreviewFonts} from "../sandbox-data";

describe("MAUL Review Surface", () => {
  it("registers a focused review route without heavyweight preview font preload", () => {
    expect(resolveWebPreviewRootRoute("/maul/review?project=one")).toBe("maul-review");
    expect(shouldPreloadWebPreviewFonts("maul-review")).toBe(false);
  });

  it("renders all treatment policies, judgment controls, feedback, and advisory memory safeguards", () => {
    const markup = renderToStaticMarkup(<MaulReviewSurface />);
    expect(markup).toContain("Founder Podcast");
    expect(markup).toContain("Premium Direct Response");
    expect(markup).toContain("Minimal Expert");
    expect(markup).toContain("Judgment Layer");
    expect(markup).toContain("Named failure classes");
    expect(markup).toContain("Creator Taste Memory is advisory");
    expect(markup).toContain("Submit review feedback");
    expect(markup).toContain("aria-live=\"polite\"");
    expect(markup).toContain("aria-label=\"Review rating\"");
  });

  it("posts tenant-scoped explicit feedback to the production API", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({event: {eventId: "feedback_1"}}), {
      status: 201,
      headers: {"Content-Type": "application/json"}
    }));
    await submitMaulFeedback({
      projectId: "project_1",
      tenantId: "tenant_1",
      creatorId: "creator_1",
      payload: {
        subjectArtifactId: "candidate_1",
        treatmentId: "minimal_expert",
        verdict: "winner",
        rating: 5,
        failureClasses: [],
        notes: "This restraint feels right.",
        explicitCreatorPreference: true
      },
      fetchImpl
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/maul/v1/projects/project_1/feedback",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-maul-tenant-id": "tenant_1",
          "x-maul-creator-id": "creator_1"
        })
      })
    );
  });

  it("discloses a safe caption fallback without calling it art directed", () => {
    const presentation = visualDirectionPresentation("SAFE_CAPTION_FALLBACK");
    expect(presentation).toMatchObject({
      label: "Safe caption fallback",
      artDirected: false,
    });
    const markup = renderToStaticMarkup(
      <MaulReviewSurface
        visualDirection={{
          outcome: "SAFE_CAPTION_FALLBACK",
          reviewState: "blocked",
          degradationReason: "Visual evidence is unavailable.",
          preview: null,
          perceptualTruth: {
            payload: {failureLabels: ["GENERIC_BOTTOM_CAPTION"]},
          },
        }}
      />,
    );
    expect(markup).toContain("Safe caption fallback");
    expect(markup).toContain("GENERIC_BOTTOM_CAPTION");
    expect(markup).not.toContain("Art directed");
  });
});
