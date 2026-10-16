# Phase 1, lượt 2: watcher theo dõi file (R-HI-05) và cài dependency chạy nền (R-PJ-13)

Lượt này gồm 2 phần **làm theo thứ tự A → B**. Xong phần nào chạy kiểm tra nhanh của phần đó. Một phần kẹt (sửa 3 lần vẫn đỏ, hoặc cần đổi thiết kế ngoài phạm vi) thì **dừng ở phần đó và báo**.

Đọc trước: `AGENTS.md`, `docs/construction/giao-viec/README.md`.

Quy tắc chung của cả lượt (QA lượt 1 phát hiện vi phạm, lần này bắt buộc):

1. **Không đổi điều kiện, giá trị, thông điệp** của code đang chạy ngoài việc được giao. Lượt trước đã làm hỏng bộ lọc token S-53 khi viết lại `node-process.ts`.
2. `core/` **không** import `chokidar`, `node:child_process`, `fastify` hay `adapters/` (SPEC-02 mục kiến trúc). Đi qua port trong `core/ports/`.
3. Trước khi báo xong: chạy `pnpm format` **rồi** `pnpm verify`; `pnpm verify` phải thoát mã 0 và 0 cảnh báo lint. Dán nguyên văn dòng tổng.
4. Không dùng `null`, `any`, `as unknown as`, `eslint-disable`, `@ts-ignore`.
5. Báo cáo kê **mọi** file sửa và mọi chỗ làm khác bản giao việc.

---

## Phần A: watcher (spec-log #1, #9)

Nguồn: `docs/spec.md` tìm `| R-HI-05 |`, `| R-HI-04 |`, `| V-70 |`, `ADR-BE-20`, bảng sự kiện WebSocket (dòng `project.filesChanged`, `project.changed`), `| S-84 |`, `| R-PJ-12 |`.

Hiện trạng: `history-service.ts` đã có `handleExternalChange(filePath, newHash)` (so với `lastWrittenHashes`, bỏ mục, phát sự kiện) nhưng **không ai gọi**; chưa có watcher. `chokidar` 5.0.0 đã có trong `packages/server/package.json`. Studio đã nghe `project.filesChanged` (`use-inspector-target.ts`).

### A1. Port và adapter

- `packages/server/src/core/ports/watcher-port.ts`:
  ```ts
  export type WatchHandle = { close(): Promise<void> };
  export type WatcherPort = {
    /** Calls onBatch with project-relative paths ('/' separators), batched over 300 ms (ADR-BE-20). */
    watch(root: string, onBatch: (files: readonly string[]) => void): WatchHandle;
  };
  ```
- `packages/server/src/adapters/watcher/chokidar-watcher.ts`: dùng `chokidar`, `ignoreInitial: true`, bỏ `node_modules`, `.git`, `dist`, `.reactcraft/lock`, `.reactcraft/cache`; nghe `add`, `change`, `unlink`; gom đường dẫn trong cửa sổ 300 ms (không trùng lặp), đổi sang đường tương đối với `/`.
- Nối adapter vào chỗ dựng deps trong `packages/server/src/index.ts`.

### A2. Xử lý trong core

- `handleExternalChange` của history **không** tự phát `project.filesChanged` nữa (chỉ trả `true`/`false` và vẫn phát `history.changed` khi bỏ mục). Sửa test hiện có của hàm này cho khớp, kê tên test trong báo cáo.
- File mới `packages/server/src/core/project/project-watch.ts` (dùng trong `ProjectService`):
  1. Mở dự án (`open`) xong thì bắt đầu watch gốc dự án; `close()` và mở dự án khác thì `close()` watcher cũ (R-PJ-12).
  2. Mỗi lô: với mỗi file (bỏ `.reactcraft/workspace.json`, xem mục 4): đọc nội dung qua `FileSystemPort`, tính SHA-256 (dùng lại cùng cách tính của history, không viết thuật toán thứ hai: export hàm hash hiện có nếu cần), file đã bị xóa thì hash là `''`; gọi `history.handleExternalChange(file, hash)`; gom các file trả `true`.
  3. Có file sửa từ ngoài: phát **một** `project.filesChanged` `{ files }`, tối đa 100 mục, vượt thì thêm `truncated: true` (V-70).
  4. `.reactcraft/workspace.json` đổi: đọc lại file, tính lại backends và tin cậy (khóa tin cậy có dấu vân tay backend, S-84) bằng các hàm sẵn có; cập nhật trạng thái hiện tại; phát `project.changed`; nếu `trusted` đổi thì phát thêm `session.changed`. File đọc lỗi: giữ trạng thái cũ, ghi log `warn`, không ném lỗi.
