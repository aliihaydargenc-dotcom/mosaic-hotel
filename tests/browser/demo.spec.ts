import { test, expect } from "@playwright/test";

test("Demo açılır, işlem yapılır ve sıfırlanır; gerçek API çağrılmaz", async ({
  page,
}) => {
  const apiCalls: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      apiCalls.push(request.url());
  });
  await page.goto("/login");
  await page.getByRole("link", { name: "Demoyu göster" }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await page.getByRole("button", { name: "Transferler", exact: true }).click();
  await page
    .getByRole("button", { name: "Teslim kabulü", exact: true })
    .click();
  await page.getByLabel("Teslim alan kişinin adı").fill("Demo teslim");
  await page
    .getByRole("button", { name: "Teslimi kabul et", exact: true })
    .click();
  await expect(page.getByText("Kabul bekliyor", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Sıfırla", exact: true }).click();
  await expect(page.getByText("Kabul bekliyor", { exact: true })).toBeVisible();
  for (const name of [
    "Maliyet raporu",
    "Alım raporu",
    "Stok kartları",
    "Sayım & tüketim",
    "Reçeteler",
    "Konfigürasyon",
    "İşlem geçmişi",
    "Alım & faturalar",
    "Genel bakış",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
  }
  await page.screenshot({ path: "/tmp/mosaic-demo.png", fullPage: true });
  expect(apiCalls).toEqual([]);
  await page.reload();
  await page.getByRole("button", { name: "Transferler", exact: true }).click();
  await expect(page.getByText("Kabul bekliyor", { exact: true })).toBeVisible();
});
