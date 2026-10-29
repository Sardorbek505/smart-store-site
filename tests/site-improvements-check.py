"""Continuous visible motion, atlas reuse, offline login and static help navigation."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,os,shutil
BASE=os.environ.get('SITE_TEST_URL','http://127.0.0.1:4173').rstrip('/')
BROWSER=os.environ.get('BROWSER','chromium')
OUT=Path('test-results');OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
    options={'headless':True}
    if BROWSER=='chromium':options.update(executable_path=shutil.which('chromium'),args=['--no-sandbox','--enable-unsafe-swiftshader'])
    browser=getattr(p,BROWSER).launch(**options)
    c=browser.new_context(**p.devices['iPhone 13'])
    lookups=[]
    def service(route):
        if '/lookup?' in route.request.url:
            lookups.append(route.request.url);route.fulfill(json={'found':False},headers={'access-control-allow-origin':'*'})
        else:route.fulfill(status=204)
    for host in ['zavod.metov.store','connect.metov.store','api.github.com']:c.route('https://'+host+'/**',service)
    page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(BASE,wait_until='networkidle')
    page.wait_for_function('()=>document.querySelector(".ribbon-window").dataset.optics==="webgl"')
    assert page.locator('.ribbon-pause').count()==0
    page.evaluate('window.testFlow=document.querySelector(".ribbon-track").getAnimations()[0]')
    def advancing():
        page.wait_for_function('()=>testFlow.playState==="running"&&!testFlow.pending')
        before=page.evaluate('testFlow.currentTime');page.wait_for_timeout(200)
        assert page.evaluate('testFlow.currentTime')>before+50
    advancing()
    page.evaluate('scrollTo({top:100,behavior:"instant"})');advancing()
    page.locator('.hero-gallery').focus();advancing()
    stage=page.locator('.gallery-stage')
    event={'pointerId':7,'pointerType':'touch','isPrimary':True,'button':0,'clientX':290,'clientY':600}
    stage.dispatch_event('pointerdown',event);advancing()
    stage.dispatch_event('pointermove',{**event,'clientX':120})
    stage.dispatch_event('pointerup',{**event,'buttons':0,'clientX':120})
    stage.dispatch_event('click',{'clientX':120,'clientY':600})
    assert not page.locator('#preview-dialog').evaluate('e=>e.open')
    page.wait_for_function('()=>document.querySelector(".ribbon-track").getAnimations().length===1')
    advancing()  # no old 2-second hold after the finite swipe
    page.locator('[data-gallery-card]').first.evaluate('e=>e.click()')
    page.wait_for_function('()=>document.getElementById("preview-dialog").open')
    advancing()
    page.keyboard.press('Escape');advancing()
    # Browser-bar resize notifications must not upload unchanged images again.
    page.locator('.ribbon-optics').evaluate('''c=>{const gl=c.getContext('webgl');const upload=gl.texImage2D.bind(gl);window.uploads=0;gl.texImage2D=(...args)=>{uploads++;return upload(...args)}}''')
    page.evaluate('()=>{for(let i=0;i<4;i++)dispatchEvent(new Event("resize"))}')
    page.wait_for_timeout(100);assert page.evaluate('uploads')==0
    page.emulate_media(reduced_motion='reduce')
    page.wait_for_function('()=>testFlow.playState==="paused"&&!testFlow.pending')
    # These are offline browser states, not real requests to a store.
    page.locator('a[href="#store"]').first.evaluate('e=>e.click()')
    page.wait_for_function('()=>document.getElementById("store").open')
    c.set_offline(True);page.wait_for_function('()=>navigator.onLine===false')
    page.locator('#store-code').fill('fixture-shop')
    page.locator('#store-submit').click()
    assert 'Нет подключения' in page.locator('#store-note').inner_text()
    assert page.locator('#store-code').input_value()=='fixture-shop' and lookups==[]
    assert page.locator('#store-code').get_attribute('aria-invalid') is None
    c.set_offline(False);page.wait_for_function('()=>navigator.onLine===true')
    page.wait_for_function('()=>document.getElementById("store-form").dataset.state==="idle"')
    assert lookups==[]
    page.locator('#store-submit').click()
    page.wait_for_function('()=>document.getElementById("store-form").dataset.state==="not-found"')
    assert len(lookups)==1
    # Going offline cancels a pending lookup; its late success cannot navigate.
    page.evaluate('''()=>{const original=fetch;window.pending=[];window.fetch=(url,...args)=>String(url).includes('/lookup?')?new Promise(resolve=>pending.push(resolve)):original(url,...args)}''')
    page.locator('#store-code').fill('fixture-shop-2');page.locator('#store-submit').click()
    page.wait_for_function('()=>pending.length===1')
    c.set_offline(True);page.wait_for_function('()=>document.getElementById("store-form").dataset.state==="unavailable"')
    c.set_offline(False);page.wait_for_function('()=>document.getElementById("store-form").dataset.state==="idle"')
    page.evaluate('pending[0]({ok:true,json:async()=>({found:true})})');page.wait_for_timeout(100)
    assert 'fixture-shop-2.metov.store' not in page.url
    assert not errors,errors
    print(json.dumps({'browser':BROWSER,'visibleAutoplay':'scroll/focus/touch/modal/swipe pass','atlasUploadsOnUnchangedResize':0,'offlineLookupRequests':0,'onlineRetry':'manual only','staleOfflineResult':'ignored'}),flush=True)
    c.close()
    for width in [320,390,1440]:
        c=browser.new_context(viewport={'width':width,'height':900},java_script_enabled=False)
        pages=json.loads((Path(__file__).resolve().parents[1]/'tools/pages.json').read_text())
        for slug in [item['canonical'].removeprefix('https://metov.store') for item in pages if item.get('static')]:
            page=c.new_page();response=page.goto(BASE+slug,wait_until='networkidle')
            assert response.status==200 and page.locator('h1').count()==1
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,slug)
            assert page.locator('script[src]').count()==0
            if width==390:page.screenshot(path=str(OUT/('help-'+slug.strip('/').replace('/','-')+'.png')),full_page=True)
            page.close()
        c.close()
    browser.close()
