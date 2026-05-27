export type FontRenderTraceRecord = {
  stage: "FONT_RENDER_TRACE";
  expected: string;
  actual: string;
  match: boolean;
  timestamp: number;
};

declare global {
  interface Window {
    __RENDER_DEBUG__?: boolean;
  }
}

const UNKNOWN_FONT = "unknown";

export const isRenderDebugEnabled = (): boolean =>
  typeof window !== "undefined" && window.__RENDER_DEBUG__ === true;

const stripFontQuotes = (value: string): string =>
  value.trim().replace(/^["']|["']$/g, "").trim();

export const resolvePrimaryFontFamily = (fontFamily: string | null | undefined): string => {
  const value = fontFamily?.trim() ?? "";
  if (!value) {
    return UNKNOWN_FONT;
  }

  const quotedMatch = value.match(/^\s*["']([^"']+)["']/);
  if (quotedMatch?.[1]?.trim()) {
    return quotedMatch[1].trim();
  }

  return stripFontQuotes(value.split(",")[0] ?? "") || UNKNOWN_FONT;
};

const normalizeFontFamilyForCompare = (fontFamily: string): string =>
  fontFamily.trim().toLowerCase().replace(/\s+/g, " ");

const readExpectedFontFamily = (
  element: HTMLElement,
  explicitExpected?: string | null
): string => {
  const datasetExpected = element.dataset?.captionExpectedFont;
  const attrExpected = typeof element.getAttribute === "function"
    ? element.getAttribute("data-caption-expected-font")
    : null;
  const inlineExpected = element.style?.fontFamily;

  return resolvePrimaryFontFamily(explicitExpected ?? datasetExpected ?? attrExpected ?? inlineExpected);
};

const readActualFontFamily = (element: HTMLElement): string => {
  if (typeof getComputedStyle !== "function") {
    return resolvePrimaryFontFamily(element.style?.fontFamily);
  }

  return resolvePrimaryFontFamily(getComputedStyle(element).fontFamily);
};

export const readFontRenderTrace = ({
  element,
  expectedFontFamily = null,
  timestamp = typeof performance !== "undefined" ? performance.now() : Date.now()
}: {
  element: HTMLElement;
  expectedFontFamily?: string | null;
  timestamp?: number;
}): FontRenderTraceRecord => {
  const expected = readExpectedFontFamily(element, expectedFontFamily);
  const actual = readActualFontFamily(element);

  return {
    stage: "FONT_RENDER_TRACE",
    expected,
    actual,
    match: normalizeFontFamilyForCompare(expected) === normalizeFontFamilyForCompare(actual),
    timestamp
  };
};

export const logFontRenderTrace = (trace: FontRenderTraceRecord): void => {
  if (!isRenderDebugEnabled()) {
    return;
  }

  console.groupCollapsed("[CAPTION_RENDER] FONT_RENDER_TRACE");
  console.info(trace);
  console.groupEnd();
};

export const traceCaptionFontRender = (input: {
  element: HTMLElement;
  expectedFontFamily?: string | null;
  timestamp?: number;
}): FontRenderTraceRecord => {
  const trace = readFontRenderTrace(input);
  logFontRenderTrace(trace);
  return trace;
};
