import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Sidebar } from "@app/components/Sidebar";
import { SalesPage } from "@app/routes/sales/SalesPage";
import { ProductsPage } from "@app/routes/products/ProductsPage";
import { DashboardPage } from "@app/routes/dashboard/DashboardPage";
import { BackupsPanel } from "@app/routes/system/BackupsPanel";
import {
  catalog,
  NOW,
  STORE,
  dashboard,
  categories,
  payments,
  ledger,
  today,
  draft as initialDraft,
} from "./fixture.mjs";

const ok = (data: any) => Promise.resolve({ ok: true, data });
let draft = initialDraft;
const handlers: any = {
  "owner.state": () => ({ unlocked: true, pinSet: false }),
  "license.state": () => ({
    status: "trial",
    daysLeft: 14,
    canWrite: true,
    expiresAt: NOW + 14 * 86400000,
  }),
  "system.updateState": () => ({ status: "idle", currentVersion: "1.29.4" }),
  "system.scannerEnabled": () => true,
  "system.storeDetails": () => ({
    name: STORE,
    bin: "",
    address: "Демонстрационный магазин",
    phone: "",
  }),
  "fx.state": () => ({
    current: {
      id: "demo-fx",
      rate: 51025,
      source: "manual",
      rateDate: "2026-10-24",
      fetchedAt: NOW,
    },
    autoUpdate: false,
    lastError: null,
  }),
  "products.frequent": () => [0, 1, 4, 6].map((i) => catalog[i]),
  "products.search": (query: any) => {
    const items = query.incomplete
      ? []
      : catalog.filter(
          (p) =>
            !query.q || p.name.toLowerCase().includes(query.q.toLowerCase()),
        );
    return {
      items: items.map((p) => ({ ...p, matchKind: "text" })),
      total: items.length,
      usedFallback: false,
    };
  },
  "products.prices": (id: string) => {
    const p = catalog.find((p) => p.id === id)!;
    return { retail: p.priceSell, wholesale: p.priceWholesale };
  },
  "products.get": (id: string) => ({
    ...catalog.find((p) => p.id === id),
    specs: "18 В · 2 А·ч · кейс в комплекте",
    barcodes: [],
    supplierCodes: [],
    createdAt: NOW,
    updatedAt: NOW,
  }),
  "catalog.list": (kind: string) =>
    (kind === "category"
      ? ["Электроинструмент", "Оснастка", "Ручной инструмент"]
      : ["Makita", "CROWN", "Bosch"]
    ).map((name, i) => ({
      id: kind === "category" ? `category-${i}` : name,
      name,
    })),
  "photos.get": (id: string) => {
    const p = catalog.find((p) => p.id === id);
    return p?.photo ? `/products/${p.photo}.webp` : null;
  },
  "sales.heldList": () => [],
  "sales.list": () => ({ items: ledger.slice(-5), total: ledger.length }),
  "sales.draftGet": () => draft,
  "sales.addItem": ({ productId }: any) => {
    const p = catalog.find((p) => p.id === productId)!;
    const line = draft.items.find((l) => l.productId === productId);
    if (line) {
      line.qty += 1000;
      line.lineTotal += p.priceSell;
    } else
      draft.items.push({
        id: "added-" + productId,
        productId,
        nameSnapshot: p.name,
        qty: 1000,
        unitPrice: p.priceSell,
        listPrice: p.priceSell,
        unitCost: p.costAvg,
        lineTotal: p.priceSell,
        stockQty: p.stockQty,
        unit: p.unit,
      });
    draft = {
      ...draft,
      total: draft.items.reduce((s, l) => s + l.lineTotal, 0),
    };
    draft.subtotal = draft.total;
    return draft;
  },
  "reports.dashboard": () => dashboard,
  "reports.categories": categories,
  "reports.payments": payments,
  "reports.sales": () => ({ points: dashboard.sales14Days }),
  "backup.status": () => ({
    directory: "Демо / Копии",
    cloudDirectory: "Демо / Внешняя копия",
    error: null,
    usbDirectory: "",
    usbLastAt: NOW,
    cloudFolders: [],
    diskFreeBytes: 82_000_000_000,
    records: [
      {
        id: "backup-1",
        path: "demo",
        sizeBytes: 2457600,
        kind: "auto",
        createdAt: NOW - 3600000,
      },
    ],
  }),
  "suppliers.debtSummary": () => ({
    totals: { kzt: 4500000, usd: 0 },
    suppliers: [
      {
        supplierId: "demo-supplier",
        supplierName: "ТОО «Мастер Снаб»",
        debt: { kzt: 4500000, usd: 0 },
      },
    ],
    due: [],
    remindDays: 3,
  }),
  "customers.debtList": () => [
    {
      customerId: "demo-client",
      name: "Бригада «Мастер»",
      debtBalance: today.debtShipped,
    },
  ],
  "customers.search": () => [
    {
      id: "demo-client",
      name: "Бригада «Мастер»",
      phone: null,
      debtBalance: today.debtShipped,
    },
  ],
};
const namespaces = [
  "owner",
  "license",
  "system",
  "fx",
  "products",
  "catalog",
  "photos",
  "sales",
  "reports",
  "backup",
  "suppliers",
  "customers",
];
const api: any = { events: new Proxy({}, { get: () => () => () => {} }) };
for (const namespace of namespaces)
  api[namespace] = new Proxy(
    {},
    {
      get:
        (_, key) =>
        (...args: any[]) => {
          const name = namespace + "." + String(key);
          if (!handlers[name]) {
            console.warn("Unimplemented demo API: " + name);
            return ok(null);
          }
          return ok(handlers[name](...args));
        },
    },
  );
(window as any).api = api;
function Demo() {
  const initial = new URLSearchParams(location.search).get("screen") || "sales";
  const [tab, setTab] = useState(initial);
  const noop = () => {};
  return (
    <div className="app-bg flex min-h-full">
      <Sidebar
        tab={(tab === "backups" ? "system" : tab) as any}
        onGo={setTab as any}
        onShortcuts={noop}
      />
      <main className="min-w-0 flex-1 pt-6 pr-7 pb-8 pl-3">
        {tab === "sales" ? (
          <SalesPage />
        ) : tab === "backups" ? (
          <BackupsPanel />
        ) : tab === "products" ? (
          <ProductsPage />
        ) : (
          <DashboardPage
            onSale={() => setTab("sales")}
            onProduct={() => setTab("products")}
            onPurchase={noop}
            onInventory={noop}
            onWriteoff={noop}
            onCustomer={noop}
            onSupplier={noop}
            onStock={noop}
            onRentals={noop}
            onSystem={noop}
          />
        )}
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<Demo />);
