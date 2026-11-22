# 03b. Kiến trúc Next.js và thư viện khối dạng chung

Bổ sung cho [03-kien-truc-dich.md](03-kien-truc-dich.md), viết trước khi làm Đợt 2 và Đợt 3 của [04-lo-trinh.md](04-lo-trinh.md). Ngày 2026-11-22. Dựa trên code hiện có và bản thử Next 16 ([03a](03a-ket-qua-thu-danh-dau.md) mục 2).

## 0. Nguyên tắc chung (chủ dự án chốt, 2026-11-22)

1. Mọi loại dự án khi xong đều **mở, chọn phần tử, đọc style, sửa, chèn khối, Undo** được. Không có mức "chỉ xem".
2. **Không chặn theo số phiên bản.** Dự án nào cũng được mở; nếu chạy thật mà hỏng thì báo đúng lỗi thật (như "Invalid Vite module" ở Đợt 1), không báo "phiên bản không hỗ trợ". Mỗi đợt thử trên vài phiên bản phổ biến, bản nào hỏng thì sửa.
3. Test **cần và đủ**: mỗi test chứng minh một điều kiện "xong khi"; không chạy lặp, không thử tải nặng nếu không có lý do.

Hệ quả cho 03: bỏ luật "`supportedVersions`, ngoài khoảng thì báo chưa hỗ trợ" (03 mục 3.1 và bảng rủi ro mục 11). `RuntimeAdapter.supportedMajors` thêm ở Đợt 1 bị bỏ.

## 1. Next.js

### 1.1. Cái gì dùng lại, cái gì mới

| Phần                                                 | Dùng lại                                                                                                  | Mới                                                                            |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Đánh dấu phần tử (`data-rc-loc`)                     | `transformJsx` của Bridge (như plugin Vite)                                                               | Loader kiểu webpack gọi `transformJsx`, cắm vào cả Turbopack lẫn webpack       |
| Chèn script Bridge vào trang                         | Proxy của Express (`runners/bridge-proxy.ts`): chèn vào HTML trả về, chuyển tiếp WebSocket (HMR của Next) | —                                                                              |
| Sửa class, chữ, thuộc tính, chèn khối, kéo thả, Undo | Bộ sửa JSX, style, `FileWriter`, History                                                                  | —                                                                              |
| Chạy dự án                                           | Giao thức runner (`ready`, `error`)                                                                       | Runner `next-react`: chạy Next trong tiến trình con của KumiCraft              |
| Trang                                                | Màn hình trang của Studio                                                                                 | Bộ tìm trang theo file của Next (`app/`, `pages/`), thêm / đổi tên / xóa trang |

### 1.2. Chạy Next và cắm bộ đánh dấu

```
 Canvas ──► proxy (cổng runner) ──► Next dev server (cổng trong, 127.0.0.1)
             chèn script Bridge        chạy trong runner next-react
             chuyển tiếp WebSocket      loader đánh dấu: Turbopack hoặc webpack
```

- Runner nạp `next` **của dự án** (tìm từ thư mục dự án), chạy `next({ dev: true, dir })` và một máy chủ HTTP trên cổng trong; proxy đứng trước trên cổng runner.
- **Không sửa `next.config` của người dùng.** Như bản thử: khi Node nạp module cấu hình của Next (`next/dist/server/config.js`), runner bọc hàm đọc cấu hình để thêm vào cấu hình của người dùng:
  - `turbopack.rules`: `*.jsx`, `*.tsx` (và `.js` có JSX) chạy qua loader đánh dấu. Dùng khi Next chạy Turbopack (mặc định từ Next 16).
  - `webpack`: một rule `enforce: 'pre'` với cùng loader, nối sau hàm `webpack` của người dùng nếu có. Dùng khi Next chạy webpack (mặc định ở Next 14, 15).
- Thêm cả hai luôn; Next chỉ dùng cái khớp với chế độ đang chạy. Không cần biết phiên bản.
- Không bọc được (Next đổi tên file nội bộ): runner báo lỗi thật kèm tên file, ghi log; trang vẫn chạy nhưng không chọn được phần tử, Studio báo rõ.
- Loader là file CommonJS (`runners/next-loader.cjs`), vì Turbopack và webpack nạp loader bằng `require`. Nó chỉ đánh dấu file trong thư mục dự án, bỏ qua `node_modules`.
- Next tự tạo `next-env.d.ts` và có thể sửa `tsconfig.json` khi chạy lần đầu: đó là hành vi của Next, giống `npm run dev`.

### 1.3. Nhận diện dự án

- Có `next` trong dependency → bộ (stack) `next-react` = runtime `next` + ngôn ngữ `jsx`.
- Thư mục nguồn: `src/` nếu có `src/app` hoặc `src/pages`, ngược lại thư mục gốc.
- Style nhận diện như hiện nay (Tailwind, CSS, CSS Modules, Sass…), không phụ thuộc runtime.
- Không còn lý do `nextUnsupported`.

### 1.4. Trang

