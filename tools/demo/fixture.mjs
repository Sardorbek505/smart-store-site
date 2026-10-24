// One isolated demonstration store. Money is in tiyn, quantities in thousandths.
export const NOW = Date.parse("2026-10-24T12:30:00Z");
export const DAY = 86_400_000;
export const STORE = "МАСТЕР";
const rows = [
  [
    "Шуруповёрт 18 В",
    39900,
    18900,
    12,
    "MK-DF333",
    "Электроинструмент",
    "Makita",
    "drill",
  ],
  [
    "Диск отрезной 125×1,2",
    650,
    380,
    240,
    "CR-D125",
    "Оснастка",
    "CROWN",
    "disc",
  ],
  [
    "Дрель ударная CT10128",
    28900,
    21400,
    6,
    "CR-10128",
    "Электроинструмент",
    "CROWN",
    null,
  ],
  [
    "Болгарка 125 мм 900 Вт",
    42300,
    33800,
    5,
    "BS-GWS900",
    "Электроинструмент",
    "Bosch",
    null,
  ],
  [
    "Бур SDS-plus 8×210",
    1850,
    1220,
    38,
    "MK-B8210",
    "Оснастка",
    "Makita",
    "bit",
  ],
  [
    "Ключ разводной 250 мм",
    4900,
    3100,
    11,
    "RU-KR250",
    "Ручной инструмент",
    null,
    null,
  ],
  [
    "Молоток слесарный 500 г",
    3200,
    1950,
    9,
    "RU-ML500",
    "Ручной инструмент",
    null,
    "hammer",
  ],
  [
    "Набор отвёрток 6 шт",
    5600,
    3700,
    7,
    "RU-OT6",
    "Ручной инструмент",
    null,
    null,
  ],
  [
    "Перфоратор SDS-plus CT18014",
    54500,
    41200,
    3,
    "CR-18014",
    "Электроинструмент",
    "CROWN",
    null,
  ],
  [
    "Сверла по металлу, набор 19 шт",
    12400,
    8900,
    14,
    "BS-HSS19",
    "Оснастка",
    "Bosch",
    null,
  ],
];
export const catalog = rows.map(
  ([name, price, cost, stock, sku, categoryName, brandName, photo], i) => ({
    id: `demo-${i}`,
    name,
    priceSell: price * 100,
    costAvg: cost * 100,
    stockQty: stock * 1000,
    minQty: 3000,
    sku,
    categoryId: `category-${["Электроинструмент", "Оснастка", "Ручной инструмент"].indexOf(categoryName)}`,
    categoryName,
    brandName,
    brandId: brandName,
    unit: "pcs",
    priceWholesale: Math.round(price * 0.92) * 100,
    markupPct: null,
    isRentable: false,
    isArchived: false,
    photo,
  }),
);
const recipes = [
  [
    [0, 1],
    [1, 1],
  ],
  [
    [2, 1],
    [4, 2],
  ],
  [[1, 10]],
  [[3, 1]],
  [
    [6, 2],
    [7, 1],
  ],
  [
    [5, 1],
    [9, 1],
  ],
  [
    [0, 1],
    [4, 1],
  ],
  [
    [1, 5],
    [4, 3],
  ],
  [[8, 1]],
  [
    [6, 1],
    [5, 1],
  ],
  [
    [9, 1],
    [1, 4],
  ],
  [[7, 2]],
  [
    [2, 1],
    [6, 1],
  ],
  [[4, 5]],
  [
    [0, 1],
    [1, 2],
  ],
  [
    [5, 2],
    [7, 1],
  ],
  [
    [1, 8],
    [6, 1],
  ],
];
export const ledger = [];
for (let ago = 13; ago >= 0; ago--) {
  const count = ago === 0 ? 17 : 8 + ((ago * 7) % 9);
  for (let i = 0; i < count; i++) {
    const lines = recipes[(i + ago * 3) % recipes.length].map(
      ([index, qty]) => ({ productId: catalog[index].id, qty: qty * 1000 }),
    );
    const revenue = lines.reduce(
      (s, l) =>
        s +
        (catalog.find((p) => p.id === l.productId).priceSell * l.qty) / 1000,
      0,
    );
    const profit = lines.reduce(
      (s, l) =>
        s +
        ((catalog.find((p) => p.id === l.productId).priceSell -
          catalog.find((p) => p.id === l.productId).costAvg) *
          l.qty) /
          1000,
      0,
    );
    const method = ["cash", "kaspi", "kaspi", "cash", "debt"][i % 5];
    ledger.push({
      id: `sale-${ago}-${i}`,
      at: Date.UTC(2026, 9, 24 - ago, 5 + (i % 7), i * 2),
      lines,
      revenue,
      profit,
      method,
    });
  }
}
export const period = {
  from: Date.parse("2026-10-23T19:00:00Z"),
  to: Date.parse("2026-10-24T19:00:00Z"),
  timeZone: "Asia/Almaty",
};
export const summary = (sales) => {
  const revenue = sales.reduce((s, r) => s + r.revenue, 0),
    profit = sales.reduce((s, r) => s + r.profit, 0);
  return {
    grossSales: revenue,
    refunds: 0,
    revenue,
    profit,
    receiptCount: sales.length,
    averageReceipt: sales.length ? Math.round(revenue / sales.length) : 0,
    debtShipped: sales
      .filter((r) => r.method === "debt")
      .reduce((s, r) => s + r.revenue, 0),
    discounts: 0,
  };
};
export const selectSales = (range = period) =>
  ledger.filter((r) => r.at >= range.from && r.at < range.to);
