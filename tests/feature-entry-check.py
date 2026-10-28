"""Feature motion waits for arrival and rest; each real return starts from zero."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import os,shutil,json
BASE=os.environ.get('SITE_TEST_URL','http://127.0.0.1:4173').rstrip('/')
BROWSER=os.environ.get('BROWSER','chromium')

def runs(page):
    return page.locator('[data-micro]').evaluate_all('xs=>xs.map(e=>Number(e.dataset.runs||0))')

def scroll(page,selector):
    page.locator(selector).evaluate('e=>scrollTo(0,e.offsetTop)')

def fresh(page,previous):
    page.wait_for_function('(n)=>Number(document.querySelector("[data-micro=sale]").dataset.runs)===n+1',arg=previous)
    assert page.locator('[data-micro=sale]').get_attribute('data-state')=='running'
    times=page.locator('[data-micro=sale]').evaluate('e=>e.getAnimations({subtree:true}).map(a=>a.currentTime)')
    assert times and max(times)<900,('Arrival must start at the beginning',times)

with sync_playwright() as p:
    opts={'headless':True}
    if BROWSER=='chromium':opts.update(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
    browser=getattr(p,BROWSER).launch(**opts)
    for w,h in [(320,568),(390,844),(844,390),(1440,900)]:
        page=browser.new_page(viewport={'width':w,'height':h},is_mobile=w<851,has_touch=w<851)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.route('**/releases/latest',lambda r:r.fulfill(json={}))
        for endpoint in ['hit','act']:page.route('https://zavod.metov.store/'+endpoint,lambda r:r.fulfill(status=204))
        page.goto(BASE,wait_until='networkidle');page.wait_for_timeout(600)
        assert runs(page)==[0,0,0]
        assert page.locator('[data-micro]').evaluate_all('xs=>xs.every(e=>!e.getAnimations({subtree:true}).length)')
        # This much photograph used to trigger the scene with half the card absent.
        page.locator('[data-micro=sale]').evaluate('e=>{const r=e.getBoundingClientRect();scrollTo(0,scrollY+r.top-innerHeight+r.height*.65)}')
        page.wait_for_timeout(700)
        assert runs(page)==[0,0,0],('Approaching a partial card must not consume its animation',runs(page))
        # Arriving during a held swipe must not start or consume any timeline.
        page.evaluate('dispatchEvent(new PointerEvent("pointerdown",{pointerType:"touch"}))')
        scroll(page,'#features');page.wait_for_timeout(600)
        assert runs(page)==[0,0,0]
        page.evaluate('window.released=performance.now();dispatchEvent(new PointerEvent("pointerup",{pointerType:"touch"}))')
        fresh(page,0)
        assert page.evaluate('performance.now()-released')>=200
        if w<851 or h<=600:
            assert runs(page)==[1,0,0],('Hidden carousel cards must stay cold',runs(page))
            page.locator('#feature-next').click()
            page.wait_for_function('() => (Number(document.querySelector("[data-micro=stock]").dataset.runs)===1)')
            assert runs(page)==[1,1,0]
            page.locator('#feature-prev').click();fresh(page,1)
        scene=page.locator('[data-micro=sale]')
        scene.evaluate('e=>e.getAnimations({subtree:true}).forEach(a=>a.currentTime=a.effect.getTiming().duration*.98)')
        page.wait_for_function('() => (document.querySelector("[data-micro=sale]").dataset.state==="complete")')
        count=runs(page)[0]
        page.evaluate('scrollBy(0,8)');page.wait_for_timeout(550)
        assert runs(page)[0]==count and scene.get_attribute('data-state')=='complete'
        scroll(page,'#workspace')
        page.wait_for_function('() => (document.querySelector("[data-micro=sale]").dataset.state==="idle")')
        assert scene.evaluate('e=>e.getAnimations({subtree:true}).length')==0
        # A glimpse followed by departure must cancel the pending entrance.
        scroll(page,'#features');page.wait_for_timeout(80);scroll(page,'#workspace');page.wait_for_timeout(550)
        assert runs(page)[0]==count
        scroll(page,'#features');fresh(page,count)
        assert not errors,errors
        print(json.dumps({'browser':BROWSER,'viewport':[w,h],'coldOnLoadAndPartialCard':'pass','waitsForTouchAndRest':'pass','carouselEntry':'pass','cancelledGlimpse':'pass','freshReturn':'pass','tinyScrollNoReplay':'pass'}),flush=True)
        page.close()
    browser.close()
