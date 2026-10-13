import { test, expect } from "@playwright/test";

test("Menü daralır, seçim korunur ve tercih yenilemede hatırlanır", async ({
  page,
}) => {
  await page.goto("/demo");
  await page
    .getByRole("button", { name: "Menüyü daralt", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Menüyü aç", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  await page
    .getByRole("button", { name: "Stok kartları", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Stok kartları", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Menüyü aç", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Menüyü aç", exact: true }).click();
  await expect(
    page.getByText("Ali Haydar Genç", { exact: true }),
  ).toBeVisible();
});

test("Mobil menü açılır, seçimde ve dışarı basıldığında kapanır", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo");
  await page.getByRole("button", { name: "Menüyü aç", exact: true }).click();
  await expect(
    page.getByText("Ali Haydar Genç", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reçeteler", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Menüyü aç", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Menüyü aç", exact: true }).click();
  await page
    .getByRole("button", { name: "Menüyü kapat", exact: true })
    .click({ position: { x: 40, y: 100 } });
  await expect(
    page.getByRole("button", { name: "Menüyü aç", exact: true }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});
