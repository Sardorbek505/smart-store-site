"""Browser regression for installation, store login, and isolated failures.

Requires a local HTTP server, Python Playwright and Chromium.
Remote service responses and the destination test shop are intercepted.
"""

from playwright.sync_api import sync_playwright
import os
import shutil
WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
BASE = os.environ.get('SITE_TEST_URL', 'http://127.0.0.1:4173').rstrip('/')
RELEASE = {'tag_name': 'v1.29.4', 'draft': False, 'prerelease': False, 'assets': [{'name': 'SmartStore-Setup-1.29.4-x64.exe', 'size': 167772160, 'browser_download_url': 'https://github.com/Sardorbek505/smart-store-releases/releases/download/v1.29.4/SmartStore-Setup-1.29.4-x64.exe'}]}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_BINARY') or shutil.which('chromium'), args=['--no-sandbox'])
    c = b.new_context(user_agent=WIN, viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
    c.route('**/releases/latest', lambda r: r.fulfill(json=RELEASE))
    page = c.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(BASE, wait_until='networkidle')
    assert page.locator('#download').get_attribute('href').endswith('.exe')
    assert page.locator('#installation').is_hidden()
    assert page.locator('#store-submit').is_enabled()
    assert page.locator('.ribbon-canvas').count() == 1
    page.wait_for_function('document.querySelector(".gallery-stage").dataset.ready==="true"')
    geometry = page.locator('[data-gallery-card]').nth(1).evaluate(r"""e=>{const p=e.style.clipPath.match(/[-+]?[0-9]*\.?[0-9]+/g).map(Number);const n=p.length/4;return {bend:Math.abs(p[Math.floor((n-1)/2)*2+1]-(p[1]+p[(n-1)*2+1])/2),transform:getComputedStyle(e).transform}}""")
    assert geometry['bend'] > 2, geometry
    assert geometry['transform'] == 'none', geometry

    assert page.locator('[data-screen="scene"]').is_visible()
    for name, source in [('home', 'home.png'), ('sale', 'sale.png'), ('scene', 'sale.png')]:
        page.locator(f'[data-screen="{name}"]').click()
        page.locator('#product-screen-link').click()
        assert page.locator('#preview-original').get_attribute('href').endswith('/img/' + source)
        page.locator('#preview-image').wait_for(state='visible')
        page.keyboard.press('Escape')
    page.route('**/img/home.png*', lambda r: r.abort())
    page.locator('[data-gallery-card]').nth(1).evaluate("e=>e.href='img/home.png?failure=1'")
    page.locator('[data-gallery-card]').nth(1).click()
    page.wait_for_function('document.getElementById("preview-status").textContent.includes("не загрузилось")')
    assert page.locator('#preview-original').get_attribute('href').endswith('/img/home.png?failure=1')
    page.keyboard.press('Escape')
    page.unroute('**/img/home.png*')
    page.locator('[data-gallery-card]').nth(1).evaluate("e=>e.href='img/home.png'")
    page.locator('#store-code').fill('https://evil.example/')
    page.locator('#store-submit').click()
    assert page.locator('#store-form').get_attribute('data-state') == 'invalid'
    page.route('**/lookup?code=*', lambda r: r.fulfill(json={'found': False}))
    page.locator('#store-code').fill('https://demo-shop.metov.store/phone')
    page.locator('#store-submit').click()
    page.wait_for_function('document.getElementById("store-form").dataset.state==="not-found"')
    page.unroute('**/lookup?code=*')
    page.route('**/lookup?code=*', lambda r: r.fulfill(json={'unexpected': True}))
    page.locator('#store-code').fill('demo-shop')
    page.locator('#store-submit').click()
    page.locator('#store-direct').wait_for(state='visible')
    assert page.locator('#store-direct').get_attribute('href') == 'https://demo-shop.metov.store/'
    page.locator('#store-code').fill('other-shop')
    assert page.locator('#store-direct').is_hidden()
    assert page.locator('#store-direct').get_attribute('href') is None
    page.unroute('**/lookup?code=*')
    page.route('**/lookup?code=*', lambda r: r.fulfill(json={'found': False}))
    page.evaluate("() => {const real=window.fetch; window.fetch=async(...args)=> {if(String(args[0]).includes('/lookup?')) {await new Promise(r=>setTimeout(r,250));return {ok:true,json:async()=>({found:true})};} return real(...args)};}")
    page.locator('#store-code').fill('demo-shop')
    page.locator('#store-submit').click()
    page.locator('#store-code').fill('other-shop')
    page.wait_for_timeout(350)
    assert page.url.startswith(BASE)
    assert page.locator('#store-form').get_attribute('data-state') == 'idle'
    page.reload(wait_until='networkidle')
    page.unroute('**/lookup?code=*')
    page.route('**/lookup?code=*', lambda r: r.fulfill(json={'found': True, 'url': 'https://evil.example/'}))
    page.route('https://demo-shop.metov.store/', lambda r: r.fulfill(body='Test shop login'))
    page.locator('#store-code').fill('demo-shop')
    page.locator('#store-submit').click()
    page.wait_for_url('https://demo-shop.metov.store/')
    broken = c.new_page()
    broken.route('**/scripts/gallery.js*', lambda r: r.abort())
    broken.goto(BASE, wait_until='networkidle')
    assert broken.locator('#store-submit').is_enabled()
    assert broken.locator('#download').get_attribute('href').endswith('.exe')
    assert broken.locator('.gallery-controls').is_hidden()
    broken.goto(BASE + '/#ai-info', wait_until='networkidle')
    assert broken.locator('#ai-info').get_attribute('open') is not None
    runtime = c.new_page()
    runtime.add_init_script('window.ResizeObserver=undefined')
    runtime.goto(BASE, wait_until='networkidle')
    assert runtime.locator('#store-submit').is_enabled()
    assert runtime.locator('#download').get_attribute('href').endswith('.exe')
    mobile = b.new_context(user_agent=PHONE, viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, reduced_motion='reduce')
    mobile.route('**/releases/latest', lambda r: r.fulfill(json=RELEASE))
    mobile.add_init_script('Object.defineProperty(navigator,"clipboard",{value:{writeText:async(t)=>{window.copied=t}}})')
    m = mobile.new_page()
    m.goto(BASE, wait_until='networkidle')
    assert m.locator('#download').get_attribute('href') == '#installation'
    assert m.locator('[data-download]').evaluate_all('(xs)=>xs.every(e=>e.getAttribute("href")==="#installation")')
    m.locator('#download').click()
    m.locator('#copy-site').click()
    assert m.evaluate('window.copied') == 'https://metov.store/'
    assert 'скопирована' in m.locator('#copy-status').inner_text()
    for w in [320, 390, 620, 768, 1440]:
        m.set_viewport_size({'width': w, 'height': 844})
        assert m.evaluate('document.documentElement.scrollWidth<=innerWidth'), w
        heights = m.locator('main > section').evaluate_all('(xs)=>xs.map(e=>e.getBoundingClientRect().height).filter(Boolean)')
        assert all(abs(height - 844) < 1 for height in heights), (w, heights)
    m.set_viewport_size({'width': 390, 'height': 844})
    m.locator('#feature-next').click()
    m.wait_for_function('document.getElementById("feature-count").textContent==="02 / 03"')
    m.locator('#feature-next').click()
    m.wait_for_function('document.getElementById("feature-count").textContent==="03 / 03"')
    assert m.locator('#feature-next').is_disabled()
    m.locator('.bento-grid').focus()
    m.keyboard.press('Home')
    m.wait_for_function('document.getElementById("feature-count").textContent==="01 / 03"')
    assert m.locator('#feature-prev').is_disabled()
    m.goto(BASE + '/#faq', wait_until='networkidle')
    for question in m.locator('.faq-list summary').all():
        question.click()
    assert m.locator('#faq').evaluate('(e)=>e.getBoundingClientRect().height') == 844
    m.locator('.faq-list details').last.locator('p').scroll_into_view_if_needed()
    assert m.locator('.faq-list details').last.locator('p').is_visible()
    m.locator('#menu-toggle').click()
    assert m.locator('#menu-toggle').get_attribute('aria-expanded') == 'true'
    m.keyboard.press('Escape')
    nojs = b.new_context(java_script_enabled=False, viewport={'width': 390, 'height': 844})
    plain = nojs.new_page()
    plain.goto(BASE)
    assert plain.locator('#site-nav').is_visible()
    assert plain.locator('#store-submit').is_disabled()
    assert plain.locator('.screen-tabs').is_hidden()
    assert plain.locator('#download').get_attribute('href').endswith('/releases/latest')
    assert not errors, errors
    print('PASS: Windows install, mobile handoff/copy, URL validation, lookup outcomes, stale responses, constructed redirect, isolated module/runtime failure, original-screen fallback, FAQ deep link/expanded answers, viewport section heights, feature buttons/keyboard, responsive menu, no-JS fallback. No unexpected JS errors.')
    b.close()
