# Phase 3 — Lượt S1: Nhận diện hệ CSS, mở mọi dự án React + Vite (mức khả năng 1–2)

Đọc `README.md` cùng thư mục trước, nhất là mục **"Lỗi lint hay vấp"**, rồi làm đúng bản này.

## 0. Bối cảnh (quyết định của chủ dự án, 2026-10-23)

Chủ dự án mở một dự án React + Vite viết JSX, dùng **154 file `.css` thường**, không có Tailwind. ReactCraft từ chối mở (`noTailwind`, `noTailwindCss`). Trình duyệt hiển thị mọi loại CSS như nhau, nên Canvas cũng phải **xem được**. Chặn ở cửa là lỗi thiết kế: trộn "xem được" với "sửa kiểu dáng được".

Mô hình mới, ba mức khả năng:

| Mức                        | Điều kiện                                                     | Có gì                                                                                          |
| -------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1. Xem                     | Mọi frontend có dev server (lượt S2 làm phần không phải Vite) | Canvas, chuyển trang, khung, chọn phần tử, chat AI                                             |
| 2. Sửa cấu trúc            | React + Vite, **mọi loại CSS**                                | Biết `file:dòng`, sửa chữ, kéo thả, nhân bản, xóa, bọc, chèn component của dự án, Layers, Undo |
| 3. Sửa kiểu dáng xuất code | Hệ CSS có adapter: hiện chỉ **Tailwind 4**                    | Inspector chỉnh kiểu dáng, Brand `@theme`, công cụ vẽ, mẫu Library, khung tự do                |

Nguyên tắc chủ dự án đặt: hệ nào có adapter thì công cụ **hành xử giống hệt** Tailwind; hệ chưa có thì ẩn công cụ kiểu dáng, còn xem, sửa cấu trúc và nhờ AI. Adapter CSS thường, CSS Modules làm sau (không thuộc lượt này).

**Lượt S1** làm mức 1–2 cho mọi dự án **React + Vite**, kèm nhận diện hệ CSS và hiện nhãn cho người dùng. Không sửa `e2e/`, `docs/spec.md`.

## 1. Mục tiêu (người dùng thấy gì)

1. **Mở dự án:** dự án React + Vite (React ≥ 19, Vite ≥ 7 như hiện nay) mở được với **mọi loại CSS**. Hộp Mở dự án hiện:
   - "Được hỗ trợ · vite-react · JS";
   - dòng **"Kiểu dáng: CSS thường"** (hoặc "Tailwind 4", "CSS Modules + CSS thường", "Bootstrap 5 + CSS thường"…);
   - dòng mức: "Chỉnh kiểu dáng trực quan: có" hoặc "Chỉnh kiểu dáng trực quan: chưa hỗ trợ cho hệ này, dùng AI để đổi kiểu dáng".
2. **Thanh trạng thái** (cạnh "Đáng tin cậy"): một nhãn nhỏ `[Tailwind 4]` / `[CSS]` / `[CSS Modules]` / `[Bootstrap]`… (hệ chính). Di chuột vào hiện danh sách mọi hệ nhận diện được, kèm phiên bản, và mức chỉnh kiểu dáng.
3. **Inspector (tab Thuộc tính)** của dự án chưa có adapter:
   - đầu panel có cùng nhãn kèm câu "Chỉnh kiểu dáng trực quan chưa hỗ trợ cho CSS thường. Chọn phần tử rồi nhờ AI ở tab AI.";
   - các nhóm thuộc tính kiểu dáng (màu, khoảng cách, chữ, viền, bố cục…) **ẩn**;
   - phần **không phụ thuộc CSS vẫn còn**: đường dẫn phần tử (R-SL-14), sửa chữ, thuộc tính HTML (`href`, `alt`, `src`…), Mở trong editor.
4. **Công cụ kiểu dáng ẩn** khi chưa có adapter:
   - tab **Brand**;
   - công cụ vẽ khung/chữ/ảnh (chỉ còn công cụ Chọn);
   - khung tự do;
   - mẫu phần tử có sẵn class Tailwind trong Library.

   Component của dự án trong Library vẫn chèn được (chỉ sinh thẻ JSX, không sinh class).

