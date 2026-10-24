"""Full-bleed, seamless native motion with no script frame loop or scroll work."""
from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops, ImageStat
from io import BytesIO
import os, shutil, json

BASE = os.environ.get('SITE_TEST_URL', 'http://127.0.0.1:4173')
BROWSER = os.environ.get('BROWSER', 'chromium')
with sync_playwright() as p:
    args = {'headless': True}
    if BROWSER == 'chromium':
        args.update(executable_path=shutil.which('chromium'), args=['--no-sandbox'])
    b = getattr(p, BROWSER).launch(**args)
    for w, h in [(390, 844), (1440, 900), (2560, 1440)]:
        page = b.new_page(viewport={'width': w, 'height': h}, has_touch=w<851, is_mobile=w<851)
        errors = []; page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(BASE, wait_until='networkidle')
        page.wait_for_function('document.querySelector(".gallery-stage").dataset.motion==="running"')
        box = page.locator('.ribbon-window').bounding_box()
        assert box['x'] == 0 and 0 <= w-box['width'] <= 16, box
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        assert page.locator('.gallery-controls, .gallery-motion, .gallery-bottom').count() == 0
        assert box['height'] <= box['width'] * (.54 if w <= 620 else .30) + 1
        card_width = page.locator('[data-gallery-card]').first.bounding_box()['width']
        assert card_width >= box['width'] * (.77 if w <= 620 else .35)
        page.evaluate('''()=>{
          window.testFlow=document.querySelector('.ribbon-track').getAnimations()[0];
          window.heroMutations=0;window.heroFrames=0;
          new MutationObserver(ms=>window.heroMutations+=ms.length).observe(document.querySelector('.hero-gallery'),{subtree:true,attributes:true,childList:true,characterData:true});
          const raf=window.requestAnimationFrame;
          window.requestAnimationFrame=(fn)=>{window.heroFrames++;return raf(fn)};
        }''')
        first = page.locator('.ribbon-track').evaluate('e=>getComputedStyle(e).transform')
        page.wait_for_timeout(400)
        assert page.locator('.ribbon-track').evaluate('e=>getComputedStyle(e).transform') != first
        assert page.evaluate('heroMutations') == 0, 'motion must not rewrite the DOM'
        assert page.evaluate('heroFrames') == 0, 'motion must not run JavaScript frames'
        page.locator('.hero-gallery').focus()
        page.wait_for_function('document.querySelector(".gallery-stage").dataset.motion==="paused"')
        page.wait_for_function('!testFlow.pending')
        paused = page.evaluate('testFlow.currentTime'); page.wait_for_timeout(200)
        assert abs(page.evaluate('testFlow.currentTime')-paused) < 1
        # Identical frames either side of a complete loop: no blank end or reset flash.
        page.evaluate('testFlow.currentTime=0')
        a = page.locator('.ribbon-window').screenshot()
        original = page.locator('[data-gallery-card]').first.bounding_box()
        page.evaluate('testFlow.currentTime=49999')
        z = page.locator('.ribbon-window').screenshot()
        copy = page.locator('[data-ribbon-set="after"] .gallery-card').first.bounding_box()
        assert abs(copy['x']-original['x']) < .2
        diff = ImageChops.difference(Image.open(BytesIO(a)).convert('RGB'), Image.open(BytesIO(z)).convert('RGB'))
        # The last millisecond advances <0.1 px. Repeated paint containers can
        # sample an image on opposite sides of a raster-pixel boundary. The
        # separate <0.2 px geometry check bounds the actual seam displacement.
        assert max(ImageStat.Stat(diff).mean) < 2, 'loop end must match its beginning'
        page.locator('.hero-gallery').evaluate('e=>e.blur()')
        page.wait_for_function('document.querySelector(".gallery-stage").dataset.motion==="running"')
        page.evaluate('scrollTo(0,100)')
        page.wait_for_function('document.querySelector(".gallery-stage").dataset.motion==="paused"')
        page.wait_for_function('!testFlow.pending')
        paused = page.evaluate('testFlow.currentTime')
        for y in [150, 200, 250, 300]:
            page.evaluate('(y)=>scrollTo(0,y)', y); page.wait_for_timeout(100)
        assert abs(page.evaluate('testFlow.currentTime')-paused) < 1
        page.locator('#features').scroll_into_view_if_needed()
        page.wait_for_timeout(200)
        assert abs(page.evaluate('testFlow.currentTime')-paused) < 1
        page.evaluate('scrollTo(0,0)')
        page.wait_for_function('document.querySelector(".gallery-stage").dataset.motion==="running"')
        page.evaluate('testFlow.currentTime=150000')
        page.locator('.hero-gallery').focus()
        page.keyboard.press('ArrowRight')
        page.wait_for_timeout(700)
        card = page.locator('[data-gallery-card]').nth(1).bounding_box()
        assert abs(card['x']+card['width']/2-box['width']/2) < 1, 'navigation after multiple loops must keep the selected photo visible'
        page.locator('[data-gallery-card]').first.focus()
        page.wait_for_function('document.querySelector(".gallery-stage").dataset.motion==="paused"')
        page.emulate_media(reduced_motion='reduce')
        assert page.locator('.gallery-controls, .gallery-motion').count() == 0
        page.keyboard.press('ArrowRight')
        page.wait_for_function('document.getElementById("gallery-status").textContent.startsWith("2 из 5:")')
        assert not errors, errors
        print(json.dumps({'browser': BROWSER, 'width': w, 'fullWidth': box['width'], 'ribbonHeight': box['height'], 'cardWidth': card_width, 'loop': 'seamless', 'scriptFramesDuringMotion': 0, 'DOMMutationsDuringMotion': 0, 'scrollPause': 'pass', 'reducedMotion': 'pass'}), flush=True)
        page.close()
    b.close()
