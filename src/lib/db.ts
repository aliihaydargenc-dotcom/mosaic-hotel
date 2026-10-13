import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes, scryptSync } from "node:crypto";
import { join } from "node:path";
import { blankState } from "./domain";
import { sampleState } from "./seed";
import type { State } from "./types";
export const localMode = () =>
  process.env.MOSAIC_LOCAL_MODE === "true" &&
  !process.env.VERCEL &&
  !process.env.DATABASE_URL;
type Result<T> = { rows: T[] };
export type Query = <T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
) => Promise<Result<T>>;
type DB = {
  query: Query;
  transaction: <T>(fn: (q: Query) => Promise<T>) => Promise<T>;
};
const shared = globalThis as unknown as {
  mosaicDB?: Promise<DB>;
  mosaicSecret?: Promise<string>;
};
export async function sessionSecret() {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32)
    return process.env.SESSION_SECRET;
  if (!localMode()) throw new Error("SESSION_SECRET en az 32 karakter olmalı.");
  shared.mosaicSecret ??= (async () => {
    await mkdir(join(process.cwd(), ".local"), { recursive: true });
    const path = join(process.cwd(), ".local/session-secret");
    try {
      return await readFile(path, "utf8");
    } catch {
      const v = randomBytes(48).toString("hex");
      await writeFile(path, v, { mode: 0o600, flag: "wx" });
      return v;
    }
  })();
  return shared.mosaicSecret;
}
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
async function createDB(): Promise<DB> {
  let db: DB;
  if (process.env.DATABASE_URL) {
    const sql = postgres(process.env.DATABASE_URL, {
      max: 3,
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 15,
    });
    const query: Query = async <T>(s: string, p: unknown[] = []) => ({
      rows: (await sql.unsafe(s, p as never[])) as unknown as T[],
    });
    db = {
      query,
      transaction: async (fn) =>
        (await sql.begin(async (tx) =>
          fn(async <T>(s: string, p: unknown[] = []) => ({
            rows: (await tx.unsafe(s, p as never[])) as unknown as T[],
          })),
        )) as Awaited<ReturnType<typeof fn>>,
    };
  } else {
    if (!localMode())
      throw new Error(
        "DATABASE_URL gerekli. Vercel üzerinde yerel dosya veritabanı kullanılmaz.",
      );
    await mkdir(join(process.cwd(), ".local"), { recursive: true });
    const pg = new PGlite(join(process.cwd(), ".local/database"));
    db = {
      query: async <T>(s: string, p: unknown[] = []) => ({
        rows: (await pg.query<T>(s, p)).rows,
      }),
      transaction: (fn) =>
        pg.transaction((tx) =>
          fn(async <T>(s: string, p: unknown[] = []) => ({
            rows: (await tx.query<T>(s, p)).rows,
          })),
        ),
    };
  }
  const schema = `CREATE TABLE IF NOT EXISTS mosaic_state (id integer PRIMARY KEY CHECK(id=1), data jsonb NOT NULL);
    CREATE TABLE IF NOT EXISTS mosaic_users (id text PRIMARY KEY, email text UNIQUE NOT NULL, name text NOT NULL, role text NOT NULL CHECK(role IN ('manager','storekeeper','viewer')), password_hash text NOT NULL, active boolean NOT NULL DEFAULT true);
    CREATE TABLE IF NOT EXISTS mosaic_auth_attempts (email text PRIMARY KEY, attempts integer NOT NULL, since timestamptz NOT NULL);
    CREATE TABLE IF NOT EXISTS mosaic_requests (id text PRIMARY KEY, actor text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS mosaic_documents (invoice_id text PRIMARY KEY, data bytea NOT NULL, mime text NOT NULL, name text NOT NULL, hash text NOT NULL);`;
  for (const statement of schema.split(";").filter((s) => s.trim()))
    await db.query(statement);
  const state = localMode() ? sampleState() : blankState();
  await db.query(
    "INSERT INTO mosaic_state (id,data) VALUES (1,$1::jsonb) ON CONFLICT(id) DO NOTHING",
    [state],
  );
  if (!localMode()) {
    const { rows } = await db.query<{ n: string }>(
      "SELECT count(*) AS n FROM mosaic_users",
    );
    if (Number(rows[0].n) === 0) {
      const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase();
      const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
      if (!email || !password || password.length < 12)
        throw new Error(
          "İlk yönetici için BOOTSTRAP_ADMIN_EMAIL ve en az 12 karakterli BOOTSTRAP_ADMIN_PASSWORD gerekli.",
        );
      await db.query(
        "INSERT INTO mosaic_users (id,email,name,role,password_hash) VALUES ($1,$2,$3,$4,$5) ON CONFLICT(email) DO NOTHING",
        [
          "initial-manager",
          email,
          "Yönetici",
          "manager",
          hashPassword(password),
        ],
      );
    }
  }
  return db;
}
export function database() {
  shared.mosaicDB ??= createDB().catch((e) => {
    shared.mosaicDB = undefined;
    throw e;
  });
  return shared.mosaicDB;
}
export async function getState(): Promise<State> {
  const db = await database();
  const r = await db.query<{ data: State }>(
    "SELECT data FROM mosaic_state WHERE id=1",
  );
  return r.rows[0].data;
}
