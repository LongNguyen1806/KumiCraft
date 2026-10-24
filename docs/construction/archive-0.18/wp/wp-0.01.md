# WP-0.01 — Khởi tạo repo

- Trạng thái: Xong (phần local). Bước 1, 10 hoãn tới khi lên GitHub
- Bắt đầu: 2026-10-11 · Xong: 2026-10-11
- Module: M-RP
- Spec dẫn chiếu: SPEC-07 mục 3.5, 4.2, 4.3, 12.6; SPEC-02 mục 2, 10, 11, 12; SPEC-01.1 ADR-BE-02, ADR-BE-25, ADR-BE-27, mục 3.2, 13.3; SPEC-05 S-92, S-93 (Spec phiên bản 0.17)

## Đầu ra kiểm chứng được (từ bảng WP)

Repo có cấu hình chuẩn, `main` được bảo vệ, hook chạy. Ở chế độ local: phần "`main` được bảo vệ" hoãn tới khi lên GitHub (SPEC-07 mục 12.6.1).

## Việc đã làm

| Ngày       | Việc                                                                                                                                                       | Kết quả              |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| 2026-10-11 | Cây thư mục theo SPEC-02 mục 2.1                                                                                                                           | Xong                 |
| 2026-10-11 | Bước 2: `package.json` gốc (`packageManager: pnpm@10.34.6`, `engines.node >=22.13.0`), `.node-version` = 24                                                | Xong                 |
| 2026-10-11 | Bước 3: `pnpm-workspace.yaml` (`packages/*`, `saveExact`, `engineStrict`, `onlyBuiltDependencies: []`, `ignoredBuiltDependencies: [lefthook]`)             | Xong                 |
| 2026-10-11 | Bước 4: `.editorconfig`, `.gitattributes`, `.gitignore`, `.prettierrc.json`, `.prettierignore`                                                             | Xong                 |
| 2026-10-11 | Bước 5: `tsconfig.base.json` theo ADR-BE-02; `tsconfig.json` từng package                                                                                  | Xong                 |
| 2026-10-11 | Bước 6: `eslint.config.js` (luật phân lớp SPEC-01.1 mục 3.2, QC-03, QC-21, QC-37, QC-38, QC-40, QC-42 đến QC-44, QC-49, QC-52, QC-63)                      | Xong                 |
| 2026-10-11 | Bước 7: `lefthook.yml`, `commitlint.config.js`, `scripts/install-git-hooks.mjs` (chạy từ `prepare`)                                                        | Xong                 |
| 2026-10-11 | Bước 8: `.changeset/`                                                                                                                                      | Xong                 |
| 2026-10-11 | Bước 9: script gốc theo SPEC-02 mục 2.3; script chưa có in mã WP sẽ làm; thêm `pnpm verify` (lint + typecheck + kiểm tra định dạng) thay CI ở chế độ local | Xong                 |
| 2026-10-11 | Bước 11: ghi phiên bản ghim vào SPEC-01.1 mục 13.3                                                                                                         | Xong (Spec 0.15)     |
| 2026-10-11 | Viết lại 3 file `.github` (bản gửi trước không có trên máy), xóa `.github/_probe.txt`                                                                      | Xong                 |
| 2026-10-11 | Bật pnpm qua corepack, `pnpm install` (tạo `pnpm-lock.yaml`), `pnpm verify`, thử luật ESLint và commitlint với package thật                                | Xong, đều đạt        |
| —          | Bước 1 (repo GitHub), bước 10 (bảo vệ `main`)                                                                                                              | Hoãn: chế độ local   |
| 2026-10-11 | Chủ sản phẩm: `git init`, commit `c0b394b`, cài hook, thử commit sai định dạng                                                                             | Xong, hook chặn đúng |

## Bộ thay đổi

### CS-0.01-1 — Bộ khởi tạo repo

