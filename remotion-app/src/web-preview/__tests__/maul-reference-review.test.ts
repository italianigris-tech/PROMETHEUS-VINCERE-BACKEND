import {existsSync, readFileSync} from "node:fs";
import path from "node:path";

import {describe, expect, it} from "vitest";

import {resolveWebPreviewRootRoute} from "../sandbox-data";

describe("MAUL reference review surface", () => {
  it("routes the dedicated review path without loading the general preview shell", () => {
    expect(resolveWebPreviewRootRoute("/maul/references")).toBe("maul-reference-review");
    expect(resolveWebPreviewRootRoute("/maul/references?projectId=project_alpha"))
      .toBe("maul-reference-review");

    const bootstrap = readFileSync(path.resolve("src/web-preview/main.tsx"), "utf8");
    expect(bootstrap).toContain('import("./MaulReferenceReview")');
  });

  it("provides labelled, accessible review controls and responsive states", () => {
    const componentPath = path.resolve("src/web-preview/MaulReferenceReview.tsx");
    const cssPath = path.resolve("src/web-preview/maul-reference-review.css");
    expect(existsSync(componentPath)).toBe(true);
    expect(existsSync(cssPath)).toBe(true);

    const component = readFileSync(componentPath, "utf8");
    const css = readFileSync(cssPath, "utf8");
    expect(component).toContain("<label");
    expect(component).toContain('aria-live="polite"');
    expect(component).toContain("Approve traits");
    expect(component).toContain("Mark restricted");
    expect(component).toContain("Reject reference");
    expect(component).toContain("Reference rights");
    expect(css).toContain("min-height: 44px");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("@media (max-width: 760px)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
