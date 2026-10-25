import {
  PRODUCTS,
  CUSTOMERS,
  METHODS,
  BASELINE,
  initialState,
  stock,
  cartLines,
  cartTotal,
  setQuantity,
  addItem,
  removeItem,
  clearCart,
  parseMoney,
  completeSale,
  saleDetails,
  totals,
  chartDays,
  history,
  restore,
  serialize,
} from "./model.js";

const $ = (id) => document.getElementById(id);
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const icon = (name) =>
  `<svg class="icon" aria-hidden="true"><use href="#i-${name}" /></svg>`;
const number = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const money = (cents) => `${number.format(cents / 100)} ₸`;
const time = (at) =>
  new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Almaty",
  }).format(at);
const KEY = "smart-store:public-demo:v1";
let state = initialState();
let storageAvailable = true;
let processing = false;
let resultOpener = null;
const route = () =>
  ["sale", "stock", "reports"].includes(location.hash.slice(1))
    ? location.hash.slice(1)
    : "sale";
const announce = (text) => {
  $("demo-notice").textContent = text;
};
const storageWarning = () => {
  storageAvailable = false;
  $("storage-note").hidden = false;
  $("storage-note").textContent =
    "Демо работает. Браузер не разрешил сохранить прогресс — после обновления страницы он начнётся заново.";
};
function persist(next) {
  state = next;
  if (storageAvailable)
    try {
      sessionStorage.setItem(KEY, serialize(state));
    } catch {
      storageWarning();
    }
}
const matches = (p, query) =>
  `${p.name} ${p.sku} ${p.brand || ""}`
    .toLocaleLowerCase("ru")
    .replaceAll("ё", "е")
    .includes(query.trim().toLocaleLowerCase("ru").replaceAll("ё", "е"));
const inCart = (id) => state.cart.find((l) => l.id === id)?.qty || 0;
const saleFocusTarget = () =>
  matchMedia("(pointer: coarse), (max-width: 900px)").matches
    ? $("page-title")
    : $("product-search");
