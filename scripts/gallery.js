export function init() {
  const gallery = document.querySelector(".hero-gallery");
  if (!gallery) return;
  const stage = gallery.querySelector(".gallery-stage");
  const track = gallery.querySelector("[data-ribbon-track]");
  const cards = [...track.querySelectorAll("[data-gallery-card]")];
  const dialogs = [...document.querySelectorAll("dialog")];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const wrap = (n) => ((n % cards.length) + cards.length) % cards.length;
  const transformAt = (n) =>
    `translate3d(calc(-1 * var(--ribbon-cycle) + var(--ribbon-offset) - ${n} * var(--ribbon-step)), 0, 0)`;
  let focused = false,
    hovering = false,
    inView = true,
    resting = false;
  let restTimer;
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
    const running =
      !!flow &&
      !focused &&
      !reduced.matches &&
      !hovering &&
      !resting &&
      !pointer &&
      !manual &&
      inView &&
      !document.hidden &&
      !dialogs.some((dialog) => dialog.open) &&
      scrollY <= 1;
    if (flow && (flow.playState === "running") !== running) {
      if (running) flow.play();
      else flow.pause();
    }
    if (manual) {
      const advancing =
        inView && !document.hidden && !dialogs.some((dialog) => dialog.open);
      if ((manual.playState === "running") !== advancing) {
        if (advancing) manual.play();
        else manual.pause();
      }
    }
    const motion = running ? "running" : "paused";
    if (stage.dataset.motion !== motion) stage.dataset.motion = motion;
  };
  const restAfterSwipe = () => {
    resting = true;
    clearTimeout(restTimer);
    // The finite transition takes 650 ms; leave about two seconds to inspect it.
    restTimer = setTimeout(() => {
      resting = false;
      sync();
    }, 2650);
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
  gallery.addEventListener("focusin", (event) => {
    focused = true;
    sync();
    const index = cards.indexOf(event.target);
    if (index >= 0 && !pointer) go(index);
  });
  gallery.addEventListener("focusout", (event) => {
    focused = gallery.contains(event.relatedTarget);
    sync();
  });
  stage.addEventListener("pointerenter", (event) => {
    if (event.pointerType !== "mouse") return;
    hovering = true;
    sync();
  });
  stage.addEventListener("pointerleave", () => {
    hovering = false;
    sync();
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
      restAfterSwipe();
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
  // The browser animates one transform. There is no JavaScript frame loop,
  // image decoding barrier, Canvas, or geometry update during scrolling.
  window.addEventListener("scroll", sync, { passive: true });
  document.addEventListener("visibilitychange", sync);
  reduced.addEventListener("change", () => {
    if (reduced.matches && manual) manual.finish();
    sync();
  });
  const dialogObserver = new MutationObserver(sync);
  for (const dialog of dialogs)
    dialogObserver.observe(dialog, {
      attributes: true,
      attributeFilter: ["open"],
    });
  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    sync();
  }).observe(gallery);
  sync();
  stage.dataset.renderer = "native";
  stage.dataset.ready = "true";
}
