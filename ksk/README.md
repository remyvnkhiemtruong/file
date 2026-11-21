# Cổng QR tĩnh HCMUE

`/ksk/` chạy trên GitHub Pages qua HTTPS, không dùng Apps Script, không gọi Google Sheets khi tra cứu. Chỉ nhập MSSV (có dấu chấm hoặc 10 chữ số). Kết quả hiển thị STT – họ tên, MSSV, ngày sinh và QR có nội dung giữ nguyên: `KSK|MSSV|K52_1011_C|20261110`.

## Dữ liệu và mã hóa

- Nguồn: spreadsheet `11rvrUbvA9HIjhEhs_99O95sVxoC7omdqi9QeypmvBgE`, gid `1077009534`, tab `ThongTinHanhChinh`, từ dòng 5. Chỉ lấy A (STT), B (MSSV), H (họ tên), I (ngày sinh).
- Mỗi hồ sơ được mã hóa AES-256-GCM, IV ngẫu nhiên riêng. Khóa dẫn xuất từ MSSV bằng PBKDF2-SHA256, 100.000 vòng và salt ngẫu nhiên cho mỗi lần tạo bộ dữ liệu. MSSV được gắn làm additional authenticated data.
- Chỉ mục SHA-256 của `HCMUE-KSK-v1:MSSV`. Chia thành 256 tệp theo 2 ký tự đầu để mỗi lượt chỉ tải một phần nhỏ. Trang không nhúng khóa giải mã chung.
- MSSV trùng bị loại toàn bộ, giống quy tắc chỉ nhận đúng một kết quả của Apps Script cũ. Dòng thiếu MSSV hợp lệ hoặc họ tên bị bỏ qua. Ngày sinh sai định dạng làm build thất bại để kiểm tra nguồn.
- Đây là ảnh chụp dữ liệu, không tự đồng bộ khi Sheet thay đổi. `data/manifest.json` ghi thời điểm tạo, số hồ sơ và số MSSV trùng bị loại.

MSSV là thông tin có thể đoán được. Ai biết MSSV đều có thể giải mã hồ sơ tương ứng; chỉ mục cũng có thể bị dò hàng loạt. Mã hóa này không chứng minh danh tính và không ngăn thu thập dữ liệu bằng cách thử danh sách MSSV. Giới hạn lượt thử bằng JavaScript không giải quyết được vấn đề này. Nếu cần bảo mật trước kiểu truy cập đó, phải có backend và một yếu tố xác minh bổ sung.

Không đưa CCCD, số điện thoại, dữ liệu khám, bản xuất thô hoặc khóa chung vào repo.

## Cập nhật danh sách

Tạo tệp JSON riêng ở ngoài repo có dạng `[["STT","MSSV","Họ tên","dd/MM/yyyy"], ...]`, không có hàng tiêu đề. Thực hiện:

```powershell
node scripts/build-ksk-roster.mjs C:\private\roster.json
node --test scripts/test-ksk.mjs
```

Commit `ksk/` và script rồi push theo quy trình hiện tại của repo để GitHub Pages triển khai. Build tạo thư mục generation mới và cập nhật manifest sau cùng; các generation trước được giữ để tab đang mở vẫn tải đúng bộ dữ liệu. Xóa các generation cũ khi không còn cần hỗ trợ các tab cũ.

Thư viện QR Nayuki được lưu cục bộ tại `vendor/qrcodegen.js`, có giấy phép MIT trong tệp. Không phụ thuộc CDN khi chạy.

Để xem tại máy: `python -m http.server 8000` ở thư mục gốc repo rồi mở `http://localhost:8000/ksk/`. Không mở bằng `file://` vì trang dùng fetch và Web Crypto. Node.js 22+ dùng để tạo dữ liệu và chạy kiểm thử; không cần cài npm dependencies.
