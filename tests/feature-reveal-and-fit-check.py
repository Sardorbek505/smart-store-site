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
 # The audience follows the same physical reference, with seven photo/label pairs.
 for w,h in [(320,568),(390,844),(768,1024),(844,390),(851,601),(1440,900)]:
  c=context(viewport={'width':w,'height':h},reduced_motion='reduce',is_mobile=w<851,has_touch=w<851)
  page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(BASE+'/#for-stores',wait_until='networkidle')
  stage=page.locator('.fit-solid-scene');stage.evaluate('e=>scrollTo(0,e.getBoundingClientRect().top+scrollY-100)')
  page.wait_for_function('()=>document.querySelector("#for-stores").dataset.fitShape==="volume"')
  assert page.locator('.fit-solid-body').count()==2 and page.locator('.fit-solid-face').count()==12
  for i,word in enumerate(['Продукты у дома','Одежда','Хозтовары','Канцтовары','Косметика','Зоотовары','Автотовары']):
   page.locator('#fit-kind').select_option(str(i))
   page.wait_for_function('(i)=>document.querySelector("#for-stores").dataset.fitIndex===String(i)&&document.querySelector(".fit-solid-scene").getAttribute("aria-busy")==="false"',arg=i)
   assert page.locator('.fit-face-title:visible').count()==1
   assert page.locator('.fit-face-title:visible').inner_text().replace('\n',' ')==word
   img=page.locator('.fit-body-photo img');assert img.count()==1
   assert img.evaluate('e=>e.complete&&e.naturalWidth>0')
   assert page.locator('.fit-face-copy:visible').evaluate('e=>e.scrollWidth<=e.clientWidth+1&&e.scrollHeight<=e.clientHeight+1')
   assert page.locator('.fit-solid-scene').evaluate('e=>e.getAnimations({subtree:true}).length')==0
  if w==390:
   for _ in range(14):
    page.locator('[data-fit-prev]').click()
    page.wait_for_function('()=>document.querySelector(".fit-solid-scene").getAttribute("aria-busy")==="false"')
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert page.locator('[data-fit-auto]').is_disabled()
  page.locator('.fit-special summary').click();assert 'пока не поддерживаются' in page.locator('.fit-special').inner_text()
  assert '«Электроинструменты», Шымкент' in page.locator('.fit-proof').inner_text()
  assert not errors,errors
  c.close();print(json.dumps({'browser':BROWSER,'size':[w,h],'sevenSolidPhotoPairs':'pass','negativeRotations':'pass','reducedMotion':'static'}),flush=True)
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
 page.locator('#fit-kind').focus();page.locator('#fit-kind').select_option('3')
 page.wait_for_function('()=>document.querySelector(".fit-solid-scene").getAnimations({subtree:true}).length===2')
 directions=stage.evaluate('e=>e.getAnimations({subtree:true}).map(a=>a.effect.getKeyframes().map(k=>k.transform))')
 assert '-90deg' in str(directions) and '90deg' in str(directions),directions
 page.locator('#fit-kind').select_option('6');page.locator('#fit-kind').select_option('1')
 page.wait_for_function('()=>document.querySelector("#for-stores").dataset.fitIndex==="1"&&document.querySelector(".fit-solid-scene").getAttribute("aria-busy")==="false"')
 assert page.locator('#fit-kind').evaluate('e=>e===document.activeElement')
 assert page.locator('[data-fit-count]').inner_text()=='02 / 07'
 assert page.locator('.fit-benefit').inner_text()=='Продажи и возвраты'
 page.locator('[data-fit-auto]').click()
 page.wait_for_function('()=>document.querySelector("#for-stores").dataset.fitIndex==="2"',timeout=12000)
 page.locator('.fit-solid-scene').evaluate('e=>scrollTo(0,0)');page.wait_for_timeout(300)
 assert stage.evaluate('e=>e.getAnimations({subtree:true}).every(a=>a.playState==="paused")')
 assert not errors,errors
 c.close();print(json.dumps({'browser':BROWSER,'flatArrival':'pass','oppositeRotations':'pass','modalPause':'pass','queuedSelectionAndFocus':'pass','autoAndOffscreenPause':'pass'}),flush=True)
 for mode in ['no-js','blocked-module']:
  c=context(viewport={'width':390,'height':844},java_script_enabled=mode!='no-js')
  if mode=='blocked-module':c.route('**/scripts/store-fit.js*',lambda r:r.abort())
  page=c.new_page();page.goto(BASE+'/#for-stores',wait_until='networkidle')
  assert page.locator('#for-stores article.fit-card:visible').count()==7
  assert page.locator('.fit-object-controls').is_hidden()
  c.close()
 print(json.dumps({'browser':BROWSER,'fallback':'seven native cards'}),flush=True)
 b.close()
