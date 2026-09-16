"""Integration checks on an isolated SQLite DB; never mutate the configured DB."""
import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
TEMP=tempfile.TemporaryDirectory(prefix='ps-tests-')
os.environ['DATABASE_URL']='sqlite:///'+str(Path(TEMP.name)/'test.sqlite')
from fastapi.testclient import TestClient
from sqlalchemy import select,func
from main import app
from backend.store import SessionLocal,Record,Account,LoginSession,engine
from backend.operations import xrf_evaluation
from backend.excel_import import import_sources,FILES
import backend.api as api_module
api_module.UPLOADS=Path(TEMP.name)/'uploads'


class PlatformTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client=TestClient(app)
        cls.client.__enter__()
        response=cls.client.post('/api/auth/register',json={'email':'admin@example.test','password':'Strong-pass-2026','name':'Test Admin','employee_id':'QA001','department':'QA'})
        assert response.status_code==201,response.text
        cls.login_admin()

    @classmethod
    def login_admin(cls):
        response=cls.client.post('/api/auth/login',json={'email':'admin@example.test','password':'Strong-pass-2026'})
        assert response.status_code==200,response.text
        cls.client.headers['X-CSRF-Token']=response.json()['csrf']

    def setUp(self):
        self.login_admin()

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None,None,None)
        engine.dispose()
        TEMP.cleanup()

    def test_protected_routes_and_assets(self):
        anonymous=TestClient(app)
        self.assertEqual(anonymous.get('/',follow_redirects=False).status_code,303)
        self.assertEqual(anonymous.get('/api/records?module=fmd').status_code,401)
        self.assertEqual(anonymous.get('/api/catalog').status_code,401)
        self.assertEqual(anonymous.get('/login').status_code,200)
        self.assertEqual(anonymous.get('/static/logo.png').status_code,200)
        self.assertEqual(anonymous.get('/favicon.ico').headers['content-type'],'image/png')
        self.assertNotIn('Tính năng đang',self.client.get('/').text)
        anonymous.close()

    def test_import_reconciliation_and_idempotence(self):
        result=self.client.get('/api/imports').json()
        self.assertEqual(len(result['files']),3)
        by_name={x['file']:x for x in result['files']}
        self.assertEqual(by_name[FILES[0]]['summary']['counts']['fmd'],20)
        self.assertEqual(by_name[FILES[1]]['summary']['counts']['reports'],9)
        self.assertEqual(by_name[FILES[1]]['summary']['counts']['oqc-reports'],7)
        self.assertEqual(by_name[FILES[2]]['summary']['counts']['xrf-iqc'],44)
        self.assertEqual(by_name[FILES[2]]['summary']['counts']['xrf-oqc'],17)
        self.assertEqual(by_name[FILES[2]]['summary']['counts']['change-control'],3)
        self.assertEqual(by_name[FILES[2]]['summary']['issues'][0]['cell'],'M3')
        self.assertTrue(any('HT41125175301' in c['fmd'] and 'HT41225257701' in c['trm'] for c in result['conflicts']))
        with SessionLocal() as db:
            before=db.scalar(select(func.count()).select_from(Record))
            import_sources(db)
            self.assertEqual(db.scalar(select(func.count()).select_from(Record)),before)

    def test_material_centric_detail(self):
        records=self.client.get('/api/records?module=materials&q=Y0000001981').json()['items']
        row=next(r for r in records if r['data']['material_code']=='Y0000001981')
        detail=self.client.get('/api/records/'+str(row['id'])).json()
        self.assertTrue(any(r['module']=='fmd' for r in detail['related']))
        self.assertTrue(any(r['module']=='reports' for r in detail['related']))
        self.assertTrue(any(r['module']=='xrf-iqc' for r in detail['related']))
        self.assertTrue(detail['conflicts'])
        fmd=next(r for r in detail['related'] if r['module']=='fmd' and r['data'].get('issue_date'))
        self.assertEqual(fmd['data']['issue_date'],'2026-03-06')

    def test_all_modules_list_and_special_pages(self):
        modules=self.client.get('/api/catalog').json()['modules']
        for module in modules:
            response=self.client.get('/api/records',params={'module':module})
            self.assertEqual(response.status_code,200,(module,response.text))
        for url in ['/api/overview','/api/xrf-trend','/api/settings/permissions','/api/settings/notifications','/api/settings/retention','/api/settings/system','/api/users']:
            self.assertEqual(self.client.get(url).status_code,200,url)

    def test_xrf_boundaries_and_missing_values(self):
        with SessionLocal() as db:
            limits=db.scalars(select(Record).where(Record.module=='xrf-standard')).all()
            data={k:0 for k in ['br','cl','cd','pb','cr','hg']};data['material_type']='Polymers'
            data['pb']=35
            self.assertEqual(xrf_evaluation(data,limits)['status'],'Pass')
            data['pb']=35.1
            self.assertEqual(xrf_evaluation(data,limits)['status'],'NG')
            data['pb']=''
            self.assertEqual(xrf_evaluation(data,limits)['status'],'Pending')
            data['material_type']='Packaging';data['pb']=70
            self.assertEqual(xrf_evaluation(data,limits)['status'],'NG')
            data['pb']=69.9
            self.assertEqual(xrf_evaluation(data,limits)['status'],'Pass')
            data['material_type']='Unknown'
            self.assertEqual(xrf_evaluation(data,limits)['status'],'Pending')

    def test_crud_history_optimistic_conflict_and_export(self):
        body={'module':'ncr','data':{'ncr_no':'NCR-TEST','issue':'=formula()','status':'Open','dri':'QA'}}
        response=self.client.post('/api/records',json=body)
        self.assertEqual(response.status_code,201,response.text)
        record=response.json();rid=record['id'];body['version']=record['version'];body['data']['issue']='New issue'
        response=self.client.put('/api/records/'+str(rid),json=body)
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(self.client.put('/api/records/'+str(rid),json=body).status_code,409)
        detail=self.client.get('/api/records/'+str(rid)).json()
        self.assertEqual(len(detail['history']),2)
        export=self.client.get('/api/export/ncr?q=NCR-TEST')
        self.assertEqual(export.status_code,200)
        self.assertTrue(export.content.startswith(b'PK'))
        self.assertEqual(self.client.delete(f'/api/records/{rid}?version=2').status_code,200)
        self.assertEqual(self.client.get('/api/records/'+str(rid)).status_code,404)

    def test_capa_closure_requires_evidence_and_verification(self):
        body={'module':'capa','data':{'capa_no':'CAPA-TEST','status':'Open'}}
        created=self.client.post('/api/records',json=body).json();rid=created['id'];body['version']=1
        body['data']['status']='Closed'
        self.assertEqual(self.client.put('/api/records/'+str(rid),json=body).status_code,422)
        uploaded=self.client.post(f'/api/records/{rid}/evidence',files={'file':('proof.txt',b'verification completed','text/plain')})
        self.assertEqual(uploaded.status_code,201,uploaded.text)
        file_id=uploaded.json()['id']
        self.assertEqual(self.client.get('/api/evidence/'+str(file_id)).content,b'verification completed')
        for key in ('root_cause','corrective','preventive','verification','closure'):body['data'][key]='Verified action'
        self.assertEqual(self.client.put('/api/records/'+str(rid),json=body).status_code,200)
        anonymous=TestClient(app)
        self.assertEqual(anonymous.get('/api/evidence/'+str(file_id)).status_code,401)
        anonymous.close()
        self.assertEqual(self.client.post(f'/api/records/{rid}/evidence',files={'file':('bad.pdf',b'<script>x</script>','application/pdf')}).status_code,422)

    def test_csrf_and_cross_origin(self):
        data={'module':'ncr','data':{'ncr_no':'X','issue':'CSRF'}}
        self.assertEqual(self.client.post('/api/records',json=data,headers={'X-CSRF-Token':''}).status_code,403)
        self.assertEqual(self.client.post('/api/records',json=data,headers={'Origin':'https://evil.example'}).status_code,403)

    def test_registration_activation_and_viewer_permissions(self):
        guest=TestClient(app)
        creds={'email':'viewer@example.test','password':'Viewer-test-2026'}
        response=guest.post('/api/auth/register',json={**creds,'name':'Viewer','employee_id':'V001','department':'QA'})
        self.assertEqual(response.status_code,201,response.text)
        self.assertFalse(response.json()['active'])
        self.assertEqual(guest.post('/api/auth/login',json=creds).status_code,403)
        uid=next(u['id'] for u in self.client.get('/api/users').json() if u['email']==creds['email'])
        self.assertEqual(self.client.put('/api/users/'+str(uid),json={'active':True,'role':'Viewer'}).status_code,200)
        result=guest.post('/api/auth/login',json=creds)
        self.assertEqual(result.status_code,200,result.text)
        guest.headers['X-CSRF-Token']=result.json()['csrf']
        self.assertEqual(guest.get('/api/records?module=fmd').status_code,200)
        self.assertEqual(guest.post('/api/records',json={'module':'ncr','data':{'ncr_no':'DENIED','issue':'No'}}).status_code,403)
        self.assertEqual(guest.get('/api/users').status_code,403)
        self.client.put('/api/users/'+str(uid),json={'active':False,'role':'Viewer'})
        self.assertEqual(guest.get('/api/auth/me').status_code,401)
        guest.close()

    def test_upload_traversal_filename_sanitized(self):
        rid=self.client.get('/api/records?module=materials').json()['items'][0]['id']
        result=self.client.post(f'/api/records/{rid}/evidence',files={'file':('../../proof.txt',b'proof','text/plain')})
        self.assertEqual(result.status_code,201,result.text)
        self.assertEqual(result.json()['name'],'proof.txt')


if __name__=='__main__': unittest.main(verbosity=2)
