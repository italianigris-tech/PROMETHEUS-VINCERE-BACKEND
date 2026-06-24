import runtimeFontManifestJson from "../../../public/fonts/library/font-manifest-urls.json" with {type: "json"};

export const RUNTIME_FONT_MANIFEST_PUBLIC_URL = "/fonts/library/font-manifest-urls.json";

export type RuntimeFontFormat = "ttf" | "otf" | "woff" | "woff2";

export type RuntimeFontAssetRecord = {
  fontId: string;
  familyId: string;
  familyName: string;
  fileName: string;
  originalFileName: string | null;
  weight: number | null;
  style: string;
  format: RuntimeFontFormat;
  publicUrl: string;
  localPublicPath: string;
  renderable: true;
};

export type ManualSelectedRuntimeFont = {
  fontId?: string | null;
  familyId?: string | null;
  familyName?: string | null;
};

export type RuntimeFontLookupSource = "fontId" | "familyId" | "familyName";

export type RuntimeFontLookupDiagnostic = {
  code:
    | "selection-empty"
    | "font-id-not-found"
    | "family-id-not-found"
    | "family-name-fallback"
    | "family-name-not-found";
  message: string;
  requestedValue?: string | null;
};

export type SelectedRuntimeFont = {
  source: RuntimeFontLookupSource;
  familyId: string;
  familyName: string;
  cssFamily: string;
  primaryRecord: RuntimeFontAssetRecord;
  records: RuntimeFontAssetRecord[];
  fontIds: string[];
  diagnostics: RuntimeFontLookupDiagnostic[];
};

export type RuntimeFontLookupResult = {
  selectedFont: SelectedRuntimeFont | null;
  diagnostics: RuntimeFontLookupDiagnostic[];
};

export type RuntimeFontRegistry = {
  records: RuntimeFontAssetRecord[];
  byFontId: Map<string, RuntimeFontAssetRecord>;
  byFamilyId: Map<string, RuntimeFontAssetRecord[]>;
  byFamilyName: Map<string, RuntimeFontAssetRecord[]>;
};

const ALLOWED_FORMATS: RuntimeFontFormat[] = ["ttf", "otf", "woff", "woff2"];

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const asNonEmptyString = (value: unknown, fieldName: string, index: number): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid runtime font manifest record ${index}: expected non-empty string for '${fieldName}'.`);
  }

  return value.trim();
};

const asOptionalNonEmptyString = (value: unknown): string | null => {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
};

const asNullableString = (value: unknown, fieldName: string, index: number): string | null => {
  if (value === null || typeof value === "undefined") {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`Invalid runtime font manifest record ${index}: expected string|null for '${fieldName}'.`);
  }

  return value;
};

const asNullableNumber = (value: unknown, fieldName: string, index: number): number | null => {
  if (value === null || typeof value === "undefined") {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid runtime font manifest record ${index}: expected finite number|null for '${fieldName}'.`);
  }

  return value;
};

const asRuntimeFontFormat = (value: unknown, index: number): RuntimeFontFormat => {
  if (typeof value !== "string" || !ALLOWED_FORMATS.includes(value as RuntimeFontFormat)) {
    throw new Error(`Invalid runtime font manifest record ${index}: unsupported font format '${String(value)}'.`);
  }

  return value as RuntimeFontFormat;
};

const sanitizeRuntimeToken = (value: string): string => {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized || "unknown";
};

const deriveFamilyId = (value: Record<string, unknown>, familyName: string, fontId: string): string => {
  const explicitFamilyId = asOptionalNonEmptyString(value.familyId);
  if (explicitFamilyId) {
    return explicitFamilyId;
  }

  const familyToken = sanitizeRuntimeToken(familyName);
  return familyToken === "unknown"
    ? `family_${sanitizeRuntimeToken(fontId)}`
    : `family_${familyToken}`;
};

const deriveFileName = (value: Record<string, unknown>, publicUrl: string, index: number): string => {
  const explicitFileName = asOptionalNonEmptyString(value.fileName);
  if (explicitFileName) {
    return explicitFileName;
  }

  const derivedFileName = publicUrl.split("/").filter(Boolean).at(-1);
  if (!derivedFileName) {
    throw new Error(`Invalid runtime font manifest record ${index}: could not derive 'fileName' from publicUrl.`);
  }

  return derivedFileName;
};

const compareRuntimeFontRecords = (
  left: RuntimeFontAssetRecord,
  right: RuntimeFontAssetRecord
): number => {
  return (
    left.familyId.localeCompare(right.familyId) ||
    (left.weight ?? 400) - (right.weight ?? 400) ||
    left.style.localeCompare(right.style) ||
    left.fontId.localeCompare(right.fontId)
  );
};

