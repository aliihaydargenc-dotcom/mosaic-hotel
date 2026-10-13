import { publicError, UserFacingError } from "@/lib/errors";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertOrigin, issueSession, login } from "@/lib/auth";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const b = await request.json();
    if (
      typeof b.email !== "string" ||
      typeof b.password !== "string" ||
      b.email.length > 200 ||
      b.password.length > 200
    )
      return NextResponse.json({ error: "Geçersiz giriş." }, { status: 400 });
    const actor = await login(b.email, b.password, b.demoRole);
    await issueSession(actor);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: publicError(e) }, { status: 400 });
  }
}
export async function DELETE(request: Request) {
  try {
    assertOrigin(request);
    (await cookies()).delete("mosaic_session");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 403 });
  }
}
