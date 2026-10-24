// Deliberate, finite interactions: no scroll listeners, timers or animation loop.
export function init() {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const reveal = (element) => {
    if (reduced.matches || !element.animate) return;
    for (const animation of element.getAnimations()) animation.cancel();
    element.animate(
      [
        { opacity: 0.4, transform: "translateY(6px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 220, easing: "ease-out" },
    );
  };
  const arrows = (buttons, select) => {
    buttons.forEach((button, index) =>
      button.addEventListener("keydown", (event) => {
        let next;
        if (event.key === "ArrowRight" || event.key === "ArrowDown")
          next = (index + 1) % buttons.length;
        else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
          next = (index + buttons.length - 1) % buttons.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = buttons.length - 1;
        else return;
        event.preventDefault();
        buttons[next].focus({ preventScroll: true });
        select(next);
      }),
    );
  };
  function setupSteps() {
    const player = document.querySelector(".step-player");
    if (!player) return;
    const steps = [
      {
        src: "demo-home.png",
        label: "Главная",
        alt: "Главная Smart Store с демонстрационными данными",
        caption: "Программа установлена. Можно настроить магазин.",
      },
      {
        src: "demo-products.png",
        label: "Товары",
        alt: "Каталог товаров Smart Store с демонстрационными данными",
        caption: "Добавьте товары вручную или импортируйте из Excel.",
      },
      {
        src: "demo-payment.png",
        label: "Оплата",
        alt: "Оплата Smart Store: 40 000 ₸ наличными и 42 300 ₸ через Kaspi",
        caption: "Выберите наличные, Kaspi или смешанную оплату.",
      },
    ];
    const buttons = [...player.querySelectorAll("[data-start-step]")];
    const image = document.getElementById("start-screen");
    const link = document.getElementById("start-screen-link");
    const select = (index) => {
      const step = steps[index];
      if (!step || player.dataset.step === String(index)) return;
      player.dataset.step = String(index);
      buttons.forEach((button, i) =>
        button.setAttribute("aria-pressed", String(i === index)),
      );
      image.src = `img/${step.src}`;
      image.alt = step.alt;
      link.href = `img/${step.src}`;
      link.dataset.title = `Smart Store / ${step.label}`;
      link.dataset.previewAlt = step.alt;
      document.getElementById("start-screen-label").textContent =
        `Smart Store / ${step.label}`;
      document.getElementById("start-caption").textContent = step.caption;
      reveal(image);
    };
    buttons.forEach((button, index) => {
      button.addEventListener("click", () => select(index));
      button.disabled = false;
    });
    arrows(buttons, select);
  }
  function setupHub() {
    const hub = document.querySelector(".data-hub");
    if (!hub) return;
    const facts = [
      ["База на вашем компьютере", "Данные магазина хранятся локально."],
      [
        "Основное работает офлайн",
        "Касса, склад и основные отчёты — без интернета.",
      ],
      [
        "Автокопии каждые 2 часа",
        "Внешнюю копию храните отдельно от компьютера.",
      ],
    ];
    const buttons = [...hub.querySelectorAll("[data-hub-node]")];
    const select = (index) => {
      if (!facts[index] || hub.dataset.active === String(index)) return;
      hub.dataset.active = String(index);
      buttons.forEach((button, i) =>
        button.setAttribute("aria-pressed", String(i === index)),
      );
      document.getElementById("hub-detail-title").textContent = facts[index][0];
      document.getElementById("hub-detail-copy").textContent = facts[index][1];
      document.querySelector(".hub-detail-index").textContent = `0${index + 1}`;
      reveal(document.getElementById("hub-detail"));
    };
    buttons.forEach((button, index) => {
      button.addEventListener("click", () => select(index));
      button.disabled = false;
    });
    arrows(buttons, select);
  }
  function setupPhone() {
    const image = document.getElementById("phone-mockup");
    if (!image) return;
    const buttons = [...document.querySelectorAll("[data-phone-screen]")];
    const link = document.getElementById("phone-screen-link");
    const screens = [
      {
        image: "mobile-demo-overview.webp",
        original: "demo-phone.png",
        label: "Контроль",
        metricLabel: "Выручка сегодня",
        metricValue: "396 950 ₸",
        alt: "iPhone 18 Pro Max с итогами Smart Store, в диагональном ракурсе на объёмной подставке",
        originalAlt: "Главная телефона: выручка, прибыль и рабочие инструменты",
      },
      {
        image: "mobile-demo-search.webp",
        original: "demo-phone-search.png",
        label: "Поиск товара",
        metricLabel: "На складе",
        metricValue: "7 шт",
        alt: "iPhone 18 Pro Max с поиском товара Smart Store на скульптурной подставке",
        originalAlt: "Поиск товара в телефонном интерфейсе Smart Store",
      },
      {
        image: "mobile-demo-cart.webp",
        original: "demo-phone-cart.png",
        label: "Корзина",
        metricLabel: "К оплате",
        metricValue: "40 550 ₸",
        alt: "iPhone 18 Pro Max с корзиной Smart Store на 40 550 ₸, диагональная композиция",
        originalAlt: "Корзина продажи Smart Store: два товара на 40 550 ₸",
      },
    ];
    let selected = 0;
    const select = (index) => {
      const screen = screens[index];
      if (!screen || selected === index) return;
      selected = index;
      buttons.forEach((button, i) =>
        button.setAttribute("aria-pressed", String(i === index)),
      );
      document.getElementById("scene-metric-label").textContent =
        screen.metricLabel;
      document.getElementById("scene-metric-value").textContent =
        screen.metricValue;
      image.src = `img/${screen.image}`;
      image.alt = screen.alt;
      link.href = `img/${screen.original}`;
      link.dataset.title = `Smart Store на телефоне / ${screen.label}`;
      link.dataset.previewAlt = screen.originalAlt;
      reveal(image);
    };
    buttons.forEach((button, index) => {
      button.addEventListener("click", () => select(index));
      button.disabled = false;
    });
    const hotspot = document.getElementById("phone-query-hotspot");
    hotspot.addEventListener("click", () => select(1));
    hotspot.disabled = false;
    arrows(buttons, select);
  }
  for (const setup of [setupSteps, setupHub, setupPhone]) {
    try {
      setup();
    } catch {
      console.warn("Smart Store: product story unavailable");
    }
  }
}
