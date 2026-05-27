import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const remotionMocks = vi.hoisted(() => ({
  continueRender: vi.fn(),
  delayRender: vi.fn((label?: string) => `handle:${label ?? "default"}`)
}));

vi.mock("remotion", () => remotionMocks);

describe("manifest typography", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("registers manifest fonts without using a Remotion render gate or document.fonts.ready", async () => {
    const mockDocument = {
      fonts: {
        add: vi.fn(),
        check: vi.fn(() => false),
        ready: Promise.resolve()
      }
    };
    const fontFaceLoad = vi.fn(async function (this: unknown) {
      return this;
    });
    const FontFaceMock = vi.fn().mockImplementation(function (
      this: unknown,
      family: string,
      source: string
    ) {
      return {
        family,
        source,
        load: fontFaceLoad
      };
    });

    vi.stubGlobal("document", mockDocument);
    vi.stubGlobal("FontFace", FontFaceMock as unknown as typeof FontFace);

    const {loadManifestFontsForManifest} = await import("../hyperframes/manifest-typography");
    await loadManifestFontsForManifest({
      typography: {
        primaryFont: {
          family: "Ageya",
          browserUrl: "/fonts/retrieved/ageya/Ageya-Regular.woff2"
        }
      }
    } as any);

    expect(remotionMocks.delayRender).not.toHaveBeenCalled();
    expect(FontFaceMock).toHaveBeenCalledWith(
      "Ageya",
      "url(/fonts/retrieved/ageya/Ageya-Regular.woff2)"
    );
    expect(remotionMocks.continueRender).not.toHaveBeenCalled();
    expect(mockDocument.fonts.add).toHaveBeenCalledTimes(1);
  });

  it("does not install timeout-based font recovery in the render path", async () => {
    const mockDocument = {
      fonts: {
        add: vi.fn(),
        check: vi.fn(() => false),
        ready: new Promise<void>(() => undefined)
      }
    };
    const FontFaceMock = vi.fn().mockImplementation(function (
      this: unknown,
      family: string,
      source: string
    ) {
      return {
        family,
        source,
        load: vi.fn(() => new Promise<void>(() => undefined))
      };
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    vi.stubGlobal("document", mockDocument);
    vi.stubGlobal("FontFace", FontFaceMock as unknown as typeof FontFace);

    const {loadManifestFontsForManifest} = await import("../hyperframes/manifest-typography");
    void loadManifestFontsForManifest({
      typography: {
        primaryFont: {
          family: "Ageya",
          browserUrl: "/fonts/retrieved/ageya/Ageya-Regular.woff2"
        }
      }
    } as any);

    expect(remotionMocks.delayRender).not.toHaveBeenCalled();
    expect(remotionMocks.continueRender).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
