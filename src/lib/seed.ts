import { blankState, applyCommand, today } from "./domain";
import type { Actor } from "./types";
export function sampleState() {
  const actor: Actor = {
    id: "seed",
    name: "Örnek kayıt",
    role: "manager",
    email: "sample@local",
  };
  let s = blankState();
  const period = s.periods[0].id;
  const run = (c: unknown) => {
    s = applyCommand(s, c, actor);
  };
  for (const [name, kind] of [
    ["Ana depo", "warehouse"],
    ["Soğuk depo", "warehouse"],
    ["Mutfak", "location"],
    ["Kahvaltı büfesi", "location"],
    ["Lobi bar", "location"],
  ] as const)
    run({ type: "place", name, kind });
  const items = [
    ["G-001", "Beyaz peynir", "Süt ürünleri", "kg", 15000, 24500],
    ["G-002", "Domates", "Sebze & meyve", "kg", 25000, 5800],
    ["G-003", "Yumurta", "Kahvaltılık", "adet", 180000, 650],
    ["G-004", "Tereyağı", "Süt ürünleri", "kg", 8000, 39000],
    ["G-005", "Portakal suyu", "İçecek", "lt", 20000, 7200],
    ["G-006", "Siyah zeytin", "Kahvaltılık", "kg", 10000, 18500],
  ] as const;
  for (const [code, name, group, unit, minimum] of items)
    run({ type: "product", code, name, group, unit, minimum });
  run({
    type: "invoice",
    reference: "ORN-2026-001",
    supplier: "Örnek Gıda Tedarik",
    documentDate: today(),
    period,
    placeId: s.places[0].id,
    lines: items.map((x, i) => ({
      productId: s.products[i].id,
      qty: i === 2 ? 600000 : 100000,
      unitPrice: x[5],
      vat: 1,
    })),
  });
  run({ type: "postInvoice", invoiceId: s.invoices[0].id });
  run({
    type: "transfer",
    from: s.places[0].id,
    to: s.places[3].id,
    period,
    date: today(),
    note: "Kahvaltı hazırlığı",
    lines: s.products.map((p, i) => ({
      productId: p.id,
      qty: i === 2 ? 240000 : 40000,
    })),
  });
  run({
    type: "acceptTransfer",
    transferId: s.transfers[0].id,
    receivedBy: "Örnek teslim alan",
  });
  for (let i = 0; i < 6; i++)
    run({
      type: "consume",
      placeId: s.places[3].id,
      productId: s.products[i].id,
      qty: i === 2 ? 120000 : [12000, 22000, 0, 5000, 18000, 9000][i],
      period,
      date: today(),
      note: "Kahvaltı servisi",
    });
  run({ type: "people", period, adults: 160, children: 24 });
  run({
    type: "recipe",
    name: "Açık büfe kahvaltı",
    portions: 100,
    lines: s.products.map((p, i) => ({
      productId: p.id,
      qty: [6500, 12000, 100000, 2500, 10000, 5000][i],
      wastePercent: i === 1 ? 5 : 0,
    })),
  });
  return s;
}
