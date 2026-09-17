import re

with open('static/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = '''async function xrfPage(tab) {
    tab = tab || 'overview';
    const tabs = `<div class="tabs" style="margin-bottom:20px">
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
        pageHtml = `<section class="card"><div class="card-header"><h3>Thống kê XRF</h3></div><div class="card-body"><p>Tính năng Tổng quan XRF sẽ được cập nhật thêm biểu đồ chuyên sâu.</p></div></section>`;
    } else if (tab === 'trend') {
        pageHtml = await trendPage('pb', '');
    } else {
        const modMap = {'plan': 'xrf-plan', 'iqc': 'xrf-iqc', 'oqc': 'xrf-oqc', 'change': 'change-control'};
        const module = modMap[tab];
        const query=new URLSearchParams({...listState,size:20});
        const result=await api('/records?module='+module+'&'+query);
        const config=catalog.modules[module];
        const columns=config.fields.slice(0,5);
        pageHtml = `<section class="card"><div class="card-header"><div><h3>${config.title}</h3><small>${config.description}</small></div>${can(module,'Create')?`<button class="primary" id="add-record">+ Thêm mới</button>`:''}</div>${rowTable(result.items,['name','status','dri'])}</section>`;
    }
    
    return head('XRF Monitoring', 'Quản lý toàn diện đo lường XRF') + tabs + pageHtml;
}
'''

content = content.replace('async function productBomPage', replacement + '\nasync function productBomPage')

route_hook = '''if(route==='xrf') {
        html = await xrfPage(parameter);
        pageTitle = 'XRF';
        nav('xrf');
      }
      else if(route==='product-bom')'''
content = content.replace('if(route===\'product-bom\')', route_hook)

with open('static/app.js', 'w', encoding='utf-8') as f:
    f.write(content)
