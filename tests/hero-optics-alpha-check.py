"""A uniform blue or pearl panel must not acquire bright alpha-mask arcs."""
from playwright.sync_api import sync_playwright
from PIL import Image,ImageChops,ImageStat
from pathlib import Path
from io import BytesIO
import os,shutil,json
which=os.environ.get('BROWSER','chromium');out=Path('/tmp/smart-store-alpha-v85')/which;out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 opts={'headless':True}
 if which=='chromium':opts.update(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
 b=getattr(p,which).launch(**opts)
 page=b.new_page(**p.devices['iPhone 13'])
 # Use the premultiplied compositor convention of the affected iOS view.
 page.add_init_script('''const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,options){return original.call(this,type,type==='webgl'?{...options,premultipliedAlpha:true}:options)}''')
 page.goto(os.environ.get('SITE_TEST_URL','http://127.0.0.1:4173'),wait_until='networkidle')
 page.wait_for_function('()=>document.querySelector(".ribbon-window").dataset.optics==="webgl"')
 page.locator('.hero-gallery').focus();page.wait_for_function('()=>{const a=document.querySelector(".ribbon-track").getAnimations()[0];return a.playState==="paused"&&!a.pending}')
 # Replace only this test's photo elements with a transparent data image. The
 # underlying HTML and uploaded atlas must then render the same uniform panel.
 image=BytesIO();Image.new('RGBA',(2,2)).save(image,format='PNG')
 import base64
 data='data:image/png;base64,'+base64.b64encode(image.getvalue()).decode()
 page.locator('.gallery-card img').evaluate_all('''(xs,data)=>Promise.all(xs.map(async i=>{i.removeAttribute('srcset');i.src=data;await i.decode()}))''',data)
 for color in ['#1d4ed8','#ededf5']:
  style=page.add_style_tag(content=f'.ribbon-window{{--ribbon-card-width:100cqw;--ribbon-gap:0px}}.gallery-card{{background:{color}!important}}.ribbon-refraction{{filter:none!important}}')
  page.evaluate('dispatchEvent(new Event("resize"))');page.wait_for_timeout(150)
  a=page.locator('.ribbon-window').screenshot();hide=page.add_style_tag(content='.ribbon-optics{visibility:hidden!important}')
  z=page.locator('.ribbon-window').screenshot();hide.evaluate('e=>e.remove()')
  a=Image.open(BytesIO(a)).convert('RGB');z=Image.open(BytesIO(z)).convert('RGB');diff=ImageChops.difference(a,z).crop((0,round(a.height*.2),a.width,round(a.height*.8)))
  m=max(ImageStat.Stat(diff).mean);print(color,m,flush=True);assert m<.3,(color,m,diff.getextrema())
  a.save(out/(color[1:]+'.png'));style.evaluate('e=>e.remove()')
 b.close()
