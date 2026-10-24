// Keep browser chrome/keyboard movement from resizing the entire document.
export function init() {
  if (!document.body.classList.contains("landing-page")) return;
  const body = document.body;
  const touch = matchMedia("(pointer: coarse)");
  const frames = [...document.querySelectorAll(".screen-content")];
  let width = window.innerWidth;
  let height = window.innerHeight;
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
  const setHeight = () => {
    const nextWidth = window.innerWidth;
    const nextHeight = window.innerHeight;
    // On touch devices, height-only changes are browser bars or the keyboard.
    if (touch.matches && Math.abs(nextWidth - width) < 2) return;
    if (!touch.matches && performance.now() - lastScrollAt < 200) {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(setHeight, 200);
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
  window.addEventListener(
    "resize",
    () => {
      if (touch.matches && Math.abs(window.innerWidth - width) < 2) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(setHeight, 120);
    },
    { passive: true },
  );
  if (!touch.matches)
    window.addEventListener(
      "scroll",
      () => {
        lastScrollAt = performance.now();
      },
      { passive: true },
    );
  window.addEventListener("pageshow", queueMeasure);
  queueMeasure();
}
