"""Native gallery: no Canvas work, sharp sources, controls and fallback."""
from playwright.sync_api import sync_playwright
from PIL import Image
from io import BytesIO
import os,shutil
BASE=os.environ.get('SITE_TEST_URL','http://127.0.0.1:4173').rstrip('/')
BROWSER=os.environ.get('BROWSER','chromium')
INSTRUMENT='''(()=>{window.draws=0;window.webglContexts=0;const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){if(t.includes('webgl'))window.webglContexts++;return get.call(this,t,...a)};const p=CanvasRenderingContext2D.prototype,draw=p.drawImage;p.drawImage=function(i,...a){window.draws++;return draw.call(this,i,...a)}})();'''
with sync_playwright() as p:
    args={'headless':True}
    if BROWSER=='chromium':args.update(executable_path=os.environ.get('CHROMIUM_BINARY') or shutil.which('chromium'),args=['--no-sandbox'])
    b=getattr(p,BROWSER).launch(**args)
    page=b.new_page(viewport={'width':1440,'height':900},device_scale_factor=2)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.add_init_script(INSTRUMENT)
    page.goto(BASE,wait_until='networkidle')
    page.wait_for_function('document.querySelector(".gallery-stage").dataset.ready==="true"')
    page.wait_for_timeout(150)
    assert page.evaluate('window.webglContexts')==0
    before=page.evaluate('window.draws')
    page.wait_for_timeout(400)
    assert page.evaluate('window.draws')==before,'no background animation'
    for _ in range(5):
        page.mouse.wheel(0,45)
        page.wait_for_timeout(240)
    assert page.evaluate('window.draws')==before,'scroll pauses must not restart drawing'
    assert page.locator('#gallery-pause').count()==1
    page.locator('#gallery-next').click()
    page.wait_for_function('document.getElementById("gallery-count").textContent==="02"')
    page.wait_for_timeout(700)
    page.locator('#gallery-prev').click()
    page.wait_for_function('document.getElementById("gallery-count").textContent==="01"')
    page.locator('#gallery-next').focus();page.keyboard.press('ArrowRight')
    page.wait_for_function('document.getElementById("gallery-count").textContent==="02"')
    card=page.locator('[data-gallery-card]').nth(1)
    original=card.get_attribute('href');card.click()
    assert page.locator('#preview-dialog').is_visible()
    assert page.locator('#preview-image').get_attribute('src').endswith('/'+original)
    background_y=page.evaluate('scrollY')
    page.mouse.wheel(0,120)
    page.wait_for_timeout(80)
    assert page.evaluate('scrollY')==background_y,'preview must lock background scroll'
    page.keyboard.press('Escape')
    c=b.new_context(viewport={'width':390,'height':844},device_scale_factor=3,is_mobile=True,has_touch=True)
    touch=c.new_page();touch.add_init_script(INSTRUMENT)
    touch.goto(BASE,wait_until='networkidle')
    touch.wait_for_function('document.querySelector(".gallery-stage").dataset.ready==="true"')
    assert touch.locator('canvas').count()==0
    source=touch.locator('.hero-gallery img').first.evaluate('e=>e.currentSrc')
    response=touch.request.get(source)
    assert Image.open(BytesIO(response.body())).width>=768
    stage=touch.locator('.gallery-stage')
    stage.dispatch_event('pointerdown',{'pointerId':1,'pointerType':'touch','isPrimary':True,'button':0,'clientX':280,'clientY':620})
    stage.dispatch_event('pointermove',{'pointerId':1,'pointerType':'touch','isPrimary':True,'clientX':160,'clientY':620})
    stage.dispatch_event('pointerup',{'pointerId':1,'pointerType':'touch','isPrimary':True,'clientX':150,'clientY':620})
    stage.dispatch_event('click')
    touch.wait_for_function('document.getElementById("gallery-count").textContent==="02"')
    touch.wait_for_timeout(700)
    assert touch.locator('#preview-dialog').is_hidden()
    touch.locator('[data-gallery-card]').nth(1).tap()
    assert touch.locator('#preview-dialog').is_visible()
    fallback=b.new_page(viewport={'width':390,'height':844})
    fallback.add_init_script('HTMLCanvasElement.prototype.getContext=()=>null')
    fallback.goto(BASE,wait_until='networkidle')
    fallback.wait_for_function('document.querySelector(".gallery-stage").dataset.ready==="true"')
    assert fallback.locator('canvas').count()==0
    assert fallback.locator('#store-submit').is_enabled()
    fallback.evaluate('scrollTo({top:100,behavior:"instant"})')
    fallback.locator('#gallery-next').click()
    fallback.wait_for_function('document.getElementById("gallery-count").textContent==="02"')
    assert not errors,errors
    print('PASS',BROWSER,'native gallery, no Canvas/WebGL drawing, burst scrolling, controls/keyboard, originals, Retina, swipe/tap, unavailable graphics APIs.')
    b.close()
