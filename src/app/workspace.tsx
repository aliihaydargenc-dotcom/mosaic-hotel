"use client";
import { useState, useEffect, useRef, createContext, useContext } from "react";
import {
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
  FileText,
  Package,
  ArrowLeftRight,
  ClipboardCheck,
  CookingPot,
  ChartNoAxesCombined,
  Settings2,
  History,
  LogOut,
  Plus,
  Search,
  ArrowUpRight,
  ChevronRight,
  Check,
  X,
  Printer,
  Download,
  Upload,
  LockKeyhole,
  CircleAlert,
  ShoppingBasket,
} from "lucide-react";
import type {
  Actor,
  State,
  Invoice,
  Transfer,
  Recipe,
  Product,
  Place,
} from "@/lib/types";
import { applyCommand } from "@/lib/domain";
import { report, purchases, purchaseReport } from "@/lib/reporting";
import { recipeQuantity } from "@/lib/inventree-bom";
import { parseInvoiceText, parseDecimal, readDocument } from "@/lib/documents";
const money = (n: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(n / 100);
const quantity = (n: number) =>
  new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 3 }).format(n / 1000);
const monthName = (s: string) =>
  new Date(`${s}-01T12:00:00Z`).toLocaleDateString("tr-TR", {
    month: "long",
    year: "numeric",
  });
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const actionNames: Record<string, string> = {
  product: "Stok kartı",
  place: "Depo / lokasyon",
  invoice: "Fatura kaydı",
  postInvoice: "Alım onayı",
  transfer: "Transfer talebi",
  acceptTransfer: "Teslim kabulü",
  consume: "Tüketim çıkışı",
  count: "Sayım farkı",
  people: "Kişi sayısı",
  close: "Dönem kapanışı",
  reopen: "Dönem açılışı",
  newPeriod: "Yeni dönem",
  recipe: "Reçete",
  reverse: "Ters kayıt",
  user: "Kullanıcı",
};
type Context = {
  s: State;
  actor: Actor;
  period: string;
  send: (c: unknown) => Promise<boolean>;
  show: (kind: string, data?: unknown) => void;
  close: () => void;
  busy: boolean;
  demo: boolean;
};
const Ctx = createContext<Context>(null!);
const useApp = () => useContext(Ctx);
const nav = [
  ["overview", "Genel bakış", LayoutDashboard],
  ["invoices", "Alım & faturalar", FileText],
  ["stock", "Stok kartları", Package],
  ["transfers", "Transferler", ArrowLeftRight],
  ["counts", "Sayım & tüketim", ClipboardCheck],
  ["recipes", "Reçeteler", CookingPot],
  ["reports", "Maliyet raporu", ChartNoAxesCombined],
  ["purchaseReports", "Alım raporu", ShoppingBasket],
  ["settings", "Konfigürasyon", Settings2],
  ["audit", "İşlem geçmişi", History],
] as const;
function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function Empty({ text = "Henüz kayıt yok." }: { text?: string }) {
  return (
    <div className="empty">
      <Package size={25} />
      <p>{text}</p>
    </div>
  );
}
function ProductSelect({
  name = "productId",
  value,
  onChange,
  required = true,
}: {
  name?: string;
  value?: string;
  onChange?: (v: string) => void;
  required?: boolean;
}) {
  const { s } = useApp();
  return (
    <select
      name={name}
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      required={required}
    >
      <option value="">Stok kartı seçin</option>
      {s.products.map((p) => (
        <option key={p.id} value={p.id}>
          {p.code} · {p.name} ({p.unit})
        </option>
      ))}
    </select>
  );
}
function PlaceSelect({
  name = "placeId",
  value,
  defaultValue,
  onChange,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
}) {
  const { s } = useApp();
  return (
    <select
      name={name}
      value={value}
      defaultValue={defaultValue}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      required
    >
      <option value="">Depo / lokasyon seçin</option>
      {s.places.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
function Toolbar({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">MOSAIC OPERASYON</span>
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
        <div className="row">{action}</div>
      </div>
      {children}
    </>
  );
}
function SearchBox({
  value,
  onChange,
}: {
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <div className="search">
      <Search size={16} />
      <input
        aria-label="Kayıtlarda ara"
        placeholder="Kayıtlarda ara…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button className="icon-button" aria-label="Kapat" onClick={onClose}>
          <X size={19} />
        </button>
      </header>
      <div className="modal-content">{children}</div>
    </dialog>
  );
}
function FormActions({ label = "Kaydet" }: { label?: string }) {
  const { close, busy } = useApp();
  return (
    <footer className="form-actions">
      <button className="button" type="button" onClick={close}>
        Vazgeç
      </button>
      <button className="button primary" disabled={busy}>
        {busy ? "Kaydediliyor…" : label}
      </button>
    </footer>
  );
}
export default function Workspace({
  initial,
  actor,
  local,
  demo = false,
}: {
  initial: State;
  actor: Actor;
  local: boolean;
  demo?: boolean;
}) {
  const [s, setState] = useState(initial);
  const [tab, setTab] = useState("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  useEffect(() => {
    try {
      setSidebarCollapsed(
        window.matchMedia("(max-width: 800px)").matches ||
          localStorage.getItem("mosaic-sidebar") === "collapsed",
      );
    } catch {
      setSidebarCollapsed(window.matchMedia("(max-width: 800px)").matches);
    }
  }, []);
  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    try {
      localStorage.setItem("mosaic-sidebar", next ? "collapsed" : "expanded");
    } catch {}
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        window.matchMedia("(max-width: 800px)").matches
      )
        setSidebarCollapsed(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const [period, setPeriod] = useState(initial.periods.at(-1)!.id);
  const [modal, setModal] = useState<{ kind: string; data?: unknown } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(id);
  }, [toast]);
  async function send(command: unknown) {
    setBusy(true);
    setError("");
    try {
      if (demo) {
        setState(applyCommand(s, command, actor));
        setToast("İşlem kaydedildi.");
        return true;
      }
      const r = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: s.version,
          requestId: crypto.randomUUID(),
          command,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        if (data.error?.includes("Kayıtlar değişti")) {
          const fresh = await fetch("/api/state");
          if (fresh.ok) setState(await fresh.json());
        }
        throw new Error(data.error);
      }
      setState(data);
      setToast("İşlem kaydedildi.");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "İşlem başarısız.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  const show = (kind: string, data?: unknown) => {
    setError("");
    setModal({ kind, data });
  };
  const close = () => {
    setModal(null);
    setError("");
  };
  const p = s.periods.find((p) => p.id === period)!;
  return (
    <Ctx.Provider value={{ s, actor, period, send, show, close, busy, demo }}>
      <div
        className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : "sidebar-expanded"}`}
      >
        <aside id="main-navigation" className="sidebar">
          <div className="wordmark">
            <span>{sidebarCollapsed ? "M" : "MOSAIC"}</span>
            <small>HOTEL ISTANBUL</small>
          </div>
          <div className="sidebar-caption">AMBAR & MALİYET</div>
          <nav>
            {nav.map(([key, label, Icon], i) => (
              <button
                key={key}
                aria-label={label}
                title={label}
                aria-current={tab === key ? "page" : undefined}
                className={`${tab === key ? "active" : ""} ${key === "settings" ? "nav-separator" : ""}`}
                onClick={() => {
                  setTab(key);
                  setError("");
                  if (window.matchMedia("(max-width: 800px)").matches)
                    setSidebarCollapsed(true);
                }}
              >
                <Icon size={18} />
                <span>{label}</span>
                {tab === key && <ChevronRight size={14} />}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="avatar">{actor.name.slice(0, 1)}</div>
            <div>
              <strong>{actor.name}</strong>
              <small>
                {actor.role === "manager"
                  ? "Yönetici"
                  : actor.role === "storekeeper"
                    ? "Ambar sorumlusu"
                    : "Rapor kullanıcısı"}
              </small>
            </div>
            <button
              className="icon-button"
              title="Çıkış"
              aria-label="Çıkış"
              onClick={async () => {
                if (!demo) await fetch("/api/session", { method: "DELETE" });
                location.href = "/login";
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </aside>
        {!sidebarCollapsed && (
          <button
            className="sidebar-scrim"
            aria-label="Menüyü kapat"
            onClick={() => setSidebarCollapsed(true)}
          />
        )}
        <div className="main-shell">
          <header className="topbar">
            <div className="topbar-path">
              <button
                className="icon-button sidebar-toggle"
                onClick={toggleSidebar}
                aria-label={sidebarCollapsed ? "Menüyü aç" : "Menüyü daralt"}
                title={sidebarCollapsed ? "Menüyü aç" : "Menüyü daralt"}
                aria-expanded={!sidebarCollapsed}
                aria-controls="main-navigation"
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen size={19} />
                ) : (
                  <PanelLeftClose size={19} />
                )}
              </button>
              <span>
                Mosaic Hotel <span className="topbar-divider">/</span>{" "}
                <strong>{nav.find((n) => n[0] === tab)?.[1]}</strong>
              </span>
            </div>
            <div className="row">
              {demo ? (
                <>
                  <span className="local-label">Demo</span>
                  <button
                    className="text-button"
                    onClick={() => {
                      setState(structuredClone(initial));
                      setPeriod(initial.periods.at(-1)!.id);
                      setModal(null);
                      setError("");
                    }}
                  >
                    Sıfırla
                  </button>
                </>
              ) : (
                local && <span className="local-label">Örnek kayıtlar</span>
              )}
              <select
                aria-label="Dönem"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              >
                {s.periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {monthName(p.id)}
                  </option>
                ))}
              </select>
              <Badge tone={p.status === "open" ? "green" : "neutral"}>
                {p.status === "open" ? "Dönem açık" : "Dönem kapalı"}
              </Badge>
            </div>
          </header>
          <main key={`${tab}-${period}`} className="content screen-transition">
            {error && !modal && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            {tab === "overview" && <Overview navigate={setTab} />}{" "}
            {tab === "invoices" && <Invoices />}
            {tab === "stock" && <Stock />}
            {tab === "transfers" && <Transfers />}
            {tab === "counts" && <Counts />}
            {tab === "recipes" && <Recipes />}
            {tab === "reports" && <Reports />}
            {tab === "purchaseReports" && <Reports mode="purchase" />}
            {tab === "settings" && <Configuration />}
            {tab === "audit" && <Audit />}
          </main>
        </div>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
      {modal && (
        <Modal title={modalTitles[modal.kind] ?? "İşlem"} onClose={close}>
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          <ModalBody kind={modal.kind} data={modal.data} />
        </Modal>
      )}
    </Ctx.Provider>
  );
}
const modalTitles: Record<string, string> = {
  invoice: "Fatura kontrolü",
  product: "Yeni stok kartı",
  place: "Depo / lokasyon ekle",
  transfer: "Yeni transfer",
  accept: "Teslim kabulü",
  print: "Transfer teslim fişi",
  consume: "Tüketim çıkışı",
  count: "Stok sayımı",
  people: "Dönem kişi sayısı",
  close: "Dönemi kapat",
  reopen: "Dönemi yeniden aç",
  newPeriod: "Yeni dönem",
  recipe: "Reçete düzenle",
  reverse: "Hareketi geri al",
  user: "Kullanıcı ekle",
};
function Overview({ navigate }: { navigate: (s: string) => void }) {
  const { s, period, show, actor } = useApp();
  const rows = report(s, period);
  const cost = rows.reduce((n, r) => n + r.cost, 0);
  const p = s.periods.find((p) => p.id === period)!;
  const people = p.adults + p.children;
  const totalStock = s.balances.reduce((n, b) => n + b.value, 0);
  const pending =
    s.invoices.filter((i) => i.status === "draft").length +
    s.transfers.filter((t) => t.status === "pending").length;
  const groups = Object.entries(
    rows.reduce<Record<string, number>>((a, r) => {
      const g = s.products.find((p) => p.id === r.productId)?.group ?? "Diğer";
      a[g] = (a[g] ?? 0) + r.cost;
      return a;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const low = s.products.filter(
    (p) =>
      s.balances
        .filter((b) => b.productId === p.id)
        .reduce((n, b) => n + b.qty, 0) < p.minimum,
  );
  return (
    <>
      <Toolbar
        title="Genel bakış"
        description={monthName(period)}
        action={
          actor.role !== "viewer" && (
            <button className="button primary" onClick={() => show("invoice")}>
              <Plus size={16} />
              Alım kaydı
            </button>
          )
        }
      />
      <div className="metrics">
        <Metric
          label="Dönem alımı"
          value={money(purchases(s, period))}
          foot="KDV hariç onaylı alımlar"
        />
        <Metric
          label="Güncel stok değeri"
          value={money(totalStock)}
          foot="Tüm depolar ve lokasyonlar"
        />
        <Metric
          label="Tüketim maliyeti"
          value={money(cost)}
          foot="Çıkışlar + net sayım farkı"
        />
        <Metric
          label="Kişi başı maliyet"
          value={people ? money(Math.round(cost / people)) : "—"}
          foot={`${people} kişi · yetişkin + çocuk`}
        />
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>Maliyet dağılımı</h2>
            <button className="text-button" onClick={() => navigate("reports")}>
              Raporu aç
              <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="cost-total">
            <span>{money(cost)}</span>
            <small>{monthName(period)} · gerçekleşen</small>
          </div>
          <div className="bar-chart">
            {groups.length ? (
              groups.map(([g, v]) => (
                <div className="bar-row" key={g}>
                  <div>
                    <span>{g}</span>
                    <strong>{money(v)}</strong>
                  </div>
                  <div className="bar-track">
                    <i
                      style={{
                        width: `${cost > 0 ? Math.max(0, (v / cost) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <Empty text="Tüketim kaydıyla dağılım oluşur." />
            )}
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>İşlem bekleyenler</h2>
            <Badge tone={pending ? "amber" : "green"}>{pending} kayıt</Badge>
          </div>
          <button className="task-row" onClick={() => navigate("invoices")}>
            <div className="task-icon">
              <FileText size={20} />
            </div>
            <div>
              <strong>Fatura kontrolü</strong>
              <small>
                {s.invoices.filter((i) => i.status === "draft").length} taslak
                kontrol bekliyor
              </small>
            </div>
            <ChevronRight size={17} />
          </button>
          <button className="task-row" onClick={() => navigate("transfers")}>
            <div className="task-icon">
              <ArrowLeftRight size={20} />
            </div>
            <div>
              <strong>Transfer teslim kabulü</strong>
              <small>
                {s.transfers.filter((t) => t.status === "pending").length}{" "}
                teslim bekliyor
              </small>
            </div>
            <ChevronRight size={17} />
          </button>
          <button className="task-row" onClick={() => navigate("stock")}>
            <div className="task-icon">
              <CircleAlert size={20} />
            </div>
            <div>
              <strong>Minimum stok kontrolü</strong>
              <small>{low.length} ürün minimum seviyenin altında</small>
            </div>
            <ChevronRight size={17} />
          </button>
          <div className="period-card">
            <span className="eyebrow">DÖNEM DURUMU</span>
            <div>
              <strong>{monthName(period)}</strong>
              <Badge tone={p.status === "open" ? "green" : "neutral"}>
                {p.status === "open" ? "Açık" : "Kapalı"}
              </Badge>
            </div>
            <small>
              {p.status === "open"
                ? "Alım, transfer ve sayım kayıtlarına açık."
                : `Kapanış revizyonu ${p.revision}.`}
            </small>
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h2>Son hareketler</h2>
          <button className="text-button" onClick={() => navigate("audit")}>
            Tüm geçmiş
            <ArrowUpRight size={15} />
          </button>
        </div>
        <MovementTable limit={3} />
      </section>
    </>
  );
}
function Metric({
  label,
  value,
  foot,
}: {
  label: string;
  value: string;
  foot: string;
}) {
  return (
    <section className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{foot}</small>
    </section>
  );
}
function Invoices() {
  const { s, period, show, send, actor, busy } = useApp();
  const [search, setSearch] = useState("");
  const invoices = s.invoices.filter(
    (i) =>
      i.period === period &&
      `${i.reference} ${i.supplier}`
        .toLocaleLowerCase("tr")
        .includes(search.toLocaleLowerCase("tr")),
  );
  return (
    <>
      <Toolbar
        title="Alım & faturalar"
        description="Belgeyi kontrol edin, stok kartıyla eşleştirin, alımı onaylayın."
        action={
          actor.role !== "viewer" && (
            <button className="button primary" onClick={() => show("invoice")}>
              <Plus size={16} />
              Yeni alım
            </button>
          )
        }
      />
      <section className="panel">
        <div className="table-tools">
          <SearchBox value={search} onChange={setSearch} />
          <span>{invoices.length} fatura</span>
        </div>
        {invoices.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fatura / tedarikçi</th>
                  <th>Belge tarihi</th>
                  <th>Giriş yeri</th>
                  <th>Satır</th>
                  <th className="numeric">Net tutar</th>
                  <th>Durum</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <strong>{i.reference}</strong>
                      <small>{i.supplier}</small>
                    </td>
                    <td>{i.documentDate.split("-").reverse().join(".")}</td>
                    <td>{s.places.find((p) => p.id === i.placeId)?.name}</td>
                    <td>{i.lines.length}</td>
                    <td className="numeric">
                      {money(
                        i.lines.reduce(
                          (n, l) =>
                            n + Math.round((l.qty * l.unitPrice) / 1000),
                          0,
                        ),
                      )}
                    </td>
                    <td>
                      <Badge tone={i.status === "posted" ? "green" : "amber"}>
                        {i.status === "posted"
                          ? "Stoğa işlendi"
                          : "Kontrol bekliyor"}
                      </Badge>
                    </td>
                    <td className="actions">
                      <button
                        className="text-button"
                        onClick={() => show("invoice", i)}
                      >
                        İncele
                      </button>
                      {i.status === "draft" && actor.role !== "viewer" && (
                        <button
                          className="button small"
                          disabled={busy}
                          onClick={() =>
                            send({ type: "postInvoice", invoiceId: i.id })
                          }
                        >
                          Stoğa işle
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
      </section>
    </>
  );
}
function Stock() {
  const { s, show, actor } = useApp();
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const products = s.products.filter((p) =>
    `${p.code} ${p.name} ${p.group}`
      .toLocaleLowerCase("tr")
      .includes(search.toLocaleLowerCase("tr")),
  );
  return (
    <>
      <Toolbar
        title="Stok kartları"
        action={
          actor.role !== "viewer" && (
            <button className="button primary" onClick={() => show("product")}>
              <Plus size={16} />
              Stok kartı aç
            </button>
          )
        }
      />
      <section className="panel">
        <div className="table-tools">
          <SearchBox value={search} onChange={setSearch} />
          <select
            aria-label="Stok lokasyonu"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          >
            <option value="">Tüm depolar ve lokasyonlar</option>
            {s.places.map((p) => (
              <option value={p.id} key={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <span>{products.length} stok kartı</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Kod</th>
                <th>Malzeme</th>
                <th>Alt grup</th>
                <th className="numeric">Mevcut stok</th>
                <th className="numeric">Ort. birim maliyet</th>
                <th className="numeric">Stok değeri</th>
                <th>Seviye</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const b = s.balances.filter(
                  (b) =>
                    b.productId === p.id &&
                    (!location || b.placeId === location),
                );
                const q = b.reduce((n, b) => n + b.qty, 0),
                  v = b.reduce((n, b) => n + b.value, 0);
                return (
                  <tr key={p.id}>
                    <td className="code">{p.code}</td>
                    <td>
                      <strong>{p.name}</strong>
                    </td>
                    <td>{p.group}</td>
                    <td className="numeric">
                      {quantity(q)} <small className="inline">{p.unit}</small>
                    </td>
                    <td className="numeric">
                      {q ? money(Math.round((v * 1000) / q)) : "—"}
                    </td>
                    <td className="numeric">{money(v)}</td>
                    <td>
                      <Badge tone={q < p.minimum ? "amber" : "green"}>
                        {q < p.minimum ? "Düşük stok" : "Normal"}
                      </Badge>
                      {actor.role !== "viewer" && (
                        <button
                          className="text-button"
                          style={{ marginLeft: 10 }}
                          onClick={() => show("product", p)}
                        >
                          Düzenle
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!products.length && <Empty />}
      </section>
    </>
  );
}
function Transfers() {
  const { s, period, show, actor } = useApp();
  const list = s.transfers.filter((t) => t.period === period);
  return (
    <>
      <Toolbar
        title="Transferler"
        description="Kaynak stoktan hedef stoğa. Teslim kabulü ile hareket oluşur."
        action={
          actor.role !== "viewer" && (
            <button className="button primary" onClick={() => show("transfer")}>
              <Plus size={16} />
              Yeni transfer
            </button>
          )
        }
      />
      <section className="panel">
        <div className="panel-heading">
          <h2>Transfer kayıtları</h2>
          <span>{list.length} kayıt</span>
        </div>
        {list.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fiş / tarih</th>
                  <th>Kaynak</th>
                  <th />
                  <th>Hedef</th>
                  <th>Malzeme</th>
                  <th>Durum</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...list].reverse().map((t) => (
                  <tr key={t.id}>
                    <td>
                      <strong className="code">
                        TR-{t.id.slice(0, 6).toUpperCase()}
                      </strong>
                      <small>{t.date}</small>
                    </td>
                    <td>{s.places.find((p) => p.id === t.from)?.name}</td>
                    <td>
                      <ArrowUpRight size={16} />
                    </td>
                    <td>
                      {s.places.find((p) => p.id === t.to)?.name}
                      <small>{t.note}</small>
                    </td>
                    <td>{t.lines.length} ürün</td>
                    <td>
                      <Badge tone={t.status === "accepted" ? "green" : "amber"}>
                        {t.status === "accepted"
                          ? "Teslim alındı"
                          : "Kabul bekliyor"}
                      </Badge>
                    </td>
                    <td className="actions">
                      <button
                        className="icon-button"
                        aria-label="Teslim fişini aç"
                        onClick={() => show("print", t)}
                      >
                        <Printer size={17} />
                      </button>
                      {t.status === "pending" && actor.role !== "viewer" && (
                        <button
                          className="button small"
                          onClick={() => show("accept", t)}
                        >
                          Teslim kabulü
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
      </section>
    </>
  );
}
function Counts() {
  const { show, actor } = useApp();
  return (
    <>
      <Toolbar
        title="Sayım & tüketim"
        description="Bir stok kartı, bir lokasyon. Farkı görün ve gerekçesiyle kaydedin."
        action={
          actor.role !== "viewer" && (
            <>
              <button className="button" onClick={() => show("consume")}>
                <Plus size={16} />
                Tüketim çıkışı
              </button>
              <button className="button primary" onClick={() => show("count")}>
                <ClipboardCheck size={16} />
                Sayım gir
              </button>
            </>
          )
        }
      />
      <section className="panel counts-panel">
        <div className="panel-heading">
          <h2>Tüketim ve sayım hareketleri</h2>
        </div>
        <MovementTable types={["count", "consumption", "reversal"]} />
      </section>
    </>
  );
}
function MovementTable({ limit, types }: { limit?: number; types?: string[] }) {
  const { s, period, actor, show } = useApp();
  let list = s.movements
    .filter((m) => m.period === period && (!types || types.includes(m.type)))
    .reverse();
  if (limit) list = list.slice(0, limit);
  const names: Record<string, string> = {
    receipt: "Alım",
    transfer: "Transfer",
    consumption: "Tüketim",
    count: "Sayım farkı",
    reversal: "Ters kayıt",
  };
  return list.length ? (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>İşlem</th>
            <th>Malzeme</th>
            <th>Kaynak / hedef</th>
            <th className="numeric">Miktar</th>
            <th className="numeric">Değer</th>
            <th>Açıklama</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {list.map((m) => {
            const p = s.products.find((p) => p.id === m.productId)!;
            return (
              <tr key={m.id}>
                <td>
                  <Badge>{names[m.type]}</Badge>
                  <small>{m.date}</small>
                </td>
                <td>
                  <strong>{p.name}</strong>
                  <small>{p.code}</small>
                </td>
                <td>
                  {[m.from, m.to]
                    .filter(Boolean)
                    .map((id) => s.places.find((p) => p.id === id)?.name)
                    .join(" → ")}
                </td>
                <td className="numeric">
                  {quantity(m.qty)} {p.unit}
                </td>
                <td className="numeric">{money(m.value)}</td>
                <td className="ellipsis" title={m.note}>
                  {m.note}
                  {m.reversedBy && <small>Ters kayıt oluşturuldu</small>}
                </td>
                <td>
                  {actor.role === "manager" &&
                    !m.reversedBy &&
                    m.type !== "reversal" &&
                    s.periods.find((p) => p.id === period)?.status ===
                      "open" && (
                      <button
                        className="text-button"
                        onClick={() => show("reverse", m.id)}
                      >
                        Geri al
                      </button>
                    )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty />
  );
}
function Recipes() {
  const { s, show, actor } = useApp();
  return (
    <>
      <Toolbar
        title="Reçeteler"
        description="Porsiyon, malzeme ve güncel stok maliyeti."
        action={
          actor.role !== "viewer" && (
            <button className="button primary" onClick={() => show("recipe")}>
              <Plus size={16} />
              Reçete oluştur
            </button>
          )
        }
      />
      <div className="recipe-grid">
        {s.recipes.map((r) => (
          <RecipeCard key={r.id} recipe={r} />
        ))}
        {!s.recipes.length && (
          <section className="panel">
            <Empty />
          </section>
        )}
      </div>
    </>
  );
}
function RecipeCard({ recipe: r }: { recipe: Recipe }) {
  const { s, show, actor } = useApp();
  const [portions, setPortions] = useState(r.portions);
  let total = 0;
  let missing = false;
  const lines = r.lines.map((l) => {
    const p = s.products.find((p) => p.id === l.productId)!;
    const b = s.balances.filter((b) => b.productId === p.id);
    const q = b.reduce((n, b) => n + b.qty, 0),
      v = b.reduce((n, b) => n + b.value, 0);
    const required = recipeQuantity(
      l.qty,
      r.portions,
      Math.max(1, portions),
      l.wastePercent,
    );
    if (!q) missing = true;
    const cost = q ? Math.round((required * v) / q) : 0;
    total += cost;
    return { p, required, cost, known: q > 0 };
  });
  return (
    <section className="panel recipe-card">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">BÜFE REÇETESİ</span>
          <h2>{r.name}</h2>
        </div>
        {actor.role !== "viewer" && (
          <button className="text-button" onClick={() => show("recipe", r)}>
            Düzenle
          </button>
        )}
      </div>
      <div className="recipe-summary">
        <label>
          Planlanan kişi
          <input
            aria-label={`${r.name} kişi sayısı`}
            type="number"
            min="1"
            max="100000"
            value={portions}
            onChange={(e) =>
              setPortions(
                Math.max(
                  1,
                  Math.min(100000, Math.round(Number(e.target.value))),
                ),
              )
            }
          />
        </label>
        <div>
          <small>Tahmini malzeme maliyeti</small>
          <strong>{missing ? "Maliyet eksik" : money(total)}</strong>
        </div>
        <div>
          <small>Kişi başı</small>
          <strong>
            {missing ? "—" : money(Math.round(total / Math.max(1, portions)))}
          </strong>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Malzeme</th>
              <th className="numeric">Gerekli miktar</th>
              <th className="numeric">Tahmini tutar</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.p.id}>
                <td>{l.p.name}</td>
                <td className="numeric">
                  {quantity(l.required)} {l.p.unit}
                </td>
                <td className="numeric">
                  {l.known ? money(l.cost) : "Maliyet bulunamadı"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel-foot">
        Reçete hesabı planlamadır; stoktan otomatik düşmez.
      </div>
    </section>
  );
}
function Reports({ mode = "cost" }: { mode?: "cost" | "purchase" }) {
  const isPurchase = mode === "purchase";
  const { s, period, show, actor } = useApp();
  const p = s.periods.find((p) => p.id === period)!;
  const snap = p.status === "closed" ? p.snapshots.at(-1) : undefined;
  const rows = isPurchase
    ? purchaseReport(s, period)
    : (snap?.rows ?? report(s, period));
  const people = snap?.people ?? p.adults + p.children;
  const catalog = snap?.catalog ?? s.products;
  const previous = [...s.periods]
    .filter((x) => x.id < period)
    .sort((a, b) => b.id.localeCompare(a.id))[0];
  const previousRows = isPurchase
    ? previous
      ? purchaseReport(s, previous.id)
      : []
    : (previous?.snapshots.at(-1)?.rows ??
      (previous ? report(s, previous.id) : []));
  const [group, setGroup] = useState("");
  const [view, setView] = useState("product");
  const previousCatalog = previous?.snapshots.at(-1)?.catalog ?? s.products;
  const groups = [...new Set(catalog.map((p) => p.group))];
  const detailed = rows
    .filter(
      (r) =>
        !group || catalog.find((p) => p.id === r.productId)?.group === group,
    )
    .map((r) => {
      const product = catalog.find((p) => p.id === r.productId)!;
      const prev = previousRows.find((x) => x.productId === r.productId);
      return {
        name: product.name,
        code: product.code,
        group: product.group,
        qty: quantity(r.quantity) + " " + product.unit,
        gram:
          product.unit === "kg" && people
            ? quantity((r.quantity * 1000) / people) + " g"
            : "—",
        cost: r.cost,
        change:
          prev?.cost && prev.cost > 0
            ? ((r.cost - prev.cost) / prev.cost) * 100
            : null,
      };
    });
  const grouped = groups
    .filter((g) => !group || g === group)
    .map((g) => {
      const cost = rows
        .filter((r) => catalog.find((p) => p.id === r.productId)?.group === g)
        .reduce((n, r) => n + r.cost, 0);
      const prev = previousRows
        .filter(
          (r) => previousCatalog.find((p) => p.id === r.productId)?.group === g,
        )
        .reduce((n, r) => n + r.cost, 0);
      return {
        name: g,
        code: "",
        group: g,
        qty: "—",
        gram: "—",
        cost,
        change: prev > 0 ? ((cost - prev) / prev) * 100 : null,
      };
    });
  const table = view === "group" ? grouped : detailed;
  const total = rows.reduce((n, r) => n + r.cost, 0);
  function exportCSV() {
    const csv = [
      "Malzeme;Alt grup;Miktar;Kişi başı gramaj;Maliyet TRY;Önceki dönem değişim %",
      ...table.map((r) =>
        [
          r.name,
          r.group,
          r.qty,
          r.gram,
          (r.cost / 100).toFixed(2),
          r.change?.toFixed(1) ?? "",
        ]
          .map(
            (v) =>
              `"${String(v)
                .replace(/"/g, '""')
                .replace(/^[=+@-]/, "'")}"`,
          )
          .join(";"),
      ),
    ].join("\n");
    download(
      new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }),
      `mosaic-${isPurchase ? "alim" : "maliyet"}-${period}.csv`,
    );
  }
  return (
    <>
      <Toolbar
        title={isPurchase ? "Alım raporu" : "Dönem maliyet raporu"}
        description={`${monthName(period)}${snap ? ` · Kapanış revizyonu ${snap.revision}` : ""}`}
        action={
          <>
            <button className="button" onClick={exportCSV}>
              <Download size={16} />
              Excel / CSV
            </button>
            <button className="button" onClick={() => window.print()}>
              <Printer size={16} />
              Yazdır
            </button>
            {!isPurchase &&
              actor.role === "manager" &&
              (p.status === "open" ? (
                <button
                  className="button primary"
                  onClick={() => show("close")}
                >
                  <LockKeyhole size={16} />
                  Dönemi kapat
                </button>
              ) : (
                <button className="button" onClick={() => show("reopen")}>
                  Yeniden aç
                </button>
              ))}
          </>
        }
      />
      <div className="metrics">
        <Metric
          label="Dönem alımı"
          value={money(snap?.purchases ?? purchases(s, period))}
          foot="Belge tarihi değil, kayıt dönemi"
        />
        {isPurchase ? (
          <>
            <Metric
              label="Onaylı fatura"
              value={String(
                s.invoices.filter(
                  (i) => i.period === period && i.status === "posted",
                ).length,
              )}
              foot="Seçilen kayıt dönemi"
            />
            <Metric
              label="Tedarikçi"
              value={String(
                new Set(
                  s.invoices
                    .filter((i) => i.period === period && i.status === "posted")
                    .map((i) => i.supplier),
                ).size,
              )}
              foot="Onaylı alım yapan tedarikçiler"
            />
            <Metric
              label="Alınan malzeme"
              value={String(rows.length)}
              foot="Farklı stok kartı"
            />
          </>
        ) : (
          <>
            <Metric
              label="Gerçekleşen maliyet"
              value={money(total)}
              foot="Tüketim ve net sayım farkı"
            />
            <Metric
              label="Toplam kişi"
              value={String(people)}
              foot={`${snap?.adults ?? p.adults} yetişkin + ${snap?.children ?? p.children} çocuk`}
            />
            <Metric
              label="Kişi başı"
              value={people ? money(Math.round(total / people)) : "—"}
              foot="Gerçekleşen maliyet / kişi"
            />
          </>
        )}
      </div>
      <section className="panel">
        <div className="table-tools">
          <div className="segmented">
            <button
              className={view === "product" ? "selected" : ""}
              onClick={() => setView("product")}
            >
              Ürün bazında
            </button>
            <button
              className={view === "group" ? "selected" : ""}
              onClick={() => setView("group")}
            >
              Alt grup bazında
            </button>
          </div>
          <select
            aria-label="Rapor alt grubu"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
          >
            <option value="">Tüm alt gruplar</option>
            {groups.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
          {!isPurchase && actor.role !== "viewer" && p.status === "open" && (
            <button className="button small" onClick={() => show("people")}>
              Kişi sayısını düzenle
            </button>
          )}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{view === "product" ? "Malzeme" : "Alt grup"}</th>
                <th className="numeric">
                  {isPurchase ? "Alım miktarı" : "Tüketim"}
                </th>
                {!isPurchase && <th className="numeric">Kişi başı gramaj</th>}
                <th className="numeric">
                  {isPurchase ? "Net alım tutarı" : "Maliyet"}
                </th>
                {!isPurchase && <th className="numeric">Kişi başı maliyet</th>}
                <th className="numeric">Önceki dönem</th>
              </tr>
            </thead>
            <tbody>
              {table.map((r) => (
                <tr key={r.name}>
                  <td>
                    <strong>{r.name}</strong>
                    {r.code && (
                      <small>
                        {r.code} · {r.group}
                      </small>
                    )}
                  </td>
                  <td className="numeric">{r.qty}</td>
                  {!isPurchase && <td className="numeric">{r.gram}</td>}
                  <td className="numeric">{money(r.cost)}</td>
                  {!isPurchase && (
                    <td className="numeric">
                      {people ? money(Math.round(r.cost / people)) : "—"}
                    </td>
                  )}
                  <td
                    className={`numeric ${r.change !== null && r.change > 0 ? "warning-text" : ""}`}
                  >
                    {r.change === null
                      ? "—"
                      : `${r.change > 0 ? "+" : ""}${r.change.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!table.length && <Empty text="Bu dönemde rapora dahil hareket yok." />}
        <div className="panel-foot">
          {previous
            ? `Karşılaştırma: ${monthName(previous.id)}. `
            : "Önceki dönem kaydı bulunmuyor. "}
          {isPurchase
            ? "Alım tutarları KDV hariçtir; ters kaydı yapılmış alımlar dahil edilmez."
            : "Gramaj yalnızca kg ile takip edilen malzemelerde hesaplanır."}
        </div>
      </section>
      {!isPurchase && p.snapshots.length > 0 && (
        <section className="panel">
          <div className="panel-heading">
            <h2>Kapanış geçmişi</h2>
          </div>
          {p.snapshots.map((x) => (
            <div className="history-row" key={x.revision}>
              <span>Revizyon {x.revision}</span>
              <span>
                {new Date(x.closedAt).toLocaleString("tr-TR", {
                  timeZone: "Europe/Istanbul",
                })}
              </span>
              <span>{x.closedBy}</span>
              <strong>{money(x.rows.reduce((n, r) => n + r.cost, 0))}</strong>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
function Configuration() {
  const { s, show, actor, period, demo } = useApp();
  const [users, setUsers] = useState<(Actor & { active: boolean })[]>([]);
  useEffect(() => {
    if (demo) {
      setUsers([
        {
          id: "demo-manager",
          name: "Ali Haydar Genç",
          email: "deniz@mosaic.example",
          role: "manager",
          active: true,
        },
        {
          id: "demo-storekeeper",
          name: "Emre Kaya",
          email: "emre@mosaic.example",
          role: "storekeeper",
          active: true,
        },
      ]);
    } else if (actor.role === "manager")
      fetch("/api/users")
        .then((r) => (r.ok ? r.json() : []))
        .then(setUsers);
  }, [actor.role, s.version, demo]);
  return (
    <>
      <Toolbar
        title="Konfigürasyon"
        description="Depolar, lokasyonlar, dönemler ve erişim yetkileri."
      />
      <div className="config-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>Depolar & lokasyonlar</h2>
            {actor.role !== "viewer" && (
              <button className="button small" onClick={() => show("place")}>
                <Plus size={14} />
                Ekle
              </button>
            )}
          </div>
          {s.places.map((p) => (
            <div className="config-row" key={p.id}>
              <span>{p.name}</span>
              <Badge>{p.kind === "warehouse" ? "Depo" : "Lokasyon"}</Badge>
              {actor.role !== "viewer" && (
                <button
                  className="text-button"
                  onClick={() => show("place", p)}
                >
                  Düzenle
                </button>
              )}
            </div>
          ))}
          {!s.places.length && <Empty />}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Dönemler</h2>
            {actor.role === "manager" && (
              <button
                className="button small"
                onClick={() => show("newPeriod")}
              >
                Yeni dönem
              </button>
            )}
          </div>
          {s.periods.map((p) => (
            <div className="config-row" key={p.id}>
              <span>{monthName(p.id)}</span>
              <Badge tone={p.status === "open" ? "green" : "neutral"}>
                {p.status === "open" ? "Açık" : "Kapalı"}
              </Badge>
            </div>
          ))}
          <div className="panel-foot">
            Kayıtlar {monthName(period)} dönemi üzerinden görüntüleniyor.
          </div>
        </section>
      </div>
      {actor.role === "manager" && (
        <section className="panel">
          <div className="panel-heading">
            <h2>Kullanıcılar</h2>
            <button
              className="button small"
              disabled={demo}
              onClick={() => show("user")}
            >
              <Plus size={14} />
              Kullanıcı ekle
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ad</th>
                  <th>E-posta</th>
                  <th>Yetki</th>
                  <th>Durum</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>
                      {u.role === "manager"
                        ? "Yönetici"
                        : u.role === "storekeeper"
                          ? "Ambar"
                          : "Rapor"}
                    </td>
                    <td>
                      <Badge tone={u.active ? "green" : "neutral"}>
                        {u.active ? "Aktif" : "Pasif"}
                      </Badge>
                    </td>
                    <td>
                      <button
                        className="text-button"
                        disabled={demo}
                        onClick={() => show("user", u)}
                      >
                        Düzenle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!users.length && (
            <div className="panel-foot">
              Yerel örnek roller giriş ekranındadır. Gerçek kullanıcılar buradan
              eklenir.
            </div>
          )}
        </section>
      )}
    </>
  );
}
function Audit() {
  const { s } = useApp();
  const [search, setSearch] = useState("");
  const list = [...s.audit]
    .reverse()
    .filter((a) =>
      `${a.actor} ${a.detail} ${actionNames[a.action]}`
        .toLocaleLowerCase("tr")
        .includes(search.toLocaleLowerCase("tr")),
    );
  return (
    <>
      <Toolbar
        title="İşlem geçmişi"
        description="Kimin, ne zaman, hangi işlemi yaptığı kayıt altında."
      />
      <section className="panel">
        <div className="table-tools">
          <SearchBox value={search} onChange={setSearch} />
          <span>{list.length} işlem</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tarih / saat</th>
                <th>Kullanıcı</th>
                <th>İşlem</th>
                <th>Kayıt / gerekçe</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, 200).map((a) => (
                <tr key={a.id}>
                  <td>
                    {new Date(a.at).toLocaleString("tr-TR", {
                      timeZone: "Europe/Istanbul",
                    })}
                  </td>
                  <td>{a.actor}</td>
                  <td>{actionNames[a.action] ?? a.action}</td>
                  <td>{a.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.length > 200 && (
          <div className="panel-foot">
            Son 200 eşleşme gösteriliyor; aramayla daraltın.
          </div>
        )}
      </section>
    </>
  );
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ModalBody({ kind, data }: { kind: string; data?: unknown }) {
  if (kind === "invoice")
    return <InvoiceForm invoice={data as Invoice | undefined} />;
  if (kind === "transfer") return <TransferForm />;
  if (kind === "recipe")
    return <RecipeForm recipe={data as Recipe | undefined} />;
  if (kind === "print") return <TransferPrint transfer={data as Transfer} />;
  if (kind === "user")
    return (
      <UserForm user={data as (Actor & { active: boolean }) | undefined} />
    );
  return <SimpleForm kind={kind} data={data} />;
}
function SimpleForm({ kind, data }: { kind: string; data?: unknown }) {
  const { s, period, send, close } = useApp();
  const p = s.periods.find((p) => p.id === period)!;
  const existing = data as (Product & Place) | undefined;
  const [productId, setProduct] = useState("");
  const [placeId, setPlace] = useState("");
  const b = s.balances.find(
    (b) => b.productId === productId && b.placeId === placeId,
  );
  const product = s.products.find((p) => p.id === productId);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const value = (key: string) => String(f.get(key) ?? "");
    const decimal = (key: string, scale = 1) =>
      Math.round(parseDecimal(value(key)) * scale);
    let c: unknown;
    if (kind === "product")
      c = {
        type: "product",
        productId: existing?.id,
        name: value("name"),
        code: value("code"),
        group: value("group"),
        unit: value("unit"),
        minimum: decimal("minimum", 1000),
      };
    if (kind === "place")
      c = {
        type: "place",
        placeId: existing?.id,
        name: value("name"),
        kind: value("kind"),
      };
    if (kind === "people")
      c = {
        type: "people",
        period,
        adults: decimal("adults"),
        children: decimal("children"),
      };
    if (kind === "close") c = { type: "close", period };
    if (kind === "reopen")
      c = { type: "reopen", period, reason: value("reason") };
    if (kind === "newPeriod")
      c = { type: "newPeriod", period: value("newPeriod") };
    if (kind === "accept")
      c = {
        type: "acceptTransfer",
        transferId: (data as Transfer).id,
        receivedBy: value("receivedBy"),
      };
    if (kind === "reverse")
      c = { type: "reverse", movementId: data, reason: value("reason") };
    if (kind === "consume")
      c = {
        type: "consume",
        productId,
        placeId,
        period,
        qty: decimal("qty", 1000),
        date: value("date"),
        note: value("note"),
      };
    if (kind === "count")
      c = {
        type: "count",
        productId,
        placeId,
        period,
        counted: decimal("qty", 1000),
        date: value("date"),
        note: value("note"),
      };
    if (await send(c)) close();
  }
  return (
    <form onSubmit={submit}>
      {kind === "product" && (
        <div className="form-grid">
          <label>
            Stok kodu
            <input
              name="code"
              required
              maxLength={80}
              defaultValue={existing?.code}
            />
          </label>
          <label>
            Malzeme adı
            <input
              name="name"
              required
              maxLength={160}
              defaultValue={existing?.name}
            />
          </label>
          <label>
            Alt grup
            <input
              name="group"
              required
              list="groups"
              defaultValue={existing?.group}
            />
            <datalist id="groups">
              {[...new Set(s.products.map((p) => p.group))].map((g) => (
                <option key={g}>{g}</option>
              ))}
            </datalist>
          </label>
          <label>
            Temel birim
            <select name="unit" defaultValue={existing?.unit}>
              <option value="kg">kg</option>
              <option value="lt">lt</option>
              <option value="adet">adet</option>
            </select>
          </label>
          <label>
            Minimum stok
            <input
              name="minimum"
              type="number"
              min="0"
              step="0.001"
              defaultValue={(existing?.minimum ?? 0) / 1000}
              required
            />
          </label>
        </div>
      )}
      {kind === "place" && (
        <div className="form-grid">
          <label>
            Ad
            <input name="name" required defaultValue={existing?.name} />
          </label>
          <label>
            Tür
            <select name="kind" defaultValue={existing?.kind}>
              <option value="warehouse">Depo</option>
              <option value="location">Lokasyon</option>
            </select>
          </label>
        </div>
      )}
      {kind === "people" && (
        <div className="form-grid">
          <label>
            Yetişkin
            <input
              name="adults"
              type="number"
              min="0"
              step="1"
              defaultValue={p.adults}
              required
            />
          </label>
          <label>
            Çocuk
            <input
              name="children"
              type="number"
              min="0"
              step="1"
              defaultValue={p.children}
              required
            />
          </label>
        </div>
      )}
      {(kind === "count" || kind === "consume") && (
        <>
          <div className="form-grid">
            <label>
              Lokasyon
              <PlaceSelect value={placeId} onChange={setPlace} />
            </label>
            <label>
              Malzeme
              <ProductSelect value={productId} onChange={setProduct} />
            </label>
            <label>
              İşlem tarihi
              <input name="date" type="date" defaultValue={today()} required />
            </label>
            <label>
              {kind === "count" ? "Sayılan miktar" : "Çıkış miktarı"}{" "}
              {product && `(${product.unit})`}
              <input
                name="qty"
                type="number"
                min={kind === "count" ? "0" : "0.001"}
                step="0.001"
                required
              />
            </label>
            <label className="span-2">
              {kind === "count" ? "Fark gerekçesi" : "Çıkış açıklaması"}
              <input name="note" required />
            </label>
          </div>
          <div className="notice">
            Sistem stoğu:{" "}
            <strong>
              {quantity(b?.qty ?? 0)} {product?.unit}
            </strong>{" "}
            · {money(b?.value ?? 0)}
          </div>
          {kind === "count" && (
            <p className="form-note">
              Eksik sayım tüketim maliyetine eklenir; fazla sayım aynı dönem
              maliyetinden düşer.
            </p>
          )}
        </>
      )}
      {kind === "accept" && (
        <>
          <div className="notice">
            {(data as Transfer).lines.length} malzeme kaynak stoktan düşecek ve
            hedef stoğa girecek.
          </div>
          <label>
            Teslim alan kişinin adı
            <input name="receivedBy" required placeholder="Ad soyad" />
          </label>
          <p className="form-note">
            İmzalı fiş kontrolünden sonra kabul edin. Kabul eden kullanıcı ve
            saat ayrıca kaydedilir.
          </p>
        </>
      )}
      {kind === "close" && (
        <>
          <div className="notice">
            <strong>{monthName(period)}</strong> kapanacak ve raporun değişmez
            revizyonu saklanacak.
          </div>
          <p className="form-note">
            Bekleyen fatura ve transferler tamamlanmış olmalı. Kapanış sonrası
            yeni hareket girilemez.
          </p>
        </>
      )}
      {(kind === "reopen" || kind === "reverse") && (
        <>
          <div className="notice">
            {kind === "reopen"
              ? "Önceki kapanış saklanır; düzeltmeden sonra yeni revizyonla kapatılır."
              : "Orijinal kayıt korunur. Ters hareket stok ve maliyeti düzeltir."}
          </div>
          <label>
            Yönetici gerekçesi
            <textarea name="reason" required rows={3} />
          </label>
        </>
      )}
      {kind === "newPeriod" && (
        <label>
          Dönem
          <input
            name="newPeriod"
            type="month"
            required
            defaultValue={(() => {
              const d = new Date(`${s.periods.at(-1)!.id}-01T12:00:00Z`);
              d.setUTCMonth(d.getUTCMonth() + 1);
              return d.toISOString().slice(0, 7);
            })()}
          />
        </label>
      )}
      <FormActions
        label={
          kind === "accept"
            ? "Teslimi kabul et"
            : kind === "close"
              ? "Dönemi kapat"
              : kind === "reverse"
                ? "Ters kayıt oluştur"
                : "Kaydet"
        }
      />
    </form>
  );
}
type EditLine = {
  productId: string;
  qty: string;
  price: string;
  vat: string;
  sourceName?: string;
  sourceUnit?: string;
};
function InvoiceForm({ invoice }: { invoice?: Invoice }) {
  const { s, period, send, close, actor } = useApp();
  const [lines, setLines] = useState<EditLine[]>(
    invoice?.lines.map((l) => ({
      productId: l.productId,
      qty: String(l.qty / 1000),
      price: String(l.unitPrice / 100),
      vat: String(l.vat),
    })) ?? [{ productId: "", qty: "", price: "", vat: "1" }],
  );
  const [extracted, setExtracted] = useState(invoice?.extractedText ?? "");
  const [file, setFile] = useState<Invoice["attachment"]>(invoice?.attachment);
  const [progress, setProgress] = useState("");
  const [readError, setReadError] = useState("");
  const [quick, setQuick] = useState(false);
  const readonly = invoice?.status === "posted" || actor.role === "viewer";
  function change(i: number, key: keyof EditLine, value: string) {
    setLines((prev) =>
      prev.map((l, j) => (i === j ? { ...l, [key]: value } : l)),
    );
  }
  async function load(file: File) {
    setReadError("");
    setProgress("Belge hazırlanıyor…");
    try {
      if (file.size > 2_500_000)
        throw new Error("Belge en fazla 2,5 MB olabilir.");
      if (!["application/pdf", "image/png", "image/jpeg"].includes(file.type))
        throw new Error("PDF, PNG veya JPEG seçin.");
      const buffer = await file.arrayBuffer();
      const hash = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)),
      )
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("");
      const encoded = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1]);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      setFile({ name: file.name, mime: file.type, data: encoded, hash });
      const text = await readDocument(file, setProgress);
      setExtracted(text);
      const candidates = parseInvoiceText(text);
      const norm = (v: string) =>
        v.toLocaleLowerCase("tr").replace(/[^\p{L}\p{N}]/gu, "");
      if (candidates.length)
        setLines(
          candidates.map((c) => {
            const match = s.products.find((p) => norm(p.name) === norm(c.name));
            const q = parseDecimal(c.quantity);
            return {
              productId: match?.id ?? "",
              qty: String(["g", "gr"].includes(c.unit) ? q / 1000 : q),
              price: String(parseDecimal(c.price)),
              vat: "1",
              sourceName: c.name,
              sourceUnit: c.unit,
            };
          }),
        );
      else
        setReadError(
          "Satırlar otomatik ayrıştırılamadı. Okunan metni kullanarak satırları elle girin.",
        );
    } catch (e) {
      setReadError(
        e instanceof Error
          ? e.message
          : "Belge okunamadı. Manuel giriş yapabilirsiniz.",
      );
    } finally {
      setProgress("");
    }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const c = {
      type: "invoice",
      invoiceId: invoice?.id,
      reference: String(f.get("reference")),
      supplier: String(f.get("supplier")),
      documentDate: String(f.get("documentDate")),
      period: String(f.get("period")),
      placeId: String(f.get("placeId")),
      lines: lines.map((l) => ({
        productId: l.productId,
        qty: Math.round(parseDecimal(l.qty) * 1000),
        unitPrice: Math.round(parseDecimal(l.price) * 100),
        vat: Number(l.vat),
      })),
      attachment: file?.data ? file : undefined,
      extractedText: extracted,
    };
    if (await send(c)) close();
  }
  return (
    <>
      <form onSubmit={submit}>
        <fieldset disabled={readonly || !!progress} className="clean-fieldset">
          <div className="form-grid">
            <label>
              Fatura numarası
              <input
                name="reference"
                defaultValue={invoice?.reference}
                required
              />
            </label>
            <label>
              Tedarikçi
              <input
                name="supplier"
                defaultValue={invoice?.supplier}
                required
              />
            </label>
            <label>
              Belge tarihi
              <input
                name="documentDate"
                type="date"
                defaultValue={invoice?.documentDate ?? today()}
                required
              />
            </label>
            <label>
              Kayıt dönemi
              <select name="period" defaultValue={invoice?.period ?? period}>
                {s.periods
                  .filter(
                    (p) => p.status === "open" || p.id === invoice?.period,
                  )
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {monthName(p.id)}
                    </option>
                  ))}
              </select>
            </label>
            <label className="span-2">
              Mal kabul yeri
              <PlaceSelect name="placeId" defaultValue={invoice?.placeId} />
            </label>
          </div>
          {!readonly && (
            <label className="upload-zone">
              <Upload size={20} />
              <span>{progress || "PDF veya görsel yükle"}</span>
              <small>PDF, PNG, JPEG · en fazla 2,5 MB</small>
              <input
                aria-label="Fatura belgesi yükle"
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void load(f);
                }}
              />
            </label>
          )}
          {readError && (
            <div className="notice amber" role="status">
              {readError}
            </div>
          )}
          {file && !readonly && (
            <div className="attachment-line">
              <FileText size={16} />
              <span>{file.name}</span>
              <button
                className="text-button"
                type="button"
                onClick={async () => {
                  if (file.data)
                    download(
                      new Blob(
                        [
                          Uint8Array.from(atob(file.data), (c) =>
                            c.charCodeAt(0),
                          ),
                        ],
                        { type: file.mime },
                      ),
                      file.name,
                    );
                  else if (invoice) {
                    const r = await fetch(`/api/documents/${invoice.id}`);
                    if (r.ok) download(await r.blob(), file.name);
                  }
                }}
              >
                İndir
              </button>
            </div>
          )}
          {extracted && (
            <details className="extracted">
              <summary>Okunan belge metni</summary>
              <textarea
                aria-label="Okunan belge metni"
                value={extracted}
                readOnly
                rows={5}
              />
            </details>
          )}
          <div className="section-label">
            <h3>Malzeme eşleştirme</h3>
            {!readonly && (
              <button
                className="text-button"
                type="button"
                onClick={() => setQuick(!quick)}
              >
                Stok kartı aç
                <Plus size={14} />
              </button>
            )}
          </div>
          <div className="table-wrap">
            <table className="edit-table">
              <thead>
                <tr>
                  <th>Stok kartı</th>
                  <th>Miktar</th>
                  <th>Net birim fiyat (₺)</th>
                  <th>KDV %</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i}>
                    <td>
                      <ProductSelect
                        value={l.productId}
                        onChange={(v) => change(i, "productId", v)}
                      />
                      {l.sourceName && (
                        <small>
                          Belge: {l.sourceName} · {l.sourceUnit}
                        </small>
                      )}
                    </td>
                    <td>
                      <input
                        aria-label={`Satır ${i + 1} miktar`}
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={l.qty}
                        required
                        onChange={(e) => change(i, "qty", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`Satır ${i + 1} fiyat`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={l.price}
                        required
                        onChange={(e) => change(i, "price", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`Satır ${i + 1} KDV`}
                        type="number"
                        min="0"
                        max="100"
                        value={l.vat}
                        required
                        onChange={(e) => change(i, "vat", e.target.value)}
                      />
                    </td>
                    <td>
                      {!readonly && lines.length > 1 && (
                        <button
                          type="button"
                          className="icon-button"
                          aria-label="Satırı sil"
                          onClick={() =>
                            setLines(lines.filter((_, j) => i !== j))
                          }
                        >
                          <X size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!readonly && (
            <button
              className="text-button add-line"
              type="button"
              onClick={() =>
                setLines([
                  ...lines,
                  { productId: "", qty: "", price: "", vat: "1" },
                ])
              }
            >
              <Plus size={14} />
              Satır ekle
            </button>
          )}
          <div className="invoice-total">
            <span>KDV hariç toplam</span>
            <strong>
              {money(
                lines.reduce(
                  (n, l) =>
                    n +
                    Math.round(
                      (parseDecimal(l.qty) || 0) *
                        (parseDecimal(l.price) || 0) *
                        100,
                    ),
                  0,
                ),
              )}
            </strong>
          </div>
          <p className="form-note">
            Okunan satırları, birimleri, net fiyatları ve KDV oranını kontrol
            edin. Belge tarihi önceki ay olsa da alım seçilen açık döneme
            kaydedilir.
          </p>
        </fieldset>
        {readonly && file && invoice && (
          <div className="attachment-line">
            <FileText size={16} />
            <span>{file.name}</span>
            <button
              type="button"
              className="text-button"
              onClick={async () => {
                if (file.data) {
                  download(
                    new Blob(
                      [
                        Uint8Array.from(atob(file.data), (c) =>
                          c.charCodeAt(0),
                        ),
                      ],
                      { type: file.mime },
                    ),
                    file.name,
                  );
                } else {
                  const r = await fetch(`/api/documents/${invoice.id}`);
                  if (r.ok) download(await r.blob(), file.name);
                }
              }}
            >
              İndir
            </button>
          </div>
        )}
        {!readonly ? (
          <FormActions label="Kontrol taslağını kaydet" />
        ) : (
          <div className="form-actions">
            <button type="button" className="button" onClick={close}>
              Kapat
            </button>
          </div>
        )}
      </form>
      {quick && <QuickProduct onDone={() => setQuick(false)} />}
    </>
  );
}
function QuickProduct({ onDone }: { onDone: () => void }) {
  const { send } = useApp();
  return (
    <form
      className="quick-product"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        if (
          await send({
            type: "product",
            name: f.get("name"),
            code: f.get("code"),
            group: f.get("group"),
            unit: f.get("unit"),
            minimum: 0,
          })
        )
          onDone();
      }}
    >
      <h3>Yeni stok kartı</h3>
      <div className="form-grid">
        <label>
          Kod
          <input name="code" required />
        </label>
        <label>
          Malzeme adı
          <input name="name" required />
        </label>
        <label>
          Alt grup
          <input name="group" required />
        </label>
        <label>
          Birim
          <select name="unit">
            <option>kg</option>
            <option>lt</option>
            <option>adet</option>
          </select>
        </label>
      </div>
      <button className="button primary">Stok kartını oluştur</button>
    </form>
  );
}
function TransferForm() {
  const { period, send, close } = useApp();
  const [lines, setLines] = useState([{ productId: "", qty: "" }]);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        if (
          await send({
            type: "transfer",
            period,
            from: f.get("from"),
            to: f.get("to"),
            date: f.get("date"),
            note: f.get("note"),
            lines: lines.map((l) => ({
              productId: l.productId,
              qty: Math.round(parseDecimal(l.qty) * 1000),
            })),
          })
        )
          close();
      }}
    >
      <div className="form-grid">
        <label>
          Kaynak
          <PlaceSelect name="from" />
        </label>
        <label>
          Hedef
          <PlaceSelect name="to" />
        </label>
        <label>
          Tarih
          <input name="date" type="date" defaultValue={today()} required />
        </label>
        <label>
          Açıklama
          <input name="note" required />
        </label>
      </div>
      <div className="section-label">
        <h3>Transfer malzemeleri</h3>
      </div>
      {lines.map((l, i) => (
        <div className="line-grid" key={i}>
          <ProductSelect
            value={l.productId}
            onChange={(v) =>
              setLines(
                lines.map((x, j) => (i === j ? { ...x, productId: v } : x)),
              )
            }
          />
          <input
            aria-label={`Transfer miktarı ${i + 1}`}
            type="number"
            step="0.001"
            min="0.001"
            placeholder="Temel birimde miktar"
            value={l.qty}
            required
            onChange={(e) =>
              setLines(
                lines.map((x, j) =>
                  i === j ? { ...x, qty: e.target.value } : x,
                ),
              )
            }
          />
          <button
            className="icon-button"
            type="button"
            aria-label="Transfer satırını sil"
            disabled={lines.length === 1}
            onClick={() => setLines(lines.filter((_, j) => i !== j))}
          >
            <X size={16} />
          </button>
        </div>
      ))}
      <button
        className="text-button add-line"
        type="button"
        onClick={() => setLines([...lines, { productId: "", qty: "" }])}
      >
        <Plus size={14} />
        Satır ekle
      </button>
      <p className="form-note">
        Stok hareketi teslim kabulünde oluşur. Bekleyen transfer stok
        rezervasyonu yapmaz.
      </p>
      <FormActions label="Transfer fişi oluştur" />
    </form>
  );
}
function RecipeForm({ recipe }: { recipe?: Recipe }) {
  const { send, close } = useApp();
  const [lines, setLines] = useState(
    recipe?.lines.map((l) => ({
      productId: l.productId,
      qty: String(l.qty / 1000),
      waste: String(l.wastePercent),
    })) ?? [{ productId: "", qty: "", waste: "0" }],
  );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        if (
          await send({
            type: "recipe",
            recipeId: recipe?.id,
            name: f.get("name"),
            portions: Number(f.get("portions")),
            lines: lines.map((l) => ({
              productId: l.productId,
              qty: Math.round(parseDecimal(l.qty) * 1000),
              wastePercent: Number(l.waste),
            })),
          })
        )
          close();
      }}
    >
      <div className="form-grid">
        <label>
          Reçete adı
          <input name="name" required defaultValue={recipe?.name} />
        </label>
        <label>
          Referans porsiyon
          <input
            name="portions"
            type="number"
            min="1"
            step="1"
            required
            defaultValue={recipe?.portions ?? 100}
          />
        </label>
      </div>
      <div className="section-label">
        <h3>Referans porsiyon için toplam malzeme</h3>
      </div>
      <div className="table-wrap">
        <table className="edit-table">
          <thead>
            <tr>
              <th>Malzeme</th>
              <th>Miktar (temel birim)</th>
              <th>Ek pay %</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td>
                  <ProductSelect
                    value={l.productId}
                    onChange={(v) =>
                      setLines(
                        lines.map((x, j) =>
                          i === j ? { ...x, productId: v } : x,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    aria-label={`Reçete miktarı ${i + 1}`}
                    type="number"
                    min="0.001"
                    step="0.001"
                    required
                    value={l.qty}
                    onChange={(e) =>
                      setLines(
                        lines.map((x, j) =>
                          i === j ? { ...x, qty: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    aria-label={`Reçete ek payı ${i + 1}`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={l.waste}
                    onChange={(e) =>
                      setLines(
                        lines.map((x, j) =>
                          i === j ? { ...x, waste: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Reçete satırını sil"
                    disabled={lines.length === 1}
                    onClick={() => setLines(lines.filter((_, j) => i !== j))}
                  >
                    <X size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        className="text-button add-line"
        type="button"
        onClick={() =>
          setLines([...lines, { productId: "", qty: "", waste: "0" }])
        }
      >
        <Plus size={14} />
        Malzeme ekle
      </button>
      <FormActions />
    </form>
  );
}
function TransferPrint({ transfer: t }: { transfer: Transfer }) {
  const { s, close } = useApp();
  return (
    <>
      <div className="print-document">
        <div className="print-brand">MOSAIC HOTEL ISTANBUL</div>
        <h2>Malzeme transfer & teslim fişi</h2>
        <div className="print-meta">
          <span>Fiş: TR-{t.id.slice(0, 6).toUpperCase()}</span>
          <span>Tarih: {t.date}</span>
          <span>Dönem: {t.period}</span>
        </div>
        <div className="print-meta">
          <strong>Kaynak: {s.places.find((p) => p.id === t.from)?.name}</strong>
          <strong>Hedef: {s.places.find((p) => p.id === t.to)?.name}</strong>
        </div>
        <table>
          <thead>
            <tr>
              <th>Stok kodu</th>
              <th>Malzeme</th>
              <th className="numeric">Miktar</th>
            </tr>
          </thead>
          <tbody>
            {t.lines.map((l) => {
              const p = s.products.find((p) => p.id === l.productId)!;
              return (
                <tr key={l.productId}>
                  <td>{p.code}</td>
                  <td>{p.name}</td>
                  <td className="numeric">
                    {quantity(l.qty)} {p.unit}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p>{t.note}</p>
        <div className="signatures">
          <div>
            Teslim eden
            <br />
            <strong>{t.requestedBy}</strong>
            <span>İmza</span>
          </div>
          <div>
            Teslim alan
            <br />
            <strong>
              {t.receivedBy ?? "................................"}
            </strong>
            <span>İmza</span>
          </div>
        </div>
        {t.acceptedAt && (
          <p className="form-note">
            Sistem kabulü:{" "}
            {new Date(t.acceptedAt).toLocaleString("tr-TR", {
              timeZone: "Europe/Istanbul",
            })}
          </p>
        )}
      </div>
      <div className="form-actions">
        <button className="button" onClick={close}>
          Kapat
        </button>
        <button className="button primary" onClick={() => window.print()}>
          <Printer size={16} />
          Fişi yazdır
        </button>
      </div>
    </>
  );
}
function UserForm({ user }: { user?: Actor & { active: boolean } }) {
  const { close } = useApp();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const f = new FormData(e.currentTarget);
        const body = user
          ? {
              id: user.id,
              name: f.get("name"),
              role: f.get("role"),
              active: f.get("active") === "true",
              password: String(f.get("password") ?? "") || undefined,
            }
          : Object.fromEntries(f);
        try {
          const r = await fetch("/api/users", {
            method: user ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const b = await r.json();
          if (!r.ok) throw new Error(b.error);
          location.reload();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Kullanıcı kaydedilemedi.");
          setBusy(false);
        }
      }}
    >
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className="form-grid">
        <label>
          Ad soyad
          <input name="name" required defaultValue={user?.name} />
        </label>
        <label>
          E-posta
          <input
            name="email"
            type="email"
            required={!user}
            defaultValue={user?.email}
            disabled={!!user}
          />
        </label>
        <label>
          {user ? "Yeni parola (isteğe bağlı)" : "Başlangıç parolası"}
          <input
            name="password"
            type="password"
            minLength={12}
            required={!user}
            autoComplete="new-password"
          />
        </label>
        <label>
          Yetki
          <select name="role" defaultValue={user?.role ?? "viewer"}>
            <option value="viewer">Rapor · salt okunur</option>
            <option value="storekeeper">Ambar · operasyon</option>
            <option value="manager">Yönetici · kapanış ve düzeltme</option>
          </select>
        </label>
        {user && (
          <label>
            Durum
            <select name="active" defaultValue={String(user.active)}>
              <option value="true">Aktif</option>
              <option value="false">Pasif</option>
            </select>
          </label>
        )}
      </div>
      <div className="form-actions">
        <button className="button" type="button" onClick={close}>
          Vazgeç
        </button>
        <button className="button primary" disabled={busy}>
          {user ? "Kullanıcıyı kaydet" : "Kullanıcı oluştur"}
        </button>
      </div>
    </form>
  );
}
