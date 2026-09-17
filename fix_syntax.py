import re

with open('static/app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# The error is around line 96, 97. Let's find "Trend <small>"
for i, line in enumerate(lines):
    if 'Trend <small>' in line:
        print('Found at', i)
        # We need to delete this line and the following '}' line
        del lines[i:i+2]
        break

with open('static/app.js', 'w', encoding='utf-8') as f:
    f.writelines(lines)
