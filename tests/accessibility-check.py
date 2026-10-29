"""WCAG checks for the public pages and visible motion control; services are stubs."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,os,shutil
ROOT=Path(__file__).resolve().parents[1]
BASE=os.environ.get('SITE_TEST_URL','http://127.0.0.1:4173').rstrip('/')
BROWSER=os.environ.get('BROWSER','chromium')
AXE=Path(os.environ.get('AXE_PATH',str(ROOT/'node_modules/axe-core/axe.min.js'))).read_text()
OUT=ROOT/'test-results';OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
    opts={'headless':True}
    if BROWSER=='chromium':opts.update(executable_path=shutil.which('chromium'),args=['--no-sandbox','--enable-unsafe-swiftshader'])
    b=getattr(p,BROWSER).launch(**opts)
    for width in [390,1440]:
        c=b.new_context(viewport={'width':width,'height':900},reduced_motion='reduce')
        for host in ['zavod.metov.store','connect.metov.store','api.github.com']:c.route('https://'+host+'/**',lambda r:r.fulfill(status=204))
        pages=json.loads((ROOT/'tools/pages.json').read_text())
        for item in [p for p in pages if p.get('canonical')]:
            path=item['canonical'].removeprefix('https://metov.store')
            page=c.new_page();page.goto(BASE+path,wait_until='networkidle');page.evaluate(AXE)
            result=page.evaluate('async()=>await axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21aa","wcag22aa","best-practice"]}})')
            (OUT/f'axe-{width}-{path.replace("/","_")}.json').write_text(json.dumps(result))
            failures=[{'id':v['id'],'impact':v['impact'],'targets':[n['target'] for n in v['nodes']]} for v in result['violations']]
            assert not failures,(width,path,failures)
            print(json.dumps({'browser':BROWSER,'width':width,'path':path,'axeViolations':0}),flush=True)
            if path=='/':
                page.emulate_media(reduced_motion='no-preference')
                page.locator('.ribbon-pause').wait_for(state='visible')
                result=page.evaluate('async()=>await axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21aa","wcag22aa","best-practice"]}})')
                assert not result['violations'],(width,'motion-control',result['violations'])
                page.locator('a[href="#store"]').first.evaluate('e=>e.click()')
                page.wait_for_function('()=>document.getElementById("store").open')
                result=page.evaluate('async()=>await axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21aa","wcag22aa","best-practice"]}})')
                assert not result['violations'],(width,'store-dialog',result['violations'])
            page.close()
        c.close()
    b.close()
