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
  const dialog = document.getElementById("preview-dialog");
  const duration = 4600;
  const ease = "cubic-bezier(.22, 1, .36, 1)";
  const add = (state, element, frames) => {
    const animation = element.animate(frames, { duration, easing: "linear" });
    animation.pause();
    animation.currentTime = 0;
    state.animations.push(animation);
  };
  const reveal = (state, element, at) =>
    add(state, element, [
      { opacity: 0, transform: "translateY(7px)", offset: 0 },
      { opacity: 0, transform: "translateY(7px)", offset: at, easing: ease },
      { opacity: 1, transform: "translateY(0)", offset: at + 0.14 },
      { opacity: 1, transform: "translateY(0)", offset: 1 },
    ]);
  const swap = (state, element, at) => {
    add(state, element.querySelector(".micro-before"), [
      { opacity: 1, transform: "translateY(0)", offset: 0 },
      { opacity: 1, transform: "translateY(0)", offset: at, easing: ease },
      { opacity: 0, transform: "translateY(-5px)", offset: at + 0.08 },
      { opacity: 0, transform: "translateY(-5px)", offset: 1 },
    ]);
    reveal(state, element.querySelector(".micro-after"), at + 0.02);
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
      element
        .querySelectorAll(".micro-item")
        .forEach((row, i) => reveal(state, row, 0.12 + i * 0.14));
      swap(state, element.querySelector(".micro-total .micro-swap"), 0.43);
    } else if (element.dataset.micro === "stock") {
      element
        .querySelectorAll(".micro-row .micro-swap")
        .forEach((value, i) => swap(state, value, 0.25 + i * 0.15));
      reveal(state, element.querySelector(".micro-note"), 0.14);
    } else {
      swap(state, element.querySelector(".micro-revenue .micro-swap"), 0.35);
      swap(state, element.querySelector(".micro-profit .micro-swap"), 0.43);
      add(state, element.querySelector(".micro-last-bar"), [
        { transform: "scaleY(.42)", offset: 0 },
        { transform: "scaleY(.42)", offset: 0.3, easing: ease },
        { transform: "scaleY(1)", offset: 0.65 },
        { transform: "scaleY(1)", offset: 1 },
      ]);
    }
    swap(state, element.querySelector(".micro-status .micro-swap"), 0.64);
    Promise.all(state.animations.map((animation) => animation.finished))
      .then(() => {
        if (state.revision === revision) complete(state);
      })
      .catch(() => {}); // Cancellation restores the static final state.
  };
  const sync = () => {
    const blocked = scrolling || touching || document.hidden || dialog?.open;
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
  if (dialog)
    new MutationObserver(sync).observe(dialog, {
      attributes: true,
      attributeFilter: ["open"],
    });
  sync();
}
