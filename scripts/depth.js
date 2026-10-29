// Optional depth: no sensor values leave the page. Layout and controls stay stable.
const clamp = (n) => Math.max(-1, Math.min(1, n));
export function relativeTilt(beta, gamma, origin, angle = 0) {
  if (![beta, gamma].every((v) => typeof v === "number" && Number.isFinite(v)))
    return null;
  const db = ((beta - origin.beta + 540) % 360) - 180;
  const dg = gamma - origin.gamma;
  const a = angle * Math.PI / 180;
  const quiet = (v) => Math.abs(v) < 0.035 ? 0 : clamp(v);
  return {
    x: quiet((dg * Math.cos(a) + db * Math.sin(a)) / 18),
    y: quiet((db * Math.cos(a) - dg * Math.sin(a)) / 18),
  };
}

export function init() {
  const roots = [...document.querySelectorAll("[data-depth-scene]")];
  if (!roots.length || !CSS.supports("rotate", "1 1 0 1deg")) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const coarse = matchMedia("(pointer: coarse)");
  // Listen passively only. Never request sensor permission or show a prompt.
  const supported = isSecureContext && typeof window.DeviceOrientationEvent !== "undefined";
  let listening = false, received = false, unavailable = false;
  let origin = null, raf = 0, last = 0, scrollTimer = 0;
  let scrolling = false, checking = 0, ended = false;
  const touches = new Set();
  const scenes = roots.map((root) => ({
    root, visible: false, rect: null, x: 0, y: 0, tx: 0, ty: 0,
    layers: [...root.querySelectorAll("[data-depth]")].map((node) => ({
      node, weight: Math.max(-1.3, Math.min(1.3, Number(node.dataset.depth) || 0)),
      flat: node.hasAttribute("data-depth-flat"),
      translate: node.style.translate, rotate: node.style.rotate,
    })),
  }));
  const dialogOpen = () => !!document.querySelector("dialog[open]");
  const blocked = () => ended || document.hidden || reduced.matches || scrolling || touches.size > 0 || dialogOpen();
  const locked = (scene) => !!scene.root.querySelector(":focus-visible");
  function clearScene(scene) {
    scene.x = scene.y = scene.tx = scene.ty = 0;
    scene.rect = null;
    scene.root.removeAttribute("data-depth-engaged");
    for (const layer of scene.layers) {
      layer.node.style.translate = layer.translate;
      layer.node.style.rotate = layer.rotate;
    }
  }
  function reset() {
    cancelAnimationFrame(raf); raf = last = 0; origin = null;
    scenes.forEach(clearScene);
  }
  function render(now) {
    raf = 0;
    if (blocked()) { reset(); return; }
    const blend = 1 - Math.exp(-Math.min(40, last ? now - last : 16) / 95);
    last = now;
    let moving = false;
    for (const scene of scenes) {
      if (!scene.visible || locked(scene)) continue;
      scene.x += (scene.tx - scene.x) * blend;
      scene.y += (scene.ty - scene.y) * blend;
      const settled = Math.abs(scene.tx - scene.x) + Math.abs(scene.ty - scene.y) < 0.002;
      if (settled) { scene.x = scene.tx; scene.y = scene.ty; }
      else moving = true;
      if (!scene.x && !scene.y) { clearScene(scene); continue; }
      scene.root.toggleAttribute("data-depth-engaged", !settled);
      for (const layer of scene.layers) {
        const x = scene.x * layer.weight, y = scene.y * layer.weight;
        layer.node.style.translate = `${(x * 10).toFixed(3)}px ${(y * 10).toFixed(3)}px`;
        if (!layer.flat) {
          const rx = -y * 2.5, ry = x * 2.5;
          layer.node.style.rotate = `${rx.toFixed(4)} ${ry.toFixed(4)} 0 ${Math.hypot(rx, ry).toFixed(4)}deg`;
        }
      }
    }
    if (moving) raf = requestAnimationFrame(render);
    else last = 0;
  }
  function target(scene, x, y) {
    if (Math.abs(scene.tx - x) + Math.abs(scene.ty - y) < 0.01) return;
    scene.tx = x; scene.ty = y;
    if (!raf) raf = requestAnimationFrame(render);
  }
  function sensor(event) {
    if (blocked()) return;
    const next = relativeTilt(event.beta, event.gamma, origin || {beta: 0, gamma: 0});
    if (!next) return;
    if (!origin) origin = {beta: event.beta, gamma: event.gamma};
    received = true; clearTimeout(checking);
    const tilt = relativeTilt(event.beta, event.gamma, origin, screen.orientation?.angle ?? window.orientation ?? 0);
    for (const scene of scenes)
      if (scene.visible && !locked(scene)) target(scene, tilt.x, tilt.y);
  }
  function stopSensor() {
    if (listening) window.removeEventListener("deviceorientation", sensor);
    listening = false; origin = null;
    clearTimeout(checking);
  }
  function syncSensor() {
    const active = supported && !unavailable && coarse.matches && !blocked() && scenes.some((s) => s.visible);
    if (!active) { stopSensor(); return; }
    if (listening) return;
    listening = true; origin = null;
    window.addEventListener("deviceorientation", sensor, {passive: true});
    if (!received) {
      checking = setTimeout(() => {
        unavailable = true; stopSensor(); reset();
      }, 5000);
    }
  }
  function suspend() { stopSensor(); reset(); }
  for (const scene of scenes) {
    scene.root.addEventListener("pointermove", (event) => {
      if (event.pointerType !== "mouse" || coarse.matches || blocked() || !scene.visible) return;
      if (locked(scene) || event.target.closest("a,button,input,select,textarea")) {
        target(scene, 0, 0); return;
      }
      const rect = scene.rect ||= scene.root.getBoundingClientRect();
      target(scene, clamp((event.clientX - rect.left) / rect.width * 2 - 1), clamp((event.clientY - rect.top) / rect.height * 2 - 1));
    }, {passive: true});
    scene.root.addEventListener("pointerleave", () => { scene.rect = null; target(scene, 0, 0); });
    scene.root.addEventListener("focusin", () => { if (locked(scene)) clearScene(scene); });
  }
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const scene = scenes.find((s) => s.root === entry.target);
      scene.visible = entry.isIntersecting;
      scene.rect = null;
      if (!scene.visible) clearScene(scene);
    }
    syncSensor();
  });
  scenes.forEach((scene) => observer.observe(scene.root));
  const resume = () => { if (!blocked()) syncSensor(); };
  window.addEventListener("scroll", () => {
    if (!scrolling) { scrolling = true; suspend(); }
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => { scrolling = false; resume(); }, 170);
  }, {passive: true});
  window.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch") return;
    touches.add(event.pointerId); suspend();
  }, {passive: true});
  const release = (event) => {
    touches.delete(event.pointerId); resume();
  };
  window.addEventListener("pointerup", release, {passive: true});
  window.addEventListener("pointercancel", release, {passive: true});
  document.addEventListener("visibilitychange", () => {
    touches.clear(); suspend(); resume();
  });
  window.addEventListener("pagehide", () => { ended = true; suspend(); });
  window.addEventListener("pageshow", () => { ended = false; resume(); });
  let width = innerWidth;
  window.addEventListener("resize", () => {
    if (width === innerWidth) return;
    width = innerWidth; suspend(); resume();
  }, {passive: true});
  const reorient = () => { suspend(); resume(); };
  window.addEventListener("orientationchange", reorient, {passive: true});
  screen.orientation?.addEventListener("change", reorient);
  const dialogs = new MutationObserver(() => { suspend(); resume(); });
  document.querySelectorAll("dialog").forEach((dialog) => dialogs.observe(dialog, {attributes: true, attributeFilter: ["open"]}));
  reduced.addEventListener("change", () => { suspend(); resume(); });
  coarse.addEventListener("change", () => { suspend(); resume(); });
}
