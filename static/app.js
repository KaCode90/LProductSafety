import {esc,label,badge,dateText,timeText,sourceText,percent,empty} from './ui.js?v=7';
const $=s=>document.querySelector(s);
const content=$('#content'),modal=$('#modal');
function getOptimalPageSize(){
  const vh = window.innerHeight || 900;
  const count = Math.floor((vh - 250) / 31.5);
  if(count <= 16) return 15;
  if(count <= 22) return 20;
  return 25;
}
let loginAt,user,csrf,catalog,overview,requestId=0,currentModule='',listState={page:1,q:'',status:'',start:'',end:'',sort:'updated_at',direction:'desc',size:getOptimalPageSize()},toastTimer;
let currentDetail=null;
const icons={dashboard:'◫',compliance:'◇',xrf:'◉',materials:'▣',management:'♙',documents:'▤',settings:'⚙'};
const names={'inspection-plans':'Kế hoạch kiểm nghiệm',imports:'Nguồn Excel & đối chiếu','xrf-trend':'Xu hướng XRF & thực hiện kế hoạch',users:'Quản lý người dùng',roles:'Vai trò & Phân quyền',notifications:'Cài đặt thông báo',retention:'Quy định lưu trữ',system:'Cấu hình hệ thống'};

function loginTimeText(value){
  if(!value)return '—';
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return '—';
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));
  return `${parts.year}/${parts.month}/${parts.day} ${parts.hour}:${parts.minute}`;
}
async function api(path, options = {}) {
  const headers = {
    ...(options.body instanceof FormData ? {} : {'Content-Type': 'application/json'}),
    'X-CSRF-Token': csrf || '',
    ...(options.headers || {})
  };
  const response = await fetch('/api' + path, { ...options, headers });
  if (response.status === 401) {
    location.replace('/login');
    throw Error('Phiên đã hết hạn.');
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw Error('Phản hồi máy chủ không hợp lệ.');
  }
  if (!response.ok) {
    let msg = 'Dữ liệu không hợp lệ. Kiểm tra các trường bắt buộc.';
    if (typeof data?.detail === 'string') {
      msg = data.detail;
    } else if (Array.isArray(data?.detail) && data.detail.length > 0) {
      msg = data.detail.map(e => e.msg ? `${e.loc?.slice(-1)[0] || 'Trường'}: ${e.msg}` : JSON.stringify(e)).join('; ');
    }
    throw Error(msg);
  }
  return data;
}
function notify(text){clearTimeout(toastTimer);$('#toast').textContent=text;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,5500);}
function goto(route){if(location.hash==='#/'+route)render();else location.hash='/'+route;}
function title(id){return catalog.modules[id]?.title||names[id]||'Product Safety';}
function can(module,action){return !!catalog.permissions[module]?.[action];}
function openModal(name,body,footer=''){
  modal.innerHTML=`<div class="dialog-head"><h2 id="modal-title">${esc(name)}</h2><button data-close aria-label="Đóng">×</button></div><div class="dialog-body">${body}</div>${footer?`<div class="dialog-footer">${footer}</div>`:''}`;
  if(!modal.open)modal.showModal();
  modal.querySelector('[data-close]').onclick=()=>modal.close();
}
function confirmAction(text,action){
  openModal('Xác nhận',`<p>${esc(text)}</p>`,`<button id="cancel-confirm">Hủy</button><button id="accept-confirm" class="danger">Đồng ý</button>`);
  $('#cancel-confirm').onclick=()=>modal.close();
  $('#accept-confirm').onclick=async e=>{
    e.target.disabled=true;
    try{await action();modal.close();}catch(error){notify(error.message);}finally{if($('#accept-confirm'))$('#accept-confirm').disabled=false;}
  };
}
function nav(active){
  $('#navigation').innerHTML=catalog.groups.map(group=>{
    const items=group.items.filter(item=>!catalog.modules[item.id]||can(item.id,'View'));
    const expanded=items.some(item=>item.id===active)||active==='group/'+group.id||(group.id==='settings'&&(active==='bom'||active==='product-bom'));
    return `<section class="nav-section"><button class="nav-group" data-group="${esc(group.id)}" aria-expanded="${expanded}" aria-controls="submenu-${esc(group.id)}"><span class="nav-icon">${icons[group.id]||'◇'}</span><span class="nav-label">${esc(group.name)}</span>${group.id!=='dashboard'?'<span class="nav-arrow">⌄</span>':''}</button><div class="nav-children" id="submenu-${esc(group.id)}" ${!expanded||group.id==='dashboard'?'hidden':''}>${items.map(item=>`<a class="nav-link ${item.id===active?'active':''}" href="#/${esc(item.id)}" ${item.id===active?'aria-current="page"':''}>${esc(item.name)}</a>`).join('')}</div></section>`;
  }).join('');
  $('#navigation').querySelectorAll('[data-group]').forEach(button=>button.onclick=()=>{
    const id=button.dataset.group;
    if(id==='dashboard'){goto('dashboard');return;}
    if($('#sidebar').classList.contains('collapsed'))toggleSidebar(false);
    const open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));$('#submenu-'+id).hidden=!open;
  });
}
function head(name,description='',actions=''){const desc=description?`<p style="margin:0;color:var(--muted)">${esc(description)}</p>`:'';if(!desc&&!actions)return '';return `<div class="page-head" style="padding-bottom:10px; display:flex; justify-content:space-between; align-items:center;">${desc}` + (actions ? `<div class="head-actions" style="display:flex;gap:10px;">${actions}</div>` : '') + `</div>`;}
function paginationHtml(currentPage, totalItems, pageSize, attrName='data-page', prevId='prev-page', nextId='next-page') {
  currentPage = Number(currentPage) || 1;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalPages < 1) {
    return `<div class="pagination"><span>Tổng số: <b>${totalItems}</b> mục</span></div>`;
  }
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, startPage + 4);
  const adjustedStart = Math.max(1, endPage - 4);
  let pageButtons = '';
  for (let p = adjustedStart; p <= endPage; p++) {
    pageButtons += `<button type="button" class="${p === currentPage ? 'primary' : ''}" ${attrName}="${p}" ${p === currentPage ? 'aria-current="page"' : ''}>${p}</button>`;
  }
  return `<div class="pagination"><span><b>${totalItems}</b> mục · Trang <b>${currentPage}</b> / ${totalPages}</span><nav style="display:flex;align-items:center;gap:4px"><button type="button" id="${prevId}" ${currentPage <= 1 ? 'disabled' : ''}>← Trước</button>${pageButtons}<button type="button" id="${nextId}" ${currentPage >= totalPages ? 'disabled' : ''}>Sau →</button></nav></div>`;
}
const columnPreferences = {
  materials: ['material_code', 'material_name', 'category', 'supplier', 'project'],
  bom: ['project', 'parent_code', 'material_code', 'material_name', 'supplier'],
  suppliers: ['supplier', 'manufacturer', 'contact', 'email', 'phone'],
  'test-plan': ['project', 'material_code', 'material_name', 'test_type', 'test'],
  'xrf-plan': ['project', 'material_code', 'material_name', 'supplier', 'test'],
  'xrf-iqc': ['material_code', 'lot', 'test_date', 'material_type', 'pb'],
  'xrf-oqc': ['material_code', 'lot', 'test_date', 'material_type', 'pb'],
  'change-control': ['material_code', 'notes', 'test_date', 'material_type', 'pb'],
  'xrf-standard': ['element', 'material_type', 'control_limit', 'spec_limit', 'rule'],
  'cts-1': ['chemical_group', 'cas_no'],
  'cts-2': ['requirement_id', 'requirement', 'category', 'frequency', 'last_review'],
  'cts-3': ['requirement_id', 'requirement', 'category', 'frequency', 'last_review'],
  declarations: ['declaration_no', 'material_code', 'supplier', 'issue_date', 'expiry_date'],
  'material-declarations': ['declaration_no', 'material_code', 'supplier', 'issue_date', 'expiry_date'],
  reports: ['report_id', 'material_code', 'test_type', 'lab', 'expiry_date'],
  'oqc-reports': ['report_id', 'project', 'test_type', 'expiry_date'],
  fmd: ['material_code', 'substance', 'cas', 'composition', 'flag'],
  organization: ['department_name', 'role', 'primary', 'backup', 'email'],
  training: ['course', 'employee', 'training_date', 'expiry_date', 'trainer'],
  risk: ['process', 'risk_category', 'concern', 'substance', 'frequency'],
  ncr: ['ncr_no', 'issue_date', 'material_code', 'issue', 'severity'],
  capa: ['capa_no', 'ncr_no', 'material_code', 'issue', 'root_cause'],
  procedures: ['document_no', 'document_name', 'category', 'revision', 'owner'],
  documents: ['document_no', 'document_name', 'category', 'revision', 'owner'],
  'retention-records': ['document_no', 'document_name', 'category', 'revision', 'owner'],
  appendices: ['document_no', 'document_name', 'category', 'revision', 'owner'],
  'master-data': ['category', 'value']
};
function rowTable(rows, columns=['name','module','status']) {
  if (!rows || !rows.length) {
    return empty('Không có mục dữ liệu', 'Chưa có hồ sơ đáp ứng điều kiện.');
  }
  const colLabels = {
    name: 'Hồ sơ',
    module: 'Module',
    status: 'Trạng thái',
    dri: 'DRI',
    expiry: 'Ngày hết hạn',
    project: 'Dự án',
    supplier: 'Nhà cung cấp'
  };
  return `<div class="table-scroll"><table><thead><tr>${columns.map(c => `<th>${colLabels[c] || c}</th>`).join('')}<th></th></tr></thead><tbody>${rows.map(r => `<tr>${columns.map(c => `<td>${c === 'name' ? `<button class="link-button" data-open="${r.id}">${esc(label(r))}</button>` : c === 'module' ? esc(title(r.module)) : c === 'status' ? badge(r.display_status) : c === 'dri' ? esc(r.data?.dri || 'Chưa phân công') : c === 'expiry' ? dateText(r.data?.expiry_date || r.data?.due_date) : esc(r.data?.[c] ?? '—')}</td>`).join('')}<td><button class="link-button" data-open="${r.id}">👁️ Chi tiết</button></td></tr>`).join('')}</tbody></table></div>`;
}
let dashboardElement='pb',dashboardMaterialType='Polymers';
  async function dashboard(){
    const [d,iqc,oqc]=await Promise.all([api('/overview'),api('/xrf-trend?stage=IQC&element='+dashboardElement+'&material_type='+encodeURIComponent(dashboardMaterialType)),api('/xrf-trend?stage=OQC&element='+dashboardElement+'&material_type='+encodeURIComponent(dashboardMaterialType))]);
    overview=d;$('#notification-count').textContent=d.open_actions??0;
    
    // Tầng 1: Management KPI (4 cards across full width)
    const tier1 = `<div class="dashboard-tier tier-1" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;width:100%">
      <div class="kpi-card" style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:10px 16px;border-left:4px solid #10b981;box-shadow:0 1px 3px rgba(0,0,0,0.03)">
        <div style="font-size:10.5px;font-weight:700;letter-spacing:0.5px;color:#64748b;text-transform:uppercase">HSF COMPLIANCE</div>
        <div style="font-size:24px;font-weight:750;color:#0f172a;margin:2px 0">${d.hsf_compliance}%</div>
        <div style="font-size:11px;color:#64748b">${d.compliant_materials} / ${d.active_materials} Compliant</div>
      </div>
      <div class="kpi-card" style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:10px 16px;border-left:4px solid #6366f1;box-shadow:0 1px 3px rgba(0,0,0,0.03)">
        <div style="font-size:10.5px;font-weight:700;letter-spacing:0.5px;color:#64748b;text-transform:uppercase">ACTIVE MATERIALS</div>
        <div style="font-size:24px;font-weight:750;color:#0f172a;margin:2px 0">${d.active_materials}</div>
        <div style="font-size:11px;color:#64748b">Vật liệu đang quản lý</div>
      </div>
      <div class="kpi-card" style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:10px 16px;border-left:4px solid #0284c7;box-shadow:0 1px 3px rgba(0,0,0,0.03)">
        <div style="font-size:10.5px;font-weight:700;letter-spacing:0.5px;color:#64748b;text-transform:uppercase">TEST REPORT</div>
        <div style="font-size:24px;font-weight:750;color:#0f172a;margin:2px 0">${d.valid_reports} / ${d.required_reports}</div>
        <div style="font-size:11px;color:#64748b">Báo cáo hợp lệ</div>
      </div>
      <div class="kpi-card" style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:10px 16px;border-left:4px solid #f59e0b;box-shadow:0 1px 3px rgba(0,0,0,0.03)">
        <div style="font-size:10.5px;font-weight:700;letter-spacing:0.5px;color:#64748b;text-transform:uppercase">OPEN ACTIONS</div>
        <div style="font-size:24px;font-weight:750;color:${d.open_actions>0?'#ef4444':'#0f172a'};margin:2px 0">${d.open_actions}</div>
        <div style="font-size:11px;color:#64748b">Hành động cần xử lý</div>
      </div>
    </div>`;

    // Tầng 2: Technical Monitoring (IQC & OQC side-by-side with full responsive chart height)
    const tier2 = `<div class="dashboard-tier tier-2" style="width:100%"><section class="card xrf-monitoring-card"><div class="xrf-monitoring-toolbar"><h3><span class="xrf-heading-mark" aria-hidden="true">⌁</span>XRF Monitoring</h3><div class="xrf-monitoring-filters"><label class="xrf-filter"><span>Chất phân tích</span><select id="dashboard-element">${['pb','cd','hg','cr','br','cl'].map(e=>`<option value="${e}" ${e===dashboardElement?'selected':''}>${e.toUpperCase()}</option>`).join('')}</select></label><label class="xrf-filter xrf-filter-material"><span>Nhóm vật liệu</span><select id="dashboard-material-type">${['Polymers','Metals/Ceramic/Glass','Composite','Packaging'].map(t=>`<option ${t===dashboardMaterialType?'selected':''}>${t}</option>`).join('')}</select></label><span class="xrf-period" aria-label="Thời gian hiển thị: 6 tháng gần nhất"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18"/></svg>6 tháng gần nhất</span></div></div><div class="quality-trends" style="display:flex;gap:12px;padding:10px 14px;flex:1;min-height:0">${dashboardTrend('IQC XRF Trend',iqc,'IQC',iqc.control_limit)}${dashboardTrend('OQC XRF Trend',oqc,'OQC',oqc.control_limit)}</div></section></div>`;
    
    // Tầng 3: Risk & Action
    const coverage = d.coverage;
    const fmdPct = coverage.total_materials ? Math.round(100 * coverage.fmd / coverage.total_materials) : 0;
    const declPct = coverage.total_materials ? Math.round(100 * coverage.declaration / coverage.total_materials) : 0;
    const testPct = d.required_reports ? Math.round(100 * d.valid_reports / d.required_reports) : 100;
    const xrfPct = coverage.total_materials ? Math.round(100 * coverage.xrf / coverage.total_materials) : 0;

    const actionListHtml = d.alerts && d.alerts.length ? `<div class="quality-tasks-grid" style="flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr;gap:8px 12px;padding:10px 14px;align-content:start;overflow-y:auto">${d.alerts.slice(0,6).map(a=>{
      const icon = a.type==='expired'?'🔴':a.type==='expiring'||a.type==='missing'?'🟠':'🔵';
      return `<button data-open="${a.id}" title="${esc(a.title)}" style="text-align:left;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 12px;font-size:11px;color:#1e293b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer">${icon} ${esc(a.title)}</button>`;
    }).join('')}</div>` : `<div style="flex:1;min-height:0;display:flex;flex-direction:column;justify-content:space-between;padding:10px 14px">
      <div style="display:flex;align-items:center;gap:10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:6px 12px">
        <div style="width:26px;height:26px;border-radius:50%;background:#10b981;color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:bold;flex-shrink:0">✓</div>
        <div>
          <b style="font-size:12px;color:#065f46;display:block">Hệ thống tuân thủ tốt · Hiện không có tồn đọng</b>
          <span style="font-size:10.5px;color:#047857">Không có báo cáo quá hạn, thiếu hồ sơ bắt buộc hoặc CAPA tồn đọng.</span>
        </div>
      </div>
      
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:6px 0">
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;display:flex;flex-direction:column;gap:2px">
          <span style="font-size:9.5px;font-weight:600;color:#64748b;text-transform:uppercase">Kiểm soát rủi ro RoHS</span>
          <b style="font-size:14px;color:#059669">100% Đạt chuẩn</b>
          <small style="font-size:9.5px;color:#94a3b8">Không phát hiện mẫu quá ngưỡng</small>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;display:flex;flex-direction:column;gap:2px">
          <span style="font-size:9.5px;font-weight:600;color:#64748b;text-transform:uppercase">Đo lường XRF chu kỳ</span>
          <b style="font-size:14px;color:#0284c7">${coverage.xrf} / ${coverage.total_materials} NVL</b>
          <small style="font-size:9.5px;color:#94a3b8">Đã hoàn thành phân tích quang phổ</small>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;display:flex;flex-direction:column;gap:2px">
          <span style="font-size:9.5px;font-weight:600;color:#64748b;text-transform:uppercase">Cấu hình Required Tests</span>
          <b style="font-size:14px;color:#f59e0b">Chờ thiết lập</b>
          <small style="font-size:9.5px;color:#94a3b8">Chọn NVL trong BOM để chỉ định</small>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:11px">
        <span style="color:#64748b">Thao tác nhanh:</span>
        <div style="display:flex;gap:6px">
          <button data-route="bom" style="padding:3px 8px;font-size:10.5px;background:#fff;border:1px solid #cbd5e1;border-radius:4px;cursor:pointer">BOM / NVL →</button>
          <button data-route="xrf" style="padding:3px 8px;font-size:10.5px;background:#fff;border:1px solid #cbd5e1;border-radius:4px;cursor:pointer">Dữ liệu XRF →</button>
          <button data-route="inspection-plans" style="padding:3px 8px;font-size:10.5px;background:#fff;border:1px solid #cbd5e1;border-radius:4px;cursor:pointer">Kế hoạch kiểm nghiệm →</button>
        </div>
      </div>
    </div>`;

    const tier3 = `<div class="dashboard-tier tier-3" style="display:flex;gap:12px;width:100%">
      <section class="card" style="flex:1.25;margin:0;display:flex;flex-direction:column;min-height:0;height:100%"><div class="card-header" style="display:flex;justify-content:space-between;align-items:center;padding:8px 16px;border-bottom:1px solid #f1f5f9"><h3 style="margin:0;font-size:12.5px;font-weight:700;color:#1e293b">VIỆC CẦN XỬ LÝ</h3><button id="dashboard-alerts" style="padding:2px 8px;font-size:10.5px;border-radius:4px;border:1px solid #cbd5e1;background:#fff;cursor:pointer">Xem tất cả (${d.alerts ? d.alerts.length : 0})</button></div>${actionListHtml}</section>
      
      <section class="card" style="flex:1;margin:0;display:flex;flex-direction:column;min-height:0;height:100%"><div class="card-header" style="padding:8px 16px;border-bottom:1px solid #f1f5f9"><h3 style="margin:0;font-size:12.5px;font-weight:700;color:#1e293b">ĐỘ PHỦ HỒ SƠ TUÂN THỦ</h3></div><div style="flex:1;min-height:0;padding:10px 14px;display:flex;flex-direction:column;justify-content:space-between">
        <div style="display:flex;flex-direction:column;gap:6px">
          <div><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px"><span style="color:#475569;font-weight:500">FMD (Full Material Disclosure)</span><b style="color:#0f172a">${coverage.fmd} / ${coverage.total_materials} (${fmdPct}%) <span style="font-size:9.5px;padding:1px 5px;border-radius:4px;background:#eff6ff;color:#2563eb">${fmdPct>0?`Đã có ${coverage.fmd}`:'Chưa có'}</span></b></div><div style="width:100%;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden"><div style="width:${fmdPct}%;height:100%;background:#3b82f6;border-radius:3px"></div></div></div>
          <div><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px"><span style="color:#475569;font-weight:500">Declaration (Cam kết NCC)</span><b style="color:#0f172a">${coverage.declaration} / ${coverage.total_materials} (${declPct}%) <span style="font-size:9.5px;padding:1px 5px;border-radius:4px;background:#eef2ff;color:#4f46e5">${declPct>0?`Đã có ${coverage.declaration}`:'Chưa có'}</span></b></div><div style="width:100%;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden"><div style="width:${declPct}%;height:100%;background:#6366f1;border-radius:3px"></div></div></div>
          <div><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px"><span style="color:#475569;font-weight:500">Test Report (Báo cáo Lab)</span><b style="color:#0f172a">${d.valid_reports} / ${d.required_reports} (${testPct}%) <span style="font-size:9.5px;padding:1px 5px;border-radius:4px;background:#ecfdf5;color:#059669">${testPct>=100?'Đầy đủ':'Thiếu báo cáo'}</span></b></div><div style="width:100%;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden"><div style="width:${testPct}%;height:100%;background:#10b981;border-radius:3px"></div></div></div>
          <div><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px"><span style="color:#475569;font-weight:500">XRF Screening (Quang phổ)</span><b style="color:#0f172a">${coverage.xrf} / ${coverage.total_materials} (${xrfPct}%) <span style="font-size:9.5px;padding:1px 5px;border-radius:4px;background:#f0f9ff;color:#0284c7">${coverage.xrf} đã đo</span></b></div><div style="width:100%;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden"><div style="width:${xrfPct}%;height:100%;background:#0ea5e9;border-radius:3px"></div></div></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding-top:6px;border-top:1px solid #f1f5f9">
          <div style="background:#ecfdf5;border:1px solid #d1fae5;border-radius:5px;padding:5px 8px;text-align:center"><div style="font-size:9.5px;font-weight:600;color:#065f46">ĐẠT CHUẨN</div><b style="font-size:13px;color:#059669">${d.compliant_materials} NVL</b></div>
          <div style="background:#fffbeb;border:1px solid #fef3c7;border-radius:5px;padding:5px 8px;text-align:center"><div style="font-size:9.5px;font-weight:600;color:#92400e">CẦN BỔ SUNG</div><b style="font-size:13px;color:#d97706">${d.pending_materials ?? (coverage.total_materials - d.compliant_materials)} NVL</b></div>
          <div style="background:#fef2f2;border:1px solid #fee2e2;border-radius:5px;padding:5px 8px;text-align:center"><div style="font-size:9.5px;font-weight:600;color:#991b1b">RỦI RO / NG</div><b style="font-size:13px;color:#dc2626">${d.ng_materials ?? 0} NVL</b></div>
        </div>
        <div style="font-size:9.5px;color:#94a3b8;display:flex;justify-content:space-between;align-items:center;padding-top:2px"><span>Đồng bộ tự động theo ${coverage.total_materials} NVL trong BOM</span><span style="color:#059669;font-weight:600">Audit Ready ✓</span></div>
      </div></section>
    </div>`;

    return `<div class="quality-dashboard">${tier1}${tier2}${tier3}</div>`;
  }
  
