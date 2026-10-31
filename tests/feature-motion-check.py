"""Capability animation freezes outside view/dialogs and respects reduced motion."""
from playwright.sync_api import sync_playwright
import os, shutil, json
BASE=os.environ.get('SITE_TEST_URL','http://127.0.0.1:4203')
ENGINE=os.environ.get('BROWSER','chromium')
with sync_playwright() as p:
 opts={'headless':True}
 if ENGINE=='chromium':opts.update(executable_path=shutil.which('chromium'),args=['--no-sandbox','--enable-unsafe-swiftshader'])
 b=getattr(p,ENGINE).launch(**opts)
 for width in [390,1440]:
  c=b.new_context(viewport={'width':width,'height':1000},is_mobile=width<600,has_touch=width<600,reduced_motion='no-preference');c.route('https://**',lambda r:r.fulfill(status=204))
  page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(BASE,wait_until='networkidle')
  scene=page.locator('[data-feature-scene="sale"]')
  scene.evaluate('e=>e.scrollIntoView({block:"center",inline:"nearest",behavior:"instant"})')
  page.wait_for_function('()=>document.querySelector("[data-feature-scene=sale]").getAnimations({subtree:true}).some(a=>a.playState==="running")')
  a=scene.evaluate('e=>e.getAnimations({subtree:true})[0].currentTime');page.wait_for_timeout(200)
  assert scene.evaluate('e=>e.getAnimations({subtree:true})[0].currentTime')>a
  # A product enters the basket before its price updates; payment follows.
  scene.evaluate('e=>e.getAnimations({subtree:true}).forEach(a=>a.currentTime=620)');page.wait_for_timeout(40)
  assert scene.locator('[data-feature-enter]').evaluate('e=>parseFloat(getComputedStyle(e).opacity)')>.99
  assert scene.locator('.feature-value .feature-before').evaluate('e=>parseFloat(getComputedStyle(e).opacity)')>.99
  scene.evaluate('e=>e.getAnimations({subtree:true}).forEach(a=>a.currentTime=1150)');page.wait_for_timeout(40)
  assert scene.locator('.feature-value .feature-after').evaluate('e=>parseFloat(getComputedStyle(e).opacity)')>.99
  assert scene.locator('.feature-state .feature-before').evaluate('e=>parseFloat(getComputedStyle(e).opacity)')>.99
  # The result remains readable for more than three seconds per cycle.
  scene.evaluate('e=>e.getAnimations({subtree:true}).forEach(a=>a.currentTime=4000)');page.wait_for_timeout(50)
  assert scene.locator('.feature-state .feature-after').evaluate('e=>parseFloat(getComputedStyle(e).opacity)')>.99
  y=page.evaluate('scrollY');page.wait_for_timeout(350)
  assert abs(page.evaluate('scrollY')-y)<1,'Motion cannot shift the page'
  page.locator('#preview-dialog').evaluate('e=>e.showModal()')
  page.wait_for_function('()=>document.querySelector("[data-feature-scene=sale]").getAnimations({subtree:true}).every(a=>a.playState==="paused"&&!a.pending)')
  t=scene.evaluate('e=>e.getAnimations({subtree:true})[0].currentTime');page.wait_for_timeout(150)
  assert scene.evaluate('e=>e.getAnimations({subtree:true})[0].currentTime')==t
  page.keyboard.press('Escape')
  page.wait_for_function('()=>document.querySelector("[data-feature-scene=sale]").getAnimations({subtree:true}).some(a=>a.playState==="running")')
  page.locator('#assistant').evaluate('e=>e.scrollIntoView({block:"start",behavior:"instant"})')
  page.wait_for_function('()=>document.querySelector("[data-feature-scene=sale]").getAnimations({subtree:true}).every(a=>a.playState==="paused"&&!a.pending)')
  page.emulate_media(reduced_motion='reduce')
  page.wait_for_function('()=>document.querySelector("[data-feature-scene=sale]").getAnimations({subtree:true}).length===0')
  assert scene.locator('.feature-state .feature-after').evaluate('e=>getComputedStyle(e).opacity')=='1'
  assert scene.locator('.feature-result').evaluate('e=>{const s=getComputedStyle(e);return s.boxShadow==="none"&&parseFloat(s.borderTopWidth)===0}')
  assert not errors,errors
  print(json.dumps({'browser':ENGINE,'width':width,'motion':'visible only, stable page, dialog pause, reduced motion final values'}),flush=True)
  c.close()
 b.close()
