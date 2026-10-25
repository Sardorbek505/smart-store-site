"""Complete source objects and uncropped painted bounds across landing sections."""
from pathlib import Path
from urllib.parse import urlparse
import json, os, shutil
from PIL import Image
from playwright.sync_api import sync_playwright

BASE = os.environ.get('SITE_TEST_URL', 'http://127.0.0.1:4173')
BROWSER = os.environ.get('BROWSER', 'chromium')
OUT = Path('/tmp/smart-store-full') / BROWSER
OUT.mkdir(parents=True, exist_ok=True)
assets = [*Path('img').glob('hero-demo-*.webp'), *Path('img').glob('hero-full-scanner-*.webp'), *Path('img').glob('workspace-demo-*.webp'),
          *Path('img').glob('mobile-demo-*.webp'), *Path('img').glob('feature-*.webp'), Path('img/data-local-scene.webp')]
bounds = {}
for asset in assets:
    image = Image.open(asset).convert('RGBA')
    # Ignore soft contact shadows, retain the opaque body of every object.
    box = image.getchannel('A').point(lambda alpha: 255 if alpha >= 240 else 0).getbbox()
    assert box and box[0] >= 2 and box[1] >= 2 and box[2] <= image.width-2 and box[3] <= image.height-2, (asset.name, box, image.size)
    bounds[asset.name] = {'box': list(box), 'width': image.width, 'height': image.height}
for name in ['demo-home.png', 'demo-products.png', 'demo-sale.png','demo-payment.png']:
    image = Image.open(Path('img')/name)
    bounds[name] = {'box': [0, 0, image.width, image.height], 'width': image.width, 'height': image.height}
assert len(assets) == 21, 'Responsive hero scenes, workspace scenes, four phone scenes, features and local-data scene'

PAINT = '''(image, asset) => {
  const box=asset.box;
  const rect=image.getBoundingClientRect(), css=getComputedStyle(image);
  const left=parseFloat(css.paddingLeft)+parseFloat(css.borderLeftWidth);
  const top=parseFloat(css.paddingTop)+parseFloat(css.borderTopWidth);
  const width=rect.width-left-parseFloat(css.paddingRight)-parseFloat(css.borderRightWidth);
  const height=rect.height-top-parseFloat(css.paddingBottom)-parseFloat(css.borderBottomWidth);
  // srcset naturalWidth is density-corrected; bounds use physical raster pixels.
  const scale=(css.objectFit==='cover'?Math.max:Math.min)(width/asset.width,height/asset.height);
  const x=rect.left+left+(width-asset.width*scale)/2;
  const y=rect.top+top+(height-asset.height*scale)/2;
  const subject={left:x+box[0]*scale,top:y+box[1]*scale,right:x+box[2]*scale,bottom:y+box[3]*scale};
  const failures=[];
  for(let parent=image.parentElement;parent&&parent!==document.body;parent=parent.parentElement){
    const s=getComputedStyle(parent),r=parent.getBoundingClientRect();
    if(['hidden','clip','auto','scroll'].includes(s.overflowX)&&(subject.left<r.left-1||subject.right>r.right+1))failures.push({axis:'x',parent:parent.className,rect:r.toJSON()});
    if(['hidden','clip','auto','scroll'].includes(s.overflowY)&&(subject.top<r.top-1||subject.bottom>r.bottom+1))failures.push({axis:'y',parent:parent.className,rect:r.toJSON()});
  }
  if(image.closest('.gallery-card')){
    const r=document.querySelector('.ribbon-window').getBoundingClientRect();
    // The curve's narrowest opening is 10%..90%; the whole subject must fit it.
    if(subject.top<r.top+r.height*.10-1||subject.bottom>r.top+r.height*.90+1)failures.push({aperture:r.toJSON()});
  }
  return {subject,failures,fit:css.objectFit};
}'''

def check(image):
    image.evaluate('e=>e.decode()')
    name=Path(urlparse(image.evaluate('e=>e.currentSrc')).path).name
    result=image.evaluate(PAINT, bounds[name])
    assert not result['failures'], {'image': name, **result}

with sync_playwright() as p:
    launch={'headless':True}
    if BROWSER=='chromium':launch.update(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
    browser=getattr(p,BROWSER).launch(**launch)
    for w,h in [(320,568),(390,844),(844,390),(1440,900)]:
        page=browser.new_page(viewport={'width':w,'height':h},is_mobile=w<851,has_touch=w<851,reduced_motion='reduce')
        page.goto(BASE,wait_until='networkidle')
        page.locator('.hero-gallery').focus()
        for i in range(5):
            check(page.locator('[data-gallery-card] .editorial-photo').nth(i))
            page.keyboard.press('ArrowRight')
        page.keyboard.press('ArrowLeft')
        check(page.locator('[data-gallery-card] .editorial-photo').last)
        page.keyboard.press('ArrowRight')
        page.locator('#features').evaluate('e=>e.scrollIntoView()')
        for art in page.locator('#features .feature-art img').all():
            art.evaluate('e=>e.closest("article").scrollIntoView({block:"nearest",inline:"center",behavior:"instant"})')
            if w>850:art.hover()
            check(art)
        page.locator('#workspace').evaluate('e=>e.scrollIntoView()')
        check(page.locator('#product-screen'))
        page.locator('#mobile').evaluate('e=>e.scrollIntoView()')
        for i in range(3):
            check(page.locator('#phone-mockup'))
            page.locator('#phone-demo-action').click()
            page.wait_for_function('(n)=>document.querySelector(".mobile-story").dataset.phoneStep===String(n)',arg=(i+1)%3)
        page.locator('#start').evaluate('e=>e.scrollIntoView()')
        for art in page.locator('.journey-art img').all(): check(art)
        page.locator('#data').evaluate('e=>e.scrollIntoView()')
        check(page.locator('.data-scene img'))
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        for selector,name in [('.cinema-hero','hero'),('#workspace','workspace'),('#mobile','phone')]:
            page.locator(selector).evaluate('e=>e.scrollIntoView()')
            page.screenshot(path=str(OUT/f'{name}-{w}.png'))
        print(json.dumps({'browser':BROWSER,'viewport':[w,h],'completeSourceAssets':len(assets),'paintedSubjects':'inside clips','heroAperture':'fits','allSceneStates':'pass'}),flush=True)
        page.close()
    browser.close()
