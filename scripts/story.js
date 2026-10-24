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
        src: "home.png",
        label: "Главная",
        alt: "Главная Smart Store с демонстрационными данными",
        caption: "Программа установлена. Можно настроить магазин.",
      },
      {
        src: "products.png",
        label: "Товары",
        alt: "Каталог товаров Smart Store с демонстрационными данными",
        caption: "Добавьте товары вручную или импортируйте из Excel.",
      },
      {
        src: "sale.png",
        label: "Продажа",
        alt: "Касса Smart Store: товары, чек и способы оплаты",
        caption: "Отсканируйте товар и выберите способ оплаты.",
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
  function setupStack() {
    const stack = document.getElementById("phone-stack");
    if (!stack) return;
    const buttons = [...stack.querySelectorAll("[data-phone-card]")];
    const toggle = document.getElementById("stack-toggle");
    const link = document.getElementById("phone-screen-link");
    const labels = ["Контроль", "Поиск товара", "Корзина"];
    const expand = (value) => {
      stack.dataset.expanded = String(value);
      toggle.setAttribute("aria-expanded", String(value));
      toggle.querySelector("span").textContent = value
        ? "Свернуть экраны"
        : "Развернуть экраны";
    };
    const select = (index) => {
      const button = buttons[index];
      if (!button) return;
      stack.dataset.selected = String(index);
      buttons.forEach((card, i) => {
        const distance = (i - index + buttons.length) % buttons.length;
        card.setAttribute("aria-pressed", String(i === index));
        card.style.setProperty(
          "--slot",
          distance === 2 ? "-1" : String(distance),
        );
        card.style.setProperty("--rank", i === index ? "3" : "1");
      });
      const image = button.querySelector("img");
      link.href = image.getAttribute("src");
      link.dataset.title = `Smart Store на телефоне / ${labels[index]}`;
      link.dataset.previewAlt = image.alt;
      expand(true);
    };
    buttons.forEach((button, index) => {
      button.addEventListener("click", () => select(index));
      button.disabled = false;
    });
    toggle.addEventListener("click", () =>
      expand(stack.dataset.expanded !== "true"),
    );
    toggle.disabled = false;
    arrows(buttons, select);
  }
  for (const setup of [setupSteps, setupHub, setupStack]) {
    try {
      setup();
    } catch {
      console.warn("Smart Store: product story unavailable");
    }
  }
}