Trang của Next là file trong thư mục, không phải danh sách route trong code. Theo ADR-A1, cách tìm trang thuộc **bộ cấu hình sẵn** (meta-framework), nên `ProjectStack` có thêm `pages?: PagesProvider`; bộ nào không có thì dùng như cũ (runtime hoặc ngôn ngữ giao diện).

| Next         | File                                 | Đường dẫn trang                                                   |
| ------------ | ------------------------------------ | ----------------------------------------------------------------- |
| App Router   | `app/page.tsx`, `app/about/page.tsx` | `/`, `/about`                                                     |
| Nhóm route   | `app/(shop)/cart/page.tsx`           | `/cart` (bỏ phần trong ngoặc)                                     |
| Trang động   | `app/blog/[slug]/page.tsx`           | `/blog/:slug` (người dùng điền giá trị trước khi mở, như R-PG-15) |
| Pages Router | `pages/index.tsx`, `pages/about.tsx` | `/`, `/about`; bỏ `_app`, `_document`, `api/`                     |

- Thêm trang: tạo `app/<đường-dẫn>/page.tsx` (hoặc `pages/<đường-dẫn>.tsx` nếu dự án chỉ dùng Pages Router) với một component mặc định. Đổi tên: chuyển thư mục (hoặc file). Xóa: xóa thư mục (hoặc file). Tất cả qua `FileWriter`, một bước Undo.
- Không có file route để cài: Studio không đề nghị cài React Router (trạng thái router `found`, kiểu `fileSystem`).

### 1.5. Chưa làm trong đợt này

- **Trang nháp** (R-DR-12): ở Vite, plugin Bridge phục vụ trang nháp riêng. Next cần một cách khác (route ảo của proxy). Đợt này nút tạo nháp ẩn cho dự án Next, kèm lý do.
- **Kiểm build** (M-BC): chưa có cho Next.

### 1.6. Xong khi

- Dự án mẫu Next 16 (App Router, Turbopack) và Next 15 (webpack): mở trên Canvas, chọn phần tử đúng `file:dòng:cột`, sửa class, Undo đúng từng byte (E2E).
- Danh sách trang đúng cho App Router (có nhóm route và trang động) và Pages Router; thêm, đổi tên, xóa trang được, Undo được (unit test trên thư mục thật).

## 2. Thư viện khối dạng chung

### 2.1. Hiện trạng

Mỗi khối đã có hai bản, đều là **JSX tĩnh** (không vòng lặp, không sự kiện, không code):

- `jsx`: thẻ + class Tailwind, có ô theme như `bg-{primary}` (dự án Tailwind).
- `neutral`: thẻ + khóa `className="@key"`, kèm bảng CSS cho từng khóa và class Bootstrap (dự án CSS, CSS Modules, Sass, Less, Bootstrap).

Vậy phần "style chung" đã có. Thứ còn gắn với React chỉ là **cú pháp thẻ** (`className`, `htmlFor`, `<br />`, `{'…'}`).

### 2.2. Đích

```
 JSX tĩnh của khối ──parse──► cây phần tử ──render──► JSX (React, Next)
                                                    ├► HTML (Vue template, Razor, HTML thuần)
                                                    └► Pug
```

- `ElementTree`: `{ tag, attrs: [tên, giá trị][], children }` hoặc chữ. Tên thuộc tính lưu theo HTML (`class`, `for`); bộ render JSX đổi lại `className`, `htmlFor`.
- Bộ đọc (parse) là code thuần trong `@kumicraft/content` (không dùng Babel), chỉ nhận đúng tập JSX tĩnh mà khối dùng; khối nào ra ngoài tập đó thì test báo đỏ ngay.
- Mỗi ngôn ngữ có một bộ render. Razor thêm việc thoát ký tự `@` trong chữ (`@@`). Vue dùng HTML.
- Kit tương tác (modal, carousel…) là component của một framework: mỗi ngôn ngữ có bộ kit riêng, làm cùng đợt của ngôn ngữ đó.
- Đợt này **chưa đổi đường chèn khối của dự án JSX**: nó vẫn dùng chuỗi JSX như cũ. Cây được dùng từ Đợt 4 (Vue). Lý do: không đổi một đường đang chạy tốt khi chưa có người dùng cần.

### 2.3. Xong khi (test cần và đủ)

- Với **mọi khối, mọi biến thể, cả hai ngôn ngữ (vi, en), cả hai bản (`jsx`, `neutral`)**:
  1. HTML từ cây **giống hệt** HTML mà React tạo ra từ JSX gốc (`renderToStaticMarkup`): trình duyệt nhận cùng một trang, nên trông y hệt. Không cần chụp ảnh.
  2. JSX viết lại từ cây, khi React dựng ra, cho **cùng HTML** như (1): bộ render JSX không làm mất gì. (Không đòi giống từng ký tự với file gốc: xuống dòng, thụt lề không làm trang khác đi.)
  3. Pug từ cây, biên dịch bằng `pug`, ra **cùng HTML** như (1).
- Khối có kit (component React như modal) không đi qua cây; xem 2.2.
