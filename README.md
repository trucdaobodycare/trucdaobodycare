Truc Dao Cosmetics - Demo (Node + Express)
==========================================

Hướng dẫn chạy (local):

1) Cài Node.js (nếu chưa có) - dùng bản LTS.
2) Mở terminal tại thư mục dự án.
3) Chạy:
   npm install
   npm start

Server mặc định chạy ở port 3002 (http://localhost:3002)

API:
- GET /api/products  -> trả về danh sách sản phẩm (data/products.json)
- POST /api/login    -> body JSON { username, password } ; đúng admin/admin -> trả token

Ghi chú:
- Thiết kế để bạn chỉ cần push lên GitHub hoặc deploy lên dịch vụ (Render/Heroku...) và chạy ngay.
