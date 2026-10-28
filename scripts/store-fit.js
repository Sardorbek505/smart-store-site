// The reference's paired, closed cubes: one shop label, one photograph.
export function init() {
  const root = document.getElementById("for-stores");
  const sources = root?.querySelector(".fit-grid");
  const cards = [...(sources?.querySelectorAll("[data-shop-kind]") || [])];
  const controls = root?.querySelector(".fit-object-controls");
  if (
    !controls ||
    !cards.length ||
    !Element.prototype.animate ||
    !window.ResizeObserver ||
    !window.IntersectionObserver ||
    !CSS.supports("transform-style", "preserve-3d") ||
    getComputedStyle(root).getPropertyValue("--fit-cubes-version").trim() !== "76"
  )
    return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const toggle = controls.querySelector("[data-fit-auto]"),
    count = controls.querySelector("output"),
    caption = controls.querySelector(".fit-benefit");
  const dialogs = [...document.querySelectorAll("dialog")];
  const make = (tag, cls) => {
    const el = document.createElement(tag);
    el.className = cls;
    return el;
  };
  const flat =
    "translate(-50%, -50%) translateZ(calc(var(--fit-edge) / -2)) rotateX(0deg) rotateY(0deg)";
  const volume =
    "translate(-50%, -50%) translateZ(calc(var(--fit-edge) / -2)) rotateX(-12deg) rotateY(-16deg)";
  const scene = make("div", "fit-solid-scene");
  scene.setAttribute("role", "group");
  scene.setAttribute("aria-label", "Автоматическая витрина форматов магазинов.");
  const camera = make("div", "fit-solid-camera");
  camera.setAttribute("aria-hidden", "true");
  const bodies = ["label", "photo"].map((kind) => {
    const b = make("div", "fit-solid-body fit-body-" + kind);
    camera.append(b);
    return b;
  });
  const slots = bodies.map((body, side) => {
    const faces = Array.from({ length: 4 }, (_, i) => {
      const face = make("div", "fit-solid-face");
      face.style.transform = `rotateX(${(side ? -1 : 1) * i * 90}deg) translateZ(calc(var(--fit-edge) / 2))`;
      body.append(face);
      return face;
    });
    for (const angle of [-90, 90]) {
      const cap = make("div", "fit-solid-face fit-solid-cap");
      cap.style.transform = `rotateY(${angle}deg) translateZ(calc(var(--fit-edge) / 2))`;
      body.append(cap);
    }
    return faces;
  });
  const photo = (index) => {
    const img = cards[index].querySelector("img").cloneNode();
    img.alt = "";
    img.loading = "eager";
    img.sizes = "70vw";
    return img;
  };
  const label = (index) => {
    const el = make("div", "fit-face-copy");
    const title = make("strong", "fit-face-title");
    title.textContent = cards[index].querySelector("h3").textContent;
    if (index === 0) title.textContent = "Продукты\nу дома";
    el.append(title);
    return el;
  };
  const paint = (slot, index, img) => {
    slots[0][slot].replaceChildren(label(index));
    slots[1][slot].replaceChildren(img);
  };
  const cover = make("div", "fit-flat-cover");
  cover.append(label(0), photo(0));
  camera.append(cover);
  scene.append(camera);
  sources.before(scene);
  sources.classList.add("visually-hidden");
  root.classList.add("fit-solid-ready");
  controls.hidden = false;
  let selected = 0,
    orientation = -1,
    entered = false,
    visible = false,
    moving = false,
    touching = false,
    automatic = !reduced.matches,
    busy = false,
    queued = null,
    animations = [],
    revision = 0,
    finish = null,
    timer,
    restTimer;
  const mod = (i, n = cards.length) => ((i % n) + n) % n;
  const poses = (q) => [`rotateX(${-q * 90}deg)`, `rotateX(${q * 90}deg)`];
  bodies.forEach((b, i) => (b.style.transform = poses(orientation)[i]));
  camera.style.transform = flat;
  root.dataset.fitShape = "flat";
  const allowed = () =>
    visible && !document.hidden && !moving && !touching && !dialogs.some((d) => d.open);
  const render = () => {
    cards.forEach((c, i) => (c.hidden = i !== selected));
    root.dataset.fitIndex = String(selected);
    root.dataset.fitTurning = String(busy);
    count.textContent = `${String(selected + 1).padStart(2, "0")} / ${String(cards.length).padStart(2, "0")}`;
    caption.textContent = cards[selected].querySelector("p").textContent;
    toggle.disabled = reduced.matches;
    toggle.textContent = automatic ? "Пауза" : "Авто";
    toggle.setAttribute("aria-pressed", String(!automatic));
    toggle.setAttribute(
      "aria-label",
      automatic ? "Остановить автоматическую смену" : "Включить автоматическую смену",
    );
    scene.setAttribute("aria-busy", String(busy));
  };
  const sync = () => {
    clearTimeout(timer);
    animations.forEach((a) => (allowed() ? a.play() : a.pause()));
    if (!allowed() || busy) return;
    if (!entered) {
      turn(selected, 1, true);
      return;
    }
    if (automatic && !reduced.matches) timer = setTimeout(() => turn(mod(selected + 1), 1), 3200);
  };
  const turn = async (index, direction, intro = false) => {
    index = mod(index);
    if (busy) {
      queued = { index, direction };
      return;
    }
    if (!intro && index === selected) return;
    clearTimeout(timer);
    busy = true;
    const generation = ++revision;
    const destination = intro ? 0 : orientation + direction;
    const img = photo(index);
    render();
    await img.decode().catch(() => {});
    if (generation !== revision) return;
    paint(mod(destination, 4), index, img);
    const done = () => {
      if (generation !== revision) return;
      revision++;
      bodies.forEach((b, i) => (b.style.transform = poses(destination)[i]));
      camera.style.transform = volume;
      cover.hidden = true;
      slots.flat().forEach((face) => {
        if (face !== slots[0][mod(destination, 4)] && face !== slots[1][mod(destination, 4)])
          face.replaceChildren();
      });
      animations.forEach((a) => a.cancel());
      animations = [];
      finish = null;
      orientation = destination;
      selected = index;
      entered = true;
      busy = false;
      root.dataset.fitShape = "volume";
      render();
      const pending = queued;
      queued = null;
      if (pending && pending.index !== selected) turn(pending.index, pending.direction);
      else sync();
    };
    finish = done;
    if (reduced.matches) {
      done();
      return;
    }
    root.dataset.fitShape = intro ? "opening" : "volume";
    const options = {
      duration: intro ? 1250 : 1050,
      easing: "cubic-bezier(.22,.72,.16,1)",
      fill: "both",
    };
    animations = bodies.map((body, i) =>
      body.animate([{ transform: poses(orientation)[i] }, { transform: poses(destination)[i] }], {
        ...options,
        delay: i * 50,
      }),
    );
    if (intro) {
      animations.push(
        camera.animate([{ transform: flat }, { transform: volume }], {
          ...options,
          duration: 1350,
        }),
      );
      animations.push(
        cover.animate(
          [
            { opacity: 1, offset: 0 },
            { opacity: 0, offset: 0.32 },
            { opacity: 0, offset: 1 },
          ],
          { ...options, duration: 1350 },
        ),
      );
    }
    Promise.all(animations.map((a) => a.finished))
      .then(done)
      .catch(() => {});
    sync();
  };
  toggle.addEventListener("click", () => {
    automatic = !automatic;
    caption.setAttribute("aria-live", automatic ? "off" : "polite");
    render();
    sync();
  });
  window.addEventListener(
    "scroll",
    () => {
      moving = true;
      sync();
      clearTimeout(restTimer);
      restTimer = setTimeout(() => {
        moving = false;
        sync();
      }, 200);
    },
    { passive: true },
  );
  window.addEventListener(
    "pointerdown",
    (e) => {
      if (e.pointerType === "touch") {
        touching = true;
        sync();
      }
    },
    { passive: true },
  );
  for (const event of ["pointerup", "pointercancel"])
    window.addEventListener(
      event,
      () => {
        touching = false;
        sync();
      },
      { passive: true },
    );
  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= 0.65;
      sync();
    },
    { threshold: [0, 0.65], rootMargin: "-80px 0px -20px 0px" },
  ).observe(scene);
  new ResizeObserver(() => {
    const edge = Math.min(scene.clientWidth * 0.44, scene.clientHeight * 0.74);
    scene.style.setProperty("--fit-edge", `${edge}px`);
    if (animations.length) finish?.();
  }).observe(scene);
  document.addEventListener("visibilitychange", sync);
  const observer = new MutationObserver(sync);
  dialogs.forEach((d) => observer.observe(d, { attributes: true, attributeFilter: ["open"] }));
  reduced.addEventListener("change", () => {
    if (reduced.matches) {
      automatic = false;
      finish?.();
    }
    render();
    sync();
  });
  window.addEventListener("pageshow", sync);
  render();
}
