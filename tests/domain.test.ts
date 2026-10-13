import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyCommand,
  blankState,
  balance,
  report,
  purchases,
} from "../src/lib/domain";
import { requiredQuantity, recipeQuantity } from "../src/lib/inventree-bom";
import { parseInvoiceText, parseDecimal } from "../src/lib/documents";
import { mulDivRound } from "../src/lib/math";
import type { Actor, State } from "../src/lib/types";

test("Maliyet aritmetiği büyük değerlerde de tam kuruşla yuvarlanır", () => {
  assert.equal(mulDivRound(1, 1, 2), 1);
  assert.equal(
    mulDivRound(9_000_000_000_001, 999_999, 1_000_000),
    8_999_991_000_001,
  );
  assert.throws(() => mulDivRound(Number.MAX_SAFE_INTEGER, 2, 1));
});
test("Hareket görmüş kartın birimi değişmez; kapanış katalog bilgisini saklar", () => {
  let s = receipt(fixture());
  const p = s.products[0];
  assert.throws(
    () =>
      applyCommand(
        s,
        {
          type: "product",
          productId: p.id,
          name: p.name,
          code: p.code,
          group: p.group,
          unit: "lt",
          minimum: 0,
        },
        actor,
      ),
    /temel birimi/,
  );
  s = applyCommand(
    s,
    { type: "people", period: month, adults: 10, children: 0 },
    actor,
  );
  s = applyCommand(s, { type: "close", period: month }, actor);
  s = applyCommand(
    s,
    {
      type: "product",
      productId: p.id,
      name: "Yeni ad",
      code: p.code,
      group: "Yeni grup",
      unit: "kg",
      minimum: 0,
    },
    actor,
  );
  assert.equal(s.periods[0].snapshots[0].catalog?.[0].name, "Peynir");
});
const actor: Actor = {
  id: "admin",
  name: "Yönetici",
  role: "manager",
  email: "admin@example.com",
};
const month = "2026-10",
  date = "2026-10-13";
