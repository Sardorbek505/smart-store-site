const { analyticsPreferenceKey, browserPrivacySignal } = await import(
  `./core.js${new URL(import.meta.url).search}`
);
const choice = document.getElementById("analytics-choice");
const status = document.getElementById("analytics-choice-status");

function update() {
  if (browserPrivacySignal()) {
    choice.checked = false;
    choice.disabled = true;
    status.textContent =
      "Статистика отключена настройкой конфиденциальности браузера.";
    return;
  }
  try {
    choice.checked = localStorage.getItem(analyticsPreferenceKey) !== "off";
    choice.disabled = false;
    status.textContent = choice.checked
      ? "Необязательная статистика включена. Вы можете отключить её здесь."
      : "Необязательная статистика отключена в этом браузере.";
  } catch {
    choice.checked = false;
    choice.disabled = true;
    status.textContent =
      "Хранилище браузера недоступно. Необязательная статистика не отправляется.";
  }
}
choice.addEventListener("change", () => {
  try {
    localStorage.setItem(analyticsPreferenceKey, choice.checked ? "on" : "off");
    update();
  } catch {
    choice.checked = false;
    choice.disabled = true;
    status.textContent =
      "Не удалось сохранить настройку. Необязательная статистика отключена, пока хранилище недоступно.";
  }
});
window.addEventListener("storage", update);
update();
