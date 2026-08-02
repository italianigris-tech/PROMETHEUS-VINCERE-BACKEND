import {existsSync, statSync} from "node:fs";

import {expect, test} from "@playwright/test";
import sharp from "sharp";

const probes = [
  {
    id: "measured",
    family: "measured",
    variant: "measured.centered_statement_v1",
    fallback: "none",
    primitive: "outline",
    cropCenterX: 0.25,
  },
  {
    id: "editorial",
    family: "editorial",
    variant: "editorial.subject_opposite_v1",
    fallback: "none",
    primitive: "shadow",
    cropCenterX: 0.25,
  },
  {
    id: "personal",
    family: "personal",
    variant: "personal.lower_dialogue_v1",
    fallback: "caption_safe_fallback",
    primitive: "solid_plate",
    cropCenterX: 0.25,
  },
  {
    id: "crop-before",
    family: "personal",
    variant: "personal.crop_hard_cut_v1",
    fallback: "caption_safe_fallback",
    primitive: "solid_plate",
    cropCenterX: 0.25,
  },
  {
    id: "crop-after",
    family: "personal",
    variant: "personal.crop_hard_cut_v1",
    fallback: "caption_safe_fallback",
    primitive: "solid_plate",
    cropCenterX: 0.75,
  },
] as const;

const dmSansMetricsFingerprint =
  "ea9a1595e1927b2412901fad354e56a9f6eba61e9a98e7bc8769d2004fc52ee3";

const viewports = [
  {name: "desktop", width: 1365, height: 900},
  {name: "mobile", width: 390, height: 844},
] as const;

const expectNonblankPixels = async (png: Buffer): Promise<void> => {
  const stats = await sharp(png).stats();
  expect(stats.entropy).toBeGreaterThan(0.5);
  expect(stats.channels.slice(0, 3).some((channel) => channel.stdev > 8)).toBe(
    true,
  );
};

