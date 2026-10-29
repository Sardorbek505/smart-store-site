export function init({ config, storeCode, storeUrl, fetchJson }) {
  const form = document.getElementById("store-form");
  const field = document.getElementById("store-code");
  const button = document.getElementById("store-submit");
  const note = document.getElementById("store-note");
  const direct = document.getElementById("store-direct");
  const label = button.innerHTML;
  let revision = 0;
  let controller;
  let state = "idle";
  let disconnected = false;
  const offlineMessage =
    "Нет подключения к интернету. Подключитесь и повторите проверку — код магазина сохранён.";
  const show = (next, text = "") => {
    state = next;
    form.dataset.state = next;
    note.textContent = text;
    note.classList.toggle(
      "error",
      ["invalid", "not-found", "unavailable"].includes(next),
    );
    button.disabled = ["checking", "redirecting"].includes(next);
    button.innerHTML = label;
    const buttonText = button.querySelector(".button-label") || button;
    if (next === "checking") buttonText.textContent = "Проверяем магазин…";
    if (next === "redirecting") buttonText.textContent = "Открываем магазин…";
    button.classList.toggle(
      "is-loading",
      ["checking", "redirecting"].includes(next),
    );
    if (next === "checking") form.setAttribute("aria-busy", "true");
    else form.removeAttribute("aria-busy");
  };
  const cancel = () => {
    revision += 1;
    controller?.abort();
    controller = undefined;
    field.removeAttribute("aria-invalid");
    direct.hidden = true;
    direct.removeAttribute("href");
  };
  const restore = () => {
    cancel();
    show("idle");
  };
  // A cached document must not return with a disabled redirect button or a
  // lookup that can navigate after the visitor comes back. Keep their code.
  window.addEventListener("pagehide", restore);
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) restore();
  });
  show("idle");
  field.addEventListener("input", () => {
    cancel();
    show("idle");
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (["checking", "redirecting"].includes(state)) return;
    cancel();
    const current = revision;
    const code = storeCode(field.value);
    if (!code) {
      field.setAttribute("aria-invalid", "true");
      show(
        "invalid",
        "Код — латинские буквы и цифры. Можно вставить адрес магазина на metov.store.",
      );
      field.focus();
      return;
    }
    controller = new AbortController();
    const target = storeUrl(code);
    if (navigator.onLine === false) {
      disconnected = true;
      show("unavailable", offlineMessage);
      return;
    }
    disconnected = false;
    show("checking", "Проверяем код магазина…");
    try {
      const url = new URL(config.connectionUrl);
      url.searchParams.set("code", code);
      const result = await fetchJson(url, {
        signal: controller.signal,
        timeout: 6000,
      });
      if (current !== revision) return;
      if (result?.found === false) {
        field.setAttribute("aria-invalid", "true");
        show(
          "not-found",
          "Такой магазин не найден. Проверьте код в Smart Store: «Система» → настройки телефона.",
        );
        field.focus();
        return;
      }
      if (result?.found !== true) throw new Error("Invalid lookup response");
      show("redirecting", "Магазин найден. Открываем страницу входа…");
      window.location.assign(target);
    } catch {
      if (current !== revision) return;
      show(
        "unavailable",
        "Проверка временно недоступна. Проверьте код или откройте магазин напрямую.",
      );
      direct.href = target;
      direct.hidden = false;
    } finally {
      if (current === revision && state === "checking") show("idle");
    }
  });
  const dialog = document.getElementById("store");
  window.addEventListener("offline", () => {
    if (state !== "checking") return;
    cancel();
    disconnected = true;
    show("unavailable", offlineMessage);
  });
  window.addEventListener("online", () => {
    if (!disconnected) return;
    disconnected = false;
    show(
      "idle",
      "Соединение появилось. Нажмите «Открыть магазин», чтобы повторить проверку.",
    );
  });
  if (typeof dialog?.showModal !== "function") return;
  let trigger;
  let returnPosition;
  let returning = false;
  let returnTimer;
  const restorePosition = () => {
    clearTimeout(returnTimer);
    // Chromium may restore fragment focus after popstate. Finish after that
    // native step, and only for the page from which this login was opened.
    returnTimer = setTimeout(() => {
      if (!returning || dialog.open || location.hash === "#store") return;
      returning = false;
      if (
        !returnPosition ||
        location.href !== returnPosition.url ||
        document.querySelector("dialog[open]")
      )
        return;
      scrollTo(returnPosition.x, returnPosition.y);
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    }, 0);
  };
  const fitKeyboard = () => {
    const viewport = window.visualViewport;
    const keyboard =
      dialog.open &&
      viewport &&
      Math.abs(viewport.scale - 1) < 0.01 &&
      innerHeight - viewport.height > 120;
    dialog.classList.toggle("has-keyboard", Boolean(keyboard));
    if (keyboard) {
      dialog.style.setProperty("--login-height", `${viewport.height}px`);
      dialog.style.setProperty("--login-top", `${viewport.offsetTop}px`);
    }
  };
  window.visualViewport?.addEventListener("resize", fitKeyboard);
  window.visualViewport?.addEventListener("scroll", fitKeyboard);
  const open = () => {
    if (dialog.open) return;
    returning = false;
    clearTimeout(returnTimer);
    dialog.showModal();
    field.focus({ preventScroll: true });
    fitKeyboard();
  };
  const dismiss = () => {
    // A closed login must never complete a late lookup and navigate away.
    restore();
    dialog.close();
  };
  for (const link of document.querySelectorAll('a[href="#store"]')) {
    link.addEventListener("click", (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      event.preventDefault();
      trigger = link;
      if (location.hash !== "#store") {
        returnPosition = { x: scrollX, y: scrollY, url: location.href };
        history.pushState({ ...history.state, storeLogin: true }, "", "#store");
      }
      open();
    });
  }
  document.getElementById("store-close").addEventListener("click", dismiss);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    dismiss();
  });
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom
    )
      dismiss();
  });
  dialog.addEventListener("close", () => {
    // The native event can arrive after Forward has already reopened the dialog.
    if (dialog.open) return;
    returning = Boolean(returnPosition);
    restore();
    fitKeyboard();
    if (location.hash === "#store") {
      if (history.state?.storeLogin) history.back();
      else {
        const url = new URL(location.href);
        url.hash = "";
        history.replaceState(history.state, "", url);
      }
    }
    const target =
      trigger && !trigger.closest("[inert]")
        ? trigger
        : document.getElementById("download");
    if (target?.isConnected) target.focus({ preventScroll: true });
    restorePosition();
  });
  const syncLocation = () => {
    if (location.hash === "#store") open();
    else if (dialog.open) dismiss();
    else if (returning) restorePosition();
  };
  window.addEventListener("hashchange", syncLocation);
  window.addEventListener("popstate", syncLocation);
  window.addEventListener("pageshow", syncLocation);
  syncLocation();
}
