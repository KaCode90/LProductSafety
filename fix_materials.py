import re
with open('backend/catalog.py', 'r', encoding='utf-8') as f:
    content = f.read()

# I will find module('materials' and add the required_tests field.
# Currently: ('usage_status','Trạng thái sử dụng','select',['Chờ duyệt','Đang sử dụng','Ngừng sử dụng'],True)
new_field = "('usage_status','Trạng thái sử dụng','select',['Chờ duyệt','Đang sử dụng','Ngừng sử dụng'],True), ('required_tests', 'Yêu cầu kiểm nghiệm (cách nhau dấu phẩy)', 'text')"
content = content.replace("('usage_status','Trạng thái sử dụng','select',['Chờ duyệt','Đang sử dụng','Ngừng sử dụng'],True)", new_field)

with open('backend/catalog.py', 'w', encoding='utf-8') as f:
    f.write(content)
