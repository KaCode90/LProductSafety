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
    latest_update = max((r.updated_at for r in visible if r.updated_at), default=None)
    latest_update_str = latest_update.isoformat() if latest_update else None

    materials=[r for r in rows if r['module']=='materials' and r['data'].get('status') != 'Inactive' and r['data'].get('usage_status') != 'Ngừng sử dụng']
    reports=[r for r in rows if r['module'] in ('reports','oqc-reports','fmd','documents')]
    
    total_active = len(materials)
    covered_fmd = set()
    covered_decl = set()
    covered_xrf = set()

    for r in rows:
        if r['module'] == 'fmd':
            code = r['data'].get('material_code')
            if code: covered_fmd.add(code)
        elif r['module'] in ('declarations', 'material-declarations'):
            code = r['data'].get('material_code')
            if code: covered_decl.add(('code', code))
            sup = r['data'].get('supplier')
            if sup: covered_decl.add(('sup', sup.casefold()))
        elif r['module'] in ('xrf-iqc', 'xrf-oqc'):
            code = r['data'].get('material_code')
            if code: covered_xrf.add(code)

    coverage_fmd_count = 0
    coverage_decl_count = 0
    coverage_xrf_count = 0

    valid_reports_total = 0
    required_reports_total = 0
    compliant_count = 0
    ng_count = 0
    pending_count = 0

    material_alerts = []

    for m in materials:
        d = m['data']
        mat_code = d.get('material_code', '')
        mat_name = d.get('material_name', mat_code)
        mat_sup = str(d.get('supplier', '')).casefold()

        if mat_code in covered_fmd: coverage_fmd_count += 1
        if ('code', mat_code) in covered_decl or ('sup', mat_sup) in covered_decl: coverage_decl_count += 1
        if mat_code in covered_xrf: coverage_xrf_count += 1

        manual_status = str(d.get('status') or '').strip()
        manual_approval = str(d.get('approval') or '').strip()
        manual_dossier = str(d.get('dossier_status') or '').strip()

        req_tests = d.get('required_tests')
        if isinstance(req_tests, str):
            req_tests = [x.strip() for x in req_tests.split(',') if x.strip()]
        elif not isinstance(req_tests, list):
            req_tests = []

        required_reports_total += len(req_tests)
        mat_reports = [r for r in reports if r['data'].get('material_code') == mat_code]

        if manual_status in ('Compliant', 'Đạt yêu cầu', 'Approved', 'Pass', 'PASS') or manual_approval == 'Approved' or manual_dossier == 'Đạt yêu cầu':
            status = 'Compliant'
            valid_reports_total += len(req_tests)
        elif manual_status in ('NG', 'Non-Compliant', 'Rejected', 'FAIL', 'Fail') or manual_approval == 'Rejected' or (manual_dossier == 'Cần cập nhật' and manual_status == 'NG'):
            status = 'Non-Compliant'
            material_alerts.append({
                'id': m['id'],
                'module': 'materials',
                'data': d,
                'display_status': 'NG',
                'type': 'ng',
                'title': f"NVL báo NG: {mat_code} ({mat_name})"
            })
        else:
            status = 'Compliant' if req_tests else ('Compliant' if manual_status == 'Active' else 'Pending')
            expiring_soon = False
            missing_any = False

            for rt in req_tests:
                matching = [r for r in mat_reports if rt.casefold() in str(r['data'].get('test_type') or r['data'].get('document_name') or '').casefold()]
                if not matching:
                    missing_any = True
                    material_alerts.append({
                        'id': m['id'],
                        'module': 'materials',
                        'data': d,
                        'display_status': 'Thiếu hồ sơ',
                        'type': 'missing',
                        'title': f"Thiếu {rt} - {mat_code}"
                    })
                    continue

                latest = sorted(matching, key=lambda x: str(x['data'].get('expiry_date') or x['data'].get('review_date') or '9999'), reverse=True)[0]
                result = str(latest['data'].get('result', '')).upper()
                validity = latest.get('display_status') or ''

                if result in ('FAIL', 'NG') or validity in ('Expired', 'Overdue', 'NG'):
                    status = 'Non-Compliant'
                    material_alerts.append({
                        'id': latest['id'],
                        'module': latest['module'],
                        'data': latest['data'],
                        'display_status': validity or 'NG',
                        'type': 'expired',
                        'title': f"{rt} hết hạn / FAIL - {mat_code}"
                    })
                elif result in ('PASS', 'PASS/PASS') or validity in ('Valid', 'Compliant', 'Đạt yêu cầu', 'Active') or not validity or validity == 'Pending':
                    valid_reports_total += 1
                    if validity == 'Expiring Soon':
                        expiring_soon = True
                        material_alerts.append({
                            'id': latest['id'],
                            'module': latest['module'],
                            'data': latest['data'],
                            'display_status': 'Expiring Soon',
                            'type': 'expiring',
                            'title': f"{rt} sắp hết hạn - {mat_code}"
                        })
                else:
                    valid_reports_total += 1

            if status != 'Non-Compliant':
                if missing_any:
                    status = 'Pending'
                elif expiring_soon:
                    status = 'Expiring Soon'

        if status == 'Compliant':
            compliant_count += 1
        elif status in ('Non-Compliant', 'NG'):
            ng_count += 1
        else:
            pending_count += 1

    alerts = []
    # 1. Overdue / Open CAPAs
    for r in rows:
        if r['module'] == 'capa':
            st = str(r['data'].get('status') or '')
            if st not in ('Closed', 'Completed', 'Not Applicable'):
                alerts.append({
                    'id': r['id'],
                    'module': 'capa',
                    'data': r['data'],
                    'display_status': r.get('display_status') or 'Open',
                    'type': 'expired' if r.get('display_status') == 'Overdue' else 'missing',
                    'title': f"CAPA {r['data'].get('capa_no', '#' + str(r['id']))}: {r['data'].get('issue', 'Cần xử lý')}"
                })

    # 2. Open / In-progress NCRs
    for r in rows:
        if r['module'] == 'ncr':
            st = str(r['data'].get('status') or '')
            if st in ('Open', 'On-going', 'Pending Verification', 'Pending'):
                alerts.append({
                    'id': r['id'],
                    'module': 'ncr',
                    'data': r['data'],
                    'display_status': r['data'].get('severity') or 'Open',
                    'type': 'expired' if r['data'].get('severity') == 'Critical' else 'missing',
                    'title': f"NCR {r['data'].get('ncr_no', '#' + str(r['id']))}: {r['data'].get('issue', 'Cần xử lý')}"
                })

    # 3. NG / Non-compliant materials and FAIL reports
    for a in material_alerts:
        if a['type'] in ('ng', 'expired'):
            alerts.append(a)

    # 4. Expiring soon
    for a in material_alerts:
        if a['type'] == 'expiring':
            alerts.append(a)

    # 5. Missing required reports (up to 20 total)
    for a in material_alerts:
        if a['type'] == 'missing' and len(alerts) < 20:
            alerts.append(a)

    # Real open actions count from CAPA, NCR, and NG materials
    capa_ncr_open = sum(1 for r in rows if r['module'] in ('ncr', 'capa') and str(r['data'].get('status') or '').strip() not in ('Closed', 'Completed', 'Not Applicable'))
    open_actions = capa_ncr_open + ng_count

    hsf_compliance = round(100 * compliant_count / total_active, 1) if total_active else 0

    return {
        'hsf_compliance': hsf_compliance,
        'compliant_materials': compliant_count,
        'ng_materials': ng_count,
        'pending_materials': pending_count,
        'active_materials': total_active,
        'valid_reports': valid_reports_total,
        'required_reports': required_reports_total,
        'open_actions': open_actions,
        'alerts': alerts[:20],
        'latest_update': latest_update_str,
        'coverage': {
            'fmd': coverage_fmd_count,
            'declaration': coverage_decl_count,
            'xrf': coverage_xrf_count,
            'total_materials': total_active
        }
    }