const buildRuntimeFontAssetRecord = (value: unknown, index: number): RuntimeFontAssetRecord | null => {
  if (!isObjectRecord(value)) {
    throw new Error(`Invalid runtime font manifest record ${index}: expected an object.`);
  }

  if (value.renderable !== true) {
    return null;
  }

  const publicUrl = asNonEmptyString(value.publicUrl, "publicUrl", index);
  if (!publicUrl.startsWith("/")) {
    throw new Error(`Invalid runtime font manifest record ${index}: publicUrl must start with '/'.`);
  }

  const fontId = asNonEmptyString(value.fontId, "fontId", index);
  const familyName = asNonEmptyString(value.familyName, "familyName", index);

  return {
    fontId,
    familyId: deriveFamilyId(value, familyName, fontId),
    familyName,
    fileName: deriveFileName(value, publicUrl, index),
    originalFileName: asNullableString(value.originalFileName, "originalFileName", index),
    weight: asNullableNumber(value.weight, "weight", index),
    style: asOptionalNonEmptyString(value.style) ?? "normal",
    format: asRuntimeFontFormat(value.format, index),
    publicUrl,
    localPublicPath: asNonEmptyString(value.localPublicPath, "localPublicPath", index),
    renderable: true
  };
};

const buildRecordsByFamilyKey = (
  records: RuntimeFontAssetRecord[],
  keySelector: (record: RuntimeFontAssetRecord) => string
): Map<string, RuntimeFontAssetRecord[]> => {
  const output = new Map<string, RuntimeFontAssetRecord[]>();

  for (const record of records) {
    const key = keySelector(record);
    const current = output.get(key) ?? [];
    current.push(record);
    output.set(key, current);
  }

  for (const [key, familyRecords] of output) {
    output.set(key, [...familyRecords].sort(compareRuntimeFontRecords));
  }

  return output;
};

export const parseRuntimeFontManifest = (value: unknown): RuntimeFontAssetRecord[] => {
  if (!Array.isArray(value)) {
    throw new Error("Runtime font manifest must be an array.");
  }

  const records = value
    .map((entry, index) => buildRuntimeFontAssetRecord(entry, index))
    .filter((record): record is RuntimeFontAssetRecord => record !== null)
    .sort(compareRuntimeFontRecords);

  if (records.length === 0) {
    throw new Error("Runtime font manifest did not contain any renderable font records.");
  }

  return records;
};

export const createRuntimeFontRegistry = (value: unknown): RuntimeFontRegistry => {
  const records = parseRuntimeFontManifest(value);
  return {
    records,
    byFontId: new Map(records.map((record) => [record.fontId, record] as const)),
    byFamilyId: buildRecordsByFamilyKey(records, (record) => record.familyId),
    byFamilyName: buildRecordsByFamilyKey(records, (record) => record.familyName.trim().toLowerCase())
  };
};

const defaultRuntimeFontRegistry = createRuntimeFontRegistry(runtimeFontManifestJson);

export const getBundledRuntimeFontRegistry = (): RuntimeFontRegistry => {
  return defaultRuntimeFontRegistry;
};

export const getRuntimeFontCssFamily = (
  recordOrFamily:
    | Pick<RuntimeFontAssetRecord, "familyId" | "fontId">
    | string
): string => {
  const aliasSource = typeof recordOrFamily === "string"
    ? recordOrFamily
    : recordOrFamily.familyId || recordOrFamily.fontId;
  return `__prometheus_font_${sanitizeRuntimeToken(aliasSource)}`;
};

export const getRuntimeFontFormatLabel = (format: RuntimeFontFormat): string => {
  if (format === "ttf") {
    return "truetype";
  }

  if (format === "otf") {
    return "opentype";
  }

  return format;
};

const quoteCssValue = (value: string): string => {
  return `"${value.replace(/(["\\])/g, "\\$1")}"`;
};

export const buildRuntimeFontFaceCss = (record: RuntimeFontAssetRecord): string => {
  return [
    "@font-face {",
    `  font-family: ${quoteCssValue(getRuntimeFontCssFamily(record))};`,
    `  src: url(${quoteCssValue(record.publicUrl)}) format(${quoteCssValue(getRuntimeFontFormatLabel(record.format))});`,
    `  font-style: ${record.style};`,
    `  font-weight: ${record.weight ?? 400};`,
    "  font-display: swap;",
    "}"
  ].join("\n");
};

export const buildRuntimeFontFaceCssForFamily = (records: RuntimeFontAssetRecord[]): string => {
  return [...records]
    .sort(compareRuntimeFontRecords)
    .map((record) => buildRuntimeFontFaceCss(record))
    .join("\n\n");
};

const buildSelectedRuntimeFont = (
  source: RuntimeFontLookupSource,
  records: RuntimeFontAssetRecord[],
  diagnostics: RuntimeFontLookupDiagnostic[] = []
): SelectedRuntimeFont => {
  const sortedRecords = [...records].sort(compareRuntimeFontRecords);
  const primaryRecord = sortedRecords[0]!;

  return {
    source,
    familyId: primaryRecord.familyId,
    familyName: primaryRecord.familyName,
    cssFamily: getRuntimeFontCssFamily(primaryRecord),
    primaryRecord,
    records: sortedRecords,
    fontIds: sortedRecords.map((record) => record.fontId),
    diagnostics: [...diagnostics]
  };
};

