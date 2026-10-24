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
        image.alt = link.dataset.previewAlt || link.querySelector("img").alt;
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
      scene: {
        label: "В магазине",
        alt: "Мокап ноутбука с кассой Smart Store в ракурсе три четверти",
        image: "editorial-laptop.webp",
        preview: "sale.png",
      },
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
        $("product-screen").src = `img/${screen.image || `${name}.png`}`;
        $("product-screen").alt = screen.alt;
        link.href = `img/${screen.preview || `${name}.png`}`;
        link.dataset.previewAlt =
          name === "scene"
            ? "Касса Smart Store: товары, чек и способы оплаты"
            : screen.alt;
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

  function setupGallery() {
    const gallery = document.querySelector(".hero-gallery");
    if (!gallery) return;
    const stage = gallery.querySelector(".gallery-stage");
    const cards = [...gallery.querySelectorAll("[data-gallery-card]")];
    const controls = gallery.querySelector(".gallery-controls");
    const pause = $("gallery-pause");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let position = 0;
    let target = null;
    let paused = reduced.matches;
    let hovered = false;
    let focused = false;
    let visible = true;
    let frame = 0;
    let lastTime = 0;
    let pointer = null;
    let dragged = false;
    let cardWidth = 0;
    let perspective = 1050;
    let announced = -1;
    const count = cards.length;
    const wrap = (value) => ((value % count) + count) % count;
    const render = () => {
      for (const [index, card] of cards.entries()) {
        const distance = wrap(index - position + count / 2) - count / 2;
        const edge = Math.abs(distance);
        const z = Math.pow(edge, 1.6) * 92;
        const x =
          distance *
          cardWidth *
          (1.04 + Math.max(0, edge - 1) * 0.13) *
          (1 - z / perspective);
        const y = 18 - edge * 16;
        card.style.transform = `translate3d(calc(-50% + ${x}px), ${y}px, ${z}px) rotateY(${-distance * 26}deg) rotateZ(${-distance * 0.2}deg)`;
        card.style.opacity = String(
          Math.min(1, Math.max(0, (2.45 - edge) / 0.5)),
        );
        const offscreen = edge > 1.65;
        card.tabIndex = offscreen ? -1 : 0;
      }
      $("gallery-count").textContent = String(
        wrap(Math.round(position)) + 1,
      ).padStart(2, "0");
    };
    const preview = $("preview-dialog");
    const wantsMotion = () =>
      visible &&
      !document.hidden &&
      !preview.open &&
      (target !== null ||
        (!paused && !reduced.matches && !hovered && !focused && !pointer));
    const tick = (time) => {
      frame = 0;
      const delta = lastTime ? Math.min(time - lastTime, 48) : 16;
      lastTime = time;
      if (target !== null) {
        position += (target - position) * (1 - Math.exp(-delta / 115));
        if (Math.abs(target - position) < 0.001) {
          position = target;
          target = null;
        }
      } else if (
        !paused &&
        !reduced.matches &&
        !hovered &&
        !focused &&
        !pointer
      ) {
        position += delta / 8500;
      }
      render();
      if (wantsMotion()) frame = requestAnimationFrame(tick);
    };
    const resume = () => {
      if (!wantsMotion()) {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        lastTime = 0;
      } else if (!frame) {
        lastTime = 0;
        frame = requestAnimationFrame(tick);
      }
    };
    const updatePause = () => {
      pause.hidden = reduced.matches;
      pause.setAttribute("aria-pressed", String(paused));
      pause.setAttribute(
        "aria-label",
        paused ? "Включить анимацию" : "Приостановить анимацию",
      );
      resume();
    };
    const move = (direction) => {
      target = Math.round(target ?? position) + direction;
      const index = wrap(target);
      if (announced !== index) {
        $("gallery-status").textContent =
          `${index + 1} из ${count}: ${cards[index].dataset.title}`;
        announced = index;
      }
      if (reduced.matches) {
        position = target;
        target = null;
        render();
      }
      resume();
    };
    controls.hidden = false;
    $("gallery-next").addEventListener("click", () => move(1));
    $("gallery-prev").addEventListener("click", () => move(-1));
    pause.addEventListener("click", () => {
      paused = !paused;
      updatePause();
    });
    stage.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "mouse") {
        hovered = true;
        resume();
      }
    });
    stage.addEventListener("pointerleave", () => {
      hovered = false;
      resume();
    });
    gallery.addEventListener("focusin", () => {
      focused = true;
      resume();
    });
    gallery.addEventListener("focusout", (event) => {
      if (!gallery.contains(event.relatedTarget)) {
        focused = false;
        resume();
      }
    });
    gallery.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        move(event.key === "ArrowRight" ? 1 : -1);
      }
    });
    stage.addEventListener("pointerdown", (event) => {
      if (!event.isPrimary || event.button !== 0) return;
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      dragged = false;
      resume();
    });
    stage.addEventListener("pointermove", (event) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      if (Math.abs(dx) > 20 && Math.abs(dx) > Math.abs(dy)) dragged = true;
    });
    const finishPointer = (event) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const dx = event.clientX - pointer.x;
      pointer = null;
      if (dragged && Math.abs(dx) > 35) move(dx < 0 ? 1 : -1);
      resume();
    };
    window.addEventListener("pointerup", finishPointer);
    window.addEventListener("pointercancel", () => {
      pointer = null;
      dragged = false;
      resume();
    });
    stage.addEventListener(
      "click",
      (event) => {
        if (dragged) {
          event.preventDefault();
          event.stopPropagation();
          dragged = false;
        }
      },
      true,
    );
    stage.addEventListener("dragstart", (event) => event.preventDefault());
    document.addEventListener("visibilitychange", resume);
    new MutationObserver(resume).observe(preview, {
      attributes: true,
      attributeFilter: ["open"],
    });
    reduced.addEventListener("change", () => {
      paused = reduced.matches;
      target = null;
      position = Math.round(position);
      render();
      updatePause();
    });
    new ResizeObserver(() => {
      cardWidth = cards[0].offsetWidth;
      perspective =
        Number.parseFloat(getComputedStyle(stage).perspective) || 1050;
      render();
    }).observe(stage);
    new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        resume();
      },
      { threshold: 0.1 },
    ).observe(gallery);
    cardWidth = cards[0].offsetWidth;
    render();
    updatePause();
  }

  setupGallery();
  setupScreens();
  setupMenu();
  setupPreview();
  setupStoreForm();
  setupDeviceHelp();
  void findInstaller();
})();
