# Phase 1, lượt 1: tách bản dịch lỗi (V-80) và dọn code (SEV-3)

Lượt này gồm 3 phần **làm theo thứ tự A → B → C**. Xong phần nào chạy kiểm tra nhanh của phần đó. Một phần kẹt (sửa 3 lần vẫn đỏ, hoặc cần đổi thiết kế ngoài phạm vi) thì **dừng ở phần đó và báo**, không làm phần sau. Cuối lượt chạy `pnpm verify` và `pnpm test:e2e` **một lần**.

Đọc trước: `AGENTS.md`, `docs/construction/giao-viec/README.md`.

Quy tắc chung của cả lượt:

- **Không đổi hành vi người dùng thấy**, trừ câu báo lỗi ở phần A.
- Test cũ phải xanh **mà không sửa assertion**. Được sửa test cũ chỉ ở 2 chỗ: tên test (phần B) và chỗ ép kiểu `as unknown as` (phần B). Test kiểm câu lỗi cũ thì được đổi chuỗi mong đợi sang câu mới của phần A, kê tên từng test trong báo cáo.
- Báo cáo kê **mọi** file sửa, kể cả viết gọn code.

---

## Phần A: bản dịch lỗi theo V-80

Nguồn: spec-log #3; `docs/spec.md` tìm `| V-80 |` và bảng mã lỗi (tìm `| E001 | Unsupported Project`), hai dòng ngay dưới bảng liệt kê `reason` của E023, E025.

### A1. Cấu trúc `errors.json` (cả `vi` và `en`)

Mỗi mã chuyển từ một chuỗi sang:

```json
"E017": {
  "title": "…",
  "message": "…",
  "reasons": { "moved": "…", "valueChanged": "…", "fileChanged": "…" }
}
```

- `message` lấy câu hiện có (giữ nghĩa). `title` là cụm ngắn ≤ 6 từ (ví dụ vi "Mã nguồn đã đổi", en "Source changed").
- `reasons` chỉ có ở mã có `reason`/`reasons`. Danh sách **tối thiểu**:
  - E001: mọi giá trị của `UNSUPPORTED_REASONS` (`packages/shared/src/project.ts`).
  - E011: `untrusted`.
  - E017: `moved`, `valueChanged`, `fileChanged`.
  - E023: `classExpression`, `textExpression`, `textMixed`, `selfClosing`, `attrExpression`, `duplicateAttr`, `outsideSource`, `tooLarge`, `notJsxFile`.
  - E025: mọi giá trị của `RUNNER_ERROR_REASONS` (`packages/shared/src/runner.ts`).
  - E026: `notInstalled`, `notLoggedIn`.
  - Thêm mọi giá trị `reason` mà server **thật sự gửi** nhưng chưa có ở trên: chạy `grep -rn "reason: '" packages/server/src --include=*.ts` (bỏ file test) và kê kết quả trong báo cáo.
- `network` và `unknown` cũng thành `{ "title", "message" }`; `unknown.message` giữ `{{code}}`.
- `pnpm check:i18n` phải xanh (nó đã so khóa lồng nhau và placeholder giữa 2 ngôn ngữ).

### A2. API dịch lỗi: `packages/studio/src/routes/error-text.ts`

```ts
export type ErrorInfo = {
  readonly code: string;
  readonly params?: Readonly<Record<string, unknown>> | undefined;
};

/** Short title of an error code (V-80). */
export function errorTitle(tError: TFunction<'errors'>, code: string): string;

/** Message, then the sentence of each known reason, then the code: "… … (E023)". */
export function errorText(
  tError: TFunction<'errors'>,
  code: string,
  params?: Readonly<Record<string, unknown>>,
): string;

/** Reads code and params from what a request threw (ApiError, or anything else → 'network'). */
export function toErrorInfo(error: unknown): ErrorInfo;
```

Thuật toán `errorText`:

1. Mã không có trong `errors.json` (`isErrorKey`) → `tError('unknown.message', { code })`.
2. Ngược lại `parts = [tError(\`${code}.message\`)]`.
3. Lấy lý do: `params.reason` nếu là chuỗi; `params.reasons` nếu là mảng chuỗi. Với mỗi lý do có khóa `${code}.reasons.${reason}` (kiểm bằng `i18next.exists` hoặc tra bảng `en` giống `isErrorKey`) thì thêm câu đó vào `parts`. Lý do lạ bỏ qua, không hiện tên kỹ thuật.
4. Trả `${parts.join(' ')} (${code})`.

