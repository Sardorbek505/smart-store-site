"""First-paint regression. Requires Playwright, browser binaries and Pillow."""
from playwright.sync_api import sync_playwright
from pathlib import Path
from PIL import Image, ImageChops
from io import BytesIO
import os,shutil,json
BASE=os.environ.get('SITE_TEST_URL','http://127.0.0.1:4173').rstrip('/')
BROWSER=os.environ.get('BROWSER','chromium')
OUT=Path(os.environ.get('FIRST_PAINT_OUTPUT','/tmp/smart-store-first-paint'))/BROWSER
OUT.mkdir(parents=True,exist_ok=True)
BOOT='window.__bootWaiting=true;await new Promise(r=>window.addEventListener("release-app",r,{once:true}));\n'
SNAP='''()=>({hero:document.querySelector('.cinema-hero').getBoundingClientRect().toJSON(),copy:document.querySelector('.cinema-copy').getBoundingClientRect().toJSON(),bottom:document.querySelector('.gallery-bottom').getBoundingClientRect().toJSON(),label:document.getElementById('download-label').textContent,features:document.getElementById('features').offsetTop,cards:Array.from(document.querySelectorAll('[data-gallery-card]'),e=>({hidden:e.hidden,clip:getComputedStyle(e).clipPath,transform:getComputedStyle(e).transform,rect:e.getBoundingClientRect().toJSON()}))})'''
with sync_playwright() as p:
 args={'headless':True}
 if BROWSER=='chromium':args.update(executable_path=os.environ.get('CHROMIUM_BINARY') or shutil.which('chromium'),args=['--no-sandbox'])
 b=getattr(p,BROWSER).launch(**args)
 for w,h in [(390,844),(1440,900),(320,568),(844,390)]:
  c=b.new_context(viewport={'width':w,'height':h},has_touch=w<851,is_mobile=w<851,reduced_motion='reduce')
  page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/app.js*',lambda r:r.fulfill(status=200,content_type='text/javascript',body=BOOT+Path('app.js').read_text()))
  page.route('**/releases/latest',lambda r:r.fulfill(json={}))
  page.goto(BASE,wait_until='commit')
  page.wait_for_function('window.__bootWaiting===true')
  page.locator('.hero-gallery img').evaluate_all('(xs)=>Promise.all(xs.map(i=>i.decode()))')
  page.evaluate('async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))}')
  before=page.evaluate(SNAP)
  assert all(x['transform']=='none' for x in before['cards']),before
  assert 'hero-ribbon-clip' in page.locator('.ribbon-window').evaluate('e=>getComputedStyle(e).clipPath')
  first=page.locator('.cinema-hero').screenshot()
  (OUT/f'before-{w}.png').write_bytes(first)
  page.evaluate('window.dispatchEvent(new Event("release-app"))')
  page.wait_for_function('document.body.classList.contains("viewport-ready")&&document.querySelector(".gallery-stage").dataset.ready==="true"&&!document.getElementById("store-submit").disabled')
  page.wait_for_load_state('networkidle')
  after=page.evaluate(SNAP)
  assert before==after,{'browser':BROWSER,'size':[w,h],'before':before,'after':after}
  second=page.locator('.cinema-hero').screenshot()
  (OUT/f'after-{w}.png').write_bytes(second)
  a=Image.open(BytesIO(first)).convert('RGB');z=Image.open(BytesIO(second)).convert('RGB')
  diff=ImageChops.difference(a,z)
  changed=sum(1 for rgb in getattr(diff,"get_flattened_data",diff.getdata)() if rgb!=(0,0,0))
  assert changed/(a.width*a.height)<.001,{'changed':changed,'size':a.size}
  assert not errors,errors
  print(json.dumps({'browser':BROWSER,'viewport':[w,h],'layoutChanges':0,'changedPixels':changed}),flush=True)
  c.close()
 b.close()
