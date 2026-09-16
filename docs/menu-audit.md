# Đối chiếu yêu cầu Product Safety — 15/09/2026

## Điểm chạy và các giao diện

`main.py` đã được chuyển từ `backend/` ra thư mục gốc. Import dùng `backend.DB`, `backend.models`; đường dẫn HTML được tính theo vị trí file, không phụ thuộc thư mục chạy lệnh. Không thay đổi cấu hình hoặc dữ liệu DB.

Ứng dụng Python đang phục vụ `backend/templates/index.html`, không phải bản React ở `product-safety-ui/`. Thư mục `frontend/` là bộ khung Sites riêng, chưa tích hợp vào ứng dụng. Cả HTML và React hiện dùng chung `backend/navigation.json`.

## Menu sau khi chỉnh sửa

| Menu chính | Submenu |
|---|---|
| Dashboard | Không có |
| Tuân thủ | CTS_1 – Chất hạn chế; CTS_2 – IQC / OQC; CTS_3 – VOC / SVHC; Tuyên bố tuân thủ |
| Vật liệu & Báo cáo thử nghiệm | Danh mục vật liệu; Hồ sơ nhà cung cấp; Báo cáo thử nghiệm; Tuyên bố / Declaration |
| Quản lý | Cơ cấu tổ chức & DRI; Đào tạo; Công đoạn rủi ro cao; Non-Conformity; CAPA |
| Trung tâm tài liệu | Quy trình & Tiêu chuẩn; Hồ sơ; Lưu mẫu / Lưu dữ liệu; Phụ lục |
| Cài đặt | Quản lý người dùng; Vai trò & Phân quyền; Master Data; Cài đặt thông báo; Quy định lưu trữ; Cấu hình hệ thống |

Đủ 6 menu chính, 23 submenu, tối đa 2 cấp. Đã bổ sung thu gọn sidebar cho HTML và React, đánh dấu nhóm hiện tại và khai báo đường dẫn riêng cho từng submenu React. Những trang chưa làm hiển thị thông báo rõ ràng; không nhầm đường dẫn như `/materials/suppliers` thành mã vật liệu.

## Tình trạng 15 màn hình yêu cầu

| Màn hình | HTML do Python phục vụ | React |
|---|---|---|
| Login | Chưa có | Chưa có |
| Dashboard | Một phần; KPI mẫu | Một phần; dữ liệu mẫu |
| Tổng quan Compliance | Chưa có | Có khung tổng quan, declaration còn thiếu |
| CTS_1 Detail | Chưa có | Chưa có |
| CTS_2 Detail | Chưa có | Chưa có |
| CTS_3 Detail | Chưa có | Chưa có |
| Material Master | Có danh sách đọc API DB | Có giao diện, dữ liệu mẫu |
| Material Detail | Có thông tin và danh sách hồ sơ đọc API | Có giao diện, dữ liệu mẫu |
| Test Report | Chưa có | Chưa có |
| Non-Conformity | Chưa có | Chưa có |
| CAPA | Chưa có giao diện | Có danh sách mẫu |
| CAPA Detail | Chưa có | Chưa có |
| Training | Chưa có | Chưa có |
| Document Center | Chưa có nghiệp vụ | Chỉ có điều hướng nhóm |
| Settings | Chưa có nghiệp vụ | Chỉ có điều hướng nhóm |

## Các khoảng thiếu quan trọng

- Dashboard chưa đủ tất cả KPI, công việc cần xử lý, hạn 30/60/90 ngày, training, activity log như yêu cầu; KPI HTML không lấy từ DB.
- Các trang CTS chưa có requirement, DRI, ngày review, evidence, lịch sử và audit trail.
- Material Detail chưa hoàn chỉnh toàn bộ hồ sơ material-centric, approval và lịch sử phiên bản.
- Chưa có workflow NCR/CAPA, timeline CAPA và xác minh đóng vấn đề.
- Chưa có DMS, upload/download evidence hoàn chỉnh, revision history, phân quyền và đăng nhập.
- Global Search, Quick Add, thông báo, bộ lọc và nút export/upload có nhiều phần mới là giao diện, chưa có xử lý đầy đủ.
- API hiện có các GET đọc materials, compliance theo material và CAPA; chưa có API CRUD, upload, xác thực, audit history cho toàn hệ thống.
- HTML phụ thuộc CDN React/Babel/Tailwind; React cần build riêng. Hai giao diện chưa hợp nhất thành một ứng dụng hoàn chỉnh.

Kết luận: cấu trúc menu đã được đồng bộ đúng danh sách yêu cầu; dự án chưa đáp ứng đầy đủ chức năng của Enterprise Product Safety Compliance Platform.