5. **Trang bản nháp** (drafts) nạp **CSS toàn cục của dự án** (các file `.css` mà file vào `src/main.(jsx|tsx)` import) thay vì chỉ file Tailwind, để bản nháp trông giống trang thật.
6. **Chat AI:** lời nhắc gửi agent có thêm một dòng về hệ kiểu dáng để agent giữ đúng cách dự án đang viết. Ví dụ: "Styling: plain CSS files imported by each component (also CSS Modules). Keep using the project's styling approach; do not add Tailwind."

## 2. Đọc trước (CW-52)

| File                                                                                                                                      | Lý do                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `packages/server/src/core/project/frameworks/vite-react/detect.ts`, `frameworks/index.ts`, `frameworks/types.ts`                          | Nhận diện hiện tại: chỉ Tailwind (dep `tailwindcss` + file CSS có `@import "tailwindcss"`) |
| `packages/shared/src/project.ts`                                                                                                          | `UNSUPPORTED_REASONS`, `SupportReportSchema`, `ProjectInfo`                                |
| `packages/server/src/core/project/probe.ts`, `project-service.ts`, `theme.ts`, `server-http.ts`                                           | Nơi dùng `support.supported`, `tailwindCss`                                                |
| `packages/server/src/core/runner/runner-service.ts`, `runners/vite-react.ts`, `packages/bridge/src/integrations/vite.ts`, `draft-page.ts` | Truyền CSS cho trang bản nháp                                                              |
| `packages/server/src/core/agent/prompt.ts`, `turn-runner.ts`                                                                              | Thêm dòng hệ kiểu dáng vào lời nhắc                                                        |
| `packages/studio/src/features/project/project-dialog-probe-view.tsx`                                                                      | Hộp Mở dự án                                                                               |
| `packages/studio/src/features/editor/status-bar.tsx`, `side-panels.tsx`, `canvas-area.tsx`                                                | Thanh trạng thái, tab Brand, `tailwindMajor`                                               |
| `packages/studio/src/features/inspector/*`, `features/draw/*`, `features/free-frame/*`, `features/library/*`, `features/brand/*`          | Công cụ kiểu dáng cần ẩn                                                                   |

## 3. Hợp đồng

### 3.1. Shared (`project.ts`)

```ts
export const STYLING_SYSTEMS = [
  'tailwind',
  'css',
  'cssModules',
  'sass',
  'less',
  'bootstrap',
  'styledComponents',
  'emotion',
  'mui',
  'antd',
  'chakra',
] as const;
export const StylingSystemSchema = z.strictObject({
  id: z.enum(STYLING_SYSTEMS),
  version: z.string().max(50).optional(), // phiên bản đã cài (như versions.tailwindcss)
});
export const StylingReportSchema = z.strictObject({
  systems: z.array(StylingSystemSchema).max(20), // thứ tự: hệ chính trước
  primary: z.enum(STYLING_SYSTEMS).optional(), // hệ chính; undefined khi không thấy gì
  editable: z.boolean(), // có adapter chỉnh kiểu dáng (hiện: tailwind major 4)
  globalCss: z.array(RelPathSchema).max(20), // CSS mà file vào import (trang bản nháp nạp)
});
```

- `SupportReportSchema` thêm `styling: StylingReportSchema`.
- `UNSUPPORTED_REASONS` **giữ nguyên** danh sách để không gãy dữ liệu cũ, nhưng nhận diện **không còn sinh** `noTailwind`, `tailwindVersion`, `noTailwindCss`. Ghi chú bên cạnh enum.
- `tailwindCss` giữ: chỉ có khi có Tailwind.

### 3.2. Nhận diện (`core/project/frameworks/vite-react/styling.ts`, mới)

`detectStyling({ fs, root, sourceDir, deps, entryFile }) → StylingReport`. Dựa trên hai nguồn:

**a. `package.json` (dependencies + devDependencies), phiên bản đọc từ `node_modules` như `resolvePackageVersion`:**

