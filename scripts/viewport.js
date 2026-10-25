// Keep browser chrome/keyboard movement from resizing the entire document.
export function init() {
  if (!document.body.classList.contains("landing-page")) return;
  const body = document.body;
  const touch = matchMedia("(pointer: coarse)");
  const frames = [...document.querySelectorAll(".screen-content")];
  let width = window.innerWidth;
  // Safari's visible viewport may settle after the first HTML script runs.
  const viewportHeight = () => {
    const viewport = window.visualViewport;
    const matches =
      viewport &&
      Math.abs(viewport.scale - 1) < 0.01 &&
      Math.abs(viewport.width - innerWidth) < 2;
    return Math.round(
      matches ? Math.max(innerHeight, viewport.height) : innerHeight,
    );
  };
  let height = viewportHeight();
  let gesture = false;
  let resizeTimer = 0;
  let measureFrame = 0;
  let lastScrollAt = -1000;
  const measureOverflow = () => {
    measureFrame = 0;
    // Batch reads before changing any scroll-container styles.
    const overflow = frames.map(
      (frame) => frame.scrollHeight - frame.clientHeight > 4,
    );
    frames.forEach((frame, index) => {
      if (frame.classList.contains("is-scrollable") === overflow[index]) return;
      frame.classList.toggle("is-scrollable", overflow[index]);
      if (overflow[index] && !frame.hasAttribute("tabindex")) {
        frame.dataset.viewportTabindex = "true";
        frame.tabIndex = 0;
      } else if (!overflow[index] && frame.dataset.viewportTabindex) {
        frame.removeAttribute("tabindex");
        delete frame.dataset.viewportTabindex;
      }
    });
  };
  const queueMeasure = () => {
    if (!measureFrame) measureFrame = requestAnimationFrame(measureOverflow);
  };
  const queueHeight = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(setHeight, 180);
  };
  const setHeight = () => {
    const nextWidth = window.innerWidth;
    const nextHeight = viewportHeight();
    const rotated = Math.abs(nextWidth - width) >= 2;
    if (touch.matches && !rotated) {
      // Only settle browser-bar changes while the hero is at rest at the top.
      // Never resize the document during a gesture, a form edit or pinch zoom.
      if (
        window.scrollY > 1 ||
        gesture ||
        document.querySelector("dialog[open]") ||
        document.activeElement?.matches(
          'input, textarea, select, [contenteditable="true"]',
        ) ||
        Math.abs((window.visualViewport?.scale ?? 1) - 1) > 0.01
      )
        return;
    }
    if (!rotated && performance.now() - lastScrollAt < 180) {
      queueHeight();
      return;
    }
    width = nextWidth;
    if (height !== nextHeight) {
      height = nextHeight;
      body.style.setProperty("--screen-height", `${height}px`);
    }
    queueMeasure();
  };
  body.style.setProperty("--screen-height", `${height}px`);
  body.classList.add("viewport-ready");
  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(queueMeasure);
    for (const frame of frames) observer.observe(frame);
  }
  document.addEventListener("toggle", queueMeasure, true);
  window.addEventListener("resize", queueHeight, { passive: true });
  window.visualViewport?.addEventListener("resize", queueHeight, {
    passive: true,
  });
  window.addEventListener(
    "scroll",
    () => {
      lastScrollAt = performance.now();
      if (touch.matches && window.scrollY <= 1) queueHeight();
    },
    { passive: true },
  );
  if (touch.matches) {
    window.addEventListener(
      "pointerdown",
      () => {
        gesture = true;
      },
      { passive: true },
    );
    const release = () => {
      gesture = false;
      queueHeight();
    };
    window.addEventListener("pointerup", release, { passive: true });
    window.addEventListener("pointercancel", release, { passive: true });
  }
  window.addEventListener("pageshow", () => {
    queueHeight();
    queueMeasure();
  });
  queueMeasure();
}
