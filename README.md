# ReactCraft Local

Studio thiết kế giao diện chạy trên máy (local-first): kéo thả trên layout có cấu trúc, đọc backend để hiểu API và dữ liệu, nhờ AI chỉnh sửa từng phần tử, rồi xuất code React + TypeScript + Tailwind (hoặc HTML/CSS) vào project thật.

> Tên `reactcraft` là tên tạm (câu hỏi mở Q-01). Tên chính thức chốt trước khi phát hành.

**Trạng thái:** Phase 1 (SPEC-07 mục 5), đang làm WP-1.06. Đã dùng thử được: tạo và mở workspace, màn hình lỗi kèm khôi phục bản sao lưu, khung Editor, Undo/Redo. Chưa có: hiển thị trang trên Canvas, kéo thả, chỉnh thuộc tính, xuất code.

---

## Tài liệu

| Tài liệu                                   | Nội dung                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| [`docs/srs.md`](docs/srs.md)               | Yêu cầu phần mềm (SRS v4.0): hệ thống phải làm gì                                                 |
| [`docs/spec.md`](docs/spec.md)             | Bộ đặc tả thi công: công nghệ, quy chuẩn code, interface, module, bảo mật, quy trình thi công     |
| [`docs/construction/`](docs/construction/) | Báo cáo thi công, tách khỏi spec: tiến độ, từng gói công việc, Verification Gate, cổng nghiệm thu |

Nguyên tắc: **spec trước, code sau** (SPEC-07 CW-01). Điều gì chưa có trong spec thì bổ sung spec rồi mới code.

---

## Yêu cầu môi trường

| Công cụ      | Phiên bản                                                                |
| ------------ | ------------------------------------------------------------------------ |
| Node.js      | 24 LTS (khuyến nghị, xem `.node-version`). Tối thiểu 22.13 để phát triển |
| pnpm         | 10.34.6 (ghim trong `packageManager`)                                    |
| Git          | Bản mới bất kỳ                                                           |
| Hệ điều hành | Windows 10/11, macOS, Linux                                              |

---

## Dùng thử trên máy (chưa phát hành lên npm)

