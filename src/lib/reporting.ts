import type { State, ReportRow } from "./types";
export function report(s: State, period: string): ReportRow[] {
  const totals = new Map<string, ReportRow>();
  for (const m of s.movements.filter((m) => m.period === period)) {
    let q = 0,
      v = 0;
    if (m.type === "consumption") {
      q = m.qty;
      v = m.value;
    }
    // Negative count delta is inventory loss; positive delta offsets this period's loss.
    if (m.type === "count") {
      q = -m.qty;
      v = -m.value;
    }
    if (m.type === "reversal" && m.reverses) {
      const original = s.movements.find((x) => x.id === m.reverses);
      if (original?.type === "consumption") {
        q = -original.qty;
        v = -original.value;
      }
      if (original?.type === "count") {
        q = original.qty;
        v = original.value;
      }
    }
    if (!q && !v) continue;
    const r = totals.get(m.productId) ?? {
      productId: m.productId,
      quantity: 0,
      cost: 0,
    };
    r.quantity += q;
    r.cost += v;
    totals.set(m.productId, r);
  }
  return [...totals.values()];
}
export function purchases(s: State, p: string) {
  return s.movements
    .filter((m) => m.period === p && m.type === "receipt")
    .reduce((n, m) => n + (m.reversedBy ? 0 : m.value), 0);
}
export function purchaseReport(s: State, period: string): ReportRow[] {
  const totals = new Map<string, ReportRow>();
  for (const m of s.movements.filter(
    (m) => m.period === period && m.type === "receipt" && !m.reversedBy,
  )) {
    const row = totals.get(m.productId) ?? {
      productId: m.productId,
      quantity: 0,
      cost: 0,
    };
    row.quantity += m.qty;
    row.cost += m.value;
    totals.set(m.productId, row);
  }
  return [...totals.values()];
}
