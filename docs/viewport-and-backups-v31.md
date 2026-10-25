# Hero viewport settlement and an understandable backup scene · v31

Review: https://metov.store/?v=31 and https://metov.store/?v=31#data

## Hero size

The touch-device viewport code froze the first `innerHeight`, including a size captured before the mobile browser finished arranging its controls. Every subsequent height-only resize was ignored. Reproduction in WebKit: open at 390×740, expand to 390×844 while still at scroll position zero; the hero remained 740 px, exposing the next section 104 px early.

The head script and viewport module now read current geometry, including an unzoomed, width-matching VisualViewport when it is larger. The module no longer reapplies a stale head measurement. At the top of the page, viewport changes settle after 180 ms of inactivity. Height is frozen during a touch gesture, editing, an open dialog, pinch zoom, or while below the top of the page. Rotation still updates the height. Scroll events only record a timestamp and queue a top-of-page settlement; there are no style writes or gallery frames during scrolling.

This keeps the hero equal to the settled viewport while preserving stable downstream section offsets during mobile toolbar movement. For an unchanged viewport, the initial HTML/CSS and enhanced hero remain identical.

`tests/native-scroll-check.py` now covers top-of-page growth/shrink, gesture protection and a delayed app module in addition to downstream browser-bar stability, rotation and expanded FAQ behavior. Before the fix, the new top-of-page case fails; after it, the hero matches 844 px and downstream unrequested scroll remains zero. WebKit first-paint tests still report zero geometry/pixel changes at four sizes. Hero motion/scroll pause remains compositor-driven with zero JavaScript animation frames.

## Data and backup meaning

The old sculptural database cylinders and anonymous storage block are removed from the active scene. The section now states **«Данные — на компьютере.»** and shows a recognizable laptop with Smart Store's actual backup screen plus a separate USB flash drive with its connector visible.

The three visible facts distinguish core offline work, automatic copies on the computer every two hours, and the explicit **«Копия на флешку»** action. The text says to keep the USB copy separately; the picture does not imply that a disconnected flash drive is continuously synchronized. Tapping the scene opens the original readable screenshot.

- `img/demo-backups.png`: real `BackupsPanel` from application revision 6aa6219ea05addd40e1aada99a4a531518728925, rendered inside the existing isolated demo harness, with a synthetic previous backup and USB-copy date. No actual database or user backup was accessed, and no backup action was invoked.
- `tools/demo/entry.tsx` adds the native panel under `?screen=backups`; `tools/demo/capture.py` captures it alongside the other real screens. Existing fixture values are unchanged.
- Generated original, preserved: `/workspace/generated_images/exec-a2f2d936-d33b-4453-9f6b-3ad314edaee9.png`.
- Encoded scene: `img/data-backup-laptop-{768,1536}.webp`, from that original with the native PNG as its image-generation reference. ImageMagick only performs responsive encoding/resizing.

The prompt requested one complete, nearly front-facing silver laptop displaying the native backup UI, one separate cobalt USB flash drive with an exposed connector, a shallow blue desk mat, transparent margins, and no database cylinders, server blocks, cloud, arrows or cables.

The responsive scene and source are included in `tests/image-fit-check.py`. WebKit whole-object bounds and one-viewport story checks pass at short phone, normal phone, landscape and desktop sizes. Chromium screenshots are visually reviewed. Browser-engine checks do not substitute for testing on a physical iPhone.
