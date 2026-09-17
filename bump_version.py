import re
with open('backend/templates/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'app\.js\?v=\d+', 'app.js?v=18', content)

with open('backend/templates/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
