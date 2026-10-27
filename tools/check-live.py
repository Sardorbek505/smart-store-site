"""Read-only public health checks; no account, store lookup or analytics writes."""
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from urllib.parse import urlsplit
from concurrent.futures import ThreadPoolExecutor
from time import monotonic
import json, xml.etree.ElementTree as ET
BASE='https://metov.store'
CHECKS=[('/',200,'Smart Store'),('/programma-dlya-magazina-instrumentov/',200,'Программа для магазина инструментов'),('/privacy.html',200,'Конфиденциальность'),('/robots.txt',200,'Sitemap: https://metov.store/sitemap.xml'),('/sitemap.xml',200,'urlset'),('/llms.txt',200,'# Smart Store'),('/health-check-page-that-does-not-exist',404,'Такой страницы нет.')]
def check(case):
    path,wanted,marker=case;started=monotonic()
    try:r=urlopen(Request(BASE+path,headers={'User-Agent':'SmartStoreHealthCheck/1.0'}),timeout=12)
    except HTTPError as e:r=e
    data=r.read(2_000_001)
    assert len(data)<=2_000_000,(path,'unexpected body size')
    assert r.status==wanted,(path,r.status,wanted)
    assert urlsplit(r.url).scheme=='https' and urlsplit(r.url).hostname=='metov.store',(path,'unexpected redirect')
    assert marker in data.decode('utf-8'),(path,'unexpected page')
    if path=='/sitemap.xml':ET.fromstring(data)
    return {'path':path,'status':r.status,'seconds':round(monotonic()-started,2)}
for result in ThreadPoolExecutor(max_workers=3).map(check,CHECKS):print(json.dumps(result),flush=True)
