import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const editorialFontMocks = vi.hoisted(() => ({
  loadEditorialCaptionFonts: vi.fn()
}));

const registryMocks = vi.hoisted(() => ({
  getBundledRuntimeFontRegistry: vi.fn(() => ({
    records: [
      {
        fontId: "font_aesthetic_regular",
        familyId: "family_aesthetic",
        familyName: "Aesthetic",
        fileName: "aesthetic.woff2",
        originalFileName: "aesthetic.woff2",
        weight: 400,
        style: "normal",
        format: "woff2",
        publicUrl: "/fonts/library/aesthetic/aesthetic.woff2",
        localPublicPath: "fonts/library/aesthetic/aesthetic.woff2",
        renderable: true
      }
    ],
    byFontId: new Map(),
    byFamilyId: new Map(),
    byFamilyName: new Map()
  })),
  getRuntimeFontCssFamily: vi.fn(() => "__prometheus_font_family_aesthetic"),
  getRuntimeFontFormatLabel: vi.fn(() => "woff2")
}));

vi.mock("../../lib/cinematic-typography/editorial-fonts", () => editorialFontMocks);
vi.mock("../../lib/font-intelligence/font-runtime-registry", () => registryMocks);

class MockCustomEvent<T = unknown> {
  public readonly type: string;
  public readonly detail: T;

  constructor(type: string, init: {detail: T}) {
    this.type = type;
    this.detail = init.detail;
  }
}

describe("font preload bootstrap", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("preloads editorial and runtime caption fonts before emitting FONT_SYSTEM_READY", async () => {
    const dispatchEvent = vi.fn();
    const fontSet = {
      add: vi.fn(),
      load: vi.fn(async () => []),
      check: vi.fn(() => true),
      ready: Promise.resolve()
    };
    class MockFontFace {
      public constructor(
        public readonly family: string,
        public readonly source: string,
        public readonly descriptors?: FontFaceDescriptors
      ) {}

      public load = vi.fn(async () => this);
    }

    vi.stubGlobal("document", {fonts: fontSet});
    vi.stubGlobal("window", {
      dispatchEvent,
      __RENDER_DEBUG__: false
    });
    vi.stubGlobal("CustomEvent", MockCustomEvent);
    vi.stubGlobal("FontFace", MockFontFace as unknown as typeof FontFace);

    const {FONT_SYSTEM_READY, preloadFontSystem} = await import("../font-preload-bootstrap");
    const result = await preloadFontSystem({now: () => 1000});

    expect(result.stage).toBe(FONT_SYSTEM_READY);
    expect(result.ready).toBe(true);
    expect(editorialFontMocks.loadEditorialCaptionFonts).toHaveBeenCalledTimes(1);
    expect(fontSet.load).toHaveBeenCalledWith(expect.stringContaining("\"DM Sans\""));
    expect(fontSet.check).toHaveBeenCalledWith(expect.stringContaining("\"DM Sans\""));
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    expect(dispatchEvent.mock.calls[0]?.[0]).toMatchObject({
      type: FONT_SYSTEM_READY,
      detail: result
    });
  });

  it("reports preload failure but still emits the readiness event without retrying", async () => {
    const dispatchEvent = vi.fn();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fontSet = {
      add: vi.fn(),
      load: vi.fn(async () => []),
      check: vi.fn(() => false),
      ready: Promise.resolve()
    };

    vi.stubGlobal("document", {fonts: fontSet});
    vi.stubGlobal("window", {
      dispatchEvent,
      __RENDER_DEBUG__: false
    });
    vi.stubGlobal("CustomEvent", MockCustomEvent);
    vi.stubGlobal("FontFace", undefined);

    const {FONT_SYSTEM_READY, preloadFontSystem} = await import("../font-preload-bootstrap");
    const result = await preloadFontSystem({now: () => 2000});

    expect(result.ready).toBe(false);
    expect(result.failures.length).toBeGreaterThan(0);
    expect(errorSpy).toHaveBeenCalledWith(
      "FONT_SYSTEM_NOT_READY_AT_BOOTSTRAP",
      expect.objectContaining({stage: FONT_SYSTEM_READY, ready: false})
    );
    expect(dispatchEvent).toHaveBeenCalledTimes(1);

    errorSpy.mockRestore();
  });
});
