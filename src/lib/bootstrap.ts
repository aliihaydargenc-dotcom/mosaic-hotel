import type { Query } from "./db";
import { hashPassword } from "./password";
export async function ensureInitialAdmin(query: Query) {
  const { rows } = await query<{ n: string }>(
    "SELECT count(*) AS n FROM mosaic_users",
  );
  if (Number(rows[0].n) !== 0) return;
  const email =
    process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() || "admin";
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || "admin";
  if (
    process.env.BOOTSTRAP_ADMIN_PASSWORD &&
    password !== "admin" &&
    password.length < 12
  )
    throw new Error("Özel yönetici parolası en az 12 karakter olmalı.");
  await query(
    "INSERT INTO mosaic_users (id,email,name,role,password_hash) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
    ["initial-manager", email, "Yönetici", "manager", hashPassword(password)],
  );
}
