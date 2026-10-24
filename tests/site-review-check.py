"""Cross-browser checks for the narrow screen selector and FAQ/menu navigation."""
from playwright.sync_api import sync_playwright
import os, shutil, json

BASE = os.environ.get('SITE_TEST_URL', 'http://127.0.0.1:4173').rstrip('/')
BROWSER = os.environ.get('BROWSER', 'chromium')
with sync_playwright() as p:
    args = {'headless': True}
    if BROWSER == 'chromium':
        args.update(executable_path=shutil.which('chromium'), args=['--no-sandbox'])
    b = getattr(p, BROWSER).launch(**args)
    for w,h in [(320,568),(390,844),(844,390),(1440,900)]:
        page=b.new_page(viewport={'width':w,'height':h},has_touch=w<851,is_mobile=w<851,reduced_motion='reduce')
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(BASE+'/#ai-info',wait_until='networkidle')
        page.wait_for_timeout(150)
        answer=page.locator('#ai-info')
        assert answer.get_attribute('open') is not None
        summary=answer.locator('summary').bounding_box()
        header=page.locator('.top').bounding_box()
        assert summary['y'] >= header['y']+header['height'], {'summary':summary,'header':header}
        answer.evaluate('e=>e.open=false')
        page.wait_for_function('!document.querySelector("#faq .screen-content").classList.contains("is-scrollable")')
        for name,source in [('scene','sale.png'),('sale','sale.png'),('home','home.png')]:
            tab=page.locator(f'[data-screen="{name}"]')
            page.locator('.product-section').evaluate('e=>scrollTo(0,e.offsetTop)')
            box=tab.bounding_box()
            assert box['x']>=0 and box['x']+box['width']<=w, {'name':name,'width':w,'box':box}
            assert box['height']>=44
            assert tab.evaluate('e=>e.scrollWidth<=e.clientWidth'), name
            tab.click()
            assert tab.get_attribute('aria-pressed')=='true'
            assert page.locator('#product-screen-link').get_attribute('href').endswith(source)
        page.locator('#data').evaluate('e=>scrollTo(0,e.offsetTop)')
        assert page.locator('#data .data-item').count()==3
        assert page.locator('#data .screen-content').evaluate('e=>e.scrollWidth<=e.clientWidth && e.scrollHeight<=e.clientHeight+4')
        unexpected=page.locator('.screen-content.is-scrollable').evaluate_all('xs=>xs.map(e=>({section:e.closest("section").getAttribute("aria-labelledby")||e.closest("section").id,scroll:e.scrollHeight,height:e.clientHeight}))')
        assert not unexpected,unexpected
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        missing=page.locator('a[href^="#"]').evaluate_all('xs=>xs.map(a=>a.getAttribute("href")).filter(h=>h.length>1&&!document.getElementById(decodeURIComponent(h.slice(1))))')
        assert not missing,missing
        if w<851:
            toggle=page.locator('#menu-toggle')
            toggle.focus();page.keyboard.press('Enter')
            assert toggle.get_attribute('aria-expanded')=='true'
            assert page.locator('#site-nav a').first.evaluate('e=>document.activeElement===e')
            page.keyboard.press('Escape')
            assert toggle.get_attribute('aria-expanded')=='false'
            assert toggle.evaluate('e=>document.activeElement===e')
            page.keyboard.press('Enter')
            page.locator('#store-code').focus()
            assert toggle.get_attribute('aria-expanded')=='false'
        assert not errors,errors
        print(json.dumps({'browser':BROWSER,'viewport':[w,h],'screenSelector':'fits','FAQLink':'visible','storage':'fits','keyboardMenu':'pass'}),flush=True)
        page.close()
    b.close()