| Hệ                 | Dấu hiệu                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------- |
| `tailwind`         | dep `tailwindcss` **và** có file CSS chứa `@import "tailwindcss"` (giữ `detectTailwindCss`) |
| `bootstrap`        | dep `bootstrap` hoặc `react-bootstrap`                                                      |
| `sass`             | dep `sass` / `sass-embedded`, hoặc có file `.scss`/`.sass`                                  |
| `less`             | dep `less`, hoặc có file `.less`                                                            |
| `styledComponents` | dep `styled-components`                                                                     |
| `emotion`          | dep `@emotion/react` hoặc `@emotion/styled`                                                 |
| `mui`              | dep `@mui/material`                                                                         |
| `antd`             | dep `antd`                                                                                  |
| `chakra`           | dep `@chakra-ui/react`                                                                      |

**b. Quét file trong `sourceDir`** (đệ quy, bỏ `node_modules`, `dist`, `build`, `.git`, thư mục ẩn; tối đa **3000 file**, độ sâu 12; quá thì dừng quét, dùng kết quả đã có):

- có `*.module.css` / `*.module.scss` → `cssModules`;
- có `*.css` không phải module và không phải file Tailwind → `css`.

Quy tắc khác:

- **`primary`:** `tailwind` nếu có; không thì hệ thư viện UI có trong danh sách theo thứ tự `mui`, `antd`, `chakra`, `bootstrap`, `styledComponents`, `emotion`; không thì `cssModules` nếu có; không thì `sass`, `less`, `css`. `systems` sắp hệ chính trước, các hệ khác theo thứ tự `STYLING_SYSTEMS`.
- **`editable`:** `primary === 'tailwind'` **và** Tailwind major = 4 (giữ hành vi cũ; Tailwind 3 mở được nhưng chưa chỉnh kiểu dáng).
- **`globalCss`:** đọc file vào (`src/main.tsx`, `src/main.jsx`, `src/index.tsx`, `src/index.jsx`: file đầu tiên có thật), lấy các dòng `import '…css|scss|sass|less'` tương đối (regex trên văn bản, không cần AST). Đổi thành đường dẫn tương đối với dự án, chỉ giữ file có thật. Có `tailwindCss` mà chưa nằm trong danh sách thì thêm vào đầu.

`detectViteReact`: bỏ ba lý do Tailwind khỏi `reasons`, thêm `styling`. Các lý do khác (`noVite`, `noReact`, phiên bản, `noViteConfig`…) giữ nguyên.

### 3.3. Server dùng `styling`

- `theme.ts` (GET/PATCH `/project/theme`): không có `tailwindCss` thì GET trả theme rỗng như hiện tại (kiểm hành vi đang có); PATCH trả **E021 `{ missing: 'styleAdapter' }`**. Thêm câu dịch: "Dự án này chưa hỗ trợ chỉnh kiểu dáng trực quan."
- Runner và Bridge: thay `tailwindCss` bằng **`globalCss: string[]`** cho trang bản nháp (`draftEntryCode` import từng file theo thứ tự). Bỏ hẳn trường `tailwindCss` khỏi `RunnerOptions`/plugin nếu không còn chỗ dùng, đừng để trường chết. Build lại Bridge bundle (`bridge-client.generated.ts`) nếu đổi.
- `prompt.ts`: `PromptInput` thêm `styling?: StylingReport`. Lời nhắc thêm một dòng `Styling: …` mô tả các hệ, kèm câu "Keep using the project's styling approach." Nếu không có Tailwind thì thêm "do not add Tailwind". `turn-runner` truyền `projectInfo.support.styling`.
  - Lời nhắc khi không có `styling` (dữ liệu cũ) **giống hệt** trước đây.
- Không có `editable`: server **không** chặn thao tác sửa cấu trúc (move, duplicate, remove, wrap, setText, setAttribute, chèn component). Chỉ PATCH theme bị chặn (mục trên). Các thao tác sinh class khác do Studio ẩn.

### 3.4. Studio

