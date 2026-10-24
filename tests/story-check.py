"""Product stories: real screens, interrupted selection, keyboard and one-screen fit."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import os,shutil,json
BASE=os.environ.get('SITE_TEST_URL','http://127.0.0.1:4173').rstrip('/')
BROWSER=os.environ.get('BROWSER','chromium')
OUT=Path(os.environ.get('STORY_OUTPUT','/tmp/smart-store-story'))/BROWSER
OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    args={'headless':True}
    if BROWSER=='chromium':args.update(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
    b=getattr(p,BROWSER).launch(**args)
    for w,h in [(320,568),(390,844),(844,390),(1440,900)]:
        page=b.new_page(viewport={'width':w,'height':h},is_mobile=w<851,has_touch=w<851)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(BASE,wait_until='networkidle')
        page.wait_for_function('!document.querySelector("[data-start-step]").disabled')
        if w>850 and h>600:
            sale=page.locator('.bento-sale').bounding_box();stock=page.locator('.bento-stock').bounding_box();report=page.locator('.bento-reports').bounding_box()
            assert sale['height']>stock['height']*1.8 and stock['x']>sale['x']
            assert abs(stock['width']-report['width'])<1
        for section in ['#features','#workspace','#start','#data','.phone-section']:
            page.locator(section).evaluate('e=>scrollTo(0,e.offsetTop)')
            page.wait_for_timeout(60)
            assert page.locator(section).evaluate('e=>Math.abs(e.getBoundingClientRect().height-innerHeight)<1')
            assert page.locator(section+' .screen-content').evaluate('e=>e.scrollWidth<=e.clientWidth+1&&e.scrollHeight<=e.clientHeight+4'),section
        page.locator('#workspace').evaluate('e=>scrollTo(0,e.offsetTop)')
        for name,render,original,value in [('sale','sale','demo-sale.png','82 300 ₸'),('home','overview','demo-home.png','142 880 ₸'),('scene','catalog','demo-products.png','12 шт')]:
            page.locator(f'[data-screen="{name}"]').click()
            image=page.locator('#product-screen')
            image.evaluate('e=>e.decode()')
            assert image.get_attribute('src')==f'img/workspace-demo-{render}.webp'
            assert image.evaluate('e=>e.naturalWidth>=1024&&e.naturalHeight>=1400')
            assert page.locator('#product-screen-link').get_attribute('href')=='img/'+original
            assert page.locator('#product-fact-value').inner_text()==value
            assert page.locator('[data-screen][aria-pressed="true"]').count()==1
            assert page.locator('#workspace .screen-content').evaluate('e=>e.scrollHeight<=e.clientHeight+4')
        assert image.bounding_box()['height'] >= (390 if w==390 else 220 if w==320 else 210)
        page.locator('[data-screen="scene"]').focus();page.keyboard.press('End')
        assert page.locator('#product-screen-link').get_attribute('href')=='img/demo-home.png'
        page.keyboard.press('Home')
        assert page.locator('#product-screen-link').get_attribute('href')=='img/demo-products.png'
        page.locator('#product-screen-link').click();page.locator('#preview-dialog').wait_for(state='visible')
        assert page.locator('#preview-original').get_attribute('href').endswith('/img/demo-products.png')
        page.keyboard.press('Escape')
        page.wait_for_timeout(400)
        assert page.locator('.studio-demo').evaluate('e=>e.getAnimations({subtree:true}).every(a=>a.playState!=="running")')
        page.locator('#start').evaluate('e=>scrollTo(0,e.offsetTop)')
        for i in [2,1,0,1,2,1]:
            page.locator(f'[data-start-step="{i}"]').click()
        assert page.locator('[data-start-step][aria-pressed="true"]').count()==1
        assert page.locator('#start-screen').get_attribute('src')=='img/demo-products.png'
        assert page.locator('#start-screen-link').get_attribute('href')=='img/demo-products.png'
        page.locator('#start-screen').evaluate('e=>e.decode()')
        image=page.locator('#start-screen').bounding_box();frame=page.locator('.step-screen-link').bounding_box()
        assert image['height']>30 and image['height']<=frame['height']+1,{'image':image,'frame':frame}
        page.locator('[data-start-step="1"]').focus();page.keyboard.press('End')
        assert page.locator('.step-player').get_attribute('data-step')=='2'
        page.keyboard.press('Home');assert page.locator('.step-player').get_attribute('data-step')=='0'
        page.locator('[data-start-step="1"]').click()
        page.locator('#start-screen-link').click();page.locator('#preview-dialog').wait_for(state='visible')
        assert page.locator('#preview-original').get_attribute('href').endswith('/img/demo-products.png')
        page.keyboard.press('Escape')
        page.locator('#data').evaluate('e=>scrollTo(0,e.offsetTop)')
        for i in [2,0,2,1]:page.locator(f'[data-hub-node="{i}"]').click()
        assert 'без интернета' in page.locator('#hub-detail-copy').inner_text()
        assert page.locator('[data-hub-node][aria-pressed="true"]').count()==1
        page.locator('[data-hub-node="1"]').focus();page.keyboard.press('End')
        assert 'каждые 2 часа' in page.locator('#hub-detail-title').inner_text()
        assert 'отдельно' in page.locator('#hub-detail-copy').inner_text()
        # Nodes and center must not cover one another on a short phone.
        core=page.locator('.hub-core').bounding_box()
        for node in page.locator('[data-hub-node]').all():
            rect=node.bounding_box()
            overlap=min(core['x']+core['width'],rect['x']+rect['width'])-max(core['x'],rect['x'])>1 and min(core['y']+core['height'],rect['y']+rect['height'])-max(core['y'],rect['y'])>1
            assert not overlap,{'size':[w,h],'core':core,'node':rect}
        page.locator('.phone-section').evaluate('e=>scrollTo(0,e.offsetTop)')
        assert page.locator('.phone-card, #stack-toggle, .phone-stack').count()==0
        assert page.locator('[data-phone-screen]').count()==3
        image=page.locator('#phone-mockup')
        image.evaluate('e=>e.decode()')
        rect=image.bounding_box()
        displayed_height=min(rect['height'],rect['width']*1.5)
        assert displayed_height >= (420 if w==390 else 230 if w==320 else 210), {'size':[w,h],'image':rect}
        for i,source,render,metric in [(1,'demo-phone-search.png','mobile-demo-search.webp','7 шт'),(2,'demo-phone-cart.png','mobile-demo-cart.webp','40 550 ₸'),(0,'demo-phone.png','mobile-demo-overview.webp','396 950 ₸')]:
            page.locator(f'[data-phone-screen="{i}"]').click()
            image.evaluate('e=>e.decode()')
            assert image.get_attribute('src')=='img/'+render
            assert image.evaluate('e=>e.naturalWidth>=1024&&e.naturalHeight>=1536')
            assert page.locator('#phone-screen-link').get_attribute('href')=='img/'+source
            assert page.locator('[data-phone-screen][aria-pressed="true"]').count()==1
            assert page.locator('#scene-metric-value').inner_text()==metric
            assert page.locator('#scene-metric-value').evaluate('e=>e.scrollWidth<=e.clientWidth'),metric
        if w>850:
            page.locator('#phone-query-hotspot').click()
            assert page.locator('#phone-mockup').get_attribute('src')=='img/mobile-demo-search.webp'
        page.locator('[data-phone-screen="0"]').focus();page.keyboard.press('End')
        assert page.locator('#phone-screen-link').get_attribute('href')=='img/demo-phone-cart.png'
        image.evaluate('e=>e.decode()')
        page.locator('#phone-screen-link').click();page.locator('#preview-dialog').wait_for(state='visible')
        assert page.locator('#preview-original').get_attribute('href').endswith('/img/demo-phone-cart.png')
        page.keyboard.press('Escape')
        page.wait_for_timeout(350)
        assert page.locator('.phone-showcase').evaluate('e=>e.getAnimations({subtree:true}).every(a=>a.playState!=="running")')
        assert page.locator('canvas').count()==0
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        for selector,name in [('#features','bento'),('#workspace','workspace'),('#start','steps'),('#data','hub'),('.phone-section','phone')]:
            page.locator(selector).evaluate('e=>scrollTo(0,e.offsetTop)')
            page.wait_for_timeout(500)
            page.screenshot(path=str(OUT/f'{name}-{w}.png'))
        page.emulate_media(reduced_motion='reduce')
        assert page.locator('[data-phone-screen]').first.evaluate('e=>getComputedStyle(e).transitionDuration')=='0s'
        assert not errors,errors
        print(json.dumps({'browser':BROWSER,'viewport':[w,h],'workspaceScenes':'pass','stepsAndOriginals':'pass','hubNodes':'pass','generatedPhoneScenes':'pass','sectionFit':'pass','finiteMotion':'pass'}),flush=True)
        page.close()
    broken=b.new_page(viewport={'width':390,'height':844})
    broken.route('**/scripts/story.js*',lambda r:r.abort())
    broken.goto(BASE,wait_until='networkidle')
    assert broken.locator('#store-submit').is_enabled()
    assert broken.locator('[data-start-step]').first.is_disabled()
    assert broken.locator('#start-screen-link').get_attribute('href')=='img/demo-home.png'
    plain=b.new_page(viewport={'width':390,'height':844},java_script_enabled=False)
    plain.goto(BASE,wait_until='networkidle')
    assert plain.locator('#product-screen-link').get_attribute('href')=='img/demo-products.png'
    assert plain.locator('.screen-tabs').is_hidden()
    assert plain.locator('#phone-screen-link').get_attribute('href')=='img/demo-phone.png'
    assert plain.locator('.hub-footnote').inner_text().find('каждые 2 часа')>=0
    fallback=b.new_page(viewport={'width':390,'height':844},reduced_motion='reduce')
    fallback.route('**/img/workspace-*.webp',lambda r:r.abort())
    # The initial lazy image can fail before the enhancement module is ready.
    fallback.route('**/scripts/interface.js*',lambda r:r.fulfill(content_type='text/javascript',body='await new Promise(r=>setTimeout(r,400));\n'+Path('scripts/interface.js').read_text()))
    fallback.goto(BASE.split('#')[0]+'#workspace',wait_until='networkidle')
    for name,source in [('scene','demo-products.png'),('sale','demo-sale.png'),('home','demo-home.png')]:
        fallback.locator(f'[data-screen="{name}"]').click()
        fallback.wait_for_function('(source)=>document.querySelector("#product-screen").getAttribute("src")==="img/"+source',arg=source)
        fallback.locator('#product-screen').evaluate('e=>e.decode()')
        assert fallback.locator('#product-screen-link').get_attribute('href')=='img/'+source
        assert fallback.locator('#product-screen').evaluate('e=>e.getAnimations().length')==0
    b.close()