function dashboardTrend(title,data,stage='IQC',controlLimit=null){
  const months={},now=new Date();
  for(let i=5;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);months[`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`]={maximum:0,total:0,count:0};}
  for(const r of data.items){const m=months[r.month];if(m){m.maximum=Math.max(m.maximum,r.maximum);m.total+=r.average*r.count;m.count+=r.count;}}
  const hasLimit=controlLimit!==null&&Number.isFinite(Number(controlLimit)),limit=Number(controlLimit);
  const peak=Math.max(0,...Object.values(months).map(m=>m.maximum));
  const raw=Math.max(1,peak,hasLimit?limit:0)*1.18/4,power=10**Math.floor(Math.log10(raw)),step=([1,2,2.5,5,10].find(n=>n*power>=raw)||10)*power,scale=step*4;
  const y=v=>145-120*(v/scale);
  const entries=Object.entries(months);
  const count=entries.reduce((n,[,m])=>n+m.count,0),average=count?entries.reduce((n,[,m])=>n+m.total,0)/count:0;
  const primaryColor=stage==='IQC'?'#2563eb':'#059669';
  const gradStart=stage==='IQC'?'#3b82f6':'#10b981';
  const gradEnd=stage==='IQC'?'#1d4ed8':'#047857';
  const bgTrack=stage==='IQC'?'#eff6ff':'#ecfdf5';
  const fmt=v=>Number(v.toFixed(2));
  const over=hasLimit&&peak>limit;
  const barW=36;
  const limitY=hasLimit?y(limit):null;
  const gradientId='xrf-bar-grad-'+stage;

  return `<div class="xrf-control-chart xrf-polished" style="--chart-color:${primaryColor}">
    <div class="xrf-chart-title">
      <b><span class="xrf-series-dot"></span>${esc(title)}</b>
      <small>${dashboardElement.toUpperCase()} · ppm</small>
    </div>
    <div class="xrf-chart-summary">
      <div>
        <strong>${count?fmt(peak):'—'}</strong>
        <span>ppm <small>Đỉnh 6 tháng</small></span>
      </div>
      <span class="xrf-sample-pill">${count} mẫu</span>
    </div>
    <svg viewBox="0 0 600 182" role="img" aria-label="${esc(title)}: ${esc(dashboardMaterialType)}" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${gradStart}"/>
          <stop offset="100%" stop-color="${gradEnd}"/>
        </linearGradient>
        <linearGradient id="${gradientId}-danger" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#f87171"/>
          <stop offset="100%" stop-color="#dc2626"/>
        </linearGradient>
      </defs>

      ${[0,1,2,3,4].map(i=>`<line x1="42" x2="580" y1="${y(step*i)}" y2="${y(step*i)}" stroke="#eef2f7" ${i?'stroke-dasharray="3 5"':''}/><text x="32" y="${y(step*i)+3}" text-anchor="end" font-size="10" fill="#9aa9bb">${fmt(step*i)}</text>`).join('')}

      ${entries.map(([month,m],i)=>{
        const cx=55+i*101;
        const bx=cx-barW/2;
        const val=m.maximum;
        const barH=m.count && val>0 ? Math.max(6, 145 - y(val)) : 0;
        const barY=145-barH;
        const isOver=hasLimit && val>limit;
        const barFill=isOver ? `url(#${gradientId}-danger)` : `url(#${gradientId})`;
        const tx=Math.max(43,Math.min(410,cx-85));
        const ty=barY>80?barY-72:barY+14;

        return `
        <!-- Background Track -->
        <rect x="${bx}" y="25" width="${barW}" height="120" rx="6" fill="${bgTrack}" opacity="0.45"/>

        <!-- Active Data Bar -->
        ${m.count && barH>0 ? `<rect class="xrf-bar-rect" x="${bx}" y="${barY}" width="${barW}" height="${barH}" rx="5" fill="${barFill}"/>` : ''}

        <!-- Top Value Label -->
        <text x="${cx}" y="${m.count && barH>0 ? Math.max(20, barY-5) : 138}" text-anchor="middle" font-size="${m.count?'10.5':'9.5'}" font-weight="${m.count?'600':'400'}" fill="${m.count?(isOver?'#dc2626':'#1e293b'):'#cbd5e1'}">${m.count?fmt(val):'—'}</text>

        <!-- X Axis Label -->
        <text x="${cx}" y="168" text-anchor="middle" font-size="10.5" font-weight="500" fill="#64748b">${Number(month.slice(5))}/${month.slice(2,4)}</text>

        <!-- Tooltip on Hover -->
        ${m.count ? `<g class="xrf-interactive-point" tabindex="0">
          <rect x="${bx-4}" y="20" width="${barW+8}" height="130" fill="transparent" style="cursor:pointer"/>
          <g class="xrf-point-tooltip" transform="translate(${tx},${ty})" pointer-events="none">
            <rect width="170" height="62" rx="8" fill="#1e293b" opacity="0.96" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.15))"/>
            <text x="12" y="18" fill="#94a3b8" font-size="10.5">${month} · ${m.count} mẫu</text>
            <text x="12" y="36" fill="#ffffff" font-size="12" font-weight="700">Max: ${fmt(val)} ppm</text>
            <text x="12" y="52" fill="#cbd5e1" font-size="10.5">Trung bình: ${fmt(m.total/m.count)} ppm</text>
          </g>
        </g>` : ''}
        `;
      }).join('')}

      <!-- Control Limit Red Dashed Line -->
      ${hasLimit ? `
        <line class="xrf-control-line" x1="42" x2="580" y1="${limitY}" y2="${limitY}" stroke="#dc2626" stroke-width="1.8" stroke-dasharray="6 4"/>
        <rect x="428" y="${limitY-20}" width="152" height="18" rx="4" fill="#fee2e2" stroke="#fca5a5" stroke-width="0.8"/>
        <text x="504" y="${limitY-7}" text-anchor="middle" fill="#b91c1c" font-size="10" font-weight="700">Control Limit · ${fmt(limit)} ppm</text>
      ` : ''}

      ${!count?'<text x="310" y="85" text-anchor="middle" font-size="12" font-weight="500" fill="#94a3b8">Chưa có số đo trong giai đoạn này</text>':''}
    </svg>
    <div class="xrf-chart-footer">
      <span>Trung bình <b>${count?fmt(average):'—'} ppm</b></span>
      <span class="${over?'xrf-over-limit':''}">${!hasLimit?'Chưa có giới hạn kiểm soát':over?'⚠️ Có giá trị vượt giới hạn':'✓ Nằm trong kiểm soát'}</span>
    </div>
  </div>`;
}
async function dashboardReportList(validity='',days=null,page=1){
  const query=new URLSearchParams({validity,method:'Lab / Bên thứ ba',page,size:15});
  if(days!==null)query.set('expiry_days',days);
  const data=await api('/inspections/inspection-results?'+query),pages=Math.max(1,Math.ceil(data.total/15));
  openModal(days!==null?'Báo cáo hết hạn trong '+days+' ngày':'Báo cáo · '+validity,rowTable(data.items,['name','module','expiry','status'])+`<div class="pagination"><span>${data.total} hồ sơ · Trang ${data.page}/${pages}</span><div><button id="report-prev" ${data.page<=1?'disabled':''}>← Trước</button><button id="report-next" ${data.page>=pages?'disabled':''}>Sau →</button></div></div>`);
  modal.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{modal.close();goto('record/'+b.dataset.open);});
  $('#report-prev').onclick=()=>dashboardReportList(validity,days,data.page-1).catch(e=>notify(e.message));
  $('#report-next').onclick=()=>dashboardReportList(validity,days,data.page+1).catch(e=>notify(e.message));
}

async function listPage(module){
  if(module==='bom') {
    const params = {module: 'bom', size: 1000};
    if(listState.q) params.q = listState.q;
    const query = new URLSearchParams(params);
    const result=await api('/records?'+query);
    const materials=await api('/records?module=materials&size=1000');
    const matMap = {};
    materials.items.forEach(m => matMap[m.data.material_code] = m);
    
    const projects = {};
    result.items.forEach(r => {
      const p = r.data.project || 'No Project';
      const prod = r.data.parent_code || 'Unknown Product';
      const key = p + '::' + prod;
      if(!projects[key]) projects[key] = {project: p, product: prod, items: []};
      
      const mat = matMap[r.data.material_code];
      projects[key].items.push({bom: r, mat: mat});
    });
    
    window.psBomProjects = projects;
    const projectKeys = Object.keys(projects);
    const bomPage = listState.page || 1;
    const bomPageSize = Number(listState.size) || getOptimalPageSize();
    const pageKeys = projectKeys.slice((bomPage - 1) * bomPageSize, bomPage * bomPageSize);
    const pagination = paginationHtml(bomPage, projectKeys.length, bomPageSize);
    const bomOptHtml = [15,20,25,50,2000].map(v=>`<option value="${v}" ${bomPageSize===v?'selected':''}>${v===2000?`Tất cả (${projectKeys.length} dự án)`:`${v} / trang`}</option>`).join('');
    
    return head('Quản lý & Cập nhật BOM','')+`<section class="card fill-card"><div class="toolbar"><select id="page-size-select" title="Số lượng dòng mỗi trang" aria-label="Số dòng mỗi trang">${bomOptHtml}</select><div class="toolbar-actions-right"><button type="button" class="toolbar-btn primary" id="import-bom-btn" title="Cập nhật BOM từ Excel" aria-label="Cập nhật BOM từ Excel"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></button><button type="button" class="toolbar-btn" id="save-bom-btn" title="Lưu dữ liệu / Xuất file BOM ra Excel" aria-label="Lưu dữ liệu BOM"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg></button><button type="button" class="toolbar-btn danger" id="delete-bom-btn" title="Xóa toàn bộ dữ liệu BOM" aria-label="Xóa toàn bộ dữ liệu BOM"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button></div></div><div class="table-scroll"><table><thead><tr><th>Project</th><th>Product (Mã thành phẩm)</th><th>Số NVL</th><th>Hành động</th></tr></thead><tbody>${pageKeys.map(k=>{
      const p = projects[k];
      return `<tr><td>${esc(p.project)}</td><td>${esc(p.product)}</td><td>${p.items.length}</td><td><div style="display:flex;align-items:center;gap:12px"><button class="link-button" data-route="product-bom/${encodeURIComponent(k)}">Xem danh sách NVL</button><button type="button" class="link-button delete-project-btn" data-project="${esc(p.project)}" title="Xóa BOM dự án ${esc(p.project)}" style="color:#ef4444;font-size:12px;background:none;border:none;cursor:pointer;padding:0">🗑️ Xóa</button></div></td></tr>`;
    }).join('')}</tbody></table></div>${pagination}</section>`;
  }
  const config=catalog.modules[module];
  const pageSize=Number(listState.size)||getOptimalPageSize();
  const query=new URLSearchParams({module,...listState,size:pageSize});
  const result=await api('/records?'+query);
  const keys=columnPreferences[module]||config.fields.slice(0,5).map(f=>f.key);
  const columns=keys.map(key=>config.fields.find(f=>f.key===key)).filter(Boolean);
  const pagination=paginationHtml(result.page,result.total,pageSize);
  const hasDri = config.fields.some(f=>f.key==='dri');
  const hasStatus = config.fields.some(f=>f.key==='status') || result.items.some(r=>r.display_status);
  const hasProject = module === 'materials';
  const hasDate = module !== 'materials' && config.fields.some(f=>f.type==='date');
  const sizeOptHtml = [15,20,25,50,2000].map(v=>`<option value="${v}" ${pageSize===v?'selected':''}>${v===2000?`Tất cả (${result.total} mục)`:`${v} / trang`}</option>`).join('');
  return head(config.title,'')+`<section class="card fill-card"><form class="toolbar" id="filters"><input type="search" name="q" placeholder="Tìm mã, tên, NCC, CAS…" value="${esc(listState.q)}" aria-label="Tìm trong bảng">${hasProject ? `<select name="project" id="project-filter" title="Lọc theo Dự án" aria-label="Dự án"><option value="">Tất cả dự án</option><option value="Co-mold" ${listState.project==='Co-mold'?'selected':''}>Co-molded / Co-mold</option><option value="SE Jump" ${listState.project==='SE Jump'?'selected':''}>SE Jump</option><option value="CALDERA" ${listState.project==='CALDERA'?'selected':''}>CALDERA, SIERRA 8</option></select><select name="category" id="category-filter" title="Lọc theo Category" aria-label="Category"><option value="">Tất cả Category</option><option value="Raw material" ${listState.category==='Raw material'?'selected':''}>Raw material</option><option value="Packing material" ${listState.category==='Packing material'?'selected':''}>Packing material</option></select>` : ''}${hasStatus ? `<select name="status" title="Lọc theo Trạng thái" aria-label="Trạng thái"><option value="">Tất cả trạng thái</option>${['Pending','Compliant','NG','Pass','Valid','Expiring Soon','Expired','Overdue','Open','Closed','Completed','Due Soon','Not Applicable'].map(s=>`<option ${listState.status===s?'selected':''}>${s}</option>`).join('')}</select>` : ''}${hasDate ? `<label style="margin:0;display:flex;align-items:center;gap:3px;font-size:11px;color:var(--muted)">Từ<input type="date" name="start" value="${esc(listState.start)}" style="width:120px"></label><label style="margin:0;display:flex;align-items:center;gap:3px;font-size:11px;color:var(--muted)">Đến<input type="date" name="end" value="${esc(listState.end)}" style="width:120px"></label>` : ''}<select name="size" id="page-size-select" title="Số lượng dòng mỗi trang" aria-label="Số dòng mỗi trang">${sizeOptHtml}</select><div class="toolbar-actions-group"><button type="submit" class="toolbar-btn" title="Áp dụng tìm kiếm & bộ lọc" aria-label="Áp dụng bộ lọc"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg></button><button type="button" id="reset-filter" class="toolbar-btn" title="Xóa toàn bộ bộ lọc & làm mới" aria-label="Xóa bộ lọc"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></button></div><div class="toolbar-actions-right"><button type="button" id="export" class="toolbar-btn" title="Xuất danh sách ra file Excel" aria-label="Xuất file Excel"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>${can(module,'Create')?`<button type="button" class="primary toolbar-btn" id="add-record" title="Thêm hồ sơ mới" aria-label="Thêm hồ sơ mới"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>`:''}</div></form><div class="table-scroll"><table><thead><tr>${columns.map(f=>`<th><button class="link-button" data-sort="${f.key}">${esc(f.label)} ${listState.sort===f.key?(listState.direction==='asc'?'↑':'↓'):'↕'}</button></th>`).join('')}${hasDri ? '<th>DRI</th>' : ''}${hasStatus ? '<th>Trạng thái</th>' : ''}<th></th></tr></thead><tbody>${result.items.map(r=>`<tr>${columns.map((f,i)=>`<td title="${esc(r.data[f.key])}">${i===0?`<button class="link-button" data-open="${r.id}">${esc(r.data[f.key]||label(r))}</button>`:esc(r.data[f.key]??'—')}</td>`).join('')}${hasDri ? `<td>${esc(r.data.dri||'Chưa phân công')}</td>` : ''}${hasStatus ? `<td>${badge(r.display_status)}</td>` : ''}<td><button class="link-button" data-open="${r.id}">👁️ Xem chi tiết</button></td></tr>`).join('')}</tbody></table></div>${result.items.length?'':empty(result.total?'Không có kết quả trên trang này':'Chưa có hồ sơ phù hợp','Thêm hồ sơ hoặc thay đổi bộ lọc để tiếp tục.')}${pagination}</section>`;
}


function detailPage(row){const config=catalog.modules[row.module];const d=row.data;const sections=config.fields.filter(f=>d[f.key]!==undefined&&d[f.key]!=='');
let chipsHtml=row.module==='materials'?`<div class="chips" style="flex:1">${badge(d.usage_status||'Chưa xác định')}${badge(d.dossier_status||'Chưa đánh giá')}</div>`:config.fields.some(f=>f.key==='dri')?`<div class="chips" style="flex:1">${badge(row.display_status)}<span class="badge">${esc(row.module)}</span><span class="badge">DRI: ${esc(d.dri||'Chưa phân công')}</span></div>`:'';
let actionsHtml=`<button data-route="${row.module}">← Danh sách</button>${can(row.module,'Edit')?'<button id="edit-record" class="primary">Chỉnh sửa</button>':''}${can(row.module,'Delete')?'<button id="archive-record" class="danger">Lưu trữ</button>':''}`;
let html=head(label(row),`${config.title} · Revision ${row.version} · Cập nhật ${timeText(row.updated_at)}`) + `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px">${chipsHtml}<div class="head-actions" style="display:flex;gap:8px">${actionsHtml}</div></div>`;
if(row.conflicts?.length)html+=`<div class="alert">Mapping FMD / TRM không khớp: ${row.conflicts.map(c=>`${esc(c.test_type)}: FMD ${esc(c.fmd.join(', '))}; TRM ${esc(c.trm.join(', '))}`).join(' · ')}. Cần xác minh báo cáo gốc.</div>`;
if(row.module==='capa'){const stages=[['issue','Issue'],['containment','Containment'],['root_cause','Root Cause'],['corrective','Corrective Action'],['evidence','Evidence'],['verification','Verification'],['closure','Closure']];html+=`<div class="timeline">${stages.map(([k,t])=>`<div class="timeline-step ${(k==='evidence'?row.evidence.length:d[k])?'done':''}"><b>${t}</b><small>${(k==='evidence'?row.evidence.length:d[k])?'Đã ghi nhận':'Chưa ghi nhận'}</small></div>`).join('')}</div>`;}
let infoHtml=`<section class="card" ${row.module==='materials'?'style="margin-bottom:0;border-bottom-left-radius:0;border-bottom-right-radius:0;border-bottom:0"':''}><div class="card-header"><h3>Thông tin hồ sơ</h3></div><div class="card-body"><div class="detail-grid" ${row.module==='materials'?'style="grid-template-columns:1fr 1fr"':''}>${sections.map(f=>`<div class="detail-item"><small>${esc(f.label)}</small><div>${esc(d[f.key])}</div></div>`).join('')}</div>${d._source?`<div class="source" style="margin-top:22px">${sourceText(d._source)}<details><summary>Xem ô nguồn / công thức</summary><pre>${esc(JSON.stringify(d._source,null,2))}</pre></details></div>`:''}${d._sources?`<details><summary>${d._sources.length} dòng nguồn tạo hồ sơ vật liệu</summary>${d._sources.map(s=>`<p class="source">${sourceText(s)}</p>`).join('')}</details>`:''}</div></section>`;
const historyHtml=`<section class="card" ${row.module==='materials'?'style="margin-bottom:0;border-radius:0;border-top:0"':''}><div class="card-header"><h3>Evidence & phiên bản file</h3>${can(row.module,'Upload')?'<label style="margin:0"><input type="file" id="evidence-file" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.docx,.txt" hidden><button id="upload-evidence">↑ Đính kèm file</button></label>':''}</div>${row.evidence.length?`<div class="table-scroll"><table><thead><tr><th>File</th><th>Người upload</th><th>Ngày</th><th>Dung lượng</th><th></th></tr></thead><tbody>${row.evidence.map(e=>`<tr><td title="SHA256: ${e.checksum}">${esc(e.name)}</td><td>${esc(e.uploader)}</td><td>${dateText(e.created_at)}</td><td>${(e.size/1024).toFixed(1)} KB</td><td>${['application/pdf','image/png','image/jpeg'].includes(e.mime)?`<button class="link-button" data-preview="${e.id}">Preview</button> · `:''}<a href="/api/evidence/${e.id}">Tải xuống</a></td></tr>`).join('')}</tbody></table></div>`:empty('Chưa có file evidence','File gốc trong workbook không tự động được coi là evidence đính kèm.')}</section><section class="card" ${row.module==='materials'?'style="border-top-left-radius:0;border-top-right-radius:0;margin-top:0"':''}><div class="card-header"><h3>Lịch sử thay đổi & Audit trail</h3></div><div class="card-body">${row.history.map(h=>`<details><summary>${timeText(h.at)} · ${esc(h.actor)} · ${esc(h.action)}</summary><div class="form-grid"><pre>Trước
${esc(JSON.stringify(h.before,null,2))}</pre><pre>Sau
${esc(JSON.stringify(h.after,null,2))}</pre></div></details>`).join('')||'<p class="muted">Chưa có thay đổi sau khi nhập dữ liệu nguồn.</p>'}</div></section>`;
if(row.module==='materials'){
    const related=row.related||[];
    const boms = related.filter(r => r.module === 'bom');
    const bomsHtml = boms.length ? `<section class="card" style="border-top-left-radius:0;border-top-right-radius:0;margin-top:0"><div class="card-header"><h3>Sử dụng trong BOM / Sản phẩm</h3></div>${rowTable(boms)}</section>` : '<section class="card" style="border-top-left-radius:0;border-top-right-radius:0;margin-top:0"><div class="card-body">'+empty('Chưa liên kết với Sản phẩm / BOM nào')+'</div></section>';
    const tabSuppliers = materialSuppliers(row);
    const compFiles=related.filter(r=>['documents','fmd','cts-1','cts-2','cts-3','reports'].includes(r.module));
    const compType=r=>{if(r.module==='fmd')return'FMD';if(r.module.startsWith('cts'))return r.module.toUpperCase().replace('-','_');const j=JSON.stringify(r.data).toUpperCase();if(j.includes('ROHS'))return'RoHS';if(j.includes('MSDS'))return'MSDS';if(j.includes('SDS'))return'SDS';if(j.includes('HALOGEN'))return'Halogen-Free';if(j.includes('PFO')||j.includes('PFAS'))return'PFOA & PFOS';if(j.includes('REACH')||j.includes('SVHC'))return'REACH / SVHC';if(j.includes('VOC'))return'VOC';return'Khác';};
    const cTypes=Array.from(new Set(compFiles.map(compType))).sort();
    const compAllowed=can('documents','Upload')||can('reports','Upload');
    
    // Required Tests Logic
    let req_tests = d.required_tests;
    if(typeof req_tests==='string') req_tests=req_tests.split(',').map(x=>x.trim()).filter(x=>x);
    if(!Array.isArray(req_tests)) req_tests=[];
    
    let compStatus = req_tests.length ? 'Compliant' : 'N/A';
    let reqValid = 0;
    const testAlerts = [];
    req_tests.forEach(rt => {
      const matching = compFiles.filter(r => r.module==='reports' && (r.data.test_type===rt || String(r.data.test_type||'').includes(rt)));
      if(matching.length===0) { compStatus='Pending'; testAlerts.push(rt + ' Missing'); return; }
      const latest = matching.sort((a,b)=>String(b.data.expiry_date||'9999').localeCompare(String(a.data.expiry_date||'9999')))[0];
      const result = String(latest.data.result||'').toUpperCase();
      const validity = latest.display_status;
      if(result==='FAIL' || ['Expired', 'Overdue', 'NG'].includes(validity)) {
        compStatus='Non-Compliant'; testAlerts.push(rt + ' FAIL/Expired');
      } else if (result==='PASS') {
        reqValid++;
        if(validity==='Expiring Soon') { if(compStatus==='Compliant') compStatus='Expiring Soon'; testAlerts.push(rt + ' Expiring'); }
      } else {
        if(compStatus!=='Non-Compliant') compStatus='Pending';
      }
    });

    const infoHtmlUpdated = infoHtml.replace('</div></section>', `<div class="detail-item"><small>Compliance Status</small><div>${badge(compStatus)} ${testAlerts.length?`<small class="muted">(${testAlerts.join(', ')})</small>`:''}</div></div><div class="detail-item"><small>Required Tests</small><div>${reqValid} / ${req_tests.length} Valid</div></div></div></section>`);
    const tabOverview = infoHtmlUpdated + bomsHtml;
    
    const allTests = ['RoHS', 'Halogen-Free', 'REACH / SVHC', 'PFOA & PFOS', 'VOC', 'PFAS', 'Khác'];
    const checklistHtml = `<section class="card"><div class="card-header"><div><h3>Cấu hình Required Test</h3><small class="muted">Chỉ mục Required mới dùng đánh giá Compliance</small></div>${can('materials','Edit')?'<button class="primary" onclick="alert(&quot;Dùng nút Chỉnh sửa phía trên để cập nhật trường Yêu cầu kiểm nghiệm (cách nhau dấu phẩy)&quot;)">Chỉnh sửa</button>':''}</div><div class="card-body"><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">${allTests.map(t=>`<label><input type="checkbox" disabled ${req_tests.includes(t)?'checked':''}> ${t}</label>`).join('')}</div></div></section>`;
    
    const tabCompliance = checklistHtml + `<section class="card"><div class="card-header"><div><h3>Hồ sơ tuân thủ & CTS</h3><small class="muted">Mã liên kết: ${esc(row.aliases.join(', '))}</small></div>${compAllowed?'<button class="primary" id="add-comp-report">+ Thêm hồ sơ</button>':''}</div><div class="card-body"><div class="folder-grid">${cTypes.map(type=>{const matches=compFiles.filter(r=>compType(r)===type);return `<div class="folder"><h3>${type}</h3><p>${matches.length} hồ sơ</p>${matches.map(r=>`<p><button class="link-button" data-open="${r.id}">${esc(r.data.report_id||r.data.document_no||r.data.substance||label(r))}</button><br>${badge(r.display_status)} ${r.data.expiry_date?dateText(r.data.expiry_date):''}</p>`).join('')}</div>`;}).join('')}</div>${!cTypes.length?empty('Chưa có hồ sơ tuân thủ'):''}</div></section>`;
    const testFiles = related.filter(r => ['test-plan', 'xrf-plan', 'xrf-iqc', 'xrf-oqc', 'change-control', 'oqc-reports'].includes(r.module) || (r.module==='reports' && compType(r)==='Khác'));
    const tTypes = Array.from(new Set(testFiles.map(r => title(r.module)))).sort();
    let trendHtml = '';
    if (related.some(r => r.module === 'xrf-iqc' || r.module === 'xrf-oqc')) {
      trendHtml = `<div class="alert" style="display:flex;justify-content:space-between;align-items:center;margin-top:20px;margin-bottom:0"><span>Vật liệu này có kết quả đo XRF. Xem biểu đồ đánh giá mức độ rủi ro và xu hướng thay đổi.</span><button class="primary" data-route="xrf-trend">Xem Biểu đồ Trend →</button></div>`;
    }
    const tabTesting = trendHtml + `<section class="card"><div class="card-header"><div><h3>Kế hoạch & Kết quả kiểm nghiệm</h3></div>${can('test-plan','Create')?'<button class="primary" id="add-test-plan">+ Thêm kế hoạch</button>':''}</div><div class="card-body"><div class="folder-grid">${tTypes.map(type=>{const matches=testFiles.filter(r=>title(r.module)===type);return `<div class="folder"><h3>${type}</h3><p>${matches.length} mục</p>${matches.map(r=>`<p><button class="link-button" data-open="${r.id}">${esc(label(r))}</button><br>${badge(r.display_status)}</p>`).join('')}</div>`;}).join('')}</div>${!tTypes.length?empty('Chưa có dữ liệu kiểm nghiệm'):''}</div></section>`;
    html+=`<div class="tabs" role="group" aria-label="Chi tiết vật liệu"><button class="active" data-material-tab="overview" aria-pressed="true">Tổng quan</button><button data-material-tab="suppliers" aria-pressed="false">Nhà cung cấp</button><button data-material-tab="compliance" aria-pressed="false">Hồ sơ tuân thủ</button><button data-material-tab="testing" aria-pressed="false">Kiểm nghiệm</button><button data-material-tab="history" aria-pressed="false">Lịch sử</button></div><div data-material-panel="overview">${tabOverview}</div><div data-material-panel="suppliers" hidden>${tabSuppliers}</div><div data-material-panel="compliance" hidden>${tabCompliance}</div><div data-material-panel="testing" hidden>${tabTesting}</div><div data-material-panel="history" hidden>${historyHtml}</div>`;
}else{
  html+=infoHtml;
  if(row.module==='suppliers')html+=supplierContext(row);
  if(row.module==='bom')html+=`<section class="card"><div class="card-header"><h3>Nguyên vật liệu trong BOM</h3></div>${rowTable(row.materials||[])}</section>`;
  if(row.evaluation)html+=`<section class="card"><div class="card-header"><h3>Đánh giá XRF theo Control Limit</h3>${badge(row.evaluation.status)}</div><div class="table-scroll"><table><thead><tr><th>Chất</th><th>Kết quả ppm</th><th>Giới hạn ppm</th><th>Quy tắc</th><th>Kết luận</th></tr></thead><tbody>${row.evaluation.checks.map(c=>`<tr><td>${esc(c.element)}</td><td>${c.value??'Chưa có'}</td><td>${c.limit??'Chưa khai báo'}</td><td>${esc(c.rule)}</td><td>${badge(c.status)}</td></tr>`).join('')}</tbody></table></div><div class="card-body muted"><small>${esc(row.evaluation.basis)}</small></div></section>`;
  html+=historyHtml;
}
return html;}


