// A visible, idle story may load 3D. Everything else stays a static poster.
// checkout-bundle:start
const loadScene = () => import("../assets/checkout3d.cd1e07fa3e50.js");
// checkout-bundle:end
export function init() {
  const object = document.querySelector(".checkout-object");
  if (!object) return;
  const stage = document.querySelector(".checkout-stage");
  const canvas = document.getElementById("checkout-canvas");
  const poster = document.getElementById("product-screen");
  const back = document.getElementById("checkout-return");
  // Older cached HTML hid this control instead of disabling it in overview.
  back.hidden = false;
  const dialog = document.getElementById("preview-dialog");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  // Cache changes: reading MQL.matches inside RAF can swallow Chromium's change event.
  let reduceMotion = reduced.matches;
  let visible = false,
    ambientVisible = false,
    scrolling = false,
    touching = false,
    lost = false,
    failed = false;
  let api,
    factory,
    context,
    loading,
    idleTimer,
    renderFrame = 0,
    elapsed = 0,
    lastTime;
  let moving = false,
    pendingSize = true,
    imageAnimation;
  let ambientFrame = 0,
    ambientElapsed = 0,
    ambientLastTime,
    ambientPaintTime,
    ambientFrames = 0;
  let width = object.clientWidth,
    height = object.clientHeight;
  const duration = 800;
  const currentView = () => object.dataset.checkoutView || "overview";
  const leaderSvg = object.querySelector(".checkout-leaders");
  const points = [...stage.querySelectorAll("[data-checkout-point]")];
  const leaders = [...object.querySelectorAll("[data-checkout-leader]")];
  const dots = [...object.querySelectorAll("[data-checkout-dot]")];
  let leaderOrigins = [];
  function paintLeaders(projected) {
    if (!leaderSvg || !leaderOrigins.length) return;
    projected.forEach(([px, py], index) => {
      const [x, y] = leaderOrigins[index];
      const dx = px * width,
        dy = py * height;
      leaders[index].setAttribute(
        "d",
        `M${x} ${y}H${x + (dx - x) * 0.65}L${dx} ${dy}`,
      );
      dots[index].setAttribute("cx", dx);
      dots[index].setAttribute("cy", dy);
    });
  }
  function syncLeaders(projected) {
    if (!leaderSvg || currentView() !== "overview") return;
    const box = object.getBoundingClientRect();
    const scale = Math.min(width / 1000, height / 750);
    const fallback = [
      [353.498, 275.249],
      [534.777, 242.891],
      [526.038, 413.951],
    ];
    leaderSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    leaderSvg.dataset.ready = "true";
    leaderOrigins = points.map((button) => {
      const b = button.getBoundingClientRect();
      return [b.x + b.width / 2 - box.x, b.y + b.height / 2 - box.y];
    });
    paintLeaders(
      projected ||
        fallback.map(([x, y]) => [
          ((width - 1000 * scale) / 2 + x * scale) / width,
          ((height - 750 * scale) / 2 + y * scale) / height,
        ]),
    );
  }
  points.forEach((button) =>
    button.addEventListener("transitionend", (event) => {
      if (["left", "top", "transform"].includes(event.propertyName))
        syncLeaders(api?.stats().landmarks);
    }),
  );
  const active = () =>
    visible &&
    !scrolling &&
    !touching &&
    !document.hidden &&
    !dialog?.open &&
    !lost;
  const stop = () => {
    cancelAnimationFrame(renderFrame);
    renderFrame = 0;
    lastTime = undefined;
  };
  const wantsAmbient = () =>
    api && !lost && currentView() === "overview" && !reduceMotion;
  function stopAmbient() {
    cancelAnimationFrame(ambientFrame);
    ambientFrame = 0;
    ambientLastTime = undefined;
    ambientPaintTime = undefined;
    object.dataset.checkoutAmbient = wantsAmbient() ? "paused" : "off";
  }
  function ambientTick(time) {
    ambientFrame = 0;
    if (
      !active() ||
      !ambientVisible ||
      !wantsAmbient() ||
      moving ||
      pendingSize
    ) {
      stopAmbient();
      return;
    }
    if (ambientLastTime !== undefined)
      ambientElapsed += Math.min(50, time - ambientLastTime);
    ambientLastTime = time;
    // Keep the slow overview at 30 renders/s, including on 120Hz displays.
    if (
      ambientPaintTime === undefined ||
      time - ambientPaintTime >= 1000 / 30 - 0.8
    ) {
      ambientPaintTime = time;
      paintLeaders(api.ambient(ambientElapsed));
      canvas.dataset.ambientPhase = ambientElapsed.toFixed(1);
      canvas.dataset.ambientFrames = String(++ambientFrames);
    }
    ambientFrame = requestAnimationFrame(ambientTick);
  }
  function syncAmbient() {
    if (
      !active() ||
      !ambientVisible ||
      !wantsAmbient() ||
      moving ||
      pendingSize
    ) {
      stopAmbient();
      return;
    }
    if (!ambientFrame) {
      object.dataset.checkoutAmbient = "playing";
      ambientFrame = requestAnimationFrame(ambientTick);
    }
  }
  const stats = () => {
    if (!api) return;
    const state = api.stats();
    canvas.dataset.draws = String(state.draws);
    canvas.dataset.cameraDistance = state.distance.toFixed(3);
    canvas.dataset.region = JSON.stringify(state.region);
    syncLeaders(state.landmarks);
  };
  const motion = (value) => {
    object.dataset.checkoutMotion = value;
  };
  const frame = (time) => {
    renderFrame = 0;
    if (!active() || !moving || !api) return;
    if (lastTime !== undefined) elapsed += Math.min(time - lastTime, 50);
    lastTime = time;
    api.draw(Math.min(1, elapsed / duration));
    if (elapsed >= duration) {
      moving = false;
      lastTime = undefined;
      motion("idle");
      stats();
      syncAmbient();
    } else renderFrame = requestAnimationFrame(frame);
  };
  function drawStatic() {
    if (!api || !active()) return;
    if (pendingSize) {
      api.resize(width, height, devicePixelRatio || 1);
      pendingSize = false;
      api.focus(currentView());
    }
    if (wantsAmbient()) api.ambient(ambientElapsed);
    else api.draw(1);
    stats();
    object.dataset.checkoutRenderer = "webgl";
    motion("idle");
    syncAmbient();
  }
  function sync() {
    imageAnimation &&
      (active() ? imageAnimation.play() : imageAnimation.pause());
    if (!active()) {
      stop();
      stopAmbient();
      if (moving) motion("paused");
      return;
    }
    if (api) {
      if (pendingSize) {
        stop();
        moving = false;
        drawStatic();
      } else if (moving && !renderFrame) {
        motion("running");
        renderFrame = requestAnimationFrame(frame);
      } else if (object.dataset.checkoutRenderer !== "webgl") drawStatic();
      syncAmbient();
    } else if (!failed) ensure();
  }
  async function ensure() {
    if (loading || api || failed || !active()) return;
    loading = true;
    try {
      context ||= canvas.getContext("webgl2", {
        alpha: true,
        antialias: true,
        stencil: false,
        powerPreference: "low-power",
      });
      if (!context) throw new Error("No WebGL2");
      factory ||= (await loadScene()).createCheckoutScene;
      if (!active()) return;
      api = await factory({ canvas, context });
      api.focus(currentView());
      pendingSize = true;
      if (active()) drawStatic();
    } catch {
      failed = true;
      syncPoster();
      object.dataset.checkoutRenderer = "poster";
      motion("idle");
    } finally {
      loading = false;
    }
  }
  function syncPoster() {
    const view = currentView();
    const src = `img/checkout-${view === "overview" ? "overview" : view}-v46.webp`;
    if (poster.getAttribute("src") !== src) poster.src = src;
    syncLeaders();
  }
  function changeView() {
    const view = currentView();
    back.disabled = view === "overview";
    if (!api || lost) syncPoster();
    imageAnimation?.cancel();
    imageAnimation = undefined;
    stop();
    stopAmbient();
    ambientElapsed = 0;
    elapsed = 0;
    moving = false;
    if (api && !lost) {
      if (pendingSize) {
        api.resize(width, height, devicePixelRatio || 1);
        pendingSize = false;
      }
      api.focus(view);
      if (reduceMotion) {
        if (active()) {
          api.draw(1);
          stats();
        }
        motion("idle");
      } else {
        moving = true;
        sync();
      }
    } else {
      if (!reduceMotion && poster.animate) {
        imageAnimation = poster.animate(
          [
            { opacity: 0.35, transform: "scale(.98)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 280, easing: "ease-out" },
        );
        const current = imageAnimation;
        current.finished
          .then(() => {
            if (imageAnimation === current) {
              imageAnimation = undefined;
              syncLeaders();
            }
          })
          .catch(() => {});
      }
      sync();
    }
  }
  object.addEventListener("checkout:focus", changeView);
  back.addEventListener("click", () => {
    object.dispatchEvent(new CustomEvent("checkout:overview"));
    stage
      .querySelector('[data-checkout-point="0"]')
      .focus({ preventScroll: true });
  });
  stage.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      !dialog?.open &&
      currentView() !== "overview"
    ) {
      event.preventDefault();
      back.click();
    }
  });
  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= 0.1;
      ambientVisible = entry.intersectionRatio >= 0.6;
      sync();
    },
    { threshold: [0, 0.1, 0.6] },
  ).observe(stage);
  new ResizeObserver(() => {
    const nextWidth = object.clientWidth,
      nextHeight = object.clientHeight;
    if (width === nextWidth && height === nextHeight) return;
    width = nextWidth;
    height = nextHeight;
    pendingSize = true;
    syncLeaders(api?.stats().landmarks);
    sync();
  }).observe(object);
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
    touching = false;
    sync();
  };
  window.addEventListener("pointerup", release, { passive: true });
  window.addEventListener("pointercancel", release, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) touching = false;
    sync();
  });
  window.addEventListener("pagehide", () => {
    clearTimeout(idleTimer);
    scrolling = true;
    sync();
  });
  window.addEventListener("pageshow", () => {
    touching = false;
    scrolling = false;
    sync();
  });
  new MutationObserver(sync).observe(dialog, {
    attributes: true,
    attributeFilter: ["open"],
  });
  reduced.addEventListener("change", (event) => {
    reduceMotion = event.matches;
    if (reduceMotion) {
      stop();
      stopAmbient();
      ambientElapsed = 0;
      moving = false;
      imageAnimation?.cancel();
      imageAnimation = undefined;
      if (active() && api) {
        api.draw(1);
        stats();
      } else pendingSize = true;
      motion("idle");
    }
    sync();
  });
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    lost = true;
    stopAmbient();
    syncPoster();
    stop();
    moving = false;
    object.dataset.checkoutRenderer = "poster";
    motion("idle");
  });
  canvas.addEventListener("webglcontextrestored", () => {
    setTimeout(() => {
      lost = false;
      pendingSize = true;
      api?.focus(currentView());
      sync();
    }, 0);
  });
  motion("idle");
  object.dataset.checkoutAmbient = "off";
  if (currentView() === "overview") {
    back.disabled = true;
    syncPoster();
    sync();
  } else changeView();
}
