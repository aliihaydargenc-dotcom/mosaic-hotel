import { publicError, UserFacingError } from "@/lib/errors";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireActor, assertOrigin } from "@/lib/auth";
import { database, hashPassword } from "@/lib/db";
import type { Actor, State } from "@/lib/types";
export const runtime = "nodejs";
export async function GET() {
  try {
    const a = await requireActor();
    if (a.role !== "manager")
      throw new UserFacingError("Yönetici yetkisi gerekli.");
    const db = await database();
    const r = await db.query<Actor & { active: boolean }>(
      "SELECT id,email,name,role,active FROM mosaic_users ORDER BY name",
    );
    return NextResponse.json(r.rows);
  } catch {
    return NextResponse.json({ error: "Yetki yok." }, { status: 403 });
  }
}
export async function POST(req: Request) {
  try {
    assertOrigin(req);
    const actor = await requireActor();
    if (actor.role !== "manager")
      throw new UserFacingError("Yönetici yetkisi gerekli.");
    const b = z
      .object({
        name: z.string().trim().min(2).max(100),
        email: z.email().max(200),
        password: z.string().min(12).max(200),
        role: z.enum(["manager", "storekeeper", "viewer"]),
      })
      .parse(await req.json());
    const db = await database();
    await db.transaction(async (q) => {
      const r = await q<{ data: State }>(
        "SELECT data FROM mosaic_state WHERE id=1 FOR UPDATE",
      );
      await q(
        "INSERT INTO mosaic_users (id,email,name,role,password_hash) VALUES ($1,$2,$3,$4,$5)",
        [
          randomUUID(),
          b.email.toLowerCase(),
          b.name,
          b.role,
          hashPassword(b.password),
        ],
      );
      const s = r.rows[0].data;
      s.version++;
      s.audit.push({
        id: randomUUID(),
        at: new Date().toISOString(),
        actor: actor.name,
        action: "user",
        detail: `${b.name} / ${b.role}`,
      });
      await q("UPDATE mosaic_state SET data=$1::jsonb WHERE id=1", [s]);
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: publicError(e) }, { status: 400 });
  }
}
export async function PATCH(req: Request) {
  try {
    assertOrigin(req);
    const actor = await requireActor();
    if (actor.role !== "manager")
      throw new UserFacingError("Yönetici yetkisi gerekli.");
    const b = z
      .object({
        id: z.string().min(1).max(100),
        name: z.string().trim().min(2).max(100),
        role: z.enum(["manager", "storekeeper", "viewer"]),
        active: z.boolean(),
        password: z.string().min(12).max(200).optional(),
      })
      .parse(await req.json());
    const db = await database();
    await db.transaction(async (q) => {
      const r = await q<{ data: State }>(
        "SELECT data FROM mosaic_state WHERE id=1 FOR UPDATE",
      );
      const users = await q<Actor & { active: boolean }>(
        "SELECT id,email,name,role,active FROM mosaic_users FOR UPDATE",
      );
      const target = users.rows.find((u) => u.id === b.id);
      if (!target) throw new UserFacingError("Kullanıcı bulunamadı.");
      if (
        target.role === "manager" &&
        target.active &&
        (!b.active || b.role !== "manager") &&
        !users.rows.some(
          (u) => u.id !== b.id && u.role === "manager" && u.active,
        )
      )
        throw new UserFacingError("En az bir aktif yönetici kalmalı.");
      await q("UPDATE mosaic_users SET name=$1,role=$2,active=$3 WHERE id=$4", [
        b.name,
        b.role,
        b.active,
        b.id,
      ]);
      if (b.password)
        await q("UPDATE mosaic_users SET password_hash=$1 WHERE id=$2", [
          hashPassword(b.password),
          b.id,
        ]);
      const s = r.rows[0].data;
      s.version++;
      s.audit.push({
        id: randomUUID(),
        at: new Date().toISOString(),
        actor: actor.name,
        action: "user",
        detail: `${b.name} / ${b.role} / ${b.active ? "aktif" : "pasif"}`,
      });
      await q("UPDATE mosaic_state SET data=$1::jsonb WHERE id=1", [s]);
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: publicError(e) }, { status: 400 });
  }
}
