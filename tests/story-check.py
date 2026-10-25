"""Distinct product stories: contextual points, coherent phone flow, visible steps and fallback."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import os, shutil, json
BASE = os.environ.get('SITE_TEST_URL', 'http://127.0.0.1:4173').rstrip('/')
BROWSER = os.environ.get('BROWSER', 'chromium')
OUT = Path(os.environ.get('STORY_OUTPUT', '/tmp/smart-store-story')) / BROWSER
OUT.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    args = {'headless': True}
    if BROWSER == 'chromium': args.update(executable_path=shutil.which('chromium'), args=['--no-sandbox'])
    b = getattr(p, BROWSER).launch(**args)
    for w, h in [(320,568), (390,844), (844,390), (768,1024), (1440,900)]:
        page = b.new_page(viewport={'width':w, 'height':h}, is_mobile=w<851, has_touch=w<851)
        errors = []; page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(BASE, wait_until='networkidle')
        page.wait_for_function('!document.querySelector("#phone-demo-action").disabled')
        assert page.locator('.screen-tabs, .phone-selector, [data-start-step], [data-hub-node]').count() == 0
        for section in ['#features', '#workspace', '#mobile', '#data', '#start']:
            page.locator(section).evaluate('e=>scrollTo(0,e.offsetTop)')
            assert page.locator(section).evaluate('e=>Math.abs(e.getBoundingClientRect().height-innerHeight)<1')
            assert page.locator(section+' .screen-content').evaluate('e=>e.scrollWidth<=e.clientWidth+1&&e.scrollHeight<=e.clientHeight+4'), (w, section)
        page.locator('#workspace').evaluate('e=>scrollTo(0,e.offsetTop)')
        image = page.locator('#product-screen'); image.evaluate('e=>e.decode()')
        assert image.bounding_box()['height'] > (300 if w==390 else 180), (w,image.bounding_box())
        points = page.locator('[data-checkout-point]')
        for i in [2, 1, 0, 2]:
            point = points.nth(i); box=point.bounding_box()
            assert box['height'] >=44 and box['width'] >=44
            assert box['x']>=0 and box['x']+box['width']<=w
            point.click()
            assert point.get_attribute('aria-pressed')=='true'
            assert page.locator('[data-checkout-point][aria-pressed="true"]').count()==1
            assert image.get_attribute('src')=='img/workspace-demo-sale.webp'
        assert '40 000' in page.locator('#checkout-proof').inner_text()
        assert '42 300' in page.locator('#checkout-proof').inner_text()
        page.locator('#checkout-original').click()
        page.locator('#preview-dialog').wait_for(state='visible')
        assert page.locator('#preview-original').get_attribute('href').endswith('/img/demo-payment.png')
        page.keyboard.press('Escape')
        assert page.locator('#checkout-original').evaluate('e=>document.activeElement===e')
        points.first.focus(); page.keyboard.press('End')
        assert points.last.get_attribute('aria-pressed')=='true'
        page.keyboard.press('Home')
        assert '39 900' in page.locator('#checkout-proof').inner_text()
        page.locator('#mobile').evaluate('e=>scrollTo(0,e.offsetTop)')
        button = page.locator('#phone-demo-action')
        assert page.locator('#phone-demo-value').inner_text()=='396 950 ₸'
        for step, raw, value in [(1,'demo-phone-drill.png','39 900 ₸'), (2,'demo-phone-cart.png','40 550 ₸'), (0,'demo-phone.png','396 950 ₸')]:
            button.click()
            page.wait_for_function('(n)=>document.querySelector(".mobile-story").dataset.phoneStep===String(n)&&!document.querySelector("#phone-demo-action").disabled',arg=step)
            page.locator('#phone-mockup').evaluate('e=>e.decode()')
            assert page.locator('#phone-demo-value').inner_text()==value
            assert page.locator('#phone-demo-value').evaluate('e=>e.scrollWidth<=e.clientWidth')
            assert page.locator('#phone-screen-link').get_attribute('href')=='img/'+raw
            assert button.evaluate('e=>e.scrollWidth<=e.clientWidth')
            if step==2:
                assert 'на компьютере' in page.locator('#phone-demo-description').inner_text()
                page.locator('#phone-screen-link').click();page.locator('#preview-dialog').wait_for(state='visible')
                assert page.locator('#preview-original').get_attribute('href').endswith('/img/demo-phone-cart.png')
                page.keyboard.press('Escape')
        button.focus(); page.keyboard.press('Enter')
        page.wait_for_function('document.querySelector(".mobile-story").dataset.phoneStep==="1"')
        page.emulate_media(reduced_motion='reduce')
        page.wait_for_function('document.querySelector("#phone-mockup").getAnimations().length===0', timeout=1000)
        page.locator('#data').evaluate('e=>scrollTo(0,e.offsetTop)')
        assert page.locator('.data-facts > div').count()==3
        for fact in page.locator('.data-facts > div').all():assert fact.is_visible()
        assert '2 часа' in page.locator('.data-facts').inner_text()
        assert 'отдельно' in page.locator('.data-facts').inner_text()
        for i, raw in enumerate(['demo-home.png','demo-products.png','demo-payment.png']):
            page.locator('#start').evaluate('e=>scrollTo(0,e.offsetTop)')
            item=page.locator('.start-journey > li').nth(i)
            box=item.bounding_box();assert box['y']>=0 and box['y']+box['height']<=h
            item.locator('a').click();page.locator('#preview-dialog').wait_for(state='visible')
            assert page.locator('#preview-original').get_attribute('href').endswith('/img/'+raw)
            page.keyboard.press('Escape')
        assert page.locator('canvas').count()==0
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        assert not errors,errors
        for name in ['workspace','mobile','data','start']:
            page.locator('#'+name).evaluate('e=>scrollTo(0,e.offsetTop)')
            page.wait_for_timeout(250)
            page.screenshot(path=str(OUT/f'{name}-{w}.png'))
        print(json.dumps({'browser':BROWSER,'viewport':[w,h],'checkoutPoints':'pass','phoneJourney':'pass','visibleStepsAndData':'pass','originals':'pass','sectionFit':'pass'}),flush=True)
        page.close()
    # All content and links are useful when enhancement modules are unavailable.
    plain=b.new_page(viewport={'width':390,'height':844},java_script_enabled=False)
    plain.goto(BASE,wait_until='networkidle')
    assert plain.locator('.start-journey a').count()==3
    assert plain.locator('.data-facts dd').count()==3
    assert plain.locator('#phone-screen-link').get_attribute('href')=='img/demo-phone.png'
    assert plain.locator('#phone-demo-action').is_disabled()
    broken=b.new_page(viewport={'width':390,'height':844})
    broken.route('**/scripts/story.js*',lambda r:r.abort())
    broken.goto(BASE,wait_until='networkidle')
    assert broken.locator('#store-submit').is_enabled()
    assert broken.locator('#phone-demo-action').is_disabled()
    # Generated scenes can fail without losing the native product screens.
    fallback=b.new_page(viewport={'width':390,'height':844},reduced_motion='reduce')
    fallback.route('**/img/workspace-demo-sale.webp',lambda r:r.abort())
    fallback.route('**/img/mobile-demo-*.webp',lambda r:r.abort())
    fallback.goto(BASE+'#workspace',wait_until='networkidle')
    fallback.wait_for_function('document.querySelector("#product-screen").getAttribute("src")==="img/demo-sale.png"')
    fallback.locator('#product-screen').evaluate('e=>e.decode()')
    fallback.locator('#phone-demo-action').click()
    fallback.wait_for_function('document.querySelector(".mobile-story").dataset.phoneStep==="1"')
    assert fallback.locator('#phone-mockup').get_attribute('src').endswith('/img/demo-phone-drill.png')
    # If both versions fail, preserve the current state and allow a genuine retry.
    failed=b.new_page(viewport={'width':390,'height':844})
    failed.route('**/img/mobile-demo-drill.webp',lambda r:r.abort())
    failed.route('**/img/demo-phone-drill.png',lambda r:r.abort())
    failed.goto(BASE,wait_until='networkidle');failed.locator('#phone-demo-action').click()
    failed.wait_for_function('document.querySelector("#phone-demo-description").textContent.includes("ещё раз")')
    assert failed.locator('.mobile-story').get_attribute('data-phone-step')=='0'
    assert failed.locator('#phone-demo-action').is_enabled()
    failed.unroute('**/img/demo-phone-drill.png');failed.locator('#phone-demo-action').click()
    failed.wait_for_function('document.querySelector(".mobile-story").dataset.phoneStep==="1"')
    b.close()
