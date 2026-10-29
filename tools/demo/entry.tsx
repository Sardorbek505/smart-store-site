import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Sidebar } from "@app/components/Sidebar";
import { SalesPage } from "@app/routes/sales/SalesPage";
import { ProductsPage } from "@app/routes/products/ProductsPage";
import { DashboardPage } from "@app/routes/dashboard/DashboardPage";
import { AssistantPage } from "@app/routes/assistant/AssistantPage";
import { InvoiceDialog } from "@app/routes/purchases/InvoiceDialog";
import { PurchaseDialog } from "@app/routes/purchases/PurchaseDialog";
import { PromoPage } from "@app/routes/promo/PromoPage";
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
  makeDraft,
} from "./fixture.mjs";

const ok = (data: any) => Promise.resolve({ ok: true, data });
let draft = initialDraft;
let completedDemoSale: any = null;
(window as any).saleCaptureState = () => ({
  stock: catalog.map((p) => ({id:p.id, stockQty:p.stockQty})),
  today: {...today}, completed: completedDemoSale,
});
const tourCalls: string[] = [];
(window as any).demoTourCalls = tourCalls;
const supplier = { id: "demo-supplier", name: "Демо-поставщик" };
let purchase: any = null;
const invoiceLines = [0, 1].map((i) => ({
  productId: catalog[i].id, productName: catalog[i].name, unit: "pcs",
  id: "tour-line-"+i, qty: i === 0 ? 5000 : 50000,
  unitCost: i === 0 ? 1890000 : 38000,
  lineTotal: i === 0 ? 9450000 : 1900000,
  priceSell: catalog[i].priceSell, supplierCode: catalog[i].sku,
  unitCostCur: null, lineTotalCur: null,
}));
const preparedAnswer = {
  id: "tour-answer", at: NOW, model: "Демонстрационный ответ",
  question: "Что происходит с магазином?",
  facts: [{label:"Выручка сегодня",value:"396 950 ₸"},{label:"Чеков сегодня",value:"17"},{label:"Прибыль",value:"142 880 ₸"},{label:"Покупатели должны",value:"61 300 ₸"}],
  text: "За день оформлено 17 чеков на 396 950 ₸.\n\n- Прибыль — 142 880 ₸.\n- Покупатели должны 61 300 ₸. Посмотрите список должников и сроки возврата.",
};
const handlers: any = {
  "ai.ask": async () => { await new Promise(r=>setTimeout(r,900)); return preparedAnswer; },
  "ai.advise": async () => { await new Promise(r=>setTimeout(r,900)); return preparedAnswer; },
  "ai.invoiceToDraft": () => {
    purchase = {id:"tour-purchase",purchaseNo:null,supplierId:supplier.id,supplierName:supplier.name,supplierPaymentQr:null,docNo:"ДЕМО-014",docDate:NOW,total:11350000,comment:null,status:"draft",createdAt:NOW,postedAt:null,itemCount:2,currency:"KZT",fxRate:null,totalCur:0,debtCur:0,dueAt:null,items:invoiceLines};
    return purchase;
  },
  "purchases.get": () => purchase,
  "purchases.list": () => [],
  "purchases.post": () => {
    if(purchase.status!=="draft")throw new Error("Demo receipt already posted");
    purchase={...purchase,status:"posted",purchaseNo:14,postedAt:NOW};
    for(const line of invoiceLines)catalog.find(p=>p.id===line.productId)!.stockQty+=line.qty;
    return purchase;
  },
  "suppliers.list": () => [supplier],

  // Isolated marketing captures: synthetic facts, no Gemini call or database.
  "ai.status": () => ({
    provider: "gemini",
    model: "Demo capture",
    hasKey: true,
    encryptionAvailable: true,
  }),
  "ai.history": () =>
    new URLSearchParams(location.search).get("variant") !== "answer"
      ? []
      : [
          {
            id: "demo-answer",
            question: "Что происходит с магазином?",
            at: NOW,
            model: "Демонстрационный ответ",
            facts: [
              { label: "Выручка сегодня", value: "396 950 ₸" },
              { label: "Чеков сегодня", value: "17" },
              { label: "Прибыль", value: "142 880 ₸" },
              { label: "Покупатели должны", value: "61 300 ₸" },
            ],
            text: "За день оформлено 17 чеков на 396 950 ₸.\n\n- Прибыль — 142 880 ₸.\n- Покупатели должны 61 300 ₸. Посмотрите список должников и сроки возврата.",
          },
        ],
  "ai.suggestions": () => [
    { text: "Что происходит с магазином?", args: [] },
    { text: "Какие товары пора заказать?", args: [] },
    { text: "Кто должен вернуть деньги?", args: [] },
  ],
  "ai.readInvoice": () => ({
    supplierId: "demo-supplier",
    supplierName: "Демо-поставщик",
    docNo: "ДЕМО-014",
    docDate: NOW,
    currency: "KZT",
    fxRate: null,
    imageDataUrl: null,
    warnings: [],
    lines: [
      {
        index: 0,
        code: "MK-DF333",
        name: catalog[0].name,
        qty: 5000,
        unitCost: 1890000,
        match: { productId: catalog[0].id, name: catalog[0].name, by: "code" },
        candidates: [],
      },
      {
        index: 1,
        code: "CR-D125",
        name: catalog[1].name,
        qty: 50000,
        unitCost: 38000,
        match: { productId: catalog[1].id, name: catalog[1].name, by: "code" },
        candidates: [],
      },
    ],
  }),
  "promo.storyCandidates": () => [],

  "owner.state": () => ({ unlocked: true, pinSet: false }),
  "license.state": () => ({
    status: "trial",
    daysLeft: 14,
    canWrite: true,
    expiresAt: NOW + 14 * 86400000,
  }),
  "system.updateState": () => ({ status: "idle", currentVersion: "1.30.0" }),
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
  // An isolated cash sale for recording the released UI; no database or printer.
  "sales.complete": ({saleId,payment}: any) => {
    if (completedDemoSale) return completedDemoSale;
    if (saleId !== draft.id || !draft.items.length) throw new Error("Empty demo sale");
    if (payment.cash + payment.kaspi + payment.debt !== draft.total) throw new Error("Demo payment mismatch");
    const costTotal = draft.items.reduce((sum,line) => sum + line.unitCost * line.qty / 1000, 0);
    const profit = draft.total - costTotal;
    completedDemoSale = {...draft,id:"demo-completed-18",status:"completed",saleNo:18,
      costTotal,profit,paidCash:payment.cash,paidKaspi:payment.kaspi,paidDebt:payment.debt,
      cashReceived:payment.cashReceived,changeGiven:payment.cashReceived-payment.cash,completedAt:NOW};
    for (const line of draft.items) catalog.find(p=>p.id===line.productId)!.stockQty -= line.qty;
    ledger.push({id:completedDemoSale.id,at:NOW,lines:draft.items.map(l=>({productId:l.productId,qty:l.qty})),revenue:draft.total,profit,method:"cash"});
    for (const total of [today,dashboard.sales14Days[dashboard.sales14Days.length-1]]) {
      total.grossSales += draft.total; total.revenue += draft.total; total.profit += profit;
      total.receiptCount += 1; total.averageReceipt = Math.round(total.revenue / total.receiptCount);
    }
    draft = {...makeDraft([]),id:"demo-next-draft"};
    return completedDemoSale;
  },
  "sales.receipt": () => null,
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
  "ai",
  "promo",
  "owner",
  "license",
  "system",
  "fx",
  "products",
  "catalog",
  "photos",
  "sales",
  "reports",
  "purchases",
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
        async (...args: any[]) => {
          const name = namespace + "." + String(key);
          if (!handlers[name]) {
            console.warn("Unimplemented demo API: " + name);
            return ok(null);
          }
          tourCalls.push(name);
          return ok(await handlers[name](...args));
        },
    },
  );
