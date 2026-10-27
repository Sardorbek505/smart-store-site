"""Real HTML parsing preserves CSP for LF/CRLF/CR and blocks altered scripts."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import urlsplit, parse_qs
from playwright.sync_api import sync_playwright
import json, os, shutil

ROOT = Path(__file__).resolve().parents[1]
BROWSER = os.environ.get('BROWSER', 'chromium')

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    def log_message(self, *args):
        pass
    def do_GET(self):
        url = urlsplit(self.path)
        if url.path != '/':
            return super().do_GET()
        mode = parse_qs(url.query).get('eol', ['lf'])[0]
        source = (ROOT/'index.html').read_text()
        if mode == 'tampered':
            source = source.replace('const root = document.documentElement;', 'const root = window.document.documentElement;')
        ending = {'lf':'\n', 'crlf':'\r\n', 'cr':'\r'}.get(mode, '\r\n')
        body = source.replace('\n', ending).encode('utf8')
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        launch = {'headless':True}
        if BROWSER == 'chromium':
            launch.update(executable_path=shutil.which('chromium'), args=['--no-sandbox'])
        browser = getattr(p, BROWSER).launch(**launch)
        for mode in ['lf', 'crlf', 'cr', 'tampered']:
            page = browser.new_page(viewport={'width':390, 'height':844}, reduced_motion='reduce')
            page.route('**/app.js*', lambda r:r.fulfill(content_type='text/javascript', body='window.externalModuleAllowed=true;'))
            page.add_init_script('window.violations=[];addEventListener("securitypolicyviolation",e=>violations.push({directive:e.effectiveDirective,blocked:e.blockedURI}));')
            page.goto(f'http://127.0.0.1:{server.server_port}/?eol={mode}', wait_until='networkidle')
            page.wait_for_function('() => window.externalModuleAllowed===true')
            platform = page.locator('html').get_attribute('data-installation-platform')
            violations = page.evaluate('window.violations')
            if mode == 'tampered':
                assert platform is None
                assert any(v['blocked']=='inline' for v in violations), violations
            else:
                assert platform == 'handoff', platform
                assert page.locator('html').get_attribute('data-viewport-width') == '390'
                assert violations == [], violations
            print(json.dumps({'browser':BROWSER, 'HTML':mode, 'inlineScript':'blocked as expected' if mode=='tampered' else 'executed with the published hash', 'externalSelfModule':'allowed'}), flush=True)
            page.close()
        browser.close()
finally:
    server.shutdown()
    server.server_close()
