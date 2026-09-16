"""Shared forms, table columns and navigation for the operational application."""
def field(key, label, kind='text', options=None, required=False):
    return {'key': key, 'label': label, 'type': kind, 'options': options or [], 'required': required}


def fields(spec):
    return [field(*entry) for entry in spec]


STATUS = ['Pending', 'Compliant', 'NG', 'Not Applicable', 'Open', 'On-going', 'Pending Verification', 'Closed', 'Completed']
COMMON = fields([('dri', 'DRI'), ('department', 'Department'), ('due_date', 'Hạn xử lý / review', 'date'), ('status', 'Trạng thái', 'select', STATUS), ('notes', 'Ghi chú', 'textarea')])
MATERIAL = fields([('material_code','Mã vật liệu','text',None,True),('material_name','Tên vật liệu','text',None,True),('supplier','Nhà cung cấp'),('manufacturer','Nhà sản xuất'),('material_type','Loại vật liệu'),('project','Project'),('application','Ứng dụng'),('cts_category','CTS Category'),('requirement','Requirement áp dụng'),('approval','Phê duyệt','select',['Pending','Approved','Rejected'])])
REPORT = fields([('report_id','Số báo cáo','text',None,True),('test_type','Loại test'),('material_code','Mã vật liệu'),('material_name','Vật liệu / Thành phẩm'),('project','Project'),('supplier','Nhà cung cấp'),('manufacturer','Nhà sản xuất'),('lab','Phòng Lab'),('method','Phương pháp test','textarea'),('issue_date','Ngày phát hành','date'),('expiry_date','Ngày hết hạn','date'),('result','Kết quả nguồn'),('file_reference','File trong workbook')])
REQUIREMENT = fields([('requirement_id','Requirement ID','text',None,True),('requirement','Nội dung yêu cầu','textarea',None,True),('category','Category'),('frequency','Tần suất'),('last_review','Review gần nhất','date')])
DOC = fields([('document_no','Document No.','text',None,True),('document_name','Tên tài liệu','text',None,True),('category','Nhóm tài liệu'),('revision','Revision'),('owner','Owner'),('effective_date','Ngày hiệu lực','date'),('review_date','Ngày review','date'),('tags','Tags'),('material_code','Mã vật liệu liên quan')])
XRF = fields([('material_code','Part Code','text',None,True),('material_name','Part Name'),('supplier','Supplier'),('project','Model'),('category','Category'),('build','Build / Phase'),('material_type','Nhóm vật liệu','select',['Polymers','Metals/Ceramic/Glass','Composite','Packaging']),('lot','Lot No.'),('arrival_date','Ngày nhận','date'),('test_date','Ngày test','date'),('br','Br (ppm)','number'),('cl','Cl (ppm)','number'),('cd','Cd (ppm)','number'),('pb','Pb (ppm)','number'),('cr','Cr (ppm)','number'),('hg','Hg (ppm)','number'),('result','Kết quả nguồn')])

MODULES = {}


def module(key, title, group, form, description='', common=True):
    MODULES[key] = {'id':key,'title':title,'group':group,'fields':form + (COMMON if common else []),'description':description}


RSS_FIELDS = fields([('chemical_group','Chemical or Group','text',None,True),('cas_no','CAS No.','text',None,True),('limit','Threshold Limit','textarea'),('scope','Scope','textarea'),('example','Example','textarea')])

for key, title in [('cts-2','CTS_2 – IQC / OQC'),('cts-3','CTS_3 – VOC / SVHC')]:
    module(key,title,'compliance',REQUIREMENT,'Quản lý requirement, review, DRI và evidence.')
module('cts-1', 'CTS_1 – Chất hạn chế', 'compliance', RSS_FIELDS, 'Danh mục tiêu chuẩn chất hạn chế của Apple (Apple Regulated Substances Specification).', common=False)
module('declarations','Tuyên bố tuân thủ','compliance',fields([('declaration_no','Declaration No.','text',None,True),('material_code','Mã vật liệu'),('supplier','Nhà cung cấp'),('scope','Phạm vi','textarea'),('issue_date','Ngày phát hành','date'),('expiry_date','Ngày hết hạn','date'),('approval','Phê duyệt','select',['Pending','Approved','Rejected'])]))
module('materials','Danh mục vật liệu','materials',MATERIAL,'Mở một vật liệu để xem toàn bộ FMD, TRM, XRF, tài liệu và lịch sử.')
module('suppliers','Hồ sơ nhà cung cấp','materials',fields([('supplier','Nhà cung cấp','text',None,True),('manufacturer','Nhà sản xuất'),('contact','Người liên hệ'),('email','Email','email'),('phone','Điện thoại'),('address','Địa chỉ','textarea')]))
module('reports','Báo cáo thử nghiệm / TRM','materials',REPORT,'Mapping báo cáo theo vật liệu; ngày hết hạn tính riêng với kết quả PASS/FAIL nguồn.')
module('material-declarations','Tuyên bố / Declaration','materials',MODULES['declarations']['fields'],common=False)
module('fmd','FMD – Thành phần & CAS','materials',fields([('material_code','Mã vật liệu','text',None,True),('material_name','Tên vật liệu'),('project','Project'),('supplier','Supplier'),('cas','CAS No.'),('substance','Substance Name','text',None,True),('composition','Composition (%)'),('test_type','Test Report'),('report_id','Test Report ID'),('lab','Test Lab'),('issue_date','Certification Date','date'),('expiry_date','Expiration Date','date'),('flag','Flag','textarea'),('investigation','Flag Investigation','textarea'),('result','Kết quả nguồn')]),'Giữ nguyên khoảng thành phần; không tự quy đổi >= / <= thành tỷ lệ chính xác.')
module('bom','BOM – Project / POR / DOE','materials',fields([('customer','Customer'),('config','Config'),('parent_code','Mã thành phẩm'),('project','Model'),('category','Category'),('level','Level','number'),('material_code','Part Code','text',None,True),('material_name','Part Name'),('supplier','Supplier'),('norm','NORM')]))
module('test-plan','Kế hoạch test bên thứ ba','materials',fields([('project','Model'),('material_code','Part Code'),('material_name','Part Name','text',None,True),('test_type','Loại test'),('test','IQC / OQC'),('category','Category'),('sample_size','Sample size'),('availability','Availability'),('cp','CP'),('oct','Oct 2025'),('nov','Nov 2025'),('dec','Dec 2025')]))
module('oqc-reports','Báo cáo thành phẩm / OQC','materials',REPORT)
module('xrf-plan','XRF – Kế hoạch NPI / MP','xrf',fields([('project','Model'),('config','Config'),('material_code','Part Code','text',None,True),('old_code','Old Part Code'),('material_name','Part Name'),('supplier','Supplier'),('test','IQC / OQC'),('category','Category'),('thickness','Độ dày / pcs (µm)'),('sample_size','Số lớp / số pcs'),('npi_frequency','Tần suất NPI'),('mp_frequency','Tần suất MP')]) + [field('plan_'+m,m,'select',['Planned','Not planned','NFV1 Control']) for m in ['2025-10','2025-11','2025-12']+['2026-'+str(i).zfill(2) for i in range(1,13)]])
for key,title in [('xrf-iqc','XRF – Kết quả IQC'),('xrf-oqc','XRF – Kết quả OQC'),('change-control','XRF – Change Control')]:
    module(key,title,'xrf',XRF,'Đánh giá sàng lọc theo Control Limit của sheet Standard; không thay thế phê duyệt compliance.')
