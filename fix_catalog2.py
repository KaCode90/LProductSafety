import re
with open('backend/catalog.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Add xrf module
xrf_module = "module('xrf', 'XRF', 'materials', [], 'Trang XRF chuyên sâu.', common=False)\nmodule('organization'"
content = content.replace("module('organization'", xrf_module)

# Update materials_order
content = content.replace("['bom', 'materials', 'suppliers', 'test-plan']", "['bom', 'materials', 'suppliers', 'test-plan', 'xrf']")

# Ensure Required Tests exist in materials fields
# But wait, we can just handle required tests in the frontend by saving it as JSON in the data object via a custom API or just relying on d.required_tests.

with open('backend/catalog.py', 'w', encoding='utf-8') as f:
    f.write(content)
