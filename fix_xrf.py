import re
with open('backend/catalog.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Change xrf group to materials
content = content.replace("'xrf',fields([('project','Model')", "'materials',fields([('project','Model')")
content = content.replace("'xrf',XRF", "'materials',XRF")

# Rename suppliers to Nhà cung cấp
content = content.replace("'suppliers','Hồ sơ nhà cung cấp'", "'suppliers','Nhà cung cấp'")

with open('backend/catalog.py', 'w', encoding='utf-8') as f:
    f.write(content)
