export function init() {
  const dialog = document.getElementById("preview-dialog");
  const image = document.getElementById("preview-image");
  const status = document.getElementById("preview-status");
  const original = document.getElementById("preview-original");
  const zoom = document.getElementById("preview-zoom");
  const stage = document.getElementById("preview-stage");
  const hint = document.getElementById("preview-hint");
  if (typeof dialog.showModal !== "function") return;
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
  for (const link of document.querySelectorAll("[data-preview]")) {
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
      reset();
      zoom.disabled = true;
      image.hidden = true;
      status.textContent = "Загружаем экран…";
      original.href = link.href;
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
      image.alt =
        link.dataset.previewAlt ||
        link.querySelector("img")?.alt ||
        "Экран Smart Store";
      document.getElementById("preview-title").textContent = link.dataset.title;
      image.src = link.href;
      dialog.showModal();
    });
  }
  document
    .getElementById("preview-close")
    .addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", reset);
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom
    )
      dialog.close();
  });
}
