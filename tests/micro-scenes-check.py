"""Visible demonstrations loop after a three-second result hold; lifecycle pauses it."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import os,shutil,json
BASE=os.environ.get('SITE_TEST_URL','http://127.0.0.1:4173').rstrip('/')
BROWSER=os.environ.get('BROWSER','chromium')
OUT=Path(os.environ.get('MICRO_ARTIFACTS','/tmp/smart-store-micro-scenes'))/BROWSER
OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 opts={'headless':True}
 if BROWSER=='chromium':opts.update(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
 b=getattr(p,BROWSER).launch(**opts)
 def context(**kw):
  c=b.new_context(**kw)
  for host in ['zavod.metov.store','connect.metov.store','api.github.com']:
   c.route('https://'+host+'/**',lambda r:r.fulfill(status=204))
  return c
 for w,h in [(320,568),(390,844),(768,1024),(844,390),(851,768),(1024,600),(1440,500),(1440,900)]:
  c=context(viewport={'width':w,'height':h},is_mobile=w<851,has_touch=w<851,reduced_motion='reduce')
  page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(BASE+'/#features',wait_until='networkidle');page.locator('#features').evaluate('e=>scrollTo(0,e.offsetTop)')
  assert page.locator('.micro-replay').count()==0
  for i,key in enumerate(['sale','stock','reports']):
   scene=page.locator('[data-micro='+key+']')
   scene.evaluate('e=>e.closest("article").scrollIntoView({block:"nearest",inline:"center",behavior:"instant"})')
   assert scene.locator('.micro-widget').evaluate('e=>{const r=e.getBoundingClientRect(),s=e.closest("figure").getBoundingClientRect();return r.left>=s.left-1&&r.right<=s.right+1&&r.top>=s.top-1&&r.bottom<=s.bottom+1&&e.scrollWidth<=e.clientWidth+1}'),(w,h,key)
   assert scene.locator('.micro-after').evaluate_all('xs=>xs.every(e=>getComputedStyle(e).opacity==="1")')
   assert scene.evaluate('e=>!e.getAnimations({subtree:true}).length&&!e.dataset.runs')
   scene.locator('xpath=ancestor::article').locator('[data-preview]').click()
   page.wait_for_function('()=>document.querySelector("#preview-dialog").open')
   assert page.locator('#preview-original').get_attribute('href').endswith(['demo-sale.png','demo-products.png','demo-home.png'][i])
   page.keyboard.press('Escape');page.wait_for_function('()=>!document.querySelector("#preview-dialog").open')
  assert page.locator('#features .screen-content').evaluate('e=>e.scrollHeight<=e.clientHeight+4'),(w,h,'section overflow')
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.locator('#features').evaluate('e=>scrollTo(0,e.offsetTop)')
  if w in [390,1440]:page.screenshot(path=str(OUT/f'features-{w}.png'))
  assert not errors,errors
  c.close();print(json.dumps({'browser':BROWSER,'viewport':[w,h],'widgetsAndPreviews':'pass','reducedMotion':'static','noReplayButtons':'pass'}),flush=True)
 for w,h in [(390,844),(1440,900)]:
  c=context(viewport={'width':w,'height':h},is_mobile=w<851,has_touch=w<851)
  page=c.new_page();page.goto(BASE,wait_until='networkidle');page.wait_for_timeout(350)
  assert page.locator('[data-micro]').evaluate_all('xs=>xs.every(e=>!e.dataset.runs&&!e.getAnimations({subtree:true}).length)')
  page.locator('#features').evaluate('e=>scrollTo(0,e.offsetTop)')
  scene=page.locator('[data-micro=sale]')
  page.wait_for_function('()=>document.querySelector("[data-micro=sale]").dataset.state==="running"')
  for phase in [.2,.35,.72]:
   scene.evaluate('(e,t)=>e.getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=a.effect.getTiming().duration*t})',phase)
   if phase==.2:assert float(scene.locator('.micro-scan').first.evaluate('e=>getComputedStyle(e).opacity'))>.99
   if phase==.35:assert float(scene.locator('.micro-middle').evaluate('e=>getComputedStyle(e).opacity'))>.99
   if phase==.72:assert float(scene.locator('.micro-total .micro-after').evaluate('e=>getComputedStyle(e).opacity'))>.99
  # Finish the real WAAPI timeline, then measure the independent result hold.
  scene.evaluate('e=>e.getAnimations({subtree:true}).forEach(a=>{a.currentTime=a.effect.getTiming().duration;a.play()})')
  page.wait_for_function('()=>document.querySelector("[data-micro=sale]").dataset.state==="waiting"')
  hold=page.evaluate('performance.now()');runs=int(scene.get_attribute('data-runs'))
  assert scene.evaluate('e=>!e.getAnimations({subtree:true}).length')
  page.wait_for_timeout(2450);assert int(scene.get_attribute('data-runs'))==runs
  page.wait_for_function('(n)=>Number(document.querySelector("[data-micro=sale]").dataset.runs)===n+1',arg=runs,timeout=2000)
  elapsed=page.evaluate('performance.now()')-hold
  assert 2850<elapsed<3800,elapsed
  # Holding the result behind a dialog preserves the remaining delay.
  scene.evaluate('e=>e.getAnimations({subtree:true}).forEach(a=>{a.currentTime=a.effect.getTiming().duration;a.play()})')
  page.wait_for_function('()=>document.querySelector("[data-micro=sale]").dataset.state==="waiting"')
  runs=int(scene.get_attribute('data-runs'));page.wait_for_timeout(900)
  page.locator('.enter-link').click();page.wait_for_timeout(3400)
  assert int(scene.get_attribute('data-runs'))==runs
  page.keyboard.press('Escape');page.wait_for_timeout(1200)
  assert int(scene.get_attribute('data-runs'))==runs
  page.wait_for_function('(n)=>Number(document.querySelector("[data-micro=sale]").dataset.runs)===n+1',arg=runs,timeout=2500)
  page.locator('#workspace').evaluate('e=>scrollTo(0,e.offsetTop)');page.wait_for_timeout(350)
  runs=int(scene.get_attribute('data-runs'));page.wait_for_timeout(3400)
  assert int(scene.get_attribute('data-runs'))==runs and scene.evaluate('e=>!e.getAnimations({subtree:true}).length')
  page.locator('#features').evaluate('e=>scrollTo(0,e.offsetTop)')
  page.wait_for_function('(n)=>Number(document.querySelector("[data-micro=sale]").dataset.runs)===n+1',arg=runs)
  page.emulate_media(reduced_motion='reduce');page.wait_for_timeout(3300)
  runs=int(scene.get_attribute('data-runs'));assert scene.evaluate('e=>!e.getAnimations({subtree:true}).length')
  page.wait_for_timeout(350);assert int(scene.get_attribute('data-runs'))==runs
  c.close();print(json.dumps({'browser':BROWSER,'viewport':[w,h],'arrival':'pass','threeSecondHoldMs':round(elapsed),'repeatedLoop':'pass','dialogPreservesHold':'pass','offscreenStops':'pass','reducedMotionStops':'pass'}),flush=True)
 b.close()
