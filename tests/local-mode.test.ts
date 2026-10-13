import { test } from "node:test";
import assert from "node:assert/strict";
import { localMode } from "../src/lib/db";
test("Harici veritabanı veya Vercel varken örnek oturumu etkinleşmez", () => {
  const names = ["MOSAIC_LOCAL_MODE", "DATABASE_URL", "VERCEL"] as const;
  const previous = Object.fromEntries(names.map((n) => [n, process.env[n]]));
  try {
    process.env.MOSAIC_LOCAL_MODE = "true";
    delete process.env.DATABASE_URL;
    delete process.env.VERCEL;
    assert.equal(localMode(), true);
    process.env.DATABASE_URL = "postgresql://test.invalid/test";
    assert.equal(localMode(), false);
    delete process.env.DATABASE_URL;
    process.env.VERCEL = "1";
    assert.equal(localMode(), false);
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});
