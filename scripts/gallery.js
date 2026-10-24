const { createStaticRenderer } = await import(
  `./ribbon-renderer.js${new URL(import.meta.url).search}`
);

export function init() {
  const gallery = document.querySelector(".hero-gallery");
  if (!gallery) return;
  const stage = gallery.querySelector(".gallery-stage");
  const cards = [...gallery.querySelectorAll("[data-gallery-card]")];
  const photos = cards.map((card) => card.querySelector("img"));
  const canvas = document.createElement("canvas");
  canvas.className = "ribbon-canvas";
  canvas.setAttribute("aria-hidden", "true");
  const renderer = createStaticRenderer(canvas);
  if (!renderer) return;
  stage.prepend(canvas);
  stage.dataset.renderer = "static-2d";
  const bounds = gallery.getBoundingClientRect();
  let visible = bounds.bottom > 0 && bounds.top < innerHeight;
  let position = 0.35;
  let paintFrame = 0;
  let dirty = true;
  let displayed = -1;
  let focusedIndex = -1;
  let pointer = null;
  let dragged = false;
  let sourceVersion = 0;
  let painted = "";
  const sources = new Map();
  const pending = new Map();
  const styles = new WeakMap();
  const wrap = (value) =>
    ((value % cards.length) + cards.length) % cards.length;

  const render = () => {
    // Keep native image links visible until their sharp decoded sources exist.
    if (
      photos.some(
        (photo) => sources.get(photo)?.url !== (photo.currentSrc || photo.src),
      )
    )
      return;
    const width = stage.clientWidth,
      height = stage.clientHeight;
    if (!width || !height) return;
    const density = Math.min(devicePixelRatio || 1, 3);
    const signature = [
      width,
      height,
      density,
      position,
      focusedIndex,
      sourceVersion,
    ].join(":");
    if (signature === painted) {
      dirty = false;
      return;
    }
    const pixelsWide = Math.round(width * density),
      pixelsHigh = Math.round(height * density);
    if (canvas.width !== pixelsWide) canvas.width = pixelsWide;
    if (canvas.height !== pixelsHigh) canvas.height = pixelsHigh;
    const radius = width * (width < 621 ? 0.5 : width < 851 ? 0.38 : 0.28);
    const camera = radius * 1.5;
    const step = 0.85,
      gap = 0.018;
    const photoHeight = Math.min(
      height * (width < 851 ? 0.65 : 0.5),
      width * (width < 621 ? 0.33 : width < 851 ? 0.22 : 0.15),
    );
    const segments = width < 621 ? 40 : 64;
    const items = [];
    for (const [index, card] of cards.entries()) {
      const distance =
        wrap(index - position + cards.length / 2) - cards.length / 2;
      const leftAngle = distance * step - (step - gap) / 2;
      const rightAngle = leftAngle + step - gap;
      if (rightAngle < -1.55 || leftAngle > 1.55) {
        card.hidden = true;
        continue;
      }
      const start = Math.max(leftAngle, -1.55),
        end = Math.min(rightAngle, 1.55);
      const points = Array.from({ length: segments + 1 }, (_, slice) => {
        const angle = start + ((end - start) * slice) / segments;
        const scale = camera / (camera - radius * (1 - Math.cos(angle)));
        return {
          x: width / 2 + radius * Math.sin(angle) * scale,
          top: height / 2 - (photoHeight * scale) / 2,
          bottom: height / 2 + (photoHeight * scale) / 2,
          u: (angle - leftAngle) / (step - gap),
        };
      });
      const left = points[0].x,
        right = points.at(-1).x;
      const top = Math.min(...points.map((p) => p.top)),
        bottom = Math.max(...points.map((p) => p.bottom));
      if (right <= 0 || left >= width || right <= left) {
        card.hidden = true;
        continue;
      }
      card.hidden = false;
      const polygon = [
        ...points.map(
          (p) => `${(p.x - left).toFixed(2)}px ${(p.top - top).toFixed(2)}px`,
        ),
        ...points
          .toReversed()
          .map(
            (p) =>
              `${(p.x - left).toFixed(2)}px ${(p.bottom - top).toFixed(2)}px`,
          ),
      ];
      const style = `left:${left}px;top:${top}px;width:${right - left}px;height:${bottom - top}px;clip-path:polygon(${polygon.join(",")});`;
      if (styles.get(card) !== style) {
        card.style.cssText = style;
        styles.set(card, style);
      }
      card.tabIndex = Math.abs(distance) < 1.4 ? 0 : -1;
      const source = sources.get(photos[index]);
      items.push({
        index,
        points,
        left,
        right,
        top,
        bottom,
        aspect: (radius * (step - gap)) / photoHeight,
        image:
          source?.url === (photos[index].currentSrc || photos[index].src)
            ? source.image
            : null,
        focused: index === focusedIndex,
      });
    }
    renderer.draw(items, width, height);
    painted = signature;
    stage.classList.add("ribbon-ready");
    stage.dataset.ready = "true";
    const selected = wrap(Math.round(position));
    if (displayed !== selected) {
      document.getElementById("gallery-count").textContent = String(
        selected + 1,
      ).padStart(2, "0");
      displayed = selected;
    }
    dirty = false;
  };
  const requestRender = () => {
    dirty = true;
    if (!visible || document.hidden || paintFrame) return;
    paintFrame = requestAnimationFrame(() => {
      paintFrame = 0;
      if (visible && !document.hidden) render();
    });
  };
  const prepare = async (photo) => {
    const url = photo.currentSrc || photo.src;
    if (sources.get(photo)?.url === url || pending.get(photo) === url) return;
    pending.set(photo, url);
    try {
      await photo.decode();
      let image;
      if (typeof createImageBitmap === "function") {
        try {
          image = await createImageBitmap(photo);
        } catch {
          /* Use the selected image URL below. */
        }
      }
      if (!image) {
        image = new Image();
        image.decoding = "async";
        image.src = url;
        await image.decode();
      }
      if ((photo.currentSrc || photo.src) !== url) {
        image.close?.();
        return;
      }
      sources.get(photo)?.image?.close?.();
      sources.set(photo, { url, image });
      sourceVersion++;
      requestRender();
    } catch {
      if ((photo.currentSrc || photo.src) === url) {
        sources.set(photo, { url, image: null });
        sourceVersion++;
        requestRender();
      }
    } finally {
      if (pending.get(photo) === url) pending.delete(photo);
    }
  };
  for (const photo of photos) {
    photo.loading = "eager";
    photo.addEventListener("load", () => prepare(photo));
    if (photo.complete && photo.naturalWidth) prepare(photo);
  }
  const move = (direction) => {
    position = wrap(Math.round(position) + direction);
    requestRender();
    const index = Math.round(position);
    document.getElementById("gallery-status").textContent =
      `${index + 1} из ${cards.length}: ${cards[index].dataset.title}`;
  };
  gallery.querySelector(".gallery-controls").hidden = false;
  document
    .getElementById("gallery-next")
    .addEventListener("click", () => move(1));
  document
    .getElementById("gallery-prev")
    .addEventListener("click", () => move(-1));
  gallery.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    move(event.key === "ArrowRight" ? 1 : -1);
  });
  const updateFocus = () => {
    const next = cards.findIndex(
      (card) =>
        card === document.activeElement && card.matches(":focus-visible"),
    );
    if (next === focusedIndex) return;
    focusedIndex = next;
    requestRender();
  };
  gallery.addEventListener("focusin", updateFocus);
  gallery.addEventListener("focusout", () => queueMicrotask(updateFocus));
  stage.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    dragged = false;
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
    if (dragged && Math.abs(dx) > 35) move(dx < 0 ? 1 : -1);
  });
  window.addEventListener("pointercancel", () => {
    pointer = null;
    dragged = false;
  });
  stage.addEventListener(
    "click",
    (event) => {
      if (!dragged) return;
      event.preventDefault();
      event.stopPropagation();
      dragged = false;
    },
    true,
  );
  stage.addEventListener("dragstart", (event) => event.preventDefault());
  if (typeof ResizeObserver === "function")
    new ResizeObserver(requestRender).observe(stage);
  else window.addEventListener("resize", requestRender, { passive: true });
  if (typeof IntersectionObserver === "function") {
    new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible && dirty) requestRender();
      },
      { threshold: 0.01 },
    ).observe(gallery);
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && dirty) requestRender();
  });
  requestRender();
}
