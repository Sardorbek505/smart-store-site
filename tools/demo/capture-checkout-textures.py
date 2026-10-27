"""Export dense screen textures from the isolated real-application harness."""
from playwright.sync_api import sync_playwright
from pathlib import Path
from PIL import Image
from io import BytesIO
import re,os
ROOT=Path(__file__).resolve().parents[2]
BASE=os.environ.get('DEMO_RENDER_URL','http://127.0.0.1:4174')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':900},device_scale_factor=2,reduced_motion='reduce',timezone_id='Asia/Almaty')
 page.clock.set_fixed_time('2026-10-24T12:30:00Z')
 page.goto(BASE+'/?screen=sales',wait_until='networkidle')
 page.locator('input').first.blur()
 assert page.locator('[data-testid="sale-product-card"] img').count()==4
 assert page.locator('[data-testid="sale-product-card"] img').evaluate_all('xs=>xs.every(e=>e.complete&&e.naturalWidth>0)')
 assert '82 300' in re.sub(r'\s+',' ',page.locator('main').inner_text())
 def save(name):
  image=Image.open(BytesIO(page.screenshot())).convert('RGB')
  assert image.size==(2880,1800)
  path=ROOT/'img'/f'checkout-{name}-2x-v56.webp';image.save(path,lossless=True,method=6)
  print(name,image.size,path.stat().st_size,flush=True)
 save('sale')
 page.get_by_role('button',name=re.compile(r'^Оплатить')).click()
 page.get_by_role('radio',name='Смешанно',exact=True).click()
 page.get_by_label('Наличные, ₸',exact=True).fill('40000')
 page.get_by_label('Kaspi, ₸',exact=True).fill('42300');page.get_by_label('Kaspi, ₸',exact=True).blur()
 assert page.get_by_role('button',name=re.compile('Провести продажу')).is_enabled()
 save('payment')
 b.close()
