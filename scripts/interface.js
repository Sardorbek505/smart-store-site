export function init() {
  const $ = (id) => document.getElementById(id);
  function setupMenu() {
    const toggle = $("menu-toggle"),
      header = document.querySelector(".top");
    const close = () => {
      if (toggle.getAttribute("aria-expanded") === "false") return;
      header.classList.remove("menu-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Открыть меню");
    };
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") !== "true";
      header.classList.toggle("menu-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
      if (open)
        header.querySelector(".top-links a")?.focus({ preventScroll: true });
    });
    for (const link of header.querySelectorAll("a"))
      link.addEventListener("click", close);
    document.addEventListener("click", (event) => {
      if (!header.contains(event.target)) close();
    });
    document.addEventListener("focusin", (event) => {
      if (!header.contains(event.target)) close();
    });
    document.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape" &&
        toggle.getAttribute("aria-expanded") === "true"
      ) {
        close();
        toggle.focus();
      }
    });
    matchMedia("(min-width: 851px)").addEventListener("change", close);
    if (document.body.classList.contains("landing-page")) {
      let navigationVisible;
      const updateScrollNavigation = (visible = window.scrollY > 24) => {
        if (visible === navigationVisible) return;
        navigationVisible = visible;
        document.body.classList.toggle("has-scrolled", visible);
        header.inert = !visible;
        header.setAttribute("aria-hidden", String(!visible));
        if (!visible) close();
      };
      if (typeof IntersectionObserver === "function") {
        const sentinel = document.createElement("span");
        sentinel.className = "navigation-sentinel";
        sentinel.setAttribute("aria-hidden", "true");
        document.querySelector(".cinema-hero").prepend(sentinel);
        new IntersectionObserver(([entry]) => {
          updateScrollNavigation(
            !entry.isIntersecting && entry.boundingClientRect.top < 0,
          );
        }).observe(sentinel);
      } else {
        window.addEventListener("scroll", () => updateScrollNavigation(), {
          passive: true,
        });
      }
      window.addEventListener("pageshow", () => updateScrollNavigation());
      updateScrollNavigation();
    }
  }

  function setupFeatureCards() {
    const track = document.querySelector(".bento-grid");
    const cards = [...track.querySelectorAll(".bento")];
    const previous = $("feature-prev");
    const next = $("feature-next");
    const narrow = matchMedia("(max-width: 850px)");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let selected = 0;
    const update = () => {
      const left = track.getBoundingClientRect().left;
      selected = cards.reduce(
        (nearest, card, index) =>
          Math.abs(card.getBoundingClientRect().left - left) <
          Math.abs(cards[nearest].getBoundingClientRect().left - left)
            ? index
            : nearest,
        0,
      );
      previous.disabled = selected === 0;
      next.disabled = selected === cards.length - 1;
      $("feature-count").textContent =
        `${String(selected + 1).padStart(2, "0")} / ${String(cards.length).padStart(2, "0")}`;
    };
    const go = (index) => {
      if (!narrow.matches) return;
      const target = cards[Math.max(0, Math.min(cards.length - 1, index))];
      track.scrollTo({
        left: target.offsetLeft,
        behavior: reduced.matches ? "instant" : "smooth",
      });
    };
    previous.addEventListener("click", () => go(selected - 1));
    next.addEventListener("click", () => go(selected + 1));
    track.addEventListener("scroll", update, { passive: true });
    track.addEventListener("keydown", (event) => {
      if (event.target !== track || !narrow.matches) return;
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
    narrow.addEventListener("change", () => {
      track.scrollLeft = 0;
      update();
    });
    document.querySelector(".feature-controls").hidden = false;
    update();
  }

  for (const setup of [setupMenu, setupFeatureCards]) {
    try {
      setup();
    } catch {
      console.warn("Smart Store: interface enhancement unavailable");
    }
  }
  const revealAnswer = () => {
    let id;
    try {
      id = decodeURIComponent(location.hash.slice(1));
    } catch {
      return;
    }
    const target = document.getElementById(id);
    const details = target?.closest("details");
    if (details) details.open = true;
  };
  revealAnswer();
  window.addEventListener("hashchange", revealAnswer);
  document.documentElement.classList.add("js");
}
