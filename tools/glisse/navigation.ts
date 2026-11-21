// Native adapter for Glisse's MIT lens and rim. No React runtime or frame loop.
import { createBackdropLens, shapeOf } from './lens';
import { rimMap } from './rim';

export function init() {
  const pane = document.querySelector<HTMLElement>('.landing-page .top-inner');
  const header = pane?.closest<HTMLElement>('.top');
  if (!pane || !header) return;
  const reduced = matchMedia('(prefers-reduced-transparency: reduce), (forced-colors: active)');
  const refracts = /Chrom(?:e|ium)\//.test(navigator.userAgent);
  let lens: ReturnType<typeof createBackdropLens> | undefined;
  let last = '';
  let timer: ReturnType<typeof setTimeout>;
  const clear = () => {
    lens?.destroy();
    lens = undefined;
    pane.style.removeProperty('--lg-rim');
    delete pane.dataset.rim;
    delete pane.dataset.refraction;
    last = '';
  };
  const fit = () => {
    if (reduced.matches) return clear();
    if (document.hidden || header.inert) return;
    const shape = shapeOf(pane);
    if (!shape) return;
    const light = header.dataset.surface === 'light';
    const density = Math.min(devicePixelRatio || 1, 2);
    const key = [shape.width, shape.height, shape.radius, light, density].join('|');
    if (key === last) return;
    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return;
      const rim = rimMap(shape, light ? 0.3 : 0.13, density, light ? [0,0,0,0.08] : [255,255,255,0.08]);
      canvas.width = rim.columns;
      canvas.height = rim.rows;
      const pixels = context.createImageData(rim.columns, rim.rows);
      pixels.data.set(rim.data);
      context.putImageData(pixels, 0, 0);
      pane.style.setProperty('--lg-rim', `url("${canvas.toDataURL()}")`);
      pane.dataset.rim = '';
      if (refracts) {
        lens ??= createBackdropLens(pane, {
          strength: 2, dispersion: 0.6, depth: 0.3, maxDepth: 36,
          dome: 0, splay: 1, relative: true, bezel: true, paintsLight: true,
        });
        lens.refit();
        lens.update(1);
        pane.dataset.refraction = 'live';
      }
      last = key;
    } catch {
      // CSS frost remains usable when canvas or SVG filters are unavailable.
      clear();
    }
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(fit, 120);
  };
  new ResizeObserver(schedule).observe(pane);
  new MutationObserver(schedule).observe(header, { attributes: true, attributeFilter: ['data-surface', 'inert'] });
  reduced.addEventListener('change', schedule);
  document.addEventListener('visibilitychange', schedule);
  window.addEventListener('pageshow', schedule);
  schedule();
}
