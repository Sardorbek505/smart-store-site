"""AI illustrations load responsively without invoking live AI services."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import os,shutil,json
BROWSER=os.environ.get('BROWSER','chromium')
BASE=os.environ.get('SITE_TEST_URL','http://127.0.0.1:4173')
with sync_playwright() as p:
    options={'headless':True}
    if BROWSER=='chromium':options.update(executable_path=shutil.which('chromium'),args=['--no-sandbox','--enable-unsafe-swiftshader'])
    browser=getattr(p,BROWSER).launch(**options)
    for width in [390,1440]:
        c=browser.new_context(viewport={'width':width,'height':900},reduced_motion='reduce')
        unexpected=[]
        def external(route):
            host=route.request.url.split('/')[2]
            if host not in ['zavod.metov.store','connect.metov.store','api.github.com']:unexpected.append(host)
            route.fulfill(status=204)
        c.route('https://**',external)
        page=c.new_page();page.goto(BASE,wait_until='networkidle')
        page.wait_for_function('()=>document.querySelector(".gallery-stage").dataset.ready==="true"')
        assert page.locator('[data-gallery-card]').count()==5
        assert page.locator('.ribbon-pause').count()==0
        for index,feature in [(1,'assistant'),(3,'invoice'),(4,'promo')]:
            card=page.locator('[data-gallery-card]').nth(index)
            assert card.locator('.gallery-card-caption').is_visible()
            card.evaluate('e=>e.click()')
            page.wait_for_function('()=>document.getElementById("preview-dialog").open')
            page.wait_for_function('()=>{const i=document.getElementById("preview-image");return !i.hidden&&i.complete&&i.naturalWidth>0}')
            assert page.locator('#preview-image').get_attribute('src').endswith('hero-ai-'+feature+'-source-v91.png')
            page.keyboard.press('Escape')
            page.wait_for_function('()=>!document.getElementById("preview-dialog").open')
        page.locator('#assistant').scroll_into_view_if_needed()
        assert page.locator('#assistant input,#assistant textarea,#assistant button').count()==0
        assert 'демоданных' in page.locator('.assistant-scene figcaption').inner_text()
        assert page.locator('#site-nav a[href="#assistant"]').count()==1
        visual=page.locator('.assistant-scene>img')
        visual.evaluate('(i)=>i.decode()')
        assert visual.evaluate('(i)=>i.naturalWidth>0 && i.getBoundingClientRect().width>=Math.min(300,innerWidth-36)')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        assert not unexpected,unexpected
        print(json.dumps({'width':width,'AIImagePreviews':'pass','assistantScene':'loaded, no AI request'}),flush=True)
        c.close()
    browser.close()
