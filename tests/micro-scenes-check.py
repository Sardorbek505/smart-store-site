"""Feature scenes: complete readable data, bounded motion, pause and real demo links."""
from pathlib import Path
import json, os, shutil
from playwright.sync_api import sync_playwright

BASE = os.environ.get('SITE_TEST_URL', 'http://127.0.0.1:4173').rstrip('/')
BROWSER = os.environ.get('BROWSER', 'chromium')
OUT = Path('/tmp/smart-store-micro-scenes') / BROWSER
OUT.mkdir(parents=True, exist_ok=True)
VIEWPORTS = [(320,568),(390,844),(430,932),(768,1024),(844,390),(932,430),(851,768),(1024,600),(1024,768),(1440,500),(1440,768),(1440,900)]
FITS = '''e=>{const r=e.getBoundingClientRect(),s=e.closest('.feature-art')?.getBoundingClientRect()||e.closest('article').getBoundingClientRect();return r.top>=s.top-1&&r.bottom<=s.bottom+1&&r.left>=s.left-1&&r.right<=s.right+1&&e.scrollWidth<=e.clientWidth+1}'''
ANIMATIONS = 'e=>e.getAnimations({subtree:true}).map(a=>({time:a.currentTime,state:a.playState,properties:Object.keys(a.effect.getKeyframes()[0]).filter(p=>!["offset","easing","composite","computedOffset"].includes(p))}))'
# Complete foreground groups, measured on the original generated photographs.
SUBJECTS = {
    ('sale','square'):(330/1254,918/1254,918/1254,1082/1254),
    ('stock','square'):(668/1254,885/1254,1150/1254,1105/1254),
    ('reports','square'):(314/1254,890/1254,992/1254,1090/1254),
    ('sale','wide'):(1119/1536,698/1024,1420/1536,799/1024),
    ('stock','wide'):(1114/1536,600/1024,1442/1536,756/1024),
    ('reports','wide'):(1101/1536,585/1024,1460/1536,745/1024),
}

def assert_photo_subject(scene,key):
    geometry=scene.evaluate('''e=>({scene:e.getBoundingClientRect().toJSON(),frame:e.querySelector('.micro-frame').getBoundingClientRect().toJSON(),background:getComputedStyle(e.querySelector('.micro-backdrop-layer')).backgroundImage})''')
    s,f=geometry['scene'],geometry['frame']
    fmt='wide' if '-wide-' in geometry['background'] else 'square'
    bw,bh=(1536,1024) if fmt=='wide' else (1024,1024)
    scale=max(s['width']/bw,s['height']/bh)
    px,py=(.7,.5) if fmt=='wide' else (.5,1)
    x=s['left']+(s['width']-bw*scale)*px;y=s['top']+(s['height']-bh*scale)*py
    a,b,c,d=SUBJECTS[key,fmt]
    r={'left':x+a*bw*scale,'top':y+b*bh*scale,'right':x+c*bw*scale,'bottom':y+d*bh*scale}
    assert r['left']>=s['left']-1 and r['right']<=s['right']+1 and r['top']>=s['top']-1 and r['bottom']<=s['bottom']+1,(key,'photograph crops its subject',r,s)
    assert max(r['left']-f['right'],f['left']-r['right'],r['top']-f['bottom'],f['top']-r['bottom'])>=0,(key,'widget covers the photographed subject',r,f)

def load(page):
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.route('**/releases/latest', lambda r:r.fulfill(json={}))
    page.goto(BASE, wait_until='networkidle')
    return errors

def scroll(page, selector='#features'):
    page.locator(selector).evaluate('e=>scrollTo(0,e.offsetTop)')

def assert_data(page):
    for key, expected in [('sale',['40 550 ₸','Оплата принята']),('stock',['11','239','Остатки обновлены']),('reports',['437 500 ₸','164 150 ₸','Продажа в отчёте'])]:
        scene=page.locator('[data-micro="'+key+'"]')
        text=scene.locator('.micro-after').all_text_contents()
        assert all(any(s in t for t in text) for s in expected), (key,text)
        assert scene.locator('figcaption').inner_text().strip()

