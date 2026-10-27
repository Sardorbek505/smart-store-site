"""GPU context recovery must restore the lighting as well as the UI texture."""
from pathlib import Path
from io import BytesIO
import os, shutil, json
from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright
BASE = os.environ.get('SITE_TEST_URL','http://127.0.0.1:4173').rstrip('/')
BROWSER = os.environ.get('BROWSER','chromium')
OUT = Path('/tmp/smart-store-checkout-context') / BROWSER
OUT.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    opts = {'headless': True}
    if BROWSER == 'chromium':
        opts.update(executable_path=shutil.which('chromium'),args=['--no-sandbox','--enable-unsafe-swiftshader'])
    browser = getattr(p,BROWSER).launch(**opts)
    page = browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,reduced_motion='reduce')
    errors = []
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/releases/latest',lambda r:r.fulfill(json={}))
    for endpoint in ['hit','act']:
        page.route('https://zavod.metov.store/'+endpoint,lambda r:r.fulfill(status=204))
    page.goto(BASE+'/#workspace',wait_until='networkidle')
    ready = 'document.querySelector(".checkout-object").dataset.checkoutRenderer==="webgl"'
    page.wait_for_function(ready,timeout=30000)
    canvas = page.locator('#checkout-canvas')
    def snapshot(name):
        page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
        data = canvas.screenshot(path=str(OUT / f'{name}.png'))
        return Image.open(BytesIO(data)).convert('RGB')
    reference = snapshot('before')
    differences = []
    for cycle in range(2):
        canvas.evaluate('c=>{window.checkoutLost=c.getContext("webgl2").getExtension("WEBGL_lose_context");checkoutLost.loseContext()}')
        page.wait_for_function('() => (document.querySelector(".checkout-object").dataset.checkoutRenderer==="poster")')
        assert page.locator('#product-screen').get_attribute('src').endswith('checkout-overview-v56.webp')
        page.wait_for_timeout(120)
        page.evaluate('checkoutLost.restoreContext()')
        page.wait_for_function(ready,timeout=30000)
        restored = snapshot(f'restored-{cycle}')
        mean = ImageStat.Stat(ImageChops.difference(reference,restored)).mean
        assert max(mean)<.5, ('Studio reflections or other scene pixels were lost',mean)
        differences.append(mean)
    assert not errors,errors
    print(json.dumps({'browser':BROWSER,'twoContextRestorations':'pass','meanRGBDifference':differences,'jsErrors':errors}),flush=True)
    browser.close()
