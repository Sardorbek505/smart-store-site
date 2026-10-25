"""Cover the page canvas when mobile browser controls obscure part of its height.

Headless engines have no native Safari toolbar. Model its distinct reported
window/visual height while retaining the real CSS viewport used for painting.
"""
from playwright.sync_api import sync_playwright
from pathlib import Path
import os, shutil, json
BASE=os.environ.get('SITE_TEST_URL','http://127.0.0.1:4173').rstrip('/')
BROWSER=os.environ.get('BROWSER','chromium')
OUT=Path('/tmp/smart-store-hero-coverage')/BROWSER
OUT.mkdir(parents=True,exist_ok=True)
BOOT='window.__moduleHeld=true;await new Promise(r=>window.addEventListener("release-app",r,{once:true}));\n'
METRICS='''() => ({hero:document.querySelector('.cinema-hero').getBoundingClientRect().toJSON(),next:document.querySelector('#features').offsetTop,scroll:scrollY,screen:document.body.style.getPropertyValue('--screen-height')})'''
with sync_playwright() as p:
    args={'headless':True}
    if BROWSER=='chromium':args.update(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
    b=getattr(p,BROWSER).launch(**args)
    for width,canvas,reported in [(390,844,740),(393,852,710),(430,932,812),(844,390,310)]:
        page=b.new_page(viewport={'width':width,'height':canvas},is_mobile=True,has_touch=True,reduced_motion='reduce')
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.add_init_script(f'''window.__reportedHeight={reported};
          Object.defineProperty(window,'innerHeight',{{get:()=>window.__reportedHeight}});
          Object.defineProperty(window.visualViewport,'height',{{get:()=>window.__reportedHeight}});''')
        page.route('**/app.js*',lambda r:r.fulfill(content_type='text/javascript',body=BOOT+Path('app.js').read_text()))
        page.route('**/releases/latest',lambda r:r.fulfill(json={}))
        page.goto(BASE,wait_until='commit');page.wait_for_function('window.__moduleHeld===true')
        page.locator('.hero-gallery img').evaluate_all('xs=>Promise.all(xs.map(e=>e.decode()))')
        before=page.evaluate(METRICS)
        # The first section must cover the actual page bottom, including content
        # painted beneath the floating browser controls. Test before app JS too.
        assert abs(before['hero']['height']-canvas)<1, {'canvas':canvas,'reported':reported,'phase':'before modules',**before}
        assert before['next']>=canvas-1
        assert page.evaluate('(h)=>!!document.elementFromPoint(1,h-1)?.closest(".cinema-hero")',canvas)
        page.evaluate('dispatchEvent(new Event("release-app"))')
        page.wait_for_function('document.body.classList.contains("viewport-ready")')
        page.wait_for_load_state('networkidle')
        after=page.evaluate(METRICS)
        assert abs(before['hero']['height']-after['hero']['height'])<1,(before,after)
        assert after['next']>=canvas-1
        assert page.locator('.cinema-actions').evaluate('(e,h)=>e.getBoundingClientRect().bottom<h',reported)
        page.screenshot(path=str(OUT/f'hero-{width}.png'))
        # Only the reported browser-control area changes, not the CSS canvas.
        page.evaluate('(h)=>{window.__reportedHeight=h;dispatchEvent(new Event("resize"))}',reported+40)
        page.wait_for_timeout(250)
        assert abs(page.locator('.cinema-hero').evaluate('e=>e.offsetHeight')-canvas)<1
        # Once scrolling, browser-control movement must leave all section offsets.
        page.evaluate('scrollTo(0,150)');page.wait_for_timeout(100)
        stable=page.evaluate(METRICS)
        store=page.locator('#store').evaluate('e=>e.offsetTop')
        for h in [reported-30,reported-60,reported]:
            page.evaluate('(h)=>{window.__reportedHeight=h;dispatchEvent(new Event("resize"))}',h)
            page.wait_for_timeout(220)
            current=page.evaluate(METRICS)
            assert current['next']==stable['next'] and current['screen']==stable['screen']
            assert abs(current['scroll']-stable['scroll'])<=1
            assert page.locator('#store').evaluate('e=>e.offsetTop')==store
        assert page.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth')
        assert not errors,errors
        print(json.dumps({'engine':BROWSER,'width':width,'paintedViewport':canvas,'reportedViewport':reported,'heroHeight':round(after['hero']['height']),'beforeModules':'covered','afterModules':'covered','scrollOffsets':'stable'}),flush=True)
        page.close()
    b.close()