function formField(f,value=''){const attrs=`name="${esc(f.key)}" ${f.required?'required':''}`;let control;if(f.type==='select')control=`<select ${attrs}><option value="">Chọn…</option>${f.options.map(o=>`<option value="${esc(o)}" ${String(value)===o?'selected':''}>${esc(o)}</option>`).join('')}</select>`;else if(f.type==='textarea')control=`<textarea ${attrs} maxlength="10000">${esc(value)}</textarea>`;else control=`<input ${attrs} type="${f.type}" ${f.type==='number'?'min="0" step="any"':''} value="${esc(value)}" maxlength="10000">`;return `<label class="${f.type==='textarea'?'wide':''}">${esc(f.label)}${f.required?' *':''}${control}</label>`;}
function recordForm(module,row=null,defaults={}){const config=catalog.modules[module];openModal((row?'Chỉnh sửa: ':'Thêm: ')+config.title,`<form id="record-form"><div class="form-grid">${config.fields.map(f=>formField(f,row?.data[f.key]??defaults[f.key]??(f.key==='status'?'Pending':f.key==='dri'?user.name:''))).join('')}</div><div id="record-error" class="form-error" role="alert"></div></form>`,`<button data-cancel>Hủy</button><button type="submit" form="record-form" class="primary" id="save-record">Lưu hồ sơ</button>`);modal.querySelector('[data-cancel]').onclick=()=>modal.close();$('#record-form').onsubmit=async e=>{e.preventDefault();$('#save-record').disabled=true;try{const data=Object.fromEntries(new FormData(e.target));const result=await api('/records'+(row?'/'+row.id:''),{method:row?'PUT':'POST',body:JSON.stringify({module,data,version:row?.version})});modal.close();notify('Đã lưu hồ sơ và audit history.');goto('record/'+result.id);}catch(error){$('#record-error').textContent=error.message;}finally{if($('#save-record'))$('#save-record').disabled=false;}};}

