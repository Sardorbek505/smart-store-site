const { ribbonLayout, initialPosition, wrap } = await import(
  `./ribbon-layout.js${new URL(import.meta.url).search}`
);

export function init() {
  const gallery = document.querySelector(".hero-gallery");
  if (!gallery) return;
  const stage = gallery.querySelector(".gallery-stage");
  const track = gallery.querySelector("[data-ribbon-track]");
  const cards = [...track.querySelectorAll("[data-gallery-card]")];
  let position = Number(track.dataset.position) || initialPosition;
  let pointer = null;
  let dragged = false;
  const move = (direction) => {
    position = wrap(Math.round(position) + direction, cards.length);
    const layout = ribbonLayout(cards.length, position);
    cards.forEach((card, index) => {
      const item = layout[index];
      card.hidden = item.hidden;
      if (!item.hidden) {
        card.style.cssText = item.style;
        card.tabIndex = item.tabIndex;
      }
    });
    track.dataset.position = String(position);
    const index = Math.round(position);
    document.getElementById("gallery-count").textContent = String(
      index + 1,
    ).padStart(2, "0");
    document.getElementById("gallery-status").textContent =
      `${index + 1} из ${cards.length}: ${cards[index].dataset.title}`;
  };
  gallery.querySelector(".gallery-controls").hidden = false;
  document
    .getElementById("gallery-next")
    .addEventListener("click", () => move(1));
  document
    .getElementById("gallery-prev")
    .addEventListener("click", () => move(-1));
  gallery.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    move(event.key === "ArrowRight" ? 1 : -1);
  });
  stage.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    dragged = false;
  });
  stage.addEventListener("pointermove", (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x,
      dy = event.clientY - pointer.y;
    if (Math.abs(dx) > 20 && Math.abs(dx) > Math.abs(dy)) dragged = true;
  });
  window.addEventListener("pointerup", (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x;
    pointer = null;
    if (dragged && Math.abs(dx) > 35) move(dx < 0 ? 1 : -1);
  });
  window.addEventListener("pointercancel", () => {
    pointer = null;
    dragged = false;
  });
  stage.addEventListener(
    "click",
    (event) => {
      if (!dragged) return;
      event.preventDefault();
      event.stopPropagation();
      dragged = false;
    },
    true,
  );
  stage.addEventListener("dragstart", (event) => event.preventDefault());
  // First-frame geometry is already in HTML. Initialization changes no layout.
  stage.dataset.renderer = "native";
  stage.dataset.ready = "true";
}
