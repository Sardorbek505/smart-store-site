# Different ways to show the product · v29

Review: https://metov.store/?v=29#workspace

The repeated three-button selectors are removed from the workspace, phone, local-data and installation sections. Each section remains one stable viewport; original product screenshots remain available in the preview dialog.

- **Checkout:** one complete generated POS scene, with three numbered points beside product, receipt and payment. Tapping a point reveals a short detail and the matching source screenshot. Keyboard arrows/Home/End move between points. The hardware does not jump between scenes.
- **Phone:** one large iPhone and a guided, tap-driven demonstration. Overview (396 950 ₸ / 17 receipts) → find the drill (39 900 ₸ / 12 in stock) → add it to the existing 650 ₸ disc (40 550 ₸). The final caption explicitly says payment happens on the computer. One action button advances the flow and restarts it. This is an isolated marketing demonstration and makes no store API mutations.
- **Local data:** one generated isometric computer/database/backup scene. All three explanations are visible immediately: local storage, core offline features, automatic copies every two hours. The external-copy reminder stays visible.
- **Getting started:** three illustrated steps are simultaneously visible. Each illustration opens its corresponding native screenshot: dashboard, catalogue, mixed payment. Desktop columns become three rows on phones.

## References actually inspected

Visual inspiration and interaction patterns, independently implemented for this static site; no third-party component code or images copied into production:

- [Pinterest: isometric technology composition](https://www.pinterest.com/pin/258816309821879016/) — the public pin's image was inspected (Pinterest's text reader returned 403, but the public page and og:image were accessible). A single connected physical scene and restrained geometric framing.
- [Pinterest: simple process diagram](https://www.pinterest.com/pin/661255157757202432/) — an understandable relationship between a few objects instead of a crowded node graph.
- [21st / Ravi Katiyar: How It Works](https://21st.dev/@ravikatiyar162/components/how-it-works) — all steps visible at once with numbers and concise descriptions. Inspected the live rendered page and component preview.
- [Bencho: Step Player](https://bencho.dev/blocks/step-player) — a small progress indicator tied to a deliberate action; adapted to the phone's three-stage demonstration without autoplay.
- [Bencho: Action Node](https://bencho.dev/blocks/action-node) — contextual controls near the object they explain.
- [Morphin: Animated Expandable Card Stack](https://morphin.dev/components/animated-expandable-card-stack) — finite reveal feedback after tapping; public preview inspected. The landing uses a short opacity/translation transition without importing the stack or GSAP.
- [Libraries.dev](https://libraries.dev/) — inspected the gallery; its continuous orbs, liquid effects and shaders do not improve the product demonstration. Existing finite focus treatment remains; no extra rendering library added.

## Assets and capture

The existing coherent fixture is unchanged; see [demo-data.md](demo-data.md).

`tools/demo/capture-phone-tour.py` runs against the isolated real application harness and captures `img/demo-phone-drill.png` from the native mobile product lookup. Run after the harness is built and served at port 4174:

```sh
python tools/demo/capture-phone-tour.py
```

New generated originals are preserved outside the public repository:

- Local-data composition: `/workspace/generated_images/exec-37d4cd01-b44c-4e33-9cc6-f0c5eea84522.png` → `img/data-local-scene.webp`.
- Phone drill scene: `/workspace/generated_images/exec-748068c2-61c6-41a3-a32a-74b6fef1f588.png` → `img/mobile-demo-drill.webp`. References: the new native product screenshot and the existing phone search hardware composition. Whole phone and support remain within the frame.

Image generation produced both scenes. ImageMagick only encoded WebP. No generated interface is used as the source screenshot.

## Implementation and verification

`story.css` owns the new responsive compositions; obsolete story CSS was removed. `scripts/story.js` owns only the checkout points and guided phone flow. There are no scroll listeners, autoplay timers, Canvas or render loops in that module. Transitions finish in 220 ms and respect reduced motion, including a preference change during animation.

The phone waits for an image to decode before advancing its visible state. Generated-image failures fall back to the native screenshot. If both fail, the current state remains and the action permits retry. The rest of the page works if the story module fails, and static images/links/steps remain useful without JavaScript.

Browser regression coverage: all sections and story states at 320×568, 390×844, 844×390, 768×1024 and 1440×900; contextual preview links, keyboard operation and focus return; no horizontal overflow; whole source and painted-image bounds; image/module failure; reduced motion; first-paint stability; mobile browser-bar resizing. WebKit is browser-engine coverage, not a physical iPhone test.
