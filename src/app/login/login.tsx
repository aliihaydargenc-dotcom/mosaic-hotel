"use client";
import Link from "next/link";
import { useState } from "react";
export default function Login({ local }: { local: boolean }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(
    e: React.FormEvent<HTMLFormElement>,
    demoRole?: string,
  ) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: f.get("email") ?? "",
          password: f.get("password") ?? "",
          demoRole,
        }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      window.location.href = "/";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Giriş başarısız.");
      setBusy(false);
    }
  }
  return (
    <main className="login-shell">
      <div className="login-brand">
        <div className="brand-mark">M</div>
        <h1>MOSAIC</h1>
        <p>HOTEL ISTANBUL</p>
        <div className="brand-rule" />
        <h2>Ambar & maliyet yönetimi</h2>
      </div>
      <form className="login-card" onSubmit={(e) => submit(e)}>
        <span className="eyebrow">OPERASYON PORTALI</span>
        <h2>Oturum açın</h2>
        <label>
          Kullanıcı adı veya e-posta
          <input
            name="email"
            type="text"
            autoComplete="username"
            required={!local}
          />
        </label>
        <label>
          Parola
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required={!local}
          />
        </label>
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
        <button className="button primary" disabled={busy}>
          {busy ? "Bağlanıyor…" : "Oturum aç"}
        </button>
        <Link href="/demo" className="button demo-entry">
          Demoyu göster
        </Link>
        {local && (
          <div className="demo-login">
            <span>Yerel deneme ortamı · örnek kayıtlar</span>
            <div className="row">
              <button
                type="button"
                className="button"
                onClick={(e) =>
                  submit(
                    {
                      preventDefault() {},
                      currentTarget: e.currentTarget.form!,
                    } as React.FormEvent<HTMLFormElement>,
                    "manager",
                  )
                }
                disabled={busy}
              >
                Yönetici
              </button>
              <button
                type="button"
                className="button"
                onClick={(e) =>
                  submit(
                    {
                      preventDefault() {},
                      currentTarget: e.currentTarget.form!,
                    } as React.FormEvent<HTMLFormElement>,
                    "storekeeper",
                  )
                }
                disabled={busy}
              >
                Ambar
              </button>
              <button
                type="button"
                className="button"
                onClick={(e) =>
                  submit(
                    {
                      preventDefault() {},
                      currentTarget: e.currentTarget.form!,
                    } as React.FormEvent<HTMLFormElement>,
                    "viewer",
                  )
                }
                disabled={busy}
              >
                Rapor
              </button>
            </div>
          </div>
        )}
      </form>
    </main>
  );
}