- Module: M-RP. Đây là ngoại lệ của CW-39: bộ khởi tạo gồm cả khung 4 package và file thuộc WP-0.02 (`.github/`), WP-0.10 (README, SECURITY, LICENSE).
- Trạng thái: **Đã commit `c0b394b`** (chung commit với `CS-0.10-1`)

| Loại                     | File                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Tạo                      | `.editorconfig`, `.gitattributes`, `.gitignore`, `.node-version`, `.prettierrc.json`, `.prettierignore`                 |
| Tạo                      | `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.js`, `commitlint.config.js`, `lefthook.yml` |
| Tạo                      | `.changeset/config.json`, `.changeset/README.md`                                                                        |
| Tạo                      | `scripts/install-git-hooks.mjs`, `scripts/not-implemented.mjs`                                                          |
| Tạo                      | `packages/model/{package.json, tsconfig.json, README.md, src/index.ts}`                                                 |
| Tạo                      | `packages/server/{package.json, tsconfig.json, README.md, src/index.ts}`                                                |
| Tạo                      | `packages/studio/{package.json, tsconfig.json, README.md, src/main.ts}`                                                 |
| Tạo                      | `packages/cli/{package.json, tsconfig.json, README.md, src/index.ts}`                                                   |
| Tạo                      | `fixtures/{target-projects,backends,designs}/.gitkeep`, `templates/.gitkeep`, `e2e/.gitkeep`                            |
| Tạo                      | `README.md`, `SECURITY.md`, `LICENSE`                                                                                   |
| Tạo                      | `.github/workflows/ci.yml`, `.github/pull_request_template.md`, `.github/dependabot.yml`                                |
| Tạo (khi `pnpm install`) | `pnpm-lock.yaml`                                                                                                        |
| Xóa                      | `.github/_probe.txt` (file thử của công cụ ghi từ xa, chưa từng commit)                                                 |

File dùng chung (CW-40): không có.

Kiểm chứng đã chạy (bên Claude):

| Kiểm tra                                       | Lệnh hoặc cách làm                                                                                                                          | Kết quả                                                                                                                                                                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JSON, YAML hợp lệ                              | `JSON.parse`, `yaml.safe_load`                                                                                                              | Đạt                                                                                                                                                                                                                              |
| Cú pháp script, file cấu hình                  | `node --check`                                                                                                                              | Đạt                                                                                                                                                                                                                              |
| Script gốc chạy không cần dependency           | `node scripts/not-implemented.mjs dev WP-0.03`; `node scripts/install-git-hooks.mjs` khi chưa có `.git`                                     | Đạt (cả trên máy chủ sản phẩm)                                                                                                                                                                                                   |
| Type check                                     | `tsc --noEmit -p packages/model`, `packages/studio` (TypeScript 6.0.3)                                                                      | Đạt. `server`, `cli` cần `@types/node`, kiểm khi `pnpm install`                                                                                                                                                                  |
| Luật ESLint (phân lớp, QC)                     | ESLint 10.1.0 với `typescript-eslint` giả lập: file thử vi phạm từng luật                                                                   | Đạt: chặn đúng `node:fs`, `react` trong model; `fastify`, `node:fs/promises`, adapters, import sâu trong server core; `null`, `.then()`, `export default`, `process.exit`, `console`. Cho phép `zod`, `nanoid`, import tương đối |
| ESLint trên file thật của repo                 | ESLint 10.1.0 + `@eslint/js` 10.1.0 và `eslint-plugin-simple-import-sort` 14.0.0 thật (mã nguồn lấy từ GitHub), `typescript-eslint` giả lập | Đạt: không lỗi trên `eslint.config.js`, `commitlint.config.js`, `scripts/`, `packages/`                                                                                                                                          |
| Prettier                                       | `prettier --check .`                                                                                                                        | Đạt                                                                                                                                                                                                                              |
| LF, không BOM                                  | `grep`                                                                                                                                      | Đạt                                                                                                                                                                                                                              |
| File trên máy khớp bản tạo                     | md5 từng file                                                                                                                               | Đạt                                                                                                                                                                                                                              |
| `pnpm install`, `pnpm verify` với package thật | —                                                                                                                                           | Thay bằng các dòng dưới (2026-10-11, chạy trên máy chủ sản phẩm)                                                                                                                                                                 |

