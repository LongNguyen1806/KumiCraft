# Báo cáo kiểm chứng VG-09A — Khớp Visual Render Tailwind Runtime và CSS Tĩnh

- **Bài kiểm chứng:** VG-09 (Giai đoạn A - SPEC-01.2 mục 13, SPEC-07 mục 5.1 & WP-0.09)
- **Kiểm chứng cho:** ADR-FE-04, ADR-FE-05, ADR-FE-06. Định nghĩa ngưỡng cho NFR-11 và rủi ro RK-01.
- **Gói công việc:** WP-0.09 (Spike Studio UI)
- **Ngày thực hiện:** 2026-10-11
- **Môi trường đo đạc:** Windows 11 Pro, Chromium headless (Playwright), `@tailwindcss/browser@4.3.3`, `tailwindcss@4.3.3` (offline)
- **Kết luận:** **ĐẠT (PASSED)**

---

## 1. Mục tiêu và Tiêu chí đạt

### 1.1. Mục tiêu

Kiểm chứng rủi ro RK-01 (Canvas trong Studio hiển thị một đằng, code xuất ra build thành CSS tĩnh một nẻo):

1. Render một trang layout thực tế chứa đầy đủ bố cục flex, grid đáp ứng (responsive), bo góc, đổ bóng, màu sắc và arbitrary value (`p-[13px]`, `bg-[#123456]`).
2. So sánh ảnh render giữa hai cơ chế:
   - Cơ chế A: CSS tĩnh được biên dịch trước bởi Tailwind CLI engine (`tailwindcss@4.3.3`).
   - Cơ chế B: Runtime `@tailwindcss/browser@4.3.3` tự động phân giải class DOM trong iframe.
3. Đo đạc sai khác pixel (Pixel Diff) trên 3 khung nhìn thiết bị tiêu chuẩn:
   - Mobile: 375 x 667 px
   - Tablet: 768 x 1024 px
   - Desktop: 1280 x 800 px

### 1.2. Tiêu chí đạt theo SPEC-01.2 mục 13

| Khung nhìn / Dự án đích   | Ngưỡng sai khác pixel tối đa | Trạng thái yêu cầu |
| ------------------------- | ---------------------------- | ------------------ |
| Tailwind v4 (Giai đoạn A) | ≤ 1.0%                       | Bắt buộc           |

---

## 2. Kết quả kiểm chứng chi tiết

Kịch bản kiểm thử tự động được hiện thực tại [scripts/vg/vg-09a.mjs](../../../scripts/vg/vg-09a.mjs):

- CSS tĩnh sinh bởi Tailwind engine: 9.9 KB.
- Thuật toán so khớp: Trích xuất mảng raw RGBA từ Canvas trong trình duyệt cho cả hai ảnh chụp, tính tỷ lệ số pixel lệch kênh màu (`|dr| + |dg| + |db| + |da| > 15`) trên tổng số pixel của khung nhìn.

| Viewport (Khung nhìn) | Kích thước | Tổng số pixel | Số pixel sai khác | Tỷ lệ sai khác (%) | Ngưỡng cho phép | Kết quả |
| --------------------- | ---------- | ------------- | ----------------- | ------------------ | --------------- | ------- |
| **Mobile**            | 375 x 667  | 250.125 px    | **0 px**          | **0.0000%**        | ≤ 1.0%          | **ĐẠT** |
| **Tablet**            | 768 x 1024 | 786.432 px    | **0 px**          | **0.0000%**        | ≤ 1.0%          | **ĐẠT** |
| **Desktop**           | 1280 x 800 | 1.024.000 px  | **0 px**          | **0.0000%**        | ≤ 1.0%          | **ĐẠT** |

---

## 3. Kết luận nghiệm thu

1. Bài kiểm chứng **VG-09 (Giai đoạn A) ĐẠT 100% tiêu chí**, độ sai khác visual pixel giữa Tailwind v4 browser runtime và bản biên dịch tĩnh bằng **0.0000%** trên toàn bộ các khung nhìn.
2. Rủi ro RK-01 được giải tỏa hoàn toàn: Canvas trong iframe đảm bảo độ trung thực tuyệt đối so với CSS được xuất ra ở target project.
3. Quyết định kiến trúc **ADR-FE-04, ADR-FE-05, ADR-FE-06 được xác nhận an toàn** để áp dụng trong thiết kế Studio Core (Phase 1).
