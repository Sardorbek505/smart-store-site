(() => {
  "use strict";
  document.documentElement.classList.add("js");
  const DOMAIN = "metov.store";
  const REPO = "Sardorbek505/smart-store-releases";
  const RELEASES = `https://api.github.com/repos/${REPO}/releases/latest`;
  const $ = (id) => document.getElementById(id);

  async function findInstaller() {
    const note = $("download-note");
    try {
      const response = await fetch(RELEASES, {
        headers: { accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(7000),
      });
      if (!response.ok) throw new Error("Release unavailable");
      const release = await response.json();
      if (
        release.draft ||
        release.prerelease ||
        !/^v?\d+\.\d+\.\d+$/.test(release.tag_name)
      )
        throw new Error("Invalid release");
      const version = release.tag_name.replace(/^v/, "");
      const asset = (release.assets || []).find(
        (file) => file.name === `SmartStore-Setup-${version}-x64.exe`,
      );
      if (!asset || !Number.isFinite(asset.size) || asset.size <= 0)
        throw new Error("No installer");
      const expected = `https://github.com/${REPO}/releases/download/${release.tag_name}/${asset.name}`;
      if (asset.browser_download_url !== expected)
        throw new Error("Unexpected installer URL");
      for (const link of document.querySelectorAll("[data-download]"))
        link.href = expected;
      note.textContent = `Windows 10 / 11 · 64 бит · Версия ${version} · ${Math.round(asset.size / 1024 / 1024)} МБ`;
    } catch {
      // The HTML link remains useful without JavaScript, API quota or network access.
      note.textContent =
        "Windows 10 / 11 · 64 бит. Кнопка откроет страницу последнего выпуска.";
    }
  }

  function setupMenu() {
    const toggle = $("menu-toggle"),
      header = document.querySelector(".top");
    const close = () => {
      header.classList.remove("menu-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Открыть меню");
    };
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") !== "true";
      header.classList.toggle("menu-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
    });
    for (const link of header.querySelectorAll("a"))
      link.addEventListener("click", close);
    document.addEventListener("click", (event) => {
      if (!header.contains(event.target)) close();
    });
    document.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape" &&
        toggle.getAttribute("aria-expanded") === "true"
      ) {
        close();
        toggle.focus();
      }
    });
    matchMedia("(min-width: 851px)").addEventListener("change", close);
  }

  function setupPreview() {
    const dialog = $("preview-dialog"),
      image = $("preview-image");
    if (typeof dialog.showModal !== "function") return;
    for (const link of document.querySelectorAll("[data-preview]")) {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        image.src = link.href;
        image.alt = link.querySelector("img").alt;
        $("preview-title").textContent = link.dataset.title;
        dialog.showModal();
      });
    }
    $("preview-close").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        const box = dialog.getBoundingClientRect();
        if (
          event.clientX < box.left ||
          event.clientX > box.right ||
          event.clientY < box.top ||
          event.clientY > box.bottom
        )
          dialog.close();
      }
    });
  }

  function storeCode(value) {
    let code = value.trim().toLowerCase();
    if (code.includes(".") || code.includes("/")) {
      let address;
      try {
        address = new URL(code.includes("://") ? code : `https://${code}`);
      } catch {
        return null;
      }
      if (
        address.protocol !== "https:" ||
        address.username ||
        address.password ||
        address.port
      )
        return null;
      const suffix = `.${DOMAIN}`;
      if (!address.hostname.endsWith(suffix)) return null;
      code = address.hostname.slice(0, -suffix.length);
    }
    if (!/^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/.test(code)) return null;
    if (["www", "connect", "api", "admin"].includes(code)) return null;
    return code;
  }

  function setupStoreForm() {
    const form = $("store-form"),
      field = $("store-code"),
      button = $("store-submit"),
      note = $("store-note"),
      direct = $("store-direct");
    let request = 0,
      controller;
    button.disabled = false;
    const message = (text, error = false) => {
      note.textContent = text;
      note.classList.toggle("error", error);
    };
    const idle = () => {
      button.disabled = false;
      button.textContent = "Открыть магазин →";
      form.removeAttribute("aria-busy");
    };
    field.addEventListener("input", () => {
      request += 1;
      if (controller) controller.abort();
      idle();
      field.removeAttribute("aria-invalid");
      direct.hidden = true;
      message("");
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const code = storeCode(field.value);
      direct.hidden = true;
      if (!code) {
        field.setAttribute("aria-invalid", "true");
        message(
          "Введите код латинскими буквами и цифрами или адрес вашего магазина на metov.store. Код находится в Smart Store на компьютере.",
          true,
        );
        field.focus();
        return;
      }
      if (controller) controller.abort();
      controller = new AbortController();
      const activeController = controller;
      const current = ++request,
        target = `https://${code}.${DOMAIN}/`;
      const timeout = setTimeout(() => activeController.abort(), 6000);
      button.disabled = true;
      button.textContent = "Проверяем магазин…";
      form.setAttribute("aria-busy", "true");
      field.removeAttribute("aria-invalid");
      message("Проверяем код магазина…");
      try {
        const response = await fetch(
          `https://connect.${DOMAIN}/lookup?code=${encodeURIComponent(code)}`,
          { signal: activeController.signal },
        );
        if (!response.ok) throw new Error("Lookup unavailable");
        const result = await response.json();
        if (current !== request) return;
        if (result.found === false) {
          field.setAttribute("aria-invalid", "true");
          message(
            "Магазин с таким кодом не найден. Скопируйте код или адрес из настроек телефона в программе на компьютере.",
            true,
          );
          return;
        }
        if (result.found !== true) throw new Error("Invalid lookup response");
        message("Магазин найден. Открываем страницу входа…");
        window.location.assign(target);
      } catch {
        if (current !== request) return;
        message(
          "Сервис проверки сейчас недоступен. Проверьте код; если он верный, можно открыть магазин напрямую.",
          true,
        );
        direct.href = target;
        direct.hidden = false;
      } finally {
        clearTimeout(timeout);
        if (current === request) idle();
      }
    });
  }

  function setupDeviceHelp() {
    const mobile =
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (!mobile) return;
    $("mobile-note").hidden = false;
    $("copy-site").hidden = false;
    $("copy-site").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText("https://metov.store/");
        $("copy-status").textContent =
          "Ссылка скопирована. Отправьте её себе и откройте на компьютере Windows.";
      } catch {
        $("copy-status").textContent =
          "Откройте на компьютере адрес metov.store — тот же сайт доступен в любом браузере.";
      }
    });
  }

  function setupScreens() {
    const screens = {
      sale: {
        label: "Продажа",
        alt: "Касса Smart Store: товары, чек и способы оплаты",
      },
      home: {
        label: "Итоги дня",
        alt: "Главная Smart Store: выручка, прибыль и продажи по дням",
      },
    };
    const link = $("product-screen-link");
    for (const button of document.querySelectorAll("[data-screen]")) {
      button.addEventListener("click", () => {
        const name = button.dataset.screen;
        const screen = screens[name];
        $("product-screen").src = `img/${name}.png`;
        $("product-screen").alt = screen.alt;
        link.href = `img/${name}.png`;
        link.dataset.title = `Smart Store / ${screen.label}`;
        $("screen-label").textContent = `Smart Store / ${screen.label}`;
        for (const tab of document.querySelectorAll("[data-screen]")) {
          const selected = tab === button;
          tab.setAttribute("aria-pressed", String(selected));
          tab.classList.toggle("active", selected);
        }
      });
    }
  }

  setupScreens();
  setupMenu();
  setupPreview();
  setupStoreForm();
  setupDeviceHelp();
  void findInstaller();
})();
