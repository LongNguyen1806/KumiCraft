# SL-02: Hộp thoại tin cậy liệt kê gốc dự án và backend (S-80)

Nguồn: `docs/construction/spec-log.md` dòng #2. Quy tắc: `docs/spec.md`, tìm `| S-80 |`, `| R-PJ-22 |`, `| R-PJ-14 |`.

## Mục tiêu (một tiêu chí xong)

Khi mở một dự án chưa tin cậy, hộp thoại "Bạn có tin tưởng dự án này?" cho người dùng thấy **đủ thứ sẽ được chạy hoặc đọc**:

1. Tên dự án (đã có) và **đường dẫn gốc dự án**.
2. **Danh sách backend đã liên kết**, mỗi backend: nhãn, **đường dẫn tuyệt đối** (không phải đường dẫn tương đối kiểu `../api` lưu trong `workspace.json`), trạng thái nếu không phải `ok`.
3. **Cảnh báo** cạnh backend nằm **ngoài thư mục cha** của dự án (ví dụ dự án `D:/work/shop`, backend `C:/Users/me/secret-api`).
4. Không có backend thì ghi "Không có backend liên kết".

Hiện tại hộp thoại chỉ nêu tên dự án (`packages/studio/src/features/trust/trust-prompt.tsx`).

## Quyết định thiết kế (đã chốt, không đổi)

Studio **không** tự tính đường dẫn. Server đã có `resolveBackendPath`, `parentPath`, `isInside` (`packages/server/src/core/shared/paths.ts`), nên server trả thêm 2 trường trong `BackendInfo`:

```ts
// packages/shared/src/project.ts
export const BackendInfoSchema = BackendLinkSchema.extend({
  status: BackendStatusSchema,
  /** Absolute path after resolving the stored path against the project root (S-80). */
  resolvedPath: z.string().min(1).max(1024),
  /** True when the backend is not inside the parent folder of the project (S-80). */
  outsideParent: z.boolean(),
});
```

Không giải symlink (giống `checkBlockedPath` hiện nay). Ghi chỗ thêm trường này vào `spec-log.md` thành **một dòng mới** (số kế tiếp, cột "Lệch": "`BackendInfo` thêm `resolvedPath`, `outsideParent` cho hộp thoại tin cậy; không giải symlink", cột cuối: "Đã làm theo, cập nhật spec ở đợt sửa spec").

## Đọc trước khi viết code (CW-52)

1. `AGENTS.md`, `docs/construction/giao-viec/README.md`.
2. `packages/shared/src/project.ts` (`BackendInfoSchema`, `ProjectInfoSchema`), `packages/shared/src/workspace-file.ts` (`BackendLinkSchema`).
3. `packages/server/src/core/project/project-service.ts`: `computeBackendInfos` và mọi chỗ khác tạo `BackendInfo` (thêm/gỡ backend, khoảng dòng 280–330). Tìm bằng `grep -rn "status: '" packages/server/src/core/project`.
4. `packages/server/src/core/shared/paths.ts`: `resolveBackendPath`, `parentPath`, `isInside`.
5. `packages/server/src/core/project/project-service.test.ts`: các test backend `[V-03]`, `[V-04]`, `[V-05]`.
6. `packages/studio/src/features/trust/trust-prompt.tsx` và `trust-prompt.test.tsx`.
7. `packages/studio/src/features/editor/editor-shell.tsx`: `EditorShell`, `useProjectLoader` (đã gọi `fetchProject()` cả khi chưa tin cậy, theo S-81), chỗ render `<TrustPrompt …/>`.
8. `packages/studio/src/features/project/backends-view.tsx`: chỉ để biết chỗ khác dùng `BackendInfo`; sửa nếu typecheck đòi.
9. Locale `vi`/`en` `common.json`, nhóm `trust`.

## Hợp đồng

### 1. Server

Trong `computeBackendInfos` (và mọi chỗ khác dựng `BackendInfo`, nên gom vào một hàm `toBackendInfo(root, link, platform, homeDir)` dùng chung):

1. `resolvedPath = resolveBackendPath(root, link.path)`.
2. `parent = parentPath(root)`; `outsideParent = parent === undefined ? !isInside(root, resolvedPath, platform) : !isInside(parent, resolvedPath, platform)`.
3. `status` giữ nguyên cách tính hiện tại.

Không đổi `workspace.json` (vẫn chỉ lưu `id`, `path`, `label`).

### 2. Studio

`TrustPrompt` nhận thêm `projectRoot?: string` và `backends?: readonly BackendInfo[]` (khi `projectInfo` chưa tải xong thì `undefined`: hiện "Đang tải…", không hiện danh sách rỗng giả). `EditorShell` truyền `loader.projectInfo?.root` và `loader.projectInfo?.backends`. Không gọi API mới.

Trong `TrustDialog`, ngay dưới khối tên dự án:

| Khối                   | `data-testid`           | Nội dung                                                                                          |
| ---------------------- | ----------------------- | ------------------------------------------------------------------------------------------------- |
| Gốc dự án              | `trust-root`            | `projectRoot`, font mono, `break-all`                                                             |
| Danh sách backend      | `trust-backends`        | `<ul>`; mỗi mục `<li data-testid="trust-backend">`: nhãn, rồi `resolvedPath` (mono, `break-all`)  |
| Cảnh báo ngoài thư mục | `trust-backend-outside` | Trong `<li>` khi `outsideParent`: chữ `t('trust.backendOutside')`, màu cảnh báo, có `role="note"` |
| Trạng thái             | `trust-backend-status`  | Khi `status !== 'ok'`: `t('trust.backendStatus.missing')` hoặc `t('trust.backendStatus.blocked')` |
| Không có backend       | `trust-no-backends`     | `t('trust.noBackends')`                                                                           |
| Đang tải               | `trust-loading`         | `t('trust.loading')` khi `backends === undefined`                                                 |