function renderProducts() {
  const query = $("product-search").value;
  const category = $("category-filter").value;
  const list = PRODUCTS.filter(
    (p) => matches(p, query) && (!category || p.category === category),
  ).sort((a, b) => Number(Boolean(b.photo)) - Number(Boolean(a.photo)));
  $("clear-search").hidden = !query;
  $("product-count").textContent =
    `Найдено: ${list.length} из ${PRODUCTS.length}`;
  $("product-grid").innerHTML = list.length
    ? list
        .map((p) => {
          const qty = inCart(p.id),
            remaining = stock(state, p.id),
            available = remaining - qty;
          return `<article class="product-card ${qty ? "in-cart" : ""}" data-product="${p.id}">
      <div class="product-art ${p.photo ? "has-photo" : ""}">${icon("tool")}${p.photo ? `<img class="product-photo" src="../img/demo/products/${p.photo}.webp" alt="" width="256" height="192" decoding="async" />` : ""}${qty ? `<span class="selected-mark">${icon("check")} В чеке: ${qty}</span>` : ""}</div>
      <div class="product-info"><p class="product-category">${escape(p.category)}</p><h3>${escape(p.name)}</h3><span class="product-sku">${escape(p.sku)}</span><strong class="product-price">${money(p.price)}</strong><p class="product-stock ${remaining <= 3 ? "low-stock" : ""}">${remaining ? `На складе: ${remaining} шт` : "Нет в наличии"}</p>
      <button type="button" class="add-button" data-action="add" data-id="${p.id}" data-focus="add-${p.id}" aria-label="Добавить: ${escape(p.name)}" ${available <= 0 ? "disabled" : ""}>${available <= 0 ? (remaining ? "Весь остаток в чеке" : "Нет в наличии") : `Добавить ${icon("plus")}`}</button></div>
    </article>`;
        })
        .join("")
    : `<div class="empty-search"><span class="empty-symbol">${icon("search")}</span><h3>Товар не найден.</h3><p>Попробуйте другое название, артикул или категорию.</p><button class="secondary-button" type="button" data-action="clear-filters">Сбросить поиск</button></div>`;
}
function cartHTML(context) {
  const lines = cartLines(state),
    total = cartTotal(state);
  const units = lines.reduce((sum, l) => sum + l.qty, 0);
  return `<div class="receipt-heading"><h2>${context === "desktop" ? "Новый чек" : "Товары в чеке"}</h2><span>${lines.length} поз.</span>${lines.length ? `<button class="icon-button" type="button" data-action="clear-cart" aria-label="Очистить чек" title="Очистить чек">${icon("reset")}</button>` : ""}</div>
    <div class="cart-lines">${lines.length ? lines.map((l) => `<article class="cart-line" data-cart-product="${l.id}"><div class="cart-line-top"><h3>${escape(l.name)}</h3><button type="button" class="icon-button remove-item" data-action="remove" data-id="${l.id}" aria-label="Убрать: ${escape(l.name)}">${icon("close")}</button></div><span class="muted">${money(l.price)} за шт</span><div class="cart-line-bottom"><div class="quantity"><button type="button" data-action="minus" data-id="${l.id}" data-focus="${context}-minus-${l.id}" aria-label="Уменьшить: ${escape(l.name)}" ${l.qty === 1 ? "disabled" : ""}>${icon("minus")}</button><output aria-label="Количество: ${escape(l.name)}">${l.qty}</output><button type="button" data-action="add" data-id="${l.id}" data-focus="${context}-plus-${l.id}" aria-label="Увеличить: ${escape(l.name)}" ${l.qty >= stock(state, l.id) ? "disabled" : ""}>${icon("plus")}</button></div><strong>${money(l.total)}</strong></div></article>`).join("") : `<div class="empty-cart"><span class="empty-symbol">${icon("sale")}</span><h3>Первый товар — за вами.</h3><p>Нажмите «Добавить» у любого товара.</p></div>`}</div>
    <div class="receipt-total"><div class="receipt-quantity"><span>Единиц товара</span><span>${units}</span></div><div class="total-line"><span>Итого</span><strong>${money(total)}</strong></div><button type="button" id="open-payment-${context}" class="primary-button" data-action="pay" ${!lines.length ? "disabled" : ""}>Выбрать оплату ${icon("arrow")}</button><p class="receipt-note">Учебная продажа. Деньги не списываются.</p></div>`;
}
function renderCart() {
  $("cart-desktop").innerHTML = cartHTML("desktop");
  $("cart-mobile").innerHTML = cartHTML("mobile");
  const count = state.cart.reduce((s, l) => s + l.qty, 0);
  $("cart-toggle").hidden = count === 0;
  document.body.classList.toggle("has-cart", count > 0);
  $("cart-badge").textContent = count;
  $("cart-toggle-count").textContent = count
    ? `${state.cart.length} поз. · ${count} шт`
    : "Добавьте первый товар";
  $("cart-toggle-total").textContent = money(cartTotal(state));
}
function renderStock() {
  const sold = state.sales.reduce(
    (s, sale) => s + sale.items.reduce((n, l) => n + l.qty, 0),
    0,
  );
  $("stock-stats").innerHTML = [
    ["Товаров", PRODUCTS.length],
    ["На складе, шт", PRODUCTS.reduce((s, p) => s + stock(state, p.id), 0)],
    ["Вы продали, шт", sold],
  ]
    .map(
      ([label, value]) =>
        `<div class="surface stock-stat"><span>${label}</span><strong>${number.format(value)}</strong></div>`,
    )
    .join("");
  const products = PRODUCTS.filter((p) =>
    matches(p, $("stock-search").value),
  ).sort((a, b) =>
    $("stock-sort").value === "low"
      ? stock(state, a.id) - stock(state, b.id)
      : a.name.localeCompare(b.name, "ru"),
  );
  $("inventory").innerHTML = products.length
    ? `<table><caption class="sr-only">Товары, цены и текущие остатки</caption><thead><tr><th scope="col">Товар</th><th scope="col">Цена</th><th scope="col">Остаток</th></tr></thead><tbody>${products
        .map((p) => {
          const current = stock(state, p.id),
            changed = current !== p.initialStock;
          return `<tr data-stock-product="${p.id}"><td><div class="inventory-product"><span class="inventory-symbol">${icon("stock")}</span><div><strong>${escape(p.name)}</strong><small>${escape(p.sku)}</small></div></div></td><td>${money(p.price)}</td><td class="stock-value ${changed ? "changed-stock" : ""}"><strong data-stock-qty>${current} шт</strong>${changed ? `<small>Было ${p.initialStock} шт</small>` : current <= 3 ? "<small>Мало на складе</small>" : ""}</td></tr>`;
        })
        .join("")}</tbody></table>`
    : `<div class="empty-search"><h3>На складе не найдено.</h3><p>Попробуйте другое название или артикул.</p></div>`;
}
function renderReports() {
  const t = totals(state);
  const cards = [
    ["Выручка", money(t.revenue), t.revenue - BASELINE.revenue, "revenue"],
    ["Торговая прибыль", money(t.profit), t.profit - BASELINE.profit, "profit"],
    ["Чеков за день", String(t.receiptCount), state.sales.length, "receipts"],
    [
      "Продано в долг",
      money(t.debtShipped),
      t.debtShipped - BASELINE.debtShipped,
      "debt",
    ],
  ];
  $("report-metrics").innerHTML = cards
    .map(
      ([label, value, delta, key], i) =>
        `<div class="metric ${i === 0 ? "metric-accent" : "surface"}"><span>${label}</span><strong data-metric="${key}">${value}</strong><small>${delta ? `+${key === "receipts" ? delta : money(delta)} после ваших продаж` : "До ваших продаж в демо"}</small></div>`,
    )
    .join("");
  const days = chartDays(state),
    max = Math.max(...days.map((d) => d.revenue));
  $("revenue-chart").innerHTML =
    `<div class="chart-bars" role="img" aria-label="Выручка за семь учебных дней. 24 октября: ${money(t.revenue)}. Точные значения в таблице ниже.">${days.map((d, i) => `<div class="chart-column ${i === days.length - 1 ? "current-day" : ""}" aria-hidden="true"><span class="chart-bar" style="--bar-height:${Math.max(4, Math.round((d.revenue / max) * 100))}%"></span><span>${d.key.slice(8)}</span></div>`).join("")}</div><details class="chart-data"><summary>Данные по дням</summary><table><thead><tr><th scope="col">Октябрь</th><th scope="col">Выручка</th><th scope="col">Прибыль</th></tr></thead><tbody>${days.map((d) => `<tr><th scope="row">${d.key.slice(8)}</th><td>${money(d.revenue)}</td><td>${money(d.profit)}</td></tr>`).join("")}</tbody></table></details>`;
  $("payment-totals").innerHTML =
    [
      ["Наличные", t.cash, "cash"],
      ["Kaspi", t.kaspi, "kaspi"],
      ["Записано в долг", t.debtShipped, "debt"],
    ]
      .map(
        ([label, value, key]) =>
          `<div class="payment-row"><div><span>${label}</span><strong data-payment="${key}">${money(value)}</strong></div><span class="payment-bar ${key}" aria-hidden="true" style="--payment-width:${Math.round((value / t.revenue) * 100)}%"></span></div>`,
      )
      .join("") +
    `<div class="received-total"><span>Получено денег</span><strong data-metric="received">${money(t.received)}</strong><small>Наличные + Kaspi. Долг сюда не входит.</small></div>`;
  $("sale-history").innerHTML = history(state)
    .slice(0, 8)
    .map((s) => {
      const content = `<span class="history-symbol">${icon("sale")}</span><span><strong>Чек №${s.id}</strong><small>${time(s.at)} · ${METHODS[s.method]}${s.demo ? " · Ваш демочек" : ""}</small></span><strong class="history-total">${money(s.total)}</strong>${s.demo ? icon("arrow") : '<span class="history-spacer"></span>'}`;
      return s.demo
        ? `<button class="history-row" type="button" data-receipt="${s.id}" aria-label="Открыть учебный чек №${s.id}">${content}</button>`
        : `<div class="history-row">${content}</div>`;
    })
    .join("");
}
function renderGuide() {
  const step = state.cart.length ? 2 : state.sales.length ? 3 : 1;
  for (const item of document.querySelectorAll("[data-guide]")) {
    const n = Number(item.dataset.guide);
    item.classList.toggle("complete", n < step);
    item.classList.toggle("current", n === step);
    if (n === step) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
  }
}
function renderAll() {
  renderProducts();
  renderCart();
  renderStock();
  renderReports();
  renderGuide();
}
function routeView(focus = true) {
  const current = route();
  const headings = {
    sale: [
      "Попробуйте продажу.",
      "Найдите товар, добавьте в чек и выберите оплату.",
    ],
    stock: [
      "Всё на своём месте.",
      "Цена и остаток каждого товара. Ваши продажи уже учтены.",
    ],
    reports: [
      "День — в цифрах.",
      "24 октября · учебный день. Здесь виден результат ваших продаж.",
    ],
  };
  $("page-title").textContent = headings[current][0];
  $("page-description").textContent = headings[current][1];
  for (const name of ["sale", "stock", "reports"])
    $("view-" + name).hidden = name !== current;
  for (const link of document.querySelectorAll(".app-nav [data-route]")) {
    if (link.dataset.route === current)
      link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  document.body.dataset.route = current;
  document.querySelector(".demo-guide").hidden = current !== "sale";
  if (focus) {
    window.scrollTo(0, 0);
    $("page-title").focus({ preventScroll: true });
  }
}
function navigate(next) {
  if (location.hash === "#" + next) routeView();
  else location.hash = next;
}
function mutate(fn, message = "") {
  const focusKey = document.activeElement?.dataset.focus;
  try {
    persist(fn(state));
    renderAll();
    if (focusKey) {
      const control = document.querySelector(
        `[data-focus="${CSS.escape(focusKey)}"]`,
      );
      if (control?.disabled) {
        const fallback =
          control.closest(".quantity")?.querySelector("output") ||
          control.closest(".product-card")?.querySelector("h3");
        if (fallback) {
          fallback.tabIndex = -1;
          fallback.focus({ preventScroll: true });
        }
      } else control?.focus({ preventScroll: true });
    }
    if (message) announce(message);
  } catch (error) {
    announce(error.message);
  }
}
const paymentMethod = () => $("payment-form").elements.method.value;
function renderPaymentMethod() {
  const method = paymentMethod();
  $("cash-fields").hidden = method !== "cash";
  $("kaspi-fields").hidden = method !== "kaspi";
  $("debt-fields").hidden = method !== "debt";
  $("payment-error").textContent = "";
  $("cash-given").removeAttribute("aria-invalid");
  updateChange();
}
function updateChange() {
  try {
    const change = parseMoney($("cash-given").value) - cartTotal(state);
    $("cash-change").textContent =
      change < 0 ? `Не хватает ${money(-change)}` : `Сдача: ${money(change)}`;
    $("cash-change").classList.toggle("short-cash", change < 0);
  } catch {
    $("cash-change").textContent = "Введите полученную сумму.";
  }
}
function openPayment() {
  if (!state.cart.length) return;
  $("payment-form").reset();
  $("cash-given").value = number.format(cartTotal(state) / 100);
  $("payment-total").textContent = money(cartTotal(state));
  const rounded = Math.ceil(cartTotal(state) / 1_000_000) * 1_000_000;
  $("round-cash").dataset.amount = String(rounded);
  $("round-cash").textContent = money(rounded);
  renderPaymentMethod();
  $("payment-dialog").showModal();
}
function showResult(saved, opener = saleFocusTarget()) {
  resultOpener = opener;
  const sale = saleDetails(saved),
    t = totals(state);
  $("result-title").textContent =
    sale.method === "debt" ? "Записали в долг." : "Продажа проведена.";
  const changes = sale.items
    .map((l) => {
      const before =
        l.initialStock -
        state.sales
          .filter((s) => s.id < sale.id)
          .reduce(
            (sum, s) =>
              sum +
              s.items
                .filter((line) => line.id === l.id)
                .reduce((n, line) => n + line.qty, 0),
            0,
          );
      return `<li><span>${escape(l.name)}</span><strong>${before} → ${before - l.qty} шт</strong></li>`;
    })
    .join("");
  $("result-content").innerHTML =
    `<div class="result-meta"><span>№${sale.id} · 24 октября · ${time(sale.at)}</span><span>${METHODS[sale.method]}</span></div><div class="result-lines">${sale.items.map((l) => `<div><span>${escape(l.name)}<small>${l.qty} × ${money(l.price)}</small></span><strong>${money(l.total)}</strong></div>`).join("")}</div><div class="result-total"><span>${sale.method === "debt" ? "В долг" : "Итого"}</span><strong>${money(sale.total)}</strong></div>${sale.method === "cash" ? `<p class="result-change">Получено ${money(sale.given)} · Сдача ${money(sale.change)}</p>` : sale.customer ? `<p class="result-change">${escape(sale.customer)}</p>` : ""}<div class="stock-proof"><h3>Остаток после этого чека</h3><ul>${changes}</ul></div><div class="result-day"><span>Выручка дня сейчас<strong>${money(t.revenue)}</strong></span><span>Чеков за день<strong>${t.receiptCount}</strong></span></div>`;
  $("result-dialog").showModal();
}
function init() {
  try {
    const saved = sessionStorage.getItem(KEY);
    if (saved)
      try {
        state = restore(saved);
      } catch {
        sessionStorage.removeItem(KEY);
        announce(
          "Сохранённое демо не удалось прочитать. Начали с исходных данных.",
        );
      }
  } catch {
    storageWarning();
  }
  // Event delegation keeps the same handlers when quantity and stock are redrawn.
  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.close) {
      $(button.dataset.close).close();
      return;
    }
    const id = button.dataset.id,
      p = PRODUCTS.find((item) => item.id === id);
    switch (button.dataset.action) {
      case "add":
        mutate(
          (s) => addItem(s, id),
          `Добавили «${p.name}». ${stock(state, id) - inCart(id) === 1 ? "Весь остаток в чеке" : "В чеке"}: ${inCart(id) + 1} шт.`,
        );
        break;
      case "minus":
        mutate(
          (s) => setQuantity(s, id, inCart(id) - 1),
          `Количество «${p.name}» уменьшено.`,
        );
        break;
      case "remove":
        mutate((s) => removeItem(s, id), `Убрали «${p.name}» из чека.`);
        $("cart-dialog").open
          ? $("mobile-cart-title").focus({ preventScroll: true })
          : saleFocusTarget().focus({ preventScroll: true });
        break;
      case "clear-cart":
        mutate(clearCart, "Текущий чек очищен. Проведённые продажи сохранены.");
        ($("cart-dialog").open
          ? $("mobile-cart-title")
          : saleFocusTarget()
        ).focus({ preventScroll: true });
        break;
      case "pay":
        openPayment();
        break;
      case "clear-filters":
        $("product-search").value = "";
        $("category-filter").value = "";
        renderProducts();
        $("product-search").focus();
        break;
    }
    if (button.dataset.receipt) {
      const saved = state.sales.find(
        (s) => s.id === Number(button.dataset.receipt),
      );
      if (saved) showResult(saved, button);
    }
    if (button.dataset.resultRoute) {
      resultOpener = null;
      $("result-dialog").close();
      navigate(button.dataset.resultRoute);
    }
  });
  document.addEventListener(
    "error",
    (event) => {
      const image = event.target;
      if (
        image instanceof HTMLImageElement &&
        image.classList.contains("product-photo")
      ) {
        image.hidden = true;
        image.parentElement.classList.remove("has-photo");
      }
    },
    true,
  );
  $("product-filters").addEventListener("submit", (e) => e.preventDefault());
  $("product-search").addEventListener("input", renderProducts);
  $("category-filter").addEventListener("change", renderProducts);
  $("clear-search").addEventListener("click", () => {
    $("product-search").value = "";
    renderProducts();
    $("product-search").focus();
  });
  $("stock-search").addEventListener("input", renderStock);
  $("stock-sort").addEventListener("change", renderStock);
  $("cart-toggle").addEventListener("click", () =>
    $("cart-dialog").showModal(),
  );
  $("payment-form").addEventListener("change", renderPaymentMethod);
  $("cash-given").addEventListener("input", () => {
    $("cash-given").removeAttribute("aria-invalid");
    $("payment-error").textContent = "";
    updateChange();
  });
  $("exact-cash").addEventListener("click", () => {
    $("cash-given").value = number.format(cartTotal(state) / 100);
    updateChange();
  });
  $("round-cash").addEventListener("click", () => {
    $("cash-given").value = number.format(
      Number($("round-cash").dataset.amount) / 100,
    );
    updateChange();
  });
  $("payment-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (processing || !$("payment-dialog").open) return;
    processing = true;
    $("confirm-payment").disabled = true;
    try {
      const next = completeSale(state, {
        method: paymentMethod(),
        given:
          paymentMethod() === "cash"
            ? parseMoney($("cash-given").value)
            : cartTotal(state),
        customer: $("debt-customer").value,
      });
      persist(next);
      renderAll();
      $("payment-dialog").close();
      if ($("cart-dialog").open) $("cart-dialog").close();
      announce("Учебная продажа проведена. Склад и итоги обновлены.");
      showResult(state.sales.at(-1));
    } catch (error) {
      $("payment-error").textContent = error.message;
      if (paymentMethod() === "cash") {
        $("cash-given").setAttribute("aria-invalid", "true");
        $("cash-given").focus();
      }
    } finally {
      processing = false;
      $("confirm-payment").disabled = false;
    }
  });
  $("reset-demo").addEventListener("click", () =>
    $("reset-dialog").showModal(),
  );
  $("confirm-reset").addEventListener("click", () => {
    persist(initialState());
    $("product-search").value = "";
    $("stock-search").value = "";
    $("category-filter").value = "";
    $("stock-sort").value = "name";
    $("reset-dialog").close();
    renderAll();
    announce(
      "Демо начато заново. Начальные товары, остатки и итоги восстановлены.",
    );
    navigate("sale");
  });
  $("result-dialog").addEventListener("close", () => {
    if (resultOpener?.isConnected && !resultOpener.closest("[hidden]"))
      resultOpener.focus({ preventScroll: true });
    else if (route() === "sale")
      saleFocusTarget().focus({ preventScroll: true });
    else $("page-title").focus({ preventScroll: true });
  });
  $("cart-dialog").addEventListener("close", () => {
    if (
      route() === "sale" &&
      !$("payment-dialog").open &&
      !$("result-dialog").open
    )
      ($("cart-toggle").hidden ? saleFocusTarget() : $("cart-toggle")).focus({
        preventScroll: true,
      });
  });
  window.addEventListener("hashchange", () => {
    for (const dialog of document.querySelectorAll("dialog[open]"))
      dialog.close();
    routeView();
  });
  for (const dialog of document.querySelectorAll("dialog"))
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (
        event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom
      )
        dialog.close();
    });
  $("mobile-cart-title").tabIndex = -1;
  $("reset-demo").disabled = false;
  document.querySelector(".app-nav").inert = false;
  renderAll();
  routeView(false);
  $("demo-boot").hidden = true;
  $("demo-app").hidden = false;
}
try {
  init();
} catch {
  $("reset-demo").disabled = true;
  document.querySelector(".app-nav").inert = true;
  $("demo-app").hidden = true;
  $("demo-boot").hidden = false;
  $("boot-label").textContent =
    "Демо не удалось открыть. Обновите страницу или вернитесь на сайт.";
}
