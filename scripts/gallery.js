export function init() {
  const gallery = document.querySelector(".hero-gallery");
  if (!gallery) return;
  const stage = gallery.querySelector(".gallery-stage");
  const track = gallery.querySelector("[data-ribbon-track]");
  const cards = [...track.querySelectorAll("[data-gallery-card]")];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const wrap = (n) => ((n % cards.length) + cards.length) % cards.length;
  const transformAt = (n) =>
    `translate3d(calc(-1 * var(--ribbon-cycle) + var(--ribbon-offset) - ${n} * var(--ribbon-step)), 0, 0)`;
  let inView = true;
  let optics;
  let pointer = null,
    dragged = false,
    manual = null,
    target = null,
    staticPhase = 0;
  track.classList.add("motion-ready");
  const flow = track
    .getAnimations?.()
    .find((a) => a.animationName === "ribbon-flow");
  // Use the actual CSS cycle for swipes, keyboard selection and loop wrapping.
  const stepTime = flow
    ? Number(flow.effect.getTiming().duration) / cards.length
    : 1;
  flow?.pause();
  const phase = () =>
    flow ? wrap(Number(flow.currentTime || 0) / stepTime) : staticPhase;
  const announce = (n) => {
    const index = wrap(Math.round(n));
    document.getElementById("gallery-status").textContent =
      `${index + 1} из ${cards.length}: ${cards[index].dataset.title}`;
  };
  const sync = () => {
    // Visible photos keep flowing through scrolling, hover, focus and taps.
    // Suspend only when unseen/system motion is reduced, or a finite swipe
    // supplies its own continuously moving transform.
    const running =
      !!flow && !reduced.matches && !manual && inView && !document.hidden;
    if (flow && (flow.playState === "running") !== running) {
      if (running) flow.play();
      else flow.pause();
    }
    if (manual) {
      const advancing = inView && !document.hidden;
      if ((manual.playState === "running") !== advancing) {
        if (advancing) manual.play();
        else manual.pause();
      }
    }
    const motion = running ? "running" : "paused";
    if (stage.dataset.motion !== motion) stage.dataset.motion = motion;
    optics?.update(running || manual?.playState === "running");
  };
  const go = (next) => {
    sync();
    const from = getComputedStyle(track).transform;
    manual?.cancel();
    target = next;
    announce(next);
    if (!track.animate || reduced.matches) {
      staticPhase = wrap(next);
      if (flow) flow.currentTime = staticPhase * stepTime;
      else track.style.transform = transformAt(staticPhase);
      manual = null;
      target = null;
      sync();
      return;
    }
    const transition = track.animate(
      [{ transform: from }, { transform: transformAt(next) }],
      {
        duration: 650,
        easing: "cubic-bezier(.22,.61,.36,1)",
        fill: "forwards",
      },
    );
    manual = transition;
    transition.onfinish = () => {
      if (manual !== transition) return;
      if (flow) flow.currentTime = wrap(next) * stepTime;
      else track.style.transform = transformAt(wrap(next));
      transition.cancel();
      manual = null;
      target = null;
      sync();
    };
    sync();
  };
  const move = (direction) => go(Math.round(target ?? phase()) + direction);
  gallery.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    move(event.key === "ArrowRight" ? 1 : -1);
  });
  stage.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    dragged = false;
    sync();
  });
  stage.addEventListener("pointermove", (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x,
      dy = event.clientY - pointer.y;
    if (Math.abs(dx) > 20 && Math.abs(dx) > Math.abs(dy)) dragged = true;
  });
  window.addEventListener("pointerup", (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x;
    pointer = null;
    if (dragged && Math.abs(dx) > 35) {
      move(dx < 0 ? 1 : -1);
    }
    sync();
  });
  window.addEventListener("pointercancel", () => {
    pointer = null;
    dragged = false;
    sync();
  });
  stage.addEventListener(
    "click",
    (event) => {
      if (dragged) {
        event.preventDefault();
        event.stopPropagation();
        dragged = false;
      }
    },
    true,
  );
  stage.addEventListener("dragstart", (event) => event.preventDefault());
  // The photo strip stays on one native transform. Optional phone optics read
  // its animation clock; their decoding and GPU setup never block navigation.
  document.addEventListener("visibilitychange", sync);
  reduced.addEventListener("change", () => {
    if (reduced.matches && manual) manual.finish();
    sync();
  });
  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    sync();
  }).observe(gallery);
  sync();
  stage.dataset.renderer = "native";
  stage.dataset.ready = "true";
  // Optional phone renderer: a missing GPU must never prevent native motion,
  // original photo links, keyboard navigation or store login.
  const version = new URL(import.meta.url).search;
  void import(`./hero-optics.js${version}`)
    .then(({ mount }) => {
      optics = mount({
        window: gallery.querySelector(".ribbon-window"),
        track,
        cards,
        flow,
        getManual: () => manual,
      });
      sync();
    })
    .catch(() => {});
}
