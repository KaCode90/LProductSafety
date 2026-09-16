export function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function label(row){const d=row.data;return d.chemical_group||d.material_name||d.report_id||d.requirement_id||d.capa_no||d.ncr_no||d.document_name||d.course||d.supplier||d.substance||d.value||d.process||d.department_name||d.element||d.declaration_no||('Hồ sơ #'+row.id);}
export function badge(status){const good=['Compliant','Pass','PASS','Valid','Closed','Completed','Approved'];const bad=['NG','FAIL','Expired','Overdue','Rejected','Critical'];const warn=['Expiring Soon','Due Soon','Warning','Pending Verification'];return `<span class="badge ${good.includes(status)?'good':bad.includes(status)?'bad':warn.includes(status)?'warn':''}">${esc(status||'Pending')}</span>`;}
export function dateText(value){if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?esc(value):d.toLocaleDateString('vi-VN');}
export function timeText(value){return value?new Date(value+'Z').toLocaleString('vi-VN'):'—';}
export function sourceText(source){return source?`${esc(source.file)} · ${esc(source.sheet)} · dòng ${esc(source.row)}`:'';}
export function percent(a,b){return b?Math.round(100*a/b):0;}
export function empty(message='Chưa có hồ sơ',detail='Thêm hồ sơ đầu tiên để bắt đầu theo dõi.'){
    return `<div class="empty"><h3>${esc(message)}</h3><p>${esc(detail)}</p></div>`;
}
