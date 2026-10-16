# SL-05: E2E tạo dự án mới từ Studio (AC-01)

Nguồn: `docs/construction/spec-log.md` dòng #5. Quy tắc: `docs/spec.md`, kịch bản kiểm thử M-PJ số 18 (tìm `| 18  | E2E: thư mục trống`), `G1-01`.

## Mục tiêu (một tiêu chí xong)

Có một E2E chạy đúng đường đi của người dùng mới, trên 3 trình duyệt:

> Thư mục trống → mở Studio → nút Project → Tạo dự án → tin cậy → Cài → Canvas hiện trang Home của mẫu (chữ **Welcome**).

Tính năng **đã có** (`no-project-screen.tsx`, `project-dialog.tsx`, `install-dialog.tsx`, server `project/create`, `project/install`). Việc này **chỉ viết test** và tách nhóm test cần mạng. Nếu test lộ ra lỗi thật của tính năng thì **dừng và báo**, không tự sửa code tính năng.

## Quyết định (đã chốt)

1. Test cài dependency thật nên **cần mạng và chậm** (1–3 phút). Gắn nhãn `@network` trong tên test (spec yêu cầu).
2. `pnpm test:e2e` mặc định **bỏ qua** test `@network` để vòng làm việc hằng ngày vẫn nhanh. Thêm lệnh riêng `pnpm test:e2e:network` chỉ chạy nhóm này. Chạy nhóm này trước khi chốt Phase 1 và trong CI.
3. Trình quản lý gói khi tạo: chọn **pnpm** (dùng kho cache chung, cài nhanh nhất). Nếu ô chọn không có pnpm thì dùng mặc định và ghi vào báo cáo.

## Đọc trước khi viết code (CW-52)

1. `AGENTS.md`, `docs/construction/giao-viec/README.md` (mục quy tắc E2E: không `waitForTimeout`, không thoát sớm bằng `if`, `expect` cuối có nghĩa).
2. `e2e/project-flow.e2e.ts`: `start()`, `open()`, `beforeEach`/`afterEach`, cách dùng `makeTempDir` và thư mục cấu hình riêng (`REACTCRAFT_CONFIG_DIR`, R-QA-02).
3. `e2e/canvas-edit.e2e.ts`: `trustIfAsked`, `getCanvasFrame` (lấy Canvas iframe).
4. `e2e/support/cli-session.ts`, `e2e/support/copy-fixture.ts`.
5. `packages/studio/src/routes/no-project-screen.tsx` (`no-project-open-btn`), `packages/studio/src/features/project/project-dialog.tsx` (`create-project-name`, `create-project-pm`, `create-project-btn`), `install-dialog.tsx` (`install-command`, `install-btn`, `install-logs`, `install-error`), `packages/studio/src/features/trust/trust-prompt.tsx`.
6. `templates/vite-react-ts-tailwind4/src/pages/Home.tsx` (heading `Welcome`).
7. `playwright.config.js`, `package.json` (script `test:e2e`).

## Hợp đồng

### 1. Cấu hình Playwright

Trong `playwright.config.js`:

- Mặc định thêm `grepInvert: /@network/`.
- Khi biến môi trường `RC_E2E_NETWORK=1`: không `grepInvert`, thay bằng `grep: /@network/`.

Trong `package.json` thêm script (giữ nguyên các script khác):

```json
"test:e2e:network": "pnpm build && cross-env RC_E2E_NETWORK=1 playwright test"
```

Nếu dự án **chưa có** `cross-env` thì **không thêm thư viện**: dùng cách đặt biến môi trường chạy được trên cả Windows và Linux mà không cần gói mới (ví dụ một file `scripts/e2e-network.ts` chạy bằng `node`, đặt `process.env.RC_E2E_NETWORK = '1'` rồi gọi Playwright qua `spawn`). Ghi lựa chọn vào báo cáo.

### 2. Test mới trong `e2e/project-flow.e2e.ts`

Tên: `a new project is created, trusted, installed and shown on the canvas [AC-01] @network`