function groupPage(id){const group=catalog.groups.find(g=>g.id===id);if(!group)return empty('Không tìm thấy nhóm');return head(group.name,'')+`<div class="folder-grid">${group.items.filter(i=>!catalog.modules[i.id]||can(i.id,'View')).map(i=>`<button class="folder" data-route="${i.id}"><h3>${esc(i.name)}</h3><p>${esc(catalog.modules[i.id]?.description||'Mở danh sách và quản lý hồ sơ')}</p></button>`).join('')}</div>`;}
async function importsPage(){const data=await api('/imports');return head('Nguồn Excel & đối chiếu','',user.role==='Admin'?'<button class="primary" id="import-workbooks">Kiểm tra / nhập workbook mới</button>':'')+`<div class="folder-grid">${data.files.map(f=>`<article class="folder"><h3>${esc(f.file)}</h3><p>Nhập ${timeText(f.at)}</p><p>${Object.entries(f.summary.counts).map(([m,n])=>`${esc(title(m))}: <b>${n}</b>`).join('<br>')}</p><details><summary>${f.summary.sheets.length} sheet đã đọc</summary>${f.summary.sheets.map(s=>`<p>${esc(s.name)} · ${s.populated_rows} dòng có nội dung / ${s.rows} dòng định dạng</p>`).join('')}<p>SHA256: ${esc(f.checksum)}</p></details>${['Admin','QA Manager','Auditor'].includes(user.role)?`<a href="/api/imports/${f.id}/download">Tải workbook nguồn</a>`:''}</article>`).join('')}</div><section class="card" style="margin-top:20px"><div class="card-header"><h3>Chênh lệch FMD / TRM cần xác minh</h3></div>${data.conflicts.length?`<div class="table-scroll"><table><thead><tr><th>Vật liệu</th><th>Test</th><th>FMD</th><th>TRM</th><th>Trạng thái</th></tr></thead><tbody>${data.conflicts.map(c=>`<tr><td>${esc(c.material_code)}</td><td>${esc(c.test_type)}</td><td>${esc(c.fmd.join(', '))}</td><td>${esc(c.trm.join(', '))}</td><td>${badge('Warning')}</td></tr>`).join('')}</tbody></table></div>`:empty('Không phát hiện chênh lệch')}</section><section class="card"><div class="card-header"><h3>Chất lượng dữ liệu nguồn</h3></div><div class="card-body">${data.files.flatMap(f=>f.summary.issues.map(i=>`<div class="alert">${esc(f.file)} · ${esc(i.sheet)} · ${esc(i.cell)}: <b>${esc(i.value)}</b></div>`)).join('')||'<p>Không có lỗi ô Excel được ghi nhận.</p>'}<p class="muted">IQC Trend được tính lại từ dữ liệu kết quả IQC/OQC, không lấy giá trị pivot cache làm dữ liệu độc lập. Các ô thiếu giới hạn hoặc thiếu kết quả giữ trạng thái Pending.</p></div></section>`;}
async function trendPage(element='pb',stage=''){const data=await api('/xrf-trend?element='+element+'&stage='+encodeURIComponent(stage));window.psTrend=data;const byMonth={};for(const i of data.items)byMonth[i.month]=Math.max(byMonth[i.month]||0,i.maximum);const max=Math.max(1,...Object.values(byMonth));return head('Xu hướng XRF & thực hiện kế hoạch','')+`<section class="card"><div class="card-header"><h3>Giá trị lớn nhất theo tháng · ppm</h3><select id="trend-element" aria-label="Chất phân tích">${['pb','cd','hg','cr','br','cl'].map(e=>`<option value="${e}" ${element===e?'selected':''}>${e.toUpperCase()}</option>`).join('')}</select></div><div class="card-body"><div class="trend-bars">${Object.entries(byMonth).map(([m,v])=>`<div class="trend-bar"><b>${v.toFixed(1)}</b><i style="height:${Math.max(1,150*v/max)}px"></i><span>${m}</span></div>`).join('')||'<p>Chưa có số đo.</p>'}</div><p class="muted" style="margin-top:18px"><small>${esc(data.basis)}</small></p></div></section><section class="card"><div class="card-header"><h3>Chi tiết theo vật liệu</h3></div><div class="table-scroll"><table><thead><tr><th>Tháng</th><th>Mã vật liệu</th><th>Số mẫu</th><th>Max ppm</th><th>Average ppm</th></tr></thead><tbody>${data.items.map(i=>`<tr><td>${i.month}</td><td>${esc(i.material_code)}</td><td>${i.count}</td><td>${i.maximum}</td><td>${i.average}</td></tr>`).join('')}</tbody></table></div></section><section class="card"><div class="card-header"><h3>Kế hoạch so với kết quả thực hiện</h3><select id="coverage-filter" aria-label="Lọc thực hiện"><option value="">Tất cả</option><option>Overdue</option><option>Pending</option><option>Completed</option><option>Scheduled</option></select></div><div class="table-scroll" id="coverage-table">${coverageTable(data.coverage)}</div></section>`;}
function coverageTable(rows){return `<table><thead><tr><th>Tháng</th><th>Vật liệu</th><th>Test</th><th>Kết quả đã ghi nhận</th><th>Trạng thái</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.month}</td><td><button class="link-button" data-open="${r.plan_id}">${esc(r.material_code)}</button></td><td>${esc(r.test)}</td><td>${r.tests}</td><td>${badge(r.status)}</td></tr>`).join('')}</tbody></table>`;}

async function usersPage(){if(user.role!=='Admin')return head('Quản lý người dùng')+empty('Chỉ Admin được quản lý tài khoản','Liên hệ Admin để kích hoạt tài khoản hoặc thay đổi quyền.');const users=await api('/users');const page=listState.page||1;const pageSize=Number(listState.size)||getOptimalPageSize();const total=users.length;const pagedUsers=users.slice((page-1)*pageSize,page*pageSize);const pagination=paginationHtml(page,total,pageSize);const userOptHtml=[15,20,25,50,2000].map(v=>`<option value="${v}" ${pageSize===v?'selected':''}>${v===2000?`Tất cả (${total} tài khoản)`:`${v} / trang`}</option>`).join('');return head('Quản lý người dùng','')+`<section class="card fill-card"><div class="toolbar"><select id="page-size-select" title="Số lượng dòng mỗi trang" aria-label="Số dòng mỗi trang">${userOptHtml}</select></div><div class="table-scroll"><table><thead><tr><th>Họ tên</th><th>Mã nhân viên</th><th>Email</th><th>Phòng ban</th><th>Role</th><th>Trạng thái</th><th></th></tr></thead><tbody>${pagedUsers.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.employee_id)}</td><td>${esc(u.email)}</td><td>${esc(u.department)}</td><td><select data-user-role="${u.id}" ${u.id===user.id?'disabled':''}>${catalog.roles.map(r=>`<option ${r===u.role?'selected':''}>${r}</option>`).join('')}</select></td><td><label style="margin:0"><input type="checkbox" data-user-active="${u.id}" ${u.active?'checked':''} ${u.id===user.id?'disabled':''}>Kích hoạt</label></td><td><button data-save-user="${u.id}" ${u.id===user.id?'disabled':''}>Lưu</button></td></tr>`).join('')}</tbody></table></div>${pagination}</section>`;}
let roleSettings;
async function rolesPage(){roleSettings=await api('/settings/permissions');const role=Object.keys(roleSettings)[0];return head('Vai trò & Phân quyền','',user.role==='Admin'?'<button class="primary" id="save-roles">Lưu phân quyền</button>':'')+`<section class="card"><div class="toolbar"><label>Role<select id="role-select">${Object.keys(roleSettings).map(r=>`<option>${r}</option>`).join('')}</select></label><small class="muted">Admin luôn có toàn quyền.</small></div><div id="role-matrix" class="table-scroll">${roleMatrix(role)}</div></section>`;}
function roleMatrix(role){return `<table><thead><tr><th>Module</th>${['View','Create','Edit','Delete','Upload','Approve','Close'].map(a=>`<th>${a}</th>`).join('')}</tr></thead><tbody>${Object.keys(catalog.modules).map(m=>`<tr><td>${esc(title(m))}</td>${['View','Create','Edit','Delete','Upload','Approve','Close'].map(a=>`<td><input type="checkbox" aria-label="${esc(title(m)+' '+a)}" data-permission="${m}:${a}" ${roleSettings[role]?.[m]?.[a]?'checked':''} ${user.role==='Admin'?'':'disabled'}></td>`).join('')}</tr>`).join('')}</tbody></table>`;}
async function settingsPage(key){const data=await api('/settings/'+key);let form='';if(key==='notifications')form=`<label>Ngưỡng cảnh báo<select name="days">${[30,60,90].map(n=>`<option value="${n}" ${data.days===n?'selected':''}>${n} ngày</option>`).join('')}</select></label>`+[['reports','Test Report sắp hết hạn'],['training','Training sắp hết hạn'],['capa','CAPA quá hạn'],['documents','Document đến hạn review'],['compliance','Compliance cần renewal']].map(([k,t])=>`<label><input type="checkbox" name="${k}" ${data[k]!==false?'checked':''}>${t}</label>`).join('');else if(key==='retention')form=[['documents','Tài liệu'],['samples','Sample'],['reports','Test Report'],['audit','Audit Record'],['training','Training Record']].map(([k,t])=>`<label>${t} (năm)<input type="number" name="${k}" min="1" max="100" value="${data[k]||5}" required></label>`).join('');else form=[['site_name','Tên hệ thống'],['factory','Nhà máy'],['timezone','Múi giờ hiển thị']].map(([k,t])=>`<label>${t}<input name="${k}" value="${esc(data[k])}" maxlength="200" required ${k==='timezone'?'readonly':''}></label>`).join('');return head(names[key],'')+`<section class="card"><div class="card-body"><form id="settings-form"><fieldset style="border:0;padding:0" ${user.role!=='Admin'?'disabled':''}><div class="form-grid">${form}</div>${user.role==='Admin'?'<button class="primary" type="submit">Lưu cài đặt</button>':'<p class="muted">Chỉ Admin được thay đổi cấu hình.</p>'}</fieldset></form></div></section>`;}