`toErrorInfo`: `ApiError` → `{ code: error.code ?? String(error.status), params: error.params }`; khác → `{ code: 'network' }`. Đây là chỗ duy nhất làm việc này; các component đang tự viết `error instanceof ApiError ? (error.code ?? String(error.status)) : 'network'` thì đổi sang gọi hàm này.

`isErrorKey` trong `i18n/error-key.ts` giữ nguyên ý nghĩa (khóa cấp 1 của `en/errors.json`). Kiểu khóa i18next (`i18next.d.ts`) phải chấp nhận `` `${code}.message` `` mà **không** ép kiểu; nếu không làm được thì dừng và báo.

### A3. Nơi gọi

`grep -rn "errorText(" packages/studio/src` (hiện 7 file). Ở mỗi nơi:

- State đang lưu mã (`failedCode`, `errorCode`…) đổi sang lưu `ErrorInfo` và truyền `params` vào `errorText`.
- Không đổi `data-testid`, `role="alert"`, vị trí hiển thị.

### A4. Test (Gemini viết, gắn `[V-80]`)

1. `packages/studio/src/i18n/errors-locale.test.ts`: với mỗi mã trong `ERROR_CODES` (`packages/shared/src/result.ts`) và cả `network`, `unknown`: `vi` và `en` đều có `title`, `message` là chuỗi không rỗng. Với mỗi lý do trong danh sách tối thiểu A1: có khóa `reasons.<lý do>` ở cả 2 ngôn ngữ.
2. `packages/studio/src/routes/error-text.test.ts` (4 test): mã lạ → câu `unknown` có mã; E017 + `{ reason: 'fileChanged' }` → chứa câu `message` và câu lý do, kết thúc `(E017)`; E001 + `{ reasons: ['noVite', 'noTailwind'] }` → có cả 2 câu lý do; lý do lạ `{ reason: 'zzz' }` → không chứa `zzz`.
3. `toErrorInfo`: `ApiError(409, 'E017', { reason: 'moved' })` → đúng code, params; `new TypeError()` → `{ code: 'network' }`.

Kiểm nhanh phần A: `pnpm exec vitest run packages/studio`, `pnpm check:i18n`, `pnpm exec tsc --noEmit -p packages/studio`.

Xong phần A: gạch dòng #3 trong `docs/construction/spec-log.md` ("Xong: …").

---

## Phần B: tên test và ép kiểu

### B1. Tag test `(CODE)` → `[CODE]`

`pnpm trace` chỉ đọc tag dạng `[R-xx-nn]`, nên test đang ghi `(R-xx-nn)` không được tính. Tìm: `grep -rnE "(it|test|describe)\('[^']*\([A-Z]+-[A-Z0-9-]+" packages e2e --include=*.ts --include=*.tsx`. Đổi đúng phần ngoặc chứa mã sang ngoặc vuông (nhiều mã: `[R-SE-01, R-SE-02]`). Không đổi chữ khác trong tên. Ghi số `codes named by tests` của `pnpm trace` trước và sau vào báo cáo (sau phải ≥ trước).

### B2. Bỏ `as unknown as`

`grep -rn "as unknown as" packages e2e --include=*.ts --include=*.tsx` (bỏ `*.generated.ts`). Hiện có ở 6 file: `server/src/adapters/system/node-process.ts`, `server/src/runners/vite-react.ts`, `studio/src/api/session.ts`, và 3 file test (`server/src/adapters/http/routes/project.test.ts`, `studio/src/features/selection/bridge-channel.test.ts`, `studio/src/features/text-edit/use-canvas-text-edit.test.ts`).

Mỗi chỗ thay bằng cách đúng kiểu (AGENTS.md mục 1): thu hẹp kiểu bằng kiểm tra thật, schema `zod` `.parse`, kiểu chính xác của thư viện (`ChildProcess`…), hoặc dựng đối tượng giả có đủ kiểu (test có thể dùng `new MessageChannel()`, `window` thật của happy-dom, hoặc `Pick<…>` của kiểu cần thiết). Cấm thay bằng `any`, `as never`, `@ts-expect-error`. Chỗ nào không bỏ được mà không đổi thiết kế ngoài file: **giữ nguyên chỗ đó**, làm tiếp chỗ khác, ghi lý do trong báo cáo.

Kiểm nhanh phần B: `pnpm trace`, `pnpm typecheck`, `pnpm exec vitest run` cho các file đã sửa.

---

## Phần C: tách hàm và file dài

Mục tiêu: `pnpm lint` còn **0 cảnh báo** `max-lines-per-function` và `max-lines`. Danh sách hiện tại (26 cảnh báo):

