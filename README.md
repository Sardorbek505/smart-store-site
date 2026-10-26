# Smart Store — metov.store

Статический лендинг и вход по коду магазина. GitHub Pages публикует корень `main`; домен задан в `CNAME`. Приложение Windows и сервер подключения находятся в других репозиториях.

## Локальная работа

Опубликованные CSS уже лежат в `assets/`. Для просмотра сайта сборка не нужна:

```sh
python -m http.server 4173
```

Открыть `http://localhost:4173`. Для проверки доменной логики нужен Node.js 22 или новее:

```sh
npm test
```

После изменения CSS пересобрать статические файлы и ссылки в HTML:

```sh
npm ci
npm run build:styles
npm run check:styles
```

`esbuild` готовит статические CSS и отдельный JS демомагазина; браузер и GitHub Pages не запускают сборщик. Файлы получают имя с хешем содержимого. Предыдущая опубликованная версия сохраняется для закэшированного HTML. CI отклоняет устаревшую сборку.

Браузерная регрессия требует Python Playwright и Chromium:

```sh
python tests/browser-check.py
```

По умолчанию проверяется `http://127.0.0.1:4173`. Можно задать `SITE_TEST_URL` и `CHROMIUM_BINARY`. Все ответы релизов и проверки магазинов в этой проверке заменены тестовыми; реальные магазины и сообщения WhatsApp не открываются.

## Структура

- `index.html`, `privacy.html` — содержание и рабочие статические ссылки.
- `demo/index.html`, `demo/app.js`, `demo/styles.css` — отдельный адаптивный демомагазин: касса, склад и итоги. `demo/model.js` — изолированная логика учебных операций на тех же данных, что и мокапы.
- `styles.css` — общая основа, навигация, формы и страница условий; `cinema.css` — херо и лента фотосцен.
- `buttons.css` — общие кнопки и состояния; `screens.css` — высота экранов и адаптивные ограничения.
- `micro-scenes.css`, `scripts/micro-scenes.js` — три коротких живых примера продажи, склада и итогов; поведение и проверка: [docs/live-feature-scenes-v41.md](docs/live-feature-scenes-v41.md). Обновление фонов: [v42](docs/feature-backgrounds-v42.md).
- `glass.css` — плавающая навигация и компактная стеклянная панель просмотра экранов.
- `assets/`, `tools/build-styles.mjs` — готовые CSS и их воспроизводимая сборка. Порядок исходников задан в сборщике.
- `components.css` — адаптированные кнопка, FAQ, поле копирования и рамка формы. Источники и лицензии: [third-party/README.md](third-party/README.md).
- `trial.css` — сгенерированная объёмная «14» и адаптивный блок бесплатного периода. Источник и проверка: [docs/trial-sculpture.md](docs/trial-sculpture.md).
- `story.css`, `scripts/story.js` — асимметричный Bento, касса с точками деталей, пошаговая демонстрация телефона, сцена резервных копий с настоящим экраном и USB-флешкой и три одновременно видимых шага установки.
- `app.js` — независимый запуск функций.
- `scripts/core.js` — настройки сервисов, проверка адреса магазина и установщика, сетевой таймаут.
- `scripts/downloads.js` — скачивание на Windows, прямая ссылка на установку, копирование/системная отправка с другого устройства.
- `scripts/store.js` — проверка кода магазина, отмена запросов и переход.
- `scripts/preview.js` — просмотр, увеличение до исходного размера, перемещение и ошибки загрузки оригинальных экранов.
- `scripts/interface.js` — меню, мобильные карточки возможностей и ссылки на ответы FAQ.
- `scripts/gallery.js` — анимация, ручное управление, остановка и reduced-motion.
- `scripts/media.js` — резервные исходные скриншоты при отказе сгенерированных сцен.
- `tests/` — правила доверенных адресов, ответы сервисов и браузерные сценарии.

При изменении браузерного JavaScript повышать `?v=` у `app.js` в HTML: загрузчик передаёт тот же параметр всем модулям. При изменении CSS запускать `npm run build:styles`: имена и ссылки обновляются автоматически. Проверка PR запускает `npm test`, проверяет готовый CSS и синтаксис модулей; опубликованную версию нужно проверить после завершения GitHub Pages.

Подробная логика переходов: [docs/site-architecture.md](docs/site-architecture.md).

Проверка адаптированных компонентов: `python tests/components-check.py`; для движка WebKit — `BROWSER=webkit python tests/components-check.py`. Проверяются клавиатура FAQ, успех/отказ копирования, завершение эффекта рамки и reduced motion.

