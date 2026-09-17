import re
with open('static/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'onclick="alert\(\'(.*?)\'\)"', r'onclick="alert(&quot;\1&quot;)"', content)

with open('static/app.js', 'w', encoding='utf-8') as f:
    f.write(content)
