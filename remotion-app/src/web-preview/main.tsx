import React from "react";
import ReactDOM from "react-dom/client";

import {resolveWebPreviewRootRoute, shouldPreloadWebPreviewFonts, type WebPreviewRootRoute} from "./sandbox-data";
import "./preview.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Preview root element was not found.");
}

type RootErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

class RootErrorBoundary extends React.Component<{
  readonly children: React.ReactNode;
}, RootErrorBoundaryState> {
  state: RootErrorBoundaryState = {
    hasError: false,
    message: ""
  };

  static getDerivedStateFromError(error: unknown): RootErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error)
    };
  }

  componentDidCatch(error: unknown): void {
    console.error("[PreviewRootBoundary] Unhandled preview crash", error);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <main style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "linear-gradient(180deg, #020617, #0f172a)",
          color: "#E2E8F0",
          fontFamily: "ui-sans-serif, system-ui, sans-serif"
        }}>
          <section style={{
            maxWidth: 780,
            padding: "20px 22px",
            borderRadius: 16,
            border: "1px solid rgba(148, 163, 184, 0.24)",
            background: "rgba(15, 23, 42, 0.72)"
          }}>
            <h1 style={{margin: 0, fontSize: 22, lineHeight: 1.25}}>Preview crashed</h1>
            <p style={{margin: "12px 0 0", color: "#CBD5E1", lineHeight: 1.5}}>
              The UI encountered an unhandled runtime error. Refresh after saving fixes, or share this message for a
              targeted patch.
            </p>
            <pre style={{
              margin: "14px 0 0",
              padding: 12,
              borderRadius: 10,
              background: "rgba(2, 6, 23, 0.88)",
              color: "#F8FAFC",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word"
            }}>
              {this.state.message || "Unknown runtime error."}
            </pre>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

const renderRootApp = async (route: WebPreviewRootRoute): Promise<void> => {
  const RootComponent = route === "sandbox"
    ? (await import("./Sandbox")).Sandbox
    : route === "joseph-study"
      ? (await import("./JosephStudyStudio")).JosephStudyStudio
      : route === "maul-reference-review"
        ? (await import("./MaulReferenceReview")).MaulReferenceReview
        : route === "maul-review"
          ? (await import("./MaulReviewSurface")).MaulReviewSurface
        : (await import("./PreviewApp")).PreviewApp;

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <RootErrorBoundary>
        <RootComponent />
      </RootErrorBoundary>
    </React.StrictMode>
  );
};

if (typeof window !== "undefined" && typeof window.__RENDER_DEBUG__ === "undefined" && import.meta.env.DEV) {
  window.__RENDER_DEBUG__ = true;
}

const route = resolveWebPreviewRootRoute(`${window.location.pathname}${window.location.search}`);

if (shouldPreloadWebPreviewFonts(route)) {
  void import("./font-preload-bootstrap")
    .then(({preloadFontSystem}) => preloadFontSystem())
    .finally(() => {
      void renderRootApp(route);
    });
} else {
  void renderRootApp(route);
}
