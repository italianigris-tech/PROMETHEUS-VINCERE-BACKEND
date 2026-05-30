import {expect, test} from "@playwright/test";

const viewports = [
  {name: "desktop", width: 1365, height: 768},
  {name: "mobile", width: 390, height: 844}
];

for (const viewport of viewports) {
  test(`sandbox stays local and paints at ${viewport.name} size`, async ({page}, testInfo) => {
    await page.setViewportSize({width: viewport.width, height: viewport.height});

    const backendRequests: string[] = [];
    await page.route(/127\.0\.0\.1:8000|localhost:8000|\/health(?:\?|$)|\/api\/edit-sessions(?:\/|\?|$)/, async (route) => {
      backendRequests.push(route.request().url());
      await route.abort();
    });

    await page.goto("/sandbox", {waitUntil: "domcontentloaded"});

    await page.waitForFunction(() => {
      return Boolean(window.__PROMETHEUS_FONT_SYSTEM_READY__?.stage === "FONT_SYSTEM_READY");
    }, {timeout: 30_000});

    await expect(page.locator(".sandbox-pill").first()).toContainText("/test-video.mp4");
    await expect(page.locator(".sandbox-pill").nth(1)).toContainText("/test-matte.mp4");
    await expect(page.locator(".dg-svg-caption[data-animation-registry-ref='host:svg-caption-overlay']")).toHaveCount(1);
    await expect(page.locator("video.dg-video")).toHaveAttribute("src", /\/test-video\.mp4/);
    await expect(page.locator("video.sandbox-hidden-media[src='/test-video.mp4']")).toHaveCount(1);
    await expect(page.locator("video.sandbox-hidden-media[src='/test-matte.mp4']")).toHaveCount(1);

    await page.waitForFunction(() => {
      const canvasElement = document.querySelector(".sandbox-matte-canvas") as HTMLCanvasElement | null;
      const video = document.querySelector("video.dg-video") as HTMLVideoElement | null;
      return Boolean(
        canvasElement?.classList.contains("is-ready") &&
        canvasElement.width > 0 &&
        canvasElement.height > 0 &&
        video &&
        video.readyState >= 2 &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
      );
    }, {timeout: 30_000});

    await page.waitForFunction(() => {
      const canvasElement = document.querySelector(".sandbox-matte-canvas") as HTMLCanvasElement | null;
      const context = canvasElement?.getContext("2d");
      if (!canvasElement || !context) {
        return false;
      }

      const subjectPoints = [
        [Math.floor(canvasElement.width * 0.5), Math.floor(canvasElement.height * 0.34)],
        [Math.floor(canvasElement.width * 0.5), Math.floor(canvasElement.height * 0.48)],
        [Math.floor(canvasElement.width * 0.52), Math.floor(canvasElement.height * 0.62)]
      ];

      return subjectPoints.some(([x, y]) => context.getImageData(x, y, 1, 1).data[3] > 180);
    }, {timeout: 30_000});

    await expect(page.locator(".sandbox-matte-debug-outline")).toHaveCount(0);
    await expect(page.locator(".sandbox-badge-row")).toBeVisible();
    expect(backendRequests).toHaveLength(0);

    await page.screenshot({
      path: testInfo.outputPath(`sandbox-${viewport.name}.png`),
      fullPage: true
    });
  });
}
