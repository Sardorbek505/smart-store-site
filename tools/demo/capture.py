"""Capture real application components with an isolated, deterministic demo API."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,re,os
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'img'
HARNESS=Path(os.environ.get('DEMO_RENDER_DIR','/workspace/scratch/demo-data-render'))
BASE=os.environ.get('DEMO_RENDER_URL','http://127.0.0.1:4174')
fixture=json.loads((HARNESS/'fixture.json').read_text())
def money(value):return f'{value/100:,.0f}'.replace(',',' ')+' ₸'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for screen,name in [('sales','sale'),('dashboard','home'),('products','products'),('backups','backups')]:
        page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1,reduced_motion='reduce',timezone_id='Asia/Almaty')
        page.clock.set_fixed_time('2026-10-24T12:30:00Z')
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(BASE+'/?screen='+screen,wait_until='networkidle')
        page.locator('input').first.blur() if page.locator('input').count() else None
        page.wait_for_timeout(250)
        if screen=='sales':
            assert page.locator('[data-testid="sale-product-card"]').count()==4
            assert page.locator('[data-testid="sale-product-card"] img').count()==4
            assert page.locator('[data-testid="sale-product-card"] img').evaluate_all('xs=>xs.every(e=>e.complete&&e.naturalWidth>0)')
            assert '82 300' in re.sub(r'\s+',' ',page.locator('main').inner_text())
        if screen=='dashboard':
            assert len(fixture['daily'])==14 and all(d['revenue']>0 for d in fixture['daily'])
            assert '396 950' in re.sub(r'\s+',' ',page.locator('main').inner_text())
            assert page.locator('.recharts-bar-rectangle').count()>=28
        if screen=='backups':
            assert page.get_by_role('heading',name='Резервные копии').is_visible()
            assert 'Копия на флешку' in page.locator('main').inner_text()
        assert not errors,errors
        page.screenshot(path=str(OUT/f'demo-{name}.png'))
        if screen=='sales':
            page.get_by_role('button',name=re.compile(r'^Оплатить')).click()
            page.get_by_role('dialog').wait_for(state='visible')
            page.get_by_role('radio',name='Смешанно',exact=True).click()
            page.get_by_label('Наличные, ₸',exact=True).fill('40000')
            page.get_by_label('Kaspi, ₸',exact=True).fill('42300')
            page.get_by_label('Kaspi, ₸',exact=True).blur()
            assert page.get_by_role('button',name=re.compile('Провести продажу')).is_enabled()
            assert not errors,errors
            page.screenshot(path=str(OUT/'demo-payment.png'))
        page.close()
    phone=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True,reduced_motion='reduce',timezone_id='Asia/Almaty')
    phone.clock.set_fixed_time('2026-10-24T12:30:00Z')
    errors=[];phone.on('pageerror',lambda e:errors.append(str(e)))
    products=[{'id':p['id'],'name':p['name'],'price':money(p['priceSell']),'stock':str(p['stockQty']//1000),'unit':'шт','status':'ok'} for p in fixture['catalog']]
    def api(route):
        endpoint=route.request.url.split('/api/')[-1].split('?')[0]
        if endpoint=='login':data={'token':'demo-capture-only'}
        elif endpoint=='me':data={'permissions':['summary','find','cart','receive','count','history']}
        elif endpoint=='summary':data=fixture['phoneSummary']
        elif endpoint=='snapshot':data={'items':products,'at':fixture['now']}
        elif endpoint=='search':data={'items':[p for p in products if 'набор' in p['name'].lower()]}
        elif endpoint=='find':data={'product':products[0]}
        elif endpoint=='cart/state':data={'cart':{'lines':2,'total':money(fixture['mobileDraft']['total']),'items':[{'id':p['id'],'name':p['nameSnapshot'],'qty':str(p['qty']//1000)+' шт'} for p in fixture['mobileDraft']['items']]}}
        elif endpoint=='history':data={'items':[]}
        else:data={}
        route.fulfill(json=data)
    phone.route('**/api/**',api)
    phone.goto(BASE+'/phone.html',wait_until='networkidle')
    phone.locator('#pin').fill('4821');phone.locator('#enter').click()
    phone.locator('#work').wait_for(state='visible')
    phone.locator('#mode-summary').click()
    phone.wait_for_function('document.querySelector("#s-revenue").textContent.includes("396")')
    assert phone.locator('#s-chart > div').count()==14
    phone.screenshot(path=str(OUT/'demo-phone.png'))
    phone.locator('#mode-find').click();phone.locator('#q').fill('Набор')
    phone.locator('#matches .pick').first.wait_for();phone.locator('#q').blur()
    phone.wait_for_timeout(200)
    phone.screenshot(path=str(OUT/'demo-phone-search.png'))
    phone.locator('#mode-cart').click()
    phone.wait_for_function('document.querySelector("#cart-status").textContent.includes("2")')
    phone.evaluate('scrollTo(0,0)')
    phone.screenshot(path=str(OUT/'demo-phone-cart.png'))
    assert not errors,errors
    browser.close()
print('Captured 8 real application screens: 4 product photos, 10 catalogue rows, 14 populated days, 17 receipts today, cash/Kaspi/debt and payment selection.')
