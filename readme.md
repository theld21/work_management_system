# Hệ Thống Quản Lý Công Việc (Work System Management)

## Tổng Quan
Dự án là một hệ thống quản lý công việc và chấm công toàn diện, được xây dựng với mục tiêu số hóa quy trình quản lý nhân sự, theo dõi thời gian làm việc và quản lý các yêu cầu nghỉ phép. Hệ thống bao gồm đầy đủ các tính năng cho Admin, Manager và Nhân viên.

### Công Nghệ Sử Dụng (Tech Stack)
-   **Frontend**: ReactJS (Vite), TailwindCSS, FullCalendar.
-   **Backend**: Node.js, Express.js.
-   **Database**: MongoDB.
-   **Containerization**: Docker, Docker Compose.

---

## Các Công Cụ Cần Thiết
Để vận hành và phát triển dự án, bạn cần cài đặt các công cụ sau:

1.  **Docker Desktop**: Dùng để chạy môi trường server và database.
    -   [Tải Docker Desktop](https://www.docker.com/products/docker-desktop/)
2.  **MongoDB Compass**: Giao diện trực quan để quản lý và xem dữ liệu MongoDB.
    -   [Tải MongoDB Compass](https://www.mongodb.com/products/tools/compass)

---

## Hướng Dẫn Cài Đặt & Chạy Dự Án

### 1. Khởi chạy hệ thống với Docker
Sử dụng Docker Compose để build và chạy toàn bộ hệ thống (Server + MongoDb).

```bash
docker compose up --build
```
*Lệnh này sẽ tải các image cần thiết, build server và khởi động database.*

### 2. Khởi tạo tài khoản Admin
Sau khi container server đã chạy, chạy lệnh sau để tạo tài khoản Admin mặc định:

```bash
docker compose exec server node src/utils/setupAdmin.js
```
*Tài khoản mặc định: `admin` / `123123`*

### 3. Tính toán ngày phép (Thủ công)
Hệ thống có cronjob chạy tự động, nhưng bạn có thể chạy thủ công lệnh tính ngày phép cho nhân viên:

```bash
docker compose exec server node src/utils/calculateLeaveDays.js
```

### 4. Tạo dữ liệu mẫu (Seeding Data)
Để có dữ liệu chấm công mẫu cho việc test tính năng, chạy lệnh sau:

```bash
docker compose exec server node src/utils/seedAttendance.js
```
*Lưu ý: Lệnh này sẽ tạo dữ liệu chấm công cho các nhân viên (không phải admin) từ tháng 3/2025 đến hiện tại.*

---

## Quy Trình Test Chức Năng (User Flows)

### 1. Khởi tạo dữ liệu cơ bản
1.  Đăng nhập bằng tài khoản Admin (`admin`/`123123`).
2.  **Tạo Phòng Ban (Groups)**: Vào quản lý phòng ban -> Thêm mới (Ví dụ: IT, HR, Marketing).
3.  **Tạo Nhân Viên**: Vào quản lý nhân viên -> Thêm mới user -> Gán vào phòng ban tương ứng.

### 2. Kiểm tra quy trình Nghỉ Phép (Leave Request)
1.  **Tạo Yêu Cầu**: Đăng nhập tài khoản Nhân viên -> Vào mục "Đơn từ" -> Tạo đơn xin nghỉ phép.
2.  **Duyệt Đơn (Manager)**: Đăng nhập tài khoản Manager (Trưởng phòng) -> Duyệt đơn của nhân viên thuộc phòng ban mình.
3.  **Duyệt Đơn (Admin)**: Admin có quyền duyệt tất cả đơn.

### 3. Kiểm tra Chấm Công (Attendance)
1.  Sử dụng chức năng "Điểm danh" (Check-in) và "Kết thúc" (Check-out) trên giao diện Dashboard.
2.  Kiểm tra lịch sử chấm công trong mục "Lịch làm việc".
3.  Admin có thể xem chấm công của toàn bộ nhân viên.

### 4. Kiểm tra Tin Tức (Posts)
1.  Admin đăng bài viết thông báo mới.
2.  Nhân viên nhận được thông báo và xem bài viết trên trang chủ.
