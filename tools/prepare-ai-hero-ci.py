"""Temporary read-only CI build for generated hero artwork. No production APIs."""
from pathlib import Path
import base64, hashlib, json, subprocess, sys, threading, os
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from PIL import Image
ROOT=Path.cwd()
for name in ['assistant','invoice','promo']:
    image=Image.open(ROOT/'img'/('hero-ai-'+name+'-source-v91.png')).convert('RGBA')
    for width in [768,1024,1536]:
        image.resize((width,round(width*image.height/image.width)),Image.Resampling.LANCZOS).save(ROOT/'img'/('hero-ai-'+name+'-'+str(width)+'-v91.webp'),format='WEBP',quality=87,method=6)
for name in ['laptop','phone']:
    image=Image.open(ROOT/'img'/('hero-demo-'+name+'-1536.webp'))
    image.resize((1024,683),Image.Resampling.LANCZOS).save(ROOT/'img'/('hero-demo-'+name+'-1024-v91.webp'),format='WEBP',quality=87,method=6)
for pose in ['hello','thinking','ok']:
    Image.open(ROOT/'img'/('assistant-'+pose+'-v91.png')).save(ROOT/'img'/('assistant-'+pose+'-v91.webp'),format='WEBP',lossless=True,method=6)
for cmd in [['node','tools/sync-hero-layout.mjs'],['node','tools/build-styles.mjs'],['node','tools/sync-csp.mjs'],['python3','tools/check-site.py'],['npm','test'],['python3','-m','unittest','discover','-s','tests','-p','test_*.py']]:
    subprocess.run(cmd,check=True)
# Emit only public, generated build files; no credentials or application source.
allowed=['index.html','assets/styles.json']
changed=subprocess.check_output(['git','diff','--name-only'],text=True).splitlines()
untracked=subprocess.check_output(['git','ls-files','--others','--exclude-standard'],text=True).splitlines()
files=[]
for name in sorted(set(changed+untracked)):
    if name not in allowed and not (name.startswith('assets/site.') and name.endswith('.css')) and not (name.startswith('img/') and name.endswith('-v91.webp')):
        continue
    path=ROOT/name
    if not path.exists():files.append({'path':name,'delete':True});continue
    data=path.read_bytes();sha=subprocess.check_output(['git','hash-object',str(path)],text=True).strip()
    files.append({'path':name,'sha':sha,'size':len(data)})
    encoded=base64.b64encode(data).decode()
    pieces=[encoded[i:i+12000] for i in range(0,len(encoded),12000)]
    for index,part in enumerate(pieces):print('AI_FILE:'+json.dumps({'path':name,'part':index,'total':len(pieces),'base64':part},separators=(',',':')),flush=True)
print('AI_MANIFEST:'+json.dumps(files,separators=(',',':')),flush=True)
# Browser suites, including WebKit; all external services are fixtures.
subprocess.run([sys.executable,'tools/browser-smoke.py'],check=True)
subprocess.run([sys.executable,'tools/browser-smoke.py'],env={**os.environ,'BROWSER':'webkit'},check=True)
# Human review captures of the actual built landing, all remote services stubbed.
from playwright.sync_api import sync_playwright
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
    with sync_playwright() as p:
        b=p.chromium.launch(headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
        for width,height in [(320,568),(390,844),(768,1024),(1024,900),(1440,1000)]:
            c=b.new_context(viewport={'width':width,'height':height},device_scale_factor=1,reduced_motion='reduce',is_mobile=width<851,has_touch=width<851)
            for host in ['zavod.metov.store','connect.metov.store','api.github.com']:
                c.route('https://'+host+'/**',lambda r:r.fulfill(status=204))
            page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto('http://127.0.0.1:'+str(server.server_port),wait_until='networkidle')
            page.wait_for_function('()=>document.querySelector(".gallery-stage").dataset.ready==="true"')
            if width<851:page.wait_for_function('()=>document.querySelector(".ribbon-window").dataset.optics==="webgl"')
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
            page.evaluate('()=>{document.querySelector(".ribbon-track").getAnimations()[0].currentTime=8800;dispatchEvent(new Event("resize"))}')
            page.wait_for_timeout(150)
            if width in [390,1440]:
                captures=[('hero-'+str(width),page.screenshot())]
                page.evaluate('()=>{const a=document.querySelector("#assistant");a.scrollIntoView();window.scrollTo(0,scrollY+a.getBoundingClientRect().top-100)}')
                page.wait_for_timeout(150)
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                page.evaluate('scrollTo({top:0,behavior:"instant"})');page.wait_for_timeout(150)
                bounds=page.locator('#assistant').bounding_box()
                captures.append(('assistant-'+str(width),page.screenshot(full_page=True,clip={'x':0,'y':bounds['y'],'width':width,'height':bounds['height']})))
                for label,data in captures:
                    encoded=base64.b64encode(data).decode();parts=[encoded[i:i+12000] for i in range(0,len(encoded),12000)]
                    for index,part in enumerate(parts):print('AI_PREVIEW:'+json.dumps({'label':label,'part':index,'total':len(parts),'base64':part},separators=(',',':')),flush=True)
            assert not errors,errors
            print('AI_LAYOUT:'+json.dumps({'width':width,'errors':errors,'noOverflow':True}),flush=True)
            c.close()
        b.close()
finally:server.shutdown();server.server_close()
