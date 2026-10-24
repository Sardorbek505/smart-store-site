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
    // Project each photograph onto the inside of a cylinder. Vertical texture
    // strips bend with the surface, unlike individually rotated flat cards.
    const canvas = document.createElement("canvas");
    canvas.className = "ribbon-canvas";
    canvas.setAttribute("aria-hidden", "true");
    const context = canvas.getContext("2d", { alpha: true });
    let width = stage.clientWidth;
    let height = stage.clientHeight;
    const photos = cards.map((card) => card.querySelector("img"));
    if (context) stage.prepend(canvas);
    const resize = () => {
      width = stage.clientWidth;
      height = stage.clientHeight;
      if (!context) return;
      const density = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * density);
      canvas.height = Math.round(height * density);
      context.setTransform(density, 0, 0, density, 0, 0);
    };
    const render = () => {
      if (!context) return;
      context.clearRect(0, 0, width, height);
      const radius = width * (width < 621 ? 0.5 : width < 851 ? 0.38 : 0.28);
      const camera = radius * 1.5;
      const step = 0.85;
      const gap = 0.018;
      const photoHeight = Math.min(
        height * (width < 851 ? 0.65 : 0.5),
        width * (width < 621 ? 0.33 : width < 851 ? 0.22 : 0.15),
      );
      const slices = width < 621 ? 48 : 96;
      const project = (angle) => {
        const depth = radius * (1 - Math.cos(angle));
        const scale = camera / (camera - depth);
        return {
          x: width / 2 + radius * Math.sin(angle) * scale,
          top: height / 2 - (photoHeight * scale) / 2,
          bottom: height / 2 + (photoHeight * scale) / 2,
        };
      };
      for (const [index, card] of cards.entries()) {
        const distance = wrap(index - position + count / 2) - count / 2;
        const leftAngle = distance * step - (step - gap) / 2;
        const rightAngle = leftAngle + step - gap;
        // Clip to the visible arc before projection; wrapped photos never cross
        // the camera plane or flash through the middle of the ribbon.
        if (rightAngle < -1.55 || leftAngle > 1.55) {
          card.hidden = true;
          continue;
        }
        const visibleLeft = Math.max(leftAngle, -1.55);
        const visibleRight = Math.min(rightAngle, 1.55);
        const points = Array.from({ length: slices + 1 }, (_, slice) =>
          project(
            visibleLeft + ((visibleRight - visibleLeft) * slice) / slices,
          ),
        );
        const left = points[0].x;
        const right = points[slices].x;
        const top = Math.min(...points.map((point) => point.top));
        const bottom = Math.max(...points.map((point) => point.bottom));
        const inView = right > 0 && left < width && right > left;
        card.hidden = !inView;
        if (!inView) continue;
        const polygon = [
          ...points.map((point) => `${point.x - left}px ${point.top - top}px`),
          ...points
            .toReversed()
            .map((point) => `${point.x - left}px ${point.bottom - top}px`),
        ];
        card.style.cssText = `left:${left}px;top:${top}px;width:${right - left}px;height:${bottom - top}px;clip-path:polygon(${polygon.join(",")});`;
        card.tabIndex = Math.abs(distance) < 1.4 ? 0 : -1;
        const path = new Path2D();
        const rounding = 6;
        path.moveTo(left, points[0].top + rounding);
        path.quadraticCurveTo(left, points[0].top, points[1].x, points[1].top);
        for (let slice = 2; slice < slices; slice++)
          path.lineTo(points[slice].x, points[slice].top);
        path.quadraticCurveTo(
          right,
          points[slices].top,
          right,
          points[slices].top + rounding,
        );
        path.lineTo(right, points[slices].bottom - rounding);
        path.quadraticCurveTo(
          right,
          points[slices].bottom,
          points[slices - 1].x,
          points[slices - 1].bottom,
        );
        for (let slice = slices - 2; slice > 0; slice--)
          path.lineTo(points[slice].x, points[slice].bottom);
        path.quadraticCurveTo(
          left,
          points[0].bottom,
          left,
          points[0].bottom - rounding,
        );
        path.closePath();
        const image = photos[index];
        if (image.complete && image.naturalWidth) {
          const aspect = (radius * (step - gap)) / photoHeight;
          const sourceWidth = Math.min(
            image.naturalWidth,
            image.naturalHeight * aspect,
          );
          const sourceHeight = sourceWidth / aspect;
          const visibleStart = (visibleLeft - leftAngle) / (step - gap);
          const visibleFraction = (visibleRight - visibleLeft) / (step - gap);
          const sourceX =
            (image.naturalWidth - sourceWidth) / 2 + sourceWidth * visibleStart;
          const visibleSourceWidth = sourceWidth * visibleFraction;
          const sourceY = (image.naturalHeight - sourceHeight) / 2;
          context.save();
          context.clip(path);
          for (let slice = 0; slice < slices; slice++) {
            const a = points[slice];
            const b = points[slice + 1];
            context.drawImage(
              image,
              sourceX + (visibleSourceWidth * slice) / slices,
              sourceY,
              visibleSourceWidth / slices + 0.5,
              sourceHeight,
              a.x,
              Math.min(a.top, b.top),
              b.x - a.x + 0.6,
              Math.max(a.bottom, b.bottom) - Math.min(a.top, b.top),
            );
          }
          context.restore();
        }
        const keyboardFocus =
          card === document.activeElement && card.matches(":focus-visible");
        context.strokeStyle = keyboardFocus
          ? "#EDEDF5"
          : "rgba(237,237,245,0.16)";
        context.lineWidth = keyboardFocus ? 3 : 1;
        context.stroke(path);
      }
      $("gallery-count").textContent = String(
        wrap(Math.round(position)) + 1,
      ).padStart(2, "0");
    };
    if (context) {
      stage.classList.add("ribbon-ready");
      for (const image of photos) {
        image.loading = "eager";
        image.addEventListener("load", render);
      }
      resize();
    } else {
      // Static native image links remain usable when Canvas is unavailable.
      return;
    }
    const preview = $("preview-dialog");
    const wantsMotion = () =>
      visible &&
      !document.hidden &&
      !preview.open &&
      (target !== null ||
        (!paused && !reduced.matches && !hovered && !focused && !pointer));
    let lastPaint = 0;
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
      if (time - lastPaint >= 1000 / 30 || !wantsMotion()) {
        render();
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
      render();
      resume();
    });
    gallery.addEventListener("focusout", (event) => {
      if (!gallery.contains(event.relatedTarget)) {
        focused = false;
        render();
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
      resize();
      render();
    }).observe(stage);
    new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        resume();
      },
      { threshold: 0.1 },
    ).observe(gallery);
    render();
    updatePause();
  }

  setupGallery();
}
