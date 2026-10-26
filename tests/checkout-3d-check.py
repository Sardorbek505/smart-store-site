"""Real WebGL camera motion, draw-on-demand, lifecycle, and complete poster fallback."""
from pathlib import Path
import os,json,shutil
from playwright.sync_api import sync_playwright
BASE=os.environ.get('SITE_TEST_URL','http://127.0.0.1:4173').rstrip('/')
BROWSER=os.environ.get('BROWSER','chromium')
OUT=Path('/tmp/smart-store-checkout-3d')/BROWSER;OUT.mkdir(parents=True,exist_ok=True)
INSTRUMENT='''(()=>{window.checkoutDraws=0;for(const name of ['drawElements','drawArrays']){const method=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...args){if(this.canvas?.id==='checkout-canvas')window.checkoutDraws++;return method.apply(this,args)}}})()'''
with sync_playwright() as p:
 args={'headless':True}
 if BROWSER=='chromium':args.update(executable_path=shutil.which('chromium'),args=['--no-sandbox','--enable-unsafe-swiftshader'])
 browser=getattr(p,BROWSER).launch(**args)
 def open_page(width=390,height=844,reduced='no-preference',init=None,block=None):
  page=browser.new_page(viewport={'width':width,'height':height},has_touch=width<851,is_mobile=width<851,reduced_motion=reduced)
  page.add_init_script(INSTRUMENT)
  if init:page.add_init_script(init)
  errors=[];requests=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url));page.route('**/releases/latest',lambda r:r.fulfill(json={}))
  if block:page.route(block,lambda r:r.abort())
  page.goto(BASE,wait_until='networkidle')
  page.wait_for_function('document.querySelector(".checkout-object").dataset.checkoutMotion==="idle"')
  return page,errors,requests
 def enter(page):page.locator('#workspace').evaluate('e=>scrollTo(0,e.offsetTop)')
 def ready(page):page.wait_for_function('document.querySelector(".checkout-object").dataset.checkoutRenderer==="webgl"',timeout=20000)
 def settled(page,view):page.wait_for_function('(v)=>{const e=document.querySelector(".checkout-object");return e.dataset.checkoutView===v&&e.dataset.checkoutMotion==="idle"}',arg=view,timeout=12000)
 def draws(page):return page.evaluate('window.checkoutDraws')
 def pause_settled(page):
  page.wait_for_function('document.querySelector(".checkout-object").dataset.checkoutMotion==="paused"')
  page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
  count=draws(page);page.wait_for_timeout(200);assert draws(page)==count,'Paused 3D must issue zero GL draw calls'
 for w,h in [(320,568),(390,844),(844,390),(851,768),(1440,900)]:
  page,errors,requests=open_page(w,h)
  assert not any('/assets/checkout3d.' in u for u in requests),'3D code must not load on the hero'
  enter(page);ready(page)
  count=draws(page);page.wait_for_timeout(220);assert draws(page)==count,'Idle overview must issue zero GL draw calls'
  overview=float(page.locator('#checkout-canvas').get_attribute('data-camera-distance'))
  page.screenshot(path=str(OUT/f'overview-{w}.png'))
  for view in ['0','1','2']:
   button=page.locator(f'[data-checkout-point="{view}"]');button.click()
   page.wait_for_function('document.querySelector(".checkout-object").dataset.checkoutMotion==="running"')
   settled(page,view)
   distance=float(page.locator('#checkout-canvas').get_attribute('data-camera-distance'));assert distance<overview*.5,(w,view,distance,overview)
   assert button.get_attribute('aria-pressed')=='true'
   assert page.locator('#checkout-return').is_visible()
   assert page.locator('#checkout-original').get_attribute('href').endswith('demo-payment.png' if view=='2' else 'demo-sale.png')
   count=draws(page);page.wait_for_timeout(180);assert draws(page)==count
   page.screenshot(path=str(OUT/f'focus-{view}-{w}.png'))
  assert not any('/img/checkout-'+v+'-v44.webp' in u for u in requests for v in ['0','1','2']),'A working renderer should not download fallback focus posters'
  page.locator('#checkout-return').click();settled(page,'overview')
  assert abs(float(page.locator('#checkout-canvas').get_attribute('data-camera-distance'))-overview)<.02
  assert page.locator('[data-checkout-point="0"]').evaluate('e=>e===document.activeElement')
  assert page.locator('#checkout-return').is_hidden()
  for button in page.locator('[data-checkout-point]').all():
   box=button.bounding_box();assert box['width']>=44 and box['height']>=44 and box['x']>=0 and box['x']+box['width']<=w
  assert page.locator('#workspace .screen-content').evaluate('e=>e.scrollHeight<=e.clientHeight+4'),(w,h,'section overflow')
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert not errors,errors
  print(json.dumps({'browser':BROWSER,'viewport':[w,h],'realWebGLAndThreeCloseViews':'pass','idleDrawCalls':0,'returnAndFocus':'pass','lazyEngine':'pass'}),flush=True);page.close()
 # Real animation interruption and resumption, including rapid requests.
 page,errors,requests=open_page();enter(page);ready(page)
 page.locator('[data-checkout-point="0"]').click();page.wait_for_timeout(120)
 page.locator('[data-checkout-point="2"]').click();page.wait_for_timeout(100)
 page.locator('[data-checkout-point="1"]').click();settled(page,'1')
 page.locator('[data-checkout-point="0"]').click();page.wait_for_timeout(100)
 page.evaluate('dispatchEvent(new PointerEvent("pointerdown",{pointerType:"touch"}))');pause_settled(page)
 enter(page);page.evaluate('dispatchEvent(new PointerEvent("pointerup",{pointerType:"touch"}))');settled(page,'0')
 page.locator('[data-checkout-point="2"]').click();page.wait_for_timeout(100)
 page.locator('#preview-dialog').evaluate('e=>e.showModal()');pause_settled(page)
 page.locator('#preview-dialog').evaluate('e=>e.close()');settled(page,'2')
 page.locator('[data-checkout-point="1"]').click();page.wait_for_timeout(100)
 page.locator('#data').evaluate('e=>scrollTo(0,e.offsetTop)');pause_settled(page)
 enter(page);settled(page,'1')
 page.locator('[data-checkout-point="0"]').click();page.wait_for_timeout(100)
 page.evaluate('Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"))');pause_settled(page)
 page.evaluate('delete document.hidden;document.dispatchEvent(new Event("visibilitychange"))');settled(page,'0')
 # Changing reduced motion cancels the camera animation and renders only its end.
 page.locator('[data-checkout-point="2"]').click();page.wait_for_timeout(100);page.emulate_media(reduced_motion='reduce');settled(page,'2')
 count=int(page.locator('#checkout-canvas').get_attribute('data-draws'));page.locator('[data-checkout-point="1"]').click();settled(page,'1')
 assert int(page.locator('#checkout-canvas').get_attribute('data-draws'))==count+1,'Reduced motion needs one frame, not an animation'
 page.locator('[data-checkout-point="1"]').focus();page.keyboard.press('Escape');settled(page,'overview')
 # Native source preview still uses the selected real screenshot.
 page.locator('[data-checkout-point="2"]').click();page.locator('#checkout-original').click();assert page.locator('#preview-dialog').evaluate('e=>e.open')
 assert page.locator('#preview-original').get_attribute('href').endswith('demo-payment.png');page.locator('#preview-close').click()
 # Exercise the actual GPU context-loss path and restoration.
 page.locator('#checkout-canvas').evaluate('c=>{window.checkoutLost=c.getContext("webgl2").getExtension("WEBGL_lose_context");checkoutLost.loseContext()}')
 page.wait_for_function('document.querySelector(".checkout-object").dataset.checkoutRenderer==="poster"')
 assert page.locator('#product-screen').get_attribute('src').endswith('checkout-2-v44.webp')
 page.evaluate('checkoutLost.restoreContext()');ready(page);assert page.locator('.checkout-object').get_attribute('data-checkout-view')=='2'
 assert not errors,errors
 print(json.dumps({'browser':BROWSER,'rapidSelection':'pass','touchOffscreenHiddenModalPause':'pass','reducedMotion':'one frame','sourcePreview':'pass','GPUContextRecovery':'pass'}),flush=True);page.close()
 # Missing GPU, engine or screenshot textures keep the exact rendered view posters usable.
 no_gpu='''(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind==='webgl2'?null:get.call(this,kind,...args)}})()'''
 for mode,init,block in [('no-gpu',no_gpu,None),('engine-error',None,'**/assets/checkout3d.*.js'),('texture-error',None,'**/img/demo-payment.png')]:
  page,errors,requests=open_page(init=init,block=block);enter(page);page.wait_for_timeout(650)
  if mode=='no-gpu':assert not any('/assets/checkout3d.' in u for u in requests)
  for view in ['0','1','2']:
   page.locator(f'[data-checkout-point="{view}"]').click()
   page.wait_for_function('(v)=>document.getElementById("product-screen").getAttribute("src").endsWith(`checkout-${v}-v44.webp`)',arg=view)
   page.wait_for_function('(v)=>{const i=document.getElementById("product-screen");return i.complete&&i.naturalWidth>0&&i.currentSrc.endsWith(`checkout-${v}-v44.webp`)}',arg=view)
   page.locator('#product-screen').evaluate('e=>e.decode()')
   assert page.locator('.checkout-object').get_attribute('data-checkout-renderer')=='poster'
  page.locator('#checkout-return').click();assert page.locator('.checkout-object').get_attribute('data-checkout-view')=='overview'
  assert not errors,errors
  print(json.dumps({'browser':BROWSER,'fallback':mode,'threeRenderedPostersAndReturn':'pass'}),flush=True);page.close()
 context=browser.new_context(java_script_enabled=False,viewport={'width':390,'height':844});page=context.new_page();page.goto(BASE);page.locator('#product-screen').scroll_into_view_if_needed()
 assert page.locator('#product-screen').get_attribute('src')=='img/checkout-overview-v44.webp'
 assert page.locator('[data-checkout-point]').first.is_disabled()
 page.locator('#product-screen-link').click();page.wait_for_url('**/img/demo-sale.png');context.close();browser.close()
