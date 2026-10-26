// Each story has its own interaction. Motion is finite and only follows a tap.
export function init() {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const animate = (element) => {
    for (const animation of element.getAnimations()) animation.cancel();
    if (reduced.matches || !element.animate) return;
    element.animate(
      [
        { opacity: 0.45, transform: "translateY(5px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 220, easing: "ease-out" },
    );
  };
  function setupCheckout() {
    const image = document.getElementById("product-screen");
    if (!image) return;
    const buttons = [...document.querySelectorAll("[data-checkout-point]")];
    const icon = (name) =>
      `<span class="proof-icon"><svg class="icon" aria-hidden="true"><use href="#i-${name}" /></svg></span>`;
    const details = [
      {
        index: "01 / ТОВАР",
        title: "Нашли. Добавили.",
        description: "По названию или штрихкоду. Цена и остаток уже рядом.",
        proof:
          '<img src="img/demo/products/drill.webp" width="64" height="64" alt=""><span>Шуруповёрт 18 В<small>12 шт на складе</small></span><strong>39 900 ₸</strong>',
        original: "demo-sale.png",
        label: "Касса",
      },
      {
        index: "02 / ЧЕК",
        title: "Всё сложилось.",
        description:
          "2 шуруповёрта, диск и бур. Количество можно менять прямо в чеке.",
        proof: `${icon("receipt")}<span>3 позиции<small>4 единицы товара</small></span><strong>82 300 ₸</strong>`,
        original: "demo-sale.png",
        label: "Чек",
      },
      {
        index: "03 / ОПЛАТА",
        title: "Как удобно покупателю.",
        description: "Наличные, Kaspi или оба способа в одной продаже.",
        proof: `${icon("shield")}<span>Наличные · 40 000 ₸<small>Kaspi · 42 300 ₸</small></span><strong>82 300 ₸</strong>`,
        original: "demo-payment.png",
        label: "Смешанная оплата",
      },
    ];
    let selected = 0;
    const object = document.querySelector(".checkout-object");
    const select = (index, overview = false) => {
      if (
        index === selected &&
        object.dataset.checkoutView === String(index) &&
        !overview
      )
        return;
      selected = index;
      const detail = details[index];
      buttons.forEach((button, i) =>
        button.setAttribute("aria-pressed", String(i === index && !overview)),
      );
      document.getElementById("checkout-index").textContent = detail.index;
      document.getElementById("checkout-title").textContent = detail.title;
      document.getElementById("checkout-description").textContent =
        detail.description;
      document.getElementById("checkout-proof").innerHTML = detail.proof;
      for (const id of ["checkout-original", "product-screen-link"]) {
        const link = document.getElementById(id);
        link.href = `img/${detail.original}`;
        link.dataset.title = `Smart Store / ${detail.label}`;
        link.setAttribute(
          "aria-label",
          `Рассмотреть исходный экран: ${detail.label}`,
        );
      }
      object.dataset.checkoutView = overview ? "overview" : String(index);
      object.dispatchEvent(new CustomEvent("checkout:focus"));
      animate(document.querySelector(".checkout-reading"));
    };
    object.addEventListener("checkout:overview", () => select(0, true));
    buttons.forEach((button, index) => {
      button.disabled = false;
      button.addEventListener("click", () => select(index));
      button.addEventListener("keydown", (event) => {
        const targets = {
          ArrowRight: (index + 1) % 3,
          ArrowDown: (index + 1) % 3,
          ArrowLeft: (index + 2) % 3,
          ArrowUp: (index + 2) % 3,
          Home: 0,
          End: 2,
        };
        if (!(event.key in targets)) return;
        event.preventDefault();
        buttons[targets[event.key]].focus({ preventScroll: true });
        select(targets[event.key]);
      });
    });
  }
  function setupPhone() {
    const image = document.getElementById("phone-mockup");
    if (!image) return;
    const scenes = [
      {
        image: "mobile-demo-overview.webp",
        original: "demo-phone.png",
        label: "Сегодня в магазине",
        value: "396 950 ₸",
        description: "17 чеков. Теперь найдём шуруповёрт.",
        action: "Найти шуруповёрт",
        title: "Главная",
        alt: "iPhone 18 Pro Max целиком с итогами дня Smart Store",
      },
      {
        image: "mobile-demo-drill.webp",
        original: "demo-phone-drill.png",
        label: "Шуруповёрт 18 В · 12 шт",
        value: "39 900 ₸",
        description: "В корзине уже есть диск за 650 ₸.",
        action: "Добавить в корзину",
        title: "Найденный товар",
        alt: "iPhone 18 Pro Max целиком: шуруповёрт 18 В за 39 900 ₸, в наличии 12 шт",
      },
      {
        image: "mobile-demo-cart.webp",
        original: "demo-phone-cart.png",
        label: "Шуруповёрт + отрезной диск",
        value: "40 550 ₸",
        description: "2 товара в корзине. Оплата — на компьютере.",
        action: "Повторить демо",
        title: "Корзина",
        alt: "iPhone 18 Pro Max целиком с корзиной Smart Store: два товара на 40 550 ₸",
      },
    ];
    const button = document.getElementById("phone-demo-action");
    const label = button.querySelector(".button-label");
    const link = document.getElementById("phone-screen-link");
    const story = document.querySelector(".mobile-story");
    let selected = 0;
    let loading = false;
    const load = async (src) => {
      const next = new Image();
      next.src = `img/${src}`;
      await next.decode();
      return next.src;
    };
    button.addEventListener("click", async () => {
      if (loading) return;
      loading = true;
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      label.textContent = "Загружаем…";
      const index = (selected + 1) % scenes.length;
      const scene = scenes[index];
      try {
        let source;
        try {
          source = await load(scene.image);
        } catch {
          source = await load(scene.original);
        }
        selected = index;
        image.src = source;
        image.alt = scene.alt;
        link.href = `img/${scene.original}`;
        link.dataset.title = `Smart Store на телефоне / ${scene.title}`;
        link.dataset.previewAlt = `${scene.label}: ${scene.value}. ${scene.description}`;
        document.getElementById("phone-demo-label").textContent = scene.label;
        document.getElementById("phone-demo-value").textContent = scene.value;
        document.getElementById("phone-demo-description").textContent =
          scene.description;
        story.dataset.phoneStep = String(index);
        document
          .querySelectorAll(".demo-progress > span")
          .forEach((dot, i) => dot.classList.toggle("current", i <= index));
        animate(image);
      } catch {
        document.getElementById("phone-demo-description").textContent =
          "Не удалось загрузить экран. Нажмите ещё раз.";
      } finally {
        loading = false;
        button.disabled = false;
        button.removeAttribute("aria-busy");
        label.textContent = scenes[selected].action;
      }
    });
    button.disabled = false;
  }
  reduced.addEventListener("change", () => {
    if (reduced.matches) {
      for (const element of document.querySelectorAll(
        "#phone-mockup, .checkout-reading",
      )) {
        for (const animation of element.getAnimations()) animation.cancel();
      }
    }
  });
  for (const setup of [setupCheckout, setupPhone]) {
    try {
      setup();
    } catch {
      console.warn("Smart Store: product story unavailable");
    }
  }
}
