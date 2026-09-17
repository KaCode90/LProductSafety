import re

with open('static/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the TRM summary text
content = re.sub(r'<span>T.ng h.p TRM.*?ch.a h.t h.n</b></span>', '', content)

# Remove the "Xem danh sách ->" small text
content = re.sub(r'<small>Xem danh s.ch.*?/small>', '', content)

with open('static/app.js', 'w', encoding='utf-8') as f:
    f.write(content)
