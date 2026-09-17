import re

with open('static/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = '''if(row.module==='materials'){
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
    const checklistHtml = `<section class="card"><div class="card-header"><div><h3>Cấu hình Required Test</h3><small class="muted">Chỉ mục Required mới dùng đánh giá Compliance</small></div>${can('materials','Edit')?'<button class="primary" onclick="alert(\'Dùng nút Chỉnh sửa phía trên để cập nhật trường Yêu cầu kiểm nghiệm (cách nhau dấu phẩy)\')">Chỉnh sửa</button>':''}</div><div class="card-body"><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">${allTests.map(t=>`<label><input type="checkbox" disabled ${req_tests.includes(t)?'checked':''}> ${t}</label>`).join('')}</div></div></section>`;
    
    const tabCompliance = checklistHtml + `<section class="card"><div class="card-header"><div><h3>Hồ sơ tuân thủ & CTS</h3><small class="muted">Mã liên kết: ${esc(row.aliases.join(', '))}</small></div>${compAllowed?'<button class="primary" id="add-comp-report">+ Thêm hồ sơ</button>':''}</div><div class="card-body"><div class="folder-grid">${cTypes.map(type=>{const matches=compFiles.filter(r=>compType(r)===type);return `<div class="folder"><h3>${type}</h3><p>${matches.length} hồ sơ</p>${matches.map(r=>`<p><button class="link-button" data-open="${r.id}">${esc(r.data.report_id||r.data.document_no||r.data.substance||label(r))}</button><br>${badge(r.display_status)} ${r.data.expiry_date?dateText(r.data.expiry_date):''}</p>`).join('')}</div>`;}).join('')}</div>${!cTypes.length?empty('Chưa có hồ sơ tuân thủ'):''}</div></section>`;
    const testFiles = related.filter(r => ['test-plan', 'xrf-plan', 'xrf-iqc', 'xrf-oqc', 'change-control', 'oqc-reports'].includes(r.module) || (r.module==='reports' && compType(r)==='Khác'));
    const tTypes = Array.from(new Set(testFiles.map(r => title(r.module)))).sort();
    let trendHtml = '';
    if (related.some(r => r.module === 'xrf-iqc' || r.module === 'xrf-oqc')) {
      trendHtml = `<div class="alert" style="display:flex;justify-content:space-between;align-items:center;margin-top:20px;margin-bottom:0"><span>Vật liệu này có kết quả đo XRF. Xem biểu đồ đánh giá mức độ rủi ro và xu hướng thay đổi.</span><button class="primary" data-route="xrf-trend">Xem Biểu đồ Trend →</button></div>`;
    }
    const tabTesting = trendHtml + `<section class="card"><div class="card-header"><div><h3>Kế hoạch & Kết quả kiểm nghiệm</h3></div>${can('test-plan','Create')?'<button class="primary" id="add-test-plan">+ Thêm kế hoạch</button>':''}</div><div class="card-body"><div class="folder-grid">${tTypes.map(type=>{const matches=testFiles.filter(r=>title(r.module)===type);return `<div class="folder"><h3>${type}</h3><p>${matches.length} mục</p>${matches.map(r=>`<p><button class="link-button" data-open="${r.id}">${esc(label(r))}</button><br>${badge(r.display_status)}</p>`).join('')}</div>`;}).join('')}</div>${!tTypes.length?empty('Chưa có dữ liệu kiểm nghiệm'):''}</div></section>`;
    html+=`<div class="tabs" role="group" aria-label="Chi tiết vật liệu"><button class="active" data-material-tab="overview" aria-pressed="true">Tổng quan</button><button data-material-tab="suppliers" aria-pressed="false">Nhà cung cấp</button><button data-material-tab="compliance" aria-pressed="false">Hồ sơ tuân thủ</button><button data-material-tab="testing" aria-pressed="false">Kiểm nghiệm</button><button data-material-tab="history" aria-pressed="false">Lịch sử</button></div><div data-material-panel="overview">${tabOverview}</div><div data-material-panel="suppliers" hidden>${tabSuppliers}</div><div data-material-panel="compliance" hidden>${tabCompliance}</div><div data-material-panel="testing" hidden>${tabTesting}</div><div data-material-panel="history" hidden>${historyHtml}</div>`;
}else{'''

content = re.sub(r'if\(row\.module===\'materials\'\)\{.*?}else\{', replacement, content, flags=re.DOTALL)

with open('static/app.js', 'w', encoding='utf-8') as f:
    f.write(content)
