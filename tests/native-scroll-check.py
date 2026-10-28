"""Guard document scroll stability during mobile browser-bar/keyboard resizing."""
from playwright.sync_api import sync_playwright
import os,shutil,json
from pathlib import Path
BASE=os.environ.get('SITE_TEST_URL','http://127.0.0.1:4173').rstrip('/')
BROWSER=os.environ.get('BROWSER','chromium')
with sync_playwright() as p:
    args={'headless':True}
    if BROWSER=='chromium':args.update(executable_path=os.environ.get('CHROMIUM_BINARY') or shutil.which('chromium'),args=['--no-sandbox'])
    b=getattr(p,BROWSER).launch(**args)
    # Safari may enlarge its viewport after first HTML paint / toolbar settlement.
    start=b.new_page(viewport={'width':390,'height':740},is_mobile=True,has_touch=True)
    start.goto(BASE,wait_until='networkidle')
    start.set_viewport_size({'width':390,'height':844})
    start.wait_for_function('() => (document.querySelector(".cinema-hero").offsetHeight===844&&document.body.style.getPropertyValue("--screen-height")==="844px")')
    assert start.evaluate('scrollY')==0
    # Repeated top-level toolbar growth/shrink must settle to the actual height.
    start.set_viewport_size({'width':390,'height':800})
    start.wait_for_function('() => (document.querySelector(".cinema-hero").offsetHeight===800&&document.body.style.getPropertyValue("--screen-height")==="800px")')
    start.set_viewport_size({'width':390,'height':844})
    start.wait_for_function('() => (document.querySelector(".cinema-hero").offsetHeight===844&&document.body.style.getPropertyValue("--screen-height")==="844px")')
    # A touch in progress must not change document geometry.
    start.evaluate('dispatchEvent(new PointerEvent("pointerdown"))')
    start.set_viewport_size({'width':390,'height':780});start.wait_for_timeout(250)
    assert start.locator('.cinema-hero').evaluate('e=>e.offsetHeight')==844
    start.evaluate('dispatchEvent(new PointerEvent("pointerup"))')
    start.wait_for_function('() => (document.querySelector(".cinema-hero").offsetHeight===780&&document.body.style.getPropertyValue("--screen-height")==="780px")')
    start.close()
    # A slow module must not reapply the stale size captured in the head.
    delayed=b.new_page(viewport={'width':390,'height':740},is_mobile=True,has_touch=True)
    delayed.route('**/app.js*',lambda r:r.fulfill(content_type='text/javascript',body='window.__held=true;await new Promise(r=>window.addEventListener("resume-app",r,{once:true}));\n'+Path('app.js').read_text()))
    delayed.goto(BASE,wait_until='commit');delayed.wait_for_function('() => (window.__held===true)')
    delayed.set_viewport_size({'width':390,'height':844})
    delayed.evaluate('dispatchEvent(new Event("resume-app"))')
    delayed.wait_for_function('() => (document.querySelector(".cinema-hero").offsetHeight===844&&document.body.style.getPropertyValue("--screen-height")==="844px")')
    delayed.close()
    page=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(BASE,wait_until='networkidle')
    page.wait_for_function('() => (document.body.style.getPropertyValue("--screen-height")==="844px")')
    assert page.locator('.screen-content.is-scrollable').count()==0
    page.locator('#license').scroll_into_view_if_needed()
    page.wait_for_timeout(100)
    initial=page.evaluate('({y:scrollY,top:document.querySelector("#license").offsetTop,height:document.querySelector("#features").offsetHeight})')
    changes=[]
    for h in [830,816,802,788,774,760,774,788,802,816,830,844]:
        page.set_viewport_size({'width':390,'height':h})
        page.wait_for_timeout(30)
        current=page.evaluate('({y:scrollY,top:document.querySelector("#license").offsetTop,height:document.querySelector("#features").offsetHeight})')
        assert current['height']==initial['height'],current
        assert current['top']==initial['top'],current
        changes.append(abs(current['y']-initial['y']))
    assert max(changes)<=1,changes
    # A real rotation changes width, so fullscreen height must update normally.
    page.set_viewport_size({'width':844,'height':390})
    page.wait_for_function('() => (document.querySelector("#features").offsetHeight===390)')
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.set_viewport_size({'width':390,'height':844})
    page.wait_for_function('() => (document.querySelector("#features").offsetHeight===844)')
    page.locator('#faq').scroll_into_view_if_needed()
    for summary in page.locator('.faq-list summary').all():summary.click()
    page.wait_for_function('() => (document.querySelector("#faq").offsetHeight>innerHeight)')
    assert not page.locator('#faq .screen-content').evaluate('e=>e.classList.contains("is-scrollable")')
    page.locator('.faq-list details').last.locator('p').scroll_into_view_if_needed()
    assert page.locator('.faq-list details').last.locator('p').is_visible()
    page.locator('.faq-list details').evaluate_all('(xs)=>xs.forEach(e=>e.open=false)')
    page.wait_for_function('() => (!document.querySelector("#faq .screen-content").classList.contains("is-scrollable"))')
    assert page.locator('.screen-content.is-scrollable').count()==0
    assert not errors,errors
    print(json.dumps({'browser':BROWSER,'maxUnrequestedScroll':max(changes),'closedVerticalScrollRegions':0,'topViewportSettlement':'pass','gestureGuard':'pass','delayedModule':'pass','rotation':'pass','expandedFAQ':'pass'}))
    b.close()
