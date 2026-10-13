export type Role = "manager" | "storekeeper" | "viewer";
export type Actor = { id: string; name: string; role: Role; email: string };
export type Product = {
  id: string;
  code: string;
  name: string;
  group: string;
  unit: "kg" | "lt" | "adet";
  minimum: number;
};
export type Place = {
  id: string;
  name: string;
  kind: "warehouse" | "location";
};
// Quantity is stored in thousandths of the product's base unit. Money is integer kuruş.
export type Balance = {
  productId: string;
  placeId: string;
  qty: number;
  value: number;
};
export type Line = {
  productId: string;
  qty: number;
  unitPrice: number;
  vat: number;
};
export type Invoice = {
  id: string;
  reference: string;
  supplier: string;
  documentDate: string;
  period: string;
  placeId: string;
  lines: Line[];
  status: "draft" | "posted";
  attachment?: { name: string; mime: string; data?: string; hash: string };
  extractedText?: string;
};
export type Movement = {
  id: string;
  type: "receipt" | "transfer" | "consumption" | "count" | "reversal";
  productId: string;
  qty: number;
  value: number;
  from?: string;
  to?: string;
  date: string;
  period: string;
  note: string;
  actor: string;
  invoiceId?: string;
  transferId?: string;
  reversedBy?: string;
  reverses?: string;
};
export type Transfer = {
  id: string;
  from: string;
  to: string;
  period: string;
  date: string;
  lines: { productId: string; qty: number }[];
  status: "pending" | "accepted";
  requestedBy: string;
  receivedBy?: string;
  acceptedAt?: string;
  note: string;
};
export type ReportRow = { productId: string; quantity: number; cost: number };
export type Period = {
  id: string;
  status: "open" | "closed";
  adults: number;
  children: number;
  revision: number;
  snapshots: {
    revision: number;
    closedAt: string;
    closedBy: string;
    rows: ReportRow[];
    purchases: number;
    people: number;
    catalog?: Product[];
    adults?: number;
    children?: number;
  }[];
};
export type Recipe = {
  id: string;
  name: string;
  portions: number;
  lines: { productId: string; qty: number; wastePercent: number }[];
};
export type Audit = {
  id: string;
  at: string;
  actor: string;
  action: string;
  detail: string;
};
export type State = {
  products: Product[];
  places: Place[];
  balances: Balance[];
  invoices: Invoice[];
  movements: Movement[];
  transfers: Transfer[];
  periods: Period[];
  recipes: Recipe[];
  audit: Audit[];
  version: number;
};