function fixture() {
  let s = blankState(month);
  for (const name of ["A depo", "B depo", "Büfe"])
    s = applyCommand(s, { type: "place", name, kind: "warehouse" }, actor);
  s = applyCommand(
    s,
    {
      type: "product",
      name: "Peynir",
      code: "P-1",
      group: "Süt ürünleri",
      unit: "kg",
      minimum: 0,
    },
    actor,
  );
  return s;
}
function receipt(s: State, qty = 10000, price = 10000, ref = "F-1") {
  s = applyCommand(
    s,
    {
      type: "invoice",
      reference: ref,
      supplier: "Tedarikçi",
      documentDate: date,
      period: month,
      placeId: s.places[0].id,
      lines: [{ productId: s.products[0].id, qty, unitPrice: price, vat: 1 }],
    },
    actor,
  );
  return applyCommand(
    s,
    { type: "postInvoice", invoiceId: s.invoices.at(-1)!.id },
    actor,
  );
}
test("Fatura taslağı stoğu etkilemez; onay bir kez işlenir", () => {
  let s = fixture();
  s = applyCommand(
    s,
    {
      type: "invoice",
      reference: "F-1",
      supplier: "Tedarikçi",
      documentDate: date,
      period: month,
      placeId: s.places[0].id,
      lines: [
        { productId: s.products[0].id, qty: 10000, unitPrice: 10000, vat: 20 },
      ],
    },
    actor,
  );
  assert.equal(s.balances.length, 0);
  s = applyCommand(
    s,
    { type: "postInvoice", invoiceId: s.invoices[0].id },
    actor,
  );
  assert.equal(s.balances[0].qty, 10000);
  assert.equal(s.balances[0].value, 100000);
  assert.throws(() =>
    applyCommand(
      s,
      { type: "postInvoice", invoiceId: s.invoices[0].id },
      actor,
    ),
  );
});
test("İkinci alım ağırlıklı ortalama maliyet oluşturur; KDV maliyete eklenmez", () => {
  let s = receipt(fixture());
  s = receipt(s, 10000, 20000, "F-2");
  s = applyCommand(
    s,
    {
      type: "consume",
      productId: s.products[0].id,
      placeId: s.places[0].id,
      period: month,
      date,
      qty: 1000,
      note: "Servis",
    },
    actor,
  );
  assert.equal(s.movements.at(-1)!.value, 15000);
  assert.equal(purchases(s, month), 300000);
  assert.equal(s.balances[0].value, 285000);
});
test("Transfer kabul edilene kadar bekler; kabul stok ve toplam değeri korur", () => {
  let s = receipt(fixture());
  const ids = s.places.map((p) => p.id);
  s = applyCommand(
    s,
    {
      type: "transfer",
      from: ids[0],
      to: ids[1],
      period: month,
      date,
      note: "Sevk",
      lines: [{ productId: s.products[0].id, qty: 4000 }],
    },
    actor,
  );
  assert.equal(s.balances[0].qty, 10000);
  s = applyCommand(
    s,
    {
      type: "acceptTransfer",
      transferId: s.transfers[0].id,
      receivedBy: "Teslim alan",
    },
    actor,
  );
  assert.equal(balance(s, s.products[0].id, ids[0]).qty, 6000);
  assert.equal(balance(s, s.products[0].id, ids[1]).qty, 4000);
  assert.equal(
    s.balances.reduce((n, b) => n + b.value, 0),
    100000,
  );
  assert.equal(report(s, month).length, 0);
  assert.throws(() =>
    applyCommand(
      s,
      {
        type: "acceptTransfer",
        transferId: s.transfers[0].id,
        receivedBy: "İkinci",
      },
      actor,
    ),
  );
});
test("Lokasyondan lokasyona transfer desteklenir", () => {
  let s = receipt(fixture());
  for (const [from, to] of [
    [0, 1],
    [1, 2],
  ]) {
    s = applyCommand(
      s,
      {
        type: "transfer",
        from: s.places[from].id,
        to: s.places[to].id,
        period: month,
        date,
        note: "Sevk",
        lines: [{ productId: s.products[0].id, qty: 3000 }],
      },
      actor,
    );
    s = applyCommand(
      s,
      {
        type: "acceptTransfer",
        transferId: s.transfers.at(-1)!.id,
        receivedBy: "Kabul",
      },
      actor,
    );
  }
  assert.equal(balance(s, s.products[0].id, s.places[2].id).qty, 3000);
});
test("Yetersiz stok işlemi atomik olarak reddeder ve orijinal durumu korur", () => {
  const s = receipt(fixture());
  const original = JSON.stringify(s);
  assert.throws(
    () =>
      applyCommand(
        s,
        {
          type: "consume",
          productId: s.products[0].id,
          placeId: s.places[0].id,
          period: month,
          date,
          qty: 11000,
          note: "Çıkış",
        },
        actor,
      ),
    /Yetersiz/,
  );
  assert.equal(JSON.stringify(s), original);
});
test("Sayım eksik farkı maliyete dahil olur; fazla sayım net farkı azaltır", () => {
  let s = receipt(fixture());
  const base = {
    type: "count",
    productId: s.products[0].id,
    placeId: s.places[0].id,
    period: month,
    date,
    note: "Aylık sayım",
  };
  s = applyCommand(s, { ...base, counted: 8000 }, actor);
  assert.equal(report(s, month)[0].cost, 20000);
  s = applyCommand(s, { ...base, counted: 9000 }, actor);
  assert.equal(report(s, month)[0].cost, 10000);
  assert.equal(s.balances[0].value, 90000);
});
test("Sıfır stokta maliyetsiz sayım fazlası yaratılmaz", () => {
  const s = fixture();
  assert.throws(
    () =>
      applyCommand(
        s,
        {
          type: "count",
          productId: s.products[0].id,
          placeId: s.places[0].id,
          period: month,
          date,
          counted: 1000,
          note: "Sayım",
        },
        actor,
      ),
    /maliyetli/,
  );
});
test("Kapanış kişi sayısı ister; yetişkin ve çocuk eşit toplanır", () => {
  let s = receipt(fixture());
  assert.throws(
    () => applyCommand(s, { type: "close", period: month }, actor),
    /kişi/,
  );
  s = applyCommand(
    s,
    { type: "people", period: month, adults: 10, children: 5 },
    actor,
  );
  s = applyCommand(s, { type: "close", period: month }, actor);
  assert.equal(s.periods[0].snapshots[0].people, 15);
});
test("Kapalı dönemde operasyon yapılamaz; yeniden açma eski raporu değiştirmez", () => {
  let s = receipt(fixture());
  s = applyCommand(
    s,
    { type: "people", period: month, adults: 10, children: 0 },
    actor,
  );
  s = applyCommand(s, { type: "close", period: month }, actor);
  const snapshot = JSON.stringify(s.periods[0].snapshots[0]);
  assert.throws(
    () =>
      applyCommand(
        s,
        {
          type: "consume",
          placeId: s.places[0].id,
          productId: s.products[0].id,
          period: month,
          date,
          qty: 1000,
          note: "Kapalı çıkış",
        },
        actor,
      ),
    /kapalı/,
  );
  s = applyCommand(
    s,
    { type: "reopen", period: month, reason: "Sayım düzeltmesi" },
    actor,
  );
  s = applyCommand(
    s,
    {
      type: "consume",
      placeId: s.places[0].id,
      productId: s.products[0].id,
      period: month,
      date,
      qty: 1000,
      note: "Servis",
    },
    actor,
  );
  s = applyCommand(s, { type: "close", period: month }, actor);
  assert.equal(JSON.stringify(s.periods[0].snapshots[0]), snapshot);
  assert.equal(s.periods[0].snapshots.length, 2);
});
test("Bekleyen fatura ve transfer kapanışı engeller", () => {
  let s = receipt(fixture());
  s = applyCommand(
    s,
    { type: "people", period: month, adults: 10, children: 0 },
    actor,
  );
  s = applyCommand(
    s,
    {
      type: "transfer",
      from: s.places[0].id,
      to: s.places[1].id,
      period: month,
      date,
      note: "Teslim",
      lines: [{ productId: s.products[0].id, qty: 1000 }],
    },
    actor,
  );
  assert.throws(
    () => applyCommand(s, { type: "close", period: month }, actor),
    /Bekleyen/,
  );
});
test("Geç fatura belge tarihi eski ay olsa da açık kayıt dönemine girer", () => {
  let s = receipt(fixture());
  s = applyCommand(
    s,
    { type: "people", period: month, adults: 10, children: 0 },
    actor,
  );
  s = applyCommand(s, { type: "close", period: month }, actor);
  s = applyCommand(s, { type: "newPeriod", period: "2026-11" }, actor);
  s = applyCommand(
    s,
    {
      type: "invoice",
      reference: "GEÇ-1",
      supplier: "Tedarikçi",
      documentDate: date,
      period: "2026-11",
      placeId: s.places[0].id,
      lines: [
        { productId: s.products[0].id, qty: 1000, unitPrice: 12000, vat: 1 },
      ],
    },
    actor,
  );
  s = applyCommand(
    s,
    { type: "postInvoice", invoiceId: s.invoices.at(-1)!.id },
    actor,
  );
  assert.equal(purchases(s, "2026-11"), 12000);
  assert.equal(s.periods[0].snapshots[0].purchases, 100000);
  assert.throws(
    () =>
      applyCommand(
        s,
        { type: "reopen", period: month, reason: "Tarihsel değişim" },
        actor,
      ),
    /Sonraki dönem/,
  );
});
test("Mükerrer fatura tedarikçi ve numarayla reddedilir", () => {
  const s = receipt(fixture());
  assert.throws(
    () =>
      applyCommand(
        s,
        {
          type: "invoice",
          reference: "F-1",
          supplier: "Tedarikçi",
          documentDate: date,
          period: month,
          placeId: s.places[0].id,
          lines: [
            { productId: s.products[0].id, qty: 1000, unitPrice: 1, vat: 1 },
          ],
        },
        actor,
      ),
    /zaten/,
  );
});
test("Ters kayıt tüketimi geri alır ve orijinal hareketi korur", () => {
  let s = receipt(fixture());
  s = applyCommand(
    s,
    {
      type: "consume",
      placeId: s.places[0].id,
      productId: s.products[0].id,
      period: month,
      date,
      qty: 1000,
      note: "Servis",
    },
    actor,
  );
  const id = s.movements.at(-1)!.id;
  s = applyCommand(
    s,
    { type: "reverse", movementId: id, reason: "Yanlış miktar" },
    actor,
  );
  assert.equal(s.balances[0].qty, 10000);
  assert.equal(report(s, month)[0].cost, 0);
  assert.ok(s.movements.find((m) => m.id === id)?.reversedBy);
  assert.throws(() =>
    applyCommand(
      s,
      { type: "reverse", movementId: id, reason: "Tekrar" },
      actor,
    ),
  );
});
test("Salt okunur kullanıcı operasyon yapamaz; ambar dönemi kapatamaz", () => {
  const s = fixture();
  assert.throws(
    () =>
      applyCommand(
        s,
        { type: "place", name: "D", kind: "warehouse" },
        { ...actor, role: "viewer" },
      ),
    /yetki/,
  );
  assert.throws(
    () =>
      applyCommand(
        s,
        { type: "close", period: month },
        { ...actor, role: "storekeeper" },
      ),
    /Yönetici/,
  );
});
test("Geçersiz tarih, negatif miktar ve mükerrer satırlar reddedilir", () => {
  const s = receipt(fixture());
  const base = {
    type: "consume",
    placeId: s.places[0].id,
    productId: s.products[0].id,
    period: month,
    date,
    qty: 1000,
    note: "Servis",
  };
  assert.throws(() => applyCommand(s, { ...base, date: "2026-10-32" }, actor));
  assert.throws(() => applyCommand(s, { ...base, qty: -1 }, actor));
  assert.throws(
    () => applyCommand(s, { ...base, date: "2026-09-30" }, actor),
    /dönemde/,
  );
  assert.throws(
    () =>
      applyCommand(
        s,
        {
          type: "transfer",
          from: s.places[0].id,
          to: s.places[1].id,
          period: month,
          date,
          note: "Aynı kart",
          lines: [
            { productId: s.products[0].id, qty: 1000 },
            { productId: s.products[0].id, qty: 1000 },
          ],
        },
        actor,
      ),
    /tek satır/,
  );
});
test("InvenTree reçete uyarlaması porsiyon, ek pay ve yuvarlama hesaplar", () => {
  assert.equal(requiredQuantity(65, 100, 10), 7150);
  assert.equal(requiredQuantity(65, 100, 0, 100, 1000), 7000);
  assert.equal(recipeQuantity(1, 3, 3), 1);
  assert.equal(recipeQuantity(1, 3, 4), 2);
  assert.throws(() => requiredQuantity(65, 0));
});
test("Fatura ayrıştırması satır adaylarını çıkarır ve toplamı malzeme saymaz", () => {
  const rows = parseInvoiceText(
    "Domates 10 kg 58,00\nYumurta 120 adet 6,50\nKDV TOPLAM 39,20\nTOPLAM 1.360,00",
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, "Domates");
  assert.equal(parseDecimal("1.234,56"), 1234.56);
});
