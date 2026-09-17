import re

with open('static/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = '''async function listPage(module){
  if(module==='bom') {
    const query=new URLSearchParams({...listState,size:1000});
    const result=await api('/records?module=bom&'+query);
    const materials=await api('/records?module=materials&size=1000');
    const matMap = {};
    materials.items.forEach(m => matMap[m.data.material_code] = m.data);
    
    const projects = {};
    result.items.forEach(r => {
      const p = r.data.project || 'No Project';
      const prod = r.data.parent_code || 'Unknown Product';
      const key = p + '|' + prod;
      if(!projects[key]) projects[key] = {project: p, product: prod, items: [], id: r.id};
      projects[key].items.push(r);
    });
    
    return head('BOM / Sản phẩm','Quản lý cấu trúc sản phẩm và danh sách vật liệu')+`<section class="card"><div class="table-scroll"><table><thead><tr><th>Project</th><th>Product (Mã thành phẩm)</th><th>Số NVL</th><th>Hành động</th></tr></thead><tbody>${Object.values(projects).map(p=>`<tr><td>${esc(p.project)}</td><td>${esc(p.product)}</td><td>${p.items.length}</td><td><button class="link-button" data-open="${p.id}">Xem danh sách NVL</button></td></tr>`).join('')}</tbody></table></div></section>`;
  }
  const config=catalog.modules[module];'''

content = re.sub(r'async function listPage\(module\)\{const config=catalog\.modules\[module\];', replacement, content, count=1)

with open('static/app.js', 'w', encoding='utf-8') as f:
    f.write(content)
