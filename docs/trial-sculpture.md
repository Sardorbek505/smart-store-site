# 14 days · campaign sculpture

Review: https://metov.store/?v=30#license

The plain, rotated CSS numeral and thin ellipse outlines are replaced by a generated 3D sculpture: porcelain numeral faces, chrome bevels, cobalt extrusion and a paper checkout-receipt ribbon. The existing 14-day trial, activation, licence-price contact and post-trial data-access wording are unchanged.

The art is a transparent image on the site's exact cobalt background. The complete sculpture and ribbon fit inside the frame; no CSS cropping, filters, live 3D or animation is used. It remains visible on short phones, where the former graphic was hidden. The illustration is decorative to assistive technology because the offer is also stated in live HTML.

## Source

- Generated original, preserved: `/workspace/generated_images/exec-d46cb221-ac75-43eb-82e1-c3292f9e4cc3.png` (1254 × 1254).
- WebP: `img/trial-14-1254.webp`, approximately 173 KiB.
- Small WebP: `img/trial-14-768.webp`, approximately 72 KiB.
- ImageMagick only encodes and resizes the original; it does not draw or composite the artwork.
- Native `srcset`, lazy loading and fixed source dimensions provide the appropriate resolution without adding rendering work during scrolling.

The generation brief called for a legible, geometric “14”, ceramic white #EDEDF5, polished chrome bevels, cobalt #1D4ED8 side faces, a single receipt ribbon behind and through the four, one small chrome sphere and one cobalt block, with generous transparent margins and no other lettering.

## Layout and validation

`trial.css?v=30` scopes the layout to the licence section. Desktop uses a large sculpture beside the offer; phones place it above the offer, with all content inside one stable viewport. The existing download/mobile installation handoff and WhatsApp links are retained.

Both Chromium and WebKit are checked at 320×568, 390×844, 430×932, 768×1024, 844×390 and 1440×900: whole source/painted subject, section fit, visible 44 px action targets, no horizontal overflow and no running illustration animation. The existing full-image regression check includes both new image variants and the rendered trial scene.
