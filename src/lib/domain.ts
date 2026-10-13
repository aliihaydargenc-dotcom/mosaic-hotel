import { UserFacingError } from "./errors";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { report, purchases } from "./reporting";
import { mulDivRound } from "./math";
export { report, purchases } from "./reporting";
import type { Actor, Balance, Movement, ReportRow, State } from "./types";
const id = z.string().min(1).max(100);
const text = z.string().trim().min(1).max(200);
const qty = z.number().int().positive().max(1_000_000_000);
const money = z.number().int().nonnegative().max(1_000_000_000);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
  );
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const invoiceLine = z.object({
  productId: id,
  qty,
  unitPrice: money,
  vat: z.number().int().min(0).max(100),
});
const attachment = z.object({
  name: text,
  mime: z.enum(["application/pdf", "image/png", "image/jpeg"]),
  data: z.string().max(4_000_000),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
});
export const commandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("product"),
    productId: id.optional(),
    name: text,
    code: text,
    group: text,
    unit: z.enum(["kg", "lt", "adet"]),
    minimum: money,
  }),
  z.object({
    type: z.literal("place"),
    placeId: id.optional(),
    name: text,
    kind: z.enum(["warehouse", "location"]),
  }),
  z.object({
    type: z.literal("invoice"),
    invoiceId: id.optional(),
    reference: text,
    supplier: text,
    documentDate: date,
    period: month,
    placeId: id,
    lines: z.array(invoiceLine).min(1).max(100),
    attachment: attachment.optional(),
    extractedText: z.string().max(50_000).optional(),
  }),
  z.object({ type: z.literal("postInvoice"), invoiceId: id }),
  z.object({
    type: z.literal("transfer"),
    from: id,
    to: id,
    period: month,
    date,
    note: text,
    lines: z
      .array(z.object({ productId: id, qty }))
      .min(1)
      .max(100),
  }),
  z.object({
    type: z.literal("acceptTransfer"),
    transferId: id,
    receivedBy: text,
  }),
  z.object({
    type: z.literal("consume"),
    placeId: id,
    productId: id,
    qty,
    period: month,
    date,
    note: text,
  }),
  z.object({
    type: z.literal("count"),
    placeId: id,
    productId: id,
    counted: money,
    period: month,
    date,
    note: text,
  }),
  z.object({
    type: z.literal("people"),
    period: month,
    adults: z.number().int().min(0).max(1_000_000),
    children: z.number().int().min(0).max(1_000_000),
  }),
  z.object({ type: z.literal("close"), period: month }),
  z.object({ type: z.literal("reopen"), period: month, reason: text }),
  z.object({ type: z.literal("newPeriod"), period: month }),
  z.object({ type: z.literal("reverse"), movementId: id, reason: text }),
  z.object({
    type: z.literal("recipe"),
    recipeId: id.optional(),
    name: text,
    portions: z.number().int().positive().max(100_000),
    lines: z
      .array(
        z.object({
          productId: id,
          qty,
          wastePercent: z.number().min(0).max(100),
        }),
      )
      .min(1)
      .max(100),
  }),
]);
export type Command = z.infer<typeof commandSchema>;
export function currentMonth() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
  })
    .format(new Date())
    .slice(0, 7);
}
export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function blankState(period = currentMonth()): State {
  return {
    version: 0,
    products: [],
    places: [],
    balances: [],
    invoices: [],
    movements: [],
    transfers: [],
    recipes: [],
    audit: [],
    periods: [
      {
        id: period,
        status: "open",
        adults: 0,
        children: 0,
        revision: 0,
        snapshots: [],
      },
    ],
  };
}
function open(s: State, period: string) {
  const p = s.periods.find((p) => p.id === period);
  if (!p || p.status !== "open")
    throw new UserFacingError("Dönem kapalı veya bulunamadı.");
  return p;
}
function product(s: State, productId: string) {
  const p = s.products.find((p) => p.id === productId);
  if (!p) throw new UserFacingError("Stok kartı bulunamadı.");
  return p;
}
function place(s: State, placeId: string) {
  const p = s.places.find((p) => p.id === placeId);
  if (!p) throw new UserFacingError("Depo/lokasyon bulunamadı.");
  return p;
}
export function balance(s: State, productId: string, placeId: string): Balance {
  let b = s.balances.find(
    (b) => b.productId === productId && b.placeId === placeId,
  );
  if (!b) {
    b = { productId, placeId, qty: 0, value: 0 };
    s.balances.push(b);
  }
  return b;
}
function remove(b: Balance, q: number) {
  if (q > b.qty)
    throw new UserFacingError("Yetersiz stok. İşlem kaydedilmedi.");
  const value = q === b.qty ? b.value : mulDivRound(b.value, q, b.qty);
  b.qty -= q;
  b.value -= value;
  return value;
}
function checkDate(d: string, p: string) {
  if (d.slice(0, 7) !== p)
    throw new UserFacingError("İşlem tarihi seçilen dönemde olmalı.");
}
function uniqueProducts(lines: { productId: string }[]) {
  if (new Set(lines.map((l) => l.productId)).size !== lines.length)
    throw new UserFacingError("Aynı stok kartı tek satırda yer almalı.");
}
function movement(
  s: State,
  actor: Actor,
  data: Omit<Movement, "id" | "actor">,
) {
  const m = { ...data, id: randomUUID(), actor: actor.name };
  s.movements.push(m);
  return m;
}
export function applyCommand(
  original: State,
  raw: unknown,
  actor: Actor,
): State {
  if (actor.role === "viewer")
    throw new UserFacingError("Bu işlem için yetkiniz yok.");
  const c = commandSchema.parse(raw);
  if (
    ["close", "reopen", "reverse", "newPeriod"].includes(c.type) &&
    actor.role !== "manager"
  )
    throw new UserFacingError("Yönetici yetkisi gerekli.");
  const s = structuredClone(original);
  let detail = "";
  switch (c.type) {
    case "product": {
      const old = c.productId ? product(s, c.productId) : undefined;
      if (
        s.products.some(
          (p) =>
            p.id !== old?.id &&
            p.code.toLocaleLowerCase("tr") === c.code.toLocaleLowerCase("tr"),
        )
      )
        throw new UserFacingError("Stok kodu zaten var.");
      if (
        old &&
        old.unit !== c.unit &&
        s.movements.some((m) => m.productId === old.id)
      )
        throw new UserFacingError(
          "Hareket görmüş stok kartının temel birimi değiştirilemez.",
        );
      const p = {
        id: old?.id ?? randomUUID(),
        name: c.name,
        code: c.code,
        group: c.group,
        unit: c.unit,
        minimum: c.minimum,
      };
      if (old) s.products[s.products.indexOf(old)] = p;
      else s.products.push(p);
      detail = c.name;
      break;
    }
    case "place": {
      const old = c.placeId ? place(s, c.placeId) : undefined;
      if (
        s.places.some(
          (p) =>
            p.id !== old?.id &&
            p.name.toLocaleLowerCase("tr") === c.name.toLocaleLowerCase("tr"),
        )
      )
        throw new UserFacingError("Bu isim zaten kullanılıyor.");
      const p = { id: old?.id ?? randomUUID(), name: c.name, kind: c.kind };
      if (old) s.places[s.places.indexOf(old)] = p;
      else s.places.push(p);
      detail = c.name;
      break;
    }
    case "invoice": {
      open(s, c.period);
      place(s, c.placeId);
      uniqueProducts(c.lines);
      c.lines.forEach((l) => product(s, l.productId));
      const old = s.invoices.find((i) => i.id === c.invoiceId);
      if (c.invoiceId && !old) throw new UserFacingError("Fatura bulunamadı.");
      if (old?.status === "posted")
        throw new UserFacingError("Muhasebeleşen fatura değiştirilemez.");
      if (old) open(s, old.period);
      if (
        s.invoices.some(
          (i) =>
            i.id !== old?.id &&
            ((i.reference.toLocaleLowerCase("tr") ===
              c.reference.toLocaleLowerCase("tr") &&
              i.supplier.toLocaleLowerCase("tr") ===
                c.supplier.toLocaleLowerCase("tr")) ||
              (c.attachment && i.attachment?.hash === c.attachment.hash)),
        )
      )
        throw new UserFacingError("Bu fatura/belge zaten kayıtlı.");
      const inv = {
        id: old?.id ?? randomUUID(),
        reference: c.reference,
        supplier: c.supplier,
        documentDate: c.documentDate,
        period: c.period,
        placeId: c.placeId,
        lines: c.lines,
        status: "draft" as const,
        attachment: c.attachment ?? old?.attachment,
        extractedText: c.extractedText ?? old?.extractedText,
      };
      if (old) s.invoices[s.invoices.indexOf(old)] = inv;
      else s.invoices.push(inv);
      detail = c.reference;
      break;
    }
    case "postInvoice": {
      const inv = s.invoices.find((i) => i.id === c.invoiceId);
      if (!inv) throw new UserFacingError("Fatura bulunamadı.");
      open(s, inv.period);
      if (inv.status === "posted")
        throw new UserFacingError("Fatura zaten işlendi.");
      inv.lines.forEach((l) => {
        const b = balance(s, l.productId, inv.placeId);
        const value = mulDivRound(l.qty, l.unitPrice, 1000);
        b.qty += l.qty;
        b.value += value;
        movement(s, actor, {
          type: "receipt",
          productId: l.productId,
          qty: l.qty,
          value,
          to: inv.placeId,
          date: today(),
          period: inv.period,
          note: inv.reference,
          invoiceId: inv.id,
        });
      });
      inv.status = "posted";
      detail = inv.reference;
      break;
    }
    case "transfer": {
      open(s, c.period);
      checkDate(c.date, c.period);
      place(s, c.from);
      place(s, c.to);
      uniqueProducts(c.lines);
      if (c.from === c.to)
        throw new UserFacingError("Kaynak ve hedef aynı olamaz.");
      for (const l of c.lines) {
        product(s, l.productId);
        if (balance(s, l.productId, c.from).qty < l.qty)
          throw new UserFacingError("Yetersiz stok.");
      }
      const t = {
        id: randomUUID(),
        from: c.from,
        to: c.to,
        date: c.date,
        period: c.period,
        lines: c.lines,
        status: "pending" as const,
        requestedBy: actor.name,
        note: c.note,
      };
      s.transfers.push(t);
      detail = t.id;
      break;
    }
    case "acceptTransfer": {
      const t = s.transfers.find((t) => t.id === c.transferId);
      if (!t || t.status !== "pending")
        throw new UserFacingError(
          "Transfer bulunamadı veya zaten kabul edildi.",
        );
      open(s, t.period);
      for (const l of t.lines) {
        const value = remove(balance(s, l.productId, t.from), l.qty);
        const target = balance(s, l.productId, t.to);
        target.qty += l.qty;
        target.value += value;
        movement(s, actor, {
          type: "transfer",
          productId: l.productId,
          qty: l.qty,
          value,
          from: t.from,
          to: t.to,
          date: t.date,
          period: t.period,
          note: t.note,
          transferId: t.id,
        });
      }
      t.status = "accepted";
      t.receivedBy = c.receivedBy;
      t.acceptedAt = new Date().toISOString();
      detail = t.id;
      break;
    }
    case "consume": {
      open(s, c.period);
      checkDate(c.date, c.period);
      product(s, c.productId);
      place(s, c.placeId);
      const value = remove(balance(s, c.productId, c.placeId), c.qty);
      movement(s, actor, {
        type: "consumption",
        productId: c.productId,
        qty: c.qty,
        value,
        from: c.placeId,
        date: c.date,
        period: c.period,
        note: c.note,
      });
      detail = c.note;
      break;
    }
    case "count": {
      open(s, c.period);
      checkDate(c.date, c.period);
      product(s, c.productId);
      place(s, c.placeId);
      const b = balance(s, c.productId, c.placeId);
      const delta = c.counted - b.qty;
      if (delta === 0) throw new UserFacingError("Sayım farkı yok.");
      if (b.qty === 0 && delta > 0)
        throw new UserFacingError(
          "Sıfır stok için önce maliyetli alım kaydı açın.",
        );
      const value =
        delta < 0 ? -remove(b, -delta) : mulDivRound(b.value, delta, b.qty);
      if (delta > 0) {
        b.qty += delta;
        b.value += value;
      }
      movement(s, actor, {
        type: "count",
        productId: c.productId,
        qty: delta,
        value,
        to: c.placeId,
        date: c.date,
        period: c.period,
        note: c.note,
      });
      detail = c.note;
      break;
    }
    case "people": {
      const p = open(s, c.period);
      p.adults = c.adults;
      p.children = c.children;
      detail = c.period;
      break;
    }
    case "close": {
      const p = open(s, c.period);
      if (
        s.transfers.some(
          (t) => t.period === c.period && t.status === "pending",
        ) ||
        s.invoices.some((i) => i.period === c.period && i.status === "draft")
      )
        throw new UserFacingError("Bekleyen fatura veya transfer var.");
      if (p.adults + p.children === 0)
        throw new UserFacingError("Kapanış için kişi sayısını girin.");
      p.status = "closed";
      p.revision++;
      p.snapshots.push({
        revision: p.revision,
        closedAt: new Date().toISOString(),
        closedBy: actor.name,
        rows: report(s, p.id),
        purchases: purchases(s, p.id),
        people: p.adults + p.children,
        catalog: structuredClone(s.products),
        adults: p.adults,
        children: p.children,
      });
      detail = c.period;
      break;
    }
    case "reopen": {
      const p = s.periods.find((p) => p.id === c.period);
      if (!p || p.status !== "closed")
        throw new UserFacingError("Dönem kapalı değil.");
      if (s.periods.some((x) => x.id > p.id))
        throw new UserFacingError(
          "Sonraki dönem açılmış. Tarihsel maliyetler için yeniden değerleme gerekir.",
        );
      p.status = "open";
      detail = `${c.period}: ${c.reason}`;
      break;
    }
    case "newPeriod": {
      if (s.periods.some((p) => p.status === "open"))
        throw new UserFacingError("Önce açık dönemi kapatın.");
      const latest = [...s.periods].sort((a, b) => b.id.localeCompare(a.id))[0]
        ?.id;
      if (latest) {
        const d = new Date(`${latest}-01T00:00:00Z`);
        d.setUTCMonth(d.getUTCMonth() + 1);
        if (c.period !== d.toISOString().slice(0, 7))
          throw new UserFacingError("Sıradaki ayı seçin.");
      }
      if (s.periods.some((p) => p.id === c.period))
        throw new UserFacingError("Dönem zaten var.");
      s.periods.push({
        id: c.period,
        status: "open",
        adults: 0,
        children: 0,
        revision: 0,
        snapshots: [],
      });
      detail = c.period;
      break;
    }
    case "reverse": {
      const m = s.movements.find((m) => m.id === c.movementId);
      if (!m || m.reversedBy || m.type === "reversal")
        throw new UserFacingError("Hareket ters kayıt için uygun değil.");
      open(s, m.period);
      if (m.to) {
        const b = balance(s, m.productId, m.to);
        b.qty -= m.qty;
        b.value -= m.value;
        if (b.qty < 0 || b.value < 0)
          throw new UserFacingError(
            "Stok kullanılmış; ters kayıt yapılamıyor.",
          );
        if (!b.qty && b.value)
          throw new UserFacingError(
            "Maliyet değişmiş; tam yeniden değerleme gerekli.",
          );
      }
      if (m.from) {
        const b = balance(s, m.productId, m.from);
        b.qty += m.qty;
        b.value += m.value;
      }
      const rev = movement(s, actor, {
        type: "reversal",
        productId: m.productId,
        qty: -m.qty,
        value: -m.value,
        from: m.to,
        to: m.from,
        period: m.period,
        date: today(),
        note: c.reason,
        reverses: m.id,
      });
      m.reversedBy = rev.id;
      detail = c.reason;
      break;
    }
    case "recipe": {
      uniqueProducts(c.lines);
      c.lines.forEach((l) => product(s, l.productId));
      const old = s.recipes.find((r) => r.id === c.recipeId);
      if (c.recipeId && !old) throw new UserFacingError("Reçete bulunamadı.");
      const r = {
        id: old?.id ?? randomUUID(),
        name: c.name,
        portions: c.portions,
        lines: c.lines,
      };
      if (old) s.recipes[s.recipes.indexOf(old)] = r;
      else s.recipes.push(r);
      detail = c.name;
      break;
    }
  }
  if (
    s.balances.some(
      (b) =>
        !Number.isSafeInteger(b.qty) ||
        !Number.isSafeInteger(b.value) ||
        b.qty < 0 ||
        b.value < 0,
    )
  )
    throw new UserFacingError("Stok/maliyet sınırı aşıldı.");
  s.version++;
  s.audit.push({
    id: randomUUID(),
    at: new Date().toISOString(),
    actor: actor.name,
    action: c.type,
    detail,
  });
  return s;
}