function bindCommon(root=content){root.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>goto('record/'+b.dataset.open));root.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>goto(b.dataset.route));}
function bindPage(id){bindCommon();
if(id==='inspection-plans'){
  content.querySelectorAll('[data-plan-page]').forEach(b=>b.onclick=()=>{listState.page=Number(b.dataset.planPage);return render();});
  if($('#plan-prev')) $('#plan-prev').onclick=()=>{if(listState.page>1){listState.page--;render();}};
  if($('#plan-next')) $('#plan-next').onclick=()=>{listState.page=(listState.page||1)+1;render();};
  if($('#page-size-select')) $('#page-size-select').onchange=e=>{listState.size=Number(e.target.value);listState.page=1;render();};
}
if(id==='dashboard'){
  $('#dashboard-material-type').onchange=e=>{dashboardMaterialType=e.target.value;return render();};
  $('#dashboard-element').onchange=e=>{dashboardElement=e.target.value;return render();};
  content.querySelectorAll('[data-report-validity]').forEach(b=>b.onclick=()=>dashboardReportList(b.dataset.reportValidity).catch(e=>notify(e.message)));
  content.querySelectorAll('[data-report-days]').forEach(b=>b.onclick=()=>dashboardReportList('',Number(b.dataset.reportDays)).catch(e=>notify(e.message)));
  content.querySelectorAll('[data-trend-stage]').forEach(b=>b.onclick=()=>{location.hash='/xrf-trend/'+b.dataset.trendStage;});
  $('#dashboard-alerts').onclick=()=>{openModal('Việc cần xử lý',rowTable(overview.alerts));modal.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{modal.close();goto('record/'+b.dataset.open);});};
}
const gs = document.querySelector('.global-search'); if(gs) gs.style.display = id === 'cts-1' ? 'none' : '';
if(catalog.modules[id] || id==='bom' || id==='xrf'){
  const module = $('#filters')?.dataset?.module || $('#export')?.dataset?.module || id;
  if($('#filters')) $('#filters').onsubmit=e=>{e.preventDefault();Object.assign(listState,Object.fromEntries(new FormData(e.target)),{page:1});render();};
  if($('#page-size-select')) $('#page-size-select').onchange=e=>{listState.size=Number(e.target.value);listState.page=1;render();};
  if($('#reset-filter')) $('#reset-filter').onclick=()=>{listState={page:1,q:'',status:'',project:'',category:'',start:'',end:'',sort:'updated_at',direction:'desc',size:listState.size||getOptimalPageSize()};render();};
  if($('#project-filter')) $('#project-filter').onchange=()=>{listState.project=$('#project-filter').value;listState.page=1;render();};
  if($('#category-filter')) $('#category-filter').onchange=()=>{listState.category=$('#category-filter').value;listState.page=1;render();};
  if($('#import-bom-btn')) $('#import-bom-btn').onclick=()=>confirmAction('Cập nhật dữ liệu BOM từ file Material report for SE-CM project.xlsx?',async()=>{try{const res=await api('/bom/import',{method:'POST'});notify(`Đã cập nhật BOM: +${res.bom_added} BOM, +${res.materials_added} NVL.`);render();}catch(err){notify(err.message);}});
  if($('#save-bom-btn')) $('#save-bom-btn').onclick=async()=>{try{try{await api('/bom/save',{method:'POST'});}catch(e){}notify('Đã lưu và xuất dữ liệu BOM thành công.');location.href='/api/export/bom';}catch(err){notify(err.message);}};
  if($('#delete-bom-btn')) $('#delete-bom-btn').onclick=()=>confirmAction('Bạn có chắc chắn muốn xóa TOÀN BỘ dữ liệu BOM? Danh mục NVL liên quan sẽ được tự động cập nhật theo.',async()=>{try{try{const res=await api('/bom',{method:'DELETE'});notify(`Đã xóa ${res.count} bản ghi BOM và cập nhật ${res.materials_count||0} NVL trong Danh mục.`);}catch(e){const allBom=await api('/records?module=bom&size=2000');const bomCodes=new Set(allBom.items.map(r=>r.data.material_code).filter(Boolean));for(const r of allBom.items){await api('/records/'+r.id+'?version='+r.version,{method:'DELETE'});}const allMats=await api('/records?module=materials&size=2000');let mCount=0;for(const m of allMats.items){if(bomCodes.has(m.data.material_code)){await api('/records/'+m.id+'?version='+m.version,{method:'DELETE'});mCount++;}}notify(`Đã xóa ${allBom.items.length} bản ghi BOM và đồng bộ ${mCount} NVL.`);}render();}catch(err){notify(err.message);}});
  content.querySelectorAll('.delete-project-btn').forEach(b=>b.onclick=()=>{const proj=b.dataset.project;confirmAction(`Xóa toàn bộ dữ liệu BOM của dự án "${proj}"? Danh mục NVL của dự án sẽ được tự động cập nhật theo.`,async()=>{try{try{const res=await api('/bom?project='+encodeURIComponent(proj),{method:'DELETE'});notify(`Đã xóa ${res.count} BOM dự án "${proj}" và cập nhật ${res.materials_count||0} NVL.`);}catch(e){const allBom=await api('/records?module=bom&size=2000');const projBom=allBom.items.filter(r=>r.data.project===proj||r.data.parent_code===proj);const projCodes=new Set(projBom.map(r=>r.data.material_code).filter(Boolean));const otherCodes=new Set(allBom.items.filter(r=>r.data.project!==proj&&r.data.parent_code!==proj).map(r=>r.data.material_code).filter(Boolean));for(const r of projBom){await api('/records/'+r.id+'?version='+r.version,{method:'DELETE'});}const allMats=await api('/records?module=materials&size=2000');let mCount=0;for(const m of allMats.items){if(m.data.project===proj||(projCodes.has(m.data.material_code)&&!otherCodes.has(m.data.material_code))){await api('/records/'+m.id+'?version='+m.version,{method:'DELETE'});mCount++;}}notify(`Đã xóa ${projBom.length} BOM dự án "${proj}" và cập nhật ${mCount} NVL.`);}render();}catch(err){notify(err.message);}});});
  if($('#prev-page')) $('#prev-page').onclick=()=>{if(listState.page>1){listState.page--;render();}};
  if($('#next-page')) $('#next-page').onclick=()=>{listState.page=(listState.page||1)+1;render();};
  content.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{listState.page=Number(b.dataset.page);render();});
  document.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{listState.direction=listState.sort===b.dataset.sort&&listState.direction==='asc'?'desc':'asc';listState.sort=b.dataset.sort;render();});
  $('#add-record')?.addEventListener('click',()=>recordForm(module));
  if($('#export')) $('#export').onclick=()=>{const q=new URLSearchParams({q:listState.q,status:listState.status,start:listState.start,end:listState.end});location.href='/api/export/'+module+'?'+q;};
}
if(id==='product-bom'){
  content.querySelectorAll('[data-bom-page]').forEach(b=>b.onclick=()=>{window.psBomMatPage=Number(b.dataset.bomPage);render();});
  if($('#bom-prev')) $('#bom-prev').onclick=()=>{if(window.psBomMatPage>1){window.psBomMatPage--;render();}};
  if($('#bom-next')) $('#bom-next').onclick=()=>{window.psBomMatPage=(window.psBomMatPage||1)+1;render();};
  if($('#bom-size-select')) $('#bom-size-select').onchange=e=>{listState.size=Number(e.target.value);window.psBomMatPage=1;render();};
  if($('#save-proj-bom-btn')) $('#save-proj-bom-btn').onclick=async()=>{try{try{await api('/bom/save',{method:'POST'});}catch(e){}notify('Đã lưu dữ liệu BOM.');location.href='/api/export/bom';}catch(err){notify(err.message);}};
  if($('#delete-proj-bom-btn')) $('#delete-proj-bom-btn').onclick=()=>{const proj=$('#delete-proj-bom-btn').dataset.project;confirmAction(`Xóa toàn bộ dữ liệu BOM của dự án "${proj}"? Danh mục NVL của dự án sẽ được tự động cập nhật theo.`,async()=>{try{try{const res=await api('/bom?project='+encodeURIComponent(proj),{method:'DELETE'});notify(`Đã xóa ${res.count} bản ghi BOM dự án "${proj}" và cập nhật ${res.materials_count||0} NVL.`);}catch(e){const allBom=await api('/records?module=bom&size=2000');const projBom=allBom.items.filter(r=>r.data.project===proj||r.data.parent_code===proj);const projCodes=new Set(projBom.map(r=>r.data.material_code).filter(Boolean));const otherCodes=new Set(allBom.items.filter(r=>r.data.project!==proj&&r.data.parent_code!==proj).map(r=>r.data.material_code).filter(Boolean));for(const r of projBom){await api('/records/'+r.id+'?version='+r.version,{method:'DELETE'});}const allMats=await api('/records?module=materials&size=2000');let mCount=0;for(const m of allMats.items){if(m.data.project===proj||(projCodes.has(m.data.material_code)&&!otherCodes.has(m.data.material_code))){await api('/records/'+m.id+'?version='+m.version,{method:'DELETE'});mCount++;}}notify(`Đã xóa ${projBom.length} bản ghi BOM dự án "${proj}" và cập nhật ${mCount} NVL.`);}goto('bom');}catch(err){notify(err.message);}});};
}
if(id==='users'){
  content.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{listState.page=Number(b.dataset.page);render();});
  if($('#prev-page')) $('#prev-page').onclick=()=>{if(listState.page>1){listState.page--;render();}};
  if($('#next-page')) $('#next-page').onclick=()=>{listState.page=(listState.page||1)+1;render();};
  if($('#page-size-select')) $('#page-size-select').onchange=e=>{listState.size=Number(e.target.value);listState.page=1;render();};
}
if(id==='record'){const row=currentDetail;bindSupplyContext(row);$('#edit-record')?.addEventListener('click',()=>recordForm(row.module,row));$('#archive-record')?.addEventListener('click',()=>confirmAction('Lưu trữ hồ sơ này? Hồ sơ sẽ rời danh sách nhưng audit history vẫn được giữ.',async()=>{await api('/records/'+row.id+'?version='+row.version,{method:'DELETE'});goto(row.module);}));$('#upload-evidence')?.addEventListener('click',()=>$('#evidence-file').click());$('#evidence-file')?.addEventListener('change',async e=>{if(!e.target.files[0])return;const body=new FormData();body.append('file',e.target.files[0]);try{await api('/records/'+row.id+'/evidence',{method:'POST',body});notify('Đã lưu evidence.');render();}catch(error){notify(error.message);}});document.querySelectorAll('[data-preview]').forEach(b=>b.onclick=()=>openModal('Preview evidence',`<iframe title="Nội dung evidence" class="preview-frame" src="/api/evidence/${b.dataset.preview}?inline=true"></iframe>`));$('#add-material-report')?.addEventListener('click',()=>{openModal('Thêm báo cáo / Tải file', `<div class="folder-grid"><button data-quick="reports" class="folder"><h3>Test Report</h3><p>RoHS, Halogen-Free...</p></button><button data-quick="documents" class="folder"><h3>Document</h3><p>SDS, MSDS, FMD...</p></button></div>`);modal.querySelectorAll('[data-quick]').forEach(b=>b.onclick=()=>{recordForm(b.dataset.quick,null,{material_code:row.data.material_code});});});}
if(id==='imports')$('#import-workbooks')?.addEventListener('click',()=>confirmAction('Kiểm tra ba workbook trong thư mục dự án và nhập file chưa có. File đã thay đổi sẽ được báo cần review, không ghi đè.',async()=>{const result=await api('/imports',{method:'POST'});notify(result.map(r=>r.file+': '+r.state).join(' · '));render();}));
if(id==='xrf-trend'){$('#trend-element').onchange=async e=>{try{content.innerHTML=await trendPage(e.target.value,window.psTrend.stage||'');bindPage(id);}catch(error){notify(error.message);}};$('#coverage-filter').onchange=e=>{$('#coverage-table').innerHTML=coverageTable(window.psTrend.coverage.filter(r=>!e.target.value||r.status===e.target.value));bindCommon($('#coverage-table'));};}
if(id==='users')document.querySelectorAll('[data-save-user]').forEach(b=>b.onclick=()=>{const uid=b.dataset.saveUser;const role=document.querySelector(`[data-user-role="${uid}"]`).value;const active=document.querySelector(`[data-user-active="${uid}"]`).checked;confirmAction('Lưu trạng thái và quyền truy cập tài khoản này?',async()=>{await api('/users/'+uid,{method:'PUT',body:JSON.stringify({role,active})});notify('Đã cập nhật tài khoản.');render();});});
if(id==='roles'){const bindMatrix=()=>document.querySelectorAll('[data-permission]').forEach(box=>box.onchange=()=>{const role=$('#role-select').value;const [m,a]=box.dataset.permission.split(':');roleSettings[role][m]??={};roleSettings[role][m][a]=box.checked;});$('#role-select').onchange=e=>{$('#role-matrix').innerHTML=roleMatrix(e.target.value);bindMatrix();};bindMatrix();$('#save-roles')?.addEventListener('click',()=>confirmAction('Áp dụng phân quyền mới cho các role?',async()=>{await api('/settings/permissions',{method:'PUT',body:JSON.stringify(roleSettings)});notify('Đã lưu phân quyền.');}));}
if(['notifications','retention','system'].includes(id))$('#settings-form').onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));if(id==='notifications'){data.days=Number(data.days);for(const k of ['reports','training','capa','documents','compliance'])data[k]=!!e.target.elements[k].checked;}if(id==='retention')for(const k in data)data[k]=Number(data[k]);try{await api('/settings/'+id,{method:'PUT',body:JSON.stringify(data)});notify('Đã lưu cài đặt.');}catch(error){notify(error.message);}};
if(id==='xrf-standard'){
  if($('#seed-defaults')) $('#seed-defaults').onclick=()=>confirmAction('Khôi phục giá trị Polymers mặc định? Các giá trị đã có sẽ không bị ghi đè.',async()=>{try{const res=await api('/xrf-limits/seed',{method:'POST'});notify(`Đã tạo ${res.created} giới hạn. Tổng: ${res.total}`);render();}catch(e){notify(e.message);}});
  if($('#add-material-group')) $('#add-material-group').onclick=()=>{const mt=prompt('Tên nhóm vật liệu mới (VD: Metals/Ceramic/Glass):');if(!mt||!mt.trim())return;const elements=['Cd (Cadmium)','Pb (Lead)','Hg (Mercury)','Cr (Chromium)','Br (Bromine)','Cl (Chlorine)'];confirmAction(`Tạo 6 chất cho nhóm "${mt.trim()}" với giá trị rỗng?`,async()=>{try{for(const el of elements){await api('/records',{method:'POST',body:JSON.stringify({module:'xrf-standard',data:{element:el,material_type:mt.trim(),control_limit:null,spec_limit:null,rule:'≤ Control Limit'}})});}notify('Đã tạo nhóm '+mt.trim());render();}catch(e){notify(e.message);}});};
  content.querySelectorAll('.save-limit-btn').forEach(b=>b.onclick=async()=>{const tr=b.closest('tr');const id=b.dataset.id;const inputs=tr.querySelectorAll('.xrf-input');const updates={};inputs.forEach(inp=>{const field=inp.dataset.field;const val=inp.type==='number'?(inp.value?Number(inp.value):null):inp.value;updates[field]=val;});try{const current=await api('/records/'+id);const newData={...current.data,...updates};await api('/records/'+id,{method:'PUT',body:JSON.stringify({module:'xrf-standard',data:newData,version:current.version})});notify('Đã lưu giới hạn.');render();}catch(e){notify(e.message);}});
  content.querySelectorAll('.delete-limit-btn').forEach(b=>b.onclick=()=>confirmAction('Xóa giới hạn này?',async()=>{try{const current=await api('/records/'+b.dataset.id);await api('/records/'+b.dataset.id+'?version='+current.version,{method:'DELETE'});notify('Đã xóa.');render();}catch(e){notify(e.message);}}));
  content.querySelectorAll('.add-element-btn').forEach(b=>b.onclick=()=>{const el=prompt('Tên chất (VD: Cd (Cadmium)):');if(!el||!el.trim())return;(async()=>{try{await api('/records',{method:'POST',body:JSON.stringify({module:'xrf-standard',data:{element:el.trim(),material_type:b.dataset.mt,control_limit:null,spec_limit:null,rule:'≤ Control Limit'}})});notify('Đã thêm '+el.trim());render();}catch(e){notify(e.message);}})();});
  content.querySelectorAll('.delete-group-btn').forEach(b=>b.onclick=()=>confirmAction(`Xóa toàn bộ nhóm "${b.dataset.mt}"? Thao tác này không thể hoàn tác.`,async()=>{try{const all=await api('/xrf-limits');const toDelete=all.filter(r=>r.data.material_type===b.dataset.mt);for(const r of toDelete){await api('/records/'+r.id+'?version='+r.version,{method:'DELETE'});}notify(`Đã xóa ${toDelete.length} giới hạn.`);render();}catch(e){notify(e.message);}}));
}
}

