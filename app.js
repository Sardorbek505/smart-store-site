// Лендинг Smart Store (§47.6 тех-плана): ссылка на свежий установщик и вход в магазин.
;(() => {
  /*
   * Домен магазинов: каждый магазин — поддомен, адрес выдаётся вместе с ключом туннеля.
   * Пока домен не подключён, вход по коду объясняет, где взять адрес.
   */
  const STORE_DOMAIN = 'metov.store'
  const RELEASES = 'https://api.github.com/repos/Sardorbek505/smart-store-releases/releases/latest'

  const $ = (id) => document.getElementById(id)
  const mb = (bytes) => `${Math.round(bytes / 1024 / 1024)} МБ`

  /* Прямая ссылка на установщик последней версии: версию не вписываем руками. */
  async function findInstaller() {
    const note = $('download-note')
    try {
      const response = await fetch(RELEASES, { headers: { accept: 'application/vnd.github+json' } })
      if (!response.ok) throw new Error(String(response.status))
      const release = await response.json()
      const exe = (release.assets || []).find((asset) => asset.name.endsWith('.exe'))
      if (!exe) throw new Error('нет установщика')
      $('download').href = exe.browser_download_url
      note.textContent =
        `Версия ${release.tag_name.replace(/^v/, '')}, ${mb(exe.size)}. ` +
        'Windows может показать синее окно: нажмите «Подробнее», затем «Выполнить в любом случае».'
    } catch {
      note.textContent = 'Кнопка откроет страницу со всеми версиями программы.'
    }
  }

  function setupStoreForm() {
    $('store-suffix').textContent = STORE_DOMAIN ? `.${STORE_DOMAIN}` : ''
    $('store-form').addEventListener('submit', (event) => {
      event.preventDefault()
      const code = $('store-code').value.trim().toLowerCase()
      if (!/^[a-z0-9-]{2,40}$/.test(code)) {
        $('store-note').textContent = 'Код магазина состоит из латинских букв, цифр и дефиса.'
        return
      }
      if (!STORE_DOMAIN) {
        $('store-note').textContent =
          'Адрес вашего магазина есть в программе: «Система» → «Телефон». Наведите камеру телефона на QR-код.'
        return
      }
      // Сначала спрашиваем сервер подключения: опечатка в коде даст понятный текст,
      // а не страницу ошибки Cloudflare. Сервер недоступен — просто переходим.
      $('store-note').textContent = 'Проверяем код…'
      fetch(`https://connect.${STORE_DOMAIN}/lookup?code=${encodeURIComponent(code)}`)
        .then((response) => response.json())
        .then((result) => {
          if (result && result.found === false) {
            $('store-note').textContent =
              'Магазин с таким кодом не найден. Код есть в программе: «Система» → «Телефон».'
            return
          }
          location.href = `https://${code}.${STORE_DOMAIN}/`
        })
        .catch(() => {
          location.href = `https://${code}.${STORE_DOMAIN}/`
        })
    })
  }

  void findInstaller()
  setupStoreForm()
})()