@router.get('/xrf-trend')
def trend(element:str='pb',stage:str='',material_type:str='',user:Account=Depends(current_user),db:Session=Depends(get_db)):
    from fastapi import HTTPException
    if element not in ('pb','cd','hg','cr','br','cl'): raise HTTPException(422)
    if stage not in ('','IQC','OQC'): raise HTTPException(422)
    visible=all_visible(db,user)
    measurements=[r for r in visible if r.module in (('xrf-'+stage.lower(),) if stage else ('xrf-iqc','xrf-oqc'))]
    if material_type:
        measurements=[r for r in measurements if r.data.get('material_type')==material_type]
    groups=defaultdict(list)
    for r in measurements:
        d=r.data; value=number(d.get(element))
        if value is not None and d.get('test_date'): groups[(d['test_date'][:7],d.get('material_code',''),r.module)].append(value)
    items=[{'month':month,'material_code':code,'stage':module[4:].upper(),'maximum':max(values),'average':round(sum(values)/len(values),3),'count':len(values)} for (month,code,module),values in sorted(groups.items())]
    # Lookup control limits from xrf-standard records
    element_names={'pb':'Pb','cd':'Cd','hg':'Hg','cr':'Cr','br':'Br','cl':'Cl'}
    std_records=[r for r in visible if r.module=='xrf-standard']
    control_limits={}
    for r in std_records:
        d=r.data
        el=str(d.get('element','')).split(' ')[0].strip()
        mt=str(d.get('material_type','')).strip()
        cl_val=number(d.get('control_limit'))
        sl_val=number(d.get('spec_limit'))
        if el and mt:
            control_limits.setdefault(mt,{})[el]={'control_limit':cl_val,'spec_limit':sl_val}
    el_name=element_names.get(element,element.capitalize())
    selected_types={material_type} if material_type else {r.data.get('material_type') for r in measurements}
    limit_values=[number(r.data.get('control_limit')) for r in std_records if str(r.data.get('element','')).split(' ')[0].strip()==el_name and r.data.get('material_type') in selected_types]
    limit_val=limit_values[0] if len(selected_types)==1 and limit_values and all(v is not None and v==limit_values[0] for v in limit_values) else None
    coverage=[]
    for r in visible:
        if r.module!='xrf-plan': continue
        d=r.data; codes={d.get('material_code'),d.get('old_code')}
        if stage and d.get('test')!=stage: continue
        for key,value in d.items():
            if not key.startswith('plan_') or value!='Planned': continue
            month=key[5:]
            matches=[x for x in measurements if x.data.get('material_code') in codes and str(x.data.get('test_date','')).startswith(month) and x.data.get('test')==d.get('test')]
            coverage.append({'plan_id':r.id,'material_code':d.get('material_code'),'month':month,'test':d.get('test'), 'tests':len(matches),'status':'Completed' if matches else 'Scheduled' if month>date.today().isoformat()[:7] else 'Pending' if month==date.today().isoformat()[:7] else 'Overdue'})
    return {'element':element,'stage':stage,'items':items,'coverage':coverage,'control_limit':limit_val,'material_type':material_type,'control_limits':control_limits,'basis':'Max/average tính lại từ số đo IQC result / OQC result, tách riêng công đoạn. Đây là nồng độ sàng lọc, không phải tỷ lệ PASS. Kế hoạch đối chiếu mã và Old Part Code.'}

