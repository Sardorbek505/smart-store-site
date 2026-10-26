// No visual enhancement is allowed to block installation or store login.
const version = new URL(import.meta.url).search;
const load = (name) => import(`./scripts/${name}.js${version}`);
const core = load("core");
const services = new Set(["downloads", "store"]);
await Promise.allSettled(
  [
    "viewport",
    "interface",
    "preview",
    "media",
    "gallery",
    "downloads",
    "store",
    "story",
    "checkout",
    "micro-scenes",
  ].map(async (name) => {
    try {
      const [feature, dependencies] = await Promise.all([
        load(name),
        services.has(name) ? core : undefined,
      ]);
      await feature.init(dependencies);
    } catch {
      console.warn(`Smart Store: ${name} unavailable`);
      if (name === "store") {
        document.getElementById("store-note").textContent =
          "Вход по коду сейчас недоступен. Откройте QR-код в Smart Store на компьютере: «Система» → настройки телефона.";
        // Keep the explanation reachable even if the login module failed.
        const dialog = document.getElementById("store");
        if (typeof dialog?.showModal === "function") {
          for (const link of document.querySelectorAll('a[href="#store"]'))
            link.addEventListener("click", (event) => {
              if (
                event.button ||
                event.ctrlKey ||
                event.metaKey ||
                event.shiftKey ||
                event.altKey
              )
                return;
              event.preventDefault();
              if (!dialog.open) dialog.showModal();
            });
          document
            .getElementById("store-close")
            .addEventListener("click", () => dialog.close());
          if (location.hash === "#store" && !dialog.open) dialog.showModal();
        }
      }
    }
  }),
);
