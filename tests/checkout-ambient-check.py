"""Real 3D motion, fixed tap targets, tracked landmarks and zero paused GPU work."""
from pathlib import Path
import base64, io, json, math, os, shutil
from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

BASE = os.environ.get('SITE_TEST_URL', 'http://127.0.0.1:4173').rstrip('/')
BROWSER = os.environ.get('BROWSER', 'chromium')
ROOT = Path(__file__).resolve().parents[1]
BUNDLE = json.loads((ROOT / 'assets/checkout-script.json').read_text())[0]
OUT = Path('/tmp/smart-store-checkout-ambient') / BROWSER
OUT.mkdir(parents=True, exist_ok=True)
INSTRUMENT = '''(()=>{window.checkoutDraws=0;window.checkoutLayoutReads=0;const rect=Element.prototype.getBoundingClientRect;Element.prototype.getBoundingClientRect=function(...args){if(this.id==='checkout-object'||this.classList?.contains('scene-point'))checkoutLayoutReads++;return rect.apply(this,args)};for(const name of ['drawElements','drawArrays']){const fn=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...args){if(this.canvas?.id==='checkout-canvas')window.checkoutDraws++;return fn.apply(this,args)}}})()'''

with sync_playwright() as p:
    opts = {'headless': True}
    if BROWSER == 'chromium':
        opts.update(executable_path=shutil.which('chromium'), args=['--no-sandbox', '--enable-unsafe-swiftshader'])
    browser = getattr(p, BROWSER).launch(**opts)
    for width, height in [(320, 568), (390, 844), (1440, 900)]:
        page = browser.new_page(viewport={'width': width, 'height': height}, has_touch=width<851, is_mobile=width<851)
        page.add_init_script(INSTRUMENT)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.route('**/releases/latest', lambda r: r.fulfill(json={}))
        page.goto(BASE, wait_until='networkidle')
        page.locator('#workspace').evaluate('e=>scrollTo(0,e.offsetTop)')
        def playing():
            page.wait_for_function('document.querySelector(".checkout-object").dataset.checkoutAmbient==="playing"')
        def phase():
            return float(page.locator('#checkout-canvas').get_attribute('data-ambient-phase'))
        def paused():
            page.wait_for_function('document.querySelector(".checkout-object").dataset.checkoutAmbient!=="playing"')
            page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
            count = page.evaluate('checkoutDraws')
            time = phase()
            page.wait_for_timeout(220)
            assert page.evaluate('checkoutDraws') == count, 'Paused motion must issue zero GL calls'
            assert phase() == time, 'Paused motion must keep its phase'
        playing()
        page.wait_for_function('Number(document.getElementById("checkout-canvas").dataset.ambientFrames)>2')
        buttons = page.locator('[data-checkout-point]').evaluate_all('xs=>xs.map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]})')
        before = int(page.locator('#checkout-canvas').get_attribute('data-ambient-frames'))
        layouts = page.evaluate('checkoutLayoutReads')
        started = page.evaluate('performance.now()')
        page.wait_for_timeout(650)
        duration = page.evaluate('performance.now()') - started
        rendered = int(page.locator('#checkout-canvas').get_attribute('data-ambient-frames')) - before
        assert 1 <= rendered <= math.ceil(duration / (1000/30 - .8)) + 1, (duration, rendered)
        assert page.evaluate('checkoutLayoutReads') == layouts, 'Moving markers must not read layout on every frame'
        after = page.locator('[data-checkout-point]').evaluate_all('xs=>xs.map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]})')
        assert buttons == after, 'Tap targets must stay still while the hardware floats'

        # Use the real engine as an offscreen probe. Verify its image bounds at
        # phases across both rotation periods, and compare tracked SVG points.
        page.evaluate('''async bundle=>{
          const {createCheckoutScene}=await import('/assets/'+bundle);
          const c=document.createElement('canvas');c.id='checkout-probe';
          c.style.cssText='position:fixed;left:-9999px;width:1px;height:1px';document.body.append(c);
          window.checkoutProbe=await createCheckoutScene({canvas:c});
          const s=document.querySelector('.checkout-object');checkoutProbe.resize(s.clientWidth,s.clientHeight,1);
        }''', BUNDLE)
        tracking = page.evaluate('''()=>{
          const c=document.getElementById('checkout-canvas'),s=document.querySelector('.checkout-object');
          const points=checkoutProbe.ambient(Number(c.dataset.ambientPhase));
          return points.map(([x,y],i)=>{
            const dot=document.querySelector(`[data-checkout-dot="${i}"]`);
            return Math.hypot(x*s.clientWidth-Number(dot.getAttribute('cx')),y*s.clientHeight-Number(dot.getAttribute('cy')));
          });
        }''')
        assert max(tracking) < .1, tracking
        neutral = None
        for time in [0, 2400, 4800, 7200, 9600, 12000, 14400, 16800, 19200]:
            encoded = page.evaluate('t=>{checkoutProbe.ambient(t);return document.getElementById("checkout-probe").toDataURL("image/png").split(",")[1]}', time)
            im = Image.open(io.BytesIO(base64.b64decode(encoded))).convert('RGBA')
            box = im.getchannel('A').point(lambda a: 255 if a>=220 else 0).getbbox()
            assert box and min(box[:2])>1 and box[2]<im.width-1 and box[3]<im.height-1, ('Clipped 3D hardware', width, time, box)
            if time == 0: neutral = im.copy()
            if time == 2400:
                assert ImageChops.difference(neutral, im).getbbox(), 'The real mesh must move'
                im.save(OUT / f'model-{width}-moving.png')
                neutral.save(OUT / f'model-{width}-neutral.png')
        page.evaluate('checkoutProbe.dispose();document.getElementById("checkout-probe").remove()')

        page.evaluate('dispatchEvent(new PointerEvent("pointerdown",{pointerType:"touch"}))')
        paused()
        held = phase()
        page.evaluate('dispatchEvent(new PointerEvent("pointerup",{pointerType:"touch"}))')
        playing();page.wait_for_timeout(100)
        assert held <= phase() < held+220, 'Resume must not jump forward in time'
        continuous = page.evaluate('''async()=>{
          document.dispatchEvent(new Event('scroll'));
          const before=checkoutDraws;
          const timer=setInterval(()=>document.dispatchEvent(new Event('scroll')),60);
          await new Promise(r=>setTimeout(r,480));clearInterval(timer);
          return [before,checkoutDraws];
        }''')
        assert continuous[0] == continuous[1], 'Continuous scrolling must stop all GL work'
        playing()
        page.locator('#preview-dialog').evaluate('e=>e.showModal()');paused()
        page.locator('#preview-dialog').evaluate('e=>e.close()');playing()
        page.locator('#license').evaluate('e=>scrollTo(0,e.offsetTop)');paused()
        page.locator('#workspace').evaluate('e=>scrollTo(0,e.offsetTop)');playing()
        page.evaluate('Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"))');paused()
        page.evaluate('delete document.hidden;document.dispatchEvent(new Event("visibilitychange"))');playing()
        page.evaluate('dispatchEvent(new PageTransitionEvent("pagehide"))');paused()
        page.evaluate('dispatchEvent(new PageTransitionEvent("pageshow",{persisted:true}))');playing()
        page.emulate_media(reduced_motion='reduce');paused()
        assert page.locator('.checkout-object').get_attribute('data-checkout-ambient') == 'off'
        page.evaluate('''()=>{
          window.checkoutRestartPhase=null;
          const c=document.getElementById('checkout-canvas');
          const observer=new MutationObserver(()=>{window.checkoutRestartPhase=Number(c.dataset.ambientPhase);observer.disconnect()});
          observer.observe(c,{attributes:true,attributeFilter:['data-ambient-phase']});
        }''')
        page.emulate_media(reduced_motion='no-preference');playing()
        page.wait_for_function('window.checkoutRestartPhase!==null')
        assert page.evaluate('checkoutRestartPhase') == 0, 'Restart must render its neutral first frame'
        page.locator('[data-checkout-point="2"]').click()
        page.wait_for_function('document.querySelector(".checkout-object").dataset.checkoutMotion==="idle"')
        paused()
        page.locator('#checkout-return').click();playing()
        if width == 390:
            for w,h in [(844,390),(390,844)]:
                page.set_viewport_size({'width':w,'height':h})
                page.wait_for_function('(h)=>parseFloat(getComputedStyle(document.body).getPropertyValue("--screen-height"))===h',arg=h)
                page.locator('#workspace').evaluate('e=>scrollTo(0,e.offsetTop)');playing()
                page.wait_for_function('''()=>{
                  const box=document.querySelector('.checkout-object').getBoundingClientRect();
                  return [...document.querySelectorAll('[data-checkout-point]')].every((button,i)=>{
                    const b=button.getBoundingClientRect();
                    const start=document.querySelector(`[data-checkout-leader="${i}"]`).getAttribute('d').match(/^M([\\d.e+-]+) ([\\d.e+-]+)H/);
                    return start&&Math.abs(Number(start[1])-(b.x+b.width/2-box.x))<.2&&Math.abs(Number(start[2])-(b.y+b.height/2-box.y))<.2;
                  });
                }''')
        assert not errors, errors
        print(json.dumps({'browser': BROWSER, 'viewport': [width,height], 'renderBudget': '30/s', 'trackedLandmarks': 'pass', 'fixedTargets': 'pass', 'completeHardware': '9 phases', 'pauseResumeReducedMotion': 'pass'}), flush=True)
        page.close()
    browser.close()
