"""Notify participating search engines after the matching Pages deploy.

Default is a dry run. --submit verifies the published key and changed pages
before one notification. It never runs in the browser or on each site visit.
The hosted key proves control of the domain; it is not a private account token.
"""
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
import argparse, json, re, sys, time, xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
CONFIG = json.loads((ROOT/'tools/indexnow.json').read_text())
BASE = 'https://metov.store/'

def payload():
    assert CONFIG['host']=='metov.store'
    name=CONFIG['keyFile']
    assert re.fullmatch(r'[a-f0-9]{32}\.txt',name)
    key=(ROOT/name).read_text().strip()
    assert key+'.txt'==name
    urls=[e.text for e in ET.parse(ROOT/'sitemap.xml').findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
    assert urls and all(u.startswith(BASE) and '?' not in u and '#' not in u for u in urls)
    return {'host':CONFIG['host'],'key':key,'keyLocation':BASE+name,'urlList':urls}

class PublicationPending(RuntimeError):
    pass

def verify_published(data):
    headers={'User-Agent':'SmartStorePublicationCheck/1.0','Cache-Control':'no-cache'}
    with urlopen(Request(data['keyLocation'],headers=headers),timeout=15) as response:
        if response.status!=200 or response.url!=data['keyLocation'] or response.read(256).decode().strip()!=data['key']:
            raise PublicationPending('Published ownership file does not match; wait for Pages')
    for url in data['urlList']:
        local=ROOT/('index.html' if url==BASE else url.removeprefix(BASE))
        if local.is_dir():local=local/'index.html'
        with urlopen(Request(url,headers=headers),timeout=15) as response:
            if response.status!=200 or response.url!=url or response.read(2_000_000)!=local.read_bytes():
                raise PublicationPending(f'Published page does not match this checkout: {url}')

def wait_for_publication(data, seconds):
    deadline=time.monotonic()+seconds
    while True:
        try:
            verify_published(data)
            return
        except HTTPError as error:
            # Do not retry authentication failures or API rate limits.
            if error.code!=404 and not 500<=error.code<=599:
                raise
            failure=error
        except (PublicationPending, URLError, TimeoutError) as error:
            failure=error
        remaining=deadline-time.monotonic()
        if remaining<=0:
            raise PublicationPending('The expected Pages publication is not ready; no notification sent') from failure
        print('Waiting for the matching Pages publication…',file=sys.stderr,flush=True)
        time.sleep(min(10,remaining))

def submit(data, wait_seconds=0):
    wait_for_publication(data,wait_seconds)
    request=Request('https://api.indexnow.org/indexnow',data=json.dumps(data).encode(),headers={'Content-Type':'application/json; charset=utf-8','User-Agent':'SmartStorePublicationCheck/1.0'},method='POST')
    try:
        with urlopen(request,timeout=20) as response:status=response.status
    except HTTPError as error:
        raise RuntimeError(f'IndexNow returned HTTP {error.code}; no automatic retry') from None
    assert status in [200,202], ('Unexpected IndexNow response',status)
    return {'status':status,'urls':data['urlList'],'result':'received' if status==200 else 'received; ownership validation pending','note':'Receipt does not guarantee indexing or ranking.'}

def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--submit',action='store_true',help='Send one notification after verifying the published files')
    parser.add_argument('--wait-for-publish',type=int,default=0,metavar='SECONDS',help='Retry publication reads for up to 300 seconds; never retry the notification')
    args=parser.parse_args(argv)
    if not 0<=args.wait_for_publish<=300:parser.error('--wait-for-publish must be between 0 and 300 seconds')
    data=payload()
    if args.submit:print(json.dumps(submit(data,args.wait_for_publish),ensure_ascii=False))
    else:print(json.dumps({'mode':'dry-run','urls':data['urlList']},ensure_ascii=False))

if __name__=='__main__':main()
