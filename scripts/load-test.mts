/** Local-only production API benchmark; requires a disposable PostgreSQL database. */
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { sampleState } from "../src/lib/seed";
import { applyCommand, balance, today } from "../src/lib/domain";
import { mulDivRound } from "../src/lib/math";
import type { Actor } from "../src/lib/types";

const base = process.env.LOAD_TEST_BASE ?? "http://127.0.0.1:3100";
const dbURL = process.env.LOAD_TEST_DATABASE_URL;
if (
  !dbURL ||
  !["127.0.0.1", "localhost"].includes(new URL(base).hostname) ||
  !["127.0.0.1", "localhost"].includes(new URL(dbURL).hostname) ||
  !new URL(dbURL).pathname.endsWith("mosaicload")
)
  throw Error("Disposable local mosaicload database required");
const db = postgres(dbURL, { max: 1, prepare: false });
const actor: Actor = {
  id: "load-fixture",
  name: "Test",
  role: "manager",
  email: "test@invalid.example",
};
const login = await fetch(`${base}/api/session`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: base },
  body: JSON.stringify({ email: "admin", password: "admin" }),
});
if (!login.ok) throw Error("Local test login failed");
const cookie = login.headers.get("set-cookie")!.split(";")[0];
const headers = {
  Cookie: cookie,
  Origin: base,
  "Content-Type": "application/json",
};
function summary(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const percentile = (p: number) =>
    Math.round(
      sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)],
    );
  return {
    p50_ms: percentile(0.5),
    p95_ms: percentile(0.95),
    max_ms: Math.round(sorted.at(-1) ?? 0),
  };
}
function fixture(count: number) {
  let state = sampleState();
  const period = state.periods.at(-1)!.id;
  state = applyCommand(
    state,
    {
      type: "invoice",
      reference: "LOAD-OPENING",
      supplier: "Test fixture",
      documentDate: today(),
      period,
      placeId: state.places[0].id,
      lines: state.products.map((p) => ({
        productId: p.id,
        qty: 1_000_000,
        unitPrice: 10000,
        vat: 1,
      })),
    },
    actor,
  );
  state = applyCommand(
    state,
    { type: "postInvoice", invoiceId: state.invoices.at(-1)!.id },
    actor,
  );
  // Bulk-generate a consistent historical ledger; avoid quadratic setup cost from immutable commands.
  for (let i = state.movements.length; i < count; i++) {
    const product = state.products[i % 6];
    const stock = balance(state, product.id, state.places[0].id);
    const qty = 100;
    const value = mulDivRound(stock.value, qty, stock.qty);
    stock.qty -= qty;
    stock.value -= value;
    state.movements.push({
      id: randomUUID(),
      type: "consumption",
      productId: product.id,
      qty,
      value,
      from: state.places[0].id,
      date: today(),
      period,
      note: "Sentetik servis tüketimi",
      actor: actor.name,
    });
    state.audit.push({
      id: randomUUID(),
      at: new Date().toISOString(),
      actor: actor.name,
      action: "consume",
      detail: product.name,
    });
    state.version++;
  }
  for (let i = state.products.length; i < 120; i++)
    state.products.push({
      id: randomUUID(),
      code: `LOAD-${i}`,
      name: `Test malzemesi ${i}`,
      group: "Test",
      unit: "kg",
      minimum: 1000,
    });
  return state;
}
const results: Record<string, unknown>[] = [];
try {
  for (const records of [100, 2500, 10000]) {
    const seeded = fixture(records);
    await db`UPDATE mosaic_state SET data=${db.json(seeded as never)} WHERE id=1`;
    await db`DELETE FROM mosaic_requests`;
    for (const concurrency of [1, 5, 10]) {
      const samples: number[] = [];
      let errors = 0;
      let responseBytes = 0;
      const start = performance.now();
      await Promise.all(
        Array.from({ length: concurrency }, async () => {
          for (let i = 0; i < 10; i++) {
            const at = performance.now();
            const r = await fetch(`${base}/api/state`, { headers });
            const text = await r.text();
            samples.push(performance.now() - at);
            responseBytes = Buffer.byteLength(text);
            if (!r.ok) errors++;
          }
        }),
      );
      const elapsed = performance.now() - start;
      const item = {
        type: "read",
        records,
        concurrency,
        requests: samples.length,
        errors,
        response_bytes: responseBytes,
        requests_per_second: Math.round((samples.length * 1000) / elapsed),
        ...summary(samples),
      };
      results.push(item);
      console.log(JSON.stringify(item));
    }
    for (const concurrency of [1, 5, 10]) {
      let accepted = 0,
        conflicts = 0,
        errors = 0;
      const samples: number[] = [];
      const before = (await db`SELECT data FROM mosaic_state WHERE id=1`)[0]
        .data;
      const initialQty = before.balances.find(
        (b: any) =>
          b.productId === seeded.products[0].id &&
          b.placeId === seeded.places[0].id,
      ).qty;
      await Promise.all(
        Array.from({ length: concurrency }, async () => {
          for (let i = 0; i < 5; i++) {
            const at = performance.now();
            const r = await fetch(`${base}/api/state`, { headers });
            const state = await r.json();
            const response = await fetch(`${base}/api/state`, {
              method: "POST",
              headers,
              body: JSON.stringify({
                version: state.version,
                requestId: randomUUID(),
                command: {
                  type: "consume",
                  placeId: state.places[0].id,
                  productId: state.products[0].id,
                  qty: 100,
                  period: state.periods.at(-1).id,
                  date: today(),
                  note: "Yük testi",
                },
              }),
            });
            const body = await response.json();
            samples.push(performance.now() - at);
            if (response.ok) accepted++;
            else if (body.error?.includes("Kayıtlar değişti")) conflicts++;
            else errors++;
          }
        }),
      );
      const after = (await db`SELECT data FROM mosaic_state WHERE id=1`)[0]
        .data;
      const finalQty = after.balances.find(
        (b: any) =>
          b.productId === seeded.products[0].id &&
          b.placeId === seeded.places[0].id,
      ).qty;
      const integrity = initialQty - finalQty === accepted * 100;
      const item = {
        type: "write",
        records,
        concurrency,
        attempts: samples.length,
        accepted,
        conflicts,
        errors,
        integrity,
        ...summary(samples),
      };
      results.push(item);
      console.log(JSON.stringify(item));
      if (errors || !integrity) throw Error("Load test integrity failure");
    }
  }
  await mkdir(".local/research", { recursive: true });
  await writeFile(
    ".local/research/load-test.json",
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        environment:
          "Local production Next.js + disposable PostgreSQL17; no network latency, no OCR, no attachments",
        results,
      },
      null,
      2,
    ),
  );
} finally {
  await db.end();
}
