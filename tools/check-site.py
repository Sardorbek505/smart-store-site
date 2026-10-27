"""Static publication checks. Uses only the Python standard library in CI."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit, unquote
from urllib.robotparser import RobotFileParser
import json, re, xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://metov.store/'
GUIDE = 'programma-dlya-magazina-instrumentov/'
PAGES = ['index.html', 'privacy.html', '404.html', 'demo/index.html', GUIDE+'index.html']
PUBLIC = {'index.html': BASE, 'privacy.html': BASE + 'privacy.html', GUIDE+'index.html': BASE+GUIDE}

class Page(HTMLParser):
    def __init__(self, source):
        super().__init__(); self.tags=[]; self.ids=[]; self.headings=[]; self.scripts=[]; self.active=None; self.text=''
        self.feed(source)
    def handle_starttag(self, tag, attrs):
        a=dict(attrs); self.tags.append((tag,a))
        if 'id' in a:self.ids.append(a['id'])
        if tag in ['h1','h2','h3','title','script']:self.active=(tag,a);self.text=''
    def handle_data(self, data):
        if self.active:self.text+=data
    def handle_endtag(self, tag):
        if self.active and self.active[0]==tag:
            if tag=='script':self.scripts.append((self.active[1],self.text))
            else:self.headings.append((tag,self.text.strip()))
            self.active=None
    def meta(self, key):
        return [a.get('content','') for tag,a in self.tags if tag=='meta' and (a.get('name')==key or a.get('property')==key or a.get('http-equiv')==key)]
    def links(self, rel):return [a.get('href') for tag,a in self.tags if tag=='link' and a.get('rel')==rel]

parsed={name:Page((ROOT/name).read_text()) for name in PAGES}
seen_titles=set(); references=0
for name,page in parsed.items():
    assert len(page.ids)==len(set(page.ids)), (name,'duplicate IDs')
    title=[v for tag,v in page.headings if tag=='title'];assert len(title)==1 and title[0] not in seen_titles,(name,'title');seen_titles.update(title)
    assert any(t=='html' and a.get('lang')=='ru' for t,a in page.tags),(name,'language')
    assert len(page.meta('viewport'))==1,(name,'viewport')
    assert len(page.meta('Content-Security-Policy'))==1,(name,'CSP')
    assert 'frame-ancestors' not in page.meta('Content-Security-Policy')[0], 'This directive needs a real HTTP header'
    if name!='demo/index.html':
        assert len([1 for tag,text in page.headings if tag=='h1' and text])==1,(name,'one H1')
        assert len(page.meta('description'))==1 and len(page.meta('description')[0])>=40,(name,'description')
    if name in PUBLIC:
        assert page.links('canonical')==[PUBLIC[name]],(name,'canonical')
        assert not any('noindex' in v.lower() for v in page.meta('robots')),(name,'unexpected noindex')
        for key in ['og:title','og:description','og:image','og:url','twitter:card']:assert len(page.meta(key))==1,(name,key)
        assert page.meta('og:url')==[PUBLIC[name]],(name,'OG URL')
    if name=='404.html':assert any('noindex' in v for v in page.meta('robots'))
    previous=0
    for tag,text in page.headings:
        if tag not in ['h1','h2','h3']:continue
        rank=int(tag[1]);assert rank<=previous+1,(name,'heading hierarchy',text);previous=rank
    for attrs,text in page.scripts:
        if attrs.get('type')=='application/ld+json':assert json.loads(text)['@context']=='https://schema.org'
        if 'src' in attrs:assert not urlsplit(attrs['src']).netloc,(name,'unexpected executable third-party script')
    for tag,a in page.tags:
        assert not any(key.lower().startswith('on') for key in a),(name,'inline event handler')
        if tag=='img':assert 'alt' in a,(name,'missing alt')
        refs=[a[k] for k in ['href','src','poster','data-preview-src'] if a.get(k)]
        if tag=='meta' and (a.get('property')=='og:image' or a.get('name')=='twitter:image'):refs.append(a['content'])
        if 'srcset' in a:refs += [part.strip().split()[0] for part in a['srcset'].split(',') if part.strip()]
        for ref in refs:
            url=urlsplit(urljoin(BASE+('' if name=='index.html' else name),ref))
            if url.scheme not in ['https','http']:continue
            assert url.scheme=='https',(name,'insecure resource',ref)
            if url.netloc!='metov.store':continue
            target=ROOT/unquote(url.path).lstrip('/')
            if target.is_dir():target=target/'index.html'
            assert target.is_file(),(name,'missing resource',ref)
            references+=1
            if url.fragment and target.suffix=='.html':
                rel=target.relative_to(ROOT).as_posix();other=parsed.get(rel) or Page(target.read_text());assert unquote(url.fragment) in other.ids,(name,'missing fragment',ref)
    print(name+': metadata, headings, structured data, links and image alternatives OK')

robots=RobotFileParser();robots.parse((ROOT/'robots.txt').read_text().splitlines())
assert robots.site_maps()==[BASE+'sitemap.xml']
for bot in ['Googlebot','Bingbot','YandexBot','YandexWebmaster','OAI-SearchBot','GPTBot','Claude-SearchBot','PerplexityBot']:
    for path in ['', GUIDE, 'privacy.html', 'app.js', 'assets/styles.json', 'img/icon.png']:
        assert robots.can_fetch(bot,BASE+path),(bot,path)
urls=[e.text for e in ET.parse(ROOT/'sitemap.xml').findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
assert sorted(urls)==sorted(PUBLIC.values()),('Sitemap must contain only canonical public pages',urls)
assert (ROOT/'llms.txt').read_text().startswith('# Smart Store')
indexnow=json.loads((ROOT/'tools/indexnow.json').read_text())
assert indexnow['host']=='metov.store' and re.fullmatch(r'[a-f0-9]{32}\.txt',indexnow['keyFile'])
assert (ROOT/indexnow['keyFile']).read_text().strip()+'.txt'==indexnow['keyFile'], 'IndexNow domain proof must match its filename'
assert not list((ROOT/'assets').glob('*.map')), 'Do not publish source maps unintentionally'
assert (ROOT/'app.js').stat().st_size<10_000, 'Keep the entry module small; 3D remains deferred'
assert sum(p.stat().st_size for p in [ROOT/'app.js',*(ROOT/'scripts').glob('*.js')] if p.name!='checkout-scene.js')<110_000
print(f'{references} local references valid; sitemap/robots and initial JS budget OK')