Hộp thoại có thể dài: phần thân cuộn được (`max-h-[60vh] overflow-y-auto` hoặc tương đương theo `Dialog`), nút Tin cậy/Để sau luôn thấy.

### 3. Khóa i18n mới (cả `vi` và `en`, nhóm `trust`)

| Khóa                          | vi                                                   | en                                                         |
| ----------------------------- | ---------------------------------------------------- | ---------------------------------------------------------- |
| `trust.root`                  | Thư mục gốc                                          | Root folder                                                |
| `trust.backends`              | Backend liên kết (agent AI được đọc bản sao chỉ đọc) | Linked backends (the AI agent reads a read-only copy)      |
| `trust.noBackends`            | Không có backend liên kết                            | No linked backends                                         |
| `trust.backendOutside`        | Nằm ngoài thư mục chứa dự án, hãy kiểm tra kỹ        | Outside the folder that holds the project, check carefully |
| `trust.backendStatus.missing` | Không tìm thấy thư mục                               | Folder not found                                           |
| `trust.backendStatus.blocked` | Bị chặn vì là thư mục hệ thống hoặc nhạy cảm         | Blocked: system or sensitive folder                        |
| `trust.loading`               | Đang tải thông tin dự án…                            | Loading project details…                                   |

## Test bắt buộc (Gemini viết, gắn mã trong tên)

Tổng ≤ 12 test, mỗi test có `expect` thật.

**Server, `project-service.test.ts`** (thêm 3 test, dùng lại cách dựng của test `[V-03]`, `[V-04]`):

1. `[S-80]` backend anh em `../api` của dự án `…/work/shop` → `resolvedPath` là đường tuyệt đối `…/work/api`, `outsideParent: false`.
2. `[S-80]` backend tuyệt đối ở thư mục khác hẳn (như test `[V-04]`) → `outsideParent: true`, `resolvedPath` đúng đường đó.
3. `[S-80]` sau khi **thêm** một backend qua service, `BackendInfo` trả về cũng có `resolvedPath` và `outsideParent` đúng (bảo đảm mọi chỗ dựng `BackendInfo` dùng chung hàm).

**Shared**: nếu `packages/shared` có test schema cho `ProjectInfo`/`BackendInfo`, cập nhật dữ liệu mẫu cho khớp (không nới schema).

**Studio, `trust-prompt.test.tsx`** (thêm 5 test, dùng `cleanup`, không có jest-dom):

4. `[S-80]` có `projectRoot` → `trust-root` chứa đúng đường dẫn.
5. `[S-80]` 2 backend → 2 `trust-backend`, mỗi mục chứa `resolvedPath`, không chứa `path` tương đối `../api`.
6. `[S-80]` backend `outsideParent: true` → mục đó có `trust-backend-outside`; mục còn lại không có.
7. `[S-80]` `backends = []` → có `trust-no-backends`; `backends` là `undefined` → có `trust-loading`, không có `trust-no-backends`.
8. `[S-80]` backend `status: 'blocked'` → có `trust-backend-status` với chữ của `blocked`.

Test cũ trong `trust-prompt.test.tsx` phải vẫn xanh mà **không sửa assertion**; chỉ được thêm prop vào chỗ render nếu bắt buộc.

**E2E**: không thêm test mới. Test AC-11 cũ (`untrusted project blocks dev server…`) phải vẫn xanh.

## Phạm vi file

- Sửa: `packages/shared/src/project.ts` (và test schema của shared nếu có), `packages/server/src/core/project/project-service.ts`, `project-service.test.ts`, `packages/studio/src/features/trust/trust-prompt.tsx`, `trust-prompt.test.tsx`, `packages/studio/src/features/editor/editor-shell.tsx` (chỉ truyền prop), locale `vi`/`en` `common.json`, `docs/construction/spec-log.md` (gạch dòng #2, thêm 1 dòng lệch như trên).
- Được sửa thêm **chỉ khi typecheck báo**: các file test/fixture khác đang dựng `BackendInfo` bằng tay (thêm 2 trường mới). Ghi rõ từng file trong báo cáo.
- Không sửa gì khác. Cần sửa ngoài danh sách thì dừng và báo.

## Bẫy đã biết

1. `TrustDialog` và `EditorShell` gần giới hạn `max-lines-per-function` 50: tách khối backend thành component `TrustBackends` riêng trong cùng file.
2. Đường dẫn là dữ liệu từ `workspace.json` (có thể bị sửa tay): chỉ hiện chữ qua JSX, cấm `dangerouslySetInnerHTML`.
3. Trên Windows `isInside` so sánh không phân biệt hoa thường theo `platform`; test server phải truyền `platform` như các test V-03/V-04 đang làm, không giả định `/`.
4. QC-40: không `null`. `parentPath` trả `undefined` ở gốc ổ đĩa.
5. Báo cáo phải kê **mọi** chỗ sửa ngoài bảng phạm vi, kể cả viết gọn code để qua giới hạn số dòng.

## Kiểm tra trước khi báo xong

1. `pnpm exec vitest run packages/server/src/core/project packages/studio/src/features/trust packages/shared`
2. `pnpm exec tsc --noEmit -p packages/studio` và `-p packages/server`
3. Cuối cùng một lần: `pnpm verify`, `pnpm test:e2e`.

## Mẫu báo cáo

1. Danh sách file tạo/sửa (đường dẫn, số dòng thêm/bớt).
2. Nguyên văn dòng tổng của `pnpm verify` và `pnpm test:e2e`.
3. Chỗ làm khác bản giao việc và lý do (kể cả code ngoài phạm vi được viết lại).
4. Không commit. Không gạch mục khác trong spec-log.
