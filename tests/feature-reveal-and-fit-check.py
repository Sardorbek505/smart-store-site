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
 for w,h in [(320,568),(390,844),(768,1024),(844,390),(851,601),(1440,900)]:
  c=context(viewport={'width':w,'height':h},is_mobile=w<851,has_touch=w<851,reduced_motion='reduce')
  page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(BASE+'/#for-stores',wait_until='networkidle')
  root=page.locator('#for-stores');cards=root.locator('article.fit-card')
  assert cards.count()==7 and root.locator('.fit-card:visible').count()==8
  assert root.locator('[role=tablist]').count()==0
  assert root.locator('[inert]').count()==0
  assert 'Для какого магазина?' in root.locator('h2').inner_text()
  for i,word in enumerate(['Продукты у дома','Одежда','Хозтовары','Канцтовары','Косметика','Зоотовары','Автотовары']):
   card=cards.nth(i)
   assert card.locator('h3').inner_text()==word
   assert card.locator('p').inner_text()
   image=card.locator('img');image.scroll_into_view_if_needed();image.evaluate('e=>e.decode()')
   assert image.evaluate(r'e=>e.complete&&e.naturalWidth>0&&/store-(grocery|clothing|hardware|stationery|beauty|pets|auto)-(450|900)-v73\.webp$/.test(e.currentSrc)'),(w,i,'photo did not load')
   assert image.get_attribute('alt').startswith('Иллюстрация:')
   assert card.evaluate('e=>e.scrollWidth<=e.clientWidth+1&&e.scrollHeight<=e.clientHeight+1'),(w,i,'card overflow')
   assert card.locator('h3').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
  assert root.locator('.fit-contact').get_attribute('href').startswith('https://wa.me/77066352006?text=')
  assert 'иллюстрации' in root.locator('.fit-image-note').inner_text()
  special=root.locator('.fit-special');assert special.get_attribute('open') is None
  summary=special.locator('summary');summary.focus();summary.press('Enter')
  assert special.get_attribute('open') is not None
  assert 'пока не поддерживаются' in special.inner_text()
  assert special.locator('a').evaluate('e=>e.getBoundingClientRect().height>=44')
  summary.press('Enter');assert special.get_attribute('open') is None
  assert '«Электроинструменты», Шымкент' in root.locator('.fit-proof').inner_text()
  assert root.evaluate('e=>e.getAnimations({subtree:true}).length')==0
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  root.screenshot(path=str(OUT/f'fit-{w}.png'))
  page.locator('.fit-next').click();page.wait_for_url('**/#workspace')
  assert not errors,errors
  c.close()
  print(json.dumps({'browser':BROWSER,'viewport':[w,h],'sevenFormatsVisibleAtOnce':'pass','recognizablePhotosAndLabels':'pass','nativePharmacyDisclosure':'pass','noOverflow':'pass'}),flush=True)
 # Every format and the special-scope disclosure work without JavaScript.
 c=context(viewport={'width':390,'height':844},java_script_enabled=False)
 page=c.new_page();page.goto(BASE+'/#for-stores',wait_until='networkidle')
 assert page.locator('#for-stores .fit-card:visible').count()==8
 page.locator('.fit-special summary').click()
 assert page.locator('.fit-special').get_attribute('open') is not None
 assert 'пока не поддерживаются' in page.locator('.fit-special').inner_text()
 assert page.locator('.fit-next').get_attribute('href')=='#workspace'
 c.close()
 print(json.dumps({'browser':BROWSER,'noJS':'all seven shop types and native disclosure readable'}),flush=True)
 b.close()
