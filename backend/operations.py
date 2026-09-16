from datetime import date
from collections import defaultdict

ELEMENTS = {'br':'Br','cl':'Cl','cd':'Cd','pb':'Pb','cr':'Cr','hg':'Hg'}


def number(value):
    if isinstance(value,bool) or value in ('',None): return None
    try:
        import math
        result=float(value)
        return result if math.isfinite(result) and result >= 0 else None
    except (TypeError,ValueError): return None


def xrf_evaluation(data, standards):
    material=str(data.get('material_type','')).strip().casefold()
    limits={}
    for record in standards:
        d=record.data
        if str(d.get('material_type','')).strip().casefold()==material:
            limits[str(d.get('element','')).split(' ')[0].lower()]=number(d.get('control_limit'))
    values={k:number(data.get(k)) for k in ELEMENTS}
    checks=[]; missing=False; failed=False
    for k,label in ELEMENTS.items():
        if material=='packaging' and k in ('cd','pb','hg','cr'): continue
        limit=limits.get(k); value=values[k]
        state='Pending' if limit is None or value is None else 'NG' if value>limit else 'Pass'
        missing |= state=='Pending'; failed |= state=='NG'
        checks.append({'element':label,'value':value,'limit':limit,'status':state,'rule':'≤ Control Limit'})
    if material=='packaging':
        pack=[values[k] for k in ('cd','pb','hg','cr')]
        value=sum(pack) if all(x is not None for x in pack) else None
        # The literal combined rule is retained from Standard, not inferred from blanks.
        rules=[str(r.data.get('rule','')) for r in standards if str(r.data.get('material_type','')).casefold()=='packaging']
        has_rule=any('70' in r and '<' in r and 'Cd' in r for r in rules)
        state='Pending' if value is None or not has_rule else 'NG' if value>=70 else 'Pass'
        checks.append({'element':'Cd + Pb + Hg + Cr','value':value,'limit':70 if has_rule else None,'status':state,'rule':'< 70 ppm'})
        missing |= state=='Pending'; failed |= state=='NG'
    return {'status':'NG' if failed else 'Pending' if missing else 'Pass','checks':checks,'basis':'Control Limit trong workbook; chỉ là kết quả sàng lọc.'}


def derived_status(module, data, standards, today=None):
    today=today or date.today()
    if module in ('xrf-iqc','xrf-oqc','change-control'):
        return xrf_evaluation(data,standards)['status']
    status=str(data.get('status','Pending'))
    expiry=data.get('expiry_date') or data.get('due_date') or data.get('review_date')
    try:
        days=(date.fromisoformat(str(expiry))-today).days
    except (ValueError,TypeError): days=None
    if module in ('reports','oqc-reports','fmd','declarations','material-declarations'):
        if str(data.get('result','')).upper() in ('FAIL','NG'): return 'NG'
        if days is not None and days<0: return 'Expired'
        if days is not None and days<=90: return 'Expiring Soon'
        if str(data.get('result','')).upper()=='PASS' and days is not None: return 'Valid'
    if module=='training':
        if days is not None and days<0: return 'Expired'
        if days is not None and days<=90: return 'Due Soon'
    elif days is not None and days<0 and status not in ('Closed','Completed','Compliant','Not Applicable'):
        return 'Overdue'
    return status


def workbook_conflicts(records):
    reports=defaultdict(set)
    fmd=defaultdict(set)
    for record in records:
        if record.module not in ('fmd','reports'): continue
        d=record.data
        key=(d.get('material_code',''), str(d.get('test_type','')).replace(' ','').casefold())
        if d.get('report_id'):
            (fmd if record.module=='fmd' else reports)[key].add(str(d['report_id']).strip())
    return [{'material_code':code,'test_type':kind,'fmd':sorted(ids),'trm':sorted(reports[(code,kind)]),'status':'Review required'}
            for (code,kind),ids in fmd.items() if reports.get((code,kind)) and ids != reports[(code,kind)]]
