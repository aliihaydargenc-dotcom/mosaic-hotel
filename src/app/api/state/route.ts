import { publicError, UserFacingError } from "@/lib/errors";
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { requireActor, assertOrigin } from "@/lib/auth";
import { database, getState } from "@/lib/db";
import { applyCommand } from "@/lib/domain";
import type { State } from "@/lib/types";
export const runtime = "nodejs";
export async function GET() {
  try {
    await requireActor();
    return NextResponse.json(await getState(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  }
}
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const actor = await requireActor();
    if (Number(request.headers.get("content-length") ?? 0) > 4_000_000)
      return NextResponse.json({ error: "Belge çok büyük." }, { status: 413 });
    const b = await request.json();
    if (
      typeof b.requestId !== "string" ||
      !/^[a-f0-9-]{36}$/.test(b.requestId) ||
      !Number.isInteger(b.version)
    )
      throw new UserFacingError("Geçersiz işlem.");
    if (b.command?.attachment) {
      const a = b.command.attachment;
      const bytes = Buffer.from(a.data, "base64");
      const sig = bytes.subarray(0, 12);
      const valid =
        a.mime === "application/pdf"
          ? sig.toString().startsWith("%PDF-")
          : a.mime === "image/png"
            ? sig
                .subarray(0, 8)
                .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            : a.mime === "image/jpeg" && sig[0] === 255 && sig[1] === 216;
      if (!valid || bytes.length > 2_500_000)
        throw new UserFacingError("Belge türü veya boyutu geçersiz.");
      a.hash = createHash("sha256").update(bytes).digest("hex");
    }
    const db = await database();
    const state = await db.transaction(async (q) => {
      const { rows } = await q<{ data: State }>(
        "SELECT data FROM mosaic_state WHERE id=1 FOR UPDATE",
      );
      const done = await q<{ id: string }>(
        "SELECT id FROM mosaic_requests WHERE id=$1 AND actor=$2",
        [b.requestId, actor.id],
      );
      if (done.rows.length) return rows[0].data;
      if (rows[0].data.version !== b.version)
        throw new UserFacingError(
          "Kayıtlar değişti. Sayfayı yenileyip tekrar deneyin.",
        );
      const next = applyCommand(rows[0].data, b.command, actor);
      if (b.command.type === "invoice" && b.command.attachment?.data) {
        const inv = next.invoices.find(
          (i) =>
            i.reference === b.command.reference &&
            i.supplier === b.command.supplier,
        )!;
        const a = inv.attachment!;
        await q(
          "INSERT INTO mosaic_documents (invoice_id,data,mime,name,hash) VALUES ($1,$2,$3,$4,$5) ON CONFLICT(invoice_id) DO UPDATE SET data=EXCLUDED.data,mime=EXCLUDED.mime,name=EXCLUDED.name,hash=EXCLUDED.hash",
          [inv.id, Buffer.from(a.data!, "base64"), a.mime, a.name, a.hash],
        );
        delete a.data;
      }
      await q("UPDATE mosaic_state SET data=$1::jsonb WHERE id=1", [next]);
      await q("INSERT INTO mosaic_requests (id,actor) VALUES ($1,$2)", [
        b.requestId,
        actor.id,
      ]);
      return next;
    });
    return NextResponse.json(state);
  } catch (e) {
    return NextResponse.json({ error: publicError(e) }, { status: 400 });
  }
}
