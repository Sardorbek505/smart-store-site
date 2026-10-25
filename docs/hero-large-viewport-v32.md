# Hero coverage beneath mobile browser controls · v32

Review: https://metov.store/?v=32

The v31 fix corrected stale startup measurements but still sized the hero using the height reported by `innerHeight` / `visualViewport.height`. Those measurements do not necessarily describe the whole page canvas visible behind a floating mobile browser toolbar. The user's follow-up screenshot shows the next light section in that lower area.

On touch devices the hero now has `min-height:100lvh`, with a `100vh` fallback. Its CSS minimum is independent of the JavaScript screen-height lock. It covers the large viewport from the first CSS paint, including content behind retractable browser controls. Other sections retain their existing stable height. No extra resize handler, device-height heuristic, fixed pixel extension or rendering loop is introduced.

The browser defines the stable large viewport. This follows [MDN's distinction between small, large and dynamic viewport sizes](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length#large_viewport_units): large viewport units remain stable when browser controls retract, while dynamic units can resize during scrolling. The Safari background/layout distinction is also reflected in [WebKit's discussion of floating browser controls](https://bugs.webkit.org/show_bug.cgi?id=299003); the workaround does not depend on that bug's current status.

## Regression case that was missing

`tests/hero-coverage-check.py` preserves a real CSS painting viewport of 390×844 while modeling reported window/visual height of 740 px. Headless engines do not include the native iOS browser toolbar, so this is an explicit model of the distinct measurements, not a physical Safari test.

Before v32, with app modules deliberately held back:

- Reported viewport: 740 px.
- CSS large viewport: 843.98 px.
- Hero and next-section offset: 740 px, exposing 104 px of the next section.

After v32 the hero and next-section offset cover the full 844 px, before and after enhancement modules. Coverage is also checked at 393×852/710 reported, 430×932/812 reported and 844×390/310 reported, in Chromium and WebKit. A hit test at the bottom of the real viewport must still belong to the hero. Subsequent reported-toolbar-height changes and downstream scrolling must not move section offsets or scroll position.

`tests/native-scroll-check.py` now waits for the stored screen-height update when asserting settled numeric geometry: the hero's independent CSS minimum can already match the viewport before the debounced module completes. Gesture protection still checks that the stored document geometry stays fixed.

First-paint equality and the existing native-scroll and hero-motion checks remain required. The deployment changes only the scoped hero CSS and its cache version, plus regression coverage and documentation.
