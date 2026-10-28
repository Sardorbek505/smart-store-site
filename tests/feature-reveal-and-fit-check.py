"""A flat arrival screen becomes solids; the shop window stays readable and usable.

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
 for w,h in [(320,568),(390,844),(768,1024),(844,390),(851,601),(1440,900)]:
  c=context(viewport={'width':w,'height':h},is_mobile=w<851,has_touch=w<851,reduced_motion='reduce')
  page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(BASE+'/#for-stores',wait_until='networkidle')
  page.wait_for_function('()=>document.querySelector("#for-stores").classList.contains("fit-ready")')
  root=page.locator('#for-stores');original_height=root.evaluate('e=>e.offsetHeight')
  for i,word in enumerate(['Продукты','вещь','ассортимент','Обсудим']):
   page.locator('[data-fit-select]').nth(i).click()
   panel=page.locator('.fit-card[data-fit-active=true]')
   assert panel.count()==1
   assert word in panel.locator('h3').inner_text()
   assert page.locator('[data-fit-panel][inert]').count()==3
   assert page.locator('[role=tab][aria-selected=true]').count()==1
   assert panel.get_attribute('aria-hidden')=='false'
   panel.locator('img').evaluate('e=>e.decode().catch(()=>{})')
   assert panel.locator('img').evaluate(r'e=>e.complete&&e.naturalWidth>0&&/shop-((grocery|clothing|pharmacy)-(600|1200)-v72|hardware-(600|1200)-v71)\.webp$/.test(e.currentSrc)'),(w,i,'image did not load')
   assert panel.evaluate('e=>e.scrollWidth<=e.clientWidth+1&&e.scrollHeight<=e.clientHeight+1'),(w,i,'card overflow')
   assert panel.locator('h3').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
   assert root.evaluate('e=>e.offsetHeight')==original_height,(w,'selection shifted page height')
   assert root.evaluate('e=>e.getAnimations({subtree:true}).length')==0
  assert 'пока не поддерживаются' in root.locator('#fit-pharmacy').inner_text()
  assert root.locator('#fit-pharmacy .fit-scope-note a').get_attribute('href').startswith('https://wa.me/77066352006?text=')
  assert root.locator('#fit-pharmacy li').count()==0
  assert '«Электроинструменты», Шымкент' in root.locator('.fit-proof').inner_text()
  assert all('иллюстрация' in t for t in root.locator('figcaption').all_text_contents())
  tabs=page.locator('[data-fit-select]');tabs.last.focus();page.keyboard.press('ArrowRight')
  assert root.get_attribute('data-fit-index')=='0' and tabs.first.evaluate('e=>e===document.activeElement')
  page.keyboard.press('End');assert root.get_attribute('data-fit-index')=='3'
  for button in tabs.all():assert button.evaluate('e=>e.getBoundingClientRect().height>=44')
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  root.screenshot(path=str(OUT/f'fit-{w}.png'))
  page.locator('.fit-next').click();page.wait_for_url('**/#workspace')
  assert not errors,errors
  c.close()
  print(json.dumps({'browser':BROWSER,'viewport':[w,h],'fourShopFormatsAndPhotos':'pass','stableHeightAndKeyboard':'pass','realDeploymentText':'pass','reducedMotion':'static'}),flush=True)
 # Interrupt an actual turn: keep the latest requested type and stop hidden work.
 c=context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,reduced_motion='no-preference')
 page=c.new_page();page.goto(BASE+'/#for-stores',wait_until='networkidle')
 page.locator('[data-fit-select="1"]').click()
 page.wait_for_function('()=>document.querySelector(".fit-stage").getAttribute("aria-busy")==="true"')
 page.locator('[data-fit-select="2"]').click()
 page.wait_for_function('()=>document.querySelector("#for-stores").dataset.fitIndex==="2"&&document.querySelector(".fit-stage").getAttribute("aria-busy")==="false"')
 page.locator('[data-fit-select="0"]').click()
 page.emulate_media(reduced_motion='reduce')
 page.wait_for_function('()=>document.querySelector(".fit-stage").getAnimations({subtree:true}).length===0')
 assert page.locator('#for-stores').get_attribute('data-fit-index')=='0'
 c.close()
 for mode in ['no-js','blocked-fit-module']:
  c=context(viewport={'width':390,'height':844},java_script_enabled=mode!='no-js')
  if mode=='blocked-fit-module':c.route('**/scripts/store-fit.js*',lambda r:r.abort())
  page=c.new_page();page.goto(BASE+'/#for-stores',wait_until='networkidle')
  assert page.locator('.fit-card:visible').count()==4
  assert page.locator('.fit-tabs').is_hidden()
  assert page.locator('.fit-next').get_attribute('href')=='#workspace'
  c.close()
 print(json.dumps({'browser':BROWSER,'rapidChoiceAndReducedMotion':'pass','noJSAndBlockedModule':'readable native cards'}),flush=True)
 b.close()
