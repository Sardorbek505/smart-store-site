"""Illustrated capability cards, native swiping and opt-in real UI recording."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import os,shutil,json
BASE=os.environ.get('SITE_TEST_URL','http://127.0.0.1:4202')
ENGINE=os.environ.get('BROWSER','chromium')
OUT=Path('test-results');OUT.mkdir(exist_ok=True)
meta=json.loads(Path('tools/demo/sale-proof-assets.json').read_text())
assert meta['saleTotal']==82300 and meta['drillStockBefore']==12 and meta['drillStockAfter']==10
assert meta['revenueAfter']-meta['revenueBefore']==meta['saleTotal'] and meta['callsComplete']==1 and meta['productionRequests']==0
with sync_playwright() as p:
 opts={'headless':True}
 if ENGINE=='chromium':opts.update(executable_path=shutil.which('chromium'),args=['--no-sandbox','--enable-unsafe-swiftshader'])
 b=getattr(p,ENGINE).launch(**opts)
 for w,h in [(320,568),(440,956),(768,1024),(1440,900)]:
  c=b.new_context(viewport={'width':w,'height':h},is_mobile=w<1100,has_touch=w<1100,reduced_motion='no-preference');c.route('https://**',lambda r:r.fulfill(status=204))
  if ENGINE=='chromium' and w==320:c.route('**/media/smart-store-sale-v99.mp4',lambda r:r.fulfill(status=404))
  page=c.new_page();errors=[];media=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:media.append(r.url) if '/media/' in r.url else None)
  page.goto(BASE+'/#features',wait_until='networkidle');page.locator('#features').evaluate('e=>e.scrollIntoView({block:"start",behavior:"instant"})')
  assert page.locator('.sale-proof-screen,.sale-proof-steps,.feature-controls').count()==0
  assert 'Продажи. Склад. Контроль.' in page.locator('#features-title').inner_text()
  assert page.locator('.feature-card').count()==3
  assert not media,media
  for image in page.locator('.feature-illustration img').all():
   image.evaluate('i=>{i.loading="eager";return i.decode()}')
  assert page.locator('#feature-sale .feature-value').inner_text()=='82 300 ₸'
  assert page.locator('#feature-stock .feature-value .feature-after').inner_text()=='10'
  assert page.locator('#feature-reports .feature-value .feature-after').inner_text()=='479 250 ₸'
  if w<=850:
   y=page.evaluate('scrollY');page.locator('.feature-switcher a').nth(1).click()
   page.wait_for_function('()=>document.querySelectorAll(".feature-switcher a")[1].getAttribute("aria-current")==="true"')
   page.wait_for_timeout(550)
   assert abs(page.evaluate('scrollY')-y)<2,'Switching cards must not jump the page'
   deck=page.locator('.feature-deck');deck.evaluate('e=>e.focus({preventScroll:true})');page.keyboard.press('End')
   page.wait_for_function('()=>document.querySelectorAll(".feature-switcher a")[2].getAttribute("aria-current")==="true"')
   page.wait_for_timeout(550);assert abs(page.evaluate('scrollY')-y)<2
   page.keyboard.press('Home');page.wait_for_timeout(600)
   # Native scroll gestures work without the selector controls too.
   deck.evaluate('e=>e.scrollTo({left:e.scrollWidth,behavior:"instant"})');page.wait_for_timeout(200)
   assert page.locator('.feature-switcher a').nth(2).get_attribute('aria-current')=='true'
   deck.evaluate('e=>e.scrollTo({left:0,behavior:"instant"})');page.wait_for_timeout(200)
  else:
   assert page.locator('.feature-deck').evaluate('e=>e.scrollWidth<=e.clientWidth+2')
  page.locator('.feature-screen-link').first.click();page.wait_for_function('()=>document.getElementById("preview-dialog").open&&!document.getElementById("preview-image").hidden')
  assert page.locator('#preview-original').get_attribute('href').endswith('/img/demo-sale.png')
  page.keyboard.press('Escape');page.wait_for_function('()=>!document.getElementById("preview-dialog").open')
  page.locator('#features').evaluate('e=>e.scrollIntoView({block:"start",behavior:"instant"})')
  if w in [440,1440]:
   page.emulate_media(reduced_motion='reduce');page.wait_for_timeout(80)
   page.screenshot(path=str(OUT/f'feature-cards-{ENGINE}-{w}.png'))
   page.locator('#features').screenshot(path=str(OUT/f'feature-cards-section-{ENGINE}-{w}.png'))
   page.emulate_media(reduced_motion='no-preference')
  page.locator('[data-sale-tour]').scroll_into_view_if_needed();page.wait_for_timeout(100);position=page.evaluate('scrollY')
  page.locator('[data-sale-tour]').click();page.wait_for_function('()=>document.getElementById("sale-tour").open')
  page.wait_for_function('()=>{const v=document.getElementById("sale-tour-video");return v.readyState>=2&&v.videoWidth>0}')
  video=page.locator('#sale-tour-video');assert 12<video.evaluate('v=>v.duration')<18
  if ENGINE=='chromium' and w==320:assert video.evaluate('v=>v.currentSrc.endsWith(".webm")')
  video.evaluate('v=>v.play()');before=video.evaluate('v=>v.currentTime');page.wait_for_timeout(450);assert video.evaluate('v=>v.currentTime')>before
  assert video.evaluate('v=>v.textTracks.length')==1
  assert 'демоданных' in page.locator('#sale-tour-note').inner_text()
  page.keyboard.press('Escape');page.wait_for_function('()=>!document.getElementById("sale-tour").open&&location.hash!=="#sale-tour"')
  assert video.evaluate('v=>v.paused')
  page.wait_for_function('()=>document.activeElement===document.querySelector("[data-sale-tour]")')
  assert abs(page.evaluate('scrollY')-position)<2
  page.locator('[data-sale-tour]').click();page.wait_for_function('()=>document.getElementById("sale-tour").open');page.go_back();page.wait_for_function('()=>!document.getElementById("sale-tour").open')
  assert video.evaluate('v=>v.paused')
  assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
  assert not errors,errors
  print(json.dumps({'browser':ENGINE,'viewport':[w,h],'sale':'consistent','cards':'three illustrated capabilities','screens':'loaded and zoomable','video':'lazy, decodes, Escape/Back pause','errors':errors}),flush=True);c.close()
 # Decorations may fail; the content and real UI links must still work.
 c=b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,reduced_motion='reduce');c.route('https://**',lambda r:r.fulfill(status=204));c.route('**/img/feature-*-v100.webp',lambda r:r.abort())
 page=c.new_page();page.goto(BASE+'/#features',wait_until='networkidle')
 assert page.locator('.feature-card').count()==3
 assert page.locator('#feature-sale .feature-value').inner_text()=='82 300 ₸'
 c.close()
 c=b.new_context(viewport={'width':390,'height':844},java_script_enabled=False);page=c.new_page();page.goto(BASE+'/#features')
 assert page.locator('.feature-card').count()==3 and page.locator('[data-sale-tour]').get_attribute('href').endswith('.mp4')
 c.close();b.close()
