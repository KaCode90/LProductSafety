import json
with open('backend/navigation.json', 'r', encoding='utf-8') as f:
    nav = json.load(f)

# Rebuild the materials children in the exact order
from backend.catalog import catalog
cat = catalog()
mat_group = next(g for g in cat['groups'] if g['id'] == 'materials')

for n in nav:
    if n['id'] == 'materials':
        n['name'] = 'Sản phẩm & Vật liệu'
        n['children'] = []
        for item in mat_group['items']:
            # For navigation.json, href is /materials/{id}
            n['children'].append({
                'name': item['name'],
                'href': '/materials/' + item['id'] if item['id'] != 'materials' else '/materials'
            })

with open('backend/navigation.json', 'w', encoding='utf-8') as f:
    json.dump(nav, f, indent=2, ensure_ascii=False)
