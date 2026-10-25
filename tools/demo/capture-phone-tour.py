"""Capture the real phone product lookup for the landing's guided demonstration."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, os

ROOT = Path(__file__).resolve().parents[2]
HARNESS = Path(os.environ.get('DEMO_RENDER_DIR', '/workspace/scratch/demo-data-render'))
BASE = os.environ.get('DEMO_RENDER_URL', 'http://127.0.0.1:4174')
fixture = json.loads((HARNESS / 'fixture.json').read_text())
drill = fixture['catalog'][0]
product = {'id': drill['id'], 'name': drill['name'], 'price': '39 900 ₸', 'stock': '12', 'unit': 'шт', 'status': 'ok'}

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                            is_mobile=True, has_touch=True, reduced_motion='reduce', timezone_id='Asia/Almaty')
    page.clock.set_fixed_time('2026-10-24T12:30:00Z')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))

    def api(route):
        endpoint = route.request.url.split('/api/')[-1].split('?')[0]
        data = {
            'login': {'token': 'demo-capture-only'},
            'me': {'permissions': ['summary', 'find', 'cart', 'receive', 'count', 'history']},
            'summary': fixture['phoneSummary'],
            'snapshot': {'items': [product], 'at': fixture['now']},
            'search': {'items': [product]},
            'find': {'product': product},
            'cart/state': {'cart': {'lines': 1, 'total': '650 ₸', 'items': [{'id': 'disc', 'name': 'Диск отрезной 125×1,2', 'qty': '1 шт'}]}},
        }.get(endpoint, {})
        route.fulfill(json=data)

    page.route('**/api/**', api)
    page.goto(BASE + '/phone.html', wait_until='networkidle')
    page.locator('#pin').fill('4821')
    page.locator('#enter').click()
    page.locator('#work').wait_for(state='visible')
    page.locator('#mode-find').click()
    page.locator('#q').fill('Шуруповёрт')
    page.locator('#matches .pick').first.click()
    page.locator('#result-cart').wait_for(state='visible')
    assert '39' in page.locator('#result').inner_text()
    assert not errors, errors
    page.evaluate('scrollTo(0,0)')
    page.screenshot(path=str(ROOT / 'img/demo-phone-drill.png'))
    browser.close()
print('Captured native product lookup: drill, 39 900 ₸, 12 in stock; existing basket contains a 650 ₸ disc.')
