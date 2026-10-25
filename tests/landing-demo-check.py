"""Product-card deep links, browser return, tablet layout and Safari handoff fields."""
from pathlib import Path
import json, os, shutil
from playwright.sync_api import sync_playwright

BASE = os.environ.get('SITE_TEST_URL', 'http://127.0.0.1:4173').rstrip('/')
BROWSER = os.environ.get('BROWSER', 'chromium')
PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
OUT = Path('/tmp/smart-store-landing-v36') / BROWSER
OUT.mkdir(parents=True, exist_ok=True)
ROUTES = ['sale', 'stock', 'reports']

with sync_playwright() as p:
    launch = {'headless': True}
    if BROWSER == 'chromium':
        launch.update(executable_path=shutil.which('chromium'), args=['--no-sandbox'])
    browser = getattr(p, BROWSER).launch(**launch)
    for width, height in [(320,568),(390,844),(768,1024),(844,390),(932,430),(851,768),(1024,600),(1024,768),(1440,500),(1440,900)]:
        context = browser.new_context(viewport={'width':width,'height':height}, has_touch=width<1100, is_mobile=width<1100, user_agent=PHONE, reduced_motion='reduce')
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(BASE, wait_until='networkidle')
        page.wait_for_function('document.documentElement.classList.contains("js")')
        assert page.locator('.top').evaluate('e=>e.inert'), 'Hero must keep its clean first screen'
        page.locator('#features').evaluate('e=>scrollTo(0,e.offsetTop)')
        page.wait_for_function('!document.querySelector(".top").inert')
        links = page.locator('.feature-demo-link')
        assert links.count() == 3
        assert page.locator('.bento-copy').evaluate_all('xs=>xs.every(e=>{const a=e.getBoundingClientRect(),b=e.closest("article").getBoundingClientRect();return a.top>=b.top-1&&a.bottom<=b.bottom+1})'), 'Card copy must stay within its surface'
        carousel = width <= 850 or (width <= 1100 and height <= 600)
        assert page.locator('.feature-controls').is_visible() == carousel
        if carousel:
            page.locator('#feature-next').click()
            page.wait_for_function('document.querySelector("#feature-count").textContent==="02 / 03"')
            page.locator('.bento-grid').focus();page.keyboard.press('End')
            page.wait_for_function('document.querySelector("#feature-count").textContent==="03 / 03"')
            page.keyboard.press('Home')
            page.wait_for_function('document.querySelector("#feature-count").textContent==="01 / 03"')
        for index, route in enumerate(ROUTES):
            link = links.nth(index)
            assert link.get_attribute('href') == 'demo/#'+route
            link.scroll_into_view_if_needed()
            assert link.evaluate('e=>{const a=e.getBoundingClientRect(),b=e.closest("article").getBoundingClientRect();return Math.abs(a.width-b.width)<1&&Math.abs(a.height-b.height)<1&&a.height>=44}')
            if width == 390:
                link.focus()
                page.keyboard.press('Enter')
            else:
                link.click()
            page.wait_for_url('**/demo/#'+route)
            page.wait_for_function('(route)=>document.body.dataset.route===route', arg=route)
            assert page.locator('#demo-app').is_visible()
            assert not page.locator('dialog[open]').count()
            page.go_back(wait_until='networkidle')
            page.wait_for_function('document.documentElement.classList.contains("js")')
            assert page.url.split('#')[0].rstrip('/') == BASE
        page.locator('#features').evaluate('e=>scrollTo(0,e.offsetTop)')
        if width > 850:
            nav = page.locator('#site-nav')
            assert nav.is_visible()
            assert nav.evaluate('e=>{const n=e.getBoundingClientRect(),a=e.previousElementSibling.getBoundingClientRect(),b=e.nextElementSibling.getBoundingClientRect();return n.left>=a.right&&n.right<=b.left}'), 'Desktop navigation must not overlap brand or login'
        else:
            page.locator('#menu-toggle').click()
        page.locator('#site-nav').get_by_role('link', name='Демо', exact=True).click()
        page.wait_for_url('**/demo/')
        page.locator('#demo-app').wait_for(state='visible')
        page.go_back(wait_until='networkidle')
        page.locator('#features').evaluate('e=>scrollTo(0,e.offsetTop)')
        page.locator('#features img').evaluate_all('(xs)=>Promise.all(xs.filter(i=>{const r=i.getBoundingClientRect();return r.left<innerWidth&&r.right>0}).map(i=>{i.loading="eager";return i.decode()}))')
        assert page.locator('#features .screen-content').evaluate('e=>e.scrollWidth<=e.clientWidth+1&&e.scrollHeight<=e.clientHeight+4')
        page.screenshot(path=str(OUT/f'features-{width}-{height}.png'))
        page.goto(BASE+'/#installation', wait_until='networkidle')
        assert float(page.locator('#installation-url').evaluate('e=>parseFloat(getComputedStyle(e).fontSize)')) >= 16
        assert page.locator('#installation .screen-content').evaluate('e=>e.scrollWidth<=e.clientWidth+1&&e.scrollHeight<=e.clientHeight+4')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        assert not errors, errors
        print(json.dumps({'browser':BROWSER,'viewport':[width,height],'threeDemoRoutesAndReturn':'pass','menuDemo':'pass','tabletNavigation':'fits','handoffField':'16px or larger','errors':errors}),flush=True)
        context.close()
    # Cards remain ordinary links when JavaScript is unavailable.
    context = browser.new_context(java_script_enabled=False, viewport={'width':390,'height':844})
    page = context.new_page();page.goto(BASE)
    assert page.locator('.feature-demo-link').evaluate_all('xs=>xs.every(a=>a.href.includes("/demo/#"))')
    page.locator('.feature-demo-link').first.click()
    page.wait_for_url('**/demo/#sale')
    notice = page.locator('#demo-boot noscript p')
    assert notice.is_visible() and 'включите JavaScript' in notice.inner_text()
    browser.close()
