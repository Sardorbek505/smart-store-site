// Native adapter for Glisse's MIT lens and rim. No React runtime or frame loop.
import { createBackdropLens, shapeOf } from './lens';
import { rimMap } from './rim';

export function init() {
  enhanceControls();
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

// Compact controls share cached Glisse rims. Only the floating screenshot dock
// needs another live lens; nested buttons never filter the same backdrop twice.
function enhanceControls() {
  const elements = [...document.querySelectorAll<HTMLElement>('[data-liquid]:not([data-liquid="sheet"])')];
  if (!elements.length || typeof IntersectionObserver !== 'function') return;
  const reduced = matchMedia('(prefers-reduced-transparency: reduce), (forced-colors: active)');
  const visible = new Set<HTMLElement>();
  const lenses = new Map<HTMLElement, ReturnType<typeof createBackdropLens>>();
  const keys = new WeakMap<HTMLElement, string>();
  const rims = new Map<string, string>();
  let timer: ReturnType<typeof setTimeout>;
  const clear = (element: HTMLElement) => {
    lenses.get(element)?.destroy();
    lenses.delete(element);
    element.style.removeProperty('--lg-rim');
    delete element.dataset.rim;
    delete element.dataset.refraction;
    keys.delete(element);
  };
  const fit = () => {
    if (reduced.matches) { elements.forEach(clear); return; }
    if (document.hidden) return;
    for (const element of visible) {
      if (!element.getClientRects().length) { clear(element); continue; }
      const style = getComputedStyle(element);
      const shape = shapeOf(element, style);
      if (!shape || shape.width * shape.height > 180000) continue;
      const channels = style.color.match(/[\d.]+/g)?.slice(0,3).map(Number) || [0];
      const light = channels.reduce((a,b)=>a+b,0) / channels.length < 128;
      const density = Math.min(devicePixelRatio || 1, 2);
      const key = [shape.width, shape.height, shape.radius, light, density].join('|');
      if (keys.get(element) === key) continue;
      try {
        let rim = rims.get(key);
        if (!rim) {
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) continue;
          const map = rimMap(shape, light ? 0.3 : 0.13, density, light ? [0,0,0,0.08] : [255,255,255,0.08]);
          canvas.width = map.columns; canvas.height = map.rows;
          const pixels = context.createImageData(map.columns, map.rows);
          pixels.data.set(map.data); context.putImageData(pixels,0,0);
          rim = `url("${canvas.toDataURL()}")`;
          if (rims.size >= 40) rims.delete(rims.keys().next().value!);
          rims.set(key, rim);
        }
        element.style.setProperty('--lg-rim', rim);
        element.dataset.rim = '';
        if (element.dataset.liquid === 'dock' && /Chrom(?:e|ium)\//.test(navigator.userAgent)) {
          let lens = lenses.get(element);
          if (!lens) {
            lens = createBackdropLens(element, { strength: 2, dispersion: 0.6, depth: 0.3, maxDepth: 36, dome: 0, splay: 1, relative: true, bezel: true, paintsLight: true });
            lenses.set(element, lens);
          }
          lens.refit(); lens.update(1);
          element.dataset.refraction = 'live';
        }
        keys.set(element,key);
      } catch { clear(element); }
    }
  };
  const schedule = () => { clearTimeout(timer); timer = setTimeout(fit,120); };
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const element = entry.target as HTMLElement;
      if (entry.isIntersecting) visible.add(element);
      else { visible.delete(element); clear(element); }
    }
    schedule();
  });
  const resize = new ResizeObserver(schedule);
  for (const element of elements) { observer.observe(element); resize.observe(element); }
  const state = new MutationObserver(schedule);
  for (const dialog of document.querySelectorAll('dialog')) state.observe(dialog,{attributes:true,attributeFilter:['open']});
  reduced.addEventListener('change',schedule);
  document.addEventListener('visibilitychange',schedule);
}
