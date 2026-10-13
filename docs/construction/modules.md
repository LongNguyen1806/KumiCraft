# Module

Cập nhật: 2026-10-13 · Spec: phiên bản 0.18

Bảng theo mẫu SPEC-07 mục 19.6. Thư mục sở hữu của từng module: SPEC-07 mục 3.5. Mỗi bộ thay đổi thuộc đúng một module (CW-39); chủ sản phẩm xem xét rồi tự commit (CW-43 đến CW-46).

Ngoài các module, bộ thay đổi `CS-0.10-1` (Spec, SRS, báo cáo thi công trong `docs/`) đã commit ở `c0b394b`, chung commit với `CS-0.01-1` (CW-42, sai khác đã ghi ở [wp-0.01](wp/wp-0.01.md)).

| Module | Tên                          | Phase | Trạng thái   | Bộ thay đổi chờ commit | Bộ thay đổi đã commit |
| ------ | ---------------------------- | ----- | ------------ | ---------------------- | --------------------- |
| M-RP   | Repo và công cụ              | 0     | Xong (P0)    | —                      | CS-0.01-1 (`c0b394b`) |
| M-QA   | Hạ tầng kiểm thử             | 0     | Xong (P0)    | —                      | —                     |
| M-SV   | Server nền                   | 0     | Xong (P0)    | —                      | —                     |
| M-CL   | CLI                          | 0     | Xong (P0)    | —                      | —                     |
| M-ST   | Studio nền                   | 0     | Xong (P0)    | —                      | —                     |
| M-MC   | Model core                   | 1     | Xong         | —                      | —                     |
| M-TK   | Bộ token mặc định            | 1     | Xong         | —                      | —                     |
| M-SM   | Styling Map                  | 1     | Xong         | —                      | —                     |
| M-WS   | Vòng đời workspace           | 1     | Xong         | —                      | —                     |
| M-DS   | Design Store                 | 1     | Xong         | —                      | —                     |
| M-SH   | Studio Shell và màn hình     | 1     | Xong         | —                      | —                     |
| M-HS   | Undo/Redo và đồng bộ         | 1     | Xong         | —                      | —                     |
| M-CV   | Canvas Renderer              | 1     | Xong (P1)    | —                      | —                     |
| M-OV   | Overlay và chọn phần tử      | 1     | Xong (P1)    | —                      | —                     |
| M-DD   | Kéo thả                      | 1     | Chưa bắt đầu | —                      | —                     |
| M-LB   | Component Library            | 1     | Chưa bắt đầu | —                      | —                     |
| M-LT   | Layer Tree                   | 1     | Chưa bắt đầu | —                      | —                     |
| M-IN   | Inspector                    | 1     | Chưa bắt đầu | —                      | —                     |
| M-CB   | Clipboard                    | 1     | Chưa bắt đầu | —                      | —                     |
| M-KB   | Phím tắt                     | 1     | Chưa bắt đầu | —                      | —                     |
| M-PG   | Quản lý trang                | 1     | Chưa bắt đầu | —                      | —                     |
| M-TP   | Target Project Analyzer      | 2     | Chưa bắt đầu | —                      | —                     |
| M-PT   | Template project mới         | 2     | Chưa bắt đầu | —                      | —                     |
| M-CG   | Code Generator               | 2     | Chưa bắt đầu | —                      | —                     |
| M-HT   | Xuất HTML/CSS                | 2     | Chưa bắt đầu | —                      | —                     |
| M-VL   | Kiểm tra code xuất ra        | 2     | Chưa bắt đầu | —                      | —                     |
| M-EX   | Export Manager               | 2     | Chưa bắt đầu | —                      | —                     |
| M-XU   | Màn hình Export              | 2     | Chưa bắt đầu | —                      | —                     |
| M-AG   | AI Provider Gateway          | 3     | Chưa bắt đầu | —                      | —                     |
| M-AC   | AI Context Builder           | 3     | Chưa bắt đầu | —                      | —                     |
| M-AP   | Prompt và hợp đồng đầu ra    | 3     | Chưa bắt đầu | —                      | —                     |
| M-AV   | Kiểm tra và sửa đề xuất      | 3     | Chưa bắt đầu | —                      | —                     |
| M-AU   | AI Panel                     | 3     | Chưa bắt đầu | —                      | —                     |
| M-AR   | Responsive Audit             | 3     | Chưa bắt đầu | —                      | —                     |
| M-BS   | Backend Scanner              | 4     | Chưa bắt đầu | —                      | —                     |
| M-XO   | Trích xuất OpenAPI           | 4     | Chưa bắt đầu | —                      | —                     |
| M-XJ   | Trích xuất JS/TS             | 4     | Chưa bắt đầu | —                      | —                     |
| M-XP   | Trích xuất Django/DRF        | 4     | Chưa bắt đầu | —                      | —                     |
| M-XA   | Trích xuất bằng AI           | 4     | Chưa bắt đầu | —                      | —                     |
| M-DC   | Data Source Catalog          | 4     | Chưa bắt đầu | —                      | —                     |
| M-DB   | Gắn dữ liệu                  | 4     | Chưa bắt đầu | —                      | —                     |
| M-MK   | Dữ liệu mẫu                  | 4     | Chưa bắt đầu | —                      | —                     |
| M-LP   | Dữ liệu thật trong Xem thử   | 4     | Chưa bắt đầu | —                      | —                     |
| M-DL   | Sinh lớp dữ liệu             | 4     | Chưa bắt đầu | —                      | —                     |
| M-UC   | User Component               | 5     | Chưa bắt đầu | —                      | —                     |
| M-TM   | Quản lý Design Token         | 5     | Chưa bắt đầu | —                      | —                     |
| M-TI   | Nhập token từ Target Project | 5     | Chưa bắt đầu | —                      | —                     |
| M-LS   | Gợi ý tách layout dùng chung | 5     | Chưa bắt đầu | —                      | —                     |

Tổng: 48 module (6 module nền, 42 module nghiệp vụ).
