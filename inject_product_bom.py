import re

with open('static/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# I will update the BOM list page to link to the new virtual route
replacement_list = '''async function listPage(module){
  if(module==='bom') {
    const query=new URLSearchParams({...listState,size:1000});
    const result=await api('/records?module=bom&'+query);
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
    
    window.psBomProjects = projects; // Cache for the virtual detail page
    
    return head('BOM / Sản phẩm','Quản lý cấu trúc sản phẩm và danh sách vật liệu')+`<section class="card"><div class="table-scroll"><table><thead><tr><th>Project</th><th>Product (Mã thành phẩm)</th><th>Số NVL</th><th>Hành động</th></tr></thead><tbody>${Object.keys(projects).map(k=>{
      const p = projects[k];
      return `<tr><td>${esc(p.project)}</td><td>${esc(p.product)}</td><td>${p.items.length}</td><td><button class="link-button" data-route="product-bom/${encodeURIComponent(k)}">Xem danh sách NVL</button></td></tr>`;
    }).join('')}</tbody></table></div></section>`;
  }
  const config=catalog.modules[module];'''

content = re.sub(r'async function listPage\(module\)\{.*?const config=catalog\.modules\[module\];', replacement_list, content, flags=re.DOTALL)

# Add the virtual page renderer
virtual_page = '''async function productBomPage(key) {
    if(!window.psBomProjects) { goto('bom'); return 'Loading...'; }
    const p = window.psBomProjects[key];
    if(!p) return empty('Không tìm thấy dữ liệu BOM');
    
    return head('BOM: ' + p.product, 'Project: ' + p.project, '<button data-route="bom">← Trở lại</button>') + `<section class="card"><div class="table-scroll"><table><thead><tr><th>Material Code</th><th>Material Name</th><th>Supplier</th><th>Maker</th><th>Compliance</th></tr></thead><tbody>${p.items.map(i=>{
        const m = i.mat;
        if(!m) return `<tr><td>${esc(i.bom.data.material_code)}</td><td colspan="4" class="muted">Chưa có dữ liệu NVL tương ứng trong hệ thống</td></tr>`;
        
        let req_tests = m.data.required_tests;
        if(typeof req_tests==='string') req_tests=req_tests.split(',').map(x=>x.trim()).filter(x=>x);
        if(!Array.isArray(req_tests)) req_tests=[];
        
        // Note: For full accuracy we should calculate compliance via API or fetch reports here, but we can display the basic badge from dossier_status or a generic 'Pending' if we didn't compute it.
        // But wait, we can just use m.display_status or computed_status if available. Since it's a list, we'll just show what the backend says.
        const comp = badge(m.display_status);
        
        return `<tr><td><button class="link-button" data-open="${m.id}">${esc(m.data.material_code)}</button></td><td>${esc(m.data.material_name)}</td><td>${esc(m.data.supplier)}</td><td>${esc(m.data.manufacturer)}</td><td>${comp}</td></tr>`;
    }).join('')}</tbody></table></div></section>`;
}
'''

content = content.replace('async function planningPage', virtual_page + '\n  async function planningPage')

# Hook the routing
route_hook = '''if(route==='product-bom') {
        html = await productBomPage(decodeURIComponent(parameter));
        pageTitle = 'BOM Detail';
        nav('bom');
      }
      else if(route==='dashboard')'''
content = content.replace('if(route===\'dashboard\')', route_hook)

with open('static/app.js', 'w', encoding='utf-8') as f:
    f.write(content)