for (const viewport of viewports) {
  test(`placement tracer proves governed pixels at ${viewport.name} size`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({width: viewport.width, height: viewport.height});
    await page.addInitScript(() => {
      (window as Window & {__MAUL_MEDIA_ERRORS__?: string[]}).__MAUL_MEDIA_ERRORS__ = [];
      document.addEventListener(
        "error",
        (event) => {
          const target = event.target;
          if (target instanceof HTMLMediaElement) {
            (window as Window & {__MAUL_MEDIA_ERRORS__?: string[]})
              .__MAUL_MEDIA_ERRORS__?.push(target.currentSrc || target.src);
          }
        },
        true,
      );
    });

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/maul/placement-tracer", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("[data-maul-placement-tracer='true']")).toBeVisible();
    await expect(page.locator("[data-maul-placement-probe]")).toHaveCount(
      probes.length,
    );
    await page.waitForFunction(
      (expectedCount) => {
        const videos = [
          ...document.querySelectorAll<HTMLVideoElement>(
            "video[data-maul-tracer-video]",
          ),
        ];
        return (
          videos.length === expectedCount &&
          videos.every(
            (video) =>
              video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
              video.videoWidth > 0 &&
              video.videoHeight > 0,
          )
        );
      },
      probes.length,
      {timeout: 60_000},
    );
    await page.waitForFunction(
      () => document.fonts.check('700 32px "DM Sans"'),
      undefined,
      {timeout: 60_000},
    );

    const cropCenters: Record<string, number> = {};
    for (const expectedProbe of probes) {
      const probe = page.locator(
        `[data-maul-placement-probe='${expectedProbe.id}']`,
      );
      const canvas = probe.locator(
        `[data-maul-tracer-canvas='${expectedProbe.id}']`,
      );
      const video = canvas.locator("video[data-maul-tracer-video]");
      const card = probe.locator("[data-maul-placement-segment]");
      const token = card.locator("[data-maul-token-id]").first();

      await expect(canvas).toBeVisible();
      await expect(card).toHaveAttribute(
        "data-maul-placement-segment",
        `${expectedProbe.id}_segment`,
      );
      await expect(card).toHaveAttribute(
        "data-placement-family",
        expectedProbe.family,
      );
      await expect(card).toHaveAttribute(
        "data-placement-variant",
        expectedProbe.variant,
      );
      await expect(card).toHaveAttribute(
        "data-placement-fallback",
        expectedProbe.fallback,
      );
      await expect(card).toHaveAttribute(
        "data-legibility-primitive",
        expectedProbe.primitive,
      );
      await expect(card).toHaveAttribute("data-font-family", "DM Sans");
      await expect(card).toHaveAttribute(
        "data-font-asset-id",
        "font_google_dm_sans_700",
      );
      await expect(card).toHaveAttribute(
        "data-font-profile-id",
        "maul-compat-dm-sans-v1",
      );
      await expect(card).toHaveAttribute(
        "data-font-metrics-fingerprint",
        dmSansMetricsFingerprint,
      );
      await expect(card).toHaveCSS("font-family", /DM Sans/);
      await expect(token).toBeVisible();

      const [canvasBox, cardBox] = await Promise.all([
        canvas.boundingBox(),
        card.boundingBox(),
      ]);
      expect(canvasBox).not.toBeNull();
      expect(cardBox).not.toBeNull();
      if (!canvasBox || !cardBox) throw new Error("Missing tracer bounds.");

      const expectedBox = await probe.evaluate((element) => ({
        x: Number(element.getAttribute("data-expected-box-x")),
        y: Number(element.getAttribute("data-expected-box-y")),
        width: Number(element.getAttribute("data-expected-box-width")),
        height: Number(element.getAttribute("data-expected-box-height")),
      }));
      expect(Math.abs(cardBox.x - (canvasBox.x + expectedBox.x * canvasBox.width))).toBeLessThanOrEqual(1);
      expect(Math.abs(cardBox.y - (canvasBox.y + expectedBox.y * canvasBox.height))).toBeLessThanOrEqual(1);
      expect(Math.abs(cardBox.width - expectedBox.width * canvasBox.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(cardBox.height - expectedBox.height * canvasBox.height)).toBeLessThanOrEqual(1);
      expect(cardBox.x).toBeGreaterThanOrEqual(canvasBox.x - 1);
      expect(cardBox.y).toBeGreaterThanOrEqual(canvasBox.y - 1);
      expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(
        canvasBox.x + canvasBox.width + 1,
      );
      expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(
        canvasBox.y + canvasBox.height + 1,
      );
      expect(canvasBox.width).toBeLessThan(1080);
      expect(Math.abs(canvasBox.width / canvasBox.height - 9 / 16)).toBeLessThan(
        0.01,
      );

      const layoutIsContained = await card.evaluate((element) => {
        const cardRect = element.getBoundingClientRect();
        const tokenRects = [
          ...element.querySelectorAll<HTMLElement>("[data-maul-token-id]"),
        ].map((tokenElement) => tokenElement.getBoundingClientRect());
        const tokensAreContained = tokenRects.every(
          (rect) =>
            rect.left >= cardRect.left - 1 &&
            rect.right <= cardRect.right + 1 &&
            rect.top >= cardRect.top - 1 &&
            rect.bottom <= cardRect.bottom + 1,
        );
        const tokensDoNotOverlap = tokenRects.every((rect, index) =>
          tokenRects.slice(index + 1).every(
            (other) =>
              rect.right <= other.left + 0.5 ||
              other.right <= rect.left + 0.5 ||
              rect.bottom <= other.top + 0.5 ||
              other.bottom <= rect.top + 0.5,
          ),
        );
        return tokensAreContained && tokensDoNotOverlap;
      });
      expect(layoutIsContained).toBe(true);

      const cropCenterX = Number(
        await canvas.getAttribute("data-crop-center-x"),
      );
      cropCenters[expectedProbe.id] = cropCenterX;
      expect(cropCenterX).toBe(expectedProbe.cropCenterX);

      await expectNonblankPixels(await canvas.screenshot());
      await expectNonblankPixels(await video.screenshot());
      await expectNonblankPixels(await token.screenshot());
      const screenshotPath = testInfo.outputPath(
        `maul-placement-${viewport.name}-${expectedProbe.id}.png`,
      );
      await probe.screenshot({path: screenshotPath});
      expect(existsSync(screenshotPath)).toBe(true);
      expect(statSync(screenshotPath).size).toBeGreaterThan(1000);
    }

    expect([cropCenters["crop-before"], cropCenters["crop-after"]]).toEqual([
      0.25,
      0.75,
    ]);
    expect(Object.values(cropCenters)).not.toContain(0.5);
    expect(
      await page.evaluate(
        () =>
          (window as Window & {__MAUL_MEDIA_ERRORS__?: string[]})
            .__MAUL_MEDIA_ERRORS__ ?? [],
      ),
    ).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
}
