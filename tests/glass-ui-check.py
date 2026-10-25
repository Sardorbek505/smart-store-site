"""Floating navigation, compact screenshot controls, zoom/pan and fallbacks."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import json, os, shutil

BASE=os.environ.get('SITE_TEST_URL','http://127.0.0.1:4173').rstrip('/')
BROWSER=os.environ.get('BROWSER','chromium')
OUT=Path('/tmp/smart-store-liquid-v38')/BROWSER
OUT.mkdir(parents=True,exist_ok=True)

with sync_playwright() as p:
    args={'headless':True}
    if BROWSER=='chromium':args.update(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
    browser=getattr(p,BROWSER).launch(**args)
    for w,h in [(320,568),(390,844),(768,1024),(844,390),(851,768),(1024,768),(1440,900)]:
        page=browser.new_page(viewport={'width':w,'height':h},has_touch=w<851,is_mobile=w<851,reduced_motion='reduce')
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(BASE,wait_until='networkidle')
        page.wait_for_function('document.documentElement.classList.contains("js")')
        assert page.locator('.top').evaluate('e=>e.inert&&getComputedStyle(e).visibility==="hidden"')
        page.locator('#features').evaluate('e=>scrollTo(0,e.offsetTop)')
        page.wait_for_function('!document.querySelector(".top").inert')
        header=page.locator('.top-inner').bounding_box()
        assert header['x']>=8 and header['y']>=8 and header['x']+header['width']<=w-8
        assert header['height']<=64
        assert page.locator('.top-inner').evaluate('e=>Array.from(e.children).filter(x=>getComputedStyle(x).display!=="none").every(x=>{const a=x.getBoundingClientRect(),b=e.getBoundingClientRect();return a.left>=b.left&&a.right<=b.right})')
        if w<851:
            page.locator('#menu-toggle').click()
            menu=page.locator('#site-nav').bounding_box()
            assert menu['y']>=header['y']+header['height']+6
            assert menu['x']>=8 and menu['x']+menu['width']<=w-8 and menu['y']+menu['height']<=h-8
            assert page.locator('#site-nav a').first.evaluate('e=>document.activeElement===e')
            page.keyboard.press('Escape')
            assert page.locator('#menu-toggle').evaluate('e=>document.activeElement===e')
        page.screenshot(path=str(OUT/f'navigation-{w}.png'))
        trigger=page.locator('#product-screen-link')
        trigger.click()
        page.wait_for_function('!document.getElementById("preview-zoom").disabled')
        stage=page.locator('#preview-stage'); toolbar=page.locator('.preview-toolbar')
        bar=toolbar.bounding_box(); dialog=page.locator('#preview-dialog').bounding_box(); photo=page.locator('#preview-image').bounding_box()
        assert bar['x']>=dialog['x']+8 and bar['x']+bar['width']<=dialog['x']+dialog['width']-8
        assert bar['y']+bar['height']<=h-8
        assert photo['y']+photo['height']<=bar['y']-6, 'Fit must show the complete screenshot above the dock'
        assert page.locator('#preview-image').evaluate('e=>getComputedStyle(e).filter==="none"')
        for selector in ['#preview-zoom','#preview-original','#preview-close']:
            box=page.locator(selector).bounding_box()
            assert box['width']>=44 and box['height']>=44
            assert box['x']>=bar['x'] and box['x']+box['width']<=bar['x']+bar['width']
        assert page.locator('#preview-zoom').evaluate('e=>{const s=getComputedStyle(e);return e.clientWidth>=e.querySelector("span").getBoundingClientRect().width+e.querySelector("svg").getBoundingClientRect().width+parseFloat(s.paddingLeft)+parseFloat(s.paddingRight)+parseFloat(s.gap)-1}')
        page.screenshot(path=str(OUT/f'preview-{w}.png'))
        page.locator('#preview-zoom').click()
        assert page.locator('#preview-zoom').get_attribute('aria-pressed')=='true'
        assert page.locator('#preview-image').evaluate('e=>Math.abs(e.getBoundingClientRect().width-e.naturalWidth)<1')
        stage.evaluate('e=>e.scrollTo(100,100)')
        assert stage.evaluate('e=>e.scrollLeft>0&&e.scrollTop>0')
        assert toolbar.bounding_box()==bar, 'Screenshot panning must not move the controls'
        page.locator('#preview-zoom').click()
        assert stage.evaluate('e=>e.scrollLeft===0&&e.scrollTop===0')
        page.keyboard.press('Escape')
        assert trigger.evaluate('e=>document.activeElement===e')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        assert not errors,errors
        print(json.dumps({'browser':BROWSER,'viewport':[w,h],'navigation':'floating and hidden in hero','toolbar':'fits; three 44px targets','fitImage':'complete','zoomPanAndEscape':'pass','errors':errors}),flush=True)
        page.close()
    failed=browser.new_page(viewport={'width':390,'height':844},reduced_motion='reduce')
    failed.route('**/img/demo-sale.png',lambda r:r.abort())
    failed.goto(BASE,wait_until='networkidle');failed.locator('#product-screen-link').click()
    failed.wait_for_function('document.getElementById("preview-status").textContent.includes("не загрузилось")')
    assert failed.locator('#preview-zoom').is_disabled()
    assert failed.locator('#preview-original').is_visible()
    assert failed.locator('#preview-original').get_attribute('href').endswith('/img/demo-sale.png')
    failed.keyboard.press('Escape');failed.close()
    context=browser.new_context(java_script_enabled=False,viewport={'width':390,'height':844})
    plain=context.new_page();plain.goto(BASE)
    assert plain.locator('#site-nav').is_visible()
    assert plain.evaluate('document.documentElement.scrollWidth<=innerWidth')
    plain.locator('#download').click();assert plain.locator('#installation').is_visible()
    context.close();browser.close()