Проверка демонстрационных блоков: `python tests/story-check.py`, а также `BROWSER=webkit python tests/story-check.py`. Текущие сценарии и просмотренные референсы: [docs/product-stories-v29.md](docs/product-stories-v29.md).

Три крупные предметные сцены для каталога, кассы и итогов: [docs/workspace-campaign.md](docs/workspace-campaign.md). История прежнего переключаемого блока; в v29 сцены используются в кассе и трёх шагах начала работы.

Полные изображения во всех демонстрационных блоках: [docs/complete-scenes.md](docs/complete-scenes.md). Проверка фактических границ предметов: `BROWSER=webkit python tests/image-fit-check.py` или `BROWSER=chromium python tests/image-fit-check.py` (Playwright + Pillow).

Единый демомагазин, заполненные экраны и обновлённые мокапы: [docs/demo-data.md](docs/demo-data.md). Воспроизводимый fixture и захват реальных компонентов приложения находятся в `tools/demo`; они не нужны для работы опубликованного сайта.

Исправление высоты херо после изменения панелей Safari и новая подача локальных данных: [docs/viewport-and-backups-v31.md](docs/viewport-and-backups-v31.md).

Полное покрытие херо под плавающей панелью Safari, включая проверку разных размеров области отрисовки и reported viewport: [docs/hero-large-viewport-v32.md](docs/hero-large-viewport-v32.md).

Стеклянные края, ускорение ленты и пауза после свайпа:
[docs/hero-glass-v37.md](docs/hero-glass-v37.md). Проверки:
`BROWSER=webkit python tests/hero-glass-check.py` и `tests/hero-motion-check.py`.

Усиленные края херо, плавающее меню и стеклянная панель просмотра:
[docs/liquid-glass-v38.md](docs/liquid-glass-v38.md). Проверка компоновки,
масштабирования, клавиатуры и отказов: `BROWSER=webkit python tests/glass-ui-check.py`
либо `BROWSER=chromium python tests/glass-ui-check.py`.

Возврат из магазина без зависшей кнопки, короткие подсказки и новая обложка
ссылки для мессенджеров: [docs/return-and-sharing-v39.md](docs/return-and-sharing-v39.md).
Проверка истории браузера и отмены позднего ответа:
`BROWSER=chromium python tests/return-navigation-check.py` либо
`BROWSER=webkit python tests/return-navigation-check.py`.

Предложение, лицензия, путь с телефона на Windows и увеличение экранов: [docs/offer-install-preview-v33.md](docs/offer-install-preview-v33.md). Проверка: `BROWSER=webkit python tests/journey-check.py` или `BROWSER=chromium python tests/journey-check.py`. Оформление этих сценариев — `journey.css`.

Загрузка, очистка стилей и устойчивость сценариев v34: [docs/runtime-loading-v34.md](docs/runtime-loading-v34.md). Проверка запросов, Retina и отказов: `BROWSER=webkit python tests/loading-check.py` либо `BROWSER=chromium python tests/loading-check.py`.

## Интерактивный демомагазин

Карточки «Продажи», «Склад», «Контроль» открывают соответствующие экраны демо;
ещё одна ссылка есть в меню. Переходы, планшетные сцены и поле отправки ссылки:
[docs/landing-demo-v36.md](docs/landing-demo-v36.md).

Открыть `/demo/` или «Открыть демо» в херо. Без регистрации: поиск/категории, чек с количеством, наличные и сдача, Kaspi, долг учебного покупателя, склад, отчёт и просмотр проведённых чеков. Прогресс сохраняется только в текущей вкладке; сброс восстанавливает исходный демомагазин.

После изменения демо:

```sh
npm run build
npm test
npm run check:styles
npm run check:demo
```

`tools/build-demo.mjs` готовит один JS с хешем содержимого, включая модель и общий fixture. Лендинг не загружает его, CSS демо или товарные фотографии этого экрана до перехода. Предыдущий JS сохраняется для кэшированного HTML. CI проверяет сборку и расчёты; исходный Windows-проект не нужен для подготовки браузерного демо.

Браузерная проверка: `BROWSER=webkit python tests/demo-check.py` либо `BROWSER=chromium python tests/demo-check.py`. В облачном стенде для WebKit также требуется `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1`. Проверки — без реальных платежей, магазинов и отправки сообщений. Подробности: [docs/live-demo-v35.md](docs/live-demo-v35.md).

Читаемые подписи, области нажатия и возврат фокуса на телефоне:
[docs/mobile-demo-v40.md](docs/mobile-demo-v40.md).
Проверка клавиатуры, границ количества и закрытия окон:
`BROWSER=webkit python tests/demo-focus-check.py` или
`BROWSER=chromium python tests/demo-focus-check.py`.
