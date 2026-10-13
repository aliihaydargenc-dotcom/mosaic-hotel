import { test, expect, Page } from "@playwright/test";
import { invoicePDF, scannedInvoicePDF } from "./pdf-fixture";
async function login(page: Page, role = "Yönetici") {
  await page.goto("/login");
  await page.getByRole("button", { name: role, exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Genel bakış" }),
  ).toBeVisible();
}
test("Gerçek alım, transfer, sayım ve maliyet ekranları çalışır", async ({
  page,
}) => {
  await login(page);
  const tag = Date.now();
  await page
    .getByRole("button", { name: "Alım & faturalar", exact: true })
    .click();
  await page.getByRole("button", { name: "Yeni alım", exact: true }).click();
  await page.getByLabel("Fatura numarası").fill(`E2E-${tag}`);
  await page.getByLabel("Tedarikçi", { exact: true }).fill("Test tedarikçi");
  await page.getByLabel("Mal kabul yeri").selectOption({ label: "Ana depo" });
  await page
    .locator('dialog select[name="productId"]')
    .selectOption({ label: "G-002 · Domates (kg)" });
  await page.getByLabel("Satır 1 miktar").fill("10");
  await page.getByLabel("Satır 1 fiyat").fill("58");
  await page.getByRole("button", { name: "Kontrol taslağını kaydet" }).click();
  const row = page.getByRole("row").filter({ hasText: `E2E-${tag}` });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Stoğa işle" }).click();
  await expect(row).toContainText("Stoğa işlendi");
  await row.getByRole("button", { name: "İncele" }).click();
  await expect(page.getByLabel("Mal kabul yeri")).toHaveValue(
    (await page
      .getByLabel("Mal kabul yeri")
      .locator("option", { hasText: "Ana depo" })
      .getAttribute("value")) as string,
  );
  await page.getByRole("button", { name: "Kapat", exact: true }).last().click();
  await page.getByRole("button", { name: "Transferler", exact: true }).click();
  await page
    .getByRole("button", { name: "Yeni transfer", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Kaynak", exact: true })
    .selectOption({ label: "Ana depo" });
  await page
    .getByRole("combobox", { name: "Hedef", exact: true })
    .selectOption({ label: "Mutfak" });
  await page
    .getByLabel("Açıklama", { exact: true })
    .fill(`E2E transfer ${tag}`);
  await page
    .locator('dialog select[name="productId"]')
    .selectOption({ label: "G-002 · Domates (kg)" });
  await page.getByLabel("Transfer miktarı 1").fill("2");
  await page.getByRole("button", { name: "Transfer fişi oluştur" }).click();
  const transfer = page
    .getByRole("row")
    .filter({ hasText: `E2E transfer ${tag}` });
  await transfer.getByRole("button", { name: "Teslim kabulü" }).click();
  await page
    .getByLabel("Teslim alan kişinin adı")
    .fill("Test mutfak sorumlusu");
  await page.getByRole("button", { name: "Teslimi kabul et" }).click();
  await expect(transfer).toContainText("Teslim alındı");
  await transfer.getByRole("button", { name: "Teslim fişini aç" }).click();
  await expect(page.locator(".print-document")).toContainText(
    "Test mutfak sorumlusu",
  );
  await page.getByRole("button", { name: "Kapat", exact: true }).last().click();
  await page
    .getByRole("button", { name: "Sayım & tüketim", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Tüketim çıkışı", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Lokasyon", exact: true })
    .selectOption({ label: "Mutfak" });
  await page
    .getByRole("combobox", { name: "Malzeme", exact: true })
    .selectOption({ label: "G-002 · Domates (kg)" });
  await page.getByLabel(/Çıkış miktarı/).fill("1");
  await page.getByLabel("Çıkış açıklaması").fill(`E2E servis ${tag}`);
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: `E2E servis ${tag}` }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sayım gir", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Lokasyon", exact: true })
    .selectOption({ label: "Mutfak" });
  await page
    .getByRole("combobox", { name: "Malzeme", exact: true })
    .selectOption({ label: "G-002 · Domates (kg)" });
  await page.getByLabel(/Sayılan miktar/).fill("0.5");
  await page.getByLabel("Fark gerekçesi").fill(`E2E sayım ${tag}`);
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: `E2E sayım ${tag}` }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Maliyet raporu", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Dönem maliyet raporu" }),
  ).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "G-002" }),
  ).toContainText("Domates");
  await page.getByRole("button", { name: "Alt grup bazında" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Sebze & meyve" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Alım raporu", exact: true }).click();
  await expect(
    page.getByRole("columnheader", { name: "Net alım tutarı" }),
  ).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "G-002" }),
  ).toContainText("Domates");
  await page.getByRole("button", { name: "Reçeteler", exact: true }).click();
  await page.getByLabel("Açık büfe kahvaltı kişi sayısı").fill("200");
  await expect(
    page.getByRole("row").filter({ hasText: "Beyaz peynir" }),
  ).toContainText("13 kg");
  await page.getByRole("button", { name: "Genel bakış", exact: true }).click();
  await page.screenshot({ path: "test-results/overview.png", fullPage: true });
});
test("Salt okunur rol hem ekran hem API üzerinde korunur", async ({ page }) => {
  await login(page, "Rapor");
  await page
    .getByRole("button", { name: "Alım & faturalar", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Yeni alım" })).toHaveCount(0);
  const r = await page.evaluate(async () => {
    const s = await (await fetch("/api/state")).json();
    return (
      await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: s.version,
          requestId: crypto.randomUUID(),
          command: { type: "place", name: "Yetkisiz depo", kind: "warehouse" },
        }),
      })
    ).status;
  });
  expect(r).toBe(400);
});
test("Oturumsuz API ve kaynak doğrulaması korunur", async ({ request }) => {
  expect((await request.get("/api/state")).status()).toBe(401);
  expect(
    (
      await request.post("/api/session", {
        data: { email: "", password: "", demoRole: "manager" },
      })
    ).status(),
  ).toBe(400);
});
test("Görsel OCR gerçek metni okur ve satırı eşleştirir", async ({ page }) => {
  await login(page);
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 500;
    const c = canvas.getContext("2d")!;
    c.fillStyle = "white";
    c.fillRect(0, 0, 1600, 500);
    c.fillStyle = "black";
    c.font = "42px Arial";
    c.fillText("FATURA", 70, 70);
    c.fillText("Domates 10 kg 58.00", 70, 160);
    c.fillText("Yumurta 120 adet 6.50", 70, 250);
    c.fillText("TOPLAM 1360.00", 70, 350);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page
    .getByRole("button", { name: "Alım & faturalar", exact: true })
    .click();
  await page.getByRole("button", { name: "Yeni alım", exact: true }).click();
  await page.getByLabel("Fatura belgesi yükle").setInputFiles({
    name: "test-fatura.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await expect(page.getByLabel("Satır 2 miktar")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByLabel("Satır 1 miktar")).toHaveValue("10");
  await expect(
    page.locator('dialog select[name="productId"]').first(),
  ).toHaveValue(
    (await page
      .locator('dialog select[name="productId"]')
      .first()
      .locator("option", { hasText: "G-002" })
      .getAttribute("value")) as string,
  );
  await expect(page.locator("dialog")).toContainText("Belge: Domates");
});
test("Dijital PDF satırı okunur, belge kalıcı arşivden indirilir", async ({
  page,
}) => {
  await login(page);
  const reference = `PDF-${Date.now()}`;
  const buffer = invoicePDF(reference);
  await page
    .getByRole("button", { name: "Alım & faturalar", exact: true })
    .click();
  await page.getByRole("button", { name: "Yeni alım", exact: true }).click();
  await page.getByLabel("Fatura numarası").fill(reference);
  await page.getByLabel("Tedarikçi", { exact: true }).fill("PDF test");
  await page.getByLabel("Mal kabul yeri").selectOption({ label: "Ana depo" });
  await page.getByLabel("Fatura belgesi yükle").setInputFiles({
    name: "test-fatura.pdf",
    mimeType: "application/pdf",
    buffer,
  });
  await expect(page.getByLabel("Satır 1 miktar")).toHaveValue("10", {
    timeout: 30_000,
  });
  await expect(page.getByLabel("Satır 1 fiyat")).toHaveValue("58");
  await page.getByRole("button", { name: "Kontrol taslağını kaydet" }).click();
  const row = page.getByRole("row").filter({ hasText: reference });
  await row.getByRole("button", { name: "Stoğa işle" }).click();
  await expect(row).toContainText("Stoğa işlendi");
  await row.getByRole("button", { name: "İncele" }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "İndir", exact: true }).click();
  const d = await downloaded;
  expect(d.suggestedFilename()).toBe("test-fatura.pdf");
  const response = await page.evaluate(async (ref) => {
    const s = await (await fetch("/api/state")).json();
    const i = s.invoices.find(
      (i: { reference: string }) => i.reference === ref,
    );
    const r = await fetch("/api/documents/" + i.id);
    return {
      size: (await r.arrayBuffer()).byteLength,
      status: r.status,
      inlineData: i.attachment.data,
    };
  }, reference);
  expect(response.status).toBe(200);
  expect(response.size).toBe(buffer.length);
  expect(response.inlineData).toBeUndefined();
});
test("Mobil ekran yatay taşmaz, orta form klavyeyle kapanır", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Alım kaydı", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Metin katmanı olmayan taranmış PDF, sayfa OCR yoluyla okunur", async ({
  page,
}) => {
  await login(page);
  const image = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 500;
    const c = canvas.getContext("2d")!;
    c.fillStyle = "white";
    c.fillRect(0, 0, 1600, 500);
    c.fillStyle = "black";
    c.font = "48px Arial";
    c.fillText("FATURA", 70, 80);
    c.fillText("Domates 10 kg 58.00", 70, 180);
    c.fillText("TOPLAM 580.00", 70, 280);
    return canvas.toDataURL("image/jpeg", 0.95).split(",")[1];
  });
  await page
    .getByRole("button", { name: "Alım & faturalar", exact: true })
    .click();
  await page.getByRole("button", { name: "Yeni alım", exact: true }).click();
  await page.getByLabel("Fatura belgesi yükle").setInputFiles({
    name: "taranmis.pdf",
    mimeType: "application/pdf",
    buffer: scannedInvoicePDF(Buffer.from(image, "base64")),
  });
  await expect(page.getByLabel("Satır 1 miktar")).toHaveValue("10", {
    timeout: 60_000,
  });
  await expect(page.getByLabel("Satır 1 fiyat")).toHaveValue("58");
  await expect(page.getByRole("dialog")).toContainText("Belge: Domates");
});
