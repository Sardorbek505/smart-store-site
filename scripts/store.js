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
    if (next === "checking") button.textContent = "Проверяем магазин…";
    if (next === "redirecting") button.textContent = "Открываем магазин…";
    if (next === "checking") form.setAttribute("aria-busy", "true");
    else form.removeAttribute("aria-busy");
  };
  const cancel = () => {
    revision += 1;
    controller?.abort();
    field.removeAttribute("aria-invalid");
    direct.hidden = true;
    direct.removeAttribute("href");
  };
  show("idle");
  field.addEventListener("input", () => {
    cancel();
    show("idle");
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    cancel();
    const current = revision;
    const code = storeCode(field.value);
    if (!code) {
      field.setAttribute("aria-invalid", "true");
      show(
        "invalid",
        "Введите код латинскими буквами и цифрами или адрес вашего магазина на metov.store. Код находится в Smart Store на компьютере.",
      );
      field.focus();
      return;
    }
    controller = new AbortController();
    const target = storeUrl(code);
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
          "Магазин с таким кодом не найден. Скопируйте код или адрес из настроек телефона в программе на компьютере.",
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
        "Сервис проверки сейчас недоступен. Проверьте код; если он верный, можно открыть магазин напрямую.",
      );
      direct.href = target;
      direct.hidden = false;
    } finally {
      if (current === revision && state === "checking") show("idle");
    }
  });
}