with sync_playwright() as p:
    args={'headless':True}
    if BROWSER=='chromium':args.update(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
    browser=getattr(p,BROWSER).launch(**args)
    for width,height in VIEWPORTS:
        page=browser.new_page(viewport={'width':width,'height':height},has_touch=width<1100,is_mobile=width<1100)
        errors=load(page)
        assert page.locator('[data-micro]').evaluate_all('xs=>xs.every(e=>!e.dataset.runs)'), 'Nothing should run below the fold'
        assert_data(page);scroll(page)
        for i,key in enumerate(['sale','stock','reports']):
            scene=page.locator('[data-micro="'+key+'"]')
            scene.evaluate('e=>e.closest("article").scrollIntoView({block:"nearest",inline:"center",behavior:"instant"})')
            page.wait_for_function('(key)=>["running","complete"].includes(document.querySelector(`[data-micro="${key}"]`).dataset.state)',arg=key)
            if scene.get_attribute('data-state')=='complete':
                scene.locator('xpath=ancestor::article').locator('.micro-replay').click()
                page.wait_for_function('(key)=>document.querySelector(`[data-micro="${key}"]`).dataset.state==="running"',arg=key)
            assert scene.locator('.micro-frame').evaluate(FITS), (width,height,key,'clipped widget')
            assert_photo_subject(scene,key)
            for item in scene.locator('.micro-heading,.micro-row,.micro-total,.micro-status,.micro-revenue,.micro-profit').all():
                assert item.evaluate('e=>e.scrollWidth<=e.clientWidth+1'), (width,height,key,'overflow inside widget')
            button=scene.locator('xpath=ancestor::article').locator('.micro-replay')
            assert button.evaluate('e=>{const r=e.getBoundingClientRect();return r.width>=44&&r.height>=44}')
            assert button.evaluate(FITS), (width,height,key,'clipped replay')
            assert button.get_attribute('aria-label')
            # Seek the real WAAPI timeline: scanning, first-item subtotal, then
            # final transaction/report. Resume near the end to test cleanup.
            def seek(phase):
                scene.evaluate('''(e,phase)=>{for(const a of e.getAnimations({subtree:true})){a.pause();a.currentTime=a.effect.getTiming().duration*phase}}''',phase)
            seek(.08)
            if key=='reports':
                initial=scene.locator('.micro-chart > span').evaluate_all('xs=>xs.map(e=>e.getBoundingClientRect().height)')
            if key=='sale':
                seek(.20)
                assert float(scene.locator('.micro-scan').first.evaluate('e=>getComputedStyle(e).opacity'))>.99
                assert float(scene.locator('.micro-scan').last.evaluate('e=>getComputedStyle(e).opacity'))<.01
                seek(.35)
                assert '39 900' in scene.locator('.micro-middle').inner_text()
                assert float(scene.locator('.micro-middle').evaluate('e=>getComputedStyle(e).opacity'))>.99
                assert float(scene.locator('.micro-total .micro-after').evaluate('e=>getComputedStyle(e).opacity'))<.01
            for phase in [.37,.555,.635]:
                seek(phase)
                assert scene.locator('.micro-widget').evaluate('e=>e.scrollWidth<=e.clientWidth+1'),(width,height,key,'animation overflows widget',phase)
                for item in scene.locator('.micro-row,.micro-total,.micro-revenue,.micro-profit').all():
                    assert item.evaluate('e=>e.scrollWidth<=e.clientWidth+1'),(width,height,key,'animation overflows row',phase)
            seek(.94)
            assert scene.locator('.micro-after').evaluate_all('xs=>xs.every(e=>getComputedStyle(e).opacity==="1")')
            if key=='reports':
                final=scene.locator('.micro-chart > span').evaluate_all('xs=>xs.map(e=>e.getBoundingClientRect().height)')
                assert all(b>a*2 for a,b in zip(initial,final)),('Every bar must visibly grow',initial,final)
            scene.evaluate('e=>e.getAnimations({subtree:true}).forEach(a=>a.play())')
            page.wait_for_function('(key)=>document.querySelector(`[data-micro="${key}"]`).dataset.state==="complete"',arg=key,timeout=9000)
            assert scene.evaluate('e=>e.getAnimations({subtree:true}).length')==0, 'Completed scenes must release animations'
            runs=scene.get_attribute('data-runs');url=page.url
            button.focus();page.keyboard.press('Enter')
            page.wait_for_function('(key)=>document.querySelector(`[data-micro="${key}"]`).dataset.state==="running"',arg=key)
            assert int(scene.get_attribute('data-runs'))==int(runs)+1
            assert page.url==url, 'Replay must not follow the full-card demo link'
            for animation in scene.evaluate(ANIMATIONS):
                assert set(animation['properties'])<={'opacity','transform'}, animation
            # Cancel to the real final state immediately when the preference changes.
            page.emulate_media(reduced_motion='reduce')
            page.wait_for_function('(key)=>document.querySelector(`[data-micro="${key}"]`).getAnimations({subtree:true}).length===0',arg=key)
            assert not button.is_visible()
            assert scene.locator('.micro-after').evaluate_all('xs=>xs.every(e=>getComputedStyle(e).opacity==="1")')
            page.emulate_media(reduced_motion='no-preference')
        assert page.locator('#features .screen-content').evaluate('e=>e.scrollHeight<=e.clientHeight+4'), (width,height,'section overflow')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        assert not errors,errors
        page.emulate_media(reduced_motion='reduce');scroll(page)
        page.screenshot(path=str(OUT/f'features-{width}-{height}.png'))
        print(json.dumps({'browser':BROWSER,'viewport':[width,height],'fullWidgetsAndReplay':'pass','finiteAndReducedMotion':'pass','demoData':'consistent'}),flush=True)
        page.close()
    # Exercise running animations and confirm their timelines actually stop.
    page=browser.new_page(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
    errors=load(page);scroll(page)
    scene=page.locator('[data-micro="sale"]')
    page.wait_for_function('document.querySelector("[data-micro=sale]").dataset.state==="running"')
    page.wait_for_timeout(400)
    # A held touch guards the whole scroll gesture, including momentum setup.
    page.evaluate('dispatchEvent(new PointerEvent("pointerdown",{pointerType:"touch"}))')
    page.wait_for_function('document.querySelector("[data-micro=sale]").dataset.state==="paused"')
    scene.evaluate('e=>Promise.all(e.getAnimations({subtree:true}).map(a=>a.ready))')
    times=scene.evaluate(ANIMATIONS);page.wait_for_timeout(250)
    after=scene.evaluate(ANIMATIONS)
    assert all(abs(a['time']-b['time'])<1 for a,b in zip(times,after)), (times,after)
    page.evaluate('dispatchEvent(new PointerEvent("pointerup",{pointerType:"touch"}))')
    page.wait_for_function('document.querySelector("[data-micro=sale]").dataset.state==="running"')
    # Real vertical scrolling pauses before the scene leaves the viewport.
    page.evaluate('scrollBy(0,8)')
    page.wait_for_function('document.querySelector("[data-micro=sale]").dataset.state==="paused"')
    page.wait_for_function('document.querySelector("[data-micro=sale]").dataset.state==="running"')
    # Modal isolation uses the actual preview dialog and its native open state.
    page.locator('#preview-dialog').evaluate('e=>e.showModal()')
    page.wait_for_function('document.querySelector("[data-micro=sale]").dataset.state==="paused"')
    scene.evaluate('e=>Promise.all(e.getAnimations({subtree:true}).map(a=>a.ready))')
    times=scene.evaluate(ANIMATIONS);page.wait_for_timeout(200)
    assert all(abs(a['time']-b['time'])<1 for a,b in zip(times,scene.evaluate(ANIMATIONS))), (times,scene.evaluate(ANIMATIONS))
    page.locator('#preview-dialog').evaluate('e=>e.close()')
    page.wait_for_function('document.querySelector("[data-micro=sale]").dataset.state==="running"')
    # Visibility lifecycle probe (headless windows do not emulate OS backgrounding).
    page.evaluate('Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"))')
    page.wait_for_function('document.querySelector("[data-micro=sale]").dataset.state==="paused"')
    scene.evaluate('e=>Promise.all(e.getAnimations({subtree:true}).map(a=>a.ready))')
    times=scene.evaluate(ANIMATIONS);page.wait_for_timeout(200)
    assert all(abs(a['time']-b['time'])<1 for a,b in zip(times,scene.evaluate(ANIMATIONS))), (times,scene.evaluate(ANIMATIONS))
    page.evaluate('delete document.hidden;document.dispatchEvent(new Event("visibilitychange"))')
    scroll(page,'#workspace')
    page.wait_for_function('document.querySelector("[data-micro=sale]").dataset.state==="idle"')
    assert scene.evaluate('e=>e.getAnimations({subtree:true}).length')==0
    runs=int(scene.get_attribute('data-runs'))
    scroll(page)
    page.wait_for_function('(runs)=>Number(document.querySelector("[data-micro=sale]").dataset.runs)===runs+1',arg=runs)
    scene.evaluate('e=>e.getAnimations({subtree:true}).forEach(a=>a.currentTime=a.effect.getTiming().duration*.96)')
    page.wait_for_function('document.querySelector("[data-micro=sale]").dataset.state==="complete"',timeout=8000)
    runs=scene.get_attribute('data-runs');page.evaluate('scrollBy(0,8)');page.wait_for_timeout(500)
    assert scene.get_attribute('data-runs')==runs and scene.get_attribute('data-state')=='complete', 'Small scrolls must not replay a finished scene'
    assert not errors,errors
    page.close()
    # The complete native UI and links survive a failed enhancement module.
    page=browser.new_page(viewport={'width':390,'height':844})
    page.route('**/scripts/micro-scenes.js*',lambda r:r.abort())
    errors=load(page);scroll(page);assert_data(page)
    assert not page.locator('.micro-replay:visible').count()
    assert page.locator('[data-micro="sale"] .micro-after').evaluate_all('xs=>xs.every(e=>getComputedStyle(e).opacity==="1")')
    page.locator('.feature-screen-link').first.click();assert page.locator('#preview-dialog').evaluate('e=>e.open')
    assert not errors,errors;page.close()
    context=browser.new_context(java_script_enabled=False,viewport={'width':390,'height':844})
    page=context.new_page();page.goto(BASE);assert_data(page)
    assert not page.locator('.micro-replay:visible').count()
    page.locator('.feature-screen-link').first.click();page.wait_for_url('**/img/demo-sale.png')
    context.close()
    print(json.dumps({'browser':BROWSER,'touchScrollOffscreenModalVisibilityPause':'pass','oncePerVisitAndFreshReturn':'pass','noJSAndModuleFailure':'pass'}),flush=True)
    browser.close()
