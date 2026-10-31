"""Continuous visible motion and a seamless loop; invisible/system motion gates remain."""
from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops, ImageStat
from io import BytesIO
import os, shutil, json
BASE=os.environ.get('SITE_TEST_URL','http://127.0.0.1:4173')
BROWSER=os.environ.get('BROWSER','chromium')
with sync_playwright() as p:
    opts={'headless':True}
    if BROWSER=='chromium':opts.update(executable_path=shutil.which('chromium'),args=['--no-sandbox','--enable-unsafe-swiftshader'])
    b=getattr(p,BROWSER).launch(**opts)
    for w,h in [(390,844),(1440,900),(2560,1440)]:
        page=b.new_page(viewport={'width':w,'height':h},has_touch=w<851,is_mobile=w<851)
        for host in ['zavod.metov.store','connect.metov.store','api.github.com']:
            page.route('https://'+host+'/**',lambda r:r.fulfill(status=204))
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(BASE,wait_until='networkidle')
        page.wait_for_function('()=>document.querySelector(".gallery-stage").dataset.motion==="running"')
        box=page.locator('.ribbon-window').bounding_box()
        assert box['x']==0 and 0<=w-box['width']<=16
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        assert page.locator('.gallery-controls,.gallery-motion,.gallery-bottom,.ribbon-pause').count()==0
        assert box['height']<=box['width']*(.54 if w<=620 else .30)+1
        card_width=page.locator('[data-gallery-card]').first.bounding_box()['width']
        assert card_width>=box['width']*(.77 if w<=620 else .35)
        page.evaluate('window.flow=document.querySelector(".ribbon-track").getAnimations()[0]')
        def advancing():
            page.wait_for_function('()=>flow.playState==="running"&&!flow.pending')
            before=page.evaluate('flow.currentTime');page.wait_for_timeout(180)
            assert page.evaluate('flow.currentTime')>before+40
        advancing()
        page.locator('.hero-gallery').focus();advancing()
        page.evaluate('scrollTo({top:100,behavior:"instant"})');advancing()
        box=page.locator('.ribbon-window').bounding_box()
        page.mouse.move(w/2,box['y']+box['height']/2);advancing()
        # Freeze only the test fixture with the visitor's OS motion preference.
        page.emulate_media(reduced_motion='reduce')
        page.wait_for_function('()=>flow.playState==="paused"&&!flow.pending')
        page.evaluate('scrollTo({top:0,behavior:"instant"})')
        before=page.evaluate('flow.currentTime');page.wait_for_timeout(150)
        assert page.evaluate('flow.currentTime')==before
        page.evaluate('()=>{flow.currentTime=0;dispatchEvent(new Event("resize"))}')
        page.wait_for_timeout(100)
        first=page.locator('[data-gallery-card]').first.bounding_box()
        a=page.locator('.ribbon-window').screenshot()
        duration=page.evaluate('flow.effect.getTiming().duration');assert duration==44000
        page.evaluate('(duration)=>{flow.currentTime=duration-1;dispatchEvent(new Event("resize"))}',duration)
        page.wait_for_timeout(100)
        copy=page.locator('[data-ribbon-set="after"] .gallery-card').first.bounding_box()
        z=page.locator('.ribbon-window').screenshot()
        assert abs(copy['x']-first['x'])<.2
        diff=ImageChops.difference(Image.open(BytesIO(a)).convert('RGB'),Image.open(BytesIO(z)).convert('RGB'))
        assert max(ImageStat.Stat(diff).mean)<2,'loop end must match its beginning'
        # Manual selection still works while reduced motion suppresses autoplay.
        page.evaluate('(duration)=>flow.currentTime=duration*3',duration)
        page.keyboard.press('ArrowRight')
        page.wait_for_function('()=>document.getElementById("gallery-status").textContent.startsWith("2 из 5:")')
        selected=page.locator('[data-gallery-card]').nth(1).bounding_box()
        assert abs(selected['x']+selected['width']/2-box['width']/2)<1
        page.emulate_media(reduced_motion='no-preference');advancing()
        page.evaluate('()=>{const r=document.querySelector(".hero-gallery").getBoundingClientRect();scrollTo({top:scrollY+r.bottom+30,behavior:"instant"})}')
        page.wait_for_function('()=>flow.playState==="paused"&&!flow.pending')
        offscreen=page.evaluate('flow.currentTime');page.wait_for_timeout(180)
        assert page.evaluate('flow.currentTime')==offscreen
        page.evaluate('scrollTo({top:0,behavior:"instant"})');advancing()
        assert not errors,errors
        print(json.dumps({'browser':BROWSER,'width':w,'visibleScrollFocusHover':'continuous','loop':'seamless','reducedMotion':'pass','offscreenResume':'pass'}),flush=True)
        page.close()
    b.close()
