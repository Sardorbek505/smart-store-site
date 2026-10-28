"""Solid feature showcase: readable content, rigid motion, lifecycle and fallback.

All service traffic is replaced with fixtures; no real analytics or shops.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, os, shutil
BASE=os.environ.get('SITE_TEST_URL','http://127.0.0.1:4173').rstrip('/')
BROWSER=os.environ.get('BROWSER','chromium')
OUT=Path(os.environ.get('CUBE_ARTIFACTS','/tmp/smart-store-cubes'))/BROWSER
OUT.mkdir(parents=True,exist_ok=True)
IDLE='() => document.querySelector("#features").dataset.featureMotion==="idle"'
with sync_playwright() as p:
    opts={'headless':True}
    if BROWSER=='chromium':opts.update(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
    browser=getattr(p,BROWSER).launch(**opts)
    def context(**options):
        c=browser.new_context(**options)
        c.route('https://zavod.metov.store/**',lambda r:r.fulfill(status=204))
        c.route('https://connect.metov.store/**',lambda r:r.fulfill(status=204))
        c.route('https://api.github.com/**',lambda r:r.fulfill(status=503))
        return c
    for w,h in [(320,568),(390,844),(768,1024),(844,390),(851,601),(1024,601),(1024,768),(1440,700),(1440,768),(1440,900)]:
        c=context(viewport={'width':w,'height':h},has_touch=w<851,is_mobile=w<851,reduced_motion='reduce')
        page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(BASE+'/#features',wait_until='networkidle')
        page.wait_for_function('() => document.querySelector("#features").classList.contains("feature-cubes-ready")')
        assert page.locator('.feature-solid-body').count()==2
        assert page.locator('.feature-solid-cap').count()==4
        assert page.locator('#feature-playback').is_hidden()
        assert page.locator('.feature-solid-assembly').evaluate('e=>getComputedStyle(e).transform.startsWith("matrix3d")')
        for i,key in enumerate(['sale','stock','reports']):
            if i:page.locator('#feature-next').click()
            page.wait_for_function('(i)=>document.querySelector("#features").dataset.featureIndex===String(i)',arg=i)
            page.wait_for_function(IDLE)
            assert page.locator('#feature-count').inner_text()==f'0{i+1} / 03'
            active=page.locator('.bento[data-feature-selected="true"]')
            copy=page.locator('.feature-solid-captions [data-feature-selected="true"]')
            assert active.count()==1 and active.locator('[data-micro]').get_attribute('data-micro')==key
            assert page.locator('.bento[inert]').count()==2
            assert active.locator('[data-micro]').evaluate('e=>e.getAnimations({subtree:true}).length')==0
            assert copy.locator('h3').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
            assert 'товаруже' not in copy.inner_text() and 'продан.Склад' not in copy.inner_text()
            assert page.locator('#features .screen-content').evaluate('e=>e.scrollHeight<=e.clientHeight+4'),(w,h,'section overflow')
            assert page.locator('.feature-solid-scene').evaluate('''e=>{
                const s=e.getBoundingClientRect();
                return [...e.querySelectorAll('.feature-solid-face')].every(f=>{
                  const r=f.getBoundingClientRect();
                  return r.top>=s.top-2&&r.bottom<=s.bottom+2&&r.left>=s.left-2&&r.right<=s.right+2;
                });
            }'''),(w,h,'solid leaves its scene')
            for control in copy.locator('a,button:not([hidden])').all():
                assert control.evaluate('e=>{const r=e.getBoundingClientRect();return r.width>=44&&r.height>=44}')
            link=copy.locator('.feature-screen-link');link.click()
            page.wait_for_function('() => document.querySelector("#preview-dialog").open')
            assert page.locator('#preview-original').get_attribute('href').endswith(['demo-sale.png','demo-products.png','demo-home.png'][i])
            if w==390 and i==1:
                page.reload(wait_until='networkidle')
                page.wait_for_function('()=>document.querySelector("#preview-dialog").open')
                assert page.locator('#features').get_attribute('data-feature-index')=='1'
            page.keyboard.press('Escape')
            page.wait_for_function('() => !document.querySelector("#preview-dialog").open')
            assert page.locator('#features').get_attribute('data-feature-index')==str(i)
            if w==390 and i==1:
                page.locator('#feature-prev').click()
                page.go_forward()
                page.wait_for_function('()=>document.querySelector("#preview-dialog").open')
                assert page.locator('#features').get_attribute('data-feature-index')=='1'
                page.keyboard.press('Escape')
                page.wait_for_function('()=>!document.querySelector("#preview-dialog").open')
                assert link.evaluate('e=>document.activeElement===e')
        # Cyclic buttons and explicit keyboard destinations remain predictable.
        page.locator('#feature-next').click()
        assert page.locator('#features').get_attribute('data-feature-index')=='0'
        page.locator('#feature-prev').click()
        assert page.locator('#features').get_attribute('data-feature-index')=='2'
        page.locator('.bento-grid').focus();page.keyboard.press('Home')
        assert page.locator('#features').get_attribute('data-feature-index')=='0'
        page.keyboard.press('End')
        assert page.locator('#features').get_attribute('data-feature-index')=='2'
        page.screenshot(path=str(OUT/f'final-{w}.png'))
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        assert not errors,errors
        print(json.dumps({'browser':BROWSER,'viewport':[w,h],'solidGeometry':'pass','captionsAndOriginalScreens':'pass','reducedMotion':'static','keyboardAndHistory':'pass'}),flush=True)
        c.close()

    c=context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
    page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(BASE,wait_until='networkidle');page.wait_for_timeout(350)
    section=page.locator('#features');stage=page.locator('.bento-grid');bodies=page.locator('.feature-solid-body')
    assert section.get_attribute('data-feature-entered')=='false'
    assert page.locator('[data-micro]').evaluate_all('xs=>xs.every(e=>!e.dataset.runs)')
    assert stage.evaluate('e=>e.getAnimations({subtree:true}).length')==0
    section.evaluate('e=>scrollTo(0,e.offsetTop)')
    page.wait_for_function('() => document.querySelector("#features").dataset.featureMotion==="running"')
    assert bodies.evaluate_all('xs=>xs.every(e=>e.getAnimations().length===1)')
    # During a real turn the six faces remain attached to each rigid body.
    assert bodies.evaluate_all('xs=>xs.every(e=>e.querySelectorAll(":scope > .feature-solid-face").length===6)')
    page.locator('.enter-link').click()
    stage.evaluate('e=>Promise.all(e.getAnimations({subtree:true}).map(a=>a.ready))')
    times=stage.evaluate('e=>e.getAnimations({subtree:true}).map(a=>a.currentTime)')
    page.wait_for_timeout(200)
    assert times and stage.evaluate('e=>e.getAnimations({subtree:true}).every(a=>a.playState==="paused")')
    assert all(abs(a-b)<1 for a,b in zip(times,stage.evaluate('e=>e.getAnimations({subtree:true}).map(a=>a.currentTime)')))
    page.keyboard.press('Escape');page.wait_for_function(IDLE)
    page.wait_for_function('()=>Number(document.querySelector("[data-micro=sale]").dataset.runs)===1')
    assert page.locator('[data-micro=stock]').get_attribute('data-runs') is None
    page.wait_for_function('()=>document.querySelector("#features").dataset.featureIndex==="1"',timeout=6500)
    page.wait_for_function(IDLE)
    page.wait_for_function('()=>Number(document.querySelector("[data-micro=stock]").dataset.runs)===1')
    # Pause prevents both the current clock and future automatic turns.
    page.locator('#feature-playback').click()
    assert section.get_attribute('data-feature-automatic')=='false'
    page.wait_for_timeout(4400)
    assert section.get_attribute('data-feature-index')=='1'
    page.locator('#feature-playback').click()
    page.locator('#workspace').evaluate('e=>scrollTo(0,e.offsetTop)')
    page.wait_for_timeout(4500)
    assert section.get_attribute('data-feature-index')=='1'
    section.evaluate('e=>scrollTo(0,e.offsetTop)')
    page.wait_for_function('()=>document.querySelector("#features").dataset.featureIndex==="2"',timeout=6500)
    page.wait_for_function(IDLE)
    # Rapid manual input stops autoplay and queues the most recent destination.
    page.locator('#feature-prev').click();page.locator('#feature-prev').click()
    page.wait_for_function('()=>document.querySelector("#features").dataset.featureIndex==="0"&&document.querySelector("#features").dataset.featureMotion==="idle"')
    assert section.get_attribute('data-feature-automatic')=='false'
    page.locator('#feature-next').click();page.emulate_media(reduced_motion='reduce')
    page.wait_for_function(IDLE)
    assert stage.evaluate('e=>e.getAnimations({subtree:true}).length')==0
    def swipe(dx,dy):
        stage.evaluate('''(e,d)=>{
          e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:9,isPrimary:true,pointerType:'touch',button:0,clientX:160,clientY:250}));
          e.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:9,isPrimary:true,pointerType:'touch',clientX:160+d[0],clientY:250+d[1]}));
          e.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:9,isPrimary:true,pointerType:'touch',button:0,clientX:160+d[0],clientY:250+d[1]}));
        }''',[dx,dy])
    selected=section.get_attribute('data-feature-index');swipe(8,100)
    assert section.get_attribute('data-feature-index')==selected
    swipe(100,4)
    assert section.get_attribute('data-feature-index')=='0'
    stage.dispatch_event('click');assert not page.locator('#preview-dialog').evaluate('e=>e.open')
    assert not errors,errors
    print(json.dumps({'browser':BROWSER,'coldBelowFold':'pass','oppositeRigidRotation':'pass','automaticCycleAndPause':'pass','offscreenPause':'pass','rapidInputAndSwipe':'pass','modalPause':'pass'}),flush=True)
    c.close()
    for mode in ['blocked-module','cached-styles','no-js']:
        c=context(viewport={'width':390,'height':844},java_script_enabled=mode!='no-js')
        if mode=='blocked-module':c.route('**/scripts/feature-cubes.js*',lambda r:r.abort())
        if mode=='cached-styles':
            def old_styles(route):
                response=route.fetch()
                route.fulfill(response=response,body=response.text()+'\n#features{--feature-cubes-version:0}')
            c.route('**/assets/site.*.css',old_styles)
        page=c.new_page();page.goto(BASE+'/#features',wait_until='networkidle')
        assert not page.locator('#features').evaluate('e=>e.classList.contains("feature-cubes-ready")')
        assert page.locator('.bento').count()==3
        assert page.locator('[data-micro]').evaluate_all('xs=>xs.every(e=>e.querySelector("figcaption").textContent.trim())')
        if mode!='no-js':assert page.locator('#store-submit').is_enabled()
        c.close()
    browser.close()
