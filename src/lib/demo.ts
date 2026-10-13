import { applyCommand, currentMonth, today } from "./domain";
import { sampleState } from "./seed";
import type { Actor } from "./types";

export const demoActor: Actor = {
  id: "demo-manager",
  name: "Deniz Yılmaz",
  role: "manager",
  email: "deniz@mosaic.example",
};

export function demoState() {
  let state = sampleState();
  const current = currentMonth();
  const previousDate = new Date(`${current}-01T12:00:00Z`);
  previousDate.setUTCMonth(previousDate.getUTCMonth() - 1);
  const previous = previousDate.toISOString().slice(0, 7);
  state.periods[0].id = previous;
  for (const invoice of state.invoices) {
    invoice.period = previous;
    invoice.documentDate = `${previous}-05`;
    invoice.reference = `MGT-${previous.replace("-", "")}-0142`;
    invoice.supplier = "Marmara Gıda Tedarik";
  }
  for (const movement of state.movements) {
    movement.period = previous;
    movement.date = `${previous}-12`;
    movement.actor = "Emre Kaya";
  }
  for (const transfer of state.transfers) {
    transfer.period = previous;
    transfer.date = `${previous}-12`;
    transfer.receivedBy = "Selin Aydın";
  }
  const run = (command: unknown) => {
    state = applyCommand(state, command, demoActor);
  };
  run({ type: "close", period: previous });
  run({ type: "newPeriod", period: current });
  run({ type: "people", period: current, adults: 192, children: 32 });
  run({
    type: "invoice",
    reference: `MGT-${current.replace("-", "")}-0187`,
    supplier: "Marmara Gıda Tedarik",
    documentDate: today(),
    period: current,
    placeId: state.places[0].id,
    lines: state.products.map((product, i) => ({
      productId: product.id,
      qty: i === 2 ? 360000 : [45000, 60000, 0, 18000, 40000, 25000][i],
      unitPrice: [25800, 6200, 700, 41500, 7800, 19800][i],
      vat: 1,
    })),
  });
  run({ type: "postInvoice", invoiceId: state.invoices.at(-1)!.id });
  run({
    type: "transfer",
    from: state.places[0].id,
    to: state.places[2].id,
    period: current,
    date: today(),
    note: "Sabah servisi hazırlığı",
    lines: state.products.map((product, i) => ({
      productId: product.id,
      qty: i === 2 ? 150000 : 15000,
    })),
  });
  run({
    type: "acceptTransfer",
    transferId: state.transfers.at(-1)!.id,
    receivedBy: "Selin Aydın",
  });
  for (let i = 0; i < state.products.length; i++) {
    run({
      type: "consume",
      placeId: state.places[3].id,
      productId: state.products[i].id,
      qty: [15000, 15000, 110000, 6000, 18000, 12000][i],
      period: current,
      date: today(),
      note: "Açık büfe kahvaltı",
    });
  }
  run({
    type: "count",
    placeId: state.places[3].id,
    productId: state.products[1].id,
    counted: 2000,
    period: current,
    date: today(),
    note: "Servis sonrası sayım",
  });
  run({
    type: "recipe",
    name: "Kontinental kahvaltı",
    portions: 50,
    lines: [0, 3, 4].map((i) => ({
      productId: state.products[i].id,
      qty: [3500, 0, 0, 1500, 6000][i],
      wastePercent: 2,
    })),
  });
  run({
    type: "transfer",
    from: state.places[0].id,
    to: state.places[4].id,
    period: current,
    date: today(),
    note: "Lobi bar ikmali",
    lines: [{ productId: state.products[4].id, qty: 12000 }],
  });
  run({
    type: "invoice",
    reference: `ST-${current.replace("-", "")}-0091`,
    supplier: "Trakya Süt Ürünleri",
    documentDate: today(),
    period: current,
    placeId: state.places[1].id,
    lines: [
      { productId: state.products[0].id, qty: 20000, unitPrice: 25200, vat: 1 },
    ],
  });
  state.products[4].minimum = 150000;
  for (const entry of state.audit) {
    if (entry.actor === "Örnek kayıt") entry.actor = "Emre Kaya";
  }
  return state;
}
