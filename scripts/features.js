// Native swiping and short, visible-only demonstrations. Text works without JS.
export function init() {
  const deck = document.querySelector(".feature-deck");
  if (!deck) return;
  const cards = [...deck.querySelectorAll(".feature-card")];
  const links = [...document.querySelectorAll(".feature-switcher a")];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const compact = matchMedia("(max-width: 850px)");
  let active = 0, scrollFrame = 0;
  const current = () => {
    const left = deck.getBoundingClientRect().left;
    active = cards.reduce((best, card, i) =>
      Math.abs(card.getBoundingClientRect().left - left) <
      Math.abs(cards[best].getBoundingClientRect().left - left) ? i : best, 0);
    links.forEach((link, i) => {
      if (i === active) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
  };
  const select = (i) => {
    if (!compact.matches) return;
    deck.scrollTo({
      left: cards[i].offsetLeft - cards[0].offsetLeft,
      behavior: reduced.matches ? "instant" : "smooth",
    });
  };
  links.forEach((link, i) => link.addEventListener("click", (event) => {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!compact.matches) return;
    event.preventDefault();
    select(i);
  }));
  deck.addEventListener("keydown", (event) => {
    if (event.target !== deck || !compact.matches) return;
    const next = { ArrowLeft: Math.max(0, active - 1), ArrowRight: Math.min(2, active + 1), Home: 0, End: 2 };
    if (!(event.key in next)) return;
    event.preventDefault(); select(next[event.key]);
  });
  deck.addEventListener("scroll", () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => { scrollFrame = 0; current(); });
  }, { passive: true });
  if (window.ResizeObserver)
    new ResizeObserver(() => { select(active); current(); }).observe(deck);
  current();

  // Static final values are the fallback for reduced motion and failed assets.
  if (!window.IntersectionObserver || !Element.prototype.animate) return;
  const scenes = cards.map((card) => ({
    element: card.querySelector(".feature-scene"), visible: false, animations: [],
  }));
  const dialogs = [...document.querySelectorAll("dialog")];
  let pageHidden = false;
  const build = (scene) => {
    const duration = 8400;
    const phase = scenes.indexOf(scene) * .035;
    const animate = (element, frames) => {
      const a = element.animate(frames, { duration, iterations: Infinity, easing: "linear" });
      a.pause(); a.currentTime = 0; scene.animations.push(a);
    };
    // First the product enters, then the amount/stock changes, then confirmation.
    for (const group of scene.element.querySelectorAll(".feature-value,.feature-state")) {
      const at = (group.matches(".feature-state") ? .31 : .17) + phase;
      const before = group.querySelector(".feature-before");
      const after = group.querySelector(".feature-after");
      animate(before, [
        { opacity: 0, offset: 0 }, { opacity: 1, offset: .04 },
        { opacity: 1, offset: at, easing: "ease-out" },
        { opacity: 0, offset: at + .05 }, { opacity: 0, offset: 1 },
      ]);
      animate(after, [
        { opacity: 0, transform: "translateY(4px)", offset: 0 },
        { opacity: 0, transform: "translateY(4px)", offset: at + .025, easing: "ease-out" },
        { opacity: 1, transform: "none", offset: at + .1 },
        { opacity: 1, transform: "none", offset: .96 },
        { opacity: 0, transform: "none", offset: 1 },
      ]);
    }
    for (const element of scene.element.querySelectorAll("[data-feature-enter]")) {
      const at = .04 + phase;
      animate(element, [
        { opacity: 0, transform: "translate(12px,4px)", offset: 0 },
        { opacity: 0, transform: "translate(12px,4px)", offset: at, easing: "ease-out" },
        { opacity: 1, transform: "none", offset: at + .1 },
        { opacity: 1, transform: "none", offset: .96 },
        { opacity: 0, transform: "none", offset: 1 },
      ]);
    }
  };
  const sync = () => {
    const blocked = pageHidden || document.hidden || dialogs.some((d) => d.open);
    for (const scene of scenes) {
      if (reduced.matches) {
        scene.animations.forEach((a) => a.cancel()); scene.animations = [];
        continue;
      }
      const run = scene.visible && !blocked;
      if (run && !scene.animations.length) build(scene);
      for (const a of scene.animations) {
        if (run && a.playState !== "running") a.play();
        if (!run && a.playState === "running") a.pause();
      }
    }
  };
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const scene = scenes.find((s) => s.element === entry.target);
      scene.visible = entry.isIntersecting && entry.intersectionRatio > .55;
    }
    sync();
  }, { threshold: [0, .56], rootMargin: "-80px 0px -16px 0px" });
  scenes.forEach((s) => observer.observe(s.element));
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("pagehide", () => { pageHidden = true; sync(); });
  window.addEventListener("pageshow", () => { pageHidden = false; sync(); });
  reduced.addEventListener("change", sync);
  const modalObserver = new MutationObserver(sync);
  dialogs.forEach((d) => modalObserver.observe(d, { attributes: true, attributeFilter: ["open"] }));
  // A missing decorative image must never hide the explanation or its values.
  scenes.forEach(({ element }) => {
    const image = element.querySelector("img");
    const fail = () => { image.hidden = true; };
    image.addEventListener("error", fail);
    if (image.complete && !image.naturalWidth) fail();
  });
  sync();
}
