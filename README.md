# Image Proxy

Đây là một dịch vụ proxy hình ảnh được xây dựng bằng Node.js, cho phép xử lý và tối ưu hóa hình ảnh trước khi phân phối.

## Yêu cầu hệ thống

- Node.js (phiên bản 14 trở lên)
- npm hoặc yarn
- Tài khoản AWS với quyền truy cập S3

## Cài đặt

1. Clone repository:
```bash
git clone [URL_REPOSITORY]
cd image-proxy
```

2. Cài đặt các dependencies:
```bash
npm install
```

3. Tạo file `.env` trong thư mục gốc của dự án với các biến môi trường sau:
```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=your_region
S3_BUCKET_NAME=your_bucket_name
```

## Chạy ứng dụng

Để chạy ứng dụng ở chế độ development với nodemon:

```bash
npm start
```

Ứng dụng sẽ chạy ở chế độ debug và tự động reload khi có thay đổi trong code.

## Công nghệ sử dụng

- Express.js - Web framework
- AWS SDK - Tương tác với Amazon S3
- Sharp - Xử lý và tối ưu hóa hình ảnh
- Axios - HTTP client
- dotenv - Quản lý biến môi trường

## Cấu trúc dự án

```
image-proxy/
├── index.js          # Entry point của ứng dụng
├── package.json      # Quản lý dependencies
├── .env             # File cấu hình môi trường (cần tạo)
└── README.md        # Tài liệu hướng dẫn
```

## Lưu ý

- Đảm bảo file `.env` không được commit lên git repository
- Kiểm tra kỹ các quyền truy cập AWS S3 trước khi triển khai
- Nên sử dụng các biến môi trường khác nhau cho môi trường development và production

## License

ISC 