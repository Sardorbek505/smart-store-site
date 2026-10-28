"""A flat arrival screen becomes solids; shop categories are immediately recognizable.

Service traffic is replaced with fixtures. Photos are real generated assets.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,os,shutil
BASE=os.environ.get('SITE_TEST_URL','http://127.0.0.1:4173').rstrip('/')
BROWSER=os.environ.get('BROWSER','chromium')
OUT=Path(os.environ.get('REVEAL_ARTIFACTS','/tmp/smart-store-reveal-fit'))/BROWSER
OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 opts={'headless':True}
 if BROWSER=='chromium':opts.update(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
 b=getattr(p,BROWSER).launch(**opts)
 def context(**options):
  c=b.new_context(**options)
  for host in ['zavod.metov.store','connect.metov.store','api.github.com']:
   c.route('https://'+host+'/**',lambda r:r.fulfill(status=204))
  return c
 # Inspect the real camera matrix at rest and halfway through its arrival.
 c=context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,reduced_motion='no-preference')
 c.add_init_script("Object.defineProperty(document,'hidden',{configurable:true,value:true})")
 page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(BASE,wait_until='networkidle')
 page.wait_for_function('()=>document.querySelector("#features").dataset.featureShape==="flat"')
 assert page.locator('#features').get_attribute('data-feature-shape')=='flat'
 camera=page.locator('.feature-solid-assembly');cover=page.locator('.feature-flat-cover');stage=page.locator('.bento-grid')
 matrix=lambda:camera.evaluate('e=>{const m=new DOMMatrix(getComputedStyle(e).transform);return [m.m13,m.m23,m.m31,m.m32]}')
 assert all(abs(x)<.0001 for x in matrix()),matrix()
 assert cover.is_visible()
 assert stage.evaluate('e=>e.getAnimations({subtree:true}).length')==0
 page.locator('#features').evaluate('e=>scrollTo(0,e.offsetTop)')
 page.wait_for_timeout(350)
 assert page.locator('#features').get_attribute('data-feature-shape')=='flat'
 page.evaluate("delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))")
 page.wait_for_function('()=>document.querySelector("#features").dataset.featureShape==="opening"')
 stage.evaluate('e=>e.getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=a.effect.getTiming().duration*.4})')
 half=matrix();assert any(.005<abs(x)<.205 for x in half),half
 page.screenshot(path=str(OUT/'opening-phone.png'))
 page.locator('.enter-link').click()
 stage.evaluate('e=>Promise.all(e.getAnimations({subtree:true}).map(a=>a.ready))')
 times=stage.evaluate('e=>e.getAnimations({subtree:true}).map(a=>a.currentTime)');page.wait_for_timeout(200)
 assert len(times)>=4
 assert stage.evaluate('e=>e.getAnimations({subtree:true}).every(a=>a.playState==="paused")')
 assert all(abs(a-z)<1 for a,z in zip(times,stage.evaluate('e=>e.getAnimations({subtree:true}).map(a=>a.currentTime)')))
 page.keyboard.press('Escape')
 page.wait_for_function('()=>document.querySelector("#features").dataset.featureShape==="volume"')
 assert cover.is_hidden()
 assert any(abs(x)>.15 for x in matrix()),matrix()
 assert page.locator('[data-micro=sale]').get_attribute('data-runs') in [None,'1']
 assert not errors,errors
 c.close()
 print(json.dumps({'browser':BROWSER,'singleFlatScreenBeforeArrival':'pass','interpolatedCamera':'pass','openingPausesBehindDialog':'pass','closedVolumesAfterArrival':'pass'}),flush=True)
 # The audience starts itself; no manual shop-selection controls remain.
 for w,h in [(320,568),(390,844),(768,1024),(844,390),(851,601),(1440,900)]:
  c=context(viewport={'width':w,'height':h},reduced_motion='reduce',is_mobile=w<851,has_touch=w<851)
  page=c.new_page();page.goto(BASE+'/#for-stores',wait_until='networkidle')
  stage=page.locator('.fit-solid-scene');stage.evaluate('e=>scrollTo(0,e.getBoundingClientRect().top+scrollY-100)')
  page.wait_for_function('()=>document.querySelector("#for-stores").dataset.fitShape==="volume"')
  assert page.locator('.fit-solid-face').count()==12
  assert page.locator('.fit-current').count()==0
  img=page.locator('.fit-body-photo img')
  assert img.evaluate(r'e=>/store-.*-(768|1536)-v76\.webp$/.test(e.currentSrc)')
  if h>=500:assert img.bounding_box()['width']>stage.bounding_box()['width']*.38
  assert stage.evaluate('e=>e.getBoundingClientRect().width')>w*.8
  assert page.locator('#fit-kind,[data-fit-prev],[data-fit-next]').count()==0
  assert page.locator('[data-fit-auto]').is_disabled()
  assert stage.evaluate('e=>e.getAnimations({subtree:true}).length')==0
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  c.close();print(json.dumps({'browser':BROWSER,'size':[w,h],'automaticUI':'pass','reducedMotion':'static'}),flush=True)
 c=context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
 c.add_init_script("Object.defineProperty(document,'hidden',{configurable:true,value:true})")
 page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(BASE+'/#for-stores',wait_until='networkidle')
 page.wait_for_function('()=>document.querySelector("#for-stores").dataset.fitShape==="flat"')
 stage=page.locator('.fit-solid-scene');stage.evaluate('e=>scrollTo(0,e.getBoundingClientRect().top+scrollY-100)')
 assert stage.evaluate('e=>e.getAnimations({subtree:true}).length')==0
 page.evaluate("delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))")
 page.wait_for_function('()=>document.querySelector("#for-stores").dataset.fitShape==="opening"')
 page.locator('.enter-link').click();page.wait_for_timeout(150)
 assert stage.evaluate('e=>e.getAnimations({subtree:true}).length===4&&e.getAnimations({subtree:true}).every(a=>a.playState==="paused")')
 page.keyboard.press('Escape');page.wait_for_function('()=>document.querySelector("#for-stores").dataset.fitShape==="volume"')
 for i,name in enumerate(['Продукты у дома','Одежда','Хозтовары','Канцтовары','Косметика','Зоотовары','Автотовары']):
  page.wait_for_function('(i)=>document.querySelector("#for-stores").dataset.fitIndex===String(i)&&document.querySelector(".fit-solid-scene").getAttribute("aria-busy")==="false"',arg=i,timeout=12000)
  assert page.locator('.fit-face-title:visible').inner_text().replace('\n',' ')==name
  assert page.locator('.fit-body-photo img').evaluate('e=>e.complete&&e.naturalWidth>0')
 page.locator('[data-fit-auto]').click();selected=page.locator('#for-stores').get_attribute('data-fit-index')
 page.wait_for_timeout(4600);assert page.locator('#for-stores').get_attribute('data-fit-index')==selected
 page.locator('[data-fit-auto]').click()
 page.wait_for_function('()=>document.querySelector("#for-stores").dataset.fitIndex==="0"',timeout=12000)
 assert page.locator('[data-fit-auto]').evaluate('e=>e===document.activeElement')
 page.evaluate('scrollTo(0,0)');page.wait_for_timeout(4500)
 assert page.locator('#for-stores').get_attribute('data-fit-index')=='0'
 assert not errors,errors
 c.close();print(json.dumps({'browser':BROWSER,'allSevenCycleWithoutInput':'pass','pauseResumeWithFocus':'pass','arrivalModalAndOffscreen':'pass'}),flush=True)
 for mode in ['no-js','blocked-module']:
  c=context(viewport={'width':390,'height':844},java_script_enabled=mode!='no-js')
  if mode=='blocked-module':c.route('**/scripts/store-fit.js*',lambda r:r.abort())
  page=c.new_page();page.goto(BASE+'/#for-stores',wait_until='networkidle')
  assert page.locator('#for-stores article.fit-card:visible').count()==7
  assert page.locator('.fit-object-controls').is_hidden()
  c.close()
 print(json.dumps({'browser':BROWSER,'fallback':'seven native cards'}),flush=True)
 b.close()
