export function init() {
  const dialog = document.getElementById("preview-dialog");
  const image = document.getElementById("preview-image");
  const status = document.getElementById("preview-status");
  const original = document.getElementById("preview-original");
  const zoom = document.getElementById("preview-zoom");
  const stage = document.getElementById("preview-stage");
  const hint = document.getElementById("preview-hint");
  if (typeof dialog.showModal !== "function") return;
  const historyKey = "smartStoreScreen";
  let trigger;
  let returnPosition;
  let returning = false;
  let dismissing = false;
  let returnTimer;
  const restorePosition = () => {
    clearTimeout(returnTimer);
    // Native history traversal restores fragment focus after popstate. Finish
    // after that step so a stale section hash cannot move the visitor away.
    returnTimer = setTimeout(() => {
      if (!returning || dialog.open) return;
      returning = false;
      if (returnPosition) scrollTo(returnPosition.x, returnPosition.y);
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    }, 0);
  };
  const reset = () => {
    dialog.dataset.zoomed = "false";
    zoom.setAttribute("aria-pressed", "false");
    zoom.querySelector("span").textContent = "Увеличить";
    hint.textContent = "Увеличьте, чтобы прочитать детали.";
    stage.scrollTo(0, 0);
  };
  zoom.addEventListener("click", () => {
    const enlarged = dialog.dataset.zoomed !== "true";
    dialog.dataset.zoomed = String(enlarged);
    zoom.setAttribute("aria-pressed", String(enlarged));
    zoom.querySelector("span").textContent = enlarged ? "Вписать" : "Увеличить";
    hint.textContent = enlarged
      ? "Перемещайте экран, чтобы рассмотреть детали."
      : "Увеличьте, чтобы прочитать детали.";
    stage.scrollTo(0, 0);
  });
  const show = (screen) => {
    returning = false;
    dismissing = false;
    clearTimeout(returnTimer);
    returnPosition = {
      x: Number.isFinite(screen.x) ? screen.x : scrollX,
      y: Number.isFinite(screen.y) ? screen.y : scrollY,
    };
    reset();
    zoom.disabled = true;
    image.hidden = true;
    status.textContent = "Загружаем экран…";
    original.href = screen.src;
    image.onload = () => {
      image.style.setProperty(
        "--preview-native-width",
        `${image.naturalWidth}px`,
      );
      image.hidden = false;
      zoom.disabled = false;
      status.textContent = "";
    };
    image.onerror = () => {
      status.textContent =
        "Изображение не загрузилось. Откройте оригинал кнопкой со стрелкой.";
    };
    image.alt = screen.alt;
    document.getElementById("preview-title").textContent = screen.title;
    image.src = screen.src;
    if (!dialog.open) dialog.showModal();
  };
  const savedScreen = () => {
    const screen = history.state?.[historyKey];
    if (
      !screen ||
      typeof screen.src !== "string" ||
      typeof screen.title !== "string" ||
      typeof screen.alt !== "string"
    )
      return null;
    try {
      const url = new URL(screen.src);
      // History is only allowed to restore public screenshots from this site.
      if (
        url.origin !== location.origin ||
        url.username ||
        url.password ||
        !url.pathname.startsWith("/img/") ||
        !/\.(?:png|webp)$/.test(url.pathname)
      )
        return null;
      return screen;
    } catch {
      return null;
    }
  };
  const links = [...document.querySelectorAll("[data-preview]")];
  for (const link of links) {
    link.addEventListener("click", (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      event.preventDefault();
      trigger = link;
      const screen = {
        src: link.href,
        alt:
          link.dataset.previewAlt ||
          link.querySelector("img")?.alt ||
          "Экран Smart Store",
        title: link.dataset.title || "Экран Smart Store",
        trigger: links.indexOf(link),
        x: scrollX,
        y: scrollY,
      };
      show(screen);
      // Keep the section URL intact while giving Back a dialog to dismiss.
      // If history is unavailable, the close button and Escape still work.
      try {
        history.pushState({ ...history.state, [historyKey]: screen }, "");
      } catch {}
    });
  }
  const dismiss = () => {
    if (dismissing) return;
    if (savedScreen()) {
      dismissing = true;
      history.back();
    } else dialog.close();
  };
  document.getElementById("preview-close").addEventListener("click", dismiss);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    dismiss();
  });
  dialog.addEventListener("close", () => {
    // A Forward action may already have reopened the native dialog.
    if (dialog.open) return;
    reset();
    if (savedScreen()) {
      returning = true;
      if (!dismissing) {
        dismissing = true;
        history.back();
      }
    } else if (returning) restorePosition();
    else if (trigger?.isConnected) trigger.focus({ preventScroll: true });
  });
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom
    )
      dismiss();
  });
  const syncLocation = () => {
    const screen = savedScreen();
    if (screen) {
      trigger =
        (Number.isInteger(screen.trigger) && links[screen.trigger]) ||
        links.find((link) => link.href === screen.src) ||
        trigger;
      show(screen);
    } else if (dialog.open) {
      returning = true;
      dialog.close();
      restorePosition();
    } else if (returning) restorePosition();
  };
  window.addEventListener("popstate", syncLocation);
  syncLocation();
}