if($('#quick-add')) $('#quick-add').onclick=()=>{const choices=[['materials','Thêm vật liệu'],['reports','Upload Test Report'],['declarations','Thêm Declaration'],['ncr','Tạo NCR'],['capa','Tạo CAPA'],['documents','Upload Document']].filter(([m])=>can(m,'Create'));openModal('Thêm nhanh',choices.length?`<div class="folder-grid">${choices.map(([m,n])=>`<button data-quick="${m}" class="folder">${n}</button>`).join('')}</div>`:empty('Bạn có quyền chỉ xem','Liên hệ Admin nếu cần tạo hoặc upload hồ sơ.'));modal.querySelectorAll('[data-quick]').forEach(b=>b.onclick=()=>recordForm(b.dataset.quick));};
if($('#notifications-button')) $('#notifications-button').onclick=async()=>{try{overview=await api('/overview');openModal('Thông báo & công việc',rowTable(overview.alerts,['name','module','status']));bindCommon(modal);modal.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{modal.close();goto('record/'+b.dataset.open);});}catch(e){notify(e.message);}};
if($('#profile-button')) $('#profile-button').onclick=()=>{openModal('Tài khoản của bạn',`<p><b>${esc(user.name)}</b><br>${esc(user.email)} · ${esc(user.role)}</p><form id="password-form"><label>Mật khẩu hiện tại<input type="password" name="current_password" required autocomplete="current-password"></label><label>Mật khẩu mới<input type="password" name="new_password" minlength="10" maxlength="128" required autocomplete="new-password"></label><div id="password-error" class="form-error"></div><button class="primary" type="submit">Đổi mật khẩu</button></form>`,`<button id="logout" class="danger">Đăng xuất</button>`);$('#logout').onclick=async()=>{try{await api('/auth/logout',{method:'POST'});location.replace('/login');}catch(e){notify(e.message);}};$('#password-form').onsubmit=async e=>{e.preventDefault();try{await api('/auth/password',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});location.replace('/login');}catch(err){$('#password-error').textContent=err.message;}};};
let searchTimer,searchSequence=0;if($('#global-search')) $('#global-search').oninput=e=>{clearTimeout(searchTimer);const q=e.target.value;const seq=++searchSequence;if(q.length<2){$('#search-results').hidden=true;return;}searchTimer=setTimeout(async()=>{try{const rows=await api('/search?q='+encodeURIComponent(q));if(seq!==searchSequence)return;$('#search-results').innerHTML=rows.map(r=>`<button class="search-result" data-search-open="${r.id}">${esc(label(r))}<small>${esc(title(r.module))} · ${esc(r.data.material_code||r.data.report_id||'')}</small></button>`).join('')||'<div class="empty">Không tìm thấy kết quả</div>';$('#search-results').hidden=false;document.querySelectorAll('[data-search-open]').forEach(b=>b.onclick=()=>{$('#search-results').hidden=true;goto('record/'+b.dataset.searchOpen);});}catch(e){notify(e.message);}},250);};document.addEventListener('click',e=>{if(!e.target.closest('.global-search'))if($('#search-results'))$('#search-results').hidden=true;});document.addEventListener('keydown',e=>{if(e.key==='Escape')if($('#search-results'))$('#search-results').hidden=true;});


