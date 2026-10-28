"""Curved chromatic refraction, a sharp centre, readable originals and swipe/rest behaviour."""
from io import BytesIO
from pathlib import Path
import json, os, shutil
from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright

BASE = os.environ.get('SITE_TEST_URL', 'http://127.0.0.1:4173').rstrip('/')
BROWSER = os.environ.get('BROWSER', 'chromium')
OUT = Path('/tmp/smart-store-refraction-v81') / BROWSER
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
        page.wait_for_function('() => (document.querySelector(".gallery-stage").dataset.ready==="true")')
        page.locator('.hero-gallery').focus()
        page.evaluate('window.flow=document.querySelector(".ribbon-track").getAnimations()[0]')
        page.wait_for_function('() => (flow.playState==="paused"&&!flow.pending)')
        page.evaluate('flow.currentTime=flow.effect.getTiming().duration*.11')
        lens = page.locator('.ribbon-refraction').evaluate('''e=>({pointer:getComputedStyle(e).pointerEvents,filter:getComputedStyle(e).filter,trackFilter:getComputedStyle(e.querySelector('.ribbon-track')).filter})''')
        assert 'hero-refraction' in lens['filter'] and lens['trackFilter']=='none'
        scales=page.locator('#hero-refraction feDisplacementMap').evaluate_all('xs=>xs.map(e=>e.getAttribute("scale"))')
        assert len(scales)==3 and len(set(scales))==3 and all(float(n)>0 for n in scales)
        with_lens = page.locator('.ribbon-window').screenshot()
        # Neutralize displacement while preserving the same filter graph and blur.
        # This difference measures refraction, rather than an ordinary blur overlay.
        page.locator('#hero-refraction feDisplacementMap').evaluate_all('xs=>xs.forEach(e=>e.setAttribute("scale","0"))')
        without_lens = page.locator('.ribbon-window').screenshot()
        page.locator('#hero-refraction feDisplacementMap').evaluate_all('(xs,ss)=>xs.forEach((e,i)=>e.setAttribute("scale",ss[i]))',scales)
        a=Image.open(BytesIO(with_lens)).convert('RGB')
        b=Image.open(BytesIO(without_lens)).convert('RGB')
        difference=ImageChops.difference(a,b)
        inset=round(a.width*.28)
        middle=difference.crop((inset,0,a.width-inset,a.height))
        edge=Image.new('RGB',(inset*2,a.height))
        edge.paste(difference.crop((0,0,inset,a.height)),(0,0))
        edge.paste(difference.crop((a.width-inset,0,a.width,a.height)),(inset,0))
        middle_mean=max(ImageStat.Stat(middle).mean)
        edge_mean=max(ImageStat.Stat(edge).mean)
        assert middle_mean<.35, {'centreDifference':middle_mean}
        assert 3<edge_mean<90, {'edgeDifference':edge_mean}
        (OUT/f'lens-{w}.png').write_bytes(with_lens)
        (OUT/f'no-lens-{w}.png').write_bytes(without_lens)
        if w in [390,1440]:
            grid=page.add_style_tag(content='.gallery-card .editorial-photo{visibility:hidden!important}.gallery-card{background:repeating-linear-gradient(90deg,#101010 0 3px,#fafafa 3px 20px)!important}')
            warped=Image.open(BytesIO(page.locator('.ribbon-window').screenshot())).convert('RGB')
            # A vertical stripe is identical between rows until a lens bends it.
            def row_difference(img,left,right):
                y1,y2=round(img.height*.30),round(img.height*.50)
                row1=img.crop((left,y1,right,y1+1));row2=img.crop((left,y2,right,y2+1))
                return max(ImageStat.Stat(ImageChops.difference(row1,row2)).mean)
            edge_end=round(warped.width*.24)
            bend=row_difference(warped,0,edge_end)
            assert bend>5,('Straight lines must visibly bend at the edges',bend)
            assert row_difference(warped,round(warped.width*.30),round(warped.width*.70))<.5
            warped.save(OUT/f'curved-grid-{w}.png')
            grid.evaluate('e=>e.remove()')
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
            page.wait_for_function('() => (document.querySelector(".gallery-stage").dataset.motion==="running")')
            def swipe():
                common={'pointerId':7,'pointerType':'touch','isPrimary':True,'button':0,'buttons':1,'clientY':y}
                stage=page.locator('.gallery-stage')
                stage.dispatch_event('pointerdown',{**common,'clientX':w*.75})
                stage.dispatch_event('pointermove',{**common,'clientX':w*.25})
                stage.dispatch_event('pointerup',{**common,'buttons':0,'clientX':w*.25})
                stage.dispatch_event('click',{'clientX':w*.25,'clientY':y})
            swipe()
            page.wait_for_function("() => (document.querySelector('.ribbon-track').getAnimations().every(a=>a.animationName==='ribbon-flow'))")
            assert page.locator('#preview-dialog').evaluate('e=>!e.open')
            page.wait_for_function('() => (flow.playState==="paused"&&!flow.pending)')
            frozen=page.evaluate('flow.currentTime')
            page.wait_for_timeout(700)
            assert abs(page.evaluate('flow.currentTime')-frozen)<1
            page.wait_for_function('() => (document.querySelector(".gallery-stage").dataset.motion==="running")',timeout=3000)
            # The swipe timer must not resume motion after the visitor scrolls away.
            swipe();page.evaluate('scrollTo(0,100)')
            page.wait_for_timeout(2800)
            assert page.locator('.gallery-stage').get_attribute('data-motion')=='paused'
            page.evaluate('scrollTo(0,0)')
            page.wait_for_function('() => (document.querySelector(".gallery-stage").dataset.motion==="running")')
        assert not errors,errors
        print(json.dumps({'browser':BROWSER,'viewport':[w,h],'dpr':dpr,'edgeEffect':'curved displacement + chromatic split','centreMeanDifference':round(middle_mean,4),'edgeMeanDifference':round(edge_mean,4),'photoTapThroughGlass':'pass','swipeRestAndScroll':'pass' if w==390 else 'not repeated'}),flush=True)
        page.close()
    browser.close()
