// A visible, idle story may load 3D. Everything else stays a static poster.
// checkout-bundle:start
const loadScene = () => import("../assets/checkout3d.93d001d1e844.js");
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
  let visible = false,
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
  let width = object.clientWidth,
    height = object.clientHeight;
  const duration = 800;
  const currentView = () => object.dataset.checkoutView || "overview";
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
  const stats = () => {
    if (!api) return;
    canvas.dataset.draws = String(api.stats().draws);
    canvas.dataset.cameraDistance = api.stats().distance.toFixed(3);
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
    } else renderFrame = requestAnimationFrame(frame);
  };
  function drawStatic() {
    if (!api || !active()) return;
    if (pendingSize) {
      api.resize(width, height, devicePixelRatio || 1);
      pendingSize = false;
      api.focus(currentView());
    }
    api.draw(1);
    stats();
    object.dataset.checkoutRenderer = "webgl";
    motion("idle");
  }
  function sync() {
    imageAnimation &&
      (active() ? imageAnimation.play() : imageAnimation.pause());
    if (!active()) {
      stop();
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
    const src = `img/checkout-${view === "overview" ? "overview" : view}-v44.webp`;
    if (poster.getAttribute("src") !== src) poster.src = src;
  }
  function changeView() {
    const view = currentView();
    back.disabled = view === "overview";
    if (!api || lost) syncPoster();
    imageAnimation?.cancel();
    imageAnimation = undefined;
    stop();
    elapsed = 0;
    moving = false;
    if (api && !lost) {
      if (pendingSize) {
        api.resize(width, height, devicePixelRatio || 1);
        pendingSize = false;
      }
      api.focus(view);
      if (reduced.matches) {
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
      if (!reduced.matches && poster.animate) {
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
            if (imageAnimation === current) imageAnimation = undefined;
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
      visible = entry.isIntersecting;
      sync();
    },
    { threshold: 0.1 },
  ).observe(stage);
  new ResizeObserver(() => {
    const nextWidth = object.clientWidth,
      nextHeight = object.clientHeight;
    if (width === nextWidth && height === nextHeight) return;
    width = nextWidth;
    height = nextHeight;
    pendingSize = true;
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
  reduced.addEventListener("change", () => {
    if (reduced.matches) {
      stop();
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
  if (currentView() === "overview") {
    back.disabled = true;
    syncPoster();
    sync();
  } else changeView();
}