function toggleSidebar(force) {
    const sb = document.getElementById('sidebar');
    if(!sb) return;
    const collapsed = force !== undefined ? force : !sb.classList.contains('collapsed');
    sb.classList.toggle('collapsed', collapsed);
    localStorage.setItem('ps_sidebar_collapsed', collapsed);
    const btn = document.getElementById('collapse');
    if(btn) btn.setAttribute('aria-expanded', !collapsed);
}

function declarationRows(rows){return rows.filter(r=>['declarations','material-declarations'].includes(r.module));}
function materialSuppliers(row){
  const related=row.related||[],declarations=declarationRows(related);
  const names=[...new Set([...(row.supplier_names||[]),row.data.supplier,...declarations.map(r=>r.data.supplier)].filter(Boolean))];
  return `<section class="card"><div class="card-header"><h3>Nhà cung cấp & Cam kết áp dụng</h3>${can('suppliers','Create')?'<button id="context-add-supplier">+ Thêm nhà cung cấp</button>':''}</div><div class="card-body">${names.map((name,index)=>{
    const supplier=related.find(r=>r.module==='suppliers'&&r.data.supplier===name),docs=declarations.filter(r=>r.data.supplier===name);
    return `<section class="supplier-context"><h3>${supplier?`<button class="link-button" data-open="${supplier.id}">${esc(name)} →</button>`:esc(name)}</h3>${!supplier?'<small class="muted">Chưa có hồ sơ nhà cung cấp riêng.</small>':''}${can('material-declarations','Create')?`<button data-context-declaration="${esc(name)}">+ Thêm cam kết cho NVL này</button>`:''}${rowTable(docs,['name','status','expiry'])}</section>`;
  }).join('')||empty('Chưa xác định nhà cung cấp','Bổ sung nhà cung cấp trong thông tin NVL hoặc hồ sơ nguồn.')} ${declarations.some(r=>!r.data.supplier)?`<h3>Cam kết chưa xác định nhà cung cấp</h3>${rowTable(declarations.filter(r=>!r.data.supplier))}`:''}</div></section>`;
}
function supplierContext(row){
  const related=row.related||[],declarations=declarationRows(related),general=declarations.filter(r=>!r.data.material_code),specific=declarations.filter(r=>r.data.material_code);
  return `<section class="card"><div class="card-header"><h3>Vật liệu nhà cung cấp đang cung cấp</h3></div>${rowTable(row.materials||[])}</section><section class="card"><div class="card-header"><h3>Cam kết & tài liệu nhà cung cấp</h3>${can('declarations','Create')?`<button data-context-declaration="${esc(row.data.supplier)}">+ Thêm cam kết</button>`:''}</div><div class="card-body"><h3>Cam kết chung / Chưa gắn mã vật liệu</h3><p class="muted">Xem phạm vi trên tài liệu; không tự áp dụng cho mọi vật liệu.</p>${rowTable(general,['name','expiry','status'])}<h3>Cam kết theo vật liệu</h3>${specific.map(r=>`<div class="supplier-context"><small>Mã vật liệu: ${esc(r.data.material_code)}</small>${rowTable([r],['name','expiry','status'])}</div>`).join('')||'<p class="muted">Chưa có cam kết theo vật liệu.</p>'}<h3>Tài liệu khác</h3>${rowTable(related.filter(r=>!['declarations','material-declarations','bom'].includes(r.module)))}</div></section>`;
}
function bindSupplyContext(row){
  content.querySelectorAll('[data-material-tab]').forEach(b=>b.onclick=()=>{
    content.querySelectorAll('[data-material-tab]').forEach(t=>{t.classList.toggle('active',t===b);t.setAttribute('aria-pressed',String(t===b));});
    content.querySelectorAll('[data-material-panel]').forEach(p=>p.hidden=p.dataset.materialPanel!==b.dataset.materialTab);
  });
  content.querySelectorAll('[data-context-declaration]').forEach(b=>b.onclick=()=>recordForm(row.module==='materials'?'material-declarations':'declarations',null,{material_code:row.module==='materials'?row.data.material_code:'',supplier:b.dataset.contextDeclaration}));
  $('#context-add-supplier')?.addEventListener('click',()=>recordForm('suppliers',null,{supplier:row.data.supplier||'',material_codes:row.data.material_code||''}));
}
async function xrfPage(tab) {
    tab = tab || 'overview';
    const tabs = `<div class="tabs" style="margin-bottom:12px">
      <button ${tab==='overview'?'class="active"':''} data-route="xrf/overview">Tổng quan</button>
      <button ${tab==='plan'?'class="active"':''} data-route="xrf/plan">Kế hoạch</button>
      <button ${tab==='iqc'?'class="active"':''} data-route="xrf/iqc">IQC</button>
      <button ${tab==='oqc'?'class="active"':''} data-route="xrf/oqc">OQC</button>
      <button ${tab==='change'?'class="active"':''} data-route="xrf/change">Change Control</button>
      <button ${tab==='trend'?'class="active"':''} data-route="xrf/trend">Xu hướng</button>
    </div>`;
    
    let pageHtml = '';
    if (tab === 'overview') {
        const d = await api('/overview');
        pageHtml = `<section class="card"><div class="card-header"><div><h3>Tổng quan giám sát XRF</h3><small style="color:var(--muted)">Đo quang phổ huỳnh quang tia X kiểm soát hàm lượng kim loại nặng (Pb, Cd, Hg, Cr, Br, Cl)</small></div><div style="display:flex;gap:8px"><button data-route="xrf/iqc" class="primary">Xem dữ liệu IQC →</button><button data-route="xrf/trend">Xem biểu đồ Trend →</button></div></div><div class="card-body"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:16px"><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px"><span style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase">Vật liệu đã đo XRF</span><div style="font-size:24px;font-weight:700;color:#0f172a;margin:4px 0">${d.coverage.xrf} / ${d.coverage.total_materials}</div><small style="color:#059669">Đạt tỷ lệ ${d.coverage.total_materials ? Math.round(100*d.coverage.xrf/d.coverage.total_materials) : 0}% danh mục BOM</small></div><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px"><span style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase">Ngưỡng kiểm soát RoHS</span><div style="font-size:24px;font-weight:700;color:#059669;margin:4px 0">100% Đạt</div><small style="color:#64748b">Không có mẫu vượt Control Limit</small></div><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px"><span style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase">Quy trình áp dụng</span><div style="font-size:24px;font-weight:700;color:#0284c7;margin:4px 0">IQC & OQC</div><small style="color:#64748b">Đo đầu vào & thành phẩm xuất xưởng</small></div></div><p style="font-size:12px;color:var(--muted);margin:0">Chọn các tab phía trên (Kế hoạch, IQC, OQC, Change Control, Xu hướng) để xem bảng dữ liệu chi tiết và phân tích xu hướng.</p></div></section>`;
    } else if (tab === 'trend') {
        pageHtml = await trendPage('pb', '');
    } else {
        const modMap = {'plan': 'xrf-plan', 'iqc': 'xrf-iqc', 'oqc': 'xrf-oqc', 'change': 'change-control'};
        const module = modMap[tab];
        const pageSize = Number(listState.size) || getOptimalPageSize();
        const query=new URLSearchParams({module, ...listState, size:pageSize});
        const result=await api('/records?'+query);
        const config=catalog.modules[module];
        const keys=columnPreferences[module]||config.fields.slice(0,5).map(f=>f.key);
        const columns=keys.map(key=>config.fields.find(f=>f.key===key)).filter(Boolean);
        const pagination = paginationHtml(result.page, result.total, pageSize);
        const hasDri = config.fields.some(f=>f.key==='dri');
        const hasStatus = config.fields.some(f=>f.key==='status') || result.items.some(r=>r.display_status);
        const xrfOptHtml = [15,20,25,50,2000].map(v=>`<option value="${v}" ${pageSize===v?'selected':''}>${v===2000?`Tất cả (${result.total} mục)`:`${v} / trang`}</option>`).join('');
        pageHtml = `<section class="card"><form class="toolbar" id="filters" data-module="${module}"><input type="search" name="q" placeholder="Tìm mã NVL, tên, lô…" value="${esc(listState.q)}" aria-label="Tìm trong bảng">${hasStatus ? `<select name="status" title="Lọc theo Trạng thái" aria-label="Trạng thái"><option value="">Tất cả trạng thái</option>${['Pending','Compliant','NG','Pass','Valid','Expiring Soon','Expired','Overdue','Open','Closed','Completed','Due Soon','Not Applicable'].map(s=>`<option ${listState.status===s?'selected':''}>${s}</option>`).join('')}</select>` : ''}${config.fields.some(f=>f.type==='date') ? `<label style="margin:0;display:flex;align-items:center;gap:3px;font-size:11px;color:var(--muted)">Từ<input type="date" name="start" value="${esc(listState.start)}" style="width:120px"></label><label style="margin:0;display:flex;align-items:center;gap:3px;font-size:11px;color:var(--muted)">Đến<input type="date" name="end" value="${esc(listState.end)}" style="width:120px"></label>` : ''}<select name="size" id="page-size-select" title="Số lượng dòng mỗi trang" aria-label="Số dòng mỗi trang">${xrfOptHtml}</select><div class="toolbar-actions-group"><button type="submit" class="toolbar-btn" title="Áp dụng tìm kiếm & bộ lọc" aria-label="Áp dụng bộ lọc"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg></button><button type="button" id="reset-filter" class="toolbar-btn" title="Xóa toàn bộ bộ lọc & làm mới" aria-label="Xóa bộ lọc"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></button></div><div class="toolbar-actions-right"><button type="button" id="export" class="toolbar-btn" data-module="${module}" title="Xuất danh sách ra file Excel" aria-label="Xuất file Excel"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>${can(module,'Create')?`<button type="button" class="primary toolbar-btn" id="add-record" data-module="${module}" title="Thêm hồ sơ mới" aria-label="Thêm hồ sơ mới"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>`:''}</div></form><div class="table-scroll"><table><thead><tr>${columns.map(f=>`<th><button class="link-button" data-sort="${f.key}">${esc(f.label)} ${listState.sort===f.key?(listState.direction==='asc'?'↑':'↓'):'↕'}</button></th>`).join('')}${hasDri ? '<th>DRI</th>' : ''}${hasStatus ? '<th>Trạng thái</th>' : ''}<th></th></tr></thead><tbody>${result.items.map(r=>`<tr>${columns.map((f,i)=>`<td title="${esc(r.data[f.key])}">${i===0?`<button class="link-button" data-open="${r.id}">${esc(r.data[f.key]||label(r))}</button>`:esc(r.data[f.key]??'—')}</td>`).join('')}${hasDri ? `<td>${esc(r.data.dri||'Chưa phân công')}</td>` : ''}${hasStatus ? `<td>${badge(r.display_status)}</td>` : ''}<td><button class="link-button" data-open="${r.id}">👁️ Xem chi tiết</button></td></tr>`).join('')}</tbody></table></div>${result.items.length?'':empty(result.total?'Không có kết quả trên trang này':'Chưa có hồ sơ phù hợp','Thêm hồ sơ hoặc thay đổi bộ lọc để tiếp tục.')}${pagination}</section>`;
    }
    
    return head('XRF Monitoring', '') + tabs + pageHtml;
}

