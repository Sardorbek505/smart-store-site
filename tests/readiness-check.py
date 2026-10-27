"""Crawlable pages, CSP, private counters and concurrent login requests.

All remote responses are fixtures. No production visits, messages or shop lookups.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, os, shutil

BASE = os.environ.get('SITE_TEST_URL', 'http://127.0.0.1:4173').rstrip('/')
BROWSER = os.environ.get('BROWSER', 'chromium')
OUT = Path('/tmp/smart-store-readiness') / BROWSER
OUT.mkdir(parents=True, exist_ok=True)
WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36'
INSTALLER = 'https://github.com/Sardorbek505/smart-store-releases/releases/download/v1.29.4/SmartStore-Setup-1.29.4-x64.exe'
RELEASE = {'tag_name': 'v1.29.4', 'assets': [{'name': 'SmartStore-Setup-1.29.4-x64.exe', 'size': 167772160, 'browser_download_url': INSTALLER}]}
INIT = '''
window.policyViolations=[];
addEventListener('securitypolicyviolation',e=>policyViolations.push([e.effectiveDirective,e.blockedURI]));
// Only test fixtures receive traffic. Exercise the same code as a real browser.
Object.defineProperty(navigator,'webdriver',{get:()=>false,configurable:true});
Object.defineProperty(document,'referrer',{get:()=>"https://example.org/private?token=secret#private"});
document.addEventListener('click',e=>{if(e.target.closest?.('a[data-download],#download'))e.preventDefault()},true);
'''

with sync_playwright() as p:
    opts = {'headless': True}
    if BROWSER == 'chromium':
        opts.update(executable_path=shutil.which('chromium'), args=['--no-sandbox', '--enable-unsafe-swiftshader'])
    browser = getattr(p, BROWSER).launch(**opts)

    def context(extra='', **kwargs):
        c = browser.new_context(user_agent=WIN, reduced_motion='reduce', **kwargs)
        events=[]
        def counter(route):
            if route.request.method == 'POST':
                events.append({'url':route.request.url, 'body':route.request.post_data, 'headers':route.request.all_headers()})
            route.fulfill(status=204, headers={'access-control-allow-origin':'*','access-control-allow-headers':'content-type','access-control-allow-methods':'POST, OPTIONS'})
        c.route('https://zavod.metov.store/**', counter)
        c.route('https://connect.metov.store/**', counter)
        c.route('https://api.github.com/**', lambda r:r.fulfill(json=RELEASE))
        c.add_init_script(INIT+extra)
        return c, events

    c, events = context(viewport={'width':1440,'height':900})
    page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(BASE+'/?private=secret#store',wait_until='networkidle')
    page.wait_for_function('() => (!document.getElementById("store-submit").disabled)')
    hits=[e for e in events if e['url'].endswith('/hit')]
    assert len(hits)==1, hits
    assert json.loads(hits[0]['body'])=={'site':'smart-store','path':'/','ref':'https://example.org'}
    assert 'referer' not in hits[0]['headers']
    assert not page.locator('script[src^="https:"]').count()

    # Duplicate submit is ignored; edits replace the lookup and stale replies cannot navigate.
    page.evaluate('''()=>{window.pending=[];const original=window.fetch;window.fetch=(url,...args)=>String(url).includes('/lookup?')?new Promise(resolve=>pending.push({url:String(url),resolve})):original(url,...args)}''')
    page.locator('#store-code').fill('fixture-shop')
    page.locator('#store-form').evaluate('e=>{e.requestSubmit();e.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}))}')
    assert page.evaluate('pending.length')==1
    assert page.locator('#store-submit').is_disabled()
    page.locator('#store-code').fill('fixture-shop-2')
    page.locator('#store-form').evaluate('e=>e.requestSubmit()')
    assert page.evaluate('pending.length')==2
    page.evaluate('pending[0].resolve({ok:true,json:async()=>({found:true})});pending[1].resolve({ok:true,json:async()=>({found:false})})')
    page.wait_for_function('() => (document.getElementById("store-form").dataset.state==="not-found")')
    assert 'fixture-shop.metov.store' not in page.url
    page.locator('#store-code').fill('zavod')
    page.locator('#store-form').evaluate('e=>e.requestSubmit()')
    assert page.locator('#store-form').get_attribute('data-state')=='invalid'
    assert page.evaluate('pending.length')==2
    page.locator('#store-close').click()
    page.locator('#download').evaluate('e=>e.click()')
    page.wait_for_timeout(200)
    assert any(e['url'].endswith('/download') for e in events)
    assert not any('fixture-shop' in (e['body'] or '') or 'secret' in (e['body'] or '') for e in events)

    # An opt-out in another tab stops click/download counters in the already open page.
    privacy=c.new_page();privacy.goto(BASE+'/privacy.html#analytics-settings',wait_until='networkidle')
    choice=privacy.locator('#analytics-choice');assert choice.is_checked() and choice.is_enabled()
    choice.uncheck()
    assert privacy.evaluate('localStorage.getItem("smart-store-analytics")')=='off'
    page.wait_for_timeout(100);count=len(events)
    page.locator('#download').evaluate('e=>e.click()');page.wait_for_timeout(150)
    assert len(events)==count
    page.reload(wait_until='networkidle');assert len(events)==count
    assert not page.evaluate('policyViolations') and not privacy.evaluate('policyViolations')
    assert not errors,errors
    c.close()
    print(json.dumps({'browser':BROWSER,'tracking':'origin only; fixture counters preserved; live opt-out','login':'one request; stale reply ignored; zavod reserved','CSP':'pass'}),flush=True)

    for name,extra in [
        ('DNT',"Object.defineProperty(navigator,'doNotTrack',{get:()=> '1',configurable:true});"),
        ('GPC',"Object.defineProperty(navigator,'globalPrivacyControl',{get:()=>true,configurable:true});"),
        ('storage denied',"Storage.prototype.getItem=function(){throw new Error('denied')};"),
        ('stored opt-out',"localStorage.setItem('smart-store-analytics','off');")
    ]:
        c,events=context(extra,viewport={'width':390,'height':844})
        page=c.new_page();page.goto(BASE+'/#store',wait_until='networkidle')
        page.wait_for_function('() => (!document.getElementById("store-submit").disabled)')
        page.locator('#store-code').fill('zavod');page.locator('#store-submit').click()
        assert page.locator('#store-form').get_attribute('data-state')=='invalid'
        page.locator('#download').evaluate('e=>e.click()');page.wait_for_timeout(100)
        assert events==[], (name,events)
        page.goto(BASE+'/privacy.html#analytics-settings',wait_until='networkidle')
        assert not page.locator('#analytics-choice').is_checked()
        if name!='stored opt-out':assert page.locator('#analytics-choice').is_disabled()
        assert not page.evaluate('policyViolations')
        c.close()
        print(json.dumps({'browser':BROWSER,'privacy':name,'optionalRequests':0,'login':'usable'}),flush=True)

    # No-JS HTML remains readable and the guide never needs the landing runtime.
    for w,h in [(320,568),(390,844),(1440,900)]:
        c=browser.new_context(viewport={'width':w,'height':h},java_script_enabled=False)
        for path in ['/programma-dlya-magazina-instrumentov/','/privacy.html','/404.html']:
            page=c.new_page();page.goto(BASE+path,wait_until='networkidle')
            assert page.locator('h1').count()==1
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(w,path)
            assert page.locator('main').inner_text().strip()
            if 'programma-' in path:
                assert page.locator('main img').count()==2
                assert not page.locator('script[src]').count()
                assert page.locator('a[href="/#installation"]').count()>=1
                page.screenshot(path=str(OUT/f'guide-{w}.png'))
            page.close()
        c.close()
    browser.close()
    print(json.dumps({'browser':BROWSER,'staticPages':'320/390/1440, no JavaScript, no overflow'}),flush=True)
