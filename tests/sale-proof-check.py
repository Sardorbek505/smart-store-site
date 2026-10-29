"""One coherent sale, no carousel, real-screen previews and opt-in recorded UI."""
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
  assert page.locator('.bento-grid,.feature-controls,[data-micro]').count()==0
  assert 'Продали товар.' in page.locator('#features-title').inner_text()
  assert not media,media
  page.wait_for_function('()=>{const i=document.querySelector(".sale-proof-poster");return i.complete&&i.naturalWidth>0}')
  for step in page.locator('.sale-step').all():
   step.scroll_into_view_if_needed();step.locator('img').evaluate('i=>i.decode()')
   assert step.is_visible()
  assert page.locator('.sale-step').count()==3
  assert page.locator('#features').evaluate('e=>e.getAnimations({subtree:true}).every(a=>a.effect.getTiming().iterations!==Infinity)')
  source=page.locator('.sale-proof-poster').evaluate('i=>i.currentSrc')
  assert ('sale-cash-phone-' in source)==(w<=620),source
  assert page.locator('.sale-proof-steps').evaluate('e=>e.scrollWidth<=e.clientWidth+2')
  page.locator('.feature-screen-link').click();page.wait_for_function('()=>document.getElementById("preview-dialog").open&&!document.getElementById("preview-image").hidden')
  assert page.locator('#preview-original').get_attribute('href').endswith('/img/demo-sale.png')
  page.keyboard.press('Escape');page.wait_for_function('()=>!document.getElementById("preview-dialog").open')
  page.locator('.sale-step-screen').nth(1).click();page.wait_for_function('()=>document.getElementById("preview-dialog").open&&!document.getElementById("preview-image").hidden')
  assert page.locator('#preview-original').get_attribute('href').endswith('sale-stock-v99.webp')
  page.keyboard.press('Escape');page.wait_for_function('()=>!document.getElementById("preview-dialog").open')
  if w in [440,1440]:
   page.locator('#features').evaluate('e=>e.scrollIntoView({block:"start",behavior:"instant"})');page.screenshot(path=str(OUT/f'sale-proof-{ENGINE}-{w}.png'))
   page.locator('#features').screenshot(path=str(OUT/f'sale-proof-section-{ENGINE}-{w}.png'))
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
  print(json.dumps({'browser':ENGINE,'viewport':[w,h],'sale':'consistent','proofSteps':'all in page flow','screens':'loaded and zoomable','video':'lazy, decodes, Escape/Back pause','errors':errors}),flush=True);c.close()
 c=b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,reduced_motion='reduce');c.route('https://**',lambda r:r.fulfill(status=204));c.route('**/img/sale-cash-*.webp',lambda r:r.abort())
 page=c.new_page();page.goto(BASE+'/#features',wait_until='networkidle')
 page.wait_for_function('()=>{const i=document.querySelector(".sale-proof-poster");return i.complete&&i.naturalWidth>0&&i.currentSrc.endsWith("demo-sale.png")}')
 assert page.locator('.sale-proof-poster').get_attribute('srcset') is None
 assert page.locator('.sale-proof-screen source').get_attribute('srcset') is None
 c.close()
 c=b.new_context(viewport={'width':390,'height':844},java_script_enabled=False);page=c.new_page();page.goto(BASE+'/#features')
 assert page.locator('.sale-step').count()==3 and page.locator('[data-sale-tour]').get_attribute('href').endswith('.mp4')
 c.close();b.close()
