"""Browser checks for gallery behavior, scroll suspension, Retina and GPU fallback.

Run against a local HTTP server. Uses software WebGL in Chromium so the GPU path
is covered in headless environments; timing-dependent FPS budgets are not asserted.
"""
from playwright.sync_api import sync_playwright
import os
import shutil

BASE = os.environ.get('SITE_TEST_URL', 'http://127.0.0.1:4173').rstrip('/')
INSTRUMENT = '''(()=>{window.galleryDraws=0;window.galleryStaticImages=new Set();for(const key of ['WebGLRenderingContext','WebGL2RenderingContext']){const p=window[key]?.prototype;if(p){const draw=p.drawArrays;p.drawArrays=function(...a){window.galleryDraws++;return draw.apply(this,a)}}}const p=CanvasRenderingContext2D.prototype,draw=p.drawImage;p.drawImage=function(...a){window.galleryDraws++;window.galleryStaticImages.add(a[0].currentSrc||a[0].src);return draw.apply(this,a)}})();'''
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_BINARY') or shutil.which('chromium'), args=['--no-sandbox', '--enable-webgl', '--enable-unsafe-swiftshader'])
    page = b.new_page(viewport={'width': 1440, 'height': 900}, device_scale_factor=2)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.add_init_script(INSTRUMENT)
    page.goto(BASE, wait_until='networkidle')
    page.locator('.hero-gallery img').evaluate_all('(xs)=>Promise.all(xs.map(i=>i.decode()))')
    page.wait_for_function('document.querySelector(".gallery-stage").dataset.renderer==="webgl"')
    page.mouse.move(1, 1)
    page.wait_for_timeout(100)
    draws = lambda: page.evaluate('window.galleryDraws')
    before = draws()
    page.evaluate('''()=>{window.galleryStyleChanges=0;new MutationObserver(xs=>window.galleryStyleChanges+=xs.length).observe(document.querySelector('.gallery-stage'),{subtree:true,attributes:true,attributeFilter:['style']})}''')
    page.wait_for_timeout(300)
    assert draws() > before, 'autoplay should render while visible and idle'
    assert page.evaluate('window.galleryStyleChanges') <= 5, 'animation must not change every link style on every frame'
    page.mouse.wheel(0, 12)
    page.wait_for_timeout(30)
    before = draws()
    for _ in range(8):
        page.mouse.wheel(0, 12)
        page.wait_for_timeout(25)
    assert draws() == before, 'drawing must stop throughout vertical scrolling'
    page.wait_for_timeout(240)
    before = draws()
    page.wait_for_timeout(150)
    assert draws() > before, 'idle visible animation should resume after scrolling'
    page.evaluate('scrollTo({top:innerHeight*2.3,behavior:"instant"})')
    page.wait_for_timeout(220)
    before = draws()
    page.wait_for_timeout(200)
    assert draws() == before, 'offscreen gallery must not keep drawing'
    page.evaluate('scrollTo({top:0,behavior:"instant"})')
    page.wait_for_timeout(240)
    page.locator('.gallery-stage').hover()
    page.wait_for_timeout(60)
    before = draws()
    page.wait_for_timeout(180)
    assert draws() == before, 'hover must hold clickable photographs still'
    page.mouse.move(1, 1)
    page.evaluate('scrollTo({top:80,behavior:"instant"})')
    page.wait_for_timeout(240)
    page.locator('#gallery-pause').click()
    assert page.locator('#gallery-pause').get_attribute('aria-pressed') == 'true'
    page.locator('#hero-title').click()
    page.wait_for_timeout(60)
    before = draws()
    page.wait_for_timeout(180)
    assert draws() == before, 'explicit pause'
    page.emulate_media(reduced_motion='reduce')
    page.wait_for_timeout(60)
    assert page.locator('#gallery-pause').is_hidden()
    current = int(page.locator('#gallery-count').inner_text())
    page.locator('#gallery-next').click()
    assert int(page.locator('#gallery-count').inner_text()) == current % 5 + 1
    page.locator('#gallery-prev').click()
    assert int(page.locator('#gallery-count').inner_text()) == current
    page.locator('#gallery-next').focus()
    page.keyboard.press('ArrowRight')
    selected = int(page.locator('#gallery-count').inner_text()) - 1
    card = page.locator('[data-gallery-card]').nth(selected)
    original = card.get_attribute('href')
    card.click()
    assert page.locator('#preview-dialog').is_visible()
    assert page.locator('#preview-image').get_attribute('src').endswith('/' + original)
    page.wait_for_timeout(60)
    before = draws()
    page.wait_for_timeout(180)
    assert draws() == before, 'dialog must suspend background animation'
    page.keyboard.press('Escape')
    page.locator('.ribbon-canvas').evaluate('(c)=>c.getContext("webgl").getExtension("WEBGL_lose_context").loseContext()')
    page.wait_for_function('document.querySelector(".gallery-stage").dataset.renderer==="static-2d"')
    # The fallback may decode its selected source URLs asynchronously. Check
    # steady-state suspension after those one-time image paints have finished.
    page.wait_for_function('window.galleryStaticImages.size>=document.querySelectorAll("[data-gallery-card]:not([hidden])").length')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(100)
    before = draws()
    page.wait_for_timeout(180)
    assert draws() == before, 'context-loss fallback must be static'
    current = page.locator('#gallery-count').inner_text()
    page.locator('#gallery-next').click()
    assert page.locator('#gallery-count').inner_text() != current

    mobile = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, has_touch=True, is_mobile=True, reduced_motion='reduce')
    touch = mobile.new_page()
    touch.goto(BASE, wait_until='networkidle')
    touch.locator('.hero-gallery img').evaluate_all('(xs)=>Promise.all(xs.map(i=>i.decode()))')
    assert touch.locator('.ribbon-canvas').evaluate('c=>c.width===c.clientWidth*3')
    sources = touch.locator('.hero-gallery img').evaluate_all('xs=>xs.map(i=>i.currentSrc)')
    assert all('-768.webp' in source for source in sources), sources
    stage = touch.locator('.gallery-stage')
    stage.dispatch_event('pointerdown', {'pointerId': 1, 'pointerType': 'touch', 'isPrimary': True, 'button': 0, 'clientX': 280, 'clientY': 620})
    stage.dispatch_event('pointermove', {'pointerId': 1, 'pointerType': 'touch', 'isPrimary': True, 'clientX': 160, 'clientY': 620})
    stage.dispatch_event('pointerup', {'pointerId': 1, 'pointerType': 'touch', 'isPrimary': True, 'clientX': 150, 'clientY': 620})
    stage.dispatch_event('click')
    assert touch.locator('#gallery-count').text_content() == '02'
    assert touch.locator('#preview-dialog').is_hidden()
    touch.locator('[data-gallery-card]').nth(1).tap()
    assert touch.locator('#preview-dialog').is_visible()

    for all_canvas in [False, True]:
        fallback = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=3)
        fallback.add_init_script('''(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(TYPE_ALL||type.includes('webgl'))return null;return get.call(this,type,...args)}})();'''.replace('TYPE_ALL', 'true' if all_canvas else 'false'))
        fallback.add_init_script('''(()=>{window.staticSourceSizes=[];const p=CanvasRenderingContext2D.prototype,draw=p.drawImage;p.drawImage=function(image,...args){window.staticSourceSizes.push(image.naturalWidth||image.width);return draw.call(this,image,...args)}})();''')
        fallback.goto(BASE, wait_until='networkidle')
        assert fallback.locator('#store-submit').is_enabled()
        if all_canvas:
            assert fallback.locator('.ribbon-canvas').count() == 0
            assert fallback.locator('.gallery-controls').is_hidden()
            assert fallback.locator('[data-gallery-card]').nth(2).is_visible()
        else:
            assert fallback.locator('.gallery-stage').get_attribute('data-renderer') == 'static-2d'
            assert fallback.locator('#gallery-pause').is_hidden()
            fallback.evaluate('scrollTo({top:80,behavior:"instant"})')
            fallback.locator('#gallery-next').click()
            assert fallback.locator('#gallery-count').inner_text() == '02'
            sizes=fallback.evaluate('window.staticSourceSizes')
            assert sizes and all(size>=768 for size in sizes),sizes
        fallback.close()
    assert not errors, errors
    print('PASS: GPU autoplay without per-frame DOM layout; scroll/offscreen/hover/pause suspension; controls/keyboard; original previews; context-loss/static/native fallbacks; Retina sources; touch swipe/tap. No JS errors.')
    b.close()
