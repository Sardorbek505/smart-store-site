"""Permission-gated depth, sensor lifecycle and stable controls; no live services."""
from playwright.sync_api import sync_playwright
import os, shutil, json
BASE=os.environ.get('SITE_TEST_URL','http://127.0.0.1:4178')
ENGINE=os.environ.get('BROWSER','chromium')
SENSOR='''
window.permissionCalls=0;window.permissionActive=false;window.testAngle=0;
Object.defineProperty(window,'DeviceOrientationEvent',{configurable:true,value:class {
 static requestPermission(){window.permissionCalls++;window.permissionActive=navigator.userActivation?.isActive;return Promise.resolve(RESULT)}
}});
Object.defineProperty(screen,'orientation',{configurable:true,value:new EventTarget()});
Object.defineProperty(screen.orientation,'angle',{get:()=>window.testAngle});
window.tilt=(beta,gamma)=>{const e=new Event('deviceorientation');Object.defineProperties(e,{beta:{value:beta},gamma:{value:gamma}});dispatchEvent(e)};
window.turn=(angle)=>{window.testAngle=angle;screen.orientation.dispatchEvent(new Event('change'))};
'''
with sync_playwright() as p:
 opts={'headless':True}
 if ENGINE=='chromium':opts.update(executable_path=shutil.which('chromium'),args=['--no-sandbox','--enable-unsafe-swiftshader'])
 b=getattr(p,ENGINE).launch(**opts)
 def context(sensor=None,**extra):
  c=b.new_context(**extra);c.route('https://**',lambda r:r.fulfill(status=204))
  if sensor:c.add_init_script(sensor)
  return c
 def goto(c):
  page=c.new_page();page.goto(BASE,wait_until='networkidle');return page
 def scene(page,name='assistant'):
  root=page.locator('[data-depth-scene="'+name+'"]').first
  root.evaluate('e=>e.scrollIntoView({block:"center",inline:"nearest",behavior:"instant"})')
  page.wait_for_timeout(650)
 def amount(page,selector='.assistant-token-voice'):
  return page.locator(selector).evaluate('(e)=>Math.hypot(...(e.style.translate||"0 0").split(" ").map(parseFloat))')
 def tilt(page,beta,gamma):page.evaluate('([b,g])=>tilt(b,g)',[beta,gamma])
 phone=dict(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,reduced_motion='no-preference')
 c=context(SENSOR.replace('RESULT','"granted"'),**phone);page=goto(c);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 scene(page);page.wait_for_timeout(1300)
 assert page.evaluate('permissionCalls')==0
 assert page.locator('#depth-toggle').is_visible()
 page.locator('#depth-toggle').click();assert page.evaluate('permissionCalls')==1
 assert page.evaluate('permissionActive') is not False
 # The control may scroll the scene slightly; settle before calibrating.
 scene(page);tilt(page,50,0);tilt(page,59,9);page.wait_for_timeout(850)
 assert 7 < amount(page) < 10, amount(page)
 assert amount(page)>amount(page,'.assistant-art')*1.7
 assert page.locator('.assistant-art').evaluate('e=>e.style.rotate.includes("deg")')
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 # Idle sensor position must stop scheduling DOM writes.
 page.evaluate('''window.depthWrites=0;new MutationObserver(es=>{depthWrites+=es.length}).observe(document.querySelector('[data-depth-scene="assistant"]'),{subtree:true,attributes:true,attributeFilter:['style']})''')
 page.wait_for_timeout(500);assert page.evaluate('depthWrites')==0
 tilt(page,150,89);page.wait_for_timeout(750);assert amount(page)<17.1
 page.evaluate('turn(90)');tilt(page,50,0);tilt(page,59,0);page.wait_for_timeout(750)
 xy=page.locator('.assistant-token-voice').evaluate('(e)=>[...e.style.translate.split(" ").map(parseFloat),0]')
 assert xy[0]>5 and abs(xy[1])<.1,xy
 # Open dialogs suspend the sensor and reset all shifted layers.
 page.evaluate('document.querySelector("#preview-dialog").showModal()');page.wait_for_timeout(100)
 tilt(page,70,15);page.wait_for_timeout(100);assert amount(page)==0
 page.keyboard.press('Escape');page.wait_for_timeout(100);tilt(page,50,0);tilt(page,59,9);page.wait_for_timeout(700);assert amount(page)>7
 # Visibility restoration recalibrates rather than jumping to stale angles.
 page.evaluate('''window.fakeHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>fakeHidden});document.dispatchEvent(new Event('visibilitychange'))''')
 tilt(page,60,10);page.wait_for_timeout(100);assert amount(page)==0
 page.evaluate('fakeHidden=false;document.dispatchEvent(new Event("visibilitychange"))');tilt(page,60,10);page.wait_for_timeout(150);assert amount(page)==0
 tilt(page,69,19);page.wait_for_timeout(700);assert amount(page)>7
 # Native touch/scroll suspend without cancelling the gesture.
 allowed=page.evaluate('''()=>{const e=new PointerEvent('pointerdown',{pointerType:'touch',pointerId:9,cancelable:true});dispatchEvent(e);return !e.defaultPrevented}''')
 assert allowed and amount(page)==0
 page.evaluate('dispatchEvent(new PointerEvent("pointerup",{pointerType:"touch",pointerId:9}))')
 tilt(page,60,10);tilt(page,69,19);page.wait_for_timeout(700);assert amount(page)>7
 page.emulate_media(reduced_motion='reduce');page.wait_for_timeout(100);assert amount(page)==0
 assert page.locator('#depth-toggle').is_disabled()
 page.emulate_media(reduced_motion='no-preference');page.wait_for_timeout(100)
 scene(page,'checkout');tilt(page,50,0);tilt(page,59,9);page.wait_for_timeout(750)
 assert 1.5 < amount(page,'.checkout-view') < 3, (amount(page,'.checkout-view'),page.locator('.checkout-stage').bounding_box(),page.evaluate('({y:scrollY,focus:document.activeElement.outerHTML,styles:document.querySelector(".checkout-view").getAttribute("style")})'))
 scene(page,'phone');stable_y=page.evaluate('scrollY');tilt(page,50,0);tilt(page,59,9);page.wait_for_timeout(750)
 assert amount(page,'.mobile-device')>6 and amount(page)==0, (amount(page,'.mobile-device'),amount(page),page.locator('.mobile-stage').bounding_box(),page.evaluate('scrollY'))
 assert abs(page.evaluate('scrollY')-stable_y)<1
 scene(page,'trial');tilt(page,50,0);tilt(page,59,9);page.wait_for_timeout(750)
 assert amount(page,'.trial-scene img')>5
 page.locator('#depth-toggle').click();page.wait_for_timeout(100)
 assert page.evaluate('localStorage.getItem("store-depth")')=='off'
 assert page.locator('#depth-toggle').get_attribute('aria-pressed')=='false'
 assert not errors,errors
 print(json.dumps({'browser':ENGINE,'sensor':'grant, calibration, depth, landscape, idle, touch, dialogs, visibility, reduced motion, phone, trial: pass'}),flush=True);c.close()
 for result in ['"denied"','Promise.reject(new Error("blocked"))']:
  c=context(SENSOR.replace('RESULT',result),**phone);page=goto(c);scene(page);page.locator('#depth-toggle').click()
  page.wait_for_timeout(100);tilt(page,50,0);tilt(page,59,9);page.wait_for_timeout(300)
  assert amount(page)==0
  assert page.locator('#depth-toggle').get_attribute('aria-pressed')=='false'
  assert any(w in page.locator('#depth-status').inner_text() for w in ['не разрешён','не дал доступ'])
  c.close()
 c=context(SENSOR.replace('RESULT','"granted"'),**phone);page=goto(c);scene(page);page.locator('#depth-toggle').click();page.wait_for_timeout(5300)
 assert page.locator('#depth-toggle').get_attribute('aria-pressed')=='false'
 assert 'Датчик недоступен' in page.locator('#depth-status').inner_text();c.close()
 c=context(SENSOR.replace('RESULT','"granted"'),**{**phone,'reduced_motion':'reduce'});page=goto(c);scene(page)
 assert page.locator('#depth-toggle').is_disabled() and page.evaluate('permissionCalls')==0;c.close()
 # Browsers without the gesture permission API listen automatically, with an opt-out.
 auto=SENSOR.replace(' static requestPermission(){window.permissionCalls++;window.permissionActive=navigator.userActivation?.isActive;return Promise.resolve(RESULT)}','')
 c=context(auto,**phone);page=goto(c);scene(page);tilt(page,50,0);tilt(page,59,9);page.wait_for_timeout(750)
 assert amount(page)>7
 page.locator('#depth-toggle').click();page.reload(wait_until='networkidle');scene(page);tilt(page,50,0);tilt(page,59,9);page.wait_for_timeout(300);assert amount(page)==0;c.close()
 c=context('Object.defineProperty(window,"DeviceOrientationEvent",{value:undefined})',**phone);page=goto(c);scene(page);assert page.locator('#depth-controls').is_hidden();c.close()
 # Mouse has layered depth, leaves text still and recentres without idle loops.
 c=context(viewport={'width':1440,'height':1000},reduced_motion='no-preference');page=goto(c);scene(page);page.wait_for_timeout(1300)
 assert page.locator('#depth-controls').is_hidden()
 title=page.locator('#assistant-title').bounding_box()
 root=page.locator('[data-depth-scene="assistant"]');rect=root.bounding_box();page.mouse.move(rect['x']+rect['width']*.8,rect['y']+rect['height']*.65);page.wait_for_timeout(750)
 assert amount(page)>5
 assert page.locator('#assistant-title').bounding_box()==title
 page.mouse.move(1,1);page.wait_for_timeout(900);assert amount(page)==0
 for name,layer in [('feature','.generated-feature-icon'),('phone','.mobile-device'),('trial','.trial-scene img')]:
  scene(page,name);root=page.locator('[data-depth-scene="'+name+'"]').first;rect=root.bounding_box()
  page.mouse.move(rect['x']+rect['width']*.8,rect['y']+rect['height']*.5);page.wait_for_timeout(750)
  if name=='feature':assert amount(page,'.extra-icon.generated-accent >> nth=0')>1, (rect,page.locator('.extra-icon.generated-accent').first.evaluate('e=>e.outerHTML'),page.evaluate('matchMedia("(pointer:coarse)").matches'))
  else:assert amount(page,layer)>3
 scene(page,'checkout');rect=page.locator('.checkout-stage').bounding_box()
 # Move over the non-interactive edge of the scene, keeping hotspots usable.
 page.mouse.move(rect['x']+rect['width']*.05,rect['y']+rect['height']*.05);page.wait_for_timeout(700)
 assert page.locator('.checkout-view').evaluate('e=>Math.abs(parseFloat(e.style.translate||"0"))<=3.01')
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 print(json.dumps({'browser':ENGINE,'fallbacks':'denied, rejected, reduced, automatic sensor, saved opt-out, unsupported, desktop pointer: pass'}),flush=True)
 c.close();b.close()
