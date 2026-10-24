export function init() {
  const $ = (id) => document.getElementById(id);
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
    document.querySelector(".screen-tabs").hidden = false;
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

  for (const setup of [setupMenu, setupScreens]) {
    try {
      setup();
    } catch {
      console.warn("Smart Store: interface enhancement unavailable");
    }
  }
  const revealAnswer = () => {
    let id;
    try {
      id = decodeURIComponent(location.hash.slice(1));
    } catch {
      return;
    }
    const target = document.getElementById(id);
    const details = target?.closest("details");
    if (details) details.open = true;
  };
  revealAnswer();
  window.addEventListener("hashchange", revealAnswer);
  document.documentElement.classList.add("js");
}
