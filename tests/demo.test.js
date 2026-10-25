import test from "node:test";
import assert from "node:assert/strict";
import {
  BASELINE,
  initialState,
  stock,
  addItem,
  setQuantity,
  removeItem,
  clearCart,
  cartTotal,
  completeSale,
  saleDetails,
  totals,
  chartDays,
  history,
  parseMoney,
  serialize,
  restore,
} from "../demo/model.js";

const basket = () => addItem(addItem(initialState(), "demo-0"), "demo-1");
const cash = { method: "cash", given: 5_000_000 };
test("demo baseline agrees with the store shown in landing screenshots", () => {
  const s = initialState(),
    t = totals(s);
  assert.equal(t.revenue, 39_695_000);
  assert.equal(t.profit, 14_288_000);
  assert.equal(t.receiptCount, 17);
  assert.equal(t.cash, 19_430_000);
  assert.equal(t.kaspi, 14_135_000);
  assert.equal(t.debtShipped, 6_130_000);
  assert.equal(t.received, 33_565_000);
  assert.equal(stock(s, "demo-0"), 12);
});
test("a draft changes neither stock nor revenue and can be edited and cleared", () => {
  const s = basket();
  assert.equal(cartTotal(s), 4_055_000);
  assert.equal(stock(s, "demo-0"), 12);
  assert.equal(totals(s).revenue, BASELINE.revenue);
  assert.equal(cartTotal(setQuantity(s, "demo-0", 2)), 8_045_000);
  assert.equal(cartTotal(removeItem(s, "demo-1")), 3_990_000);
  assert.equal(cartTotal(clearCart(s)), 0);
  assert.equal(s.cart.length, 2);
});
test("cash checkout atomically updates stock, revenue, profit, receipts and change", () => {
  const draft = basket(),
    paid = completeSale(draft, cash);
  assert.equal(paid.cart.length, 0);
  assert.equal(paid.sales.length, 1);
  assert.equal(saleDetails(paid.sales[0]).total, 4_055_000);
  assert.equal(saleDetails(paid.sales[0]).profit, 2_127_000);
  assert.equal(saleDetails(paid.sales[0]).change, 945_000);
  assert.equal(paid.sales[0].id, 174);
  assert.equal(stock(paid, "demo-0"), 11);
  assert.equal(stock(paid, "demo-1"), 239);
  assert.equal(totals(paid).revenue, 43_750_000);
  assert.equal(totals(paid).profit, 16_415_000);
  assert.equal(totals(paid).cash, 23_485_000);
  assert.equal(totals(paid).received, 37_620_000);
  assert.equal(totals(paid).receiptCount, 18);
  assert.equal(draft.sales.length, 0);
  assert.throws(() => completeSale(paid, cash), /добавьте товар/);
});
test("Kaspi and debt are counted separately and debt does not invent received money", () => {
  const kaspi = completeSale(basket(), { method: "kaspi" });
  assert.equal(totals(kaspi).kaspi, 18_190_000);
  assert.equal(totals(kaspi).cash, 19_430_000);
  const debt = completeSale(basket(), {
    method: "debt",
    customer: "Бригада «Мастер»",
  });
  assert.equal(totals(debt).revenue, 43_750_000);
  assert.equal(totals(debt).debtShipped, 10_185_000);
  assert.equal(totals(debt).received, 33_565_000);
  assert.equal(saleDetails(debt.sales[0]).change, 0);
  assert.throws(
    () =>
      completeSale(basket(), {
        method: "debt",
        customer: "not a demo customer",
      }),
    /покупателя/,
  );
});
test("invalid payment, empty cart and overselling leave the original state unchanged", () => {
  const s = basket(),
    before = serialize(s);
  for (const payment of [
    { method: "cash", given: 100 },
    { method: "cash", given: NaN },
    { method: "cash", given: Infinity },
    { method: "cash", given: 1.5 },
    { method: "card" },
  ]) {
    assert.throws(() => completeSale(s, payment));
    assert.equal(serialize(s), before);
  }
  for (const qty of [0, -1, 1.5, NaN, Infinity, 13])
    assert.throws(() => setQuantity(s, "demo-0", qty));
  assert.throws(() => addItem(s, "unknown"));
  const all = completeSale(setQuantity(initialState(), "demo-0", 12), {
    method: "kaspi",
  });
  assert.equal(stock(all, "demo-0"), 0);
  assert.throws(() => addItem(all, "demo-0"), /осталось 0/);
  assert.equal(
    totals(all).cash + totals(all).kaspi + totals(all).debtShipped,
    totals(all).revenue,
  );
});
test("money parsing keeps exact tiyn and rejects ambiguous or excessive amounts", () => {
  for (const text of ["50 000", "50\u00a0000", "50000.00", "50000,00"])
    assert.equal(parseMoney(text), 5_000_000);
  assert.equal(parseMoney("160,05"), 16005);
  for (const text of [
    "",
    "abc",
    "-1",
    "1e9",
    "1.001",
    "1,2.3",
    "1000000001",
    "Infinity",
  ])
    assert.throws(() => parseMoney(text));
});
test("restoration replays sales instead of trusting cached totals or stock", () => {
  const paid = addItem(completeSale(basket(), cash), "demo-4");
  assert.deepEqual(restore(serialize(paid)), paid);
  const parsed = JSON.parse(serialize(paid));
  parsed.revenue = 9e15;
  parsed.stock = 999;
  parsed.sales[0].total = 1;
  parsed.sales[0].profit = 1;
  assert.deepEqual(restore(JSON.stringify(parsed)), paid);
  for (const invalid of [
    { version: 0, sales: [], cart: [] },
    { version: 1, sales: [], cart: [{ id: "unknown", qty: 1 }] },
    { version: 1, sales: [], cart: [{ id: "demo-0", qty: 1.5 }] },
    { version: 1, sales: [], cart: [{ id: "demo-0", qty: 13 }] },
    {
      version: 1,
      sales: [],
      cart: [
        { id: "demo-0", qty: 1 },
        { id: "demo-0", qty: 1 },
      ],
    },
    {
      version: 1,
      sales: [{ id: 999, method: "kaspi", items: [{ id: "demo-0", qty: 1 }] }],
      cart: [],
    },
    {
      version: 1,
      sales: [{ id: 174, method: "kaspi", items: [{ id: "demo-0", qty: 12 }] }],
      cart: [{ id: "demo-0", qty: 1 }],
    },
  ])
    assert.throws(() => restore(JSON.stringify(invalid)));
  assert.throws(() => restore("bad json"));
});
test("report history and weekly chart include the visitor's actual transaction", () => {
  const state = completeSale(basket(), cash);
  const last = chartDays(state).at(-1),
    first = history(state)[0];
  assert.equal(last.revenue, totals(state).revenue);
  assert.equal(last.receiptCount, 18);
  assert.equal(first.id, 174);
  assert.equal(first.demo, true);
  assert.equal(first.total, 4_055_000);
  assert.equal(history(state).length, 18);
  assert.equal(history(initialState()).length, 17);
});