(window as any).api = api;
function Demo() {
  const initial = new URLSearchParams(location.search).get("screen") || "sales";
  const [tab, setTab] = useState(initial);
  const [purchaseId, setPurchaseId] = useState<string | null>(null);
  const noop = () => {};
  return (
    <div className="app-bg flex min-h-full">
      {new URLSearchParams(location.search).has("sale-tour") && <div style={{position:"fixed",bottom:10,left:10,zIndex:10000,padding:"7px 12px",background:"#111827",color:"white",borderRadius:8,fontSize:12}}>ДЕМОДАННЫЕ · ЗАПИСЬ ИНТЕРФЕЙСА</div>}
      {new URLSearchParams(location.search).has("tour") && <div style={{position:"fixed",bottom:12,left:12,zIndex:10000,padding:"8px 14px",background:"#111827",color:"white",borderRadius:10,fontSize:13}}>Демоданные · AI-результаты подготовлены</div>}
      <Sidebar
        tab={(tab === "backups" ? "system" : tab) as any}
        onGo={setTab as any}
        onShortcuts={noop}
      />
      <main className="min-w-0 flex-1 pt-6 pr-7 pb-8 pl-3">
        {tab === "assistant" ? (
          <AssistantPage
            onInvoice={() => setTab("invoice")}
            onOpenPurchase={noop}
            onSlow={noop}
            onDebts={noop}
          />
        ) : tab === "invoice" ? (
          <>
            <h1 className="text-2xl">Приход</h1>
            <InvoiceDialog
              suppliers={[
                { id: "demo-supplier", name: "Демо-поставщик" } as any,
              ]}
              onClose={() => setTab("assistant")}
              onCreated={(id) => {setPurchaseId(id);setTab("purchase");}}
            />
          </>
        ) : tab === "purchase" && purchaseId ? (
          <PurchaseDialog purchaseId={purchaseId} suppliers={[supplier] as any} onClose={() => setTab("products")} />
        ) : tab === "promo" ? (
          <PromoPage />
        ) : tab === "sales" ? (
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
