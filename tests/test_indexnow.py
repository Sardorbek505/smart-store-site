"""Publication/notification boundaries; every HTTP response is a local fixture."""
from contextlib import redirect_stdout, redirect_stderr
from importlib.util import spec_from_file_location, module_from_spec
from io import BytesIO, StringIO
from pathlib import Path
from urllib.error import HTTPError
from unittest.mock import patch
import json, unittest

SPEC=spec_from_file_location('notify_indexnow',Path(__file__).resolve().parents[1]/'tools/notify-indexnow.py')
notify=module_from_spec(SPEC);SPEC.loader.exec_module(notify)

class Response(BytesIO):
    def __init__(self,data,url,status=200):
        super().__init__(data);self.status=status;self.url=url

class PublicationTests(unittest.TestCase):
    def setUp(self):
        self.data=notify.payload();self.posts=[];self.status=202

    def ready(self,request,**kwargs):
        url=request.full_url
        if request.get_method()=='POST':
            self.posts.append(request)
            return Response(b'',url,self.status)
        if url==self.data['keyLocation']:
            return Response(self.data['key'].encode(),url)
        path=notify.ROOT/('index.html' if url==notify.BASE else url.removeprefix(notify.BASE))
        if path.is_dir():path=path/'index.html'
        return Response(path.read_bytes(),url)

    def test_default_is_dry_run_without_network(self):
        out=StringIO()
        with patch.object(notify,'urlopen') as network,redirect_stdout(out):notify.main([])
        network.assert_not_called()
        result=json.loads(out.getvalue())
        self.assertEqual(result['mode'],'dry-run')
        self.assertEqual(result['urls'],self.data['urlList'])

    def test_receipt_is_one_post_after_all_published_bytes_match(self):
        for code in [200,202]:
            self.status=code;self.posts=[]
            with patch.object(notify,'urlopen',side_effect=self.ready) as network:
                result=notify.submit(self.data)
            self.assertEqual(result['status'],code)
            self.assertEqual(len(self.posts),1)
            self.assertEqual(network.call_count,len(self.data['urlList'])+2)
            self.assertEqual(json.loads(self.posts[0].data),self.data)

    def test_wrong_or_redirected_domain_proof_cannot_notify(self):
        for body,url in [(b'incorrect',self.data['keyLocation']),(self.data['key'].encode(),'https://other.example/proof.txt')]:
            with patch.object(notify,'urlopen',return_value=Response(body,url)) as network:
                with self.assertRaises(notify.PublicationPending):notify.submit(self.data)
                self.assertEqual(network.call_count,1)

    def test_stale_page_cannot_notify(self):
        real=self.ready
        def stale(request,**kwargs):
            if request.full_url==notify.BASE:return Response(b'Old HTML',request.full_url)
            return real(request,**kwargs)
        with patch.object(notify,'urlopen',side_effect=stale):
            with self.assertRaises(notify.PublicationPending):notify.submit(self.data)
        self.assertEqual(self.posts,[])

    def test_pending_deployment_retries_reads_then_sends_once(self):
        clock=[0];checks=[0]
        real=notify.verify_published
        def verify(data):
            checks[0]+=1
            if checks[0]==1:raise notify.PublicationPending('Not published yet')
            return real(data)
        with patch.object(notify,'verify_published',side_effect=verify),patch.object(notify,'urlopen',side_effect=self.ready),patch.object(notify.time,'monotonic',side_effect=lambda:clock[0]),patch.object(notify.time,'sleep',side_effect=lambda seconds:clock.__setitem__(0,clock[0]+seconds)),redirect_stderr(StringIO()):
            notify.submit(self.data,wait_seconds=20)
        self.assertEqual(checks[0],2)
        self.assertEqual(len(self.posts),1)

    def test_timeout_or_forbidden_read_never_posts(self):
        clock=[0]
        with patch.object(notify,'verify_published',side_effect=notify.PublicationPending('Stale')),patch.object(notify,'urlopen') as network,patch.object(notify.time,'monotonic',side_effect=lambda:clock[0]),patch.object(notify.time,'sleep',side_effect=lambda seconds:clock.__setitem__(0,clock[0]+seconds)),redirect_stderr(StringIO()):
            with self.assertRaises(notify.PublicationPending):notify.submit(self.data,wait_seconds=20)
            network.assert_not_called()
            self.assertEqual(clock[0],20)
        error=HTTPError(notify.BASE,403,'Forbidden',{},None)
        with patch.object(notify,'urlopen',side_effect=error) as network,patch.object(notify.time,'sleep') as sleep:
            with self.assertRaises(HTTPError):notify.submit(self.data,wait_seconds=20)
            self.assertEqual(network.call_count,1)
            sleep.assert_not_called()

    def test_failed_notification_is_not_retried(self):
        def fail(request,**kwargs):
            if request.get_method()=='POST':
                self.posts.append(request)
                raise HTTPError(request.full_url,429,'Rate limited',{},None)
            return self.ready(request,**kwargs)
        with patch.object(notify,'urlopen',side_effect=fail):
            with self.assertRaisesRegex(RuntimeError,'HTTP 429; no automatic retry'):notify.submit(self.data,wait_seconds=20)
        self.assertEqual(len(self.posts),1)

if __name__=='__main__':unittest.main()
