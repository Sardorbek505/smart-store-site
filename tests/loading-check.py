"""Loading budgets and failure isolation. Remote calls are stubbed; nothing is sent."""
from playwright.sync_api import sync_playwright
from pathlib import Path
from urllib.parse import urlparse
from PIL import Image
import json,os,shutil
BASE=os.environ.get('SITE_TEST_URL','http://127.0.0.1:4173').rstrip('/')
BROWSER=os.environ.get('BROWSER','chromium')
PHONE='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
WIN='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36'
INSTALLER='https://github.com/Sardorbek505/smart-store-releases/releases/download/v1.29.4/SmartStore-Setup-1.29.4-x64.exe'
RELEASE={'tag_name':'v1.29.4','assets':[{'name':'SmartStore-Setup-1.29.4-x64.exe','size':167772160,'browser_download_url':INSTALLER}]}
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 args={'headless':True}
 if BROWSER=='chromium':args.update(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
 b=getattr(p,BROWSER).launch(**args)
 for w,h,dpr in [(320,568,3),(390,844,3),(430,932,3),(768,1024,2),(844,390,3),(1440,900,2)]:
  phone=w<1000
  c=b.new_context(viewport={'width':w,'height':h},device_scale_factor=dpr,has_touch=phone,is_mobile=phone,user_agent=PHONE if phone else WIN,reduced_motion='reduce')
  page=c.new_page();requests=[];errors=[]
  page.on('request',lambda r:requests.append(r.url));page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/releases/latest',lambda r:r.fulfill(json=RELEASE))
  page.goto(BASE,wait_until='networkidle')
  page.wait_for_function('!document.getElementById("copy-site").disabled')
  if not phone:page.wait_for_function('(url)=>document.getElementById("download").href===url',arg=INSTALLER)
  assert not any('/assets/demo.' in u for u in requests),'Demo resources must load only on its separate page'
  page.locator('.hero-gallery img').evaluate_all('xs=>Promise.all(xs.map(i=>i.decode()))')
  assert len(page.locator('link[rel="stylesheet"]').all())==1
  assert len([u for u in requests if urlparse(u).path.endswith('.css')])==1
  releases=[u for u in requests if '/releases/latest' in u]
  assert len(releases)==(0 if phone else 1),(w,releases)
  if not phone:assert page.locator('#download').get_attribute('href')==INSTALLER
  # Every selected file still covers the actual object-fit paint at device DPR.
  for image in page.locator('[data-gallery-card] img').all():
   fit=image.evaluate('''e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {src:e.currentSrc,w:r.width-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight),h:r.height-parseFloat(s.paddingTop)-parseFloat(s.paddingBottom)}}''')
   file=Path(urlparse(fit['src']).path).name
   iw,ih=Image.open(ROOT/'img'/file).size
   painted=min(fit['w'],fit['h']*iw/ih)
   assert iw+1>=painted*dpr,(w,file,iw,painted*dpr)
  if w==390:
   assert page.locator('[data-gallery-card] img').first.evaluate('e=>e.currentSrc').endswith('-768.webp')
  assert not errors,errors
  print(json.dumps({'browser':BROWSER,'viewport':[w,h],'dpr':dpr,'stylesheets':1,'releaseRequests':len(releases),'retinaCoverage':'pass'}),flush=True)
  c.close()
 # Before app enhancement, every CTA already reaches the platform-correct guide.
 for phone in [True,False]:
  c=b.new_context(viewport={'width':390 if phone else 1440,'height':844 if phone else 900},has_touch=phone,is_mobile=phone,user_agent=PHONE if phone else WIN,reduced_motion='reduce')
  held=c.new_page();held.route('**/app.js*',lambda r:r.fulfill(content_type='text/javascript',body='window.held=true;await new Promise(()=>{});'))
  held.goto(BASE,wait_until='networkidle');assert held.evaluate('window.held')
  held.locator('#download').click();assert held.locator('#installation').is_visible()
  assert held.locator('#handoff-tools' if phone else '#windows-install').is_visible()
  if phone:assert held.locator('#installation-url').input_value()=='metov.store/#installation'
  else:assert held.locator('#installation-download').get_attribute('href').endswith('/releases/latest')
  c.close()
 # A failed configuration module leaves the header, viewport, pictures and preview usable.
 c=b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,user_agent=PHONE,reduced_motion='reduce')
 page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/scripts/core.js*',lambda r:r.abort())
 page.goto(BASE,wait_until='networkidle')
 page.wait_for_function('document.body.classList.contains("viewport-ready")&&document.documentElement.classList.contains("js")&&document.querySelector(".gallery-stage").dataset.ready==="true"')
 assert page.locator('#store-submit').is_disabled()
 assert 'QR-код' in page.locator('#store-note').inner_text()
 page.locator('#download').click();assert page.locator('#handoff-tools').is_visible()
 page.locator('#product-screen-link').click();page.locator('#preview-image').wait_for(state='visible')
 assert page.locator('#preview-dialog').evaluate('e=>e.open')
 assert not errors,errors
 c.close()
 # A missing hero falls back to the real screenshot; missing scenery leaves native UI usable.
 c=b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,user_agent=PHONE,reduced_motion='reduce')
 page=c.new_page();failed=[];page.on('requestfailed',lambda r:failed.append(r.url));page.route('**/releases/latest',lambda r:r.fulfill(json=RELEASE))
 page.route('**/img/hero-demo-laptop-*.webp',lambda r:r.abort())
 page.route('**/img/micro-stock-*-v43.webp',lambda r:r.abort())
 page.goto(BASE,wait_until='networkidle')
 hero=page.locator('[data-gallery-card] img').first
 hero.evaluate('e=>e.decode()')
 assert hero.get_attribute('src')=='img/demo-sale.png' and hero.get_attribute('srcset') is None
 page.locator('.bento-stock .feature-art').scroll_into_view_if_needed()
 assert any('/img/micro-stock-' in u and '-v43.webp' in u for u in failed),failed
 assert page.locator('.bento-stock .micro-widget').is_visible()
 assert page.locator('.bento-stock .micro-after').first.inner_text()=='11'
 assert page.locator('.bento-stock .feature-screen-link').get_attribute('href')=='img/demo-products.png'
 page.locator('[data-gallery-card]').first.click()
 assert page.locator('#preview-original').get_attribute('href').endswith('/img/demo-sale.png')
 c.close()
 print(json.dumps({'browser':BROWSER,'beforeEnhancementGuide':'pass','coreFailureIsolation':'pass','generatedImageFallback':'pass'}),flush=True)
 b.close()
