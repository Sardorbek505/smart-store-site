// The original three articles are the cube faces: no duplicated product UI.
export function init() {
  const section = document.getElementById("features");
  const stage = section.querySelector(".bento-grid");
  const cards = [...stage.querySelectorAll(".bento")];
  const previous = document.getElementById("feature-prev");
  const next = document.getElementById("feature-next");
  const count = document.getElementById("feature-count");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const controls = section.querySelector(".feature-controls");
  if (
    !Element.prototype.animate ||
    !window.ResizeObserver ||
    !window.IntersectionObserver ||
    !CSS.supports("transform-style", "preserve-3d") ||
    getComputedStyle(section)
      .getPropertyValue("--feature-cubes-version")
      .trim() !== "67"
  ) {
    // Cached HTML/CSS may predate the two-cube layout. Keep its native cards.
    section.dataset.featureFallback = "true";
    section.dispatchEvent(new Event("featurechange"));
    return;
  }
  const previewIndex = () =>
    cards.findIndex(
      (card) =>
        card.querySelector(".feature-screen-link").href ===
        history.state?.smartStoreScreen?.src,
    );
  const initialPreview = previewIndex();
  let selected = Math.max(0, initialPreview),
    queued,
    rotation = reduced.matches || initialPreview >= 0 ? -selected * 90 : 90;
  let entered = reduced.matches || initialPreview >= 0,
    visible = false,
    scrolling = false,
    touching = false;
  let animations = [],
    revision = 0,
    idleTimer,
    entryTimer;
  let pointer,
    suppressClick = false;
  const planes = [];
  const dialogs = [...document.querySelectorAll("dialog")];
  const mobile = matchMedia("(max-width: 850px) and (orientation: portrait)");
  cards.forEach((card, index) => {
    const copy = card.querySelector(".bento-copy");
    const visual = card.querySelector(".feature-art");
    card.dataset.featureSelected = String(index === 0);
    card.setAttribute("role", "group");
    card.setAttribute("aria-roledescription", "слайд");
    card.setAttribute("aria-label", `${index + 1} из ${cards.length}`);
    const number = document.createElement("span");
    number.className = "feature-step";
    number.setAttribute("aria-hidden", "true");
    number.textContent = String(index + 1).padStart(2, "0");
    copy.prepend(number);
    const link = card.querySelector(".feature-screen-link");
    const label = document.createElement("span");
    label.className = "cube-screen-label";
    label.innerHTML =
      'Рассмотреть экран <svg class="icon" aria-hidden="true"><use href="#i-zoom" /></svg>';
    link.append(label);
    visual.append(link);
    const replay = card.querySelector(".micro-replay");
    const text = document.createElement("span");
    text.textContent = "Ещё раз";
    replay.append(text);
    planes.push(
      { element: copy, index, side: 1 },
      { element: visual, index, side: -1 },
    );
  });
  const cover = document.createElement("div");
  cover.className = "feature-cube-cover";
  cover.setAttribute("aria-hidden", "true");
  cover.inert = true;
  const coverCopy = document.createElement("div");
  coverCopy.className = "cube-cover-copy";
  coverCopy.innerHTML =
    '<span class="cube-cover-kicker">SMART STORE</span><strong>01—03</strong><span>Всё связано.</span><small>Продажи · Склад · Контроль</small>';
  const coverVisual = document.createElement("div");
  coverVisual.className = "cube-cover-visual";
  coverVisual.innerHTML =
    '<span class="cube-cover-kicker">ОДНА СИСТЕМА</span><div class="cube-cover-bars"><i></i><i></i><i></i><i></i><i></i></div><span class="cube-cover-caption">От первой продажи.<br>До итогов дня.</span>';
  cover.append(coverCopy, coverVisual);
  stage.append(cover);
  planes.push(
    { element: coverCopy, index: 3, side: 1 },
    { element: coverVisual, index: 3, side: -1 },
  );
  section.classList.add("feature-cubes-ready");
  stage.setAttribute("aria-roledescription", "карусель");
  stage.setAttribute(
    "aria-label",
    "Возможности Smart Store. Переключайте стрелками или свайпом.",
  );
  const notify = () => section.dispatchEvent(new Event("featurechange"));
  const blocked = () =>
    scrolling ||
    touching ||
    document.hidden ||
    dialogs.some((dialog) => dialog.open);
  const pose = ({ element, index, side }, turn) => {
    const depth = element.offsetHeight / 2;
    return `translateZ(${-depth}px) rotateX(${side * (turn + index * 90)}deg) translateZ(${depth}px)`;
  };
  const paint = () =>
    planes.forEach((plane) => {
      plane.element.style.transform = pose(plane, rotation);
    });
  const update = () => {
    const moving = animations.length > 0;
    section.dataset.featureMotion = moving ? "running" : "idle";
    section.dataset.featureEntered = String(entered);
    section.dataset.featureIndex = String(selected);
    cards.forEach((card, index) => {
      card.dataset.featureSelected = String(index === selected);
      card.setAttribute("aria-hidden", String(index !== selected));
      card.inert = index !== selected;
    });
    previous.disabled = selected === 0;
    next.disabled = selected === cards.length - 1;
    count.textContent = `${String(selected + 1).padStart(2, "0")} / ${String(cards.length).padStart(2, "0")}`;
    notify();
  };
  const settle = () => {
    revision++;
    for (const animation of animations) animation.cancel();
    animations = [];
    paint();
    update();
  };
  const sync = () => {
    clearTimeout(entryTimer);
    if (visible && !blocked() && !entered) {
      entryTimer = setTimeout(() => {
        if (!visible || blocked() || entered) return;
        entered = true;
        turn(0, 0, true);
      }, 240);
    }
    for (const animation of animations)
      visible && !blocked() ? animation.play() : animation.pause();
  };
  const turn = (index, target, intro = false) => {
    const start = rotation;
    selected = index;
    rotation = target;
    if (reduced.matches) {
      settle();
      return;
    }
    const generation = ++revision;
    animations = planes.map((plane) => {
      const animation = plane.element.animate(
        [{ transform: pose(plane, start) }, { transform: pose(plane, target) }],
        {
          duration: intro ? 1080 : 860,
          delay: plane.side < 0 ? 60 : 0,
          easing: "cubic-bezier(.22,.7,.16,1)",
          fill: "both",
        },
      );
      animation.pause();
      return animation;
    });
    update();
    Promise.all(animations.map((animation) => animation.finished))
      .then(() => {
        if (generation !== revision) return;
        settle();
        if (queued !== undefined) {
          const index = queued;
          queued = undefined;
          go(index);
        }
      })
      .catch(() => {});
    sync();
  };
  const go = (index) => {
    const target = Math.max(0, Math.min(cards.length - 1, index));
    if (!entered) {
      entered = true;
      rotation = 0;
      paint();
    }
    if (animations.length) {
      queued = target;
      return;
    }
    if (target === selected) {
      update();
      return;
    }
    turn(target, -target * 90);
  };
  previous.addEventListener("click", () => go((queued ?? selected) - 1));
  next.addEventListener("click", () => go((queued ?? selected) + 1));
  stage.addEventListener("keydown", (event) => {
    if (event.target !== stage) return;
    const targets = {
      ArrowLeft: selected - 1,
      ArrowRight: selected + 1,
      Home: 0,
      End: cards.length - 1,
    };
    if (!(event.key in targets)) return;
    event.preventDefault();
    go(targets[event.key]);
  });
  stage.addEventListener("focusin", () => {
    if (entered && !animations.length) return;
    entered = true;
    rotation = -selected * 90;
    queued = undefined;
    settle();
  });
  stage.addEventListener("pointerdown", (event) => {
    if (
      !event.isPrimary ||
      event.button !== 0 ||
      event.target.closest("button")
    )
      return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    suppressClick = false;
  });
  stage.addEventListener("pointermove", (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x,
      dy = event.clientY - pointer.y;
    if (Math.abs(dx) > 20 && Math.abs(dx) > Math.abs(dy) * 1.3)
      suppressClick = true;
  });
  stage.addEventListener("pointerup", (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x,
      dy = event.clientY - pointer.y;
    pointer = undefined;
    if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      suppressClick = true;
      go(selected + (dx < 0 ? 1 : -1));
    }
  });
  stage.addEventListener("pointercancel", () => {
    pointer = undefined;
  });
  stage.addEventListener(
    "click",
    (event) => {
      if (!suppressClick) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressClick = false;
    },
    true,
  );
  const geometry = () => {
    section.dataset.featureCompact = String(
      mobile.matches && innerWidth <= 620 && stage.clientHeight < 400,
    );
    if (animations.length) {
      queued = undefined;
      settle();
    }
    paint();
  };
  new ResizeObserver(geometry).observe(stage);
  mobile.addEventListener("change", geometry);
  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= 0.72;
      sync();
    },
    { threshold: [0, 0.72], rootMargin: "-80px 0px -20px 0px" },
  ).observe(stage);
  document.addEventListener(
    "scroll",
    () => {
      scrolling = true;
      sync();
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
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("pagehide", () => {
    touching = false;
    scrolling = true;
    sync();
  });
  window.addEventListener("pageshow", () => {
    scrolling = false;
    sync();
  });
  window.addEventListener("popstate", () => {
    const index = previewIndex();
    if (index < 0 || (index === selected && entered)) return;
    selected = index;
    entered = true;
    rotation = -index * 90;
    queued = undefined;
    settle();
  });
  reduced.addEventListener("change", () => {
    if (reduced.matches) {
      entered = true;
      rotation = -selected * 90;
      queued = undefined;
      settle();
    }
    sync();
  });
  const observer = new MutationObserver(sync);
  dialogs.forEach((dialog) =>
    observer.observe(dialog, { attributes: true, attributeFilter: ["open"] }),
  );
  controls.hidden = false;
  geometry();
  update();
}
