export function init() {
  const $ = (id) => document.getElementById(id);
  function setupMenu() {
    const toggle = $("menu-toggle"),
      header = document.querySelector(".top");
    const close = () => {
      if (toggle.getAttribute("aria-expanded") === "false") return;
      header.classList.remove("menu-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Открыть меню");
    };
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") !== "true";
      header.classList.toggle("menu-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
      if (open)
        header.querySelector(".top-links a")?.focus({ preventScroll: true });
    });
    for (const link of header.querySelectorAll("a"))
      link.addEventListener("click", close);
    document.addEventListener("click", (event) => {
      if (!header.contains(event.target)) close();
    });
    document.addEventListener("focusin", (event) => {
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
    if (document.body.classList.contains("landing-page")) {
      let navigationVisible;
      const updateScrollNavigation = (visible = window.scrollY > 24) => {
        if (visible === navigationVisible) return;
        navigationVisible = visible;
        document.body.classList.toggle("has-scrolled", visible);
        header.inert = !visible;
        header.setAttribute("aria-hidden", String(!visible));
        if (!visible) close();
      };
      if (typeof IntersectionObserver === "function") {
        const sentinel = document.createElement("span");
        sentinel.className = "navigation-sentinel";
        sentinel.setAttribute("aria-hidden", "true");
        document.querySelector(".cinema-hero").prepend(sentinel);
        new IntersectionObserver(([entry]) => {
          updateScrollNavigation(
            !entry.isIntersecting && entry.boundingClientRect.top < 0,
          );
        }).observe(sentinel);
      } else {
        window.addEventListener("scroll", () => updateScrollNavigation(), {
          passive: true,
        });
      }
      window.addEventListener("pageshow", () => updateScrollNavigation());
      updateScrollNavigation();
    }
  }

  function setupScreens() {
    const screens = {
      scene: {
        label: "Товары",
        headline: "Всё на месте.",
        caption: "Цена, остаток и поиск — в одном окне.",
        fact: "На складе · Шуруповёрт 18 В",
        value: "12 шт",
        alt: "Каталог Smart Store на крупном ноутбуке с синей подставкой и инструментом",
        image: "workspace-catalog-full.webp",
        preview: "products.png",
        previewAlt: "Каталог Smart Store: названия, цены и остатки товаров",
      },
      sale: {
        label: "Касса",
        headline: "Чек готов.",
        caption: "Сканируйте товары. Выбирайте способ оплаты.",
        fact: "К оплате · 3 позиции",
        value: "82 300 ₸",
        alt: "Касса Smart Store на чёрном терминале с принтером чеков и синей платформой",
        image: "workspace-sale-full.webp",
        preview: "sale.png",
        previewAlt: "Касса Smart Store: товары, чек и способы оплаты",
      },
      home: {
        label: "Итоги дня",
        kind: "Итоги",
        headline: "День в цифрах.",
        caption: "Выручка, прибыль и оплаты — перед глазами.",
        fact: "Прибыль за день",
        value: "11 230 ₸",
        alt: "Итоги Smart Store на серебристом мониторе с объёмными синими столбцами",
        image: "workspace-overview-full.webp",
        preview: "home.png",
        previewAlt: "Главная Smart Store: выручка, прибыль и продажи по дням",
      },
    };
    const link = $("product-screen-link");
    const tabs = document.querySelector(".screen-tabs");
    const screenButtons = [...document.querySelectorAll("[data-screen]")];
    const image = $("product-screen");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let selected = 0;
    let changed = false;
    image.addEventListener("load", () => {
      if (!changed || reduced.matches || !image.animate) return;
      for (const animation of image.getAnimations()) animation.cancel();
      image.animate([{ opacity: 0.45 }, { opacity: 1 }], {
        duration: 180,
        easing: "ease-out",
      });
    });
    const fallbackToOriginal = () => {
      const screen = screens[screenButtons[selected].dataset.screen];
      if (image.getAttribute("src") !== `img/${screen.image}`) return;
      image.src = `img/${screen.preview}`;
      image.alt = screen.previewAlt;
    };
    image.addEventListener("error", fallbackToOriginal);
    if (image.complete && !image.naturalWidth) fallbackToOriginal();
    const select = (index) => {
      if (selected === index) return;
      const button = screenButtons[index];
      const screen = screens[button.dataset.screen];
      selected = index;
      changed = true;
      image.src = `img/${screen.image}`;
      image.alt = screen.alt;
      link.href = `img/${screen.preview}`;
      link.dataset.previewAlt = screen.previewAlt;
      link.dataset.title = `Smart Store / ${screen.label}`;
      $("product-kind").textContent = `${screen.kind || screen.label}.`;
      $("product-headline").textContent = screen.headline;
      $("product-caption").textContent = screen.caption;
      $("product-fact-label").textContent = screen.fact;
      $("product-fact-value").textContent = screen.value;
      tabs.dataset.selected = String(index);
      for (const tab of screenButtons) {
        const active = tab === button;
        tab.setAttribute("aria-pressed", String(active));
        tab.classList.toggle("active", active);
      }
    };
    tabs.hidden = false;
    for (const [index, button] of screenButtons.entries()) {
      button.addEventListener("click", () => select(index));
      button.addEventListener("keydown", (event) => {
        const targets = {
          ArrowLeft: (index + screenButtons.length - 1) % screenButtons.length,
          ArrowRight: (index + 1) % screenButtons.length,
          Home: 0,
          End: screenButtons.length - 1,
        };
        if (!(event.key in targets)) return;
        event.preventDefault();
        screenButtons[targets[event.key]].focus({ preventScroll: true });
        select(targets[event.key]);
      });
    }
  }

  function setupFeatureCards() {
    const track = document.querySelector(".bento-grid");
    const cards = [...track.querySelectorAll(".bento")];
    const previous = $("feature-prev");
    const next = $("feature-next");
    const narrow = matchMedia("(max-width: 850px)");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let selected = 0;
    const update = () => {
      const left = track.getBoundingClientRect().left;
      selected = cards.reduce(
        (nearest, card, index) =>
          Math.abs(card.getBoundingClientRect().left - left) <
          Math.abs(cards[nearest].getBoundingClientRect().left - left)
            ? index
            : nearest,
        0,
      );
      previous.disabled = selected === 0;
      next.disabled = selected === cards.length - 1;
      $("feature-count").textContent =
        `${String(selected + 1).padStart(2, "0")} / ${String(cards.length).padStart(2, "0")}`;
    };
    const go = (index) => {
      if (!narrow.matches) return;
      const target = cards[Math.max(0, Math.min(cards.length - 1, index))];
      track.scrollTo({
        left: target.offsetLeft,
        behavior: reduced.matches ? "instant" : "smooth",
      });
    };
    previous.addEventListener("click", () => go(selected - 1));
    next.addEventListener("click", () => go(selected + 1));
    track.addEventListener("scroll", update, { passive: true });
    track.addEventListener("keydown", (event) => {
      if (event.target !== track || !narrow.matches) return;
      const targets = {
        ArrowLeft: selected - 1,
        ArrowRight: selected + 1,
        Home: 0,
        End: cards.length - 1,
      };
      if (!(event.key in targets)) return;
      event.preventDefault();
      go(targets[event.key]);
    });
    narrow.addEventListener("change", () => {
      track.scrollLeft = 0;
      update();
    });
    document.querySelector(".feature-controls").hidden = false;
    update();
  }

  for (const setup of [setupMenu, setupScreens, setupFeatureCards]) {
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
