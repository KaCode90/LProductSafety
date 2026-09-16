"""Read source workbooks without saving them; retain cell/row provenance."""
import hashlib
from collections import Counter
from datetime import datetime, date
from pathlib import Path
import warnings
import openpyxl
from sqlalchemy import select
from backend.store import Record, ImportLog, log

ROOT = Path(__file__).resolve().parents[1]
FILES = ['NFV2_FMD.xlsx','NFV2_TRM.xlsx','NFV2_XRF Test Plan_Product Safety Management.xlsx']


def clean(value):
    if isinstance(value, (datetime,date)):
        return value.date().isoformat() if isinstance(value,datetime) else value.isoformat()
    if isinstance(value,str):
        return value.strip()
    return value if value is not None else ''


def read_workbook(path):
    with warnings.catch_warnings():
        warnings.simplefilter('ignore', UserWarning)
        wb = openpyxl.load_workbook(path, data_only=True)
        formulas = openpyxl.load_workbook(path, data_only=False)
    entries=[]
    issues=[]
    sheets=[]

    def add(module, sheet, row, mapping, extra=None):
        data = {key:clean(sheet.cell(row,col).value) for key,col in mapping.items()}
        data.update(extra or {})
        data.setdefault('status','Pending')
        source = {'file':path.name,'sheet':sheet.title,'row':row,
                  'cells':{c.coordinate:clean(c.value) for c in sheet[row] if c.value is not None},
                  'formulas':{c.coordinate:c.value for c in formulas[sheet.title][row] if c.data_type=='f'}}
        data['_source']=source
        key=hashlib.sha256(f'{path.name}|{sheet.title}|{row}|{module}'.encode()).hexdigest()
        entries.append((module,key,data))

    for sheet in wb:
        populated=sum(any(c.value is not None for c in r) for r in sheet)
        sheets.append({'name':sheet.title,'rows':sheet.max_row,'populated_rows':populated,'columns':sheet.max_column})
        for row in sheet:
            for c in row:
                if c.data_type=='e':
                    issues.append({'type':'Excel error','sheet':sheet.title,'cell':c.coordinate,'value':str(c.value)})
        name=sheet.title.strip()
        if path.name==FILES[0]:
            for r in range(3,sheet.max_row+1):
                if sheet.cell(r,3).value:
                    add('fmd',sheet,r,dict(project=2,material_code=3,material_name=4,supplier=5,cas=6,substance=7,composition=8,test_type=9,report_id=10,lab=11,issue_date=12,expiry_date=13,flag=14,investigation=15,result=16))
        elif path.name==FILES[1]:
            if name=='TRM Form':
                for r in range(3,sheet.max_row+1):
                    if sheet.cell(r,8).value:
                        add('reports',sheet,r,dict(project=2,material_code=3,material_name=4,supplier=5,manufacturer=6,test_type=7,report_id=8,method=9,issue_date=10,expiry_date=11,result=12,lab=13,file_reference=14,notes=15))
            elif name=='OQC':
                for r in range(3,sheet.max_row+1):
                    if sheet.cell(r,4).value:
                        add('oqc-reports',sheet,r,dict(project=2,test_type=3,report_id=4,method=5,issue_date=6,expiry_date=7,result=8,lab=9,file_reference=10,notes=11))
            elif name=='Test Plan':
                for r in (5,6):
                    add('cts-2',sheet,r,dict(project=1,test=2,category=3,frequency=4,requirement=5),{'requirement_id':f'TRM-PLAN-{r}','notes':'Yêu cầu từ workbook; cần QA review trước khi phê duyệt.'})
                for r in range(9,sheet.max_row+1):
                    if isinstance(sheet.cell(r,1).value,(int,float)) and sheet.cell(r,4).value:
                        add('test-plan',sheet,r,dict(project=2,material_code=3,material_name=4,test_type=5,test=6,category=7,sample_size=8,availability=9,cp=10,oct=11,nov=12,dec=13))
        else:
            if name=='Test Plan':
                for r in (4,5,6):
                    add('cts-2',sheet,r,dict(test=2,category=3,npi_frequency=4,mp_frequency=5),{'requirement_id':f'XRF-FREQUENCY-{r}','requirement':f'{sheet.cell(r,2).value}: NPI {sheet.cell(r,4).value}; MP {sheet.cell(r,5).value}'})
                for r in range(9,sheet.max_row+1):
                    if not isinstance(sheet.cell(r,1).value,(int,float)) or not sheet.cell(r,4).value:
                        continue
                    mapping=dict(project=2,config=3,material_code=4,old_code=5,material_name=6,supplier=7,test=8,category=9,notes=10,thickness=11,sample_size=12)
                    months=['2025-10','2025-11','2025-12']+['2026-'+str(i).zfill(2) for i in range(1,13)]
                    extra={}
                    for c,m in enumerate(months,13):
                        value=sheet.cell(r,c).value
                        extra['plan_'+m]='Planned' if value is True or value==1 else 'Not planned' if value is False or value==0 else clean(value)
                    category=str(sheet.cell(r,9).value or '')
                    idx=4 if category=='Direct Material' else 5 if category=='Indirect Material' else 6
                    extra.update(npi_frequency=clean(sheet.cell(idx,4).value),mp_frequency=clean(sheet.cell(idx,5).value))
                    add('xrf-plan',sheet,r,mapping,extra)
            elif name=='Standard':
                for r in range(2,8):
                    for material,col,spec_col in [('Polymers',6,2),('Metals/Ceramic/Glass',7,None),('Composite',8,3),('Packaging',9,4)]:
                        control=clean(sheet.cell(r,col).value)
                        extra={'material_type':material,'control_limit':control if isinstance(control,(int,float)) else '', 'spec_limit':clean(sheet.cell(r,spec_col).value) if spec_col else '', 'rule':control if isinstance(control,str) else ''}
                        add('xrf-standard',sheet,r,dict(element=5),extra)
                        module,key,data=entries[-1]
                        entries[-1]=(module,hashlib.sha256((key+material).encode()).hexdigest(),data)
            elif name in ('IQC result','OQC result','Change Control'):
                if name=='IQC result':
                    module='xrf-iqc'; mapping=dict(material_code=2,material_name=3,supplier=4,test=5,category=6,build=7,material_type=8,arrival_date=9,lot=10,test_date=11,test_month=12,br=14,cl=15,cd=16,pb=17,cr=18,hg=19,notes=20)
                elif name=='OQC result':
                    module='xrf-oqc'; mapping=dict(project=2,material_code=3,material_name=4,test=5,category=6,notes=7,material_type=8,build=9,lot=10,test_date=11,result=12,br=13,cl=14,cd=15,pb=16,cr=17,hg=18)
                else:
                    module='change-control'; mapping=dict(material_code=2,material_name=3,test=4,category=5,notes=6,material_type=7,build=8,lot=9,test_date=10,result=11,br=12,cl=13,cd=14,pb=15,cr=16,hg=17)
                for r in range(4,sheet.max_row+1):
                    if sheet.cell(r,mapping['material_code']).value and sheet.cell(r,mapping['test_date']).value:
                        add(module,sheet,r,mapping)
            # IQC Trend is a pivot/cache; trend is recomputed from raw IQC measurements.
        if name=='BOM':
            supplier_col=10 if path.name==FILES[1] else 9
            for r in range(2,sheet.max_row+1):
                if sheet.cell(r,8).value:
                    add('bom',sheet,r,dict(customer=1,config=2,parent_code=3,project=4,category=5,level=6,material_code=7,material_name=8,supplier=supplier_col,norm=supplier_col+1))
    wb.close(); formulas.close()
    return entries, {'sheets':sheets,'issues':issues,'counts':dict(Counter(x[0] for x in entries))}


