// Visible cards replay after a three-second result hold; HTML stays readable.
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
    visible: false,
    played: false,
    startTimer: 0,
    replayTimer: 0,
    holdRemaining: 0,
    holdStarted: 0,
    animations: [],
    revision: 0,
  }));
  let scrolling = false;
  let touching = false;
  let idleTimer;
  const dialogs = [...document.querySelectorAll("dialog")];
  const duration = 5200;
  const entryDelay = 240;
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
  const suspendHold = (state) => {
    if (!state.replayTimer) return;
    clearTimeout(state.replayTimer);
    state.replayTimer = 0;
    state.holdRemaining = Math.max(
      0,
      state.holdRemaining - (performance.now() - state.holdStarted),
    );
  };
  const complete = (state) => {
    suspendHold(state);
    state.holdRemaining = 0;
    clearTimeout(state.startTimer);
    state.startTimer = 0;
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
        if (state.revision !== revision) return;
        complete(state);
        state.holdRemaining = 3000;
        state.element.dataset.state = "waiting";
        sync();
      })
      .catch(() => {}); // Cancellation restores the static final state.
  };
  const blocked = () =>
    scrolling ||
    touching ||
    document.hidden ||
    dialogs.some((dialog) => dialog.open);
  const sync = () => {
    const suspended = blocked();
    for (const state of states) {
      const active = state.visible && !suspended && !reduced.matches;
      if (!active) {
        suspendHold(state);
        clearTimeout(state.startTimer);
        state.startTimer = 0;
      }
      if (reduced.matches) {
        if (state.animations.length || state.holdRemaining) complete(state);
        state.played = false;
        continue;
      }
      if (
        active &&
        state.played &&
        !state.animations.length &&
        !state.replayTimer
      ) {
        state.holdStarted = performance.now();
        state.replayTimer = setTimeout(() => {
          state.replayTimer = 0;
          state.holdRemaining = 0;
          if (!state.visible || blocked() || reduced.matches) {
            state.holdRemaining = 1;
            sync();
            return;
          }
          start(state);
          sync();
        }, state.holdRemaining);
      }
      // Start only after the full card has arrived and scrolling has settled.
      if (active && !state.played && !state.startTimer) {
        state.startTimer = setTimeout(() => {
          state.startTimer = 0;
          if (!state.visible || blocked() || reduced.matches || state.played)
            return;
          start(state);
          sync();
        }, entryDelay);
      }
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
        const state = states.find(
          ({ element }) => element.closest("article") === entry.target,
        );
        state.visible = entry.isIntersecting && entry.intersectionRatio >= 0.9;
        // A new visit gets a fresh beginning; tiny scrolls never rearm it.
        if (!entry.isIntersecting || entry.intersectionRatio === 0) {
          complete(state);
          state.played = false;
          state.element.dataset.state = "idle";
        }
      }
      sync();
    },
    { threshold: [0, 0.9], rootMargin: "-80px 0px -24px 0px" },
  );
  for (const state of states) {
    state.element.dataset.state = "idle";
    observer.observe(state.element.closest("article"));
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
