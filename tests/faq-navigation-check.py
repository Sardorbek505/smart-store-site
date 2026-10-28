"""FAQ answers stay in page flow, including incoming links and failed JS.

All service responses are fixtures; no production visits or shop lookups.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, os, shutil

BASE = os.environ.get('SITE_TEST_URL', 'http://127.0.0.1:4173').rstrip('/')
BROWSER = os.environ.get('BROWSER', 'chromium')
OUT = Path(os.environ.get('FAQ_SCREENSHOTS', '/tmp/smart-store-faq')) / BROWSER
OUT.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    options = {'headless': True}
    if BASE.startswith('https://') and os.environ.get('HTTPS_PROXY'):
        options['proxy'] = {'server': os.environ['HTTPS_PROXY']}
    if BROWSER == 'chromium':
        options.update(executable_path=shutil.which('chromium'), args=['--no-sandbox'])
    browser = getattr(p, BROWSER).launch(**options)

    def context(**options):
        c = browser.new_context(reduced_motion='reduce', **options)
        c.route('https://zavod.metov.store/**', lambda r: r.fulfill(status=204))
        c.route('https://connect.metov.store/**', lambda r: r.fulfill(status=204))
        c.route('https://api.github.com/**', lambda r: r.fulfill(status=503))
        return c

    for w, h in [(320, 568), (390, 844), (844, 390), (1440, 900)]:
        c = context(viewport={'width': w, 'height': h}, is_mobile=w < 500, has_touch=w < 500)
        page = c.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        for answer in ['ai-info', 'data', 'license-info']:
            page.goto(BASE + '/#' + answer, wait_until='networkidle')
            page.wait_for_function('(id)=>document.getElementById(id).open', arg=answer)
            page.wait_for_timeout(80)
            metrics = page.locator('#' + answer).evaluate('''e => {
              const frame = e.closest('.screen-content');
              const box = e.getBoundingClientRect(), parent = frame.getBoundingClientRect();
              return {top: box.top, bottom: box.bottom,
                headerBottom: document.querySelector('.top-inner').getBoundingClientRect().bottom,
                contained: box.top >= parent.top - 1 && box.bottom <= parent.bottom + 1,
                overflow: frame.scrollHeight > frame.clientHeight + 4,
                innerScroll: frame.scrollTop};
            }''')
            assert metrics['contained'] and not metrics['overflow'], (w, answer, metrics)
            assert metrics['innerScroll'] == 0, (w, answer, metrics)
            assert metrics['top'] >= metrics['headerBottom'] + 4, (w, answer, metrics)
            assert metrics['bottom'] <= h, (w, answer, metrics)
            assert page.url.endswith('#' + answer)
        page.screenshot(path=str(OUT / f'answer-{w}.png'))

        page.goto(BASE + '/#faq', wait_until='networkidle')
        for summary in page.locator('.faq-list summary').all():
            summary.click()
        assert page.locator('#faq').evaluate('e=>e.offsetHeight>innerHeight')
        assert page.locator('#faq .screen-content').evaluate('e=>e.scrollHeight<=e.clientHeight+4 && e.scrollTop===0')
        last_answer = page.locator('.faq-list details').last.locator('p')
        last_answer.scroll_into_view_if_needed()
        assert last_answer.evaluate('e=>e.getBoundingClientRect().bottom<=innerHeight+1')
        assert page.locator('footer').evaluate('e=>e.getBoundingClientRect().top>=document.querySelector(".faq-list").getBoundingClientRect().bottom')
        # Native input scrolls the document, without a second scroll container.
        # Playwright mobile WebKit does not implement Mouse.wheel.
        before = page.evaluate('scrollY')
        page.mouse.move(w / 2, h / 2)
        if BROWSER == 'webkit' and w < 500:
            page.keyboard.press('PageUp')
        else:
            page.mouse.wheel(0, -120)
        page.wait_for_function('(before)=>scrollY<before', arg=before)
        assert page.locator('#faq .screen-content').evaluate('e=>e.scrollTop===0')
        assert not errors, errors
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        print(json.dumps({'browser': BROWSER, 'viewport': [w, h], 'incomingAnswers': 'readable below header', 'expandedAnswers': 'page scroll, no clipping', 'errors': errors}), flush=True)
        c.close()

    # A late interface module must correct the browser's early collapsed anchor.
    c = context(viewport={'width': 844, 'height': 390})
    def delayed_interface(route):
        response = route.fetch()
        route.fulfill(response=response, body='await new Promise(resolve=>setTimeout(resolve,150));\n' + response.text())
    c.route('**/scripts/interface.js*', delayed_interface)
    page = c.new_page()
    page.goto(BASE + '/#ai-info', wait_until='networkidle')
    page.wait_for_function('document.querySelector("#ai-info").open')
    assert page.locator('#ai-info p').evaluate('e=>e.getBoundingClientRect().bottom<=innerHeight')
    c.close()

    # Native details retain the same readable flow without JavaScript.
    c = context(viewport={'width': 390, 'height': 844}, java_script_enabled=False)
    page = c.new_page()
    page.goto(BASE + '/#faq', wait_until='networkidle')
    for summary in page.locator('.faq-list summary').all():
        summary.click()
    assert page.locator('#faq').evaluate('e=>e.offsetHeight>innerHeight')
    last = page.locator('.faq-list details').last.locator('p')
    last.scroll_into_view_if_needed()
    assert last.evaluate('e=>e.getBoundingClientRect().bottom<=innerHeight+1')
    c.close()
    browser.close()
