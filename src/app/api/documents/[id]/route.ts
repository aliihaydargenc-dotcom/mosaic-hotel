import { requireActor } from "@/lib/auth";
import { database } from "@/lib/db";
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireActor();
    const { id } = await params;
    const db = await database();
    const r = await db.query<{ data: Uint8Array; mime: string }>(
      "SELECT data,mime FROM mosaic_documents WHERE invoice_id=$1",
      [id],
    );
    if (!r.rows.length)
      return NextResponse.json({ error: "Belge bulunamadı." }, { status: 404 });
    return new NextResponse(new Uint8Array(r.rows[0].data), {
      headers: {
        "Content-Type": r.rows[0].mime,
        "Content-Disposition": "attachment",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  }
}
