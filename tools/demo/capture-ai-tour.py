"""Record released UI components against prepared, isolated demo responses.

No Gemini call, customer data or production database is used. Build the harness
with the released application checkout before running this script.
"""
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from playwright.sync_api import sync_playwright
import threading,shutil,os,json,time
ROOT=Path(__file__).resolve().parents[2]
HARNESS=Path(os.environ.get('DEMO_RENDER_DIR','/workspace/scratch/ai-tour-render'))
OUT=Path(os.environ.get('TOUR_CAPTURE_DIR','/workspace/scratch/ai-tour-capture'));OUT.mkdir(parents=True,exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(HARNESS)))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  context=browser.new_context(viewport={'width':1280,'height':800},record_video_dir=str(OUT),record_video_size={'width':1280,'height':800},timezone_id='Asia/Almaty',reduced_motion='reduce')
  external=[];context.route('https://**',lambda r:(external.append(r.request.url),r.abort()))
  page=context.new_page();errors=[];warnings=[]
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:warnings.append(m.text) if m.type=='warning' else None)
  page.clock.set_fixed_time('2026-10-24T12:30:00Z')
  page.goto(f'http://127.0.0.1:{server.server_port}/?screen=assistant&tour=1',wait_until='networkidle')
  page.locator('textarea').blur()
  def hold(ms):page.wait_for_timeout(ms)
  def click(name):
   target=page.get_by_role('button',name=name,exact=True);target.hover();hold(250);target.click()
  hold(1400)
  click('Накладная из фото');hold(1500)
  click('Выбрать фото накладной');hold(3200)
  assert page.get_by_role('button',name='Создать черновик прихода',exact=True).is_enabled()
  page.screenshot(path=str(OUT/'invoice.png'))
  click('Создать черновик прихода');page.get_by_role('heading',name='Приход — черновик',exact=True).wait_for();hold(2800)
  page.screenshot(path=str(OUT/'draft.png'))
  click('Провести приход');hold(2300);click('Да, провести')
  page.get_by_role('heading',name='Приход № 14 — проведён',exact=True).wait_for();hold(2600)
  page.screenshot(path=str(OUT/'posted.png'))
  click('Готово');page.get_by_role('heading',name='Товары',exact=True).wait_for();hold(2400)
  page.screenshot(path=str(OUT/'products.png'))
  assert page.evaluate('window.demoTourCalls.filter(x=>x==="purchases.post").length')==1
  click('Помощник');page.get_by_label('Спросить своими словами').press_sequentially('Что происходит с магазином?',delay=45)
  hold(600);click('Спросить');page.locator('.ask-answer').wait_for();hold(4300)
  assert '396 950' in page.locator('.ask-answer').inner_text()
  page.screenshot(path=str(OUT/'assistant.png'))
  calls=page.evaluate('window.demoTourCalls');assert all(x in calls for x in ['ai.readInvoice','ai.invoiceToDraft','purchases.post','ai.ask'])
  assert not errors and not external,(errors,external)
  metadata={'appVersion':'1.30.0','sourceRef':'ee421dc','preparedAI':True,'productionRequests':0,'database':'in-memory fixture only','calls':calls,'pageErrors':errors,'warnings':warnings}
  (OUT/'capture.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2))
  video=page.video;context.close();video.save_as(str(OUT/'program-tour.webm'));browser.close()
  print(json.dumps(metadata,ensure_ascii=False),flush=True)
finally:server.shutdown();server.server_close()
