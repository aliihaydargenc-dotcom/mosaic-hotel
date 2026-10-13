import { test } from "node:test";
import assert from "node:assert/strict";
import { scryptSync } from "node:crypto";
import { ensureInitialAdmin } from "../src/lib/bootstrap";
import type { Query } from "../src/lib/db";
test("Boş kurulum admin/admin oluşturur, var olan hesap değiştirilmez", async () => {
  const names = ["BOOTSTRAP_ADMIN_EMAIL", "BOOTSTRAP_ADMIN_PASSWORD"] as const;
  const previous = Object.fromEntries(names.map((n) => [n, process.env[n]]));
  let count = 0;
  let writes = 0;
  let params: unknown[] = [];
  const q: Query = async <T>(sql: string, p: unknown[] = []) => {
    if (sql.startsWith("SELECT count"))
      return { rows: [{ n: String(count) }] as T[] };
    writes++;
    count++;
    params = p;
    return { rows: [] };
  };
  try {
    names.forEach((n) => delete process.env[n]);
    await ensureInitialAdmin(q);
    assert.equal(params[1], "admin");
    assert.equal(params[3], "manager");
    const [salt, hash] = String(params[4]).split(":");
    assert.equal(scryptSync("admin", salt, 64).toString("hex"), hash);
    await ensureInitialAdmin(q);
    assert.equal(writes, 1);
    count = 0;
    process.env.BOOTSTRAP_ADMIN_EMAIL = "owner@example.com";
    process.env.BOOTSTRAP_ADMIN_PASSWORD = "configured-long-password";
    await ensureInitialAdmin(q);
    assert.equal(params[1], "owner@example.com");
    count = 0;
    process.env.BOOTSTRAP_ADMIN_EMAIL = "admin";
    process.env.BOOTSTRAP_ADMIN_PASSWORD = "admin";
    await ensureInitialAdmin(q);
    assert.equal(params[1], "admin");
    assert.equal(writes, 3);
  } finally {
    for (const n of names) {
      if (previous[n] === undefined) delete process.env[n];
      else process.env[n] = previous[n];
    }
  }
});
