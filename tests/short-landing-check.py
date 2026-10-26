"""Short landing, screenshot cards, on-demand login and browser-history behavior."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import os, shutil, json
BASE=os.environ.get('SITE_TEST_URL','http://127.0.0.1:4173').rstrip('/')
BROWSER=os.environ.get('BROWSER','chromium')
OUT=Path('/tmp/smart-store-short')/BROWSER;OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 opts={'headless':True}
 if BROWSER=='chromium':opts.update(executable_path=shutil.which('chromium'),args=['--no-sandbox','--enable-unsafe-swiftshader'])
 browser=getattr(p,BROWSER).launch(**opts)
 for w,h in [(320,568),(390,844),(844,390),(1440,900)]:
  page=browser.new_page(viewport={'width':w,'height':h},is_mobile=w<900,has_touch=w<900,reduced_motion='reduce')
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(BASE,wait_until='networkidle');page.wait_for_function('!document.getElementById("store-submit").disabled')
  sections=page.locator('main > .screen-section').evaluate_all('xs=>xs.filter(e=>e.getBoundingClientRect().height>0).map(e=>e.id||"hero")')
  assert sections==['hero','features','workspace','mobile','license','faq'],sections
  assert page.locator('a[href^="demo/"]').count()==0
  for name in ['features','workspace','mobile','license','faq']:
   section=page.locator('#'+name);section.evaluate('e=>scrollTo(0,e.offsetTop)')
   assert section.evaluate('e=>Math.abs(e.getBoundingClientRect().height-innerHeight)<1')
   assert section.locator('.screen-content').evaluate('e=>e.scrollHeight<=e.clientHeight+4&&e.scrollWidth<=e.clientWidth+1'),(w,name)
  assert page.locator('.faq-list details').count()==6
  for link,raw in zip(page.locator('.feature-screen-link').all(),['demo-sale.png','demo-products.png','demo-home.png']):
   link.scroll_into_view_if_needed();link.click()
   assert page.locator('#preview-dialog').evaluate('e=>e.open')
   assert page.locator('#preview-original').get_attribute('href').endswith(raw)
   page.locator('#preview-close').click()
  page.locator('#features').evaluate('e=>scrollTo(0,e.offsetTop)')
  previous=page.url;y=page.evaluate('scrollY');entry=page.locator('.enter-link');entry.click()
  page.wait_for_function('document.getElementById("store").open')
  assert page.url.endswith('#store')
  assert page.locator('#store-code').evaluate('e=>e===document.activeElement')
  box=page.locator('#store').bounding_box()
  assert box['x']>=0 and box['y']>=0 and box['x']+box['width']<=w and box['y']+box['height']<=h
  for i in range(8):
   page.keyboard.press('Tab');assert page.evaluate('document.activeElement===document.body||document.activeElement.closest("#store")!==null')
  page.keyboard.press('Escape');page.wait_for_url(previous)
  assert not page.locator('#store').evaluate('e=>e.open')
  assert entry.evaluate('e=>e===document.activeElement')
  assert abs(page.evaluate('scrollY')-y)<2
  entry.click();page.go_back();page.wait_for_function('!document.getElementById("store").open')
  page.go_forward();page.wait_for_function('document.getElementById("store").open')
  # Native close is queued. An old event must not undo a newer opening.
  page.locator('#store').evaluate('e=>{e.close();e.showModal()}')
  page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
  assert page.locator('#store').evaluate('e=>e.open') and page.url.endswith('#store')
  page.locator('#store-code').fill('https://evil.example/');page.locator('#store-submit').click()
  assert page.locator('#store-form').get_attribute('data-state')=='invalid'
  page.locator('#store-close').click();page.wait_for_function('!document.getElementById("store").open')
  page.wait_for_url(previous)
  # Closing must cancel a pending lookup before a late successful response.
  page.evaluate('''()=>{const fetch=window.fetch;window.fetch=(url,...args)=>String(url).includes('/lookup?')?new Promise(r=>window.resolveLookup=()=>r({ok:true,json:async()=>({found:true})})):fetch(url,...args)}''')
  entry.click();page.locator('#store-code').fill('synthetic-shop');page.locator('#store-submit').click()
  page.wait_for_function('document.getElementById("store-form").dataset.state==="checking"')
  page.locator('#store-close').click();page.wait_for_url(previous);page.evaluate('resolveLookup()');page.wait_for_timeout(200)
  assert page.url==previous and page.locator('#store-form').get_attribute('data-state')=='idle'
  if w==390:
   entry.click()
   page.evaluate('''()=>{Object.defineProperty(visualViewport,'height',{configurable:true,value:330});Object.defineProperty(visualViewport,'offsetTop',{configurable:true,value:90});visualViewport.dispatchEvent(new Event('resize'))}''')
   box=page.locator('#store').bounding_box();assert box['y']>=102 and box['y']+box['height']<=408
   assert page.locator('#store').get_attribute('class').find('has-keyboard')>=0
   page.evaluate("delete visualViewport.height;delete visualViewport.offsetTop;visualViewport.dispatchEvent(new Event('resize'))")
   page.locator('#store-close').click();page.wait_for_url(previous)
  # Native close affordance and the disclosure remain usable on the small screen.
  entry.click();page.locator('#store .store-help summary').click()
  page.screenshot(path=str(OUT/f'login-{w}.png'))
  page.mouse.click(1,1);page.wait_for_function('!document.getElementById("store").open')
  page.goto(BASE+'/#data',wait_until='networkidle')
  assert page.locator('#data').get_attribute('open') is not None
  text=page.locator('#data').inner_text();assert all(x in text for x in ['компьютере','2 часа','флешку'])
  page.goto(BASE+'/#start',wait_until='networkidle');page.wait_for_url('**/#installation')
  assert page.locator('#installation').is_visible()
  page.goto(BASE+'/demo/#sale',wait_until='networkidle');page.wait_for_url('**/#workspace')
  assert page.locator('#product-title').is_visible()
  assert not errors,errors
  print(json.dumps({'browser':BROWSER,'viewport':[w,h],'visibleScreens':6,'cardPreviews':'pass','loginFocusHistoryAndCancel':'pass','lateLookupAfterClose':'ignored','oldLinks':'redirected'}),flush=True)
  page.close()
 # The explanatory fallback remains reachable if the login module cannot load.
 failed=browser.new_page(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
 failed.route('**/scripts/store.js*',lambda r:r.abort());failed.goto(BASE+'/#store',wait_until='networkidle')
 failed.wait_for_function('document.getElementById("store").open');assert failed.locator('#store-submit').is_disabled()
 assert 'QR-код' in failed.locator('#store-note').inner_text();failed.locator('#store-close').click()
 assert not failed.locator('#store').evaluate('e=>e.open');failed.close()
 plain=browser.new_page(viewport={'width':390,'height':844},java_script_enabled=False)
 plain.goto(BASE+'/#store',wait_until='networkidle');assert plain.locator('#store').is_visible()
 assert plain.locator('#store-submit').is_disabled();assert 'QR-код' in plain.locator('#store noscript').inner_text();plain.close()
 # Real GPU rendering and finite feature animations pause behind the login.
 page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
 page.add_init_script('''(()=>{window.draws=0;for(const name of ['drawElements','drawArrays']){const draw=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...args){if(this.canvas?.id==='checkout-canvas')window.draws++;return draw.apply(this,args)}}})()''')
 page.goto(BASE+'/#workspace',wait_until='networkidle')
 page.wait_for_function('document.querySelector(".checkout-object").dataset.checkoutAmbient==="playing"',timeout=20000)
 page.locator('.enter-link').click();page.wait_for_function('document.querySelector(".checkout-object").dataset.checkoutAmbient!=="playing"')
 page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
 count=page.evaluate('draws');page.wait_for_timeout(200);assert page.evaluate('draws')==count
 page.keyboard.press('Escape');page.wait_for_function('(n)=>window.draws>n',arg=count)
 page.locator('[data-checkout-point="1"]').click();page.wait_for_function('document.querySelector(".checkout-object").dataset.checkoutMotion==="idle"')
 page.locator('.enter-link').click();page.keyboard.press('Escape')
 assert page.locator('.checkout-object').get_attribute('data-checkout-view')=='1'
 page.locator('#features').evaluate('e=>scrollTo(0,e.offsetTop)')
 page.wait_for_function('document.querySelector("[data-micro=sale]").dataset.state==="running"')
 page.locator('.enter-link').click();page.wait_for_function('document.querySelector("[data-micro=sale]").dataset.state==="paused"')
 print(json.dumps({'browser':BROWSER,'loginModuleFailure':'readable fallback','noJSLogin':'readable fallback','behindLogin3DDrawCalls':0,'cameraEscapeGuard':'pass','featureMotionPause':'pass'}),flush=True)
 browser.close()
