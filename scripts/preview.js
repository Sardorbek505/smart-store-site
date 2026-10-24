export function init() {
  const dialog = document.getElementById("preview-dialog");
  const image = document.getElementById("preview-image");
  const status = document.getElementById("preview-status");
  const original = document.getElementById("preview-original");
  if (typeof dialog.showModal !== "function") return;
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
      image.hidden = true;
      status.textContent = "Загружаем экран…";
      original.href = link.href;
      image.onload = () => {
        image.hidden = false;
        status.textContent = "";
      };
      image.onerror = () => {
        status.textContent =
          "Изображение не загрузилось. Попробуйте открыть оригинал по ссылке ниже.";
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
