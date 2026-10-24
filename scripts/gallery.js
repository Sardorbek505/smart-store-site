const { createRibbonRenderer, createStaticRenderer } = await import(
  `./ribbon-renderer.js${new URL(import.meta.url).search}`
);

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
    let position = 0.35;
    let target = null;
    let paused = reduced.matches;
    let hovered = false;
    let focused = false;
    let visible = true;
    let frame = 0;
    let lastTime = 0;
    let pointer = null;
    let dragged = false;
    let announced = -1;
    const count = cards.length;
    const wrap = (value) => ((value % count) + count) % count;
    const photos = cards.map((card) => card.querySelector("img"));
    const counter = $("gallery-count");
    let canvas = document.createElement("canvas");
    canvas.className = "ribbon-canvas";
    canvas.setAttribute("aria-hidden", "true");
    let renderer;
    try {
      renderer = createRibbonRenderer(canvas, photos);
    } catch {
      // A fresh canvas can use 2D even after a GPU shader initialization failure.
      canvas = canvas.cloneNode();
      renderer = createStaticRenderer(canvas, photos);
    }
    if (!renderer) return;
    stage.prepend(canvas);
    stage.dataset.renderer = renderer.name;
    stage.classList.add("ribbon-ready");
    let width = stage.clientWidth;
    let height = stage.clientHeight;
    let needsResize = true;
    let needsPaint = true;
    let scrolling = false;
    let scrollTimer = 0;
    let paintFrame = 0;
    let displayed = -1;
    const resize = () => {
      width = stage.clientWidth;
      height = stage.clientHeight;
      const density = Math.min(window.devicePixelRatio || 1, 3);
      const pixelsWide = Math.round(width * density);
      const pixelsHigh = Math.round(height * density);
      if (canvas.width !== pixelsWide) canvas.width = pixelsWide;
      if (canvas.height !== pixelsHigh) canvas.height = pixelsHigh;
      needsResize = false;
    };
    const render = (syncLinks = false, paint = true) => {
      if (needsResize) resize();
      if (!width || !height) return;
      const radius = width * (width < 621 ? 0.5 : width < 851 ? 0.38 : 0.28);
      const camera = radius * 1.5;
      const step = 0.85;
      const gap = 0.018;
      const photoHeight = Math.min(
        height * (width < 851 ? 0.65 : 0.5),
        width * (width < 621 ? 0.33 : width < 851 ? 0.22 : 0.15),
      );
      const segments = width < 621 ? 40 : 64;
      const selected = wrap(Math.round(position));
      // Link hit areas only change at rest, on interaction or at a slide change.
      // Painting a moving texture never causes per-frame layout/style work.
      syncLinks ||= selected !== displayed;
      const items = [];
      for (const [index, card] of cards.entries()) {
        const distance = wrap(index - position + count / 2) - count / 2;
        const leftAngle = distance * step - (step - gap) / 2;
        const rightAngle = leftAngle + step - gap;
        if (rightAngle < -1.55 || leftAngle > 1.55) {
          if (syncLinks) card.hidden = true;
          continue;
        }
        const start = Math.max(leftAngle, -1.55);
        const end = Math.min(rightAngle, 1.55);
        const points = Array.from({ length: segments + 1 }, (_, slice) => {
          const angle = start + ((end - start) * slice) / segments;
          const scale = camera / (camera - radius * (1 - Math.cos(angle)));
          return {
            x: width / 2 + radius * Math.sin(angle) * scale,
            top: height / 2 - (photoHeight * scale) / 2,
            bottom: height / 2 + (photoHeight * scale) / 2,
            scale,
            u: (angle - leftAngle) / (step - gap),
          };
        });
        const left = points[0].x,
          right = points.at(-1).x;
        const top = Math.min(...points.map((point) => point.top));
        const bottom = Math.max(...points.map((point) => point.bottom));
        if (right <= 0 || left >= width || right <= left) {
          if (syncLinks) card.hidden = true;
          continue;
        }
        if (syncLinks) {
          card.hidden = false;
          const polygon = [
            ...points.map(
              (point) =>
                `${(point.x - left).toFixed(2)}px ${(point.top - top).toFixed(2)}px`,
            ),
            ...points
              .toReversed()
              .map(
                (point) =>
                  `${(point.x - left).toFixed(2)}px ${(point.bottom - top).toFixed(2)}px`,
              ),
          ];
          card.style.cssText = `left:${left}px;top:${top}px;width:${right - left}px;height:${bottom - top}px;clip-path:polygon(${polygon.join(",")});`;
          card.tabIndex = Math.abs(distance) < 1.4 ? 0 : -1;
        }
        items.push({
          index,
          points,
          left,
          right,
          top,
          bottom,
          cardWidth: radius * (step - gap),
          photoHeight,
          aspect: (radius * (step - gap)) / photoHeight,
          focused:
            card === document.activeElement && card.matches(":focus-visible"),
        });
      }
      if (paint) {
        renderer.draw(items, width, height);
        needsPaint = false;
      }
      if (displayed !== selected) {
        counter.textContent = String(selected + 1).padStart(2, "0");
        displayed = selected;
      }
    };
    const requestPaint = () => {
      needsPaint = true;
      if (scrolling || !visible || document.hidden || paintFrame) return;
      paintFrame = requestAnimationFrame(() => {
        paintFrame = 0;
        if (!scrolling && visible && !document.hidden) render(true);
      });
    };
    renderer.onReady = requestPaint;
    for (const photo of photos) {
      photo.loading = "eager";
      photo.addEventListener("load", requestPaint);
    }
    const preview = $("preview-dialog");
    const wantsMotion = () =>
      visible &&
      !scrolling &&
      renderer.animated &&
      !document.hidden &&
      !preview.open &&
      (target !== null ||
        (!paused && !reduced.matches && !hovered && !focused && !pointer));
    let lastPaint = 0;
    const tick = (time) => {
      frame = 0;
      if (!wantsMotion()) {
        lastTime = 0;
        return;
      }
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
      if (time - lastPaint >= 1000 / 30 || !wantsMotion()) {
        render(target === null && (paused || hovered || focused));
        lastPaint = time - ((time - lastPaint) % (1000 / 30));
      }
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
      pause.hidden = reduced.matches || !renderer.animated;
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
      if (reduced.matches || !renderer.animated || scrolling || !visible) {
        position = target;
        target = null;
        render(true);
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
        render(true, false);
        resume();
      }
    });
    stage.addEventListener("pointerleave", () => {
      hovered = false;
      resume();
    });
    gallery.addEventListener("focusin", () => {
      focused = true;
      render(true);
      resume();
    });
    gallery.addEventListener("focusout", (event) => {
      if (!gallery.contains(event.relatedTarget)) {
        focused = false;
        render(true);
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
      render(true, false);
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
    const suspendForScroll = () => {
      scrolling = true;
      if (paintFrame) cancelAnimationFrame(paintFrame);
      paintFrame = 0;
      resume();
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        scrolling = false;
        if (visible && !document.hidden)
          render(true, needsResize || needsPaint);
        resume();
      }, 160);
    };
    window.addEventListener("scroll", suspendForScroll, { passive: true });
    window.addEventListener(
      "wheel",
      (event) => {
        if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) suspendForScroll();
      },
      { passive: true },
    );
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && paintFrame) {
        cancelAnimationFrame(paintFrame);
        paintFrame = 0;
      }
      if (!document.hidden && (needsPaint || needsResize)) requestPaint();
      resume();
    });
    new MutationObserver(resume).observe(preview, {
      attributes: true,
      attributeFilter: ["open"],
    });
    reduced.addEventListener("change", () => {
      paused = reduced.matches;
      target = null;
      position = Math.round(position);
      requestPaint();
      updatePause();
    });
    const queueResize = () => {
      needsResize = true;
      requestPaint();
    };
    if (typeof ResizeObserver === "function")
      new ResizeObserver(queueResize).observe(stage);
    else window.addEventListener("resize", queueResize, { passive: true });
    new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible && (needsResize || needsPaint)) requestPaint();
        resume();
      },
      { threshold: 0.01 },
    ).observe(gallery);
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      const replacement = canvas.cloneNode();
      canvas.replaceWith(replacement);
      canvas = replacement;
      renderer = createStaticRenderer(canvas, photos);
      renderer.onReady = requestPaint;
      stage.dataset.renderer = renderer.name;
      needsResize = true;
      requestPaint();
      updatePause();
    });
    render(true);
    updatePause();
  }

  setupGallery();
}
