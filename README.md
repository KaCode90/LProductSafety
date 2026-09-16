# Product Safety

Chạy ứng dụng Python từ thư mục gốc:

```powershell
python -m pip install -r requirements.txt
python main.py
```

Ứng dụng mở tại http://localhost:8888. Có thể chạy không tự mở trình duyệt bằng `python -m uvicorn main:app --host 127.0.0.1 --port 8888`.

- `main.py`: điểm chạy FastAPI tại thư mục gốc.
- `backend/`: kết nối DB, models, script khởi tạo dữ liệu và HTML đang được Python phục vụ.
- `backend/navigation.json`: danh sách 6 menu chính, 23 submenu dùng chung cho HTML và React.
- `product-safety-ui/`: giao diện React/Vite riêng, chạy bằng `npm install` và `npm run dev` trong thư mục này.
- `frontend/`: bộ khung Sites khởi tạo trước đó, hiện không được `main.py` phục vụ.

`.env` tại thư mục gốc chứa cấu hình DB. Khởi động web không tự chạy `init_db.py` hoặc `seed_db.py`.

Xem `docs/menu-audit.md` để biết mức độ hoàn thiện thực tế. Có đủ menu không đồng nghĩa đã hoàn tất tất cả màn hình và chức năng.
