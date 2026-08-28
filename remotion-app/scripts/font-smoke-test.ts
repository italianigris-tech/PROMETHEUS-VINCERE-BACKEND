import {createReadStream} from "node:fs";
import {access, readFile, stat} from "node:fs/promises";
import {createServer, type IncomingMessage, type ServerResponse} from "node:http";
import {createRequire} from "node:module";
import type {AddressInfo} from "node:net";
import path from "node:path";

import {
  DEBUG_RUNTIME_FONT_ID,
  buildRuntimeFontFaceCss,
  buildRuntimeFontFaceCssForFamily,
  createRuntimeFontRegistry,
  getRuntimeFontCssFamily,
  getRuntimeFontFormatLabel,
  resolveRuntimeFontById,
  type RuntimeFontAssetRecord
} from "../src/lib/font-intelligence/font-runtime-registry";
import {ensureSelectedRuntimeFontLoaded} from "../src/lib/font-intelligence/font-runtime-loader";
import {
  getDynamicManifestTypographyCandidates,
  getManifestBackedPalettes,
  getManifestBackedPaletteForCandidate,
  getManifestBackedPaletteForFamilyName,
  resolveRenderableTypographyFont
} from "../src/lib/font-intelligence/runtime-font-bridge";
import {
  getEditorialFontPalette,
  getRuntimePaletteIdForTypographyCandidate
} from "../src/lib/cinematic-typography/font-runtime-registry";
import {
  selectRuntimeFontSelection,
  type RuntimeFontSelectionInput
} from "../src/lib/cinematic-typography/runtime-font-selector";

type BrowserProofResult = {
  browserLoadAttempted: boolean;
  browserLoadSucceeded: boolean;
  warning: string | null;
  details: {
    manifestFetched: boolean;
    publicUrlFetched: boolean;
    styleInjected: boolean;
    fontsLoadSucceeded: boolean;
    fontsCheckSucceeded: boolean;
  } | null;
};

const MIME_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".otf": "font/otf",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

const PLACEHOLDER_FONT_NAME_PATTERN = /\b(Anton|Oswald|Jugendreisen|Louize|Sokoli|Canela|Satoshi)\b/i;

const require = createRequire(import.meta.url);

const escapeForInlineScript = (value: string): string => {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");
};

