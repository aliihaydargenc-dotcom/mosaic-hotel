// Run only against an isolated test server, never against a live hotel's records.
// MOSAIC_VERIFY_ORIGIN and bootstrap credentials must be provided by the caller.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const base = process.env.MOSAIC_VERIFY_ORIGIN;
if (!base || !["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("A loopback test origin is required.");
const email = process.env.BOOTSTRAP_ADMIN_EMAIL,
  password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
if (!email || !password)
  throw new Error("Test bootstrap credentials required.");
const headers = { "Content-Type": "application/json", Origin: base };
async function request(path, body, cookie, method = "POST") {
  const r = await fetch(base + path, {
    method,
    headers: { ...headers, ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0],
  };
}
const auth = await request("/api/session", { email, password });
assert.equal(auth.status, 200);
assert.ok(auth.cookie);
const cookie = auth.cookie;
let initial = await request("/api/state", undefined, cookie, "GET");
assert.equal(initial.status, 200);
let state = initial.data;
assert.equal(
  state.products.length,
  0,
  "Use a fresh isolated PostgreSQL test database.",
);
const period = state.periods.at(-1).id,
  date = new Date().toLocaleDateString("en-CA", {
    timeZone: "Europe/Istanbul",
  });
async function command(c, expected = 200) {
  const r = await request(
    "/api/state",
    { version: state.version, requestId: randomUUID(), command: c },
    cookie,
  );
  assert.equal(r.status, expected);
  if (r.status === 200) state = r.data;
  return r;
}
await command({ type: "place", name: "Test ana depo", kind: "warehouse" });
await command({ type: "place", name: "Test mutfak", kind: "location" });
await command({
  type: "product",
  name: "Domates",
  code: "D-1",
  group: "Sebze",
  unit: "kg",
  minimum: 1000,
});
const a = state.places[0].id,
  b = state.places[1].id,
  p = state.products[0].id;
await command({
  type: "invoice",
  reference: "PG-1",
  supplier: "Test tedarikçi",
  documentDate: date,
  period,
  placeId: a,
  lines: [{ productId: p, qty: 10000, unitPrice: 5800, vat: 1 }],
});
await command({ type: "postInvoice", invoiceId: state.invoices[0].id });
assert.equal(state.balances[0].value, 58000);
const unchanged = structuredClone(state);
await command(
  {
    type: "consume",
    placeId: a,
    productId: p,
    qty: 11000,
    period,
    date,
    note: "Yetersiz",
  },
  400,
);
assert.deepEqual(
  (await request("/api/state", undefined, cookie, "GET")).data,
  unchanged,
);
await command({
  type: "transfer",
  from: a,
  to: b,
  period,
  date,
  note: "İmzalı teslim",
  lines: [{ productId: p, qty: 5000 }],
});
await command({
  type: "acceptTransfer",
  transferId: state.transfers[0].id,
  receivedBy: "Test alıcı",
});
assert.equal(
  state.balances.reduce((n, b) => n + b.value, 0),
  58000,
);
await command({
  type: "consume",
  placeId: b,
  productId: p,
  qty: 1000,
  period,
  date,
  note: "Servis",
});
await command({
  type: "count",
  placeId: b,
  productId: p,
  counted: 3500,
  period,
  date,
  note: "Sayım farkı",
});
const version = state.version;
const concurrent = await Promise.all(
  ["Eşzamanlı A", "Eşzamanlı B"].map((name) =>
    request(
      "/api/state",
      {
        version,
        requestId: randomUUID(),
        command: { type: "place", name, kind: "warehouse" },
      },
      cookie,
    ),
  ),
);
assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 400]);
state = (await request("/api/state", undefined, cookie, "GET")).data;
const requestId = randomUUID();
const payload = {
  version: state.version,
  requestId,
  command: { type: "people", period, adults: 10, children: 2 },
};
const first = await request("/api/state", payload, cookie),
  second = await request("/api/state", payload, cookie);
assert.equal(first.status, 200);
assert.equal(second.status, 200);
assert.equal(first.data.version, second.data.version);
state = second.data;
await command({ type: "close", period });
assert.equal(state.periods[0].snapshots[0].people, 12);
assert.equal(state.periods[0].snapshots[0].rows[0].cost, 8700);
await command(
  {
    type: "consume",
    placeId: b,
    productId: p,
    qty: 1000,
    period,
    date,
    note: "Kapalı",
  },
  400,
);
const snapshot = structuredClone(state.periods[0].snapshots[0]);
await command({ type: "reopen", period, reason: "Onaylı düzeltme" });
const movementId = state.movements.find((m) => m.type === "count").id;
await command({ type: "reverse", movementId, reason: "Sayım kontrolü" });
await command({ type: "close", period });
assert.deepEqual(state.periods[0].snapshots[0], snapshot);
assert.equal(state.periods[0].snapshots[1].rows[0].cost, 5800);
const childPassword = randomUUID() + randomUUID();
const user = await request(
  "/api/users",
  {
    email: "viewer@mosaic.test",
    password: childPassword,
    name: "Test rapor",
    role: "viewer",
  },
  cookie,
);
assert.equal(user.status, 200);
const viewer = await request("/api/session", {
  email: "viewer@mosaic.test",
  password: childPassword,
});
assert.equal(viewer.status, 200);
const denied = await request(
  "/api/state",
  {
    version: state.version,
    requestId: randomUUID(),
    command: { type: "place", name: "Yetkisiz", kind: "warehouse" },
  },
  viewer.cookie,
);
assert.equal(denied.status, 400);
const users = await request("/api/users", undefined, cookie, "GET");
const v = users.data.find((u) => u.email === "viewer@mosaic.test");
assert.equal(
  (
    await request(
      "/api/users",
      { id: v.id, name: v.name, role: v.role, active: false },
      cookie,
      "PATCH",
    )
  ).status,
  200,
);
assert.equal(
  (await request("/api/state", undefined, viewer.cookie, "GET")).status,
  401,
);
const self = users.data.find((u) => u.email === email);
assert.equal(
  (
    await request(
      "/api/users",
      { id: self.id, name: self.name, role: "viewer", active: true },
      cookie,
      "PATCH",
    )
  ).status,
  400,
);
for (let i = 0; i < 8; i++)
  assert.equal(
    (
      await request("/api/session", {
        email: "invalid@mosaic.test",
        password: "wrong-password",
      })
    ).status,
    400,
  );
assert.match(
  (
    await request("/api/session", {
      email: "invalid@mosaic.test",
      password: "wrong-password",
    })
  ).data.error,
  /15 dakika/,
);
const spoof = await fetch(base + "/api/state", {
  method: "POST",
  headers: { ...headers, Origin: "https://untrusted.example", Cookie: cookie },
  body: JSON.stringify(payload),
});
assert.equal(spoof.status, 400);
console.log(
  "PASS: real PostgreSQL, password login, persisted invoice, transfer, consumption, count, rollback, concurrency, idempotency, close/reopen snapshots, role enforcement, user deactivation, last manager protection, login rate limit, Origin protection.",
);
