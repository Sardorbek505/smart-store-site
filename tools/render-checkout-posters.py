"""Render the real 3D camera endpoints to transparent WebP fallback posters. Requires local server, Playwright, Chromium and Pillow."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image
import json,base64,os,tempfile
ROOT=Path(__file__).resolve().parents[1];bundle=json.loads((ROOT/'assets/checkout-script.json').read_text())[0]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':800,'height':600},device_scale_factor=2)
 page.route('**/app.js*',lambda r:r.fulfill(content_type='text/javascript',body=''))
 page.goto(os.environ.get('SITE_TEST_URL','http://127.0.0.1:4173'),wait_until='networkidle')
 page.evaluate('''async bundle=>{document.body.innerHTML='';document.body.style.cssText='margin:0;background:transparent';const c=document.createElement('canvas');c.id='capture-canvas';c.style.cssText='display:block;width:800px;height:600px';document.body.append(c);const m=await import('/assets/'+bundle);window.scene=await m.createCheckoutScene({canvas:c});scene.resize(800,600,2)}''',bundle)
 for view in ['overview','0','1','2']:
  encoded=page.evaluate('(v)=>{scene.focus(v);scene.draw(1);return document.getElementById("capture-canvas").toDataURL("image/png").split(",")[1]}',view)
  png=Path(tempfile.gettempdir())/f'checkout-{view}.png';png.write_bytes(base64.b64decode(encoded))
  im=Image.open(png).convert('RGBA')
  if view=='overview':
   box=im.getchannel('A').point(lambda x:255 if x>=240 else 0).getbbox()
   assert box and min(box[:2])>=2 and box[2]<=im.width-2 and box[3]<=im.height-2,('Clipped overview',box)
  out=ROOT/'img'/f'checkout-{view}-v46.webp';im.save(out,quality=91,method=6)
  print(view,im.size,out.stat().st_size,page.evaluate('scene.stats()'),flush=True)
 page.evaluate('scene.dispose()');b.close()
