import { UserFacingError } from "./errors";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual, scryptSync } from "node:crypto";
import { database, localMode, sessionSecret } from "./db";
import type { Actor } from "./types";
const demos: Record<string, Actor> = {
  manager: {
    id: "local-manager",
    name: "Ali Haydar Genç",
    role: "manager",
    email: "manager@local",
  },
  storekeeper: {
    id: "local-storekeeper",
    name: "Ambar sorumlusu",
    role: "storekeeper",
    email: "storekeeper@local",
  },
  viewer: {
    id: "local-viewer",
    name: "Rapor kullanıcısı",
    role: "viewer",
    email: "viewer@local",
  },
};
export async function issueSession(actor: Actor) {
  const payload = Buffer.from(
    JSON.stringify({ id: actor.id, exp: Date.now() + 8 * 3600_000 }),
  ).toString("base64url");
  const sig = createHmac("sha256", await sessionSecret())
    .update(payload)
    .digest("base64url");
  (await cookies()).set("mosaic_session", `${payload}.${sig}`, {
    httpOnly: true,
    secure: !localMode(),
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 3600,
  });
}
export async function getActor(): Promise<Actor | null> {
  const token = (await cookies()).get("mosaic_session")?.value;
  if (!token) return null;
  try {
    const [p, s] = token.split(".");
    const expected = createHmac("sha256", await sessionSecret())
      .update(p)
      .digest();
    const actual = Buffer.from(s, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return null;
    const data = JSON.parse(Buffer.from(p, "base64url").toString());
    if (data.exp < Date.now()) return null;
    if (localMode()) {
      const demo = Object.values(demos).find((d) => d.id === data.id);
      if (demo) return demo;
    }
    const db = await database();
    const r = await db.query<Actor>(
      "SELECT id,email,name,role FROM mosaic_users WHERE id=$1 AND active=true",
      [data.id],
    );
    return r.rows[0] ?? null;
  } catch {
    return null;
  }
}
export async function requireActor() {
  const a = await getActor();
  if (!a) throw new UserFacingError("Oturum gerekli.");
  return a;
}
export async function login(
  email: string,
  password: string,
  demoRole?: string,
): Promise<Actor> {
  if (localMode() && demoRole && demos[demoRole]) {
    await database();
    return demos[demoRole];
  }
  const db = await database();
  email = email.trim().toLowerCase();
  return db
    .transaction(async (q) => {
      await q(
        "INSERT INTO mosaic_auth_attempts (email,attempts,since) VALUES ($1,0,now()) ON CONFLICT(email) DO NOTHING",
        [email],
      );
      const { rows } = await q<{ attempts: number; since: string }>(
        "SELECT attempts,since FROM mosaic_auth_attempts WHERE email=$1 FOR UPDATE",
        [email],
      );
      const blocked =
        rows[0].attempts >= 8 &&
        Date.now() - new Date(rows[0].since).getTime() < 15 * 60_000;
      if (blocked)
        return Promise.reject(
          new UserFacingError(
            "Çok fazla giriş denemesi. 15 dakika sonra tekrar deneyin.",
          ),
        );
      if (Date.now() - new Date(rows[0].since).getTime() >= 15 * 60_000)
        await q(
          "UPDATE mosaic_auth_attempts SET attempts=0,since=now() WHERE email=$1",
          [email],
        );
      const result = await q<Actor & { password_hash: string }>(
        "SELECT id,email,name,role,password_hash FROM mosaic_users WHERE email=$1 AND active=true",
        [email],
      );
      const user = result.rows[0];
      const [salt, hash] = user?.password_hash.split(":") ?? [
        "missing",
        "00".repeat(64),
      ];
      const input = scryptSync(password, salt, 64);
      const stored = Buffer.from(hash, "hex");
      if (
        !user ||
        stored.length !== input.length ||
        !timingSafeEqual(stored, input)
      ) {
        await q(
          "UPDATE mosaic_auth_attempts SET attempts=attempts+1 WHERE email=$1",
          [email],
        );
        return { id: "", email: "", name: "", role: "viewer" } as Actor;
      }
      await q("DELETE FROM mosaic_auth_attempts WHERE email=$1", [email]);
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      };
    })
    .then((a) => {
      if (!a.id) throw new UserFacingError("Kullanıcı adı veya parola hatalı.");
      return a;
    });
}
export function assertOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) throw new UserFacingError("Geçersiz istek kaynağı.");
  const parsed = new URL(origin);
  const host = request.headers.get("host") ?? new URL(request.url).host;
  const protocol = process.env.VERCEL
    ? "https:"
    : new URL(request.url).protocol;
  if (parsed.host !== host || parsed.protocol !== protocol)
    throw new UserFacingError("Geçersiz istek kaynağı.");
}
