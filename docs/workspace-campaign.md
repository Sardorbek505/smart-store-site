# Экран программы: крупные предметные сцены

Прямая ссылка на текущую композицию: https://metov.store/?v=28#workspace. Полный демомагазин и новые изображения: [demo-data.md](demo-data.md). Полные версии предметов без обрезанных краёв: [complete-scenes.md](complete-scenes.md). Ниже описана первоначальная композиция v26 и её исходники.

Прежний блок «Smart Store в работе» занимал целый экран, но на телефоне показывал маленькую горизонтальную фотографию среди больших пустых полей. Сейчас рабочий экран — главный предмет композиции. Светлый фон отделяет его от тёмной сцены мобильного доступа.

## Композиция и поведение

- На компьютере заголовок и управление слева, крупная предметная сцена справа. На телефоне: заголовок, сцена, один демонстрационный факт и переключатель.
- Три разные сцены: ноутбук с каталогом и инструментом; кассовый терминал с принтером; монитор с физическими столбцами диаграммы. Никаких наложенных маленьких экранов.
- При выборе одновременно меняются заголовок, пояснение, изображение, показатель и ссылка на исходный PNG. Каталог: 12 шт; касса: 82 300 ₸; итоги: прибыль 11 230 ₸. Значения соответствуют исходным скриншотам.
- Факт помечен «ДЕМО»; атомарный status содержит контекст «Демонстрационные данные» для программы чтения с экрана.
- Нажатие на сцену открывает исходный скриншот. Доступны стрелки, Home/End, Escape и возврат фокуса после просмотра.
- Начальная композиция, текст и ссылка уже находятся в HTML. Без JavaScript доступен каталог. Под переключатель зарезервирована высота, поэтому его включение не уменьшает сцену после первого кадра.
- При ошибке загрузки мокапа показан исходный PNG. Короткое появление после выбора длится 180 мс; reduced motion его отключает. Новых обработчиков scroll, кадровых циклов, Canvas, зависимостей и сетевых скриптов нет.

Оформление находится в разделе Desktop workspace файла `story.css`; переключение — в `setupScreens` файла `scripts/interface.js`. Существующий компонент переключателя из `components.css` сохраняет одну скользящую выбранную подложку.

## Создание изображений

Изображения созданы через image generation по реальным скриншотам `img/products.png`, `img/sale.png`, `img/home.png`. Первый проход создавал предметную сцену на светлом фоне. Второй проход через тот же генератор удалил фон и сохранил предметы, интерфейс и мягкие контактные тени: при примерке был виден прямоугольник немного отличавшегося студийного фона. В браузере прозрачные сцены лежат на общем #EDEDF5, без цветового шва. Программной перерисовки интерфейса и композиции нет; ImageMagick используется только для кодирования WebP quality 93.

| Опубликованный файл           | Содержимое экрана | Формат                  |
| ----------------------------- | ----------------- | ----------------------- |
| `img/workspace-catalog.webp`  | `products.png`    | 1122×1402, WebP с alpha |
| `img/workspace-sale.webp`     | `sale.png`        | 1122×1402, WebP с alpha |
| `img/workspace-overview.webp` | `home.png`        | 1122×1402, WebP с alpha |

Общая часть промпта: high-end advertising product photograph; portrait 4:5; one dominant device; reproduce supplied real Russian screenshot, preserve amounts; palette cobalt #1D4ED8 / ink #111116 / paper #EDEDF5; crisp legible display; controlled editorial lighting; no extra headline or floating UI; tight object-forward composition.

Различия сцен:

1. Catalogue: premium silver laptop, restrained three-quarter angle, upright screen, cobalt half-cylinder step, cordless drill and small barcode tag in lower foreground.
2. Checkout: near-front black POS display on an angled stem, cobalt rectangular plinth, compact white thermal printer and curling receipt; total 82 300 ₸ visible.
3. Results: silver all-in-one monitor turned in the opposite direction, cobalt circular base, three short physical blue bars and diagonal keyboard; actual revenue and profit tiles retained.

Промпт второго прохода: isolate the exact composition on a fully transparent background; remove only pale studio background and ground; preserve every physical object and original real UI, keep podium opaque; retain subtle contact shadows with partial alpha; transparent between separate objects; no rectangular floor, outline or new elements.

Оригиналы генератора сохранены вне публикуемого репозитория:

- Первый проход: `exec-cb1d5509-c829-4a97-85c6-dca08fa74347.png`, `exec-ca24ed1f-cab8-4a96-be1a-ee145136daf5.png`, `exec-cca6c0a1-6730-4b8f-84f3-d031cc5edec1.png`.
- Прозрачные сцены: `exec-98427631-2fdd-48bb-9716-32b48f2b30ba.png`, `exec-2ef3cc74-405e-4bbd-bb0b-1846728f501a.png`, `exec-da0c4142-0430-4d93-abf3-78e52c490b5d.png` в `/workspace/generated_images`.

## Проверка

`tests/story-check.py`: WebKit и Chromium, 320×568, 390×844, 844×390, 1440×900. Проверяет три сцены и соответствующие оригиналы/значения, размер изображения, клавиатуру, завершение перехода и вписывание в одну секцию. Существующие `browser-check.py`, `components-check.py`, `site-review-check.py`, `native-scroll-check.py` и `first-paint-check.py` проверяют связанные сценарии.

Финальная локальная проверка: обе story-регрессии проходят; WebKit — нативный скролл без непрошенных сдвигов, стабильное херо до/после запуска модулей и отдельная проверка геометрии workspace до/после запуска. Axe WCAG A/AA: 0 нарушений в трёх состояниях при 390×844 и 1440×900. Проверены также компоненты, общая браузерная регрессия и 6 доменных unit-тестов.
