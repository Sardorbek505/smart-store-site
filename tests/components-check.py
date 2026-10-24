"""Native component ports: selected tile, clipboard outcomes and finite motion."""
from playwright.sync_api import sync_playwright
import os,shutil,json
BASE=os.environ.get('SITE_TEST_URL','http://127.0.0.1:4173').rstrip('/')
BROWSER=os.environ.get('BROWSER','chromium')
with sync_playwright() as p:
    args={'headless':True}
    if BROWSER=='chromium':args.update(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
    b=getattr(p,BROWSER).launch(**args)
    for w,h in [(390,844),(1440,900)]:
        page=b.new_page(viewport={'width':w,'height':h},is_mobile=w<851,has_touch=w<851)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.add_init_script('Object.defineProperty(navigator,"clipboard",{value:{writeText:async(t)=>{if(window.copyFails)throw Error("denied");window.copiedValue=t}}})')
        page.goto(BASE,wait_until='networkidle')
        page.wait_for_function('document.documentElement.classList.contains("js")')
        explore=page.get_by_role('link',name='Что внутри',exact=True)
        assert explore.count()==1
        explore.click();page.wait_for_url('**/#features')
        page.locator('.product-section').evaluate('e=>scrollTo(0,e.offsetTop)')
        for name in ['home','scene','sale','home']:
            page.locator(f'[data-screen="{name}"]').click()
        page.wait_for_timeout(420)
        geometry=page.locator('.screen-tabs').evaluate('''e=>{const s=getComputedStyle(e,'::before'),m=new DOMMatrix(s.transform),r=e.getBoundingClientRect(),b=e.querySelector('[aria-pressed="true"]').getBoundingClientRect();return{tile:r.x+parseFloat(getComputedStyle(e).borderLeftWidth)+parseFloat(s.left)+m.m41+parseFloat(s.width)/2,selected:b.x+b.width/2}}''')
        assert abs(geometry['tile']-geometry['selected'])<1,geometry
        assert page.locator('[data-screen][aria-pressed="true"]').count()==1
        page.locator('#faq').evaluate('e=>scrollTo(0,e.offsetTop)')
        summary=page.locator('.faq-list summary').first
        summary.focus();page.keyboard.press('Enter')
        assert page.locator('.faq-list details').first.get_attribute('open') is not None
        page.keyboard.press('Enter')
        assert page.locator('.faq-list details').first.get_attribute('open') is None
        page.locator('#store-code').focus()
        page.wait_for_timeout(1400)
        assert page.locator('.ui-beam-ray').evaluate('e=>e.getAnimations().every(a=>a.playState!=="running")'),'focus border must not run continuously'
        assert page.locator('canvas').count()==0
        page.goto(BASE+'/#installation',wait_until='networkidle')
        page.wait_for_function('document.documentElement.classList.contains("js")')
        copy=page.locator('#copy-site');copy.click()
        page.wait_for_function('document.getElementById("copy-site").dataset.copied==="true"')
        assert page.evaluate('window.copiedValue')=='https://metov.store/'
        page.evaluate('window.copyFails=true');copy.click()
        page.wait_for_function('document.getElementById("copy-status").textContent.includes("вручную")')
        assert copy.get_attribute('data-copied')=='false'
        assert page.locator('#installation-url').evaluate('e=>e.selectionStart===0&&e.selectionEnd===e.value.length')
        page.emulate_media(reduced_motion='reduce')
        page.locator('#store-code').focus()
        assert page.locator('.ui-beam-ray').evaluate('e=>getComputedStyle(e).animationName')=='none'
        assert not errors,errors
        print(json.dumps({'browser':BROWSER,'viewport':[w,h],'selectionTile':'aligned','copySuccessAndFailure':'pass','FAQKeyboard':'pass','finiteMotion':'pass'}),flush=True)
        page.close()
    b.close()