| File                                                                  | Hàm/file vượt                                                                  |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `server/src/adapters/http/routes/fs.ts`                               | `registerFsRoutes` 55, arrow trong đó 53                                       |
| `server/src/adapters/http/routes/project.ts`                          | `registerProjectRoutes` 97                                                     |
| `server/src/adapters/system/node-process.ts`                          | `createNodeProcess` 115, `spawn` 111                                           |
| `server/src/core/project/frameworks/vite-react/detect.ts`             | `detectViteReact` 60                                                           |
| `server/src/core/project/project-service.ts`                          | file 529; `createProjectService` 440; `open` 75; `install` 56; `addBackend` 76 |
| `server/src/core/project/project-service.test.ts`                     | file 433                                                                       |
| `server/src/core/project/theme.ts`                                    | `readThemeTokens` 56                                                           |
| `server/src/core/source-editor/source-editor-service.ts`              | file 420                                                                       |
| `studio/src/features/editor/canvas-area.tsx`                          | `CanvasArea` 61                                                                |
| `studio/src/features/inspector/components/tag-attributes-section.tsx` | `TagAttrRow` 60                                                                |
| `studio/src/features/inspector/inspector-panel.tsx`                   | `ElementSections` 60, `InspectorSingleTargetView` 61                           |
| `studio/src/features/inspector/use-inspector-target.ts`               | `useElementSourceLoader` 52                                                    |
| `studio/src/features/layers/layer-tree.tsx`                           | `LayerTreeRow` 85, `useLayerTreeSelection` 64, `LayerTree` 88                  |
| `studio/src/features/project/backends-view.tsx`                       | `BackendsView` 123                                                             |
| `studio/src/features/project/directory-browser.tsx`                   | `DirectoryBrowser` 144                                                         |
| `studio/src/features/project/install-dialog.tsx`                      | `InstallDialog` 88                                                             |
| `studio/src/features/project/project-dialog.tsx`                      | `ProjectDialog` 236                                                            |
| `studio/src/features/text-edit/use-canvas-text-edit.ts`               | `useCanvasTextEdit` 52                                                         |

(Đường dẫn trên bỏ tiền tố `packages/`.) Phần A có thể làm thay đổi danh sách: lấy danh sách thật bằng `pnpm lint` trước khi bắt đầu phần C.

Cách tách:

1. Component dài: tách khối giao diện thành component con và logic thành hook `use…` trong cùng thư mục. Giữ nguyên `data-testid`, `aria-*`, thứ tự phần tử trong DOM, class Tailwind.
2. `createProjectService` (hàm nhà máy dài): tách từng nhóm việc (mở/đóng, tạo, cài, backend, tin cậy) thành hàm riêng nhận `deps` và trạng thái chung, đặt ở file mới trong `server/src/core/project/` (ví dụ `project-backends.ts`, `project-install.ts`). API công khai `ProjectService` **không đổi**.
3. Route dài: tách mỗi handler thành hàm có tên trong cùng file hoặc file con.
4. File test > 400 dòng: tách theo `describe` thành file `*.test.ts` thứ hai cùng thư mục (ví dụ `project-service-backends.test.ts`), dùng chung helper qua file `*-test-helpers.ts` nếu cần. Không đổi nội dung test.
5. **Cấm** nén code để lách đếm dòng: không gộp nhiều câu lệnh trên một dòng, không bỏ dấu ngoặc của `if` nhiều dòng, không tăng giới hạn trong `eslint.config.js`, không `eslint-disable`.

Kiểm nhanh phần C: `pnpm lint` (0 cảnh báo nói trên), `pnpm typecheck`, `pnpm exec vitest run`.

---

## Kiểm tra cuối lượt

1. `pnpm verify`: 0 lỗi; cảnh báo `max-lines*` = 0 (ghi tổng số cảnh báo còn lại và loại của chúng).
2. `pnpm test:e2e`: 51 test xanh trên 3 trình duyệt.
3. Không cần chạy `pnpm test:e2e:network` (lượt này không đụng luồng cài).

## Mẫu báo cáo

1. Phần nào xong, phần nào dừng (và vì sao).
2. Danh sách file tạo/sửa (đường dẫn, số dòng thêm/bớt), nhóm theo phần A/B/C.
3. Nguyên văn dòng tổng của `pnpm verify` và `pnpm test:e2e`; số `codes named by tests` trước/sau.
4. Phần A: danh sách `reason` server gửi mà spec chưa liệt kê; các test cũ đã đổi chuỗi mong đợi.
5. Phần B: chỗ `as unknown as` nào còn giữ và lý do.
6. Không commit. Trong spec-log chỉ gạch dòng #3.
