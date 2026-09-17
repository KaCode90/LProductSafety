import json
import re

# 1. Update backend/catalog.py to only include the 4 main items in the materials group
with open('backend/catalog.py', 'r', encoding='utf-8') as f:
    content = f.read()

catalog_func = """def catalog():
    groups=[]
    materials_order = ['bom', 'materials', 'suppliers', 'test-plan']
    for key,title in GROUPS:
        items=[{'id':k,'name':v['title']} for k,v in MODULES.items() if v['group']==key]
        items += [{'id':k,'name':v} for k,v in SPECIAL.get(key,[])]
        if key=='materials':
            items = [i for i in items if i['id'] in materials_order]
            items.sort(key=lambda x: materials_order.index(x['id']))
        groups.append({'id':key,'name':title,'items':items})
    return {'modules':MODULES,'groups':groups}"""

content = re.sub(r"def catalog\(\):.*", catalog_func, content, flags=re.DOTALL)
with open('backend/catalog.py', 'w', encoding='utf-8') as f:
    f.write(content)

# 2. Update backend/navigation.json to match
with open('backend/navigation.json', 'r', encoding='utf-8') as f:
    nav = json.load(f)

for n in nav:
    if n['id'] == 'materials':
        n['children'] = [
            {"name": "BOM / Sản phẩm", "href": "/materials/bom"},
            {"name": "Danh mục NVL", "href": "/materials"},
            {"name": "Nhà cung cấp", "href": "/materials/suppliers"},
            {"name": "Kế hoạch kiểm nghiệm", "href": "/materials/test-plan"}
        ]

with open('backend/navigation.json', 'w', encoding='utf-8') as f:
    json.dump(nav, f, indent=2, ensure_ascii=False)
