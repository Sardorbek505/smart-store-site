"""Real subject bounds remain visible and clear of the UI in each photo layout."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import os,shutil,json
bounds={('sale','square'):(644/1254,978/1254,1065/1254,1116/1254),('stock','square'):(603/1254,920/1254,934/1254,1118/1254),('reports','square'):(655/1254,955/1254,901/1254,1119/1254),('sale','wide'):(985/1536,703/1024,1411/1536,844/1024),('stock','wide'):(1065/1536,693/1024,1358/1536,865/1024),('reports','wide'):(1040/1536,682/1024,1310/1536,858/1024)}
out=Path(os.environ.get('PHOTO_ARTIFACTS','/tmp/smart-store-feature-photos'));out.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
 for w,h in [(320,568),(390,844),(768,1024),(844,390),(851,768),(1024,600),(1440,500),(1440,900)]:
  page=b.new_page(viewport={'width':w,'height':h},reduced_motion='reduce',is_mobile=w<851,has_touch=w<851,device_scale_factor=2)
  for host in ['zavod.metov.store','connect.metov.store','api.github.com']:page.route('https://'+host+'/**',lambda r:r.fulfill(status=204))
  page.goto(os.environ.get('SITE_TEST_URL','http://127.0.0.1:4173')+'/#features',wait_until='networkidle')
  page.locator('#features').evaluate('e=>scrollTo(0,e.offsetTop)')
  for key in ['sale','stock','reports']:
   e=page.locator('[data-micro='+key+']');e.evaluate('e=>e.closest("article").scrollIntoView({block:"nearest",inline:"center",behavior:"instant"})')
   g=e.evaluate('e=>({s:e.getBoundingClientRect().toJSON(),f:e.querySelector(".micro-frame").getBoundingClientRect().toJSON(),bg:getComputedStyle(e.querySelector(".micro-backdrop-layer")).backgroundImage})')
   s,f=g['s'],g['f'];fmt='wide' if '-wide-' in g['bg'] else 'square';bw,bh=(1536,1024) if fmt=='wide' else(1254,1254)
   a,bb,cc,d=bounds[key,fmt];scale=max(s['width']/bw,s['height']/bh);px,py=(.7,.5) if fmt=='wide' else(.5,1)
   x=s['left']+(s['width']-bw*scale)*px;y=s['top']+(s['height']-bh*scale)*py
   r={'left':x+a*bw*scale,'top':y+bb*bh*scale,'right':x+cc*bw*scale,'bottom':y+d*bh*scale}
   clear=max(r['left']-f['right'],f['left']-r['right'],r['top']-f['bottom'],f['top']-r['bottom'])>=0
   inside=r['left']>=s['left']-1 and r['right']<=s['right']+1 and r['top']>=s['top']-1 and r['bottom']<=s['bottom']+1
   assert clear and inside,(w,h,key,r,f)
   print(json.dumps({'size':[w,h],'key':key,'format':fmt,'clear':clear,'inside':inside,'subject':r if not clear or not inside else None}),flush=True)
  if w in [390,1440]:
   page.locator('.bento-grid').evaluate('e=>e.scrollTo({left:0,behavior:"instant"})')
   page.screenshot(path=str(out/f'smart-store-feature-series-v78-{w}.png'))
  page.close()
 b.close()
