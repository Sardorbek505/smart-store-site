"""Glisse changes actual backdrop pixels; filters are bounded and optional."""
from io import BytesIO
from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright
import os, shutil, json
BASE=os.environ.get('SITE_TEST_URL','http://127.0.0.1:4173').rstrip('/')
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
    for width in [320,390,768,1440]:
        page=browser.new_page(viewport={'width':width,'height':900},reduced_motion='reduce')
        page.route('https://**',lambda r:r.fulfill(status=204))
        page.goto(BASE,wait_until='networkidle')
        assert page.locator('filter[id^="glisse-"]').count()==0
        page.locator('#features').evaluate('e=>scrollTo(0,e.offsetTop)')
        page.wait_for_function('()=>document.querySelector(".top-inner").dataset.refraction==="live"')
        page.wait_for_function('()=>document.querySelector(".top").dataset.surface==="light"')
        page.wait_for_timeout(200)
        pane=page.locator('.top-inner')
        before=pane.get_attribute('style')
        page.evaluate('scrollBy(0,5)');page.wait_for_timeout(200)
        assert before==pane.get_attribute('style'), 'Scrolling must not regenerate optics'
        assert page.locator('filter[id^="glisse-"]').count()==1
        page.add_style_tag(content='.top-inner > * {visibility:hidden !important}')
        page.evaluate('''()=>{const probe=document.createElement('div');probe.style.cssText='position:fixed;inset:0 0 auto;height:100px;z-index:19;background:repeating-linear-gradient(0deg,#ff2030 0 8px,#1469ff 8px 16px);pointer-events:none';document.body.append(probe)}''')
        box=pane.bounding_box();x=round(box['x']+box['width']/2);y=round(box['y'])
        bent=Image.open(BytesIO(page.screenshot())).convert('RGB')
        pane.evaluate('e=>{e.style.backdropFilter="blur(3px) saturate(1.5)"}')
        plain=Image.open(BytesIO(page.screenshot())).convert('RGB')
        difference=ImageChops.difference(bent,plain)
        rim=ImageStat.Stat(difference.crop((x-50,y+3,x+50,y+15))).mean
        centre=ImageStat.Stat(difference.crop((x-50,y+29,x+50,y+33))).mean
        assert max(rim)>1,('Edge must refract real background pixels',rim)
        assert max(centre)<max(rim)*0.5,('Refraction stays near the edge',centre,rim)
        pane.evaluate('e=>e.style.removeProperty("backdrop-filter")')
        for size in [width+2,width+4,width]:
            page.set_viewport_size({'width':size,'height':900});page.wait_for_timeout(250)
            assert page.locator('filter[id^="glisse-"]').count()==1
        cdp=page.context.new_cdp_session(page)
        cdp.send('Emulation.setEmulatedMedia',{'features':[{'name':'prefers-reduced-transparency','value':'reduce'}]})
        page.wait_for_function('()=>!document.querySelector(".top-inner").hasAttribute("data-rim")')
        assert page.locator('filter[id^="glisse-"]').count()==0
        assert pane.evaluate('e=>getComputedStyle(e).backdropFilter')=='none'
        print(json.dumps({'width':width,'edgePixelDifference':round(max(rim),2),'centrePixelDifference':round(max(centre),2),'singleFilterAfterResize':True,'reducedTransparency':True}),flush=True)
        page.close()
    # A non-Chromium UA uses the library's native frost/rim fallback.
    page=browser.new_page(viewport={'width':390,'height':844},user_agent='Mozilla/5.0 Version/18.0 Mobile/15E148 Safari/604.1')
    page.route('https://**',lambda r:r.fulfill(status=204))
    page.goto(BASE,wait_until='networkidle');page.evaluate('scrollTo(0,50)')
    page.wait_for_function('()=>document.querySelector(".top-inner").hasAttribute("data-rim")')
    assert page.locator('filter[id^="glisse-"]').count()==0
    assert 'blur(3px)' in page.locator('.top-inner').evaluate('e=>getComputedStyle(e).backdropFilter')
    page.close()
    # A failed optional optics bundle cannot block navigation or login.
    page=browser.new_page(viewport={'width':390,'height':844})
    page.route('https://**',lambda r:r.fulfill(status=204))
    page.route('**/assets/glisse-nav.*.js',lambda r:r.abort())
    page.goto(BASE,wait_until='networkidle');page.evaluate('scrollTo(0,50)')
    page.locator('#menu-toggle').click()
    assert page.locator('#menu-toggle').get_attribute('aria-expanded')=='true'
    page.keyboard.press('Escape');page.locator('.enter-link').click()
    assert page.locator('#store').evaluate('e=>e.open')
    page.close();browser.close()