Kiểm chứng ngày 2026-10-11, chạy bằng Claude trong VS Code trên máy chủ sản phẩm (Windows 11 Pro 10.0.26200, Node 22.19.0, pnpm 10.34.6):

| Kiểm tra                                        | Lệnh hoặc cách làm                                                                                                                        | Kết quả                                                                                                                                                                                                                                                                             |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bản pnpm khớp bản ghim (mục 4.3 bước 2)         | `corepack enable pnpm --install-directory %APPDATA%\npm`, `pnpm --version`                                                                | Đạt: `10.34.6`                                                                                                                                                                                                                                                                      |
| Cài dependency                                  | `pnpm install`                                                                                                                            | Đạt: 205 package, không lỗi, không cảnh báo build script (S-93). `prepare` báo chưa có `.git`, đúng thiết kế                                                                                                                                                                        |
| Lockfile dùng được ở CI (S-90)                  | `pnpm install --frozen-lockfile --offline`                                                                                                | Đạt                                                                                                                                                                                                                                                                                 |
| 4 package trong workspace (mục 4.3 bước 3)      | `pnpm -r ls --depth -1`                                                                                                                   | Đạt: `@kumicraft/cli`, `model`, `server`, `studio`                                                                                                                                                                                                                                  |
| Kiểm tra gộp                                    | `pnpm verify`                                                                                                                             | Đạt: ESLint không lỗi, không cảnh báo; `tsc` đạt cả 4 package (kể cả `server`, `cli` với `@types/node`); Prettier đạt                                                                                                                                                               |
| Luật ESLint với `typescript-eslint` 8.71.1 thật | Script tạm ghi file vi phạm vào `packages/model/src/`, `packages/server/src/core/`, `packages/cli/src/`, chạy ESLint API, xóa file sau đó | Đạt: chặn `node:fs`, import sâu, `enum`, `null`, interface `I…`, `.then()`, `console`, `process.exit`, `export default` trong model; `node:fs/promises`, `fastify`, adapters trong server core. Cho phép `zod`, `nanoid`, import tương đối; CLI được dùng `console`, `process.exit` |
| commitlint (mục 4.3 bước 7)                     | `pnpm exec commitlint < <file message>` (chưa có `.git` nên chưa thử được qua hook)                                                       | Đạt: chặn `Test`, `feat(model): Add Thing.`; cho qua 2 commit message trong báo cáo và dạng message của Dependabot (`build(repo): …`, `ci(repo): …`)                                                                                                                                |
| `pnpm changeset` (mục 4.3 bước 8)               | `pnpm exec changeset --version`                                                                                                           | Đạt: `3.0.3`                                                                                                                                                                                                                                                                        |
| Bảo mật dependency (S-91)                       | `pnpm audit --audit-level=high`                                                                                                           | Đạt: không có lỗ hổng                                                                                                                                                                                                                                                               |
| LF, không BOM                                   | Đếm byte CRLF, BOM của 3 file `.github` và `pnpm-lock.yaml`                                                                               | Đạt                                                                                                                                                                                                                                                                                 |

Checksum (md5): `ci.yml` `8a832e6dfe6e3fe77dbeebfb55317f58`, `pull_request_template.md` `946c0756717ddb56828c600f676bb47b`, `dependabot.yml` `28499f098ede6b4dbd2458bd5c69b5d4`, `pnpm-lock.yaml` `6f83de05e77c2934878fc1189add8827`.

Ghi chú môi trường (không thuộc repo):

