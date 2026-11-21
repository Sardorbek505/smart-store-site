// Apply the optional Glisse optics after first paint; native CSS is immediate.
export function init() {
  const start = () => { void import('../assets/glisse-nav.a614e73127cd.js').then(m => m.init()).catch(() => {}); };
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 700 });
  else setTimeout(start, 150);
}
