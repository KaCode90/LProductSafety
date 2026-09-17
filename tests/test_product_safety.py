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

    def test_overview_metrics_and_xrf_group(self):
        catalog=self.client.get('/api/catalog').json()
        self.assertEqual(len(catalog['groups']),5)
        materials=next(g for g in catalog['groups'] if g['id']=='materials')
        self.assertEqual(materials['id'],'materials')
        self.assertEqual([i['id'] for i in materials['items']],['bom','materials','suppliers','inspection-plans'])
        self.assertIn('xrf-standard',[i['id'] for i in catalog['groups'][-1]['items']])
        reports=[]
        for module in ('reports','oqc-reports'):
            reports.extend(self.client.get('/api/records',params={'module':module,'size':100}).json()['items'])
        overview=self.client.get('/api/overview').json()
        self.assertEqual(overview['reports_total'],len(reports))
        self.assertEqual(overview['reports_valid'],sum(str(r['data'].get('result','')).upper()=='PASS' and r['display_status'] in ('Valid','Expiring Soon') for r in reports))
        self.assertEqual(overview['alerts_total'],len(overview['alerts']))
        self.assertEqual(overview['alert_counts']['reports'],sum(r['module'] in ('reports','oqc-reports') for r in overview['alerts']))
        self.assertIsNotNone(overview['updated_at'])

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

    def test_organization_assignment_persists_with_history(self):
        data={'department_name':'Team Lead (QA)','org_unit':'Team Lead (QA)','primary':'QA Owner','backup':'Deputy','reports_to':'Management','responsibility':'Review HSF\nApprove reports','authority':'Approve documents','effective_date':'2026-09-16','source_reference':'3.2'}
        created=self.client.post('/api/records',json={'module':'organization','data':data})
        self.assertEqual(created.status_code,201,created.text)
        rid=created.json()['id']
        data['primary']='New QA Owner'
        updated=self.client.put(f'/api/records/{rid}',json={'module':'organization','version':1,'data':data})
        self.assertEqual(updated.status_code,200,updated.text)
        detail=self.client.get(f'/api/records/{rid}').json()
        self.assertEqual(detail['data'],data)
        self.assertEqual(detail['history'][0]['before']['primary'],'QA Owner')
        self.assertEqual(detail['history'][0]['after']['primary'],'New QA Owner')
        self.assertEqual(self.client.put(f'/api/records/{rid}',json={'module':'organization','version':1,'data':data}).status_code,409)
        bad={**data,'org_unit':'Invalid group'}
        self.assertEqual(self.client.post('/api/records',json={'module':'organization','data':bad}).status_code,422)

    def test_material_usage_separate_from_legacy_workflow(self):
        with SessionLocal() as db:
            row=Record(module='materials',data={'material_code':'LEGACY-STATUS','material_name':'Legacy','status':'Completed'})
            db.add(row);db.commit();rid=row.id
        detail=self.client.get(f'/api/records/{rid}').json()
        self.assertEqual(detail['display_status'],'Chưa xác định')
        self.assertEqual(detail['data']['dossier_status'],'Chưa đánh giá')
        data={**detail['data'],'usage_status':'Đang sử dụng','dossier_status':'Thiếu hồ sơ'}
        response=self.client.put(f'/api/records/{rid}',json={'module':'materials','data':data,'version':1})
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(response.json()['display_status'],'Đang sử dụng')
        result=self.client.get('/api/records',params={'module':'materials','q':'LEGACY-STATUS','status':'Đang sử dụng','dossier':'Thiếu hồ sơ'}).json()
        self.assertEqual(result['total'],1)
        self.assertEqual(self.client.get('/api/records',params={'module':'materials','q':'LEGACY-STATUS','dossier':'Đạt yêu cầu'}).json()['total'],0)
        self.assertEqual(self.client.get('/api/export/materials',params={'status':'Đang sử dụng','dossier':'Thiếu hồ sơ'}).status_code,200)

    def test_unified_inspections_filter_and_paginate_without_copying(self):
        modules=['reports','oqc-reports','xrf-iqc','xrf-oqc','change-control']
        total=sum(self.client.get('/api/records',params={'module':m}).json()['total'] for m in modules)
        combined=self.client.get('/api/inspections/inspection-results',params={'size':100}).json()
        self.assertEqual(combined['total'],total)
        self.assertEqual(len({r['id'] for r in combined['items']}),len(combined['items']))
        filtered=self.client.get('/api/inspections/inspection-results',params={'stage':'OQC','method':'XRF','size':100}).json()
        self.assertTrue(filtered['items'])
        self.assertTrue(all(r['module']=='xrf-oqc' for r in filtered['items']))
        first=self.client.get('/api/inspections/inspection-results?size=3&page=1').json()
        second=self.client.get('/api/inspections/inspection-results?size=3&page=2').json()
        self.assertFalse({r['id'] for r in first['items']} & {r['id'] for r in second['items']})
        created=self.client.post('/api/records',json={'module':'reports','data':{'report_id':'EXPIRED-PASS','result':'PASS','expiry_date':'2000-01-01','inspection_stage':'OQC'}})
        self.assertEqual(created.status_code,201)
        result=self.client.get('/api/inspections/inspection-results?q=EXPIRED-PASS&result=PASS&validity=Hết hạn&stage=OQC').json()
        self.assertEqual(result['total'],1)
        self.assertEqual(result['items'][0]['test_result'],'PASS')
        self.assertEqual(result['items'][0]['validity'],'Hết hạn')
        plans=self.client.get('/api/inspections/inspection-plans?size=100').json()
        self.assertEqual({r['module'] for r in plans['items']},{'test-plan','xrf-plan'})

    def test_dashboard_report_expiry_and_separate_trends(self):
        from datetime import date,timedelta
        with SessionLocal() as db:
            original_ids=set(db.scalars(select(Record.id)).all())
        before=self.client.get('/api/overview').json()['report_summary']
        with SessionLocal() as db:
            for i,days in enumerate([-1,0,30,60,90,91,None]):
                db.add(Record(module='reports',data={'report_id':f'BOUNDARY-{i}','result':'FAIL','expiry_date':(date.today()+timedelta(days=days)).isoformat() if days is not None else ''}))
            db.add(Record(module='xrf-iqc',data={'material_code':'TREND-ISOLATION','test_date':'2026-09-01','pb':10}))
            db.add(Record(module='xrf-oqc',data={'material_code':'TREND-ISOLATION','test_date':'2026-09-01','pb':90}))
            db.commit()

    def test_supply_chain_context_and_declaration_menu(self):
        catalog=self.client.get('/api/catalog').json()
        menu_ids={i['id'] for g in catalog['groups'] for i in g['items']}
        self.assertNotIn('declarations',menu_ids)
        self.assertNotIn('material-declarations',menu_ids)
        created=[]
        for module,data in [('materials',{'material_code':'CTX-M','material_name':'Context material'}),('suppliers',{'supplier':'CTX-S','material_codes':'CTX-M'}),('bom',{'material_code':'CTX-M'}),('material-declarations',{'declaration_no':'CTX-D','material_code':'CTX-M','supplier':'CTX-S'}),('declarations',{'declaration_no':'CTX-G','supplier':'CTX-S'})]:
            r=self.client.post('/api/records',json={'module':module,'data':data})
            self.assertEqual(r.status_code,201,r.text);created.append(r.json())
        material,supplier,bom,specific,general=created
        m=self.client.get('/api/records/'+str(material['id'])).json()
        self.assertIn('CTX-S',m['supplier_names'])
        self.assertIn(specific['id'],[r['id'] for r in m['related']])
        self.assertNotIn(general['id'],[r['id'] for r in m['related']])
        s=self.client.get('/api/records/'+str(supplier['id'])).json()
        self.assertIn(material['id'],[r['id'] for r in s['materials']])
        self.assertTrue({specific['id'],general['id']} <= {r['id'] for r in s['related']})
        b=self.client.get('/api/records/'+str(bom['id'])).json()
        self.assertEqual(b['materials'][0]['id'],material['id'])
        for r in created:self.client.delete('/api/records/'+str(r['id'])+'?version=1')
        after=self.client.get('/api/overview').json()['report_summary']
        for key,delta in [('total',7),('expired',1),('expiring',4),('valid',1),('undated',1),('unexpired',5)]:
            self.assertEqual(after[key]-before[key],delta,key)
        rows=self.client.get('/api/inspections/inspection-results?q=BOUNDARY&expiry_days=30').json()
        self.assertEqual(rows['total'],2)
        for stage,expected in [('IQC',10),('OQC',90)]:
            data=self.client.get('/api/xrf-trend',params={'stage':stage}).json()
            item=next(r for r in data['items'] if r['material_code']=='TREND-ISOLATION')
            self.assertEqual(item['maximum'],expected)
            self.assertTrue(all(r['stage']==stage for r in data['items']))
        self.assertEqual(self.client.get('/api/xrf-trend?stage=INVALID').status_code,422)
        with SessionLocal() as db:
            for row in db.scalars(select(Record)).all():
                if row.id not in original_ids: db.delete(row)
            db.commit()

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
