// Two closed six-face solids. Only the parent bodies rotate; faces stay rigid.
export function init() {
  const section = document.getElementById("features");
  const stage = section.querySelector(".bento-grid");
  const cards = [...stage.querySelectorAll(".bento")];
  const previous = document.getElementById("feature-prev");
  const next = document.getElementById("feature-next");
  const count = document.getElementById("feature-count");
  const controls = section.querySelector(".feature-controls");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  if (
    !Element.prototype.animate ||
    !window.ResizeObserver ||
    !window.IntersectionObserver ||
    !CSS.supports("transform-style", "preserve-3d") ||
    getComputedStyle(section)
      .getPropertyValue("--feature-cubes-version")
      .trim() !== "71"
  ) {
    section.dataset.featureFallback = "true";
    section.dispatchEvent(new Event("featurechange"));
    return;
  }
  const links = cards.map((card) => card.querySelector(".feature-screen-link"));
  const copies = cards.map((card) => card.querySelector(".bento-copy"));
  const actionGroups = [];
  const previewIndex = () =>
    links.findIndex(
      (link) => link.href === history.state?.smartStoreScreen?.src,
    );
  const initialPreview = previewIndex();
  let selected = Math.max(0, initialPreview),
    queued;
  let presented = selected;
  let entered = initialPreview >= 0;
  let revealing = false;
  let rotation = entered ? -selected * 90 : 90;
  let visible = false,
    scrolling = false,
    touching = false;
  let automatic = !reduced.matches,
    focused = false;
  let animations = [],
    revision = 0,
    idleTimer,
    entryTimer,
    autoTimer;
  let pointer,
    suppressClick = false;
  const dialogs = [...document.querySelectorAll("dialog")];
  const scene = document.createElement("div");
  scene.className = "feature-solid-scene";
  const flatPose =
    "translate(-50%, -50%) translateZ(calc(var(--solid-edge) / -2)) rotateX(0deg) rotateY(0deg)";
  const volumePose =
    "translate(-50%, -50%) translateZ(0px) rotateX(-12deg) rotateY(-12deg)";
  const assembly = document.createElement("div");
  assembly.className = "feature-solid-assembly";
  const bodies = ["copy", "visual"].map((kind) => {
    const body = document.createElement("div");
    body.className = `feature-solid-body feature-solid-${kind}`;
    assembly.append(body);
    return body;
  });
  scene.append(assembly);
  const captions = document.createElement("div");
  captions.className = "feature-solid-captions";
  const ringFace = (element, index, side) => {
    element.classList.add("feature-solid-face");
    element.style.transform = `rotateX(${side * index * 90}deg) translateZ(calc(var(--solid-edge) / 2))`;
  };
  cards.forEach((card, index) => {
    const copy = copies[index],
      visual = card.querySelector(".feature-art");
    const heading = copy.querySelector("h3");
    heading.id = `feature-solid-title-${index}`;
    heading
      .querySelectorAll("br")
      .forEach((br) => br.replaceWith(document.createTextNode(" ")));
    card.setAttribute("role", "group");
    card.setAttribute("aria-labelledby", heading.id);
    card.setAttribute("aria-roledescription", "слайд");
    // Keep the replay reachable after its explanatory copy moves below the solids.
    const replay = copy.querySelector(".micro-replay");
    replay.id = `feature-solid-replay-${index}`;
    visual.dataset.replayId = replay.id;
    // Make the compact stock result explain the change rather than a bare count.
    visual.querySelectorAll(".micro-inventory .micro-row").forEach((row) => {
      const origin = document.createElement("span");
      origin.className = "feature-solid-origin";
      origin.setAttribute("aria-hidden", "true");
      origin.textContent = `${row.querySelector(".micro-before").textContent} → `;
      row.querySelector(".micro-after").prepend(origin);
    });
    replay.addEventListener("click", () => stopAutomatic());
    const replayText = document.createElement("span");
    replayText.textContent = "Ещё раз";
    replay.append(replayText);
    const actions = document.createElement("div");
    actions.className = "feature-solid-actions";
    actionGroups.push(actions);
    const link = links[index];
    link.innerHTML =
      'Рассмотреть экран <svg class="icon" aria-hidden="true"><use href="#i-zoom" /></svg>';
    actions.append(link, replay);
    copy.append(actions);
    captions.append(copy);
    ringFace(card, index, -1);
    bodies[1].append(card);
    const label = document.createElement("div");
    label.className = "feature-solid-label";
    label.setAttribute("aria-hidden", "true");
    const number = document.createElement("strong");
    number.textContent = String(index + 1).padStart(2, "0");
    const title = document.createElement("span");
    title.textContent =
      card.dataset.cubeTitle || copy.querySelector(".pill").textContent;
    const footer = document.createElement("small");
    footer.textContent = "SMART STORE";
    label.append(number, title, footer);
    ringFace(label, index, 1);
    bodies[0].append(label);
  });
  bodies.forEach((body, side) => {
    const cover = document.createElement("div");
    cover.className = "feature-solid-cover";
    cover.setAttribute("aria-hidden", "true");
    cover.innerHTML =
      side === 0
        ? "<small>SMART STORE</small><strong>Всё<br>связано.</strong><span>ПРОДАЖИ · СКЛАД · КОНТРОЛЬ</span>"
        : '<small>ОДНА СИСТЕМА</small><div class="feature-solid-bars"><i></i><i></i><i></i><i></i><i></i></div><span>От первой продажи.<br>До итогов дня.</span>';
    ringFace(cover, 3, side === 0 ? 1 : -1);
    body.append(cover);
    // Endcaps close the two remaining sides throughout every rotation.
    for (const sign of [-1, 1]) {
      const cap = document.createElement("div");
      cap.className = "feature-solid-face feature-solid-cap";
      cap.setAttribute("aria-hidden", "true");
      cap.style.transform = `rotateY(${sign * 90}deg) translateZ(calc(var(--solid-edge) / 2))`;
      cap.innerHTML = "<span>SMART STORE</span><i></i>";
      body.append(cap);
    }
  });
  const flatCover = document.createElement("div");
  flatCover.className = "feature-flat-cover";
  flatCover.setAttribute("aria-hidden", "true");
  flatCover.inert = true;
  flatCover.innerHTML =
    '<div><small>SMART STORE</small><strong>Всё<br>связано.</strong></div><div class="feature-flat-flow"><span><i></i>Чек</span><span><i></i>Склад</span><span><i></i>Отчёт</span></div>';
  assembly.append(flatCover);
  stage.append(scene, captions);
  section.classList.add("feature-cubes-ready");
  stage.setAttribute("aria-roledescription", "карусель");
  stage.setAttribute(
    "aria-label",
    "Возможности Smart Store. Два объёмных блока. Переключайте стрелками или свайпом.",
  );
  const playback = document.createElement("button");
  playback.type = "button";
  playback.id = "feature-playback";
  controls.append(playback);
  const notify = () => section.dispatchEvent(new Event("featurechange"));
  const blocked = () =>
    scrolling ||
    touching ||
    document.hidden ||
    dialogs.some((dialog) => dialog.open);
  const pose = (side, angle) => `rotateX(${side === 0 ? angle : -angle}deg)`;
  const paint = () => {
    bodies.forEach((body, side) => {
      body.style.transform = pose(side, rotation);
    });
    assembly.style.transform = entered ? volumePose : flatPose;
    flatCover.hidden = entered;
  };
  const update = () => {
    const moving = animations.length > 0;
    section.dataset.featureMotion = moving ? "running" : "idle";
    section.dataset.featureShape = !entered
      ? "flat"
      : revealing
        ? "opening"
        : "volume";
    section.dataset.featurePresented = String(presented);
    stage.setAttribute("aria-busy", String(moving));
    section.dataset.featureEntered = String(entered);
    section.dataset.featureIndex = String(selected);
    section.dataset.featureAutomatic = String(automatic && !reduced.matches);
    cards.forEach((card, index) => {
      // Keep the caption, accessible article and counter on the last settled face.
      const active = index === presented;
      card.dataset.featureSelected = String(index === selected);
      card.setAttribute("aria-hidden", String(!active));
      card.inert = !active;
      copies[index].dataset.featureSelected = String(active);
      copies[index].setAttribute("aria-hidden", String(!active));
      copies[index].inert = !active;
      actionGroups[index].inert = moving;
    });
    previous.disabled = false;
    next.disabled = false;
    count.textContent = `${String(presented + 1).padStart(2, "0")} / 03`;
    // Auto changes are visual. Announce only deliberate user navigation.
    count.setAttribute("aria-live", automatic ? "off" : "polite");
    playback.hidden = reduced.matches;
    playback.setAttribute(
      "aria-label",
      automatic ? "Приостановить вращение" : "Включить автоматическое вращение",
    );
    playback.setAttribute("aria-pressed", String(automatic));
    playback.innerHTML = automatic
      ? '<svg class="icon" aria-hidden="true" viewBox="0 0 20 20"><path d="M6 4v12M14 4v12" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>'
      : '<svg class="icon" aria-hidden="true" viewBox="0 0 20 20"><path d="m7 4 9 6-9 6Z" fill="currentColor" stroke="none"/></svg>';
    notify();
  };
  const settle = () => {
    revision++;
    animations.forEach((animation) => animation.cancel());
    animations = [];
    presented = selected;
    revealing = false;
    // Whole revolutions may be discarded without changing a visible face.
    if (Math.abs(rotation) >= 360) rotation %= 360;
    paint();
    update();
  };
  const stopAutomatic = () => {
    automatic = false;
    clearTimeout(autoTimer);
    autoTimer = undefined;
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
    const canAdvance =
      visible &&
      entered &&
      !animations.length &&
      !blocked() &&
      !focused &&
      automatic &&
      !reduced.matches;
    if (!canAdvance) {
      clearTimeout(autoTimer);
      autoTimer = undefined;
    } else if (!autoTimer) {
      autoTimer = setTimeout(() => {
        autoTimer = undefined;
        if (
          visible &&
          !blocked() &&
          !focused &&
          automatic &&
          !animations.length
        )
          go(selected + 1, true);
      }, 6000);
    }
  };
  const turn = (index, target, intro = false) => {
    const start = rotation;
    selected = index;
    rotation = target;
    clearTimeout(autoTimer);
    autoTimer = undefined;
    if (reduced.matches) {
      settle();
      sync();
      return;
    }
    const generation = ++revision;
    const duration = Math.abs(target - start) > 90 ? 1600 : 1150;
    animations = bodies.map((body, side) => {
      const animation = body.animate(
        [{ transform: pose(side, start) }, { transform: pose(side, target) }],
        {
          duration,
          delay: side * 70,
          easing: "cubic-bezier(.45,0,.2,1)",
          fill: "both",
        },
      );
      animation.pause();
      return animation;
    });
    if (intro) {
      revealing = true;
      flatCover.hidden = false;
      assembly.style.transform = volumePose;
      const camera = assembly.animate(
        [{ transform: flatPose }, { transform: volumePose }],
        {
          duration,
          easing: "cubic-bezier(.45,0,.2,1)",
          fill: "both",
        },
      );
      const cover = flatCover.animate(
        [
          { opacity: 1, offset: 0 },
          { opacity: 1, offset: 0.06 },
          { opacity: 0, offset: 0.34 },
          { opacity: 0, offset: 1 },
        ],
        { duration, fill: "both" },
      );
      camera.pause();
      cover.pause();
      animations.push(camera, cover);
    }
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
        sync();
      })
      .catch(() => {});
    sync();
  };
  const go = (index, auto = false) => {
    if (!auto) stopAutomatic();
    const target = (index + cards.length) % cards.length;
    if (!entered) {
      entered = true;
      turn(target, -target * 90, true);
      return;
    }
    if (animations.length) {
      queued = index;
      return;
    }
    if (target === selected) {
      update();
      sync();
      return;
    }
    let delta = (target - selected) * -90;
    if (index > selected && target < selected) delta = -180;
    if (index < selected && target > selected) delta = 180;
    turn(target, rotation + delta);
  };
  previous.addEventListener("click", () => go((queued ?? selected) - 1));
  next.addEventListener("click", () => go((queued ?? selected) + 1));
  playback.addEventListener("click", () => {
    automatic = !automatic;
    update();
    sync();
  });
  stage.addEventListener("keydown", (event) => {
    if (event.target !== stage) return;
    const targets = {
      ArrowLeft: selected - 1,
      ArrowRight: selected + 1,
      Home: 0,
      End: 2,
    };
    if (!(event.key in targets)) return;
    event.preventDefault();
    go(targets[event.key]);
  });
  stage.addEventListener("focusin", (event) => {
    focused = true;
    if (event.target !== stage) stopAutomatic();
    if (!entered) {
      entered = true;
      rotation = -selected * 90;
      queued = undefined;
      settle();
    }
    sync();
  });
  stage.addEventListener("focusout", () => {
    queueMicrotask(() => {
      focused = stage.contains(document.activeElement);
      sync();
    });
  });
  stage.addEventListener("pointerdown", (event) => {
    if (
      !event.isPrimary ||
      event.button !== 0 ||
      event.target.closest("a,button")
    )
      return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    suppressClick = false;
  });
  stage.addEventListener("pointermove", (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    if (
      Math.abs(event.clientX - pointer.x) > 20 &&
      Math.abs(event.clientX - pointer.x) >
        Math.abs(event.clientY - pointer.y) * 1.3
    )
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
    const edge = Math.max(
      64,
      Math.min(scene.clientWidth / 2.5, scene.clientHeight / 1.55, 380),
    );
    stage.style.setProperty("--solid-edge", `${edge}px`);
  };
  new ResizeObserver(geometry).observe(scene);
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
    if (
      index < 0 ||
      (index === selected &&
        index === presented &&
        entered &&
        !animations.length)
    )
      return;
    automatic = false;
    selected = index;
    entered = true;
    rotation = -index * 90;
    queued = undefined;
    settle();
    sync();
  });
  reduced.addEventListener("change", () => {
    if (reduced.matches && entered) {
      automatic = false;
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
  paint();
  update();
}
