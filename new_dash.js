  async function dashboard(){
    const [d,iqc,oqc]=await Promise.all([api('/overview'),api('/xrf-trend?stage=IQC&element='+dashboardElement),api('/xrf-trend?stage=OQC&element='+dashboardElement)]);
    overview=d;$('#notification-count').textContent=d.open_actions??0;
    
    // Tầng 1: Management KPI
    const tier1 = `<div class="dashboard-tier">
      <div class="kpi-card"><h3>HSF COMPLIANCE</h3><div class="kpi-value">${d.hsf_compliance}%</div><small>${d.compliant_materials} / ${d.active_materials} Materials Compliant</small></div>
      <div class="kpi-card"><h3>ACTIVE MATERIALS</h3><div class="kpi-value">${d.active_materials}</div><small>Material đang được quản lý</small></div>
      <div class="kpi-card"><h3>TEST REPORT</h3><div class="kpi-value">${d.valid_reports} / ${d.required_reports}</div><small>Required Reports Valid</small></div>
      <div class="kpi-card"><h3>OPEN ACTIONS</h3><div class="kpi-value">${d.open_actions}</div><small>Các action đang cần xử lý</small></div>
    </div>`;

    // Tầng 2: Technical Monitoring
    const tier2 = `<div class="dashboard-tier"><section class="card" style="width:100%"><div class="card-header"><h3>XRF MONITORING</h3><div style="display:flex;gap:10px"><label>Chất phân tích <select id="dashboard-element">${['pb','cd','hg','cr','br','cl'].map(e=>`<option value="${e}" ${e===dashboardElement?'selected':''}>${e.toUpperCase()}</option>`).join('')}</select></label><label>Time Range <select disabled><option>6 tháng</option></select></label></div></div><div class="quality-trends" style="display:flex;gap:20px;padding:20px">${dashboardTrend('IQC XRF Trend',iqc)}${dashboardTrend('OQC XRF Trend',oqc)}</div></section></div>`;
    
    // Tầng 3: Risk & Action
    const coverage = d.coverage;
    const tier3 = `<div class="dashboard-tier" style="display:flex;gap:20px">
      <section class="card" style="flex:2"><div class="card-header"><h3>VIỆC CẦN XỬ LÝ</h3><button id="dashboard-alerts">Xem tất cả</button></div><div class="quality-tasks">${d.alerts.slice(0,6).map(a=>{
        const icon = a.type==='expired'?'🔴':a.type==='expiring'||a.type==='missing'?'🟠':'🔵';
        return `<button data-open="${a.id}">${icon} ${esc(a.title)}</button>`;
      }).join('')||'<p class="muted">Không có việc cần xử lý</p>'}</div></section>
      
      <section class="card" style="flex:1"><div class="card-header"><h3>COMPLIANCE COVERAGE</h3></div><div class="coverage-stats" style="padding:20px;line-height:2">
        <p>FMD <span style="float:right">${coverage.fmd} / ${coverage.total_materials} ${coverage.fmd>=coverage.total_materials?'✓':'⚠'}</span></p>
        <p>Declaration <span style="float:right">${coverage.declaration} / ${coverage.total_materials} ${coverage.declaration>=coverage.total_materials?'✓':'⚠'}</span></p>
        <p>Test Report <span style="float:right">${d.valid_reports} / ${d.required_reports} ${d.valid_reports>=d.required_reports?'✓':'⚠'}</span></p>
        <p>XRF <span style="float:right">${coverage.xrf} / ${coverage.total_materials} ${coverage.xrf>=coverage.total_materials?'✓':'⚠'}</span></p>
      </div></section>
    </div>`;

    return `<div class="quality-dashboard" style="display:flex;flex-direction:column;gap:20px">${tier1}${tier2}${tier3}</div>`;
  }
  
  function dashboardTrend(title,data){
    const months={};
    const now=new Date();
    for(let i=5;i>=0;i--){
      const d=new Date(now.getFullYear(),now.getMonth()-i,1);
      const m=d.toISOString().slice(0,7);
      months[m]={maximum:0,total:0,count:0};
    }
    for(const item of data.items){
      if(months[item.month]) {
        const m=months[item.month];
        m.maximum=Math.max(m.maximum,item.maximum);m.total+=item.average*item.count;m.count+=item.count;
      }
    }
    const entries=Object.entries(months).sort(([a],[b])=>a.localeCompare(b));
    const max=Math.max(1,...entries.map(([,v])=>v.maximum));
    return `<div class="quality-trend" style="flex:1;background:#f9f9fb;padding:15px;border-radius:6px"><h4>${title} - ${dashboardElement.toUpperCase()} (ppm)</h4><div class="quality-chart" style="display:flex;align-items:flex-end;height:120px;gap:10px;margin-top:20px">${entries.map(([month,v])=>`<div class="quality-bar" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:5px"><b style="font-size:11px">${v.count?Number(v.maximum.toFixed(2)):'No Data'}</b><div style="width:20px;background:#eee;height:60px;position:relative"><i style="position:absolute;bottom:0;width:100%;background:var(--primary);height:${Math.max(0,100*v.maximum/max)}%" title="${month}: Max ${v.maximum} ppm; TB ${v.count?(v.total/v.count).toFixed(2):0} ppm; ${v.count} mẫu"></i></div><span style="font-size:11px">${month.slice(5)}</span></div>`).join('')}</div></div>`;
  }
