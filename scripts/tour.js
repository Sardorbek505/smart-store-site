// The recorded UI is downloaded only after a visitor asks to watch it.
export function init() {
  const dialog = document.getElementById("ai-tour");
  const video = document.getElementById("tour-video");
  const status = document.getElementById("tour-status");
  const triggers = [...document.querySelectorAll("[data-tour]")];
  if (!dialog || !video || typeof dialog.showModal !== "function") return;
  const key = "smartStoreTour";
  let trigger;
  let loaded = false;
  const open = (play, push) => {
    if (!loaded) {
      video.poster = video.dataset.poster;
      video.src = video.dataset.src;
      const track = video.querySelector("track");
      track.src = track.dataset.src;
      loaded = true;
      video.load();
    }
    if (push && !history.state?.[key])
      history.pushState({ ...history.state, [key]: true }, "", "#ai-tour");
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
      open(true, true);
    });
  dialog.addEventListener("cancel", () => video.pause());
  dialog.addEventListener("close", () => {
    video.pause();
    if (history.state?.[key]) history.back();
    else if (location.hash === "#ai-tour") history.replaceState(history.state, "", "#assistant");
    trigger?.focus({ preventScroll: true });
  });
  window.addEventListener("popstate", () => {
    if (history.state?.[key]) open(false, false);
    else if (dialog.open) {
      video.pause();
      dialog.close();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) video.pause();
  });
  video.addEventListener("error", () => {
    status.textContent = "Не удалось загрузить видео. Откройте файл по ссылке под плеером.";
  });
  if (location.hash === "#ai-tour") open(false, false);
}
