export function init({ config, installerFromRelease, fetchJson }) {
  const $ = (id) => document.getElementById(id);
  const mobile =
    /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const windows = /Windows NT/i.test(navigator.userAgent) && !mobile;
  const links = [...document.querySelectorAll("[data-download]")];
  const guide = $("installation");
  const installUrl = new URL("#installation", config.siteUrl).href;
  const revealGuide = () => {
    guide.hidden = false;
    guide.classList.add("installation-visible");
  };
  if (location.hash === "#installation") {
    revealGuide();
    requestAnimationFrame(() => guide.scrollIntoView());
  }
  window.addEventListener("hashchange", () => {
    if (location.hash === "#installation") revealGuide();
  });
  if (!windows) {
    for (const link of links) {
      link.href = "#installation";
      link.addEventListener("click", revealGuide);
    }
    $("windows-install").hidden = true;
    $("handoff-tools").hidden = false;
    $("license-download-label").textContent = "Как установить";
    $("start-download-label").textContent = "Продолжить на компьютере";
  } else {
    // A stable fallback is ready even if the release API fails or times out.
    for (const link of links) link.href = config.releasesPage;
  }
  const field = $("installation-url");
  field.value = installUrl.replace(/^https:\/\//, "");
  field.addEventListener("click", () => field.select());
  const copy = $("copy-site");
  copy.disabled = false;
  copy.addEventListener("click", async () => {
    copy.dataset.copied = "false";
    copy.setAttribute("aria-label", "Скопировать ссылку");
    try {
      await navigator.clipboard.writeText(installUrl);
      copy.dataset.copied = "true";
      copy.setAttribute(
        "aria-label",
        "Ссылка скопирована. Скопировать ещё раз",
      );
      $("copy-status").textContent =
        "Ссылка скопирована. Откройте её на Windows — сразу на экране установки.";
    } catch {
      field.focus();
      field.select();
      $("copy-status").textContent =
        "Выделили адрес. Скопируйте его вручную и откройте на компьютере Windows.";
    }
  });
  const share = $("share-site");
  share.hidden = false;
  if (typeof navigator.share !== "function") {
    share.querySelector(".button-label").textContent = "Скопировать ссылку";
    share.addEventListener("click", () => copy.click());
  } else {
    share.addEventListener("click", async () => {
      if (share.disabled) return;
      share.disabled = true;
      share.setAttribute("aria-busy", "true");
      $("copy-status").textContent = "";
      try {
        await navigator.share({
          title: "Установка Smart Store для Windows",
          url: installUrl,
        });
      } catch (error) {
        if (error.name !== "AbortError")
          $("copy-status").textContent =
            "Не получилось поделиться. Скопируйте ссылку кнопкой рядом.";
      } finally {
        share.disabled = false;
        share.removeAttribute("aria-busy");
      }
    });
  }
  // A phone only needs the handoff. Resolve the installer on Windows itself.
  if (!windows) {
    $("download-note").textContent =
      "Windows 10 / 11 · 64 бит. Продолжите установку на компьютере.";
    return;
  }
  return (async () => {
    try {
      const release = await fetchJson(config.releasesApi, {
        headers: { accept: "application/vnd.github+json" },
      });
      const installer = installerFromRelease(release);
      if (!installer) throw new Error("Invalid installer");
      for (const link of links) link.href = installer.url;
      const note = `Windows 10 / 11 · 64 бит · Версия ${installer.version} · ${Math.round(installer.size / 1024 / 1024)} МБ`;
      $("download-note").textContent = note;
      for (const label of document.querySelectorAll("[data-release-note]"))
        label.textContent = note;
    } catch {
      $("download-note").textContent =
        "Windows 10 / 11 · 64 бит. Кнопка откроет страницу последнего выпуска.";
      for (const label of document.querySelectorAll("[data-release-note]"))
        label.textContent =
          "Кнопка откроет официальный выпуск. Выберите файл SmartStore-Setup…exe.";
    }
  })();
}
