"""A visitor really sells, checks stock/reports, reloads, resets and recovers.

No application API, payments or messages are used. Requires Playwright + Pillow.
"""
from playwright.sync_api import sync_playwright
from pathlib import Path
from urllib.parse import urlparse
import os, shutil, json

BASE=os.environ.get('SITE_TEST_URL','http://127.0.0.1:4173').rstrip('/')
BROWSER=os.environ.get('BROWSER','chromium')
OUT=Path('/tmp/smart-store-demo-v35')/BROWSER;OUT.mkdir(parents=True,exist_ok=True)
def text(locator):return locator.inner_text().replace('\u00a0',' ').replace('\u202f',' ')
def nav(page,name):
 page.locator(f'a[data-route="{name}"]').click()
 page.wait_for_function('(name)=>document.body.dataset.route===name',arg=name)
def add(page,query):
 page.locator('#product-search').fill(query)
 page.locator('[data-action="add"]').first.click()
def cart(page,mobile):
 if mobile:page.locator('#cart-toggle').click()
 return page.locator('#cart-dialog' if mobile else '#receipt-panel')
def reset(page):
 page.locator('#reset-demo').click();page.locator('#confirm-reset').click()
 page.wait_for_function('document.body.dataset.route==="sale"')

with sync_playwright() as p:
 args={'headless':True}
 if BROWSER=='chromium':args.update(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
 b=getattr(p,BROWSER).launch(**args)
 for w,h in [(320,568),(390,844),(768,1024),(844,390),(1024,768),(1440,900)]:
  mobile=w<=900
  page=b.new_page(viewport={'width':w,'height':h},is_mobile=mobile,has_touch=mobile,reduced_motion='reduce')
  errors=[];requests=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('request',lambda r:requests.append(r.url))
  page.goto(BASE+'/demo/',wait_until='networkidle');page.locator('#demo-app').wait_for(state='visible')
  assert page.locator('.product-card').count()==10
  page.locator('#product-search').fill('нет-такого-товара')
  assert page.locator('.empty-search').is_visible()
  page.get_by_role('button',name='Сбросить поиск',exact=True).click()
  page.locator('#category-filter').select_option(label='Оснастка')
  assert page.locator('.product-card').count()==3
  page.locator('#category-filter').select_option('')
  add(page,'MK-DF333');add(page,'CR-D125')
  c=cart(page,mobile)
  assert '40 550 ₸' in text(c)
  c.locator('[data-action="add"][data-id="demo-0"]').click()
  assert '80 450 ₸' in text(c)
  c.locator('[data-action="minus"][data-id="demo-0"]').click()
  c.locator('[data-action="pay"]').click()
  assert text(page.locator('#payment-total'))=='40 550 ₸'
  page.get_by_role('button',name='Вернуться к чеку',exact=True).last.click()
  assert page.locator('#payment-dialog').is_hidden()
  assert '40 550 ₸' in text(c)
  c.locator('[data-action="pay"]').click()
  page.locator('#cash-given').fill('40000')
  page.locator('#confirm-payment').click()
  assert 'меньше' in text(page.locator('#payment-error'))
  assert page.locator('#cash-given').get_attribute('aria-invalid')=='true'
  assert page.locator('#payment-dialog').is_visible()
  page.locator('#cash-given').fill('50000')
  assert '9 450 ₸' in text(page.locator('#cash-change'))
  page.locator('#confirm-payment').click()
  page.locator('#result-dialog').wait_for(state='visible')
  assert '40 550 ₸' in text(page.locator('#result-content'))
  assert '9 450 ₸' in text(page.locator('#result-content'))
  assert '12 → 11 шт' in text(page.locator('#result-content'))
  assert '240 → 239 шт' in text(page.locator('#result-content'))
  page.screenshot(path=str(OUT/f'receipt-{w}.png'))
  page.locator('[data-result-route="stock"]').click()
  page.wait_for_function('document.body.dataset.route==="stock"')
  assert text(page.locator('[data-stock-product="demo-0"] [data-stock-qty]'))=='11 шт'
  assert text(page.locator('[data-stock-product="demo-1"] [data-stock-qty]'))=='239 шт'
  page.locator('#stock-search').fill('MK-DF333')
  assert page.locator('#inventory tbody tr').count()==1
  page.locator('#stock-search').fill('')
  page.locator('#stock-sort').select_option('low')
  assert page.locator('#inventory tbody tr').first.get_attribute('data-stock-product')=='demo-8'
  nav(page,'reports')
  assert text(page.locator('[data-metric="revenue"]'))=='437 500 ₸'
  assert text(page.locator('[data-metric="profit"]'))=='164 150 ₸'
  assert text(page.locator('[data-metric="received"]'))=='376 200 ₸'
  assert text(page.locator('[data-metric="receipts"]'))=='18'
  page.locator('[data-receipt="174"]').click();page.keyboard.press('Escape')
  assert page.locator('#result-dialog').is_hidden()
  assert page.locator('[data-receipt="174"]').evaluate('e=>document.activeElement===e')
  page.reload(wait_until='networkidle')
  assert text(page.locator('[data-metric="revenue"]'))=='437 500 ₸'
  assert text(page.locator('[data-metric="receipts"]'))=='18'
  page.locator('.chart-data summary').click()
  assert '437 500 ₸' in text(page.locator('.chart-data tbody tr').last)
  page.screenshot(path=str(OUT/f'reports-{w}.png'),full_page=True)
  nav(page,'sale');add(page,'MK-B8210')
  page.reload(wait_until='networkidle')
  c=cart(page,mobile);assert '1 850 ₸' in text(c)
  c.locator('[data-action="clear-cart"]').click()
  assert 'Первый товар' in text(c)
  if mobile:page.keyboard.press('Escape')
  nav(page,'reports');assert text(page.locator('[data-metric="receipts"]'))=='18'
  page.locator('#reset-demo').click();page.keyboard.press('Escape')
  assert text(page.locator('[data-metric="receipts"]'))=='18'
  reset(page)
  nav(page,'reports');assert text(page.locator('[data-metric="revenue"]'))=='396 950 ₸'
  nav(page,'stock');assert text(page.locator('[data-stock-product="demo-0"] [data-stock-qty]'))=='12 шт'
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),w
  assert all(urlparse(u).netloc==urlparse(BASE).netloc for u in requests),requests
  assert not errors,errors
  print(json.dumps({'browser':BROWSER,'viewport':[w,h],'cashSaleChange':'pass','stockAndReports':'pass','draftReload':'pass','cancelAndReset':'pass','externalRequests':0}),flush=True)
  page.close()
 # Kaspi, debt, stock exhaustion, no double submit, and independent tabs.
 shared=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
 page=shared.new_page()
 page.goto(BASE+'/demo/#sale',wait_until='networkidle');add(page,'CR-D125')
 c=cart(page,True);c.locator('[data-action="pay"]').click()
 page.get_by_label('Kaspi',exact=True).check();page.locator('#confirm-payment').click()
 page.locator('[data-result-route="reports"]').click()
 assert text(page.locator('[data-payment="kaspi"]'))=='142 000 ₸'
 assert text(page.locator('[data-payment="cash"]'))=='194 300 ₸'
 nav(page,'sale');add(page,'CR-D125');c=cart(page,True);c.locator('[data-action="pay"]').click()
 page.get_by_label('В долг',exact=True).check();page.locator('#debt-customer').select_option(label='Мастерская «Орбита»')
 page.locator('#confirm-payment').evaluate('e=>{e.click();e.click()}')
 assert 'Записали в долг' in text(page.locator('#result-title'))
 page.locator('[data-result-route="reports"]').click()
 assert text(page.locator('[data-metric="receipts"]'))=='19'
 assert text(page.locator('[data-metric="received"]'))=='336 300 ₸'
 assert text(page.locator('[data-metric="debt"]'))=='61 950 ₸'
 another=page.context.new_page();another.goto(BASE+'/demo/#reports',wait_until='networkidle')
 assert text(another.locator('[data-metric="receipts"]'))=='17'
 another.close();page.close();shared.close()
 # Session storage denial does not block checkout.
 blocked=b.new_page(viewport={'width':1440,'height':900})
 blocked.add_init_script('Object.defineProperty(window,"sessionStorage",{get(){throw new DOMException("denied","SecurityError")}})')
 blocked.goto(BASE+'/demo/',wait_until='networkidle')
 assert blocked.locator('#storage-note').is_visible()
 add(blocked,'MK-DF333');blocked.locator('#open-payment-desktop').click();blocked.locator('#confirm-payment').click()
 assert blocked.locator('#result-dialog').is_visible();blocked.close()
 # Corrupted persistence recovers to the coherent baseline.
 bad=b.new_page();bad.add_init_script('sessionStorage.setItem("smart-store:public-demo:v1", "not json")')
 bad.goto(BASE+'/demo/',wait_until='networkidle')
 assert bad.locator('#demo-app').is_visible() and 'Начали' in text(bad.locator('#demo-notice'));bad.close()
 # Generated product photos are optional; failed script/no-JS have honest fallback.
 failed=b.new_page();failed.route('**/img/demo/products/*.webp',lambda r:r.abort())
 failed.goto(BASE+'/demo/',wait_until='networkidle');add(failed,'MK-DF333')
 failed.wait_for_function('Array.from(document.querySelectorAll(".product-photo")).every(e=>e.hidden)');failed.close()
 boot=b.new_page();boot.route('**/assets/demo.*.js',lambda r:r.abort())
 boot.goto(BASE+'/demo/',wait_until='networkidle')
 assert 'не загрузилось' in text(boot.locator('#boot-label'))
 assert boot.locator('#demo-boot a').is_visible()
 assert boot.locator('#reset-demo').is_disabled();boot.close()
 plain=b.new_page(java_script_enabled=False);plain.goto(BASE+'/demo/')
 assert 'включите JavaScript' in plain.locator('main').inner_text()
 plain.close()
 print(json.dumps({'browser':BROWSER,'kaspiDebtDoubleSubmit':'pass','tabIsolation':'pass','storageAndImageFailures':'pass','noJSOrBundleFallback':'pass'}),flush=True)
 b.close()
