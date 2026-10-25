// A generated scene can fail independently of its original application screen.
export function init() {
  for (const image of document.querySelectorAll(
    "img[data-fallback], a[data-preview] img",
  )) {
    const recover = () => {
      const link = image.closest("a[data-preview]");
      const source = image.dataset.fallback || link?.getAttribute("href");
      if (!source || image.src === new URL(source, location.href).href) return;
      // Clear responsive candidates as well; otherwise Safari retries the WebP.
      image.removeAttribute("srcset");
      if (image.alt)
        image.alt =
          link?.dataset.previewAlt ||
          `Исходный экран ${link?.dataset.title || "Smart Store"}`;
      image.src = source;
    };
    image.addEventListener("error", recover);
    if (image.complete && !image.naturalWidth) recover();
  }
}
