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

      // A one-pixel sampling band follows which section is behind the capsule.
      // No scroll handler, geometry polling or animated filter is needed.
      if (typeof IntersectionObserver === "function") {
        let surfaceObserver;
        let resizeTimer;
        const sections = [...document.querySelectorAll("main > section")];
        const observeSurface = () => {
          surfaceObserver?.disconnect();
          const y = innerHeight <= 600 && innerWidth > 620 ? 32 : 40;
          surfaceObserver = new IntersectionObserver(
            (entries) => {
              const entry = entries.find(
                (candidate) => candidate.isIntersecting,
              );
              if (!entry) return;
              header.dataset.surface = entry.target.matches(
                ".cinema-hero, .license-section",
              )
                ? "dark"
                : "light";
            },
            {
              rootMargin: `-${y}px 0px -${Math.max(0, innerHeight - y - 1)}px 0px`,
            },
          );
          sections.forEach((section) => surfaceObserver.observe(section));
        };
        observeSurface();
        window.addEventListener("resize", () => {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(observeSurface, 180);
        });
      }
    }
  }

  try {
    setupMenu();
  } catch {
    console.warn("Smart Store: navigation enhancement unavailable");
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
