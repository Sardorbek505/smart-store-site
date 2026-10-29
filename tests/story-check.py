"""The compact phone benefit and transparent AI artwork stay useful without motion."""
from playwright.sync_api import sync_playwright
import os,shutil,json
BASE=os.environ.get('SITE_TEST_URL','http://127.0.0.1:4173')
ENGINE=os.environ.get('BROWSER','chromium')
with sync_playwright() as p:
 opts={'headless':True}
 if ENGINE=='chromium':opts.update(executable_path=shutil.which('chromium'),args=['--no-sandbox','--enable-unsafe-swiftshader'])
 b=getattr(p,ENGINE).launch(**opts)
 def context(**extra):
  c=b.new_context(**extra);c.route('https://**',lambda r:r.fulfill(status=204));return c
 for w,h in [(320,568),(390,844),(844,390),(768,1024),(1440,900)]:
  c=context(viewport={'width':w,'height':h},reduced_motion='no-preference')
  page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(BASE,wait_until='networkidle')
  page.locator('#mobile').scroll_into_view_if_needed()
  page.wait_for_function('()=>{const i=document.getElementById("phone-mockup");return i.complete&&i.naturalWidth>0}')
  assert page.locator('#mobile .mobile-reading,#mobile .demo-progress,#phone-demo-action,#mobile a[href="#store"]').count()==0
  assert page.locator('#mobile a').count()==1
  example=page.locator('#phone-example')
  assert example.inner_text()=='Посмотреть пример'
  assert example.bounding_box()['height']>=44
  example.click();page.wait_for_function('()=>document.getElementById("preview-dialog").open')
  page.wait_for_function('()=>{const i=document.getElementById("preview-image");return i.complete&&i.naturalWidth>0&&!i.hidden}')
  assert page.locator('#preview-image').get_attribute('src').endswith('demo-phone.png')
  page.keyboard.press('Escape');page.wait_for_function('()=>!document.getElementById("preview-dialog").open')
  assert page.locator('#phone-example').evaluate('(e)=>document.activeElement===e')
  page.locator('[data-assistant-scene]').scroll_into_view_if_needed()
  page.wait_for_function('()=>document.querySelector("[data-assistant-scene]").dataset.entered==="true"')
  page.wait_for_function('()=>{const i=document.querySelector(".assistant-art");return i.complete&&i.naturalWidth>0}')
  assert page.locator('.assistant-art').evaluate('''i=>{const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;const x=c.getContext('2d');x.drawImage(i,0,0);return [[0,0],[c.width-1,0],[0,c.height-1],[c.width-1,c.height-1]].every(([a,b])=>x.getImageData(a,b,1,1).data[3]===0)}''')
  page.wait_for_timeout(1900)
  assert page.locator('[data-assistant-scene]').evaluate('(e)=>e.getAnimations({subtree:true}).length===0')
  assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
  assert not errors,errors
  print(json.dumps({'browser':ENGINE,'viewport':[w,h],'phonePreview':'one working link','AIAlpha':'transparent','entrance':'finite','overflow':False}),flush=True)
  c.close()
 c=context(viewport={'width':390,'height':844},reduced_motion='reduce')
 page=c.new_page();page.goto(BASE,wait_until='networkidle');page.locator('[data-assistant-scene]').scroll_into_view_if_needed()
 page.wait_for_function('()=>document.querySelector("[data-assistant-scene]").dataset.entered==="true"')
 assert page.locator('[data-assistant-scene]').evaluate('(e)=>e.getAnimations({subtree:true}).length===0')
 c.close()
 c=context(viewport={'width':390,'height':844},java_script_enabled=False)
 page=c.new_page();page.goto(BASE,wait_until='networkidle')
 assert page.locator('#phone-example').get_attribute('href')=='img/demo-phone.png'
 assert page.locator('.assistant-art').is_visible()
 c.close()
 c=context(viewport={'width':390,'height':844})
 c.route('**/img/mobile-demo-overview.webp',lambda r:r.abort())
 page=c.new_page();page.goto(BASE,wait_until='networkidle');page.locator('#mobile').scroll_into_view_if_needed()
 page.wait_for_function('()=>{const i=document.getElementById("phone-mockup");return i.src.endsWith("demo-phone.png")&&i.complete&&i.naturalWidth>0}')
 c.close();b.close()
