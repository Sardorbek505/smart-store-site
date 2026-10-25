# Smart Store — metov.store

Статический лендинг и вход по коду магазина. GitHub Pages публикует корень `main`; домен задан в `CNAME`. Приложение Windows и сервер подключения находятся в других репозиториях.

## Локальная работа

Сборка и установка зависимостей для сайта не нужны:

```sh
python -m http.server 4173
```

Открыть `http://localhost:4173`. Для проверки доменной логики нужен Node.js 22 или новее:

```sh
npm test
```

Браузерная регрессия требует Python Playwright и Chromium:

```sh
python tests/browser-check.py
```

По умолчанию проверяется `http://127.0.0.1:4173`. Можно задать `SITE_TEST_URL` и `CHROMIUM_BINARY`. Все ответы релизов и проверки магазинов в этой проверке заменены тестовыми; реальные магазины и сообщения WhatsApp не открываются.

## Структура

- `index.html`, `privacy.html` — содержание и рабочие статические ссылки.
- `styles.css`, `cinema.css` — оформление и лента фотосцен.
- `components.css` — адаптированные кнопка, FAQ, поле копирования и рамка формы. Источники и лицензии: [third-party/README.md](third-party/README.md).
- `story.css`, `scripts/story.js` — асимметричный Bento, касса с точками деталей, пошаговая демонстрация телефона, изометрическая сцена данных и три одновременно видимых шага установки.
- `app.js` — независимый запуск функций.
- `scripts/core.js` — настройки сервисов, проверка адреса магазина и установщика, сетевой таймаут.
- `scripts/downloads.js` — скачивание на Windows и продолжение установки с другого устройства.
- `scripts/store.js` — проверка кода магазина, отмена запросов и переход.
- `scripts/preview.js` — просмотр оригинальных экранов и сообщение при ошибке загрузки.
- `scripts/interface.js` — меню, мобильные карточки возможностей и ссылки на ответы FAQ.
- `scripts/gallery.js` — анимация, ручное управление, остановка и reduced-motion.
- `tests/` — правила доверенных адресов, ответы сервисов и браузерные сценарии.

При изменении браузерного JavaScript повышать `?v=` у `app.js` в HTML: загрузчик передаёт тот же параметр всем модулям. При изменении CSS повышать версию соответствующей ссылки. Проверка PR запускает `npm test` и проверяет синтаксис модулей; опубликованную версию нужно проверить после завершения GitHub Pages.

Подробная логика переходов: [docs/site-architecture.md](docs/site-architecture.md).

Проверка адаптированных компонентов: `python tests/components-check.py`; для движка WebKit — `BROWSER=webkit python tests/components-check.py`. Проверяются клавиатура FAQ, успех/отказ копирования, завершение эффекта рамки и reduced motion.

Проверка демонстрационных блоков: `python tests/story-check.py`, а также `BROWSER=webkit python tests/story-check.py`. Текущие сценарии и просмотренные референсы: [docs/product-stories-v29.md](docs/product-stories-v29.md).

Три крупные предметные сцены для каталога, кассы и итогов: [docs/workspace-campaign.md](docs/workspace-campaign.md). История прежнего переключаемого блока; в v29 сцены используются в кассе и трёх шагах начала работы.

Полные изображения во всех демонстрационных блоках: [docs/complete-scenes.md](docs/complete-scenes.md). Проверка фактических границ предметов: `BROWSER=webkit python tests/image-fit-check.py` или `BROWSER=chromium python tests/image-fit-check.py` (Playwright + Pillow).

Единый демомагазин, заполненные экраны и обновлённые мокапы: [docs/demo-data.md](docs/demo-data.md). Воспроизводимый fixture и захват реальных компонентов приложения находятся в `tools/demo`; они не нужны для работы опубликованного сайта.
