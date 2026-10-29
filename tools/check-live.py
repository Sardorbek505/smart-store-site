"""Read-only publication checks. No analytics writes, store lookups or messages."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
from html.parser import HTMLParser
from pathlib import Path
from time import monotonic
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from urllib.parse import urlsplit, urljoin
import json, re, xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
BASE='https://metov.store'
PAGES=json.loads((ROOT/'tools/pages.json').read_text())
CANONICAL=[p['canonical'] for p in PAGES if p.get('canonical')]

class HTML(HTMLParser):
    def __init__(self,text):
        super().__init__();self.canonical=[];self.assets=[];self.noindex=False;self.feed(text)
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='link' and a.get('rel')=='canonical':self.canonical.append(a.get('href'))
        if tag=='link' and a.get('rel')=='stylesheet':self.assets.append(a.get('href'))
        if tag=='script' and a.get('src'):self.assets.append(a['src'])
        if tag=='meta' and a.get('name')=='robots' and 'noindex' in a.get('content','').lower():self.noindex=True

def own_url(path):
    url=urljoin(BASE+'/',path);p=urlsplit(url)
    if p.scheme!='https' or p.netloc!='metov.store' or p.username or p.password:
        raise ValueError('Unexpected external resource in publication')
    return url

def read(url,wanted=200,opener=None):
    opener=opener or urlopen
    url=own_url(url)
    request=Request(url,headers={'User-Agent':'SmartStoreHealthCheck/2.0','Cache-Control':'no-cache'})
    try:r=opener(request,timeout=12)
    except HTTPError as e:r=e
    with r:
        data=r.read(2_000_001)
        assert len(data)<=2_000_000, (url,'unexpected body size')
        assert r.status==wanted,(url,r.status,wanted)
        assert r.url==url,(url,'unexpected redirect',r.url)
        suffix=Path(urlsplit(url).path).suffix
        if suffix in ['.js','.css']:
            mime=r.headers.get('Content-Type','').split(';')[0].strip().lower()
            expected=['text/css'] if suffix=='.css' else ['application/javascript','text/javascript','application/x-javascript']
            assert mime in expected,(url,'unexpected asset content type',mime)
            assert not re.match(rb'\s*<(?:!doctype|html)',data[:128],re.I),(url,'HTML served as an asset')
        return data

def security_contact(text,now=None):
    now=now or datetime.now(timezone.utc)
    fields={}
    for line in text.splitlines():
        if not line or line.startswith('#'):continue
        key,sep,value=line.partition(':')
        assert sep, 'Invalid security.txt field'
        fields.setdefault(key,[]).append(value.strip())
    assert fields.get('Canonical')==[BASE+'/.well-known/security.txt']
    assert fields.get('Contact')==[BASE+'/privacy.html#data-requests']
    assert len(fields.get('Expires',[]))==1, 'Missing or duplicate security.txt expiry'
    expires=datetime.fromisoformat(fields['Expires'][0].replace('Z','+00:00'))
    assert expires.tzinfo, 'security.txt expiry must have a timezone'
    assert now+timedelta(days=14)<expires<=now+timedelta(days=366),'Renew security.txt before it expires'
    return expires.isoformat()

def check_page(page,opener=None):
    started=monotonic();url=page['canonical'];data=read(url,opener=opener);text=data.decode('utf-8')
    assert page['marker'] in text,(url,'unexpected page')
    html=HTML(text)
    assert html.canonical==[url] and not html.noindex,(url,'canonical/noindex')
    assets=[]
    for ref in html.assets:
        asset=own_url(urljoin(url,ref))
        path=urlsplit(asset).path
        assert re.fullmatch(r'/(?:assets/[a-z0-9.-]+\.css|(?:scripts/[a-z0-9-]+|app)\.js)',path),(url,'unexpected executable/style path')
        assets.append(asset)
    return {'path':url.removeprefix(BASE),'status':200,'seconds':round(monotonic()-started,2)},assets

def main():
    assets=set()
    with ThreadPoolExecutor(max_workers=3) as pool:
        for result,refs in pool.map(check_page,[p for p in PAGES if p.get('canonical')]):
            assets.update(refs);print(json.dumps(result),flush=True)
    for url in sorted(assets):
        assert read(url).strip(),(url,'empty entry script/style')
        print(json.dumps({'asset':url,'status':200}),flush=True)
    # Entry imports are versioned together. Verify the mandatory runtime modules
    # as well as the entry file; a 200 HTML shell alone is not a working landing.
    entry=next((u for u in assets if urlsplit(u).path=='/app.js'),None)
    assert entry, 'Missing landing entry module'
    query=('?'+urlsplit(entry).query) if urlsplit(entry).query else ''
    for name in ['core','interface','store','downloads']:
        assert read(BASE+'/scripts/'+name+'.js'+query).strip(),(name,'empty runtime module')
    robots=read(BASE+'/robots.txt').decode();assert 'Sitemap: '+BASE+'/sitemap.xml' in robots
    sitemap=ET.fromstring(read(BASE+'/sitemap.xml'))
    urls=[e.text for e in sitemap.findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
    assert sorted(urls)==sorted(CANONICAL),'Published sitemap does not match the page registry'
    assert read(BASE+'/llms.txt').decode().startswith('# Smart Store')
    assert 'Такой страницы нет.' in read(BASE+'/health-check-page-that-does-not-exist',404).decode()
    expires=security_contact(read(BASE+'/.well-known/security.txt').decode())
    print(json.dumps({'crawlFiles':'pass','real404':'pass','securityContactExpires':expires}),flush=True)

if __name__=='__main__':main()
