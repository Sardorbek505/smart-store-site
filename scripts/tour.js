// The recorded UI is downloaded only after a visitor asks to watch it.
function mount({ dialogId, videoId, statusId, selector, key, hash, returnHash }) {
  const dialog = document.getElementById(dialogId);
  const video = document.getElementById(videoId);
  const status = document.getElementById(statusId);
  const triggers = [...document.querySelectorAll(selector)];
  if (!dialog || !video || typeof dialog.showModal !== "function") return;
  let trigger;
  let loaded = false;
  let returnPosition, returning = false, restoreTimer;
  const restore = () => {
    clearTimeout(restoreTimer);
    // Native fragment restoration finishes after popstate (notably in WebKit).
    restoreTimer = setTimeout(() => {
      if (!returning || dialog.open) return;
      returning = false;
      if (returnPosition) scrollTo(returnPosition.x, returnPosition.y);
      trigger?.focus({ preventScroll: true });
    }, 0);
  };
  const open = (play, push) => {
    if (!loaded) {
      video.poster = video.dataset.poster;
      for (const source of video.querySelectorAll("source"))
        source.src = source.dataset.src;
      const track = video.querySelector("track");
      track.src = track.dataset.src;
      loaded = true;
      video.load();
    }
    if (push && !history.state?.[key])
      history.pushState({ ...history.state, [key]: true }, "", hash);
    if (!dialog.open) dialog.showModal();
    status.textContent = "";
    if (play)
      video.play().catch(() => {
        status.textContent = "Нажмите воспроизведение в плеере.";
      });
  };
  for (const link of triggers)
    link.addEventListener("click", (event) => {
      if (event.button || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      event.preventDefault();
      trigger = link;
      returnPosition = { x: scrollX, y: scrollY };
      returning = false;
      clearTimeout(restoreTimer);
      open(true, true);
    });
  dialog.addEventListener("cancel", () => video.pause());
  dialog.addEventListener("close", () => {
    if (dialog.open) return; // A quick Forward may have reopened this dialog.
    video.pause();
    returning = true;
    if (history.state?.[key]) history.back();
    else {
      if (location.hash === hash) history.replaceState(history.state, "", returnHash);
      restore();
    }
  });
  window.addEventListener("popstate", () => {
    if (history.state?.[key]) {
      returning = false;
      clearTimeout(restoreTimer);
      open(false, false);
    } else {
      if (dialog.open) { video.pause(); dialog.close(); }
      if (returning) restore();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) video.pause();
  });
  video.addEventListener("error", () => {
    status.textContent = "Не удалось загрузить видео. Откройте файл по ссылке под плеером.";
  });
  if (location.hash === hash) open(false, false);
}

export function init() {
  mount({ dialogId:"ai-tour", videoId:"tour-video", statusId:"tour-status", selector:"[data-tour]", key:"smartStoreTour", hash:"#ai-tour", returnHash:"#assistant" });
  mount({ dialogId:"sale-tour", videoId:"sale-tour-video", statusId:"sale-tour-status", selector:"[data-sale-tour]", key:"smartStoreSaleTour", hash:"#sale-tour", returnHash:"#features" });
}
