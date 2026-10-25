"""Bounded edge optics, a sharp centre, readable originals and swipe/rest behaviour."""
from io import BytesIO
from pathlib import Path
import json, os, shutil
from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright

BASE = os.environ.get('SITE_TEST_URL', 'http://127.0.0.1:4173').rstrip('/')
BROWSER = os.environ.get('BROWSER', 'chromium')
OUT = Path('/tmp/smart-store-glass-v37') / BROWSER
OUT.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    launch = {'headless': True}
    if BROWSER == 'chromium':
        launch.update(executable_path=shutil.which('chromium'), args=['--no-sandbox'])
    browser = getattr(p, BROWSER).launch(**launch)
    for w,h,dpr in [(320,568,3),(390,844,3),(768,1024,2),(1440,900,2)]:
        page = browser.new_page(viewport={'width':w,'height':h},device_scale_factor=dpr,has_touch=w<851,is_mobile=w<851)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(BASE,wait_until='networkidle')
        page.locator('[data-gallery-card] img').evaluate_all('(xs)=>Promise.all(xs.map(i=>i.decode()))')
        page.wait_for_function('document.querySelector(".gallery-stage").dataset.ready==="true"')
        page.locator('.hero-gallery').focus()
        page.evaluate('window.flow=document.querySelector(".ribbon-track").getAnimations()[0]')
        page.wait_for_function('flow.playState==="paused"&&!flow.pending')
        page.evaluate('flow.currentTime=flow.effect.getTiming().duration*.11')
        lens = page.locator('.ribbon-window').evaluate('''e=>{
            const left=getComputedStyle(e,'::before'),right=getComputedStyle(e,'::after');
            return {left:parseFloat(left.width),right:parseFloat(right.width),pointer:left.pointerEvents,filter:left.getPropertyValue('backdrop-filter')||left.getPropertyValue('-webkit-backdrop-filter'),trackFilter:getComputedStyle(e.querySelector('.ribbon-track')).filter}
        }''')
        assert lens['left']==lens['right'] and lens['left']<=min(w*.14,176)+1
        assert lens['pointer']=='none' and lens['trackFilter']=='none'
        assert ('0.75px' if w<=620 else '1.2px') in lens['filter'],lens
        with_lens = page.locator('.ribbon-window').screenshot()
        # Keep the same compositing structure when disabling the optics. Removing
        # a backdrop layer entirely can change Chromium's image antialiasing.
        off = page.add_style_tag(content='.ribbon-window::before,.ribbon-window::after{background:transparent!important;-webkit-backdrop-filter:blur(0px)!important;backdrop-filter:blur(0px)!important}')
        without_lens = page.locator('.ribbon-window').screenshot()
        off.evaluate('e=>e.remove()')
        a=Image.open(BytesIO(with_lens)).convert('RGB')
        b=Image.open(BytesIO(without_lens)).convert('RGB')
        difference=ImageChops.difference(a,b)
        inset=round(a.width*.15)
        middle=difference.crop((inset,0,a.width-inset,a.height))
        edge=Image.new('RGB',(inset*2,a.height))
        edge.paste(difference.crop((0,0,inset,a.height)),(0,0))
        edge.paste(difference.crop((a.width-inset,0,a.width,a.height)),(inset,0))
        middle_mean=max(ImageStat.Stat(middle).mean)
        edge_mean=max(ImageStat.Stat(edge).mean)
        assert middle_mean<.05, {'centreDifference':middle_mean}
        assert .01<edge_mean<8, {'edgeDifference':edge_mean}
        (OUT/f'lens-{w}.png').write_bytes(with_lens)
        (OUT/f'no-lens-{w}.png').write_bytes(without_lens)
        # A lens covers this coordinate visually, but never intercepts a photo tap.
        box=page.locator('.ribbon-window').bounding_box()
        y=box['y']+box['height']/2
        x=page.evaluate('''y=>[8,16,24,32].find(x=>document.elementFromPoint(x,y)?.closest('a[data-preview]'))''',y)
        assert x is not None
        page.mouse.click(x,y)
        assert page.locator('#preview-dialog').evaluate('e=>e.open')
        assert page.locator('#preview-image').evaluate('e=>getComputedStyle(e).filter')=='none'
        page.keyboard.press('Escape')
        if w==390:
            page.mouse.move(1,1)
            page.evaluate('document.activeElement.blur()')
            page.wait_for_function('document.querySelector(".gallery-stage").dataset.motion==="running"')
            def swipe():
                common={'pointerId':7,'pointerType':'touch','isPrimary':True,'button':0,'buttons':1,'clientY':y}
                stage=page.locator('.gallery-stage')
                stage.dispatch_event('pointerdown',{**common,'clientX':w*.75})
                stage.dispatch_event('pointermove',{**common,'clientX':w*.25})
                stage.dispatch_event('pointerup',{**common,'buttons':0,'clientX':w*.25})
                stage.dispatch_event('click',{'clientX':w*.25,'clientY':y})
            swipe()
            page.wait_for_function("document.querySelector('.ribbon-track').getAnimations().every(a=>a.animationName==='ribbon-flow')")
            assert page.locator('#preview-dialog').evaluate('e=>!e.open')
            page.wait_for_function('flow.playState==="paused"&&!flow.pending')
            frozen=page.evaluate('flow.currentTime')
            page.wait_for_timeout(700)
            assert abs(page.evaluate('flow.currentTime')-frozen)<1
            page.wait_for_function('document.querySelector(".gallery-stage").dataset.motion==="running"',timeout=3000)
            # The swipe timer must not resume motion after the visitor scrolls away.
            swipe();page.evaluate('scrollTo(0,100)')
            page.wait_for_timeout(2800)
            assert page.locator('.gallery-stage').get_attribute('data-motion')=='paused'
            page.evaluate('scrollTo(0,0)')
            page.wait_for_function('document.querySelector(".gallery-stage").dataset.motion==="running"')
        assert not errors,errors
        print(json.dumps({'browser':BROWSER,'viewport':[w,h],'dpr':dpr,'edgeWidth':lens['left'],'centreMeanDifference':round(middle_mean,4),'edgeMeanDifference':round(edge_mean,4),'photoTapThroughGlass':'pass','swipeRestAndScroll':'pass' if w==390 else 'not repeated'}),flush=True)
        page.close()
    browser.close()
