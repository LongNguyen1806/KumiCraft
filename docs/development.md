# Phát triển KumiCraft

Hướng dẫn cho người làm việc trên mã nguồn KumiCraft. Người dùng ứng dụng xem [README](../README.md).

## Yêu cầu

| Công cụ | Phiên bản                                                         |
| ------- | ----------------------------------------------------------------- |
| Node.js | 24 (xem `.node-version`), tối thiểu 22.13                         |
| pnpm    | 10.34.6 (ghim trong `packageManager`, bật bằng `corepack enable`) |
| Git     | Bản mới                                                           |

## Bắt đầu

```sh
corepack enable
pnpm install      # cài thư viện và Git hooks
pnpm dev          # chạy server và Studio ở chế độ phát triển
```

Chạy bản build như người dùng thật:

```sh
pnpm build
node packages/cli/dist/index.js <thư-mục-dự-án>
```

## Lệnh

| Lệnh                                | Việc làm                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| `pnpm dev`                          | Chạy server và Studio ở chế độ phát triển                                                   |
| `pnpm build`                        | Build mọi package                                                                           |
| `pnpm verify`                       | Kiểm tra đầy đủ trước khi commit: lint, typecheck, định dạng, i18n, unit test, trace, build |
| `pnpm test`                         | Unit test (Vitest)                                                                          |
| `pnpm test:e2e`                     | Test giao diện đầu-cuối (Playwright)                                                        |
| `pnpm test:real`                    | Test trên dự án thật, cần biến `KC_REAL_PROJECTS`                                           |
| `pnpm lint` / `pnpm typecheck`      | ESLint / TypeScript                                                                         |
| `pnpm format` / `pnpm format:check` | Định dạng code / kiểm tra định dạng                                                         |
| `pnpm check:i18n`                   | Kiểm tra khóa dịch `vi` và `en` khớp nhau                                                   |
| `pnpm bench` / `pnpm bench:ui`      | Đo hiệu năng                                                                                |
| `pnpm package`                      | Đóng gói `artifacts/kumicraft-<phiên bản>.tgz`                                              |
| `pnpm release:check`                | Kiểm tra trước khi phát hành: lỗ hổng, SBOM và giấy phép, đóng gói, kiểm gói                |

## Cấu trúc

```text
packages/
  shared/   kiểu dữ liệu và hợp đồng dùng chung
  bridge/   mã chạy trong trang trên Canvas: chọn phần tử, xem trước style
  server/   backend chạy trên máy: đọc/ghi mã nguồn, dev server, agent, HTTP API
  studio/   giao diện Studio (React)
  cli/      lệnh `kumicraft` và máy chủ MCP; gói được phát hành lên npm
templates/  mẫu dự án mới
fixtures/   dự án và backend mẫu cho test
e2e/        test Playwright
scripts/    script build, kiểm gói, SBOM
docs/       yêu cầu, đặc tả và nhật ký thi công
```

## Quy ước

- Commit theo Conventional Commits, scope là tên package (`studio`, `server`, `cli`…); tiêu đề tối đa 72 ký tự. Hook `commit-msg` kiểm tra tự động.
- Quy tắc code: [AGENTS.md](../AGENTS.md) và [docs/spec.md](spec.md).

## Phát hành

1. Tăng `version` trong `packages/cli/package.json`.
2. `pnpm release:check`
3. Thử gói vừa tạo: `npm install -g ./artifacts/kumicraft-<phiên bản>.tgz` rồi `node scripts/smoke-installed.mjs`.
4. `npm publish artifacts/kumicraft-<phiên bản>.tgz`
5. `git tag v<phiên bản>` và `git push --tags`.
