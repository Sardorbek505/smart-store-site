// Load optical maps only when the navigation first becomes visible.
export function init() {
  const header = document.querySelector('.landing-page .top');
  if (!header) return;
  const open = () => {
    if (header.inert || !document.body.classList.contains('has-scrolled')) return;
    observer.disconnect();
    void import('../assets/glisse-nav.78ee59faada8.js').then(m => m.init()).catch(() => {});
  };
  const observer = new MutationObserver(open);
  observer.observe(header, { attributes: true, attributeFilter: ['inert'] });
  open();
}
