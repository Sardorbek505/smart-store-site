"""Offer, phone-to-Windows handoff and readable source-screen previews."""
from playwright.sync_api import sync_playwright
from pathlib import Path
from urllib.parse import urlparse,parse_qs
import os,shutil,json
BASE=os.environ.get('SITE_TEST_URL','http://127.0.0.1:4173').rstrip('/')
BROWSER=os.environ.get('BROWSER','chromium')
WIN='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36'
PHONE='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
URL='https://metov.store/#installation'
INSTALLER='https://github.com/Sardorbek505/smart-store-releases/releases/download/v1.29.4/SmartStore-Setup-1.29.4-x64.exe'
RELEASE={'tag_name':'v1.29.4','assets':[{'name':'SmartStore-Setup-1.29.4-x64.exe','size':167772160,'browser_download_url':INSTALLER}]}
STUB='''Object.defineProperty(navigator,'clipboard',{value:{writeText:async(t)=>{if(window.copyFails)throw Error('denied');window.copied=t}}});
Object.defineProperty(navigator,'share',{value:async(t)=>{if(window.shareMode==='abort')throw new DOMException('cancel','AbortError');if(window.shareMode==='fail')throw Error('unavailable');window.shared=t}});'''
OUT=Path('/tmp/smart-store-journey')/BROWSER;OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 args={'headless':True}
 if BROWSER=='chromium':args.update(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
 b=getattr(p,BROWSER).launch(**args)
 for w,h in [(320,568),(390,844),(844,390),(1440,900)]:
  desktop=w>1000
  page=b.new_page(viewport={'width':w,'height':h},user_agent=WIN if desktop else PHONE,is_mobile=not desktop,has_touch=not desktop,reduced_motion='reduce')
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/releases/latest',lambda r:r.fulfill(json=RELEASE));page.add_init_script(STUB)
  page.goto(BASE+'/#installation',wait_until='networkidle')
  if desktop:
   assert page.locator('#windows-install').is_visible() and page.locator('#handoff-tools').is_hidden()
   assert page.locator('#installation-download').get_attribute('href')==INSTALLER
   assert '1.29.4' in page.locator('[data-release-note]').inner_text()
  else:
   assert page.locator('#handoff-tools').is_visible() and page.locator('#windows-install').is_hidden()
   assert page.locator('[data-download]').evaluate_all('xs=>xs.every(e=>e.getAttribute("href")==="#installation")')
   page.locator('#copy-site').click();page.wait_for_function('window.copied!==undefined')
   assert page.evaluate('window.copied')==URL
   assert 'https://'+page.locator('#installation-url').input_value()==URL
   page.locator('#share-site').click();page.wait_for_function('window.shared!==undefined')
   assert page.evaluate('window.shared.url')==URL
   page.evaluate('window.shareMode="abort"');page.locator('#share-site').click()
   page.wait_for_function('!document.querySelector("#share-site").disabled')
   assert page.locator('#copy-status').inner_text()==''
   page.evaluate('window.shareMode="fail"');page.locator('#share-site').click()
   page.wait_for_function('document.querySelector("#copy-status").textContent.includes("Не получилось")')
   page.evaluate('window.copyFails=true');page.locator('#copy-site').click()
   page.wait_for_function('document.querySelector("#copy-status").textContent.includes("вручную")')
   assert page.locator('#installation-url').evaluate('e=>e.selectionStart===0&&e.selectionEnd===e.value.length')
  for name in ['installation','features','start','license','faq']:
   page.locator('#'+name).evaluate('e=>scrollTo(0,e.offsetTop)')
   assert page.locator('#'+name+' .screen-content').evaluate('e=>e.scrollWidth<=e.clientWidth+1&&e.scrollHeight<=e.clientHeight+4'),(w,name)
  text=page.locator('.license-copy').inner_text()
  assert '14 дней бесплатно' in text and 'Лицензия на 1 компьютер' in text
  wa=page.locator('#license .secondary').get_attribute('href');assert urlparse(wa).hostname=='wa.me'
  message=parse_qs(urlparse(wa).query)['text'][0]
  assert 'один компьютер' in message and 'срок действия' in message and 'активации' in message
  assert 'WhatsApp' in page.locator('#license .secondary').inner_text()
  # Native screenshot details can be read and panned within the preview.
  page.locator('#product-screen-link').click();page.locator('#preview-image').evaluate('e=>e.decode()')
  page.wait_for_function('!document.querySelector("#preview-zoom").disabled')
  page.locator('#preview-zoom').click()
  assert page.locator('#preview-zoom').get_attribute('aria-pressed')=='true'
  assert page.locator('#preview-image').evaluate('e=>Math.abs(e.getBoundingClientRect().width-e.naturalWidth)<1')
  assert page.locator('#preview-stage').evaluate('e=>e.scrollWidth>e.clientWidth')
  page.locator('#preview-stage').evaluate('e=>e.scrollTo(100,100)')
  assert page.locator('#preview-stage').evaluate('e=>e.scrollLeft>0&&e.scrollTop>0')
  page.screenshot(path=str(OUT/f'zoom-{w}.png'))
  page.locator('#preview-zoom').click()
  assert page.locator('#preview-stage').evaluate('e=>e.scrollLeft===0&&e.scrollTop===0')
  page.keyboard.press('Escape')
  assert page.locator('#product-screen-link').evaluate('e=>document.activeElement===e')
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert not errors,errors
  for name in ['installation','start','license']:
   page.locator('#'+name).evaluate('e=>scrollTo(0,e.offsetTop)')
   page.screenshot(path=str(OUT/f'{name}-{w}.png'))
  print(json.dumps({'engine':BROWSER,'size':[w,h],'platform':'Windows' if desktop else 'phone','handoffAndInstaller':'pass','offerAndWhatsApp':'pass','previewZoomAndPan':'pass','viewportFit':'pass'}),flush=True)
  page.close()
 # Without system sharing, a visible primary copy action remains available.
 fallback=b.new_page(viewport={'width':390,'height':844},user_agent=PHONE,is_mobile=True,has_touch=True)
 fallback.add_init_script('Object.defineProperty(navigator,"share",{value:undefined});Object.defineProperty(navigator,"clipboard",{value:{writeText:async(t)=>window.copied=t}})')
 fallback.goto(BASE+'/#installation',wait_until='networkidle')
 assert 'Скопировать ссылку' in fallback.locator('#share-site').inner_text()
 fallback.locator('#share-site').click();fallback.wait_for_function('window.copied!==undefined');assert fallback.evaluate('window.copied')==URL
 # Release API failure still leaves the official release page on Windows.
 failed=b.new_page(viewport={'width':1440,'height':900},user_agent=WIN)
 failed.route('**/releases/latest',lambda r:r.fulfill(status=503,body='unavailable'))
 failed.goto(BASE+'/#installation',wait_until='networkidle')
 assert failed.locator('#installation-download').get_attribute('href').endswith('/releases/latest')
 assert 'официальный выпуск' in failed.locator('[data-release-note]').inner_text()
 failed.route('**/img/demo-sale.png',lambda r:r.abort());failed.locator('#product-screen-link').click()
 failed.wait_for_function('document.querySelector("#preview-status").textContent.includes("не загрузилось")')
 assert failed.locator('#preview-zoom').is_disabled()
 assert failed.locator('#preview-original').get_attribute('href').endswith('/img/demo-sale.png')
 # Device-specific controls are correct even before enhancement modules start.
 for ua,platform in [(WIN,'windows'),(PHONE,'handoff')]:
  held=b.new_page(viewport={'width':390,'height':844},user_agent=ua)
  held.route('**/app.js*',lambda r:r.fulfill(content_type='text/javascript',body='window.held=true;await new Promise(()=>{});'))
  held.goto(BASE+'/#installation',wait_until='commit');held.wait_for_function('window.held===true')
  assert held.locator('#windows-install').is_visible()==(platform=='windows')
  assert held.locator('#handoff-tools').is_visible()==(platform=='handoff')
  held.close()
 b.close()
