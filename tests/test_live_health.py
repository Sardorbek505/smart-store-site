"""Publication health failures use local responses only, never production traffic."""
from importlib.util import spec_from_file_location,module_from_spec
from pathlib import Path
from io import BytesIO,StringIO
from contextlib import redirect_stdout
from datetime import datetime,timezone,timedelta
from urllib.parse import urlsplit,unquote
from unittest.mock import patch
import unittest,mimetypes

SPEC=spec_from_file_location('health',Path(__file__).resolve().parents[1]/'tools/check-live.py')
health=module_from_spec(SPEC);SPEC.loader.exec_module(health)
NOW=datetime(2026,10,29,tzinfo=timezone.utc)

class Response(BytesIO):
    def __init__(self,data,url,status=200,mime='text/html'):
        super().__init__(data);self.url=url;self.status=status;self.headers={'Content-Type':mime}

class HealthTests(unittest.TestCase):
    def ready(self,request,**kwargs):
        self.assertEqual(request.get_method(),'GET')
        url=request.full_url;path=unquote(urlsplit(url).path).lstrip('/')
        if path=='health-check-page-that-does-not-exist':return Response((health.ROOT/'404.html').read_bytes(),url,404)
        target=health.ROOT/path
        if target.is_dir():target=target/'index.html'
        return Response(target.read_bytes(),url,mime=mimetypes.guess_type(str(target))[0] or 'text/plain')

    def test_complete_publication_reads_pages_assets_and_security_contact(self):
        original=health.security_contact
        with patch.object(health,'urlopen',side_effect=self.ready) as http,patch.object(health,'security_contact',side_effect=lambda text:original(text,NOW)),redirect_stdout(StringIO()):health.main()
        urls=[c.args[0].full_url for c in http.call_args_list]
        self.assertTrue(set(health.CANONICAL)<=set(urls))
        self.assertTrue(any('/scripts/store.js?' in u for u in urls))
        self.assertTrue(any('/assets/' in u for u in urls))
        self.assertIn(health.BASE+'/.well-known/security.txt',urls)

    def test_external_asset_is_rejected_before_any_external_request(self):
        url=health.BASE+'/'
        data=b'<link rel="canonical" href="https://metov.store/"><title>Smart Store</title><script src="https://foreign.example/app.js"></script>'
        with patch.object(health,'urlopen',return_value=Response(data,url)) as http:
            with self.assertRaises(ValueError):health.check_page({'canonical':url,'marker':'Smart Store'})
            self.assertEqual(http.call_count,1)

    def test_noindex_or_wrong_canonical_fails_even_when_html_is_200(self):
        for canonical,robots in [('https://metov.store/other/',''),(health.BASE+'/', '<meta name="robots" content="noindex">')]:
            data=f'<link rel="canonical" href="{canonical}">{robots}<title>Smart Store</title>'.encode()
            with self.subTest(canonical=canonical,robots=robots),patch.object(health,'urlopen',return_value=Response(data,health.BASE+'/')):
                with self.assertRaises(AssertionError):health.check_page({'canonical':health.BASE+'/','marker':'Smart Store'})

    def test_missing_asset_and_soft_html_asset_are_failures(self):
        url=health.BASE+'/app.js?v=89'
        for response in [Response(b'missing',url,404,'text/plain'),Response(b'<!doctype html>Smart Store',url,mime='application/javascript'),Response(b'anything',url,mime='text/html')]:
            with self.subTest(status=response.status,mime=response.headers['Content-Type']),patch.object(health,'urlopen',return_value=response):
                with self.assertRaises(AssertionError):health.read(url)

    def test_unexpected_redirect_and_soft_404_fail(self):
        for response,wanted in [(Response(b'data','https://other.example/'),200),(Response(b'missing',health.BASE+'/missing',200),404)]:
            with self.subTest(wanted=wanted),patch.object(health,'urlopen',return_value=response):
                with self.assertRaises(AssertionError):health.read(health.BASE+'/missing',wanted)

    def test_security_contact_rejects_expiry_and_wrong_contact(self):
        text=(health.ROOT/'.well-known/security.txt').read_text()
        self.assertTrue(health.security_contact(text,NOW))
        for bad in [text.replace('2027-04-29T00:00:00Z','2026-11-01T00:00:00Z'),text.replace('https://metov.store/privacy.html#data-requests','https://other.example/'),text+'Expires: 2027-04-29T00:00:00Z\n']:
            with self.subTest(text=bad):
                with self.assertRaises(AssertionError):health.security_contact(bad,NOW)

if __name__=='__main__':unittest.main()
