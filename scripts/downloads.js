export function init({ config, installerFromRelease, fetchJson }) {
  const $ = (id) => document.getElementById(id);
  const mobile =
    /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const windows = /Windows NT/i.test(navigator.userAgent) && !mobile;
  const links = [...document.querySelectorAll("[data-download]")];
  const guide = $("installation");
  const revealGuide = () => {
    guide.hidden = false;
    guide.classList.add("installation-visible");
  };
  if (location.hash === "#installation") revealGuide();
  if (location.hash === "#installation")
    requestAnimationFrame(() => guide.scrollIntoView());
  window.addEventListener("hashchange", () => {
    if (location.hash === "#installation") revealGuide();
  });
  if (!windows) {
    for (const link of links) {
      link.href = "#installation";
      link.addEventListener("click", revealGuide);
    }
    $("license-download-label").textContent = "Как установить";
    $("start-download-label").textContent = "Продолжить на компьютере";
  }
  const field = $("installation-url");
  field.value = config.siteUrl;
  field.addEventListener("click", () => field.select());
  $("copy-site").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(config.siteUrl);
      $("copy-status").textContent =
        "Ссылка скопирована. Отправьте её себе и откройте на компьютере Windows.";
    } catch {
      field.focus();
      field.select();
      $("copy-status").textContent =
        "Выделили адрес. Скопируйте его вручную и откройте на компьютере Windows.";
    }
  });
  if (typeof navigator.share === "function") {
    $("share-site").hidden = false;
    $("share-site").addEventListener("click", async () => {
      try {
        await navigator.share({
          title: "Smart Store для Windows",
          url: config.siteUrl,
        });
      } catch (error) {
        if (error.name !== "AbortError")
          $("copy-status").textContent =
            "Не получилось поделиться. Скопируйте ссылку кнопкой рядом.";
      }
    });
  }
  // Device guidance is ready even if the release service never responds.
  return (async () => {
    try {
      const release = await fetchJson(config.releasesApi, {
        headers: { accept: "application/vnd.github+json" },
      });
      const installer = installerFromRelease(release);
      if (!installer) throw new Error("Invalid installer");
      if (windows) for (const link of links) link.href = installer.url;
      $("download-note").textContent =
        `Windows 10 / 11 · 64 бит · Версия ${installer.version} · ${Math.round(installer.size / 1024 / 1024)} МБ`;
    } catch {
      $("download-note").textContent = windows
        ? "Windows 10 / 11 · 64 бит. Кнопка откроет страницу последнего выпуска."
        : "Установка на Windows 10 / 11 · 64 бит. Отправьте ссылку на компьютер.";
    }
  })();
}
