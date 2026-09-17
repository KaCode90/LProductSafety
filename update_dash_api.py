import re
with open('backend/dashboard.py', 'r', encoding='utf-8') as f:
    content = f.read()

# I will rewrite the overview function.
new_overview = '''@router.get('/overview')
def overview(user:Account=Depends(current_user),db:Session=Depends(get_db)):
    visible=all_visible(db,user); limits=standards(db)
    rows=[serialize(r,limits) for r in visible]
    materials=[r for r in rows if r['module']=='materials' and r['data'].get('usage_status') != 'Ngừng sử dụng']
    reports=[r for r in rows if r['module'] in ('reports','oqc-reports')]
    
    # Pre-calculate active materials and their compliance
    # Material Compliance Logic:
    mat_status = {}
    valid_reports_total = 0
    required_reports_total = 0
    coverage_stats = {'fmd':0, 'declaration':0, 'xrf':0}
    alerts = []
    
    for m in materials:
        d = m['data']
        mat_code = d.get('material_code', '')
        # Determine required tests
        req_tests = d.get('required_tests')
        if isinstance(req_tests, str):
            req_tests = [x.strip() for x in req_tests.split(',') if x.strip()]
        elif not isinstance(req_tests, list):
            req_tests = []
            
        mat_reports = [r for r in reports if r['data'].get('material_code') == mat_code]
        
        # Coverage
        has_fmd = any(r['module']=='fmd' and r['data'].get('material_code')==mat_code for r in rows)
        if has_fmd: coverage_stats['fmd']+=1
        has_decl = any(r['module'] in ('declarations','material-declarations') and r['data'].get('material_code')==mat_code for r in rows)
        if has_decl: coverage_stats['declaration']+=1
        has_xrf = any(r['module'] in ('xrf-iqc','xrf-oqc') and r['data'].get('material_code')==mat_code for r in rows)
        if has_xrf: coverage_stats['xrf']+=1
        
        status = 'Compliant' if req_tests else 'N/A'
        expiring_soon = False
        
        required_reports_total += len(req_tests)
        
        for rt in req_tests:
            # find matching report
            matching = [r for r in mat_reports if r['data'].get('test_type') == rt or rt in str(r['data'].get('test_type',''))]
            if not matching:
                status = 'Pending'
                alerts.append({'type':'missing','material_code':mat_code,'test':rt,'id':m['id'],'title':f"Missing {rt} Report - {mat_code}"})
                continue
            
            # sort by date to get latest
            latest = sorted(matching, key=lambda x: str(x['data'].get('expiry_date') or '9999'), reverse=True)[0]
            result = str(latest['data'].get('result','')).upper()
            validity = latest['display_status']
            
            if result == 'FAIL' or validity in ('Expired', 'Overdue', 'NG'):
                status = 'Non-Compliant'
                alerts.append({'type':'expired','material_code':mat_code,'test':rt,'id':latest['id'],'title':f"{rt} Report Expired/FAIL - {mat_code}"})
            elif result == 'PASS':
                valid_reports_total += 1
                if validity == 'Expiring Soon':
                    expiring_soon = True
                    alerts.append({'type':'expiring','material_code':mat_code,'test':rt,'id':latest['id'],'title':f"{rt} expires soon - {mat_code}"})
            else:
                if status != 'Non-Compliant': status = 'Pending'
                
        if status == 'Compliant' and expiring_soon:
            status = 'Expiring Soon'
            
        m['computed_status'] = status
        mat_status[status] = mat_status.get(status, 0) + 1
        if status == 'Pending' and len(req_tests) > 0:
            alerts.append({'type':'pending_review','material_code':mat_code,'id':m['id'],'title':f"Material pending review - {mat_code}"})

    total_active = len(materials)
    hsf_compliance = round(100 * mat_status.get('Compliant',0) / total_active, 1) if total_active else 0
    
    # Generic open actions from CAPA or other
    open_actions = sum(1 for r in rows if r['module'] in ('ncr','capa') and r['data'].get('status') not in ('Closed','Completed','Not Applicable'))
    for r in rows:
        if r['module'] == 'capa' and r['display_status'] == 'Overdue':
            alerts.append({'type':'overdue_capa','id':r['id'],'title':f"CAPA Overdue - {r['data'].get('issue')}"})
            
    # Trend function is handled separately, but we just return these KPIs
    return {
        'hsf_compliance': hsf_compliance,
        'compliant_materials': mat_status.get('Compliant',0),
        'active_materials': total_active,
        'valid_reports': valid_reports_total,
        'required_reports': required_reports_total,
        'open_actions': len(alerts),
        'alerts': alerts[:20],
        'coverage': {
            'fmd': coverage_stats['fmd'],
            'declaration': coverage_stats['declaration'],
            'xrf': coverage_stats['xrf'],
            'total_materials': total_active
        }
    }
'''

content = re.sub(r'@router\.get\(\'/overview\'\).*?(?=@router\.get)', new_overview, content, flags=re.DOTALL)

with open('backend/dashboard.py', 'w', encoding='utf-8') as f:
    f.write(content)
