# Hướng dẫn deploy website Tân Hưng Lợi (Render + Supabase)

## 1. Tạo project Supabase (database)

1. Vào https://supabase.com → đăng ký/đăng nhập → **New project**
2. Đặt tên project (ví dụ `tanhungloi`), chọn mật khẩu database, chọn vùng gần Việt Nam (Singapore)
3. Đợi project khởi tạo xong (~2 phút)
4. Vào **Project Settings → Database → Connection string** → chọn tab **URI**, chọn chế độ **Transaction** (pooler, cổng 6543) — phù hợp cho app chạy trên Render
5. Copy chuỗi kết nối, dạng:
   ```
   postgresql://postgres.xxxxxxxx:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
   ```
   Thay `[YOUR-PASSWORD]` bằng mật khẩu bạn đã đặt ở bước 2.

## 2. Đưa code lên GitHub

```
git init
git add .
git commit -m "Website Tan Hung Loi"
```
Tạo repo mới trên https://github.com/new rồi push code lên theo hướng dẫn GitHub hiển thị.

## 3. Tạo Web Service trên Render

1. Vào https://render.com → đăng ký/đăng nhập bằng GitHub
2. **New → Web Service** → chọn repo vừa tạo
3. Cấu hình:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Vào tab **Environment**, thêm các biến:
   | Key | Value |
   |---|---|
   | `DATABASE_URL` | chuỗi kết nối Supabase ở bước 1 |
   | `SESSION_SECRET` | một chuỗi bí mật bất kỳ, ví dụ `thlgpdksjfh2026xyz` |
5. Bấm **Create Web Service** — Render tự build và chạy. Lần đầu chạy, app sẽ tự tạo bảng và seed dữ liệu mẫu vào Supabase.
6. Xong! Web chạy tại `https://ten-app.onrender.com`, đổi tài khoản admin (`admin`/`admin123`) và mật khẩu member demo ngay sau khi lên thật.

## Lưu ý quan trọng còn lại: ảnh tải lên (upload file)

Đã fix xong phần **dữ liệu** (sản phẩm, đơn hàng, tin tức...) — giờ lưu vào Supabase Postgres, không mất khi Render restart.

**Nhưng ảnh tải lên trực tiếp qua nút "Choose File"** trong trang quản trị (thêm/sửa sản phẩm, tin tức) vẫn lưu vào ổ đĩa tạm của Render (`public/uploads`) → **vẫn sẽ mất** khi app ngủ/khởi động lại.

Hai cách xử lý:
- **Cách né tạm thời**: khi thêm sản phẩm/tin tức, dùng ô "**Hoặc dán URL ảnh**" thay vì upload file — dán link ảnh có sẵn (ví dụ ảnh đã tải lên Facebook, Google Drive dạng public, hoặc ảnh có sẵn trong `/images/products/...`). Cách này không cần sửa thêm code, dùng được ngay.
- **Cách xử lý triệt để**: chuyển phần upload ảnh sang **Supabase Storage** (giống database, cũng không bị mất) — cần thêm code tích hợp. Báo tôi khi bạn muốn làm phần này.