module('xrf-standard','XRF – Giới hạn kiểm soát','xrf',fields([('element','Chất','text',None,True),('material_type','Nhóm vật liệu','text',None,True),('control_limit','Control Limit (ppm)','number'),('spec_limit','Spec Limit (ppm)','number'),('rule','Quy tắc kết hợp','textarea')]),'Nguồn: sheet Standard của workbook. Ô trống giữ là chưa có giới hạn, không coi là 0.')
module('organization','Cơ cấu tổ chức & DRI','management',fields([('department_name','Department','text',None,True),('role','Vai trò'),('primary','Người phụ trách'),('backup','Người backup'),('responsibility','Trách nhiệm','textarea'),('email','Email','email')]))
module('training','Đào tạo','management',fields([('course','Khóa học','text',None,True),('employee','Nhân viên','text',None,True),('training_date','Ngày đào tạo','date'),('expiry_date','Ngày hết hạn','date'),('trainer','Trainer'),('certificate','Certificate')]))
module('risk','Công đoạn rủi ro cao','management',fields([('process','Process','text',None,True),('risk_category','Risk Category'),('concern','Mối nguy','textarea'),('substance','Chất liên quan'),('control','Kiểm soát','textarea'),('frequency','Tần suất')]))
module('ncr','Non-Conformity','management',fields([('ncr_no','NCR No.','text',None,True),('issue_date','Ngày phát sinh','date'),('source','Nguồn phát hiện'),('material_code','Vật liệu / Process'),('issue','Issue','textarea',None,True),('severity','Severity','select',['Minor','Major','Critical']),('containment','Containment','textarea')]))
module('capa','CAPA','management',fields([('capa_no','CAPA No.','text',None,True),('ncr_no','NCR liên quan'),('material_code','Mã vật liệu'),('issue','Issue','textarea'),('containment','Containment','textarea'),('root_cause','Root Cause','textarea'),('corrective','Corrective Action','textarea'),('preventive','Preventive Action','textarea'),('verification','Verification','textarea'),('closure','Closure','textarea')]),'Timeline từ Issue đến Closure; đóng CAPA yêu cầu xác minh và evidence.')
for key,title in [('procedures','Quy trình & Tiêu chuẩn'),('documents','Hồ sơ'),('retention-records','Lưu mẫu / Lưu dữ liệu'),('appendices','Phụ lục')]:
    module(key,title,'documents',DOC)
module('master-data','Master Data','settings',fields([('category','Danh mục','select',['Supplier','Manufacturer','Material Type','Project','CTS Category','Compliance Status','Department','Test Type','Laboratory','Document Category','Risk Category'],True),('value','Giá trị','text',None,True)]))

GROUPS = [('dashboard','Dashboard'),('compliance','Tuân thủ'),('xrf','XRF'),('materials','Vật liệu & Báo cáo thử nghiệm'),('management','Quản lý'),('documents','Trung tâm tài liệu'),('settings','Cài đặt')]
SPECIAL = {'dashboard': [('dashboard','Dashboard')], 'compliance':[], 'xrf':[('xrf-trend','XRF – Xu hướng & thực hiện')], 'documents':[('imports','Nguồn Excel & đối chiếu')], 'settings':[('users','Quản lý người dùng'),('roles','Vai trò & Phân quyền'),('notifications','Cài đặt thông báo'),('retention','Quy định lưu trữ'),('system','Cấu hình hệ thống')]}


def catalog():
    groups=[]
    for key,title in GROUPS:
        items=[{'id':k,'name':v['title']} for k,v in MODULES.items() if v['group']==key]
        items += [{'id':k,'name':v} for k,v in SPECIAL.get(key,[])]
        groups.append({'id':key,'name':title,'items':items})
    return {'modules':MODULES,'groups':groups}
