"""Phone optics must render without SVG filters and fail safely without a GPU.

This emulates the missing SVG path. WebKit automation is not a physical iPhone.
"""
from io import BytesIO
from pathlib import Path
import json, os, shutil
from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright

BASE=os.environ.get('SITE_TEST_URL','http://127.0.0.1:4173').rstrip('/')
BROWSER=os.environ.get('BROWSER','chromium')
OUT=Path('/tmp/smart-store-ios-optics-v86')/BROWSER
OUT.mkdir(parents=True,exist_ok=True)

with sync_playwright() as p:
    opts={'headless':True}
    if BROWSER=='chromium':opts.update(executable_path=shutil.which('chromium'),args=['--no-sandbox','--enable-unsafe-swiftshader'])
    browser=getattr(p,BROWSER).launch(**opts)
    page=browser.new_page(**p.devices['iPhone 13'])
    for host in ['zavod.metov.store','connect.metov.store','api.github.com']:
        page.route('https://'+host+'/**',lambda r:r.fulfill(status=204))
    # Reproduce the iOS WebView compositor convention that exposed bright arcs
    # when v84 supplied straight RGB at fractional alpha.
    page.add_init_script('''const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,options){return original.call(this,type,type==='webgl'?{...options,premultipliedAlpha:true}:options)}''')
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    # The new renderer cannot rely on SVG filter resources or CSS filter support.
    page.route('**/hero-refraction-*.png',lambda r:r.abort())
    page.goto(BASE,wait_until='networkidle')
    page.wait_for_function('()=>document.querySelector(".ribbon-window").dataset.optics==="webgl"')
    page.add_style_tag(content='.ribbon-refraction{filter:none!important}')
    page.emulate_media(reduced_motion='reduce')
    page.locator('.hero-gallery').focus()
    page.evaluate('window.flow=document.querySelector(".ribbon-track").getAnimations()[0]')
    page.wait_for_function('()=>flow.playState==="paused"&&!flow.pending')
    for n in [0,.28]:
        page.evaluate('(n)=>{flow.currentTime=44000*n;dispatchEvent(new Event("resize"))}',n)
        page.wait_for_timeout(150)
        a=page.locator('.ribbon-window').screenshot()
        hide=page.add_style_tag(content='.ribbon-optics{visibility:hidden!important}')
        z=page.locator('.ribbon-window').screenshot();hide.evaluate('e=>e.remove()')
        a=Image.open(BytesIO(a)).convert('RGB');z=Image.open(BytesIO(z)).convert('RGB')
        diff=ImageChops.difference(a,z);margin=round(a.width*.18)
        centre=max(ImageStat.Stat(diff.crop((margin,0,a.width-margin,a.height))).mean)
        edge=Image.new('RGB',(margin*2,a.height));edge.paste(diff.crop((0,0,margin,a.height)),(0,0));edge.paste(diff.crop((a.width-margin,0,a.width,a.height)),(margin,0))
        edge_mean=max(ImageStat.Stat(edge).mean)
        # Flat opening backgrounds need no minimum visible distortion. Detect
        # missing optics on the moving-photo frame; retain raw alpha checks below.
        assert centre<.35 and edge_mean<90,(n,centre,edge_mean)
        if n!=0:assert edge_mean>5,(n,edge_mean)
        alpha=page.locator('.ribbon-optics').evaluate('''c=>{const gl=c.getContext('webgl');const pixels=new Uint8Array(c.width*c.height*4);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let bad=0,translucent=0;for(let i=0;i<pixels.length;i+=4){const a=pixels[i+3];if(a>0&&a<255)translucent++;if(Math.max(pixels[i],pixels[i+1],pixels[i+2])>a+1)bad++}return {bad,translucent,premultiplied:gl.getContextAttributes().premultipliedAlpha}}''')
        assert alpha['premultiplied'] and alpha['bad']==0 and alpha['translucent']>100,alpha
        a.save(OUT/f'no-svg-{n}.png')
        print(json.dumps({'browser':BROWSER,'phase':n,'SVG':'disabled','GPU':'rendered','centreDiff':centre,'edgeDiff':edge_mean}),flush=True)
    assert page.locator('.ribbon-optics').evaluate('e=>getComputedStyle(e).pointerEvents')=='none'
    # A viewport change must neither leave a stale mobile canvas on desktop nor
    # create multiple canvases when the phone layout returns.
    page.set_viewport_size({'width':960,'height':844})
    page.wait_for_function('()=>!document.querySelector(".ribbon-window").dataset.optics')
    assert page.locator('.ribbon-optics').evaluate('e=>getComputedStyle(e).display')=='none'
    page.set_viewport_size({'width':390,'height':844})
    page.wait_for_function('()=>document.querySelector(".ribbon-window").dataset.optics==="webgl"')
    assert page.locator('.ribbon-optics').count()==1
    # Real GPU context loss must reveal the original photographs, not a blank
    # canvas. Restoration must upload its resources and paint again.
    extension=page.locator('.ribbon-optics').evaluate('''c=>{window.lostContext=c.getContext('webgl').getExtension('WEBGL_lose_context');if(lostContext)lostContext.loseContext();return !!lostContext}''')
    if extension:
        page.wait_for_function('()=>!document.querySelector(".ribbon-window").dataset.optics')
        assert page.locator('[data-gallery-card] img').first.is_visible()
        page.wait_for_timeout(200)
        page.evaluate('lostContext.restoreContext()')
        page.wait_for_function('()=>document.querySelector(".ribbon-window").dataset.optics==="webgl"')
    assert not errors,errors
    page.close()
    # No WebGL is an enhancement failure, not a failure of the landing page.
    page=browser.new_page(**p.devices['iPhone 13'])
    for host in ['zavod.metov.store','connect.metov.store','api.github.com']:
        page.route('https://'+host+'/**',lambda r:r.fulfill(status=204))
    page.add_init_script('''const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'?null:original.call(this,type,...args)}''')
    page.goto(BASE,wait_until='networkidle')
    page.wait_for_function('()=>document.querySelector(".gallery-stage").dataset.motion==="running"')
    page.wait_for_timeout(300)
    assert page.locator('.ribbon-optics').count()==0
    assert page.locator('[data-gallery-card] img').first.is_visible()
    page.locator('.hero-gallery').focus();page.keyboard.press('ArrowRight')
    page.wait_for_function('()=>document.getElementById("gallery-status").textContent.startsWith("2 из 5:")')
    print(json.dumps({'browser':BROWSER,'contextRestore':'pass' if extension else 'extension unavailable','noGPU':'original photos and keyboard work','responsiveSwitch':'pass'}),flush=True)
    page.close();browser.close()