| File                                                 | `data-testid`                       | Nội dung                                                                                                                                          |
| ---------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/project/styling-label.ts` (mới, hàm thuần) | —                                   | `stylingLabel(report, t)`: nhãn ngắn của hệ chính ("Tailwind 4", "CSS", "CSS Modules", "Bootstrap 5", "Sass", "MUI"…) và mô tả đầy đủ cho tooltip |
| `features/editor/status-bar.tsx`                     | `styling-label`                     | Nhãn cạnh trạng thái tin cậy; `title` là mô tả đầy đủ                                                                                             |
| `features/project/project-dialog-probe-view.tsx`     | `probe-styling`, `probe-style-edit` | Hai dòng mục 1.1                                                                                                                                  |
| `features/project/use-style-edit.ts` (mới)           | —                                   | `useStyleEditable(): boolean` đọc `projectInfo.support.styling.editable` (dữ liệu cũ thiếu `styling` thì coi là `true` khi có `tailwindCss`)      |
| Inspector                                            | `inspector-style-unsupported`       | Mục 1.3: ẩn nhóm kiểu dáng, giữ phần còn lại                                                                                                      |
| `side-panels.tsx`                                    | —                                   | Ẩn tab Brand khi `!editable`; nếu tab đang lưu là `brand` thì về `properties`                                                                     |
| Draw toolbar, free-frame, Library                    | —                                   | Mục 1.4. Phím tắt của công cụ vẽ cũng không chạy khi ẩn                                                                                           |

i18n (vi, en): tên hệ, câu mức chỉnh kiểu dáng, câu E021 `styleAdapter`.

### 3.5. Spec-log (số tiếp theo sau #54)

- `#55` R-PJ (hỗ trợ dự án): bỏ điều kiện Tailwind khỏi "được hỗ trợ". Mọi dự án React + Vite mở được ở mức xem + sửa cấu trúc. Chỉnh kiểu dáng trực quan chỉ khi hệ CSS có adapter (hiện Tailwind 4). Nhận diện hệ CSS (`support.styling`) qua `package.json` và quét file `src`. Theo chủ dự án 2026-10-23 (mô hình 3 mức).

## 4. Tình huống test

Server: unit test với `FileSystemPort` thật trên thư mục tạm (như các test detect hiện có). Studio: component test.

| #   | Tình huống                                                                                                                                | Kỳ vọng                                                                                                                                                                                                                                 | Mã        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1   | Dự án Tailwind 4 mẫu hiện có                                                                                                              | `supported: true`, `styling.primary: 'tailwind'`, `editable: true`, `globalCss` có file Tailwind; các test detect cũ xanh nguyên                                                                                                        | [R-PJ-02] |
| 2   | Vite + React, không Tailwind, `src/main.jsx` import `./index.css`, có `src/components/Card.css`                                           | `supported: true`, `reasons: []`, `systems` = `[css]`, `primary: 'css'`, `editable: false`, `globalCss: ['src/index.css']`                                                                                                              | [R-PJ-02] |
| 3   | Như #2 thêm `src/a/Button.module.css`                                                                                                     | `primary: 'cssModules'`, `systems` có `cssModules` rồi `css`                                                                                                                                                                            | [R-PJ-02] |
| 4   | Dep `bootstrap` 5.3 (có `node_modules/bootstrap/package.json`), `main.jsx` import `bootstrap/dist/css/bootstrap.min.css` và `./index.css` | `primary: 'bootstrap'`, version `5.3.x`; `globalCss` chỉ có `src/index.css` (import gói không phải đường dẫn tương đối)                                                                                                                 | [R-PJ-02] |
| 5   | Dep `tailwindcss` 3.4 + file `@tailwind base;` (không có `@import "tailwindcss"`)                                                         | `supported: true` (trước đây bị từ chối), `editable: false`                                                                                                                                                                             | [R-PJ-02] |
| 6   | `src` có 5000 file `.txt` và một `.css` ở cuối cây                                                                                        | Quét dừng ở 3000, không treo; kết quả hợp lệ                                                                                                                                                                                            | [R-PJ-02] |
| 7   | Không có Vite                                                                                                                             | Vẫn `noVite` như cũ                                                                                                                                                                                                                     | [R-PJ-02] |
| 8   | PATCH `/project/theme` trên dự án CSS thường                                                                                              | 409 E021 `{ missing: 'styleAdapter' }`; không ghi file                                                                                                                                                                                  | [R-TH-01] |
| 9   | `draftEntryCode` với `globalCss: ['src/index.css', 'src/theme.css']`                                                                      | Hai dòng import đúng thứ tự trước import component                                                                                                                                                                                      | [R-DR-12] |
| 10  | Lời nhắc với `styling` CSS thường; với Tailwind; không có `styling`                                                                       | Có dòng `Styling:` + "do not add Tailwind"; có dòng Tailwind, không có "do not add Tailwind"; giống hệt trước đây                                                                                                                       | [R-AG-13] |
| 11  | Studio, dự án CSS thường                                                                                                                  | `styling-label` là "CSS", `title` có câu chưa hỗ trợ chỉnh kiểu dáng; không có tab Brand; Inspector có `inspector-style-unsupported`, không có nhóm màu/khoảng cách, vẫn có đường dẫn phần tử và sửa chữ; thanh vẽ chỉ còn công cụ Chọn | [R-PJ-02] |
| 12  | Studio, dự án Tailwind 4                                                                                                                  | `styling-label` "Tailwind 4"; mọi công cụ như trước (test cũ xanh nguyên)                                                                                                                                                               | [R-PJ-02] |
| 13  | Hộp Mở dự án probe dự án CSS Modules                                                                                                      | `probe-styling` "CSS Modules + CSS thường", `probe-style-edit` là câu chưa hỗ trợ                                                                                                                                                       | [R-PJ-02] |
| 14  | Tab đang lưu là `brand`, mở dự án CSS thường                                                                                              | Panel phải mở tab Thuộc tính                                                                                                                                                                                                            | [R-PJ-02] |

