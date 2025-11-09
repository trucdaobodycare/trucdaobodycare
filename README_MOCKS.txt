Hướng dẫn nhanh - Mock API và sửa client
----------------------------------------
Tôi đã:
- Thêm file client-side 'public/mock-api.js' để giả lập các endpoint /api/* và các endpoint login/admin.
- Script này **intercept** window.fetch và trả về JSON giả lập (mock).
- Thêm badge "Mock API active" ở góc để bạn biết mock đang hoạt động.

Các điểm lưu ý:
- Đăng nhập mock: username=admin, password=admin → trả về token giả.
- Đây là môi trường phát triển/kiểm thử. Không dùng trong sản xuất.

Tệp đóng gói: website_with_mocks.zip
