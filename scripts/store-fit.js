// A shop-type selector: intentional changes, fixed layout, no auto-advancing text.
export function init() {
  const root = document.getElementById("for-stores");
  if (!root) return;
  const stage = root.querySelector(".fit-stage");
  const panels = [...root.querySelectorAll("[data-fit-panel]")];
  const tabs = [...root.querySelectorAll("[data-fit-select]")];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let selected = 0,
    target = 0,
    visible = false,
    revision = 0,
    animations = [];
  const render = () => {
    panels.forEach((panel, index) => {
      const active = index === selected;
      panel.dataset.fitActive = String(active);
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", tabs[index].id);
      panel.setAttribute("aria-hidden", String(!active));
      panel.inert = !active;
      tabs[index].setAttribute("aria-selected", String(active));
      tabs[index].tabIndex = active ? 0 : -1;
    });
    root.dataset.fitIndex = String(selected);
    stage.setAttribute("aria-busy", String(animations.length > 0));
  };
  const finish = (index = target) => {
    revision++;
    animations.forEach((animation) => animation.cancel());
    animations = [];
    selected = index;
    render();
  };
  const choose = (index) => {
    target = (index + panels.length) % panels.length;
    if (animations.length) {
      finish();
      return;
    }
    if (target === selected) return;
    if (
      reduced.matches ||
      document.hidden ||
      !visible ||
      !Element.prototype.animate
    ) {
      finish();
      return;
    }
    const generation = ++revision;
    const out = panels[selected].animate(
      [
        { opacity: 1, transform: "none" },
        { opacity: 0, transform: "rotateY(-7deg) translateX(-8px)" },
      ],
      { duration: 180, easing: "ease-in", fill: "both" },
    );
    animations = [out];
    render();
    out.finished
      .then(() => {
        if (generation !== revision) return;
        out.cancel();
        selected = target;
        const incoming = panels[selected].animate(
          [
            { opacity: 0, transform: "rotateY(7deg) translateX(8px)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 420, easing: "cubic-bezier(.22,.7,.16,1)", fill: "both" },
        );
        animations = [incoming];
        render();
        incoming.finished
          .then(() => {
            if (generation === revision) finish();
          })
          .catch(() => {});
      })
      .catch(() => {});
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => choose(index));
    tab.addEventListener("keydown", (event) => {
      const destinations = {
        ArrowRight: index + 1,
        ArrowLeft: index - 1,
        Home: 0,
        End: panels.length - 1,
      };
      if (!(event.key in destinations)) return;
      event.preventDefault();
      const next = (destinations[event.key] + panels.length) % panels.length;
      choose(next);
      tabs[next].focus({ preventScroll: true });
    });
  });
  const suspend = () => {
    if (animations.length) finish();
  };
  if (window.IntersectionObserver)
    new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (!visible) suspend();
      },
      { rootMargin: "-80px 0px 0px 0px" },
    ).observe(stage);
  else visible = true;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) suspend();
  });
  window.addEventListener("pagehide", suspend);
  reduced.addEventListener("change", () => {
    if (reduced.matches) suspend();
  });
  const dialogs = [...document.querySelectorAll("dialog")];
  if (window.MutationObserver) {
    const observer = new MutationObserver(() => {
      if (dialogs.some((dialog) => dialog.open)) suspend();
    });
    dialogs.forEach((dialog) =>
      observer.observe(dialog, { attributes: true, attributeFilter: ["open"] }),
    );
  }
  render();
  root.classList.add("fit-ready");
  root.querySelector(".fit-tabs").hidden = false;
}
