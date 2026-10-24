"""Manual scroll benchmark. Requires a local server, Playwright and Chromium.

PROFILE_NAME labels a run; PROFILE_OUTPUT selects the artifact directory.
Uses 4x CPU throttling and headless software WebGL; no timing thresholds are
asserted because these measurements depend on the machine and driver.
"""
from playwright.sync_api import sync_playwright
import json, os, shutil
from pathlib import Path
OUT=os.environ.get('PROFILE_NAME','before')
BASE=os.environ.get('SITE_TEST_URL','http://127.0.0.1:4173')
ARTIFACTS=Path(os.environ.get('PROFILE_OUTPUT','/tmp/smart-store-profile'))
ARTIFACTS.mkdir(parents=True,exist_ok=True)
INIT='''(()=>{window.__perf={draw2d:0,drawGL:0,paints:0,gaps:[],long:[]};const p=window.__perf;const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(...a){p.draw2d++;return draw.apply(this,a)};for(const key of ['WebGLRenderingContext','WebGL2RenderingContext']) {const proto=window[key]?.prototype;if(proto)for(const method of ['drawArrays','drawElements']){const fn=proto[method];proto[method]=function(...a){p.drawGL++;return fn.apply(this,a)}}}try{new PerformanceObserver(l=>p.long.push(...l.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true})}catch{}const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>raf(t=>{p.paints++;cb(t)});})();'''
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_BINARY') or shutil.which('chromium'),args=['--no-sandbox','--enable-webgl','--enable-unsafe-swiftshader'])
 for w,h,dpr in [(390,844,3),(1440,900,2)]:
  page=b.new_page(viewport={'width':w,'height':h},device_scale_factor=dpr,has_touch=w<500)
  page.add_init_script(INIT)
  page.goto(BASE,wait_until='networkidle')
  page.locator('.hero-gallery img').evaluate_all('(xs)=>Promise.all(xs.map(i=>i.decode()))')
  page.mouse.move(1,1)
  page.wait_for_timeout(800)
  page.screenshot(path=str(ARTIFACTS/f'scroll-{OUT}-{w}.png'))
  cdp=page.context.new_cdp_session(page)
  cdp.send('Performance.enable')
  cdp.send('Emulation.setCPUThrottlingRate',{'rate':4})
  get=lambda:{x['name']:x['value'] for x in cdp.send('Performance.getMetrics')['metrics']}
  page.evaluate('''()=>{Object.assign(window.__perf,{draw2d:0,drawGL:0,paints:0,gaps:[],long:[],since:performance.now()});let last=performance.now();window.__sampling=true;function sample(t){window.__perf.gaps.push(t-last);last=t;if(window.__sampling)requestAnimationFrame(sample)}requestAnimationFrame(sample)}''')
  start=get()
  # A consistent gesture carries the page past the hero, then down the landing.
  page.mouse.move(w/2,h/2)
  for step in range(65):
   page.mouse.wheel(0,45)
   page.wait_for_timeout(16)
  page.wait_for_timeout(200)
  end=get()
  stats=page.evaluate('''()=>{window.__sampling=false;const p=window.__perf;const long=p.long.filter(e=>e.start>=p.since);const a=p.gaps.slice(3).sort((a,b)=>a-b);return {draw2d:p.draw2d,drawGL:p.drawGL,callbacks:p.paints,frames:a.length,gapP95:a[Math.floor(a.length*.95)],gapMax:Math.max(...a),longTasks:long.length,longMs:long.reduce((a,b)=>a+b.duration,0),y:scrollY,renderer:document.querySelector('.gallery-stage').dataset.renderer||'strips-2d'}}''')
  stats.update({k:round((end[k]-start[k])*1000,1) for k in ['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration']})
  stats.update({'viewport':[w,h],'dpr':dpr,'cpuThrottle':4})
  print(json.dumps(stats),flush=True)
  with open(ARTIFACTS/f'profile-{OUT}-{w}.json','w') as f:json.dump(stats,f)
  page.close()
 b.close()
