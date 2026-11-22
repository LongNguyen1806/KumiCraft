# Lộ trình chuyển sang kiến trúc đích

Bước 4 (cuối) của việc dựng lại kiến trúc. Dựa trên [02-hien-trang.md](02-hien-trang.md) (đang có gì), [03-kien-truc-dich.md](03-kien-truc-dich.md) (sẽ thành gì) và [nhan-dien-du-an.md](../construction/giao-viec/nhan-dien-du-an.md) (loại dự án sẽ hỗ trợ). Chủ dự án duyệt ngày 2026-11-22.

## 1. Nguyên tắc chuyển đổi

1. **Chuyển từng bước, không viết lại cùng lúc.** Sau mỗi đợt, app chạy như cũ và toàn bộ test cũ vẫn qua. Code mới mọc dần quanh code cũ rồi thay nó (kiểu "cây đa bóp cây chủ"), không có giai đoạn nào app nằm dở dang.
2. **Đợt 0 không đổi gì người dùng thấy.** Chỉ dựng khung; người dùng chỉ thấy thay đổi từ Đợt 1.
3. **Mỗi đợt có điều kiện xong đo được**: lệnh chạy được, con số, hoặc test cụ thể; không có "xong" bằng cảm giác.
4. **Tài liệu kiến trúc cập nhật cùng commit với code** (mục 6). Không dồn lệch vào spec-log nữa.
5. **Mỗi đợt một bộ thay đổi**, chủ dự án duyệt và commit rồi mới làm đợt sau. Test dài hơn 5 phút phải hỏi trước.
6. **Không thêm tính năng mới** trong lúc làm Đợt 0, trừ sửa lỗi gấp của người dùng (đã chốt khi bắt đầu dựng kiến trúc).

## 2. Khoảng cách cần lấp (tóm tắt)

| #   | Khoảng cách (02 → 03)                                                | Lấp ở                             |
| --- | -------------------------------------------------------------------- | --------------------------------- |
| K1  | Không có máy kiểm quy tắc phụ thuộc (chỉ 2 quy tắc)                  | Đợt 0                             |
| K2  | Không có mô hình lõi (`ProjectProfile`, `TextChange`, `Capability`…) | Đợt 0                             |
| K3  | Mỗi thao tác tự ghi file                                             | Đợt 0                             |
| K4  | Adapter theo cặp, sửa code nằm ngoài adapter, `viewOnly` rải 4 chỗ   | Đợt 0                             |
| K5  | `core/project` quá rộng, 6 vòng phụ thuộc, 3 chỗ `core` → `adapters` | Đợt 0                             |
| K6  | Style hai đường                                                      | Đợt S                             |
| K7  | Studio: 36 cặp phụ thuộc hai chiều, `editor` là trung tâm            | Đợt S (phần `core/`) và dần dần   |
| K8  | Chỉ hỗ trợ Vite 7–8                                                  | Đợt 1                             |
| K9  | Chưa có Next.js, Razor, Vue                                          | Đợt 2, 3, 4                       |
| K10 | Nội dung giao diện (khối, kit) nằm trong `shared`, chỉ có JSX        | Đợt 4b (trước khi Vue chỉnh được) |
| K11 | `spec.md` không còn khớp code                                        | Mục 6, làm dần theo từng đợt      |

## 3. Đợt 0: dựng khung (người dùng không thấy thay đổi)

Làm **trọn trong một đợt** (chủ dự án, 2026-11-22), không tách duyệt từng phần. Các phần A–E dưới đây là danh sách việc của đợt; đợt xong khi mọi điều kiện "Xong khi" đều đạt.