Dành cho developer dùng **Windows** hoặc **macOS** (Linux làm như macOS). Cần Node.js 22.12 trở lên và pnpm (xem [Khởi tạo lần đầu](#khởi-tạo-lần-đầu)).

**1. Đóng gói** (trong thư mục repo):

```sh
pnpm install
pnpm package        # tạo artifacts/reactcraft-cli-0.0.0.tgz
```

**2. Cài lệnh `reactcraft`** (một lần, sau đó gõ được ở mọi thư mục):

| Hệ điều hành            | Lệnh                                                  |
| ----------------------- | ----------------------------------------------------- |
| Windows (PowerShell)    | `npm install -g .\artifacts\reactcraft-cli-0.0.0.tgz` |
| macOS, Linux (Terminal) | `npm install -g ./artifacts/reactcraft-cli-0.0.0.tgz` |

Trên macOS, nếu Node cài bằng file `.pkg` từ nodejs.org thì lệnh trên có thể báo thiếu quyền (`EACCES`). Khi đó cài Node bằng Homebrew (`brew install node`) hoặc nvm, hoặc thêm `sudo` trước lệnh.

**3. Chạy** trong thư mục dự án cần thiết kế:

```sh
cd duong-dan/du-an
reactcraft
```

Trình duyệt tự mở Studio. Bấm `Ctrl+C` trong terminal để tắt; thay đổi chưa lưu được ghi nốt trước khi thoát. Lần sau chạy lại trong cùng thư mục, Studio mở đúng địa chỉ cũ và workspace còn nguyên.

| Tham số                | Việc làm                                                    |
| ---------------------- | ----------------------------------------------------------- |
| `reactcraft <thư mục>` | Mở workspace ở thư mục khác thư mục hiện tại                |
| `--no-open`            | Không tự mở trình duyệt (tự mở đường dẫn in trong terminal) |
| `--port <số>`          | Dùng cổng cố định                                           |

**Cập nhật** sau khi kéo code mới: làm lại bước 1 và 2. **Gỡ:** `npm uninstall -g @reactcraft/cli`.

### Cài thử bản đóng gói

```sh
pnpm package
pnpm check:package
npm install -g artifacts/reactcraft-cli-0.0.0.tgz
node scripts/smoke-installed.mjs
```

**Chạy nhanh không cần cài** (khi đang phát triển): `pnpm build` rồi `node packages/cli/dist/index.js <thư mục>`.

Trình duyệt: Chrome, Edge, Firefox, Safari (đều có trong test tự động). Trên macOS, phím tắt dùng `⌘` thay cho `Ctrl` (ví dụ `⌘Z` hoàn tác, `⇧⌘Z` làm lại).

---

## Khởi tạo lần đầu

Dự án đang thi công ở **chế độ local** (SPEC-07 mục 12.6): repo Git chỉ nằm trên máy, chưa đưa lên GitHub, chủ sản phẩm tự commit.

Chạy trong thư mục `reactcraft` (PowerShell hoặc Terminal):

```sh
# 1. Bật pnpm đúng phiên bản ghim.
#    Trên Windows, nếu lệnh báo thiếu quyền, mở PowerShell bằng "Run as administrator"
#    hoặc dùng: npm install -g pnpm@10.34.6
corepack enable

# 2. Khởi tạo Git với nhánh chính là main
git init -b main

# 3. Cài dependency. Lệnh này tạo pnpm-lock.yaml và cài Git hooks (lefthook)
pnpm install

# 4. Kiểm tra toàn bộ (thay cho CI khi chưa có GitHub)
pnpm verify
```

Sau đó commit theo các bộ thay đổi đang chờ trong [`docs/construction/modules.md`](docs/construction/modules.md). Lệnh commit gợi ý cho từng bộ nằm trong báo cáo gói công việc tương ứng ở `docs/construction/wp/`.

---

## Lệnh

| Lệnh                                | Việc làm                                             | Có từ   |
| ----------------------------------- | ---------------------------------------------------- | ------- |
| `pnpm verify`                       | Lint, typecheck, định dạng, i18n, test, trace, build | Bây giờ |
| `pnpm lint`                         | ESLint toàn repo                                     | Bây giờ |
| `pnpm typecheck`                    | `tsc --noEmit` cho 4 package                         | Bây giờ |
| `pnpm format` / `pnpm format:check` | Prettier: định dạng / kiểm tra định dạng             | Bây giờ |
| `pnpm changeset`                    | Thêm ghi chú thay đổi cho lần phát hành              | Bây giờ |
| `pnpm dev`                          | Chạy server và Studio                                | WP-0.03 |
| `pnpm build`                        | Build toàn bộ package                                | WP-0.03 |
| `pnpm package`                      | Đóng gói lệnh `reactcraft` thành `.tgz` để cài thử   | WP-1.06 |
| `pnpm check:i18n`                   | Kiểm tra khớp khóa `vi`/`en`                         | WP-0.05 |
| `pnpm test`, `pnpm test:e2e`        | Vitest, Playwright                                   | WP-0.06 |
| `pnpm bench`                        | Benchmark ngân sách hiệu năng                        | WP-0.06 |
| `pnpm trace`                        | Truy vết mã spec → test                              | WP-0.06 |

Lệnh chưa có in ra gói công việc sẽ làm nó và kết thúc bình thường (SPEC-07 mục 4.3, bước 9).

---

## Cấu trúc

```text
reactcraft/
├── .github/          # CI, mẫu Pull Request, Dependabot
├── .changeset/       # ghi chú thay đổi cho phát hành
├── docs/             # SRS, Spec, báo cáo thi công (docs/construction)
├── packages/
│   ├── model/        # @reactcraft/model: schema, operation, styling (dùng chung)
│   ├── server/       # @reactcraft/server: Local Backend
│   ├── studio/       # @reactcraft/studio: Studio UI
│   └── cli/          # @reactcraft/cli: lệnh reactcraft
├── templates/        # template Target Project mới
├── fixtures/         # project mẫu, backend mẫu, Design Document mẫu
├── e2e/              # test Playwright
└── scripts/          # script phát triển chạy được trên mọi hệ điều hành
```

---

## Quy trình làm việc

- Dự án chia theo **module**, mỗi module sở hữu thư mục riêng (SPEC-07 mục 3.5). Trạng thái từng module: [`docs/construction/modules.md`](docs/construction/modules.md).
- Mỗi lần giao việc là một **bộ thay đổi** (`CS-n.nn-k`) thuộc đúng một module, kèm danh sách file, kết quả kiểm tra và commit message gợi ý.
- Chủ sản phẩm xem xét bộ thay đổi theo danh sách ở SPEC-02 mục 12.3, chạy `pnpm verify`, rồi tự commit.
- Commit theo Conventional Commits, có `Refs:` ghi mã WP, module và mã spec. Hook `commit-msg` kiểm tra tự động.
- Khi đưa lên GitHub: bật CI và bảo vệ nhánh theo SPEC-07 CW-47.

## Giấy phép

[MIT](LICENSE)
