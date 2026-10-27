"""Actual canvas density, dense UI textures, MSAA and a bounded Retina budget."""
from pathlib import Path
import json, os, shutil
from PIL import Image
from playwright.sync_api import sync_playwright

BASE = os.environ.get('SITE_TEST_URL', 'http://127.0.0.1:4173').rstrip('/')
BROWSER = os.environ.get('BROWSER', 'chromium')
ROOT = Path(__file__).resolve().parents[1]
OUT = Path('/tmp/smart-store-checkout-quality') / BROWSER
OUT.mkdir(parents=True, exist_ok=True)
for view in ['sale', 'payment']:
    asset = ROOT / 'img' / f'checkout-{view}-2x-v56.webp'
    assert Image.open(asset).size == (2880, 1800), 'Use a real 2x application capture'
    assert asset.stat().st_size < 450_000, 'Dense textures must stay compact'

with sync_playwright() as p:
    opts = {'headless': True}
    if BROWSER == 'chromium':
        opts.update(executable_path=shutil.which('chromium'), args=['--no-sandbox', '--enable-unsafe-swiftshader'])
    browser = getattr(p, BROWSER).launch(**opts)
    for width, height, dpr in [(1731, 891, 1), (390, 844, 3), (2560, 1440, 1)]:
        page = browser.new_page(viewport={'width': width, 'height': height}, device_scale_factor=dpr, has_touch=width<851, is_mobile=width<851, reduced_motion='reduce')
        errors, requests = [], []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('request', lambda r: requests.append(r.url))
        page.route('**/releases/latest', lambda r: r.fulfill(json={}))
        for endpoint in ['hit', 'act']:
            page.route('https://zavod.metov.store/' + endpoint, lambda r: r.fulfill(status=204))
        page.goto(BASE, wait_until='networkidle')
        assert not any('/assets/checkout3d.' in u for u in requests), 'Keep the hero free of 3D work'
        page.locator('#workspace').evaluate('e=>scrollTo(0,e.offsetTop)')
        page.wait_for_function('document.querySelector(".checkout-object").dataset.checkoutRenderer==="webgl" && document.getElementById("checkout-canvas").dataset.screenTexture', timeout=30000)
        info = page.locator('#checkout-canvas').evaluate('''c=>{
          const gl=c.getContext('webgl2'),r=c.getBoundingClientRect();
          return {framebuffer:[c.width,c.height],css:[r.width,r.height],texture:JSON.parse(c.dataset.screenTexture),antialias:gl.getContextAttributes().antialias,samples:gl.getParameter(gl.SAMPLES)};
        }''')
        pixels = info['framebuffer'][0] * info['framebuffer'][1]
        assert pixels <= 2_100_000, ('Pixel budget exceeded', info)
        assert info['antialias'] and info['samples'] > 0, ('Hardware multisampling unavailable', info)
        assert info['texture'] == [2880, 1800], ('Low resolution UI texture', info)
        for actual, css in zip(info['framebuffer'], info['css']):
            assert actual <= css * 2 + 1, 'Retina must remain capped at 2x'
            if info['css'][0] * info['css'][1] * 4 <= 2_100_000:
                assert actual >= css * 2 - 2, ('Ordinary displays also need supersampling', info)
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.screenshot(path=str(OUT / f'overview-{width}.png'))
        for view in ['0', '1', '2']:
            page.locator(f'[data-checkout-point="{view}"]').click()
            page.wait_for_function('(v)=>document.querySelector(".checkout-object").dataset.checkoutView===v&&document.querySelector(".checkout-object").dataset.checkoutMotion==="idle"', arg=view)
            page.screenshot(path=str(OUT / f'focus-{view}-{width}.png'))
        assert not errors, errors
        print(json.dumps({'browser': BROWSER, 'viewport': [width,height], 'deviceScale': dpr, **info}), flush=True)
        page.close()
    browser.close()