- Ghi chú: ghi của ReactCraft qua Source Editor/History đã cập nhật `lastWrittenHashes`, nên tự ghi sẽ bị bỏ qua đúng R-HI-05. Không thêm cơ chế "tạm tắt watcher".

### A3. Test phần A (gắn mã trong tên)

Unit, dùng `WatcherPort` giả (gọi `onBatch` bằng tay) và FS giả/thư mục tạm:

1. `[R-HI-05]` file có hash bằng hash ReactCraft vừa ghi → không có `project.filesChanged`, lịch sử giữ nguyên.
2. `[R-HI-05]` file đổi từ ngoài có mục lịch sử → mục bị bỏ, có `history.changed` và **một** `project.filesChanged` chứa file đó.
3. `[V-70]` một lô 150 file đổi ngoài → `files` dài 100, `truncated: true`.
4. `[S-84]` `workspace.json` đổi thêm backend khi đang tin cậy → `trusted: false`, có `project.changed` và `session.changed`.
5. `[R-PJ-12]` `close()` gọi `close()` của watcher; mở dự án khác thì watcher cũ đóng, watcher mới mở.
6. Adapter `[ADR-BE-20]` với thư mục tạm thật: ghi 3 file nhanh → một lần `onBatch` có cả 3; ghi trong `node_modules/` → không báo. Chờ bằng `vi.waitFor`, không `sleep` cố định.

E2E: test `[AC-10]` hiện có trong `e2e/canvas-edit.e2e.ts` phải vẫn xanh **không sửa** (sửa ngoài xong, Undo không ghi đè file).

Kiểm nhanh phần A: `pnpm exec vitest run packages/server`, `pnpm exec tsc --noEmit -p packages/server`.

Xong phần A: gạch dòng #1 và #9 trong `docs/construction/spec-log.md`.

---

## Phần B: cài dependency thành job (spec-log #6)

Nguồn: `docs/spec.md` mục `### 4.2. Tác vụ dài (job)` (JobStatus, V-60, V-61, V-62), dòng `/jobs/{id}` trong danh mục endpoint, bảng sự kiện (`job.*`), `| R-PJ-13 |`, `| R-PJ-22 |`, `| R-PJ-12 |`.

Hiện trạng: `POST /project/install` **chờ** cài xong rồi mới trả `202 { status: 'started' }`; Studio `install-dialog.tsx` hiện các dòng log viết cứng tiếng Anh, không có log thật, nút Hủy không hủy được cài.

### B1. Shared

`packages/shared/src/job.ts` (export qua `index.ts`): `JobKindSchema` (`'project.install' | 'agent.turn'`), `JobStatusSchema` đúng kiểu trong spec, và schema payload cho `job.progress`, `job.completed`, `job.failed`, `job.cancelled`.

**Lệch spec có chủ đích** (ghi 1 dòng mới vào spec-log): `job.progress` thêm trường tùy chọn `lines?: string[]` (tối đa 20 dòng đầu ra mới nhất) để Studio hiện log cài theo R-PJ-22; `JobStatus` thêm `lines?: string[]` cùng nghĩa cho lúc lấy lại qua `GET /jobs/{id}`.

### B2. Server

- `packages/server/src/core/jobs/job-service.ts`:
  - `start(kind, run)` → `Result<{ jobId }>`; cùng `kind` đang chạy trên dự án → E018 (V-62).
  - `get(id)` → `JobStatus` hoặc E015; `cancel(id)` → E015 nếu không có; job đã xong thì trả ok, không làm gì.
  - Giữ job đã xong 10 phút rồi xóa (V-61), dùng `SystemPort` để lấy giờ (test được bằng đồng hồ giả).
  - Phát `job.progress` (gom 200 ms, kèm `lines` tối đa 20 dòng mới nhất, `stepKey: 'jobs:install.running'`), `job.completed`, `job.failed` (`error: AppError`), `job.cancelled`.
- `install()` của `ProjectService`: giữ nguyên toàn bộ kiểm tra hiện có (E021, E011 `untrusted`, E016 `commandMismatch`) và trả lỗi **ngay** nếu sai; đúng thì tạo job `project.install` chạy `runProjectInstall` hiện có (giữ nguyên thông điệp và mã E020, E021, E028), đọc dòng đầu ra qua `onLine`, hủy bằng `kill()` → E019. Xong thành công: tính lại `needsInstall`, phát `project.changed`, khởi động dev server (như code hiện tại).
- `close()` dự án hủy job cài đang chạy (R-PJ-12).
- Route: `POST /project/install` → `202 { data: { jobId } }`; `GET /jobs/:id` → `200 JobStatus`; `POST /jobs/:id/cancel` → `202`. File route mới `packages/server/src/adapters/http/routes/jobs.ts`.