**Kết quả (2026-11-22, spec-log #161):**

| Phần | Xong khi                                                                                          | Kết quả                                                                                                                                                                                                                                                                                                |
| ---- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A    | `pnpm lint` kiểm phụ thuộc; danh sách nợ có số; thêm import sai thì lint đỏ                       | Đạt. `pnpm lint:deps` (dependency-cruiser 18.7.2) chạy trong `pnpm lint` và hook trước commit. Nợ ban đầu: Server 0, Studio 69 cạnh vòng (`.dependency-cruiser-known-violations.json`). Thử thêm `services → stacks` thì lint đỏ, bỏ đi thì xanh                                                       |
| B    | Typecheck qua; `kernel` chỉ dùng `shared` (và `ports`)                                            | Đạt. `kernel/stacks.ts`, `features.ts`, `editing.ts`, `model.ts` (bản nháp)                                                                                                                                                                                                                            |
| C    | Không còn chỗ ghi file của thao tác sửa ngoài FileWriter; test Server qua                         | Đạt. `kernel/file-writer.ts` + 7 contract test; `architecture.test.ts` kiểm `stacks/` và `services/project/` không gọi thẳng hàm ghi của port file                                                                                                                                                     |
| D    | `FrameworkAdapter` bị xóa; hai loại dự án chạy như cũ; contract test `ViewEditor` chạy trên `jsx` | Phần lớn đạt: `FrameworkAdapter` đã xóa, thay bằng `ProjectStack` (`RuntimeAdapter` + `ViewLanguage`) và bảng tổ hợp; `viewOnly` thay bằng `Capability`; test Server qua. bộ E2E 88/88 qua (2026-11-22). **Chưa:** contract test `ViewEditor` chưa có vì `ViewEditor` mới là bản nháp (Đợt S mới dùng) |
| E    | Nợ Server = 0; test Server qua; không file nào vượt 400 dòng code thực                            | Đạt. 864/865 test Server qua (1 test vốn bị bỏ qua)                                                                                                                                                                                                                                                    |

### A. Máy kiểm phụ thuộc và danh sách nợ

- Cài `dependency-cruiser` (bản đã ra ít nhất 2 tuần), cấu hình quy tắc 6.1 và 6.2 của 03 **theo cấu trúc thư mục hiện tại**: `core` không import `adapters`; không vòng phụ thuộc giữa module Server; tính năng Studio không tạo vòng mới.
- Chạy lần đầu, ghi toàn bộ vi phạm hiện có vào file danh sách nợ.
- Gắn vào `pnpm lint` (và lefthook trước commit).
- **Xong khi:** `pnpm lint` chạy kiểm phụ thuộc; danh sách nợ có số lượng cụ thể (dự kiến: Server 6 vòng + 3 import sai; Studio 36 cặp); thêm thử một import sai thì lint đỏ, bỏ đi thì xanh.

### B. Mô hình lõi (chỉ kiểu dữ liệu)

- Thêm `kernel/` ở Server và kiểu trong `shared`: `ProjectProfile`, `SourceLoc`, `UseLoc`, `TextChange`, `Capability`, `CapabilityReason` (từ các lý do E023 hiện có), `ClassSlot`, các interface `RuntimeAdapter`, `ViewLanguage`, `ViewEditor`, `StyleSystem` (bản nháp, chưa đóng băng theo ADR-A7).
- Chưa có code nào dùng; chỉ kiểu và TSDoc.
- **Xong khi:** typecheck qua; quy tắc "`kernel` chỉ dùng `shared`" được máy kiểm và đang xanh.

### C. `FileWriter` duy nhất

- Viết `FileWriter` trong `kernel`: nhận `TextChange[]`, kiểm hash (E017 khi file đổi trên ổ đĩa), định dạng, ghi nguyên tử, hàng đợi theo file, báo `History`.
- Contract test cho `FileWriter` + `History`: ghi rồi Undo trả đúng từng byte; file bị sửa tay thì từ chối; hai thao tác chồng nhau trên một file vẫn đúng thứ tự.
- Chuyển **mọi chỗ ghi file của thao tác sửa** sang `FileWriter` (source-editor, style CSS, structure, theme…). Từng thao tác vẫn tự tính nội dung như cũ, chỉ đổi chỗ ghi.
- **Xong khi:** không còn lệnh ghi file của thao tác sửa nào nằm ngoài `FileWriter` (máy kiểm: chỉ `kernel` được gọi hàm ghi của port file cho đường sửa); toàn bộ test Server qua.

### D. Tách adapter theo trục

- Viết `RuntimeAdapter` `vite` và `express-proxy` từ phần chạy của `vite-react` / `express-pug` hiện nay.
- Viết `ViewLanguage` `jsx` bọc bộ sửa hiện có (chưa chuyển code, chỉ bọc), và `pug` không có `editor`.
- Nhận diện chạy theo thứ tự đã chốt, ra `ProjectProfile`; bảng tổ hợp có 2 dòng (`vite + jsx`, `express + pug`).
- `SupportReport` gửi cho Studio **suy ra từ `ProjectProfile`** để API không đổi (Studio chưa phải sửa).
- 4 chỗ kiểm `viewOnly` thay bằng `Capability`.
- **Xong khi:** `FrameworkAdapter` bị xóa; mở dự án Vite + React và Express + Pug cho kết quả y như trước (test Server + bộ E2E mở dự án / sửa / Undo); contract test của `ViewEditor` chạy trên `jsx`.

### E. Chia lại module Server

- Chuyển code JSX vào `stacks/view/jsx`, phần nhận diện / chạy vào `stacks/runtime/*`, phần dự án / trang / bản nháp / theme / cài đặt vào `services`; `index.ts` thành nơi ghép duy nhất.
- Sửa 3 chỗ `core` → `adapters` (dùng port).
- Gỡ 6 vòng phụ thuộc Server.
- **Xong khi:** danh sách nợ phần Server = 0; toàn bộ test Server qua; không file nào vượt 400 dòng code thực.

**Sau Đợt 0:** chạy `pnpm verify` và bộ E2E đầy đủ một lần (hỏi trước vì dài), phát hành bản vá nếu cần. Người dùng không thấy gì khác.

## 4. Các đợt sau

| Đợt     | Nội dung                                                                                                                                                                                              | Người dùng thấy                                       | Xong khi                                                                                                                                         |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **S**   | Gộp style (phương án B): package `style-tailwind` thuần; `StyleIntent` đi qua `EditService`; CSS vào `StyleSystem`. Dựng `studio/src/core` (dự án, phần tử chọn, kênh Bridge, Undo, gửi `EditIntent`) | Không đổi; style chạy như cũ                          | Studio không còn gọi `setClassName` cho style; một bộ test style chạy cho cả Tailwind và CSS; danh sách nợ Studio giảm (đo số cặp)               |
| **1**   | Vite 5, 6 (khai báo `supportedVersions` cho runtime `vite`); xem xét React 17                                                                                                                         | Mở được dự án Vite 5/6                                | Dự án mẫu Vite 5 và Vite 6 mở, chọn, sửa, Undo được (E2E)                                                                                        |
| **2**   | Next.js 16: `runtime/next` (bọc cấu hình lúc nạp, như bản thử) + `meta/next` (trang theo `app/`, `pages/`)                                                                                            | Mở và chỉnh được dự án Next.js                        | Dự án mẫu Next (App Router) chạy trên Canvas, có dấu; sửa class / chữ / chèn khối; bản Next ngoài khoảng hỗ trợ bị báo rõ                        |
| **3**   | `runtime/aspnet` (bản sao + `ShadowSync`) + `view/razor` chỉ xem; **đo độ trễ** và đặt ngân sách                                                                                                      | Mở được dự án ASP.NET Razor (chỉ xem)                 | Dự án mẫu Razor Pages hiện trên Canvas, chọn được phần tử; độ trễ sửa file gốc → Canvas có số đo; ghi ngân sách vào 03 mục 8                     |
| **4a**  | `view/vue` chỉ xem (cắm `nodeTransforms` như bản thử)                                                                                                                                                 | Mở được dự án Vue + Vite (chỉ xem)                    | Dự án mẫu Vue mở, chọn phần tử, đọc style                                                                                                        |
| **4b**  | Tách nội dung (cây trung lập + `SnippetRenderer`), rồi `editor` cho Vue qua contract test → **đóng băng interface** (ADR-A7)                                                                          | Chỉnh được dự án Vue; thư viện khối dùng được cho Vue | Contract test `ViewEditor` qua cho cả `jsx` và `vue`; ảnh chụp mọi khối thư viện trước / sau tách nội dung giống nhau; ghi "đã đóng băng" vào 03 |
| **Sau** | Django, Laravel Blade (dùng lại `shadowCopy`), Angular, webpack / CRA, Svelte, HTML thuần, theo [nhan-dien-du-an.md](../construction/giao-viec/nhan-dien-du-an.md)                                    | Thêm loại dự án                                       | Mỗi loại: dự án mẫu + contract test của trục tương ứng                                                                                           |

Thứ tự Đợt 1 – 4 giữ như đã chốt trong nhan-dien-du-an.md (Vite cũ → Next → template phía server → Vue / Angular), thêm Đợt S trước Đợt 1 vì nó dọn đường sửa chung mà mọi ngôn ngữ mới cần.

Từ Đợt 1, mỗi đợt làm **trọn một lần**, không chia thành các phần nhỏ để duyệt riêng (chủ dự án, 2026-11-22).

**Kết quả Đợt S (2026-11-22, spec-log #162):**

| Xong khi                                      | Kết quả                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Studio không còn gọi `setClassName` cho style | Đạt. Các nơi sau gửi edit `setClasses` (danh sách bước ý định, `shared/src/class-intent.ts`): Inspector (một và nhiều phần tử), kéo, đổi cỡ, dịch bằng phím, căn hàng, ô X/Y/W/H, bật / tắt khung tự do, ô gõ class, nút `group`. Server tính class bằng chính các hàm của `@kumicraft/style-tailwind` (`services/edit/class-edits.ts`), rồi ghi qua bộ sửa JSX như cũ (kiểm E017, một bước Undo). Studio chỉ còn nhắc `setClassName` ở nhãn lịch sử |
| Một bộ test style chạy cho cả Tailwind và CSS | Đạt. `stacks/style/style-systems.contract.test.ts`: 17 ca (khoảng cách, cỡ, chữ, màu, viền, độ mờ, từ khóa) chạy cho cả hai hệ trên dự án thật: ghi, đọc lại đúng giá trị, bỏ giá trị thì đọc lại trống                                                                                                                                                                                                                                              |
| Danh sách nợ Studio giảm                      | Đạt. Vòng phụ thuộc của Studio: 69 → 0; danh sách nợ (`.dependency-cruiser-known-violations.json`) rỗng. Thêm quy tắc `studio-core-not-features` và luật lint "tính năng gửi sửa qua `core/edits.ts`"                                                                                                                                                                                                                                                |

Đã làm trong đợt:

- Package `@kumicraft/style-tailwind` (từ `shared/src/tailwind`, cộng phần tính class theo màn hình chuyển từ Studio) và `@kumicraft/content` (thư viện khối). Thư viện khối phải tách ngay vì nó dùng Tailwind: để trong `shared` thì `shared` và `style-tailwind` phụ thuộc vòng. Việc đổi khối sang cây trung lập vẫn ở Đợt 4b.
- `studio/src/core`: dự án, phần tử chọn, kênh Bridge, khung Canvas, Undo, lỗi Canvas, kéo thả, `edits.ts`. Kênh Bridge không import tính năng: `main.tsx` đăng ký hàm xử lý tin nhắn (`setBridgePayloadDispatcher`); store khung Canvas gửi công cụ qua `setToolSink`.

Chưa làm, ghi lại để không quên:

- CSS vẫn đi `/style/apply` với ý định theo thuộc tính CSS; chưa gộp với Tailwind thành một `StyleSystem.plan` trong kernel. Hai đường đã có chung bộ test ở trên.
- Cài đặt người dùng vẫn ở `store/settings-store.ts` (không gây vòng nên chưa chuyển).
- Quy tắc "tính năng chỉ lộ ra qua `index.ts`" chưa áp dụng.
- Bộ E2E chưa chạy cho Đợt S (chờ chủ dự án cho chạy).

## 5. Điều kiện để kiến trúc đạt 9/10

Hai điểm bản thử chưa trả lời được (03 mục 11) trở thành điều kiện có số đo:

1. **Độ trễ Razor (Đợt 3):** đo "sửa ô Inspector → Canvas đổi" trên dự án mẫu Razor Pages. Nếu vượt xa PB-02 (500 ms) đến mức khó dùng, ghi rõ và xét lại ADR-A3 cho template phía server trước khi làm Blade / Django.
2. **Interface đứng vững với ngôn ngữ thứ hai (Đợt 4b):** `ViewEditor` qua contract test cho cả JSX và Vue mà lõi, Studio, Bridge client không phải sửa. Nếu phải sửa, sửa interface rồi mới đóng băng.

## 6. Tài liệu

- `docs/architecture/` là **nguồn sự thật về kiến trúc** từ nay.
- `spec.md`: phần kiến trúc (SPEC-01 mục 3, M-FW ở SPEC-04, ADR-BE-36) ghi "thay bằng docs/architecture" khi Đợt 0 xong. Phần API, mã lỗi, quy chuẩn code vẫn ở `spec.md` cho tới khi được chuyển.
- Mỗi bộ thay đổi đụng tới kiến trúc **sửa tài liệu trong cùng commit**. Quy tắc nào máy kiểm được thì để máy kiểm; tài liệu chỉ giải thích lý do.
- `spec-log.md` không nhận thêm "lệch kiến trúc": lệch thì sửa tài liệu hoặc sửa code, không ghi nhận để đó.

## 7. Việc ngay sau khi lộ trình được duyệt

1. Làm Đợt 0 (phần A–E) trong một lượt, kiểm theo mọi điều kiện "Xong khi".
2. Mỗi đợt sau đó: kế hoạch ngắn → làm → kiểm theo "Xong khi" → chủ dự án duyệt, commit.
