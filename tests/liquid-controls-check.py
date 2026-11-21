"""Shared glass controls preserve actions, modal focus and optional optics."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import os,shutil,json
BASE=os.environ.get('SITE_TEST_URL','http://127.0.0.1:4173').rstrip('/')
OUT=Path('test-results/liquid-controls');OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
    for width in [320,390,768,1440]:
        page=browser.new_page(viewport={'width':width,'height':900},reduced_motion='reduce')
        page.route('https://**',lambda r:r.fulfill(status=204))
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(BASE,wait_until='networkidle')
        hero=page.locator('#download')
        page.wait_for_function('()=>document.getElementById("download").hasAttribute("data-rim")')
        assert hero.get_attribute('data-liquid')=='accent'
        assert hero.evaluate('e=>getComputedStyle(e,"::before").display')=='none'
        page.locator('.cinema-actions').screenshot(path=str(OUT/f'hero-{width}.png'))
        page.locator('#features').evaluate('e=>scrollTo(0,e.offsetTop)')
        page.locator('.enter-link').click()
        store=page.locator('#store')
        assert store.get_attribute('data-liquid')=='sheet'
        assert page.locator('#store-code').is_visible()
        page.locator('#store-code').fill('DEMO-GLASS')
        assert page.locator('#store-code').input_value()=='DEMO-GLASS'
        store.screenshot(path=str(OUT/f'login-{width}.png'))
        page.locator('#store-close').click()
        assert page.locator('.enter-link').evaluate('e=>document.activeElement===e')
        page.locator('#product-screen-link').click()
        dock=page.locator('.preview-toolbar')
        page.wait_for_function('()=>document.querySelector(".preview-toolbar").dataset.refraction==="live"')
        assert page.locator('#preview-zoom').evaluate('e=>getComputedStyle(e).backdropFilter')=='none'
        assert page.locator('#preview-image').evaluate('e=>getComputedStyle(e).filter')=='none'
        page.locator('#preview-zoom').click()
        assert page.locator('#preview-zoom').get_attribute('aria-pressed')=='true'
        dock.screenshot(path=str(OUT/f'dock-{width}.png'))
        page.locator('#preview-close').click()
        page.wait_for_function('()=>!document.querySelector(".preview-toolbar").hasAttribute("data-refraction")')
        assert page.locator('filter[id^="glisse-"]').count()<=1
        assert page.locator('#product-screen-link').evaluate('e=>document.activeElement===e')
        cdp=page.context.new_cdp_session(page)
        cdp.send('Emulation.setEmulatedMedia',{'features':[{'name':'prefers-reduced-transparency','value':'reduce'}]})
        page.wait_for_function('()=>!document.getElementById("download").hasAttribute("data-rim")')
        for selector in ['#download','.assistant-watch','#store']:
            assert page.locator(selector).evaluate('e=>getComputedStyle(e).backdropFilter')=='none',selector
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        assert not errors,errors
        print(json.dumps({'width':width,'glassPrimaryAndPanels':True,'loginInputAndFocus':True,'dockLensAndZoom':True,'noNestedBackdropFilters':True,'closedDockReleasesFilter':True,'reducedTransparency':True}),flush=True)
        page.close()
    browser.close()