- `corepack enable` vào thư mục Node (`D:\Programs\Node.js`) cần quyền admin, nên lối tắt `pnpm`, `pnpx` được đặt vào `%APPDATA%\npm` (đã có trong PATH người dùng). Gỡ: `corepack disable pnpm --install-directory %APPDATA%\npm`.
- Kho package của pnpm ở `D:\.pnpm-store` (repo và thư mục người dùng khác ổ), khoảng 75 MB.

Commit (chủ sản phẩm, 2026-10-11):

| Việc                                                                   | Kết quả                                                                                                                              |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `git init -b main`, commit                                             | `c0b394b` "CS-0.01-1, CS-0.10-1": 53 file, gộp `CS-0.01-1` và `CS-0.10-1`. Hook chưa cài lúc commit nên message không qua commitlint |
| `pnpm exec lefthook install`                                           | `sync hooks: ✔️(commit-msg, pre-commit)`                                                                                             |
| Thử commit sai định dạng: `git commit --allow-empty -m "Test"` (DW-02) | Bị chặn: `pre-commit` chạy (không có file), `commit-msg` báo `subject-empty`, `type-empty`, `scope-empty`, exit 1                    |
| Commit `afc9c0d` "Test"                                                | Commit rỗng, tạo trước khi cài hook. Không đổi file nào. Giữ lại hoặc bỏ bằng `git reset --soft HEAD~1` tùy chủ sản phẩm             |

## Sai khác so với spec

| Nội dung                                                                                        | Xử lý                                                                                      |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `prettier-plugin-tailwindcss` chưa khai báo ở file Prettier gốc                                 | Làm rõ trong Spec 0.15 (SPEC-02 mục 10.1): cấu hình riêng cho Studio ở WP-0.03             |
| Thêm dev dependency `@eslint/js`                                                                | Spec 0.15 (SPEC-02 mục 15)                                                                 |
| Plugin ESLint của Studio và luật phân lớp SPEC-01.2 mục 3.4 chưa có                             | Thêm cùng code Studio ở WP-0.03, WP-0.05                                                   |
| Không dùng `.npmrc`                                                                             | Công cụ ghi từ xa không cho ghi. Cài đặt tương đương trong `pnpm-workspace.yaml`           |
| Node tối thiểu cho phát triển là 22.13                                                          | Do ESLint 10. Spec 0.15 (SPEC-01.1 mục 13.3)                                               |
| Bước 1, 10 (GitHub) hoãn                                                                        | Chế độ local, Spec 0.17 (SPEC-07 mục 12.6)                                                 |
| Bắt đầu trước khi Spec được duyệt                                                               | Sai lệch quy trình (CW-12). Theo dõi ở progress.md                                         |
| `CS-0.01-1` và `CS-0.10-1` chung một commit, message không theo SPEC-02 mục 11.2 (CW-42, CW-45) | Chủ sản phẩm chấp nhận, không sửa lịch sử. Từ commit sau, hook `commit-msg` kiểm định dạng |

## Definition of Done (SPEC-07 mục 11.2)

- [x] DW-01 Bộ thay đổi đã được commit (chế độ local thay cho PR đã merge): `c0b394b`
- [x] DW-02 Hook chạy khi commit (`pre-commit`, `commit-msg`). Phần bảo vệ `main` hoãn
- [x] DW-03 Không có quy tắc R-xx, V-xx, S-xx cần test
- [x] DW-04 Không có ngân sách PB-xx liên quan
- [x] DW-05 Không có lỗi SEV-1, SEV-2
- [x] DW-06 Sai khác đã đưa vào Spec
- [x] DW-07 Không có chức năng cần cờ tính năng
- [x] DW-08 Đã cập nhật progress.md, modules.md

## Việc còn lại

Phần local xong. Còn lại khi lên GitHub (CW-47): bước 1 (tạo repo), bước 10 (bảo vệ `main`).