## 5. Kiểm tay (chủ dự án)

1. Mở `D:\Study\HK2\Project Techwiz 7\MarketLink-Project\frontend`: hộp hiện "Được hỗ trợ", "Kiểu dáng: CSS thường", câu chưa hỗ trợ chỉnh kiểu dáng. Tin cậy → cài dependency nếu cần.
2. Canvas hiện trang chủ MarketLink **đúng như trên Chrome**.
3. Thanh trạng thái có nhãn `[CSS]`; di chuột vào thấy mô tả.
4. Chọn một card: Inspector hiện đường dẫn phần tử và câu hướng dẫn dùng AI, không có nhóm màu. Sửa chữ trên Canvas được, Undo được.
5. Tab AI: chọn card, gửi "Đổi màu nền card này sang xanh nhạt": agent sửa file `.css` của card, không thêm Tailwind.
6. Mở lại một dự án Tailwind: mọi công cụ như cũ, nhãn `[Tailwind 4]`.

## 6. Bẫy đã biết

1. Quét file phải có giới hạn số file và độ sâu, bỏ `node_modules`; dự án lớn không được làm chậm hộp Mở dự án quá 1–2 giây.
2. Dữ liệu cũ: `ProjectInfo`/`SupportReport` đã lưu ở client hoặc test có thể thiếu `styling` → Studio phải xử lý (mục 3.4), không ném lỗi.
3. Không đổi hành vi dự án Tailwind 4. Toàn bộ test và E2E cũ phải xanh (lượt này đụng runner và Bridge: **chạy cả E2E**, `pnpm test:e2e` hoặc lệnh E2E của repo).
4. Không `null`, `as`, `any`, `!`, eslint-disable. Hàm ≤ 50 dòng, file ≤ 400 dòng. Không để code chết.
5. Màu chỉ dùng token của Studio.
6. Không lách luật lint bằng mẹo. Gặp luật cản thì đổi thiết kế hoặc dừng và báo.

## 7. Báo cáo và commit

Báo cáo:

- file tạo và sửa, kèm số dòng;
- bảng 14 tình huống → tên test;
- kết quả `pnpm verify` (số test) **và E2E**;
- chỗ nào làm khác bản này và vì sao.

Commit (đã qua commitlint):

```
feat(server): open any react vite project and detect its styling system
```