### B3. Studio

- `api/project-client.ts`: `installProject` trả `{ jobId }`; thêm `api/jobs-client.ts` với `fetchJob(id)`, `cancelJob(id)` (parse bằng schema shared, không ép kiểu).
- `install-dialog.tsx`: sau khi bấm Cài, nghe `job.progress`/`job.completed`/`job.failed`/`job.cancelled` có đúng `jobId` qua events client hiện có:
  - `install-logs` hiện tối đa 20 dòng mới nhất từ `lines` (font mono, R-PJ-22). Bỏ các chuỗi tiếng Anh viết cứng.
  - `job.completed` → gọi `onInstalled()` rồi đóng như hiện nay.
  - `job.failed` → `install-error` hiện `errorText(tError, code, params)`; với E028 hiện thêm các dòng trong `details`.
  - Nút `cancel-install-btn` khi đang cài gọi `cancelJob`; `job.cancelled` → dialog về trạng thái chưa cài, có thông báo đã hủy.
  - Khi events client mở lại kết nối (`onOpen`) mà đang có job: gọi `fetchJob` một lần để lấy lại trạng thái.
- i18n: namespace mới `jobs` (`locales/vi/jobs.json`, `locales/en/jobs.json`, đăng ký trong `i18n.ts` và `i18next.d.ts`) có khóa `install.running`, `install.cancelled`; thêm khóa cần cho dialog vào `common.json` nhóm `project.install`. `pnpm check:i18n` xanh.

### B4. Test phần B (gắn mã trong tên)

Server, `ProcessPort` giả điều khiển được (phát dòng, kết thúc với mã thoát chọn trước):

1. `[R-PJ-13]` cài thành công → `job.progress` có `lines`, rồi `job.completed`; `needsInstall` tính lại; `project.changed` được phát.
2. `[R-PJ-13]` mã thoát 1 → `job.failed` với E028, `details` là tối đa 200 dòng cuối.
3. `[R-PJ-13]` hủy → `kill()` được gọi, `job.cancelled`, `GET` trả `state: 'cancelled'`.
4. `[V-62]` gọi `install` lần hai khi đang chạy → E018.
5. `[V-61]` job xong, tiến đồng hồ giả 10 phút + 1 ms → `get` trả E015.
6. `[R-PJ-12]` `close()` khi đang cài → job bị hủy.
7. Route: `POST /project/install` trả 202 có `jobId` **trước** khi tiến trình kết thúc; `GET /jobs/<lạ>` → E015; `POST /jobs/:id/cancel` → 202.

Studio `install-dialog` (cleanup sau mỗi test, không jest-dom):

8. Nhận 25 dòng qua `job.progress` → `install-logs` có đúng 20 dòng cuối.
9. `job.failed` E028 → `install-error` chứa câu của E028 và dòng trong `details`.
10. Bấm `cancel-install-btn` khi đang cài → gọi `cancelJob(jobId)`.

E2E: không thêm test mới. Chạy `pnpm test:e2e:network` (test AC-01 đi qua luồng cài mới) phải 3 passed.

Kiểm nhanh phần B: `pnpm exec vitest run packages/server packages/studio packages/shared`, `pnpm typecheck`.

Xong phần B: gạch dòng #6 trong spec-log, thêm 1 dòng lệch về `lines` như B1.

---

## Kiểm tra cuối lượt

1. `pnpm format`, rồi `pnpm verify`: thoát mã 0, 0 cảnh báo lint.
2. `pnpm test:e2e`: 51 passed (3 trình duyệt).
3. `pnpm test:e2e:network`: 3 passed.

## Mẫu báo cáo

1. Phần nào xong, phần nào dừng (và vì sao).
2. Danh sách file tạo/sửa (đường dẫn, số dòng thêm/bớt), nhóm theo phần A/B.
3. Nguyên văn dòng tổng của `pnpm verify`, `pnpm test:e2e`, `pnpm test:e2e:network`.
4. Test cũ đã sửa (tên test, lý do).
5. Mọi chỗ làm khác bản giao việc. Không commit. Trong spec-log chỉ gạch #1, #6, #9 và thêm 1 dòng lệch.
