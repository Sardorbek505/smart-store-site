// No visual enhancement is allowed to block installation or store login.
const version = new URL(import.meta.url).search;
const load = (name) => import(`./scripts/${name}.js${version}`);
const core = await load("core");
await Promise.allSettled(
  ["viewport", "interface", "preview", "gallery", "downloads", "store"].map(
    async (name) => {
      try {
        const feature = await load(name);
        await feature.init(core);
      } catch {
        console.warn(`Smart Store: ${name} unavailable`);
        if (name === "gallery")
          document.querySelector(".gallery-controls").hidden = true;
        if (name === "store")
          document.getElementById("store-note").textContent =
            "Вход по коду сейчас недоступен. Откройте QR-код в Smart Store на компьютере: «Система» → настройки телефона.";
      }
    },
  ),
);
