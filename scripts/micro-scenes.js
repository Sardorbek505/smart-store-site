// Finite compositor animations; static HTML is the complete, accessible result.
export function init() {
  const scenes = [...document.querySelectorAll("[data-micro]")];
  for (const scene of scenes) {
    for (const image of scene.querySelectorAll(".micro-backdrop")) {
      const hide = () => {
        image.dataset.failed = "true";
      };
      image.addEventListener("error", hide);
      if (image.complete && !image.naturalWidth) hide();
    }
  }
  if (!window.IntersectionObserver || !Element.prototype.animate) return;

  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const states = scenes.map((element) => ({
    element,
    button: element.closest("article").querySelector(".micro-replay"),
    visible: false,
    played: false,
    animations: [],
    revision: 0,
  }));
  let scrolling = false;
  let touching = false;
  let idleTimer;
  const dialogs = [...document.querySelectorAll("dialog")];
  const duration = 5200;
  const ease = "cubic-bezier(.22, 1, .36, 1)";
  const add = (state, element, frames) => {
    const animation = element.animate(frames, { duration, easing: "linear" });
    animation.pause();
    animation.currentTime = 0;
    state.animations.push(animation);
  };
  const reveal = (state, element, at, from = "translateY(7px)") =>
    add(state, element, [
      { opacity: 0, transform: from, offset: 0 },
      { opacity: 0, transform: from, offset: at, easing: ease },
      { opacity: 1, transform: "none", offset: at + 0.14 },
      { opacity: 1, transform: "none", offset: 1 },
    ]);
  const leave = (state, element, at) =>
    add(state, element, [
      { opacity: 1, transform: "translateY(0)", offset: 0 },
      { opacity: 1, transform: "translateY(0)", offset: at, easing: ease },
      { opacity: 0, transform: "translateY(-5px)", offset: at + 0.08 },
      { opacity: 0, transform: "translateY(-5px)", offset: 1 },
    ]);
  const swap = (state, element, at) => {
    leave(state, element.querySelector(".micro-before"), at);
    reveal(state, element.querySelector(".micro-after"), at + 0.02);
  };
  const pulse = (state, element, at) => {
    if (!element) return;
    add(state, element, [
      { transform: "none", offset: 0 },
      { transform: "none", offset: at, easing: ease },
      { transform: "scale(1.06)", offset: at + 0.045, easing: ease },
      { transform: "none", offset: at + 0.12 },
      { transform: "none", offset: 1 },
    ]);
  };
  const highlight = (state, element, at, scan = false) => {
    if (!element) return; // Cached HTML can predate the extra visual accents.
    const from = scan ? "scaleX(0)" : "none";
    add(state, element, [
      { opacity: 0, transform: from, offset: 0 },
      { opacity: 0, transform: from, offset: at, easing: ease },
      { opacity: 1, transform: "none", offset: at + 0.06 },
      { opacity: 1, transform: "none", offset: at + 0.12 },
      { opacity: 0, transform: "none", offset: at + 0.22 },
      { opacity: 0, transform: "none", offset: 1 },
    ]);
  };
  const complete = (state) => {
    state.revision++;
    for (const animation of state.animations) animation.cancel();
    state.animations = [];
    state.element.dataset.state = "complete";
  };
  const start = (state) => {
    complete(state);
    state.played = true;
    state.element.dataset.runs = String(
      Number(state.element.dataset.runs || 0) + 1,
    );
    const revision = state.revision;
    const element = state.element;
    reveal(state, element.querySelector(".micro-widget"), 0);
    if (element.dataset.micro === "sale") {
      element.querySelectorAll(".micro-item").forEach((row, i) => {
        const at = 0.12 + i * 0.17;
        reveal(state, row, at, "translateX(12px)");
        highlight(state, row.querySelector(".micro-scan"), at + 0.01, true);
        pulse(state, row.querySelector(".micro-product-icon"), at + 0.12);
      });
      const total = element.querySelector(".micro-total .micro-swap");
      const middle = total.querySelector(".micro-middle");
      if (middle) {
        leave(state, total.querySelector(".micro-before"), 0.21);
        add(state, middle, [
          { opacity: 0, transform: "translateY(5px)", offset: 0 },
          {
            opacity: 0,
            transform: "translateY(5px)",
            offset: 0.23,
            easing: ease,
          },
          { opacity: 1, transform: "none", offset: 0.31 },
          { opacity: 1, transform: "none", offset: 0.44, easing: ease },
          { opacity: 0, transform: "translateY(-5px)", offset: 0.52 },
          { opacity: 0, transform: "translateY(-5px)", offset: 1 },
        ]);
        reveal(state, total.querySelector(".micro-after"), 0.46);
      } else swap(state, total, 0.43);
      pulse(state, element.querySelector(".micro-total > strong"), 0.59);
    } else if (element.dataset.micro === "stock") {
      element.querySelectorAll(".micro-row").forEach((row, i) => {
        const at = 0.25 + i * 0.17;
        swap(state, row.querySelector(".micro-swap"), at);
        highlight(state, row.querySelector(".micro-update"), at);
        pulse(state, row.querySelector("strong"), at + 0.12);
        pulse(state, row.querySelector(".micro-product-icon"), at);
      });
      reveal(state, element.querySelector(".micro-note"), 0.5);
    } else {
      swap(state, element.querySelector(".micro-revenue .micro-swap"), 0.35);
      swap(state, element.querySelector(".micro-profit .micro-swap"), 0.43);
      element.querySelectorAll(".micro-chart > span").forEach((bar, i) => {
        const last = bar.classList.contains("micro-last-bar");
        const from = last ? "scaleY(.42)" : "scaleY(.12)";
        const at = last ? 0.36 : 0.12 + i * 0.035;
        add(state, bar, [
          { transform: from, offset: 0 },
          { transform: from, offset: at, easing: ease },
          { transform: "scaleY(1.04)", offset: at + 0.16, easing: ease },
          { transform: "scaleY(1)", offset: at + 0.24 },
          { transform: "scaleY(1)", offset: 1 },
        ]);
      });
      pulse(state, element.querySelector(".micro-revenue .micro-swap"), 0.51);
      pulse(state, element.querySelector(".micro-profit > strong"), 0.59);
    }
    swap(state, element.querySelector(".micro-status .micro-swap"), 0.64);
    pulse(state, element.querySelector(".micro-status .icon"), 0.78);
    Promise.all(state.animations.map((animation) => animation.finished))
      .then(() => {
        if (state.revision === revision) complete(state);
      })
      .catch(() => {}); // Cancellation restores the static final state.
  };
  const sync = () => {
    const blocked =
      scrolling ||
      touching ||
      document.hidden ||
      dialogs.some((dialog) => dialog.open);
    for (const state of states) {
      state.button.hidden = reduced.matches;
      if (reduced.matches) {
        if (state.animations.length) complete(state);
        continue;
      }
      const active = state.visible && !blocked;
      if (active && !state.played) start(state);
      if (!state.animations.length) continue;
      const next = active ? "running" : "paused";
      if (state.element.dataset.state === next) continue;
      state.element.dataset.state = next;
      for (const animation of state.animations)
        active ? animation.play() : animation.pause();
    }
  };
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const state = states.find(({ element }) => element === entry.target);
        state.visible = entry.isIntersecting && entry.intersectionRatio >= 0.55;
      }
      sync();
    },
    { threshold: [0, 0.55] },
  );
  for (const state of states) {
    state.element.dataset.state = "idle";
    state.button.addEventListener("click", () => {
      if (reduced.matches) return;
      start(state);
      sync();
    });
    observer.observe(state.element);
  }
  // Capture includes horizontal carousel and nested viewport scroll containers.
  document.addEventListener(
    "scroll",
    () => {
      if (!scrolling) {
        scrolling = true;
        sync();
      }
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        scrolling = false;
        sync();
      }, 180);
    },
    { passive: true, capture: true },
  );
  window.addEventListener(
    "pointerdown",
    (event) => {
      if (event.pointerType === "touch") {
        touching = true;
        sync();
      }
    },
    { passive: true },
  );
  const release = () => {
    if (touching) {
      touching = false;
      sync();
    }
  };
  window.addEventListener("pointerup", release, { passive: true });
  window.addEventListener("pointercancel", release, { passive: true });
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("pagehide", () => {
    clearTimeout(idleTimer);
    touching = false;
    scrolling = true;
    sync();
  });
  window.addEventListener("pageshow", () => {
    scrolling = false;
    sync();
  });
  reduced.addEventListener("change", sync);
  const dialogObserver = new MutationObserver(sync);
  for (const dialog of dialogs)
    dialogObserver.observe(dialog, {
      attributes: true,
      attributeFilter: ["open"],
    });
  sync();
}
