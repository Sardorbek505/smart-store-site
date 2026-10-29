"""Released sales UI against one isolated demo sale. No customer data or database.

Build with build.cjs first. Record cash checkout, a stock change and the resulting
revenue. Screenshots and video show the same transaction; printing is not mocked.
"""
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from playwright.sync_api import sync_playwright
import threading,shutil,os,json,re
HARNESS=Path(os.environ.get('DEMO_RENDER_DIR','/workspace/scratch/sale-proof-render'))
OUT=Path(os.environ.get('SALE_CAPTURE_DIR','/workspace/scratch/sale-proof-capture'));OUT.mkdir(parents=True,exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(HARNESS)))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  c=b.new_context(viewport={'width':1280,'height':640},device_scale_factor=2,record_video_dir=str(OUT),record_video_size={'width':1280,'height':640},timezone_id='Asia/Almaty',reduced_motion='reduce')
  external=[];c.route('https://**',lambda r:(external.append(r.request.url),r.abort()))
  page=c.new_page();errors=[];warnings=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:warnings.append(m.text) if m.type=='warning' else None)
  page.clock.set_fixed_time('2026-10-24T12:30:00Z')
  page.goto(f'http://127.0.0.1:{server.server_port}/?screen=sales&sale-tour=1',wait_until='networkidle')
  page.locator('input').first.blur();page.wait_for_timeout(500)
  before=page.evaluate('saleCaptureState()');assert before['today']['revenue']==39695000
  assert page.get_by_role('button',name=re.compile('^Оплатить')).is_enabled()
  page.screenshot(path=str(OUT/'cash-desktop.png'))
  cart=page.get_by_role('list',name='Позиции корзины').locator('..').locator('..')
  cart.screenshot(path=str(OUT/'cash-phone.png'))
  page.wait_for_timeout(1200)
  page.get_by_role('button',name=re.compile('^Оплатить')).click();page.wait_for_timeout(1200)
  page.get_by_role('button',name=re.compile('Провести продажу')).click()
  page.get_by_role('heading',name='Продажа № 18 проведена',exact=True).wait_for()
  page.wait_for_timeout(1600)
  dialog=page.get_by_role('dialog').locator('.sheet');box=dialog.bounding_box()
  page.screenshot(path=str(OUT/'receipt.png'),clip={**box,'width':min(box['width'],440),'height':min(box['height'],140)})
  page.get_by_role('button',name='Новая продажа',exact=True).click();page.wait_for_timeout(1000)
  card=page.get_by_test_id('sale-product-card').filter(has_text='Шуруповёрт 18 В').first
  name=card.get_by_text('Шуруповёрт 18 В',exact=True);box=card.bounding_box();title=name.bounding_box();stock=card.get_by_text(re.compile(r'ост\. 10 шт')).bounding_box()
  page.screenshot(path=str(OUT/'stock.png'),clip={'x':box['x']+8,'y':title['y']-5,'width':box['width']-16,'height':stock['y']+stock['height']-title['y']+11})
  assert '10' in card.inner_text(),card.inner_text()
  page.wait_for_timeout(1600)
  page.get_by_role('button',name='Главная',exact=True).click()
  page.get_by_role('heading',name='Главная',exact=True).wait_for();page.wait_for_timeout(1800)
  metric=page.get_by_text('Выручка',exact=True).first.locator('..')
  metric.screenshot(path=str(OUT/'report.png'))
  page.screenshot(path=str(OUT/'report-full.png'))
  after=page.evaluate('saleCaptureState()');calls=page.evaluate('demoTourCalls')
  assert after['today']['revenue']==47925000 and after['today']['profit']==18578000
  assert after['today']['receiptCount']==18 and after['completed']['total']==8230000
  assert after['stock'][0]['stockQty']==10000 and after['stock'][1]['stockQty']==239000
  assert calls.count('sales.complete')==1 and not errors and not external,(errors,external)
  page.wait_for_timeout(2400)
  meta={'appVersion':'1.30.0','sourceRef':'ee421dc','before':before,'after':after,'calls':calls,'requestsOutsideHarness':external,'errors':errors,'warnings':warnings,'printer':'none','database':'in-memory demonstration fixture'}
  (OUT/'capture.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2))
  video=page.video;c.close();video.save_as(str(OUT/'sale-tour.webm'));b.close()
  print(json.dumps({'total':82300,'drillStockBefore':12,'drillStockAfter':10,'revenueBefore':396950,'revenueAfter':479250,'errors':errors,'warnings':warnings}),flush=True)
finally:server.shutdown();server.server_close()
