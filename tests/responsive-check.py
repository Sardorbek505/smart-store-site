"""Fluid phone proportions, safe insets, rotation, text growth and stable scrolling."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import os,shutil,json
BASE=os.environ.get('SITE_TEST_URL','http://127.0.0.1:4201')
ENGINE=os.environ.get('BROWSER','chromium')
OUT=Path('test-results');OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
 options={'headless':True}
 if ENGINE=='chromium':options.update(executable_path=shutil.which('chromium'),args=['--no-sandbox','--enable-unsafe-swiftshader'])
 b=getattr(p,ENGINE).launch(**options)
 sizes=[(320,568),(360,640),(375,667),(390,844),(393,852),(430,932),(440,956),(540,720),(768,1024),(956,440),(1440,900)]
 phone_sizes={}
 for w,h in sizes:
  c=b.new_context(viewport={'width':w,'height':h},is_mobile=w<1100,has_touch=w<1100,reduced_motion='reduce')
  c.route('https://**',lambda r:r.fulfill(status=204));page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(BASE,wait_until='networkidle')
  assert page.locator('#depth-controls,#depth-toggle,#depth-status').count()==0
  assert page.locator('meta[name="viewport"]').get_attribute('content').endswith('viewport-fit=cover')
  for slug in ['features','assistant','workspace','mobile','license','faq']:
   section=page.locator('#'+slug);section.evaluate('e=>e.scrollIntoView({block:"start",behavior:"instant"})');page.wait_for_timeout(80)
   assert section.evaluate('e=>Math.abs(e.getBoundingClientRect().width-document.body.clientWidth)<2'),(w,slug)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(w,slug,'horizontal overflow')
   if w<=620:
    if slug=='license':assert section.evaluate('e=>e.querySelector(".trial-scene").getBoundingClientRect().bottom<=e.querySelector(".license-copy").getBoundingClientRect().top+1'), (w,'trial overlap')
    assert section.locator('.screen-content').evaluate_all('es=>es.every(e=>getComputedStyle(e).overflowY!=="auto" || e.scrollHeight-e.clientHeight<=4)'),(w,slug,'inner scroll')
  phone_sizes[w]=page.locator('.mobile-device').bounding_box()['width']
  if w in [320,440]:
   page.locator('#mobile').evaluate('e=>e.scrollIntoView({block:"start",behavior:"instant"})');page.screenshot(path=str(OUT/f'responsive-phone-{w}.png'))
  # A content-heavy answer must remain in page flow and reachable below the menu.
  page.locator('#faq details').first.evaluate('e=>{e.open=true;e.scrollIntoView({block:"start",behavior:"instant"})}')
  assert page.locator('#faq .screen-content').evaluate('e=>getComputedStyle(e).overflowY==="visible"')
  assert not errors,errors
  print(json.dumps({'browser':ENGINE,'viewport':[w,h],'fullWidthSections':True,'horizontalOverflow':False,'nestedPhoneScroll':False}),flush=True)
  c.close()
 assert phone_sizes[440]>phone_sizes[390]>phone_sizes[320],phone_sizes
 # Dynamic type/content grows the document rather than clipping a screen-sized box.
 c=b.new_context(viewport={'width':320,'height':568},has_touch=True,is_mobile=True,reduced_motion='reduce');c.route('https://**',lambda r:r.fulfill(status=204));page=c.new_page();page.goto(BASE,wait_until='networkidle')
 page.evaluate('''()=>{for(const e of document.querySelectorAll('#features h2,#features h3,#features p,#workspace h2,#workspace h3,#workspace p,#license h2,#license p'))e.style.fontSize=parseFloat(getComputedStyle(e).fontSize)*1.6+'px'}''')
 page.wait_for_timeout(700)
 for slug in ['features','workspace','license']:
  frame=page.locator('#'+slug+' .screen-content');assert frame.evaluate('e=>getComputedStyle(e).overflowY==="visible"'),slug
  assert frame.evaluate('e=>e.scrollHeight<=e.clientHeight+5'),(slug,frame.evaluate('e=>[e.scrollHeight,e.clientHeight]'))
 assert page.locator('#license').evaluate('e=>e.querySelector(".trial-scene").getBoundingClientRect().bottom<=e.querySelector(".license-copy").getBoundingClientRect().top+1'), 'Trial image must not overlap the offer'
 assert page.locator('#features .sale-step').count()==3
 for step in page.locator('#features .sale-step').all():
  assert step.evaluate('e=>e.querySelector(".sale-step-copy").getBoundingClientRect().bottom<=e.querySelector(".sale-step-screen").getBoundingClientRect().top+2'), 'Proof image must follow its text'
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 # Width-changing rotation updates the layout; browser-bar height changes while
 # reading do not resize all preceding sections or displace the reader.
 page.set_viewport_size({'width':844,'height':390});page.wait_for_function('()=>parseFloat(document.body.style.getPropertyValue("--screen-height"))===390')
 page.locator('#mobile').scroll_into_view_if_needed();page.wait_for_timeout(500);before=page.evaluate('({y:document.querySelector("#mobile h2").getBoundingClientRect().top+scrollY,h:document.body.style.getPropertyValue("--screen-height")})')
 page.evaluate('''()=>{Object.defineProperty(visualViewport,'height',{configurable:true,get:()=>430});visualViewport.dispatchEvent(new Event('resize'));dispatchEvent(new Event('resize'))}''');page.wait_for_timeout(450)
 assert page.evaluate('document.body.style.getPropertyValue("--screen-height")')==before['h']
 assert abs(page.evaluate('document.querySelector("#mobile h2").getBoundingClientRect().top+scrollY')-before['y'])<2, (before,page.locator('#mobile h2').bounding_box())
 c.close()
 if ENGINE=='chromium':
  c=b.new_context(viewport={'width':956,'height':440},has_touch=True,is_mobile=True,reduced_motion='reduce');c.route('https://**',lambda r:r.fulfill(status=204));page=c.new_page()
  session=c.new_cdp_session(page);session.send('Emulation.setSafeAreaInsetsOverride',{'insets':{'top':0,'left':59,'right':59,'bottom':21}})
  page.goto(BASE,wait_until='networkidle');page.locator('#mobile').scroll_into_view_if_needed()
  box=page.locator('#mobile .wrap').bounding_box();assert box['x']>=59 and box['x']+box['width']<=897,box
  print(json.dumps({'browser':ENGINE,'landscapeSafeArea':'59px side insets respected','textGrowth':'page flow','browserChrome':'reading position stable'}),flush=True);c.close()
 b.close()
