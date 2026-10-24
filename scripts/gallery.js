export function init() {
  const $ = (id) => document.getElementById(id);
  function setupGallery() {
    const gallery = document.querySelector(".hero-gallery");
    if (!gallery) return;
    const stage = gallery.querySelector(".gallery-stage");
    const cards = [...gallery.querySelectorAll("[data-gallery-card]")];
    const controls = gallery.querySelector(".gallery-controls");
    const pause = $("gallery-pause");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let position = 0;
    let target = null;
    let paused = reduced.matches;
    let hovered = false;
    let focused = false;
    let visible = true;
    let frame = 0;
    let lastTime = 0;
    let pointer = null;
    let dragged = false;
    let cardWidth = 0;
    let perspective = 1050;
    let announced = -1;
    const count = cards.length;
    const wrap = (value) => ((value % count) + count) % count;
    const render = () => {
      for (const [index, card] of cards.entries()) {
        const distance = wrap(index - position + count / 2) - count / 2;
        const edge = Math.abs(distance);
        const z = Math.pow(edge, 1.6) * 92;
        const x =
          distance *
          cardWidth *
          (1.04 + Math.max(0, edge - 1) * 0.13) *
          (1 - z / perspective);
        const y = 18 - edge * 16;
        card.style.transform = `translate3d(calc(-50% + ${x}px), ${y}px, ${z}px) rotateY(${-distance * 26}deg) rotateZ(${-distance * 0.2}deg)`;
        card.style.opacity = String(
          Math.min(1, Math.max(0, (2.45 - edge) / 0.5)),
        );
        const offscreen = edge > 1.65;
        card.tabIndex = offscreen ? -1 : 0;
      }
      $("gallery-count").textContent = String(
        wrap(Math.round(position)) + 1,
      ).padStart(2, "0");
    };
    const preview = $("preview-dialog");
    const wantsMotion = () =>
      visible &&
      !document.hidden &&
      !preview.open &&
      (target !== null ||
        (!paused && !reduced.matches && !hovered && !focused && !pointer));
    const tick = (time) => {
      frame = 0;
      const delta = lastTime ? Math.min(time - lastTime, 48) : 16;
      lastTime = time;
      if (target !== null) {
        position += (target - position) * (1 - Math.exp(-delta / 115));
        if (Math.abs(target - position) < 0.001) {
          position = target;
          target = null;
        }
      } else if (
        !paused &&
        !reduced.matches &&
        !hovered &&
        !focused &&
        !pointer
      ) {
        position += delta / 8500;
      }
      render();
      if (wantsMotion()) frame = requestAnimationFrame(tick);
    };
    const resume = () => {
      if (!wantsMotion()) {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        lastTime = 0;
      } else if (!frame) {
        lastTime = 0;
        frame = requestAnimationFrame(tick);
      }
    };
    const updatePause = () => {
      pause.hidden = reduced.matches;
      pause.setAttribute("aria-pressed", String(paused));
      pause.setAttribute(
        "aria-label",
        paused ? "Включить анимацию" : "Приостановить анимацию",
      );
      resume();
    };
    const move = (direction) => {
      target = Math.round(target ?? position) + direction;
      const index = wrap(target);
      if (announced !== index) {
        $("gallery-status").textContent =
          `${index + 1} из ${count}: ${cards[index].dataset.title}`;
        announced = index;
      }
      if (reduced.matches) {
        position = target;
        target = null;
        render();
      }
      resume();
    };
    controls.hidden = false;
    $("gallery-next").addEventListener("click", () => move(1));
    $("gallery-prev").addEventListener("click", () => move(-1));
    pause.addEventListener("click", () => {
      paused = !paused;
      updatePause();
    });
    stage.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "mouse") {
        hovered = true;
        resume();
      }
    });
    stage.addEventListener("pointerleave", () => {
      hovered = false;
      resume();
    });
    gallery.addEventListener("focusin", () => {
      focused = true;
      resume();
    });
    gallery.addEventListener("focusout", (event) => {
      if (!gallery.contains(event.relatedTarget)) {
        focused = false;
        resume();
      }
    });
    gallery.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        move(event.key === "ArrowRight" ? 1 : -1);
      }
    });
    stage.addEventListener("pointerdown", (event) => {
      if (!event.isPrimary || event.button !== 0) return;
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      dragged = false;
      resume();
    });
    stage.addEventListener("pointermove", (event) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      if (Math.abs(dx) > 20 && Math.abs(dx) > Math.abs(dy)) dragged = true;
    });
    const finishPointer = (event) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const dx = event.clientX - pointer.x;
      pointer = null;
      if (dragged && Math.abs(dx) > 35) move(dx < 0 ? 1 : -1);
      resume();
    };
    window.addEventListener("pointerup", finishPointer);
    window.addEventListener("pointercancel", () => {
      pointer = null;
      dragged = false;
      resume();
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
    document.addEventListener("visibilitychange", resume);
    new MutationObserver(resume).observe(preview, {
      attributes: true,
      attributeFilter: ["open"],
    });
    reduced.addEventListener("change", () => {
      paused = reduced.matches;
      target = null;
      position = Math.round(position);
      render();
      updatePause();
    });
    new ResizeObserver(() => {
      cardWidth = cards[0].offsetWidth;
      perspective =
        Number.parseFloat(getComputedStyle(stage).perspective) || 1050;
      render();
    }).observe(stage);
    new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        resume();
      },
      { threshold: 0.1 },
    ).observe(gallery);
    cardWidth = cards[0].offsetWidth;
    render();
    updatePause();
  }

  setupGallery();
}