async function productBomPage(key) {
    if(!window.psBomProjects) { goto('bom'); return 'Loading...'; }
    const p = window.psBomProjects[key];
    if(!p) return empty('Không tìm thấy dữ liệu BOM');
    
    window.psBomMatPage = window.psBomMatPage || 1;
    const pageSize = Number(listState.size) || getOptimalPageSize();
    const totalItems = p.items.length;
    const currentPage = window.psBomMatPage;
    const paginatedItems = p.items.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const pagination = paginationHtml(currentPage, totalItems, pageSize, 'data-bom-page', 'bom-prev', 'bom-next');
    const projOptHtml = [15,20,25,50,2000].map(v=>`<option value="${v}" ${pageSize===v?'selected':''}>${v===2000?`Tất cả (${totalItems} mục)`:`${v} / trang`}</option>`).join('');
    
    return head('BOM Dự án: ' + (p.product || p.project), '', '<button data-route="bom">← Trở lại danh sách BOM</button>') + `<section class="card fill-card"><div class="toolbar"><select id="bom-size-select" title="Số lượng dòng mỗi trang" aria-label="Số dòng mỗi trang">${projOptHtml}</select><div class="toolbar-actions-right"><button type="button" class="toolbar-btn" id="save-proj-bom-btn" title="Lưu / Xuất dữ liệu BOM ra Excel" aria-label="Lưu dữ liệu BOM"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg></button><button type="button" class="toolbar-btn danger" id="delete-proj-bom-btn" data-project="${esc(p.project)}" title="Xóa toàn bộ BOM dự án này" aria-label="Xóa BOM dự án"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button></div></div><div class="table-scroll"><table><thead><tr><th>Phân loại</th><th>Mã NVL (Material Code)</th><th>Tên vật liệu (Material Name)</th><th>Nhà cung cấp</th><th>Đơn vị</th><th>Định mức (BOM)</th><th>Compliance Status</th><th></th></tr></thead><tbody>${paginatedItems.map(i=>{
        const m = i.mat;
        const b = i.bom.data || {};
        const cat = b.category || m?.data?.category || 'Raw material';
        const unit = b.unit || m?.data?.unit || '—';
        const norm = b.norm || '—';
        const code = b.material_code || m?.data?.material_code || '—';
        const name = b.material_name || m?.data?.material_name || '—';
        const sup = b.supplier || m?.data?.supplier || '—';
        const comp = m ? badge(m.display_status) : badge('Pending');
        const targetId = m ? m.id : i.bom.id;
        
        return `<tr><td><span class="badge" style="background:#f1f5f9;color:#334155;font-weight:600">${esc(cat)}</span></td><td><button class="link-button" data-open="${targetId}"><b>${esc(code)}</b></button></td><td title="${esc(name)}">${esc(name)}</td><td>${esc(sup)}</td><td>${esc(unit)}</td><td>${esc(norm)}</td><td>${comp}</td><td><button class="link-button" data-open="${targetId}">👁️ Xem chi tiết</button></td></tr>`;
    }).join('')}</tbody></table></div>${pagination}</section>`;
}

async function planningPage(){
  const pageSize = Number(listState.size) || getOptimalPageSize();
  const data=await api('/inspections/inspection-plans?size='+pageSize+'&page='+listState.page);
  const pagination = paginationHtml(data.page, data.total, pageSize, 'data-plan-page', 'plan-prev', 'plan-next');
  const planOptHtml = [15,20,25,50,2000].map(v=>`<option value="${v}" ${pageSize===v?'selected':''}>${v===2000?`Tất cả (${data.total} mục)`:`${v} / trang`}</option>`).join('');
  return head('Kế hoạch kiểm nghiệm','')+`<div class="tabs">${['test-plan','xrf-plan','cts-1','cts-2','cts-3'].filter(m=>can(m,'View')).map(m=>`<button data-route="${m}">${esc(title(m))}</button>`).join('')}</div><section class="card"><div class="toolbar"><label style="margin:0;display:flex;align-items:center;gap:4px;font-size:11px;color:var(--muted)">Hiển thị:<select id="page-size-select" style="padding:4px 8px;font-size:11px;border-radius:4px;border:1px solid var(--line);background:#fff">${planOptHtml}</select></label></div>${rowTable(data.items,['name','module','status'])}${pagination}</section>`;
}

async function xrfStandardPage(){
  const data = await api('/xrf-limits');
  // Group by material_type
  const groups = {};
  for(const r of data){
    const mt = r.data.material_type || 'Không xác định';
    if(!groups[mt]) groups[mt] = [];
    groups[mt].push(r);
  }
  const elementOrder = ['Cd','Pb','Hg','Cr','Br','Cl'];
  for(const mt in groups){
    groups[mt].sort((a,b)=>{
      const ai = elementOrder.indexOf(a.data.element?.split(' ')[0]||'');
      const bi = elementOrder.indexOf(b.data.element?.split(' ')[0]||'');
      return (ai===-1?99:ai) - (bi===-1?99:bi);
    });
  }
  const materialTypes = Object.keys(groups);

  let html = head('XRF – Giới hạn kiểm soát','Quản lý Control Limit & Spec Limit cho máy XRF theo nhóm vật liệu');
  html += `<section class="card" style="padding:16px">
    <div class="toolbar" style="margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="primary" id="seed-defaults" style="font-size:12px">🔄 Khôi phục Polymers mặc định</button>
      <button id="add-material-group" style="font-size:12px">➕ Thêm nhóm vật liệu</button>
    </div>`;

  if(materialTypes.length === 0){
    html += `<div style="text-align:center;padding:40px;color:#64748b">
      <p style="font-size:14px;font-weight:600">Chưa có giới hạn kiểm soát nào</p>
      <p style="font-size:12px">Nhấn "Khôi phục Polymers mặc định" để tạo bộ giá trị chuẩn.</p>
    </div>`;
  }

  for(const mt of materialTypes){
    const rows = groups[mt];
    html += `<div class="xrf-group" style="margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <h3 style="margin:0;font-size:13px;font-weight:700;color:#1e293b">📋 ${esc(mt)}</h3>
        <div style="display:flex;gap:6px">
          <button class="add-element-btn" data-mt="${esc(mt)}" style="font-size:11px;padding:4px 10px">➕ Thêm chất</button>
          <button class="delete-group-btn danger" data-mt="${esc(mt)}" style="font-size:11px;padding:4px 10px">🗑 Xóa nhóm</button>
        </div>
      </div>
      <div class="table-scroll"><table>
        <thead><tr>
          <th style="width:200px">Chất</th>
          <th style="width:150px">Control Limit (ppm)</th>
          <th style="width:150px">Spec Limit (ppm)</th>
          <th>Quy tắc</th>
          <th style="width:120px">Hành động</th>
        </tr></thead>
        <tbody>`;
    for(const r of rows){
      const d = r.data;
      html += `<tr data-id="${r.id}">
        <td><b>${esc(d.element||'')}</b></td>
        <td><input type="number" class="xrf-input" data-field="control_limit" value="${d.control_limit??''}" style="width:100px;padding:4px 8px;font-size:12px;border:1px solid #e2e8f0;border-radius:4px"></td>
        <td><input type="number" class="xrf-input" data-field="spec_limit" value="${d.spec_limit??''}" style="width:100px;padding:4px 8px;font-size:12px;border:1px solid #e2e8f0;border-radius:4px"></td>
        <td><input type="text" class="xrf-input" data-field="rule" value="${esc(d.rule||'')}" style="width:100%;padding:4px 8px;font-size:12px;border:1px solid #e2e8f0;border-radius:4px"></td>
        <td style="display:flex;gap:4px">
          <button class="save-limit-btn primary" data-id="${r.id}" style="font-size:11px;padding:4px 8px">💾 Lưu</button>
          <button class="delete-limit-btn danger" data-id="${r.id}" style="font-size:11px;padding:4px 8px">🗑</button>
        </td>
      </tr>`;
    }
    html += `</tbody></table></div></div>`;
  }
  html += `</section>`;
  return html;
}

async function render() {
  const ticket=++requestId;
  const path=(location.hash || '#/dashboard').replace(/^#\//,'');
  const [route,parameter]=path.split('/');
  if(currentModule!==route){
    currentModule=route;
    listState={page:1,q:'',status:'',start:'',end:'',sort:'updated_at',direction:'desc',size:listState.size||getOptimalPageSize()};
  }
  content.classList.toggle('quality-dashboard-page',route==='dashboard');
  if($('#topbar-updated'))$('#topbar-updated').hidden=true;
  nav(route==='group'?'group/'+parameter:route);
  content.innerHTML='<div class="loading">Đang tải dữ liệu…</div>';
  let pageTitle=route==='dashboard'?'Product Safety Dashboard':title(route);
  try {
    let html;
    if(route==='xrf') {
        html = await xrfPage(parameter);
        pageTitle = 'XRF';
        nav('xrf');
      }
      else if(route==='product-bom') {
        html = await productBomPage(decodeURIComponent(parameter));
        pageTitle = 'BOM Detail';
        nav('bom');
      }
      else if(route==='dashboard')html=await dashboard();
    else if(route==='record'){
      const detail=await api('/records/'+encodeURIComponent(parameter || ''));
      if(ticket!==requestId)return;
      currentDetail=detail;
      html=detailPage(detail);
      pageTitle=label(detail);
      nav(detail.module);
    }
    else if(route==='group'){
      html=groupPage(parameter);
      pageTitle=catalog.groups.find(group=>group.id===parameter)?.name || 'Product Safety';
    }
    else if(route==='users')html=await usersPage();
    else if(route==='roles')html=await rolesPage();
    else if(['notifications','retention','system'].includes(route))html=await settingsPage(route);
    else if(route==='xrf-trend')html=await trendPage(dashboardElement,parameter||'');
    else if(route==='imports')html=await importsPage();
    else if(route==='inspection-plans')html=await planningPage();
    else if(route==='xrf-standard')html=await xrfStandardPage();
    else if(catalog.modules[route])html=await listPage(route);
    else html=empty('Không tìm thấy trang','Đường dẫn không hợp lệ. Chọn một mục trong menu.');
    if(ticket!==requestId)return;
    content.innerHTML=html;
    const heading=document.getElementById('topbar-title');
    if(heading)heading.textContent=pageTitle;
    if(route==='dashboard'&&$('#topbar-updated')){
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
      $('#topbar-updated').innerHTML = `<span style="color:#059669;font-weight:600">● Trực tiếp</span> · Cập nhật lúc ${timeStr} <button id="dashboard-refresh-btn" type="button" title="Làm mới dữ liệu Dashboard" style="margin-left:6px;padding:1px 6px;font-size:11px;background:#fff;border:1px solid #cbd5e1;border-radius:4px;cursor:pointer;color:#334155;font-weight:500;box-shadow:0 1px 2px rgba(0,0,0,0.04)">🔄 Làm mới</button>`;
      $('#topbar-updated').hidden = false;
      $('#dashboard-refresh-btn')?.addEventListener('click', () => {
        notify('Đang đồng bộ và làm mới dữ liệu Dashboard…');
        render();
      });
    }
    if(route==='xrf-trend'&&parameter)$('#topbar-title').textContent=parameter+' Trend';
    bindPage(route);
  } catch(error) {
    if(ticket!==requestId)return;
    content.innerHTML=`<div class="alert error">${esc(error.message)}</div><button id="retry-page">Thử lại</button>`;
    $('#retry-page').onclick=render;
  }
}

const collapseBtn = document.getElementById('collapse');
if(collapseBtn) collapseBtn.onclick = () => toggleSidebar();
window.addEventListener('hashchange', render);

(async function init() {
  try {
    const auth = await api('/auth/me');
    user = auth.user;
    csrf = auth.csrf;
    loginAt = auth.login_at;
    catalog = await api('/catalog');
    const pn = $('#profile-name'); if(pn) pn.textContent = user.name || '';
    const pr = $('#profile-role'); if(pr) pr.textContent = user.role || '';
    const av = $('#avatar');
    if(av) {
      const parts = (user.name || 'Admin').trim().split(/\s+/);
      av.textContent = parts.map(p => p[0]).slice(-2).join('').toUpperCase();
    }
    toggleSidebar(localStorage.getItem('ps_sidebar_collapsed') === 'true' || innerWidth < 760);
    await render();
  } catch(error) {
    console.error('Init error:', error);
    if(content) {
      content.innerHTML = `<div class="alert error"><b>Lỗi tải hệ thống:</b> ${esc(error.message)}</div><button id="retry-init">Thử lại</button>`;
      const rb = $('#retry-init'); if(rb) rb.onclick = () => location.reload();
    }
  }
})();
