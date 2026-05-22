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

  it("loads manifest fonts with FontFace and releases the Remotion render gate after document.fonts.ready", async () => {
    let resolveReady!: () => void;
    const readyPromise = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
    const mockDocument = {
      fonts: {
        add: vi.fn(),
        check: vi.fn(() => false),
        ready: readyPromise
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
    const loadPromise = loadManifestFontsForManifest({
      typography: {
        primaryFont: {
          family: "Ageya",
          browserUrl: "/fonts/retrieved/ageya/Ageya-Regular.woff2"
        }
      }
    } as any);

    expect(remotionMocks.delayRender).toHaveBeenCalled();
    expect(FontFaceMock).toHaveBeenCalledWith(
      "Ageya",
      "url(/fonts/retrieved/ageya/Ageya-Regular.woff2)"
    );
    expect(remotionMocks.continueRender).not.toHaveBeenCalled();

    resolveReady();
    await loadPromise;

    expect(remotionMocks.continueRender).toHaveBeenCalledTimes(1);
    expect(mockDocument.fonts.add).toHaveBeenCalledTimes(1);
  });

  it("times out safely and still releases the Remotion render gate when the font never becomes ready", async () => {
    vi.useFakeTimers();
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
    const loadPromise = loadManifestFontsForManifest({
      typography: {
        primaryFont: {
          family: "Ageya",
          browserUrl: "/fonts/retrieved/ageya/Ageya-Regular.woff2"
        }
      }
    } as any);

    await vi.advanceTimersByTimeAsync(5005);
    await loadPromise;

    expect(remotionMocks.delayRender).toHaveBeenCalled();
    expect(remotionMocks.continueRender).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
    vi.useRealTimers();
  });
});
