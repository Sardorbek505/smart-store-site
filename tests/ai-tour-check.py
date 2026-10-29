"""The recording is lazy, playable, keyboard accessible and stops on dismissal."""
from playwright.sync_api import sync_playwright
import os,shutil,json
BASE=os.environ.get('SITE_TEST_URL','http://127.0.0.1:4173')
ENGINE=os.environ.get('BROWSER','chromium')
with sync_playwright() as p:
 opts={'headless':True}
 if ENGINE=='chromium':opts.update(executable_path=shutil.which('chromium'),args=['--no-sandbox','--enable-unsafe-swiftshader'])
 browser=getattr(p,ENGINE).launch(**opts)
 for width in [390,1440]:
  c=browser.new_context(viewport={'width':width,'height':900},reduced_motion='reduce')
  c.route('https://**',lambda r:r.fulfill(status=204))
  # A real source failure must fall back to the other supported format.
  if ENGINE=='chromium' and width==390:
   c.route('**/media/*.mp4',lambda r:r.fulfill(status=404))
  page=c.new_page();errors=[];media=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('request',lambda r:media.append(r.url) if '/media/' in r.url else None)
  page.goto(BASE,wait_until='networkidle')
  page.locator('[data-tour]').scroll_into_view_if_needed()
  page.wait_for_timeout(150)
  assert not media,media
  page.locator('[data-tour]').click()
  page.wait_for_function('()=>document.getElementById("ai-tour").open')
  page.wait_for_function('()=>{const v=document.getElementById("tour-video");return v.readyState>=2&&v.videoWidth>0}')
  if ENGINE=='chromium' and width==390:assert page.locator('#tour-video').evaluate('(v)=>v.currentSrc.endsWith(".webm")')
  page.locator('#tour-video').evaluate('(v)=>v.play()')
  start=page.locator('#tour-video').evaluate('(v)=>v.currentTime')
  page.wait_for_timeout(900)
  assert page.locator('#tour-video').evaluate('(v)=>v.currentTime')>start
  assert page.locator('#tour-video').evaluate("""v=>{const c=document.createElement('canvas');c.width=128;c.height=80;const x=c.getContext('2d');x.drawImage(v,0,0,128,80);const d=x.getImageData(0,0,128,80).data;let low=255,high=0;for(let i=0;i<d.length;i+=4){low=Math.min(low,d[i]);high=Math.max(high,d[i]);}return high-low>50;}""")
  assert 'подготовлены' in page.locator('#tour-note').inner_text()
  assert page.locator('#tour-video').evaluate('(v)=>v.textTracks.length')==1
  page.keyboard.press('Escape')
  page.wait_for_function('()=>!document.getElementById("ai-tour").open&&location.hash!=="#ai-tour"')
  assert page.locator('#tour-video').evaluate('(v)=>v.paused')
  assert page.locator('[data-tour]').evaluate('(e)=>document.activeElement===e')
  page.locator('[data-tour]').click()
  page.wait_for_function('()=>document.getElementById("ai-tour").open')
  page.go_back()
  page.wait_for_function('()=>!document.getElementById("ai-tour").open')
  assert page.locator('#tour-video').evaluate('(v)=>v.paused')
  assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
  assert not errors,errors
  print(json.dumps({'browser':ENGINE,'width':width,'beforeIntentMediaRequests':0,'decodeAndPlay':'pass','escapeAndBack':'pause and dismiss','pageErrors':errors}),flush=True)
  c.close()
 c=browser.new_context(java_script_enabled=False,viewport={'width':390,'height':900})
 page=c.new_page();page.goto(BASE)
 assert page.locator('[data-tour]').get_attribute('href').endswith('.mp4')
 c.close();browser.close()
