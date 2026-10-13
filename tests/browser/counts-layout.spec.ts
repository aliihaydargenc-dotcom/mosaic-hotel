import { test, expect } from "@playwright/test";

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1024, height: 720 },
  { width: 390, height: 800 },
]) {
  test(`Sayım ekranı taşmaz ve transfer geçişinde genişlik korunur ${viewport.width}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/demo");
    await page
      .getByRole("button", { name: "Transferler", exact: true })
      .click();
    const before = await page.locator("main").boundingBox();
    await page
      .getByRole("button", { name: "Sayım & tüketim", exact: true })
      .click();
    await expect(page.locator(".counts-panel")).toBeVisible();
    await page.waitForTimeout(250);
    const after = await page.locator("main").boundingBox();
    expect(after!.width).toBe(before!.width);
    expect(after!.x).toBe(before!.x);
    const size = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      viewport: innerWidth,
      viewportHeight: innerHeight,
    }));
    expect(size.width).toBeLessThanOrEqual(size.viewport);
    expect(size.height).toBeLessThanOrEqual(size.viewportHeight);
    const list = page.locator(".counts-panel .table-wrap");
    await list.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(list.locator("th").first()).toBeInViewport();
  });
}
