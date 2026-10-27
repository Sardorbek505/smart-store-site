"""Native Back/Forward, reload and close preserve the screenshot and section.

Uses a local site and fixture services. No production visits or shop lookups.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright
import json, os, shutil

ROOT = Path(__file__).resolve().parents[1]
BROWSER = os.environ.get('BROWSER', 'chromium')

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    def log_message(self, *args):
        pass

server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
BASE = f'http://127.0.0.1:{server.server_port}'
Thread(target=server.serve_forever, daemon=True).start()

try:
    with sync_playwright() as p:
        launch = {'headless': True}
        if BROWSER == 'chromium':
            launch.update(executable_path=shutil.which('chromium'), args=['--no-sandbox'])
        browser = getattr(p, BROWSER).launch(**launch)

        def context(**kwargs):
            c = browser.new_context(reduced_motion='reduce', **kwargs)
            c.route('https://zavod.metov.store/**', lambda r: r.fulfill(status=204))
            c.route('https://connect.metov.store/**', lambda r: r.fulfill(json={'found': False}))
            c.route('https://api.github.com/**', lambda r: r.fulfill(json={'assets': []}))
            return c

        for w, h in [(320, 568), (390, 844), (844, 390), (1440, 900)]:
            c = context(viewport={'width': w, 'height': h}, is_mobile=w<851, has_touch=w<851)
            page = c.new_page()
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.goto(BASE+'/privacy.html', wait_until='networkidle')
            page.goto(BASE+'/#features', wait_until='networkidle')
            trigger = page.locator('.feature-screen-link').first
            trigger.click()
            page.wait_for_function('() => !document.querySelector("#preview-zoom").disabled')
            source = page.locator('#preview-original').get_attribute('href')
            title = page.locator('#preview-title').inner_text()
            assert page.url == BASE+'/#features'
            # Back dismisses only the preview; the visitor stays on the landing.
            page.go_back(wait_until='commit')
            page.wait_for_function('() => !document.querySelector("#preview-dialog").open')
            assert page.url == BASE+'/#features'
            assert trigger.evaluate('e => document.activeElement===e')
            page.go_forward(wait_until='commit')
            page.wait_for_function('() => document.querySelector("#preview-dialog").open')
            assert page.locator('#preview-original').get_attribute('href') == source
            assert page.locator('#preview-title').inner_text() == title
            # Closing does not consume another page or add an extra Back step.
            page.locator('#preview-close').evaluate('e=>{e.click();e.click()}')
            page.wait_for_function('() => !history.state?.smartStoreScreen')
            page.wait_for_function('() => document.activeElement===document.querySelector(".feature-screen-link")')
            assert page.url == BASE+'/#features'
            page.go_back(wait_until='networkidle')
            page.wait_for_url(BASE+'/privacy.html')
            # Restoring a preview on reload must not push another history entry.
            page.go_forward(wait_until='networkidle')
            page.wait_for_function('() => document.documentElement.classList.contains("js")')
            page.go_forward(wait_until='commit')
            page.wait_for_function('() => document.querySelector("#preview-dialog").open')
            length = page.evaluate('history.length')
            page.reload(wait_until='networkidle')
            page.wait_for_function('() => !document.querySelector("#preview-zoom").disabled')
            assert page.evaluate('history.length') == length
            assert page.locator('#preview-original').get_attribute('href') == source
            page.locator('#preview-zoom').click()
            assert page.locator('#preview-dialog').get_attribute('data-zoomed') == 'true'
            page.keyboard.press('Escape')
            page.wait_for_function('() => !history.state?.smartStoreScreen')
            page.wait_for_function('() => !document.querySelector("#preview-dialog").open && document.querySelector("#preview-dialog").dataset.zoomed==="false"')
            assert page.locator('#preview-dialog').get_attribute('data-zoomed') == 'false'
            assert page.url == BASE+'/#features'
            # A quick Forward remains open even if a native close event is queued.
            page.go_forward(wait_until='commit')
            page.wait_for_function('() => document.querySelector("#preview-dialog").open')
            page.wait_for_timeout(100)
            assert page.locator('#preview-dialog').evaluate('e => e.open')
            assert not errors, errors
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            print(json.dumps({'browser': BROWSER, 'viewport': [w,h], 'Back': 'closes preview only', 'Forward': 'same screenshot', 'closeAndEscape': 'preserve history', 'reload': 'restores without extra entry', 'errors': errors}), flush=True)
            c.close()

        # The address can still name installation after scrolling to another
        # section. History must not jump back to that old fragment on close.
        c = context(viewport={'width':390, 'height':844}, is_mobile=True, has_touch=True)
        page = c.new_page()
        page.goto(BASE+'/#installation', wait_until='networkidle')
        page.locator('[data-checkout-point="2"]').click()
        page.locator('#checkout-original').click()
        page.wait_for_function('() => !document.querySelector("#preview-zoom").disabled')
        before = page.evaluate('history.state.smartStoreScreen.y')
        source = page.locator('#preview-original').get_attribute('href')
        assert source.endswith('/img/demo-payment.png')
        page.go_back(wait_until='commit')
        page.wait_for_function('() => document.activeElement===document.querySelector("#checkout-original")')
        page.wait_for_timeout(100)
        assert abs(page.evaluate('scrollY')-before)<2
        assert page.url == BASE+'/#installation'
        page.go_forward(wait_until='commit')
        page.wait_for_function('() => document.querySelector("#preview-dialog").open')
        page.reload(wait_until='networkidle')
        page.wait_for_function('() => !document.querySelector("#preview-zoom").disabled')
        assert page.locator('#preview-original').get_attribute('href') == source
        page.locator('#preview-close').click()
        page.wait_for_function('() => document.activeElement===document.querySelector("#checkout-original")')
        page.wait_for_timeout(100)
        assert abs(page.evaluate('scrollY')-before)<2
        print(json.dumps({'browser':BROWSER, 'oldFragment': 'scroll position preserved', 'changedCheckoutScreen': 'restored on reload', 'focus': 'original button'}), flush=True)
        c.close()

        c = context(viewport={'width':390, 'height':844})
        page = c.new_page()
        page.goto(BASE+'/#features', wait_until='networkidle')
        # Foreign URLs and malformed history values never open an image.
        for saved in [True, {'src': BASE+'/img/demo-sale.png'}, {'src': 'https://foreign.invalid/img/screen.png', 'title':'Screen', 'alt':'Screen'}, {'src': BASE+'/privacy.html', 'title':'Screen', 'alt':'Screen'}]:
            page.evaluate('value => {history.replaceState({smartStoreScreen:value}, ""); dispatchEvent(new PopStateEvent("popstate"));}', saved)
            assert not page.locator('#preview-dialog').evaluate('e=>e.open')
        page.evaluate('history.replaceState(null, "")')
        # Unavailable history never blocks the screenshot or its close controls.
        page.evaluate('() => {History.prototype.pushState=()=>{throw new DOMException("Unavailable", "SecurityError")}}')
        page.locator('.feature-screen-link').first.click()
        page.wait_for_function('() => !document.querySelector("#preview-zoom").disabled')
        page.locator('#preview-close').click()
        assert not page.locator('#preview-dialog').evaluate('e=>e.open')
        assert page.url == BASE+'/#features'
        print(json.dumps({'browser': BROWSER, 'invalidHistory': 'ignored', 'unavailableHistory': 'preview and close remain usable'}), flush=True)
        c.close()
        browser.close()
finally:
    server.shutdown()
    server.server_close()