def import_sources(db, actor='System', root=ROOT):
    results=[]
    for filename in FILES:
        path=root/filename
        if not path.exists():
            results.append({'file':filename,'state':'missing'})
            continue
        checksum=hashlib.sha256(path.read_bytes()).hexdigest()
        previous=db.scalar(select(ImportLog).where(ImportLog.filename==filename))
        if previous:
            results.append({'file':filename,'state':'already_imported' if previous.checksum==checksum else 'source_changed_review_required','summary':previous.summary})
            continue
        entries,summary=read_workbook(path)
        for module,key,data in entries:
            db.add(Record(module=module,source_key=key,data=data))
        db.add(ImportLog(filename=filename,checksum=checksum,summary=summary))
        log(db,actor,'Nhập Excel: '+filename,after=summary)
        db.flush()
        results.append({'file':filename,'state':'imported','summary':summary})
    # Build material/supplier masters without overwriting any existing user edits.
    records=db.scalars(select(Record).where(Record.archived==False)).all()
    known={r.data.get('material_code') for r in records if r.module=='materials'}
    suppliers={r.data.get('supplier','').casefold() for r in records if r.module=='suppliers'}
    grouped={}
    for record in records:
        d=record.data
        code=str(d.get('material_code','')).strip()
        if record.module in ('fmd','reports','bom','xrf-plan','xrf-iqc','xrf-oqc') and code not in ('','-','N/A'):
            grouped.setdefault(code,[]).append(d)
        supplier=str(d.get('supplier','')).strip()
        if supplier and supplier.casefold() not in suppliers:
            db.add(Record(module='suppliers',data={'supplier':supplier,'status':'Pending'}))
            suppliers.add(supplier.casefold())
    for code,variants in grouped.items():
        if code in known:
            continue
        first=next((v for v in variants if v.get('manufacturer')),variants[0])
        data={k:first.get(k,'') for k in ('material_name','supplier','manufacturer','material_type','project','category')}
        data.update(material_code=code,status='Pending',approval='Pending',_sources=[v.get('_source',{}) for v in variants])
        db.add(Record(module='materials',data=data))
    db.commit()
    return results
