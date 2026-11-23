---
name: kumicraft-verify
description: >-
  Quy trình kiểm chứng bắt buộc cho dự án KumiCraft trước khi báo hoàn thành
  bất kỳ thay đổi code nào. Tự động chọn đúng chuỗi lệnh vitest, tsc, eslint,
  prettier, lint:deps, check:i18n, pnpm build và Playwright E2E theo vùng file
  đã sửa.
---

# KumiCraft Verification Runbook

Kích hoạt skill này **trước khi báo hoàn thành** mọi tác vụ chỉnh sửa mã nguồn trong KumiCraft. Không khẳng định "đã xong / đã pass" khi chưa có output chạy thật từ các lệnh tương ứng bên dưới.

## 1. Bảng Ánh Xạ Vùng Thay Đổi → Lệnh Bắt Buộc

| Vùng file thay đổi                                                                                          | Lệnh kiểm chứng bắt buộc                                                                 |
| :---------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------- |
| Bất kỳ file `.ts` / `.tsx` nào                                                                              | `npx prettier --write <files>` + `npx eslint <files>` + `npx vitest run <test-files>`    |
| `packages/server/src/**`                                                                                    | `npx tsc --noEmit -p packages/server` + `pnpm lint:deps`                                 |
| `packages/studio/src/**`                                                                                    | `npx tsc --noEmit -p packages/studio` + `pnpm lint:deps`                                 |
| `packages/studio/src/i18n/**` hoặc thêm/sửa key dịch                                                        | `pnpm check:i18n`                                                                        |
| `packages/shared/**`, `packages/bridge/**`, `packages/content/**`, `packages/cli/**`                        | `npx tsc --noEmit -p <package>` + `npx vitest run <package>`                             |
| `packages/server/src/runners/**`, `src/stacks/**`, `packages/bridge/**`, hoặc luồng UI Canvas/Editor/Design | `pnpm build` (cập nhật `packages/cli/dist`) + Playwright E2E liên quan với `--workers=1` |

## 2. Ánh Xạ Nhanh Tới Playwright E2E (`--workers=1`)

Luôn chạy với `--workers=1` khi chạy từ 2 file E2E trở lên (hoặc khi test có reload debounce/port server):

- Sửa Express + Pug (`stacks/runtime/express`, `stacks/view/pug`, `runners/express-pug`):
  `npx playwright test e2e/express-pug.e2e.ts --workers=1`
- Sửa ASP.NET Razor Pages / MVC (`stacks/meta/razor-pages`, `stacks/meta/mvc`, `stacks/view/razor`, `runners/dotnet-razor`, `lib/razor`):
  `npx playwright test e2e/razor.e2e.ts --workers=1`
- Sửa Next.js:
  `npx playwright test e2e/next.e2e.ts --workers=1`
- Sửa `bridge-proxy.ts` hoặc điều hướng iframe / PageSelect / DesignBar:
  Chạy ít nhất các file E2E tương ứng với stack/tính năng bị ảnh hưởng (`e2e/canvas-navigation.e2e.ts`, `e2e/route-finder.e2e.ts`, `e2e/express-pug.e2e.ts`, `e2e/razor.e2e.ts`).

## 3. Quy Tắc Bổ Sung Test Khi Thêm Tính Năng Mới

- Nếu thêm hành vi mới (parser, route reader, proxy header/cookie, UI notice): bắt buộc có unit test bao phủ trường hợp mới và edge-case.
- Nếu thêm luồng runtime/UI mới chưa có E2E bao phủ: đề xuất với người dùng viết thêm test trong `e2e/` (hoặc cập nhật `tour/`) thay vì chỉ dừng ở unit test.

## 4. Kiểm Tra Sạch Working Tree Trước Khi Kết Thúc

- Đảm bảo không để sót file tạm runtime (đặc biệt `fixtures/projects/*/.kumicraft/lock`) và không tự ý chạy `git commit` trừ khi người dùng yêu cầu rõ ràng.
