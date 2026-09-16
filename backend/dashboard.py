from collections import Counter, defaultdict
from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session
from backend.store import Account, Audit, Setting, get_db
from backend.api import all_visible, standards, serialize
from backend.operations import number, workbook_conflicts
from login import current_user

router=APIRouter(prefix='/api')


@router.get('/overview')
def overview(user:Account=Depends(current_user),db:Session=Depends(get_db)):
    visible=all_visible(db,user); limits=standards(db)
    rows=[serialize(r,limits) for r in visible]
    materials=[r for r in rows if r['module']=='materials']
    reports=[r for r in rows if r['module'] in ('reports','oqc-reports')]
    training=[r for r in rows if r['module']=='training']
    status=Counter(r['display_status'] for r in materials)
    prefs=db.get(Setting,'notifications'); prefs=prefs.value if prefs else {'days':30}
    alerts=[]
    for r in rows:
        module=r['module']; d=r['data']
        key='reports' if module in ('reports','oqc-reports') else 'training' if module=='training' else 'capa' if module=='capa' else 'documents' if module in ('documents','procedures','appendices') else 'compliance'
        if not prefs.get(key,True): continue
        dt=d.get('expiry_date') or d.get('due_date') or d.get('review_date')
        try: remaining=(date.fromisoformat(str(dt))-date.today()).days
        except ValueError: remaining=None
        if r['display_status'] in ('NG','Overdue','Expired') or remaining is not None and remaining<=prefs.get('days',30):
            if d.get('status') not in ('Closed','Not Applicable'): alerts.append(r)
    windows={str(n):sum(0<=(date.fromisoformat(str(r['data']['expiry_date']))-date.today()).days<=n for r in reports if r['data'].get('expiry_date')) for n in (30,60,90)}
    activity=[{'actor':a.actor,'action':a.action,'at':a.created_at.isoformat(),'record_id':a.record_id} for a in db.scalars(select(Audit).order_by(Audit.id.desc()).limit(30)).all()]
    # Avoid exposing audit payloads or names of records outside the user's module permissions.
    visible_ids={r.id for r in visible}
    activity=[a for a in activity if a['record_id'] in visible_ids or a['record_id'] is None and user.role in ('Admin','QA Manager')]
    return {'counts':dict(Counter(r['module'] for r in rows)),'materials':dict(status),'total_materials':len(materials),
        'compliance_rate':round(100*status['Compliant']/len(materials),1) if materials else 0,
        'open_ncr':sum(r['module']=='ncr' and r['data'].get('status')!='Closed' for r in rows),
        'overdue_capa':sum(r['module']=='capa' and r['display_status']=='Overdue' for r in rows),
        'training_rate':round(100*sum(r['display_status']=='Completed' for r in training)/len(training),1) if training else 0,
        'windows':windows,'alerts':alerts[:40],'activity':activity,'conflicts':workbook_conflicts(visible),
        'cts':[{'id':key,'total':len(items),'compliant':sum(r['display_status']=='Compliant' for r in items),'issues':sum(r['display_status']!='Compliant' and r['display_status']!='Not Applicable' for r in items),'updated':max((r['updated_at'] for r in items),default=None)} for key in ('cts-1','cts-2','cts-3') for items in [[r for r in rows if r['module']==key]]]}


@router.get('/xrf-trend')
def trend(element:str='pb',user:Account=Depends(current_user),db:Session=Depends(get_db)):
    from fastapi import HTTPException
    if element not in ('pb','cd','hg','cr','br','cl'): raise HTTPException(422)
    visible=all_visible(db,user)
    measurements=[r for r in visible if r.module in ('xrf-iqc','xrf-oqc')]
    groups=defaultdict(list)
    for r in measurements:
        d=r.data; value=number(d.get(element))
        if value is not None and d.get('test_date'): groups[(d['test_date'][:7],d.get('material_code',''))].append(value)
    items=[{'month':month,'material_code':code,'maximum':max(values),'average':round(sum(values)/len(values),3),'count':len(values)} for (month,code),values in sorted(groups.items())]
    coverage=[]
    for r in visible:
        if r.module!='xrf-plan': continue
        d=r.data; codes={d.get('material_code'),d.get('old_code')}
        for key,value in d.items():
            if not key.startswith('plan_') or value!='Planned': continue
            month=key[5:]
            matches=[x for x in measurements if x.data.get('material_code') in codes and str(x.data.get('test_date','')).startswith(month) and x.data.get('test')==d.get('test')]
            coverage.append({'plan_id':r.id,'material_code':d.get('material_code'),'month':month,'test':d.get('test'), 'tests':len(matches),'status':'Completed' if matches else 'Scheduled' if month>date.today().isoformat()[:7] else 'Pending' if month==date.today().isoformat()[:7] else 'Overdue'})
    return {'element':element,'items':items,'coverage':coverage,'basis':'Max/average từ kết quả IQC và OQC; thực hiện kế hoạch được đối chiếu đúng mã và Old Part Code đã khai báo. Một kết quả ghi nhận thực hiện, không đồng nghĩa đã PASS.'}
