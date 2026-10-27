"""Back/forward restoration and late lookups; only local synthetic shops are used.

An isolated HTTP fixture changes the two service addresses in core.js. The
production store handler stays intact, and native bfcache remains available
because Playwright request routing is not involved.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import urlsplit, parse_qs
from playwright.sync_api import sync_playwright
import json, os, shutil

ROOT=Path(__file__).resolve().parents[1]
BROWSER=os.environ.get('BROWSER','chromium')
PHONE='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):
        super().__init__(*args,directory=str(ROOT),**kwargs)
    def log_message(self,*args):pass
    def do_GET(self):
        url=urlsplit(self.path)
        if url.path=='/scripts/core.js':
            body=(ROOT/'scripts/core.js').read_text()
            assert body.count('https://connect.metov.store/lookup')==1
            assert body.count('`https://${normalized}.${config.storeDomain}/`')==1
            body=body.replace('https://connect.metov.store/lookup',BASE+'/lookup').replace('`https://${normalized}.${config.storeDomain}/`',json.dumps(BASE+'/synthetic-shop/'))
            self.send_response(200);self.send_header('Content-Type','text/javascript');self.end_headers();self.wfile.write(body.encode())
        elif url.path=='/lookup':
            missing=parse_qs(url.query).get('code')==['missing-shop']
            body=json.dumps({'found':not missing}).encode()
            self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(body)
        elif url.path=='/synthetic-shop/':
            self.send_response(200);self.send_header('Content-Type','text/html');self.end_headers();self.wfile.write(b'<!doctype html><title>Local synthetic shop</title><p>Test login destination</p>')
        else:super().do_GET()

server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
BASE=f'http://127.0.0.1:{server.server_port}'
Thread(target=server.serve_forever,daemon=True).start()
try:
    with sync_playwright() as p:
        launch={'headless':True}
        if BROWSER=='chromium':
            launch.update(executable_path=shutil.which('chromium'),args=['--no-sandbox','--enable-features=BackForwardCache'],ignore_default_args=['--disable-back-forward-cache'])
        browser=getattr(p,BROWSER).launch(**launch)
        for w,h in [(320,568),(390,844),(844,390),(1440,900)]:
            page=browser.new_page(viewport={'width':w,'height':h},user_agent=PHONE,has_touch=w<851,is_mobile=w<851,reduced_motion='reduce')
            errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.add_init_script('addEventListener("pageshow",e=>window.restored=e.persisted)')
            page.goto(BASE+'/#store',wait_until='networkidle')
            page.locator('#store-code').fill('synthetic-shop')
            page.locator('#store-submit').click()
            page.wait_for_url(BASE+'/synthetic-shop/')
            page.go_back(wait_until='commit')
            page.wait_for_function('() => (document.querySelector("#store-form")?.dataset.state==="idle"&&!document.querySelector("#store-submit").disabled)')
            cached=page.evaluate('window.restored')
            if cached:
                assert page.locator('#store-code').input_value()=='synthetic-shop'
            assert page.locator('#store-note').inner_text()==''
            assert page.locator('#store-direct').is_hidden()

            page.locator('#store-code').fill('missing-shop')
            page.locator('#store-submit').click()
            page.wait_for_function('() => (document.querySelector("#store-form").dataset.state==="not-found")')
            assert page.locator('#store-code').get_attribute('aria-invalid')=='true'
            page.evaluate('dispatchEvent(new PageTransitionEvent("pageshow",{persisted:true}))')
            assert page.locator('#store-code').get_attribute('aria-invalid') is None
            assert page.locator('#store-code').input_value()=='missing-shop'
            assert page.locator('#store-form').get_attribute('data-state')=='idle'

            # The service can finish after its caller is cancelled. A page
            # restoration must invalidate that response, not merely enable UI.
            page.evaluate('''()=>{
              const real=window.fetch;
              window.lookupCount=0;window.lookupAborted=false;
              window.fetch=(url,options)=>{
                if(!String(url).includes('/lookup?'))return real(url,options);
                window.lookupCount++;
                options.signal.addEventListener('abort',()=>window.lookupAborted=true);
                return new Promise(resolve=>window.finishLookup=()=>resolve(new Response('{"found":true}',{headers:{'content-type':'application/json'}})));
              };
            }''')
            page.locator('#store-code').fill('another-shop')
            page.locator('#store-submit').click()
            assert page.locator('#store-form').get_attribute('data-state')=='checking'
            page.evaluate('''()=>{
              dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));
              dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));
            }''')
            assert page.evaluate('window.lookupAborted')
            assert page.locator('#store-form').get_attribute('data-state')=='idle'
            assert page.locator('#store-submit').is_enabled()
            assert page.locator('#store-code').input_value()=='another-shop'
            page.evaluate('async()=>{window.finishLookup();await new Promise(r=>setTimeout(r,100));}')
            assert page.url==BASE+'/#store'
            assert page.evaluate('window.lookupCount')==1,'Restoring must not silently send another lookup'
            assert page.locator('#store-form').get_attribute('data-state')=='idle'

            # Stale errors and a direct URL do not survive restoration.
            page.evaluate('window.fetch=async()=>new Response("",{status:503})')
            page.locator('#store-submit').click()
            page.locator('#store-direct').wait_for(state='visible')
            page.evaluate('dispatchEvent(new PageTransitionEvent("pageshow",{persisted:true}))')
            assert page.locator('#store-direct').is_hidden()
            assert page.locator('#store-direct').get_attribute('href') is None
            assert page.locator('#store-note').inner_text()==''
            assert page.locator('#store-submit').is_enabled()
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            assert not errors,errors
            print(json.dumps({'browser':BROWSER,'viewport':[w,h],'nativeBack':True,'bfcacheRestored':cached,'pendingLookupCancelled':True,'lateRedirectIgnored':True,'codePreservedOnRestore':True,'staleErrorAndDirectUrlCleared':True,'errors':errors}),flush=True)
            page.close()
        browser.close()
finally:
    server.shutdown();server.server_close()
