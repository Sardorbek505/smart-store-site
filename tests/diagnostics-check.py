"""Exercise error delivery, privacy and loader independence; all remote writes are fixtures."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import json, os, shutil

BASE=os.environ.get('SITE_TEST_URL','http://127.0.0.1:4173').rstrip('/')
BROWSER=os.environ.get('BROWSER','chromium')
WIN='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36'
with sync_playwright() as p:
    opts={'headless':True}
    if BROWSER=='chromium':opts.update(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
    browser=getattr(p,BROWSER).launch(**opts)
    def context(extra=''):
        c=browser.new_context(viewport={'width':390,'height':844},user_agent=WIN,reduced_motion='reduce')
        sent=[]
        def collect(route):
            if route.request.method=='POST' and route.request.post_data:
                sent.append(json.loads(route.request.post_data))
            route.fulfill(status=204,headers={'access-control-allow-origin':'*','access-control-allow-headers':'content-type'})
        c.route('https://zavod.metov.store/**',collect)
        c.route('https://connect.metov.store/**',lambda r:r.fulfill(status=204))
        c.route('https://api.github.com/**',lambda r:r.fulfill(json={}))
        c.add_init_script("Object.defineProperty(navigator,'webdriver',{get:()=>false,configurable:true});"+extra)
        return c,sent
    def ready(page):
        page.goto(BASE+'/?private-token=secret#store',wait_until='networkidle')
        page.wait_for_function('()=>!document.getElementById("store-submit").disabled')
    def errors(sent):return [event for event in sent if event.get('name')=='error']

    c,sent=context();c.route('**/scripts/gallery.js*',lambda r:r.abort())
    page=c.new_page();ready(page)
    assert any(e.get('label')=='v63:module:gallery' for e in errors(sent)),sent
    page.evaluate('''()=>{dispatchEvent(new ErrorEvent('error',{message:'private password',filename:'https://private.example/?secret=1'}));dispatchEvent(new ErrorEvent('error',{message:'private again'}));dispatchEvent(new PromiseRejectionEvent('unhandledrejection',{promise:Promise.resolve(),reason:{name:'AbortError',message:'private'}}))}''')
    page.wait_for_timeout(100)
    reports=errors(sent)
    assert len([e for e in reports if e['label']=='v63:runtime:exception'])==1
    assert not any(e['label']=='v63:runtime:rejection' for e in reports)
    assert all(set(e)=={'site','name','label'} and 'private' not in json.dumps(e) and 'secret' not in json.dumps(e) for e in reports)
    count=len(reports);page.evaluate("localStorage.setItem('smart-store-analytics','off');dispatchEvent(new PromiseRejectionEvent('unhandledrejection',{promise:Promise.resolve(),reason:Error('private')}))")
    page.wait_for_timeout(100);assert len(errors(sent))==count
    page.locator('.store-help summary').click()
    page.get_by_role('link',name='Если забыли пароль или потеряли телефон →').click()
    page.wait_for_url('**/programma-dlya-magazina-instrumentov/#phone-access')
    assert page.locator('#phone-access').is_visible()
    c.close()
    print(json.dumps({'browser':BROWSER,'moduleFailure':'reported once','form':'still usable','privateErrorText':'excluded','optOut':'respected','recoveryGuide':'reachable'}),flush=True)

    for name,extra in [('DNT',"Object.defineProperty(navigator,'doNotTrack',{get:()=> '1',configurable:true});"),('GPC',"Object.defineProperty(navigator,'globalPrivacyControl',{get:()=>true,configurable:true});"),('storage denied',"Storage.prototype.getItem=function(){throw Error('denied')};")]:
        c,sent=context(extra);c.route('**/scripts/gallery.js*',lambda r:r.abort());page=c.new_page();ready(page)
        page.evaluate("dispatchEvent(new ErrorEvent('error',{message:'private'}))");page.wait_for_timeout(100)
        assert not errors(sent),(name,errors(sent));c.close()
        print(json.dumps({'browser':BROWSER,'privacy':name,'errorReports':0}),flush=True)

    c,sent=context();c.route('**/scripts/diagnostics.js*',lambda r:r.abort());page=c.new_page();ready(page)
    assert page.locator('#installation-download').get_attribute('href').startswith('https://github.com/')
    page.locator('#store-code').fill('zavod');page.locator('#store-submit').click()
    assert page.locator('#store-form').get_attribute('data-state')=='invalid'
    assert not errors(sent);c.close();browser.close()
    print(json.dumps({'browser':BROWSER,'monitorUnavailable':'login and installer remain usable'}),flush=True)