const buildBrowserProofHtml = ({
  proofFont,
  proofCss
}: {
  proofFont: RuntimeFontAssetRecord;
  proofCss: string;
}): string => {
  const proofFamily = getRuntimeFontCssFamily(proofFont);
  const fontWeight = proofFont.weight ?? 400;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Runtime font smoke test</title>
  </head>
  <body>
    <div id="font-proof" style="font-family: '${escapeForInlineScript(proofFamily)}', sans-serif;">Runtime font proof</div>
    <script>
      window.__fontSmokeResult = null;
      (async () => {
        try {
          const manifestResponse = await fetch('/fonts/library/font-manifest-urls.json', {cache: 'no-store'});
          const manifestFetched = manifestResponse.ok;
          const manifest = manifestFetched ? await manifestResponse.json() : [];
          const record = manifest.find((entry) => entry.fontId === '${escapeForInlineScript(proofFont.fontId)}') ?? null;
          const fontResponse = record ? await fetch(record.publicUrl, {cache: 'no-store'}) : null;
          const publicUrlFetched = Boolean(fontResponse && fontResponse.ok);
          const style = document.createElement('style');
          style.id = 'runtime-font-proof-style';
          style.textContent = \`${escapeForInlineScript(proofCss)}\`;
          document.head.appendChild(style);
          const styleInjected = Boolean(document.getElementById('runtime-font-proof-style'));
          let fontsLoadSucceeded = false;
          let fontsCheckSucceeded = false;
          if (document.fonts && typeof document.fonts.load === 'function') {
            await document.fonts.load('${fontWeight} 1em "${escapeForInlineScript(proofFamily)}"');
            fontsLoadSucceeded = true;
            fontsCheckSucceeded = document.fonts.check('${fontWeight} 1em "${escapeForInlineScript(proofFamily)}"');
          }
          window.__fontSmokeResult = {
            manifestFetched,
            publicUrlFetched,
            styleInjected,
            fontsLoadSucceeded,
            fontsCheckSucceeded
          };
        } catch (error) {
          window.__fontSmokeResult = {
            manifestFetched: false,
            publicUrlFetched: false,
            styleInjected: false,
            fontsLoadSucceeded: false,
            fontsCheckSucceeded: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      })();
    </script>
  </body>
</html>`;
};

const servePublicDirectory = async ({
  publicRoot,
  proofFont,
  proofCss
}: {
  publicRoot: string;
  proofFont: RuntimeFontAssetRecord;
  proofCss: string;
}): Promise<{
  close: () => Promise<void>;
  origin: string;
}> => {
  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    const requestPath = request.url ? new URL(request.url, "http://127.0.0.1").pathname : "/";
    if (requestPath === "/" || requestPath === "/index.html") {
      response.writeHead(200, {"Content-Type": MIME_TYPES[".html"]});
      response.end(buildBrowserProofHtml({proofFont, proofCss}));
      return;
    }

    const normalizedPath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
    const absolutePath = path.join(publicRoot, normalizedPath);
    if (!absolutePath.startsWith(publicRoot)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    try {
      const fileStats = await stat(absolutePath);
      if (!fileStats.isFile()) {
        response.writeHead(404);
        response.end("Not Found");
        return;
      }

      response.writeHead(200, {
        "Content-Type": MIME_TYPES[path.extname(absolutePath).toLowerCase()] ?? "application/octet-stream",
        "Cache-Control": "no-store"
      });
      createReadStream(absolutePath).pipe(response);
    } catch {
      response.writeHead(404);
      response.end("Not Found");
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  };
};

const resolvePlaywrightChromium = async (): Promise<{
  chromium: {launch: (options?: Record<string, unknown>) => Promise<any>};
  packageName: string;
} | null> => {
  for (const packageName of ["playwright", "@playwright/test"]) {
    try {
      require.resolve(packageName);
      const mod = await import(packageName);
      const chromium = (mod as {chromium?: {launch: (options?: Record<string, unknown>) => Promise<any>}}).chromium;
      if (chromium) {
        return {chromium, packageName};
      }
    } catch {
      // Keep looking for an already-installed browser tool.
    }
  }

  return null;
};

const runBrowserProofIfAvailable = async ({
  publicRoot,
  proofFont,
  proofCss
}: {
  publicRoot: string;
  proofFont: RuntimeFontAssetRecord;
  proofCss: string;
}): Promise<BrowserProofResult> => {
  const playwright = await resolvePlaywrightChromium();
  if (!playwright) {
    return {
      browserLoadAttempted: false,
      browserLoadSucceeded: false,
      warning: "Playwright was not available in this repo, so browser proof was skipped.",
      details: null
    };
  }

  const server = await servePublicDirectory({
    publicRoot,
    proofFont,
    proofCss
  });

  try {
    const browser = await playwright.chromium.launch({headless: true});
    try {
      const page = await browser.newPage();
      await page.goto(server.origin, {waitUntil: "domcontentloaded"});
      await page.waitForFunction(() => Boolean((window as Window & {__fontSmokeResult?: unknown}).__fontSmokeResult), {
        timeout: 15_000
      });
      const details = await page.evaluate(() => {
        return (window as Window & {
          __fontSmokeResult?: BrowserProofResult["details"] & {error?: string};
        }).__fontSmokeResult ?? null;
      });

      const browserLoadSucceeded = Boolean(
        details?.manifestFetched &&
        details?.publicUrlFetched &&
        details?.styleInjected &&
        details?.fontsLoadSucceeded &&
        details?.fontsCheckSucceeded
      );

      return {
        browserLoadAttempted: true,
        browserLoadSucceeded,
        warning: browserLoadSucceeded ? null : `Browser proof failed while using ${playwright.packageName}.`,
        details: details
          ? {
            manifestFetched: Boolean(details.manifestFetched),
            publicUrlFetched: Boolean(details.publicUrlFetched),
            styleInjected: Boolean(details.styleInjected),
            fontsLoadSucceeded: Boolean(details.fontsLoadSucceeded),
            fontsCheckSucceeded: Boolean(details.fontsCheckSucceeded)
          }
          : null
      };
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
  }
};

const main = async (): Promise<void> => {
  const remotionRoot = process.cwd();
  const manifestPath = path.join(remotionRoot, "public", "fonts", "library", "font-manifest-urls.json");
  const publicRoot = path.join(remotionRoot, "public");
  await access(manifestPath);

  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
  const registry = createRuntimeFontRegistry(manifest);
  const renderableRecords = registry.records;
  const proofRecord = renderableRecords[0]!;

  if (!proofRecord) {
    throw new Error("Expected at least one renderable runtime font record.");
  }

  for (const record of renderableRecords) {
    if (!/^\/fonts\/(library|studio\/mixfonts)\//.test(record.publicUrl)) {
      throw new Error(`Invalid publicUrl for ${record.fontId}: ${record.publicUrl}`);
    }

    if (path.isAbsolute(record.localPublicPath)) {
      throw new Error(`Expected localPublicPath to stay relative for ${record.fontId}, received ${record.localPublicPath}`);
    }

    const resolvedPath = path.resolve(remotionRoot, record.localPublicPath);
    await access(resolvedPath);

    const cssFamily = getRuntimeFontCssFamily(record);
    const css = buildRuntimeFontFaceCss(record);
    const lookup = resolveRuntimeFontById(record.fontId, registry);
    const familyCss = buildRuntimeFontFaceCssForFamily(lookup.selectedFont?.records ?? [record]);

    if (!css.includes(cssFamily)) {
      throw new Error(`Generated CSS for ${record.fontId} did not include deterministic CSS family alias ${cssFamily}.`);
    }
    if (!css.includes(record.publicUrl)) {
      throw new Error(`Generated CSS for ${record.fontId} did not include its publicUrl.`);
    }
    if (!css.includes(`format("${getRuntimeFontFormatLabel(record.format)}")`)) {
      throw new Error(`Generated CSS for ${record.fontId} did not include the correct format label.`);
    }
    if (!css.includes("font-display: swap;")) {
      throw new Error(`Generated CSS for ${record.fontId} did not set font-display: swap.`);
    }
    if (!familyCss.includes("@font-face")) {
      throw new Error(`Generated family CSS for ${record.fontId} was missing an @font-face block.`);
    }
    if (lookup.selectedFont?.cssFamily !== cssFamily) {
      throw new Error(`Lookup alias mismatch for ${record.fontId}. Expected ${cssFamily}, received ${lookup.selectedFont?.cssFamily ?? "null"}.`);
    }
  }

  const proofLookup = resolveRuntimeFontById(proofRecord.fontId, registry);
  if (!proofLookup.selectedFont) {
    throw new Error(`Failed to resolve runtime font ${proofRecord.fontId} without a hidden proof default.`);
  }

  const manifestBackedPalettes = getManifestBackedPalettes();
  const dynamicManifestCandidates = getDynamicManifestTypographyCandidates();
  const manifestFamilyCandidateCount = registry.byFamilyId.size;
  if (manifestBackedPalettes.length !== manifestFamilyCandidateCount) {
    throw new Error(`Dynamic manifest bridge exposed ${manifestBackedPalettes.length} family candidates, expected ${manifestFamilyCandidateCount}.`);
  }
  if (dynamicManifestCandidates.length !== manifestFamilyCandidateCount) {
    throw new Error(`Dynamic manifest typography candidate count ${dynamicManifestCandidates.length} did not match manifest family candidate count ${manifestFamilyCandidateCount}.`);
  }

  const manifestBridgePalette = getManifestBackedPaletteForFamilyName("Aesthetic");
  if (!manifestBridgePalette) {
    throw new Error("Dynamic manifest bridge failed to resolve Aesthetic.");
  }
  if (!manifestBridgePalette.renderable) {
    throw new Error(`Manifest bridge returned a non-renderable palette for ${manifestBridgePalette.familyName}.`);
  }
  if (!manifestBridgePalette.candidateId.startsWith("manifest-family_")) {
    throw new Error(`Dynamic manifest candidate ID did not use the expected scheme: ${manifestBridgePalette.candidateId}`);
  }
  if (manifestBridgePalette.cssFamily !== getRuntimeFontCssFamily(manifestBridgePalette.records[0]!)) {
    throw new Error(`Manifest bridge palette for ${manifestBridgePalette.familyName} did not use the deterministic CSS alias.`);
  }
  if (manifestBridgePalette.publicUrls.some((publicUrl) => !/^\/fonts\/(library|studio\/mixfonts)\//.test(publicUrl))) {
    throw new Error(`Manifest bridge palette for ${manifestBridgePalette.familyName} exposed an invalid publicUrl.`);
  }
  if (PLACEHOLDER_FONT_NAME_PATTERN.test(manifestBridgePalette.displayFamily)) {
    throw new Error(`Manifest bridge palette for ${manifestBridgePalette.familyName} leaked an old placeholder font name.`);
  }

  const bridgeResolution = resolveRenderableTypographyFont({
    candidateId: manifestBridgePalette.candidateId,
    requestedWeight: 700,
    requestedStyle: "italic"
  });
  if (!bridgeResolution) {
    throw new Error(`Manifest bridge failed to resolve renderable typography font for candidate ${manifestBridgePalette.candidateId}.`);
  }
  if (bridgeResolution.palette.id !== manifestBridgePalette.id) {
    throw new Error(`Manifest bridge resolved the wrong palette for candidate ${manifestBridgePalette.candidateId}.`);
  }

  const nonProofDynamicPalette = manifestBackedPalettes.find((palette) => {
    return !["aesthetic", "amerika", "antenna"].includes(palette.familyName.trim().toLowerCase());
  }) ?? null;
  if (!nonProofDynamicPalette) {
    throw new Error("Dynamic manifest bridge did not expose any non-proof family candidate beyond the old Phase 2B subset.");
  }
  const nonProofResolution = resolveRenderableTypographyFont({
    familyId: nonProofDynamicPalette.familyId,
    requestedWeight: 400,
    requestedStyle: "normal"
  });
  if (!nonProofResolution) {
    throw new Error(`Dynamic manifest bridge failed to resolve non-proof family ${nonProofDynamicPalette.familyName}.`);
  }

  const bridgedPaletteId = getRuntimePaletteIdForTypographyCandidate(manifestBridgePalette.candidateId);
  if (bridgedPaletteId !== manifestBridgePalette.id) {
    throw new Error(`Old runtime registry did not prefer the manifest-backed palette for candidate ${manifestBridgePalette.candidateId}.`);
  }

  const bridgedPaletteFromRegistry = getEditorialFontPalette(bridgedPaletteId);
  if (bridgedPaletteFromRegistry.displayFamily !== manifestBridgePalette.displayFamily) {
    throw new Error(`Old runtime registry did not return the manifest-backed palette for ${manifestBridgePalette.candidateId}.`);
  }
  if (bridgedPaletteFromRegistry.displayFamily.includes(manifestBridgePalette.familyName) && !bridgedPaletteFromRegistry.displayFamily.includes(manifestBridgePalette.cssFamily)) {
    throw new Error(`Manifest-backed registry path used raw family name instead of deterministic alias for ${manifestBridgePalette.familyName}.`);
  }

  const fallbackPaletteId = getRuntimePaletteIdForTypographyCandidate("fraunces");
  if (fallbackPaletteId !== "fraunces-editorial") {
    throw new Error(`Old fallback runtime registry behavior changed unexpectedly for 'fraunces'. Received '${fallbackPaletteId ?? "null"}'.`);
  }

  const selectorProbeConfigs: Array<{
    label: string;
    input: RuntimeFontSelectionInput;
  }> = [
    {
      label: "hero-hint",
      input: {
        typographyRole: "headline" as const,
        contentEnergy: "high" as const,
        patternMood: "luxury" as const,
        targetMoods: ["luxury", "editorial"],
        patternUnit: "word" as const,
        wordCount: 2,
        emphasisCount: 1,
        mode: "keyword-only" as const,
        surfaceTone: "dark" as const,
        motionTier: "hero" as const,
        semanticIntent: "name-callout",
        presentationMode: "reel" as const,
        treatmentFontProfileBucket: "editorial_authority" as const
      }
    },
    {
      label: "neutral-hint",
      input: {
        typographyRole: "subtitle" as const,
        contentEnergy: "medium" as const,
        patternMood: "editorial" as const,
        targetMoods: ["editorial", "tech"],
        patternUnit: "word" as const,
        wordCount: 6,
        emphasisCount: 0,
        mode: "normal" as const,
        surfaceTone: "dark" as const,
        motionTier: "premium" as const,
        semanticIntent: null,
        presentationMode: "reel" as const,
        treatmentFontProfileBucket: "neutral_reading" as const
      }
    },
    {
      label: "display-hint",
      input: {
        typographyRole: "keyword" as const,
        contentEnergy: "high" as const,
        patternMood: "aggressive" as const,
        targetMoods: ["aggressive", "dramatic"],
        patternUnit: "word" as const,
        wordCount: 1,
        emphasisCount: 1,
        mode: "keyword-only" as const,
        surfaceTone: "dark" as const,
        motionTier: "hero" as const,
        semanticIntent: "punch-emphasis",
        presentationMode: "reel" as const,
        treatmentFontProfileBucket: "kinetic_display" as const
      }
    }
  ];

  const selectorDynamicMatch = manifestBackedPalettes.flatMap((palette) => {
    return selectorProbeConfigs.map((probe) => {
      const result = selectRuntimeFontSelection({
        ...probe.input,
        treatmentFontProfileHint: palette.id,
        treatmentFallbackFontProfileHint: palette.id
      });
      return {
        familyName: palette.familyName,
        probeLabel: probe.label,
        result
      };
    });
  }).find((entry) => {
    return entry.result.fontCandidateId === entry.result.fontPaletteId &&
      entry.result.fontCandidateId.startsWith("manifest-family_") &&
      entry.result.palette.displayFamily.includes("__prometheus_font_");
  }) ?? null;

  if (!selectorDynamicMatch) {
    throw new Error("Automatic selector could not select any dynamic manifest-backed candidate during the runtime bridge probe.");
  }

  const selectorResult = selectorDynamicMatch.result;
  const selectorSeesManifestCandidate = true;
  const debugOverrideLookup = DEBUG_RUNTIME_FONT_ID
    ? await ensureSelectedRuntimeFontLoaded({debugSelectedFontId: DEBUG_RUNTIME_FONT_ID})
    : null;
  if (DEBUG_RUNTIME_FONT_ID && !debugOverrideLookup?.selectedFont) {
    throw new Error(`Explicit debugSelectedFontId override failed for ${DEBUG_RUNTIME_FONT_ID}.`);
  }

  const proofCss = buildRuntimeFontFaceCssForFamily(proofLookup.selectedFont.records);
  const browserProof = await runBrowserProofIfAvailable({
    publicRoot,
    proofFont: proofRecord,
    proofCss
  });

  console.log(
    JSON.stringify(
      {
        manifestPath,
        renderableRecords: renderableRecords.length,
        manifestFamilyCandidates: manifestFamilyCandidateCount,
        dynamicManifestCandidates: dynamicManifestCandidates.length,
        testedLocalPaths: renderableRecords.length,
        mode: browserProof.browserLoadAttempted ? "strict-path-css-browser-smoke-test" : "strict-path-css-smoke-test",
        proofFontId: proofRecord.fontId,
        proofFamilyId: proofRecord.familyId,
        proofCssFamily: proofLookup.selectedFont.cssFamily,
        manifestBridgeCandidateId: manifestBridgePalette.candidateId,
        manifestBridgeFamilyName: manifestBridgePalette.familyName,
        manifestBridgePaletteId: manifestBridgePalette.id,
        manifestBridgeCssFamily: manifestBridgePalette.cssFamily,
        manifestBridgeUsesPublicUrl: manifestBridgePalette.publicUrls.includes(manifestBridgePalette.records[0]!.publicUrl),
        manifestBridgeFauxBoldRisk: bridgeResolution.fauxBoldRisk,
        manifestBridgeFauxItalicRisk: bridgeResolution.fauxItalicRisk,
        nonProofDynamicFamilyName: nonProofDynamicPalette.familyName,
        nonProofDynamicCandidateId: nonProofDynamicPalette.candidateId,
        selectorSawManifestCandidate: selectorSeesManifestCandidate,
        selectorProbeFamilyName: selectorDynamicMatch.familyName,
        selectorProbeLabel: selectorDynamicMatch.probeLabel,
        selectorFontCandidateId: selectorResult.fontCandidateId,
        selectorFontPaletteId: selectorResult.fontPaletteId,
        hiddenProofDefaultRequired: false,
        debugOverrideFontId: DEBUG_RUNTIME_FONT_ID,
        debugOverrideResolved: Boolean(debugOverrideLookup?.selectedFont),
        oldFallbackStillWorks: fallbackPaletteId === "fraunces-editorial",
        usesPublicUrl: proofCss.includes(proofRecord.publicUrl),
        sampleCss: buildRuntimeFontFaceCss(proofRecord),
        ...browserProof
      },
      null,
      2
    )
  );
};

main().catch((error) => {
  console.error(`[font-smoke-test] ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exitCode = 1;
});
