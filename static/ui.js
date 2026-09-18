export function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function label(row){const d=row.data;return d.chemical_group||d.material_name||d.report_id||d.requirement_id||d.capa_no||d.ncr_no||d.document_name||d.course||d.supplier||d.substance||d.value||d.process||d.department_name||d.element||d.declaration_no||('Hồ sơ #'+row.id);}
export function badge(status){
  const good=['Đang sử dụng','Đạt yêu cầu','Compliant','Pass','PASS','Valid','Closed','Completed','Approved'];
  const bad=['NG','FAIL','Expired','Overdue','Rejected','Critical','Blacklist','Ngừng sử dụng'];
  const warn=['Tạm ngưng','Thiếu hồ sơ','Cần cập nhật','Expiring Soon','Due Soon','Warning','Pending Verification','Conditional'];
  let customStyle = '';
  if (status === 'Qualified') customStyle = 'style="background:#eff6ff;color:#1d4ed8;border:1px solid #93c5fd"';
  else if (status === 'Blacklist') customStyle = 'style="background:#fee2e2;color:#991b1b;border:1px solid #f87171"';
  else if (status === 'Conditional') customStyle = 'style="background:#fef3c7;color:#b45309;border:1px solid #fde68a"';
  else if (status === 'Approved') customStyle = 'style="background:#f0fdf4;color:#15803d;border:1px solid #86efac"';
  return `<span class="badge ${bad.includes(status)?'bad':good.includes(status)?'good':warn.includes(status)?'warn':''}" ${customStyle}>${esc(status||'Pending')}</span>`;
}
export function dateText(value){if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?esc(value):d.toLocaleDateString('vi-VN');}
export function timeText(value){return value?new Date(value+'Z').toLocaleString('vi-VN'):'—';}
export function sourceText(source){return source?`${esc(source.file)} · ${esc(source.sheet)} · dòng ${esc(source.row)}`:'';}
export function percent(a,b){return b?Math.round(100*a/b):0;}
export function empty(message='Chưa có hồ sơ',detail='Thêm hồ sơ đầu tiên để bắt đầu theo dõi.'){
    return `<div class="empty"><h3>${esc(message)}</h3><p>${esc(detail)}</p></div>`;
}
