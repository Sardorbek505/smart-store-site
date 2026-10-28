"""Paired cube motion, input, readable faces and progressive fallbacks.

Service responses are fixtures. Real shop lookups and counters are never sent.
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
        for i,key in enumerate(['sale','stock','reports']):
            if i:page.locator('#feature-next').click()
            page.wait_for_function('(i)=>document.querySelector("#features").dataset.featureIndex===String(i)',arg=i)
            page.wait_for_function(IDLE)
            assert page.locator('#feature-count').inner_text()==f'0{i+1} / 03'
            active=page.locator('.bento[data-feature-selected="true"]')
            assert active.count()==1 and active.locator('[data-micro]').get_attribute('data-micro')==key
            assert page.locator('.bento[inert]').count()==2
            assert active.locator('[data-micro]').evaluate('e=>e.getAnimations({subtree:true}).length')==0
            for selector in ['.bento-copy','.feature-art']:
                metrics=active.locator(selector).evaluate('''e=>{
                  const box=e.getBoundingClientRect(),frame=e.closest('.bento-grid').getBoundingClientRect();
                  return {fits:box.top>=frame.top-1&&box.bottom<=frame.bottom+1&&box.left>=frame.left-1&&box.right<=frame.right+1,
                    overflow:e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1};
                }''')
                assert metrics['fits'] and not metrics['overflow'],(w,h,key,selector,metrics)
            assert active.locator('.micro-widget').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
            link=active.locator('.feature-screen-link');link.click()
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
                assert page.locator('#features').get_attribute('data-feature-index')=='0'
                page.go_forward()
                page.wait_for_function('()=>document.querySelector("#preview-dialog").open')
                assert page.locator('#features').get_attribute('data-feature-index')=='1'
                page.keyboard.press('Escape')
                page.wait_for_function('()=>!document.querySelector("#preview-dialog").open')
                assert link.evaluate('e=>document.activeElement===e')
        assert page.locator('#feature-next').is_disabled()
        page.locator('.bento-grid').focus();page.keyboard.press('Home')
        assert page.locator('#feature-prev').is_disabled()
        page.keyboard.press('End');assert page.locator('#feature-next').is_disabled()
        page.screenshot(path=str(OUT/f'final-{w}.png'))
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        assert not errors,errors
        if w==320:
            # Browser-bar movement must not switch the frozen short layout to
            # a taller copy face and squeeze the actual example out of view.
            original=page.locator('.bento-grid').evaluate('e=>e.offsetHeight')
            page.set_viewport_size({'width':320,'height':620})
            page.wait_for_timeout(250)
            assert page.locator('.bento-grid').evaluate('e=>e.offsetHeight')==original
            assert page.locator('#features').get_attribute('data-feature-compact')=='true'
            assert active.locator('.feature-art').evaluate('e=>e.scrollHeight<=e.clientHeight+1')
        print(json.dumps({'browser':BROWSER,'viewport':[w,h],'threeStates':'readable','originalScreens':'pass','reducedMotion':'static','keyboardAndFocus':'pass'}),flush=True)
        c.close()

    c=context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
    page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(BASE,wait_until='networkidle');page.wait_for_timeout(350)
    assert page.locator('#features').get_attribute('data-feature-entered')=='false'
    assert page.locator('[data-micro]').evaluate_all('xs=>xs.every(e=>!e.dataset.runs)')
    assert page.locator('.bento-grid').evaluate('e=>e.getAnimations({subtree:true}).length')==0
    page.locator('#features').evaluate('e=>scrollTo(0,e.offsetTop)')
    page.wait_for_function('() => document.querySelector("#features").dataset.featureMotion==="running"')
    planes=page.locator('.bento-grid')
    assert planes.evaluate('e=>e.getAnimations({subtree:true}).every(a=>Object.keys(a.effect.getKeyframes()[0]).filter(k=>!["offset","easing","composite","computedOffset"].includes(k)).every(k=>k==="transform"))')
    page.locator('.enter-link').click()
    planes.evaluate('e=>Promise.all(e.getAnimations({subtree:true}).map(a=>a.ready))')
    times=planes.evaluate('e=>e.getAnimations({subtree:true}).map(a=>a.currentTime)')
    page.wait_for_timeout(200)
    assert times and planes.evaluate('e=>e.getAnimations({subtree:true}).every(a=>a.playState==="paused")')
    assert all(abs(a-b)<1 for a,b in zip(times,planes.evaluate('e=>e.getAnimations({subtree:true}).map(a=>a.currentTime)')))
    page.keyboard.press('Escape');page.wait_for_function(IDLE)
    page.wait_for_function('()=>Number(document.querySelector("[data-micro=sale]").dataset.runs)===1')
    assert page.locator('[data-micro=stock]').get_attribute('data-runs') is None
    assert page.locator('[data-micro=reports]').get_attribute('data-runs') is None
    # Interrupted turns queue the most recent destination and settle exactly.
    page.locator('#feature-next').click();page.locator('#feature-next').click()
    page.wait_for_function('()=>document.querySelector("#features").dataset.featureIndex==="2"&&document.querySelector("#features").dataset.featureMotion==="idle"')
    page.locator('#feature-prev').click()
    page.emulate_media(reduced_motion='reduce')
    page.wait_for_function(IDLE)
    assert planes.evaluate('e=>e.getAnimations({subtree:true}).length')==0
    # A swipe changes the feature; a vertical gesture leaves it unchanged.
    def swipe(dx,dy):
        planes.evaluate('''(e,delta)=>{
          e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:9,isPrimary:true,pointerType:'touch',button:0,clientX:160,clientY:250}));
          e.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:9,isPrimary:true,pointerType:'touch',clientX:160+delta[0],clientY:250+delta[1]}));
          e.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:9,isPrimary:true,pointerType:'touch',button:0,clientX:160+delta[0],clientY:250+delta[1]}));
        }''',[dx,dy])
    selected=page.locator('#features').get_attribute('data-feature-index')
    swipe(8,100)
    assert page.locator('#features').get_attribute('data-feature-index')==selected
    swipe(100,4)
    assert page.locator('#features').get_attribute('data-feature-index')=='0'
    # Suppress the generated click after a swipe instead of opening a screenshot.
    planes.dispatch_event('click')
    assert not page.locator('#preview-dialog').evaluate('e=>e.open')
    if BROWSER=='chromium':
        client=c.new_cdp_session(page)
        for kind,x in [('touchStart',250),('touchMove',190),('touchMove',120),('touchEnd',120)]:
            client.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[] if kind=='touchEnd' else [{'x':x,'y':350}]})
        page.wait_for_function('()=>document.querySelector("#features").dataset.featureIndex==="1"')
    assert not errors,errors
    print(json.dumps({'browser':BROWSER,'entry':'once, visible only','hiddenScenes':'cold','modalPause':'pass','rapidNavigation':'pass','liveReducedMotion':'pass','swipeDirectionAndClickGuard':'pass'}),flush=True)
    c.close()

    # Failed enhancement keeps the static carousel and primary site actions.
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
