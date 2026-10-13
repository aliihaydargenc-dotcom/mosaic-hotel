import { test } from "node:test";
import assert from "node:assert/strict";
import { demoActor, demoState } from "../src/lib/demo";
import { applyCommand } from "../src/lib/domain";
import { report } from "../src/lib/reporting";

test("Demo iki dönem, gerçekleşen maliyet ve bekleyen işler içerir; ziyaretçi değişiklikleri paylaşılmaz", () => {
  const first = demoState();
  const untouched = structuredClone(first);
  const period = first.periods.at(-1)!.id;
  assert.equal(first.periods[0].status, "closed");
  assert.equal(first.periods[0].snapshots.length, 1);
  assert.ok(report(first, period).length > 0);
  assert.ok(first.transfers.some((t) => t.status === "pending"));
  assert.ok(first.invoices.some((i) => i.status === "draft"));
  const transfer = first.transfers.find((t) => t.status === "pending")!;
  const next = applyCommand(
    first,
    {
      type: "acceptTransfer",
      transferId: transfer.id,
      receivedBy: "Demo teslim",
    },
    demoActor,
  );
  assert.equal(
    next.transfers.find((t) => t.id === transfer.id)!.status,
    "accepted",
  );
  assert.deepEqual(first, untouched);
  assert.ok(demoState().transfers.some((t) => t.status === "pending"));
});