- `test.setTimeout(300_000)` riêng cho test này.
- Dùng `folder` rỗng do `beforeEach` tạo sẵn (không copy fixture).
- Các bước, mỗi bước chờ bằng `expect(...)` của Playwright, **không** `waitForTimeout`:
  1. `start()`, mở tab Studio.
  2. Thấy màn "Chưa mở dự án nào", bấm `no-project-open-btn`.
  3. Điền `create-project-name` (ví dụ `shop`), chọn pnpm ở `create-project-pm`, bấm `create-project-btn`.
  4. Gặp hộp thoại tin cậy thì bấm "Tin cậy dự án này" (dùng lại `trustIfAsked` nếu chuyển được sang file chung `e2e/support/`; nếu chuyển thì `canvas-edit.e2e.ts` import lại từ đó, không đổi hành vi).
  5. `install-dialog` hiện, `install-command` chứa `pnpm install`; bấm `install-btn`.
  6. Chờ `install-dialog` đóng (timeout tới 240 s). Nếu `install-error` hiện thì test phải **thất bại** kèm nội dung lỗi (dùng `expect(installError).toBeHidden()` cùng lúc chờ, hoặc `Promise.race` có `expect` rõ ràng; không nuốt lỗi).
  7. Trong Canvas iframe: `getByRole('heading', { name: 'Welcome' })` hiện (timeout 60 s).
- Kiểm thêm trên đĩa sau khi xong: `folder/package.json` có tên `shop`; `folder/.reactcraft/workspace.json` tồn tại; `folder/node_modules/vite` tồn tại.

### 3. Spec-log

Gạch dòng #5, cột cuối: "Xong: E2E AC-01 gắn `@network`, chạy bằng `pnpm test:e2e:network` (SL-05)".

## Không làm

- Không sửa code trong `packages/`. Test đỏ vì lỗi tính năng → dừng, báo: bước nào, thông báo lỗi, ảnh chụp/`error-context.md`.
- Không thêm thư viện.
- Không giả lập `npm`/`pnpm` (cấm mock luồng cài, AGENTS mục 1).

## Bẫy đã biết

1. 3 trình duyệt chạy song song đều cài thật: nặng máy. Trong lệnh `test:e2e:network` đặt `--workers=1`.
2. Dự án mới nằm trong thư mục tạm; dev server tạo `node_modules/.vite`. `afterEach` hiện có đã xóa `folder` với `maxRetries`: không cần thêm.
3. Trên Windows, đóng session trước khi xóa thư mục (thứ tự trong `afterEach` hiện tại đã đúng, giữ nguyên).
4. Màn "Chưa mở dự án nào" có thể không phải nơi nút Project nằm trong `EditorToolbar`; đi theo đúng giao diện thật, ghi lại các bước thật trong báo cáo nếu khác mục 2.

## Kiểm tra trước khi báo xong

1. `pnpm exec tsc --noEmit -p e2e`
2. `pnpm test:e2e` (mặc định): số test **không đổi** so với trước (51), test `@network` không chạy.
3. `pnpm test:e2e:network`: 3 test (1 test × 3 trình duyệt) xanh. Ghi thời gian chạy.
4. Cuối cùng `pnpm verify` một lần.

## Mẫu báo cáo

1. Danh sách file tạo/sửa (đường dẫn, số dòng thêm/bớt).
2. Nguyên văn dòng tổng của `pnpm verify`, `pnpm test:e2e`, `pnpm test:e2e:network`.
3. Chỗ làm khác bản giao việc và lý do, kể cả mọi chỗ sửa ngoài phạm vi và cách đặt biến môi trường đã chọn.
4. Không commit. Không gạch mục khác trong spec-log.

## Phạm vi file

- Sửa: `e2e/project-flow.e2e.ts`, `playwright.config.js`, `package.json` (chỉ thêm script), `docs/construction/spec-log.md`.
- Được tạo nếu cần: `e2e/support/trust.ts` (chuyển `trustIfAsked`), `scripts/e2e-network.ts`; khi đó được sửa dòng import trong `e2e/canvas-edit.e2e.ts`.
- Không sửa gì khác.