const buildLookupMiss = (
  code: RuntimeFontLookupDiagnostic["code"],
  message: string,
  requestedValue?: string | null
): RuntimeFontLookupResult => {
  const diagnostic: RuntimeFontLookupDiagnostic = {code, message, requestedValue: requestedValue ?? null};
  return {
    selectedFont: null,
    diagnostics: [diagnostic]
  };
};

export const resolveRuntimeFontById = (
  fontId: string | null | undefined,
  registry: RuntimeFontRegistry = getBundledRuntimeFontRegistry()
): RuntimeFontLookupResult => {
  const normalizedFontId = fontId?.trim();
  if (!normalizedFontId) {
    return buildLookupMiss("selection-empty", "Runtime font lookup was requested without a fontId.");
  }

  const record = registry.byFontId.get(normalizedFontId);
  if (!record) {
    return buildLookupMiss("font-id-not-found", `Runtime font '${normalizedFontId}' was not found in the renderable manifest.`, normalizedFontId);
  }

  const familyRecords = registry.byFamilyId.get(record.familyId) ?? [record];
  return {
    selectedFont: buildSelectedRuntimeFont("fontId", familyRecords),
    diagnostics: []
  };
};

export const resolveRuntimeFontFamilyById = (
  familyId: string | null | undefined,
  registry: RuntimeFontRegistry = getBundledRuntimeFontRegistry()
): RuntimeFontLookupResult => {
  const normalizedFamilyId = familyId?.trim();
  if (!normalizedFamilyId) {
    return buildLookupMiss("selection-empty", "Runtime font lookup was requested without a familyId.");
  }

  const familyRecords = registry.byFamilyId.get(normalizedFamilyId);
  if (!familyRecords || familyRecords.length === 0) {
    return buildLookupMiss("family-id-not-found", `Runtime font family '${normalizedFamilyId}' was not found in the renderable manifest.`, normalizedFamilyId);
  }

  return {
    selectedFont: buildSelectedRuntimeFont("familyId", familyRecords),
    diagnostics: []
  };
};

export const resolveRuntimeFontFamilyByName = (
  familyName: string | null | undefined,
  registry: RuntimeFontRegistry = getBundledRuntimeFontRegistry()
): RuntimeFontLookupResult => {
  const normalizedFamilyName = familyName?.trim();
  if (!normalizedFamilyName) {
    return buildLookupMiss("selection-empty", "Runtime font lookup was requested without a familyName.");
  }

  const familyRecords = registry.byFamilyName.get(normalizedFamilyName.toLowerCase());
  if (!familyRecords || familyRecords.length === 0) {
    return buildLookupMiss("family-name-not-found", `Runtime font family '${normalizedFamilyName}' was not found by weak familyName fallback.`, normalizedFamilyName);
  }

  const diagnostics: RuntimeFontLookupDiagnostic[] = [
    {
      code: "family-name-fallback",
      message: `Resolved runtime font family '${normalizedFamilyName}' by weak familyName fallback.`,
      requestedValue: normalizedFamilyName
    }
  ];

  return {
    selectedFont: buildSelectedRuntimeFont("familyName", familyRecords, diagnostics),
    diagnostics
  };
};

export const resolveSelectedRuntimeFont = (
  request: {
    selectedFontId?: string | null;
    selectedFont?: ManualSelectedRuntimeFont | RuntimeFontAssetRecord | null;
  },
  registry: RuntimeFontRegistry = getBundledRuntimeFontRegistry()
): RuntimeFontLookupResult => {
  if (request.selectedFontId?.trim()) {
    return resolveRuntimeFontById(request.selectedFontId, registry);
  }

  const selectedFont = request.selectedFont;
  if (selectedFont?.fontId?.trim()) {
    return resolveRuntimeFontById(selectedFont.fontId, registry);
  }

  if (selectedFont?.familyId?.trim()) {
    return resolveRuntimeFontFamilyById(selectedFont.familyId, registry);
  }

  if (selectedFont?.familyName?.trim()) {
    return resolveRuntimeFontFamilyByName(selectedFont.familyName, registry);
  }

  return buildLookupMiss("selection-empty", "No selected runtime font request was provided.");
};

const debugRuntimeFontRecord = defaultRuntimeFontRegistry.records[0] ?? null;

// Debug/test only: explicit manual override target for local proofing. Never use this as an implicit runtime default.
export const DEBUG_RUNTIME_FONT_ID = debugRuntimeFontRecord?.fontId ?? null;

export const DEBUG_RUNTIME_FONT_FAMILY_ID = debugRuntimeFontRecord?.familyId ?? null;
