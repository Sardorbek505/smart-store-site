# Component sources

The desktop workspace scenes, live headings and demo facts are original to this landing. Generated device photographs use the project's real application screenshots; provenance and prompts: [workspace-campaign.md](../docs/workspace-campaign.md). The existing native sliding selector remains in use. No additional library code or runtime dependency was introduced.

These components are native HTML/CSS adaptations. No React, Motion, GSAP or remote component scripts are loaded by the website.

| Website component       | Source used                                                                                                                                                                                                                                             | Integration                                                                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hero “Открыть демо”     | [Magic UI Interactive Hover Button on 21st](https://preview.21st.dev/%40dillionverma/components/interactive-hover-button), [upstream source](https://github.com/magicuidesign/magicui/blob/main/apps/www/registry/magicui/interactive-hover-button.tsx) | MIT source port: expanding dot, original label, second sliding label. Native anchor, original Russian text, decorative duplicate hidden from accessibility.                                            |
| Store form focus border | [Libraries.dev Border Beam](https://libraries.dev/beam), [upstream CSS](https://github.com/Jakubantalik/Libraries.dev/blob/main/packages/border-beam/src/styles.ts)                                                                                     | MIT adaptation of its layered exclusion mask. A native transform runs once on focus; no paint-heavy custom-property loop, blur, hue rotation or React driver. Brand blue replaces the rainbow palette. |
| Product screen selector | [Bencho Tab bar](https://bencho.dev/blocks/tab-bar), [Morphin Animated Multi-Chain Selector](https://morphin.dev/components/animated-multi-chain-selector)                                                                                              | Public visual references. Original implementation: fixed labels, equal columns and one CSS sliding selection tile; no copied paid source.                                                              |
| FAQ                     | [Bencho FAQ accordion](https://bencho.dev/blocks/faq-accordion)                                                                                                                                                                                         | Public visual reference. Original native `details` implementation with outlined rows, rotating plus and a short answer fade. Multiple answers and no-JavaScript use remain supported.                  |
| Installation copy field | [Bencho Copy field](https://bencho.dev/blocks/copy-field)                                                                                                                                                                                               | Public visual reference. Original implementation: integrated copy control and a checkmark only after clipboard success.                                                                                |

Inspected 24 October 2026. Bencho's full-source access requires its subscription. Morphin's public registry README states that it has no license file. Neither site's source code was copied. Their common interaction patterns informed the native implementations. The upload dropzone was reviewed; the landing page has no file-upload workflow, so it was not added.

The complete upstream MIT notices for the adapted code are retained alongside this file.

## Product story components (v22)

- **Asymmetric feature Bento:** original native CSS composition following the [Magic UI Bento Grid](https://magicui.design/docs/components/bento-grid) pattern. The previously suggested 21st `ln-dev7/bento-01` preview currently returns 404; no inaccessible source was used. Existing generated transparent artwork remains in its matching blue/paper/ink cards.
- **Selectable start steps:** public [Bencho Step Player](https://bencho.dev/blocks/step-player) reference. Original buttons, connecting progress line and screenshot selection; no copied paid source, auto-play or scroll takeover.
- **Local storage hub:** public [Bencho Hub Diagram](https://bencho.dev/blocks/hub-diagram) reference. Original SVG paths, local computer core and three accessible detail selectors. No remote/cloud backup claim is introduced.
- **Expandable phone screenshots:** public [Morphin Animated Expandable Card Stack](https://morphin.dev/components/animated-expandable-card-stack) and its [live preview](https://cdn.morphin.dev/camellia/screens/3ea5640c-a65d-480d-8fd4-c301096d7f04/index.html). Original native implementation: a three-screen fan, selection, collapse/expand, keyboard shortcuts and a separate original-image link. No paid or unlicensed source was copied.

These additions use no runtime framework or animation dependency. The original screenshots were captured from the Smart Store source with isolated demonstration data; see [product-stories.md](../docs/product-stories.md).

### Phone revision (v23)

The small expandable fan is superseded by three generated iPhone 18 Pro Max scenes, one visible at a time. The image-generation tool used the real `phone.png`, `phone-search.png`, and `phone-cart.png` as image references. No CSS phone shell or synthetic screenshot card is used. Original screen PNGs remain the preview targets. Hardware cues were checked against [Apple's iPhone 18 Pro specifications](https://www.apple.com/iphone-18-pro/specs/). Scene prompts, assets and display decisions are documented in [iphone-mockups.md](../docs/iphone-mockups.md).

### Campaign revision (v24)

The mobile section now uses three newly generated transparent iPhone cutouts on a native dark/cobalt campaign stage, with oversized typography and two contextual callouts. The primary callout uses demonstration values from the actual referenced screens; the secondary search callout is a working selector shortcut. No third-party component code or runtime dependency was added. See [mobile-campaign.md](../docs/mobile-campaign.md).

В v29 повторяющиеся переключатели удалены. Новые композиции самостоятельно реализованы по визуальным референсам Pinterest, 21st, Bencho и Morphin. Перечень просмотренных источников и использованных приёмов: [product-stories-v29.md](../docs/product-stories-v29.md). Новый код и изображения сторонних библиотек не включались.

## Standalone training store (v35)

`/demo/` is original HTML/CSS/JavaScript. It uses the same isolated fixture and product photographs as the landing screenshots. The sales cards, stock rows and report hierarchy were checked against the native Smart Store renderer; no Electron APIs or framework runtime are shipped. The installed UI UX Pro Max skill informed keyboard, focus, touch and responsive checks. Its generic design-system searches did not provide a product-specific system matching the supplied palette; general flat-interface guidance was adapted to the existing brand and native product. There is no newly copied library component or new third-party runtime dependency.
