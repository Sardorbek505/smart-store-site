"""Run isolated browser regressions against a test-owned local HTTP server."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
import os,runpy,threading
ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
os.environ['SITE_TEST_URL']=f'http://127.0.0.1:{server.server_port}'
try:
    for name in ['readiness-check.py','site-improvements-check.py','ai-hero-check.py','ai-tour-check.py','story-check.py','hero-motion-check.py','accessibility-check.py','hero-ios-optics-check.py','hero-optics-alpha-check.py']:
        print('Browser check:',name,flush=True)
        runpy.run_path(str(ROOT/'tests'/name),run_name='__main__')
finally:
    server.shutdown();server.server_close();thread.join(timeout=2)
