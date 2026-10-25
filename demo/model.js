// Same isolated store as the landing screenshots. Money stays in integer tiyn.
import {
  catalog,
  ledger,
  today,
  daily,
  selectSales,
  NOW,
} from "../tools/demo/fixture.mjs";

export const PRODUCTS = Object.freeze(
  catalog.map((p) =>
    Object.freeze({
      id: p.id,
      name: p.name,
      sku: p.sku,
      category: p.categoryName,
      brand: p.brandName,
      price: p.priceSell,
      cost: p.costAvg,
      initialStock: p.stockQty / 1000,
      photo: p.photo,
    }),
  ),
);
export const CUSTOMERS = Object.freeze([
  "Бригада «Мастер»",
  "Мастерская «Орбита»",
]);
export const METHODS = Object.freeze({
  cash: "Наличные",
  kaspi: "Kaspi",
  debt: "В долг",
});
export const BASELINE = Object.freeze({ ...today });
export const MAX_SALES = 500;
const product = (id) => PRODUCTS.find((p) => p.id === id);
const fail = (message) => {
  throw new Error(message);
};
export const initialState = () => ({ cart: [], sales: [] });
export const stock = (state, id) => {
  const p = product(id);
  if (!p) return 0;
  return (
    p.initialStock -
    state.sales.reduce(
      (sum, sale) =>
        sum +
        sale.items
          .filter((line) => line.id === id)
          .reduce((s, l) => s + l.qty, 0),
      0,
    )
  );
};
export const cartLines = (state) =>
  state.cart.map((l) => ({
    ...product(l.id),
    qty: l.qty,
    total: product(l.id).price * l.qty,
  }));
export const cartTotal = (state) =>
  cartLines(state).reduce((sum, l) => sum + l.total, 0);
export function setQuantity(state, id, qty) {
  if (!product(id)) fail("Этот товар не найден.");
  if (!Number.isSafeInteger(qty) || qty < 1)
    fail("Количество должно быть целым числом от 1.");
  if (qty > stock(state, id))
    fail(`На складе осталось ${stock(state, id)} шт. Уменьшите количество.`);
  const found = state.cart.some((l) => l.id === id);
  return {
    ...state,
    cart: found
      ? state.cart.map((l) => (l.id === id ? { id, qty } : l))
      : [...state.cart, { id, qty }],
  };
}
export const addItem = (state, id) =>
  setQuantity(state, id, (state.cart.find((l) => l.id === id)?.qty || 0) + 1);
export const removeItem = (state, id) => ({
  ...state,
  cart: state.cart.filter((l) => l.id !== id),
});
export const clearCart = (state) => ({ ...state, cart: [] });
export function parseMoney(raw) {
  const value = String(raw).replace(/[\s\u00a0\u202f]/g, "");
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value))
    fail("Введите сумму цифрами, например 50 000.");
  const [whole, fraction = ""] = value.split(/[.,]/);
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount > 100_000_000_000)
    fail("Введите сумму до 1 000 000 000 ₸.");
  return amount;
}
export function completeSale(state, payment) {
  if (!state.cart.length) fail("Сначала добавьте товар в чек.");
  if (state.sales.length >= MAX_SALES)
    fail("Демо заполнено. Сбросьте его, чтобы начать снова.");
  if (!Object.hasOwn(METHODS, payment.method)) fail("Выберите способ оплаты.");
  for (const line of state.cart) setQuantity(state, line.id, line.qty);
  const total = cartTotal(state);
  const given = payment.method === "cash" ? payment.given : total;
  if (!Number.isSafeInteger(given) || given < total || given > 100_000_000_000)
    fail("Полученная сумма меньше итога чека. Проверьте сумму.");
  if (payment.method === "debt" && !CUSTOMERS.includes(payment.customer))
    fail("Выберите учебного покупателя.");
  const sale = {
    id: ledger.length + state.sales.length + 1,
    items: state.cart.map((l) => ({ ...l })),
    method: payment.method,
    given,
    customer: payment.method === "debt" ? payment.customer : null,
  };
  return { cart: [], sales: [...state.sales, sale] };
}
export function saleDetails(sale) {
  const items = sale.items.map((l) => ({
    ...product(l.id),
    qty: l.qty,
    total: product(l.id).price * l.qty,
  }));
  const total = items.reduce((s, l) => s + l.total, 0);
  const profit = items.reduce((s, l) => s + (l.price - l.cost) * l.qty, 0);
  return {
    ...sale,
    items,
    total,
    profit,
    change: sale.method === "cash" ? sale.given - total : 0,
    at: NOW + (sale.id - ledger.length) * 60_000,
  };
}
export function totals(state) {
  const result = { ...BASELINE, cash: 0, kaspi: 0 };
  for (const sale of selectSales()) {
    if (sale.method === "cash" || sale.method === "kaspi")
      result[sale.method] += sale.revenue;
  }
  for (const saved of state.sales) {
    const sale = saleDetails(saved);
    result.revenue += sale.total;
    result.profit += sale.profit;
    result.receiptCount += 1;
    if (sale.method === "debt") result.debtShipped += sale.total;
    else result[sale.method] += sale.total;
  }
  result.received = result.cash + result.kaspi;
  result.averageReceipt = Math.round(result.revenue / result.receiptCount);
  return result;
}
export function chartDays(state) {
  const result = daily.slice(-7).map((d) => ({ ...d }));
  Object.assign(result[result.length - 1], totals(state));
  return result;
}
export function history(state) {
  const base = selectSales().map((s) => ({
    id: ledger.indexOf(s) + 1,
    at: s.at,
    total: s.revenue,
    method: s.method,
    count: s.lines.length,
    demo: false,
  }));
  return [
    ...base,
    ...state.sales.map((s) => ({
      ...saleDetails(s),
      count: s.items.length,
      demo: true,
    })),
  ].sort((a, b) => b.at - a.at);
}
// Replaying prevents corrupted storage from inventing money, duplicates or stock.
export function restore(raw) {
  const parsed = JSON.parse(raw);
  if (
    parsed?.version !== 1 ||
    !Array.isArray(parsed.sales) ||
    !Array.isArray(parsed.cart) ||
    parsed.sales.length > MAX_SALES
  )
    fail("Демо-данные не удалось восстановить.");
  let state = initialState();
  const fill = (lines) => {
    if (lines.length > PRODUCTS.length) fail("Некорректный чек.");
    const ids = new Set();
    for (const line of lines) {
      if (ids.has(line.id)) fail("Товар повторяется в чеке.");
      ids.add(line.id);
      state = setQuantity(state, line.id, line.qty);
    }
  };
  for (const saved of parsed.sales) {
    if (
      !Array.isArray(saved.items) ||
      saved.id !== ledger.length + state.sales.length + 1
    )
      fail("Некорректная продажа.");
    fill(saved.items);
    state = completeSale(state, saved);
  }
  fill(parsed.cart);
  return state;
}
export const serialize = (state) => JSON.stringify({ version: 1, ...state });
