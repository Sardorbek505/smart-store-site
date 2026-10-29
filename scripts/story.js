// Product interactions and the one-time AI entrance use finite, optional motion.
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
        title: "Нашли. Добавили.",
        description: "По названию или штрихкоду. Цена и остаток уже рядом.",
        proof:
          '<img src="img/demo/products/drill.webp" width="64" height="64" alt=""><span>Шуруповёрт 18 В<small>12 шт на складе</small></span><strong>39 900 ₸</strong>',
        original: "demo-sale.png",
        label: "Касса",
      },
      {
        title: "Всё сложилось.",
        description:
          "2 шуруповёрта, диск и бур. Количество можно менять прямо в чеке.",
        proof: `${icon("receipt")}<span>3 позиции<small>4 единицы товара</small></span><strong>82 300 ₸</strong>`,
        original: "demo-sale.png",
        label: "Чек",
      },
      {
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
  function setupAssistant() {
    const scene = document.querySelector("[data-assistant-scene]");
    if (!scene || !("IntersectionObserver" in window)) return;
    let shown = false;
    const observer = new IntersectionObserver((entries) => {
      if (shown || !entries.some((entry) => entry.isIntersecting)) return;
      shown = true;
      observer.disconnect();
      scene.dataset.entered = "true";
      if (reduced.matches || !scene.animate) return;
      const layers = [scene.querySelector(".assistant-art"), ...scene.querySelectorAll(".assistant-token")];
      layers.forEach((layer, i) => {
        const rest = getComputedStyle(layer).transform;
        const basis = rest === "none" ? "" : rest;
        layer.animate([
          { opacity: .55, transform: `translateY(${i ? 12 : 20}px) scale(.97) ${basis}` },
          { opacity: 1, transform: `translateY(-3px) scale(1.005) ${basis}`, offset: .75 },
          { opacity: 1, transform: rest },
        ], {duration: i ? 700 : 1100, delay: i * 150, easing: "cubic-bezier(.2,.7,.2,1)"});
      });
      scene.querySelector(".assistant-aura").animate([
        {opacity: .3, transform: "scale(.85)"},
        {opacity: 1, transform: "scale(1.06)", offset: .65},
        {opacity: 1, transform: "none"},
      ], {duration: 1400, easing: "ease-out"});
    }, {threshold: .3});
    observer.observe(scene);
  }
  reduced.addEventListener("change", () => {
    if (reduced.matches) {
      for (const element of document.querySelectorAll(
        ".assistant-composition *, .checkout-reading",
      )) {
        for (const animation of element.getAnimations()) animation.cancel();
      }
    }
  });
  for (const setup of [setupCheckout, setupAssistant]) {
    try {
      setup();
    } catch {
      console.warn("Smart Store: product story unavailable");
    }
  }
}
