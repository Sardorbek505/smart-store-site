"""Navigation follows page tone; real pixels transmit and blur the backdrop."""
from io import BytesIO
from pathlib import Path
import json, os, shutil
from PIL import Image, ImageStat, ImageChops
from playwright.sync_api import sync_playwright

BASE=os.environ.get('SITE_TEST_URL','http://127.0.0.1:4173').rstrip('/')
BROWSER=os.environ.get('BROWSER','chromium')
OUT=Path('/tmp/smart-store-navigation-glass')/BROWSER;OUT.mkdir(parents=True,exist_ok=True)

def luminance(rgb):
    channels=[v/255 for v in rgb]
    linear=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in channels]
    return sum(v*w for v,w in zip(linear,[.2126,.7152,.0722]))

def contrast(a,b):
    a,b=sorted([luminance(a),luminance(b)])
    return (b+.05)/(a+.05)

with sync_playwright() as p:
    args={'headless':True}
    if BROWSER=='chromium':args.update(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
    browser=getattr(p,BROWSER).launch(**args)
    # Some WPE headless builds expose the property but cannot paint backdrop
    # blur even on a plain native control. Calibrate independently of our site.
    control=browser.new_page(viewport={'width':390,'height':150})
    control.set_content('''<style>body{margin:0;background:repeating-linear-gradient(90deg,#ea4053 0 4px,#2c5deb 4px 8px)}div{margin:10px;width:300px;height:100px;background:#ffffff40;-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}</style><div></div>''')
    native=Image.open(BytesIO(control.screenshot())).convert('RGB')
    native_edges=abs(native.getpixel((150,50))[0]-native.getpixel((154,50))[0])
    paints_blur=native_edges<10
    control.close()
    for w,h in [(320,568),(390,844),(844,390),(1440,900)]:
        page=browser.new_page(viewport={'width':w,'height':h},has_touch=w<851,is_mobile=w<851,reduced_motion='reduce')
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.route('**/releases/latest',lambda r:r.fulfill(json={}))
        page.goto(BASE,wait_until='networkidle')
        assert page.locator('.top').evaluate('e=>e.inert')
        for selector,tone in [('.cinema-hero','dark'),('#features','light'),('#workspace','light'),('#mobile','light'),('#license','dark'),('#faq','light')]:
            page.locator(selector).evaluate('e=>scrollTo(0,e.offsetTop+(e.classList.contains("cinema-hero")?30:0))')
            page.wait_for_function('(tone)=>document.querySelector(".top").dataset.surface===tone',arg=tone)
            assert page.locator('.top-inner').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
        page.locator('#features').evaluate('e=>scrollTo(0,e.offsetTop)')
        page.wait_for_function('document.querySelector(".top").dataset.surface==="light"')
        page.screenshot(path=str(OUT/f'navigation-{w}.png'))
        page.add_style_tag(content='.top-inner > * {visibility:hidden !important}')
        page.evaluate('''()=>{const probe=document.createElement('div');probe.id='glass-probe';probe.style.cssText='position:fixed;inset:0 0 auto;height:100px;z-index:19;pointer-events:none';document.body.append(probe)}''')
        box=page.locator('.top-inner').bounding_box()
        x=round(box['x']+box['width']/2);y=round(box['y']+box['height']/2)
        def capture(background,tone='light',blur=True):
            page.evaluate('''({background,tone,blur})=>{document.getElementById('glass-probe').style.background=background;const nav=document.querySelector('.top-inner');document.querySelector('.top').dataset.surface=tone;nav.style.setProperty('backdrop-filter',blur?'':'none','important');nav.style.setProperty('-webkit-backdrop-filter',blur?'':'none','important')}''',dict(background=background,tone=tone,blur=blur))
            return Image.open(BytesIO(page.screenshot())).convert('RGB')
        red=capture('#e12c35').getpixel((x,y));blue=capture('#1c4ed8').getpixel((x,y))
        transmission=sum(abs(a-b) for a,b in zip(red,blue))
        assert transmission>70,('Backdrop must really show through the capsule',transmission,red,blue)
        stripes='repeating-linear-gradient(90deg,#ea4053 0px 4px,#2c5deb 4px 8px)'
        filtered=capture(stripes);raw=capture(stripes,blur=False)
        crop=(x-50,y-5,x+50,y+5)
        def stripe_difference(image):
            patch=image.crop(crop).getchannel('R')
            return ImageStat.Stat(ImageChops.difference(patch.crop((0,0,96,10)),patch.crop((4,0,100,10)))).mean[0]
        filtered_edges=stripe_difference(filtered);raw_edges=stripe_difference(raw)
        assert raw_edges>20,('Probe must expose real detail behind the pane',raw_edges)
        if paints_blur:
            assert filtered_edges<raw_edges*.25,('Backdrop blur must soften actual page detail',filtered_edges,raw_edges)
        ratios=[]
        for tone in ['light','dark']:
            for background in ['#000','#fff']:
                sample=capture(background,tone=tone).getpixel((x,y))
                ink=page.locator('.top-inner').evaluate('e=>getComputedStyle(e).color')
                rgb=tuple(int(v.strip()) for v in ink.removeprefix('rgb(').removesuffix(')').split(','))
                ratio=contrast(sample,rgb);ratios.append(ratio)
                assert ratio>=4.5,('Navigation must remain readable over photos',tone,background,sample,rgb,ratio)
        assert not errors,errors
        print(json.dumps({'browser':BROWSER,'viewport':[w,h],'sectionTone':'pass','backdropColorDifference':transmission,'backdropBlur':'pixel-verified' if paints_blur else 'renderer cannot paint blur on native control either','blurredStripeDifference':round(filtered_edges,2),'unfilteredStripeDifference':round(raw_edges,2),'minimumTextContrast':round(min(ratios),2),'errors':errors}),flush=True)
        page.close()
    # No observer still leaves the visible navigation readable and operable.
    fallback=browser.new_page(viewport={'width':390,'height':844},reduced_motion='reduce')
    fallback.add_init_script('window.IntersectionObserver=undefined')
    fallback.route('**/releases/latest',lambda r:r.fulfill(json={}))
    fallback.goto(BASE,wait_until='networkidle')
    fallback.locator('#features').evaluate('e=>scrollTo(0,e.offsetTop)')
    fallback.wait_for_function('!document.querySelector(".top").inert')
    fallback.locator('#menu-toggle').click()
    assert fallback.locator('#menu-toggle').get_attribute('aria-expanded')=='true'
    fallback.keyboard.press('Escape')
    assert fallback.locator('#menu-toggle').get_attribute('aria-expanded')=='false'
    browser.close()