export const today = summary(selectSales());
export const yesterday = summary(
  selectSales({ from: period.from - DAY, to: period.to - DAY }),
);
export const daily = Array.from({ length: 14 }, (_, i) => {
  const ago = 13 - i,
    from = period.from - ago * DAY,
    key = new Date(from + 8 * 3600000).toISOString().slice(0, 10);
  return { key, ...summary(selectSales({ from, to: from + DAY })) };
});
export const dashboard = {
  date: "2026-10-24",
  asOf: NOW,
  period,
  today,
  comparisons: {
    todayVsYesterday: { current: today, previous: yesterday },
    monthVsPreviousMonth: {
      current: summary(ledger),
      previous: summary(ledger.slice(0, 70)),
    },
  },
  sales14Days: daily,
  stock: { low: 1, out: 0, items: [] },
  rentals: { active: 0, dueToday: 0, overdue: 0, items: [] },
};
export const categories = (range) => {
  const sales = selectSales(range);
  const items = ["Электроинструмент", "Оснастка", "Ручной инструмент"].map(
    (name, index) => {
      let revenue = 0,
        profit = 0;
      for (const sale of sales)
        for (const line of sale.lines) {
          const p = catalog.find((p) => p.id === line.productId);
          if (p.categoryName === name) {
            revenue += (p.priceSell * line.qty) / 1000;
            profit += ((p.priceSell - p.costAvg) * line.qty) / 1000;
          }
        }
      return { categoryId: `category-${index}`, name, revenue, profit };
    },
  );
  return { period: range, summary: summary(sales), items };
};
export const payments = (range) => {
  const sales = selectSales(range),
    methods = ["cash", "kaspi"].map((method) => {
      const net = sales
        .filter((s) => s.method === method)
        .reduce((a, s) => a + s.revenue, 0);
      return { method, received: net, returned: 0, net };
    });
  const net = methods.reduce((s, m) => s + m.net, 0);
  return {
    period: range,
    tradeProfit: summary(sales).profit,
    debtShipped: summary(sales).debtShipped,
    total: { received: net, returned: 0, net },
    methods,
    kinds: [],
  };
};
export const makeDraft = (spec) => {
  const items = spec.map(([index, qty], i) => {
    const p = catalog[index];
    return {
      id: `line-${i}`,
      productId: p.id,
      nameSnapshot: p.name,
      qty: qty * 1000,
      unitPrice: p.priceSell,
      listPrice: p.priceSell,
      unitCost: p.costAvg,
      lineTotal: p.priceSell * qty,
      stockQty: p.stockQty,
      unit: p.unit,
    };
  });
  const total = items.reduce((s, l) => s + l.lineTotal, 0);
  return {
    id: "demo-draft",
    status: "draft",
    saleNo: null,
    customerId: null,
    priceKind: "retail",
    subtotal: total,
    total,
    discount: 0,
    createdAt: NOW,
    updatedAt: NOW,
    items,
  };
};
export const draft = makeDraft([
  [0, 2],
  [1, 1],
  [4, 1],
]);
export const mobileDraft = makeDraft([
  [0, 1],
  [1, 1],
]);
export const money = (value) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 })
    .format(value / 100)
    .replaceAll("\u00a0", " ") + " ₸";
export const phoneSummary = () => ({
  period: "today",
  title: "Сегодня",
  revenue: money(today.revenue),
  profit: money(today.profit),
  receipts: String(today.receiptCount),
  average: money(today.averageReceipt),
  previous: {
    label: "вчера",
    revenue: money(yesterday.revenue),
    delta: `+${Math.round((today.revenue / yesterday.revenue - 1) * 100)} %`,
    same: false,
  },
  changes: Object.fromEntries(
    ["revenue", "profit", "receiptCount", "averageReceipt"].map((key, i) => [
      ["revenue", "profit", "receipts", "average"][i],
      Math.round((today[key] / yesterday[key] - 1) * 100),
    ]),
  ),
  days: daily.map((d, i) => ({
    label: d.key.slice(8),
    revenue: d.revenue,
    profit: d.profit,
    text: `${d.key}: ${money(d.revenue)}`,
    isToday: i === 13,
  })),
  owedKzt: money(4500000),
  owedUsd: 0,
  owedUsdText: "",
  owedToUs: money(today.debtShipped),
  lowStock: 1,
  rentalsOverdue: 0,
});
