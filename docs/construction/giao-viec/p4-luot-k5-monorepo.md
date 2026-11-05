# Phase 4 — Lượt K5: Monorepo, báo rõ framework chưa hỗ trợ, nút "Nhờ AI sửa phần tử này"

Đọc `README.md` cùng thư mục trước, nhất là mục **"Lỗi lint hay vấp"**, rồi làm đúng bản này. Lượt này làm **một chặng**. Xong thì `pnpm format`, `pnpm verify` toàn bộ, `pnpm test:e2e` toàn bộ, tất cả xanh rồi mới báo cáo.

## 0. Bối cảnh

Kế hoạch `p4-ke-hoach.md` (bảng lượt, dòng K5 thu gọn; mục 9 "Nguyên tắc chung"); spec-log #81.

Hiện nay:

- Mở một thư mục: `probeProject` (`server/src/core/project/probe.ts`) trả `missing`, `empty`, `project` (có `package.json`) hoặc `other`. Studio (`features/project/project-dialog-probe-view.tsx`) với `other` chỉ hiện "Đây không phải dự án" (`not-project-msg`).
- **Repo kiểu MarketLink** (`D:/Study/HK2/Project Techwiz 7/MarketLink-Project`): gốc chỉ có `.git`, `README.md`, `frontend/` (React + Vite, có `node_modules` riêng), `backend/` (Django). Mở gốc → `other` → người dùng không biết phải mở `frontend/`. WorkTracker cùng kiểu.
- **Workspace npm/pnpm/yarn**: `node_modules` có thể nằm ở gốc repo thay vì thư mục ứng dụng (gói được "hoisted"). Mấy chỗ sau chỉ nhìn `<root>/node_modules`, nên đánh giá sai:
  - `checkNeedsInstall` (`project-install.ts`, nhận `adapter.requiredPackages`);
  - đọc phiên bản trong `vite-react/detect.ts` và `express-pug/detect.ts` (`node_modules/<gói>/package.json`).

  Node tự tìm gói ở thư mục cha khi chạy, nên runner Vite chạy được; chỉ phần kiểm tra là sai.

- Dự án Create React App (`react-scripts`) hay Next.js (`next`) → lý do chung chung (`noVite`) hoặc rơi về `other`. Người dùng không biết vì sao.
- Chat đã gửi phần tử đang chọn cho AI (`chat-input.tsx`, `buildTurnContext` → `Selected element: <loc> (<tag>)`). Ẩn hay hiện ngữ cảnh do `useChatStore().hidden.element` quyết định; ô nhập là `draft`/`setDraft`. Panel phải có 2 tab `properties` và `chat` (`features/editor/side-panels.tsx`, `RightPanelTabs`, trạng thái lưu trong `localStorage`).
- Dự án chỉ xem (Express + Pug): Inspector hiện `ViewOnlyInspector` (`features/inspector/components/view-only-inspector.tsx`) có nút "Mở trong editor".
- Dự án mẫu (Claude tạo): `fixtures/projects/monorepo-apps`:
  - `package.json` gốc: `workspaces: ["frontend"]`;
  - `frontend/`: React + Vite, **không có** `node_modules` riêng (trong E2E, `node_modules` chỉ được gắn ở gốc);
  - `backend/`: Django (`manage.py`, `requirements.txt`);
  - `legacy-cra/`: `react-scripts`;
  - `next-site/`: `next`.

Không sửa: `docs/spec.md`, MCP, `e2e/`, `fixtures/` (Claude viết E2E ở lượt QA).

## 1. Mục tiêu (người dùng thấy gì)

1. Mở gốc repo kiểu MarketLink → hộp Mở dự án ghi "Thư mục này chứa N ứng dụng" và liệt kê từng ứng dụng: đường dẫn (`frontend`), loại (React + Vite, Express + Pug, Create React App, Next.js), "Mở được" hoặc lý do chưa hỗ trợ. Bấm một ứng dụng mở được → mở thư mục đó như một dự án bình thường; danh sách gần đây lưu đúng thư mục ứng dụng.
2. Thư mục ứng dụng không có `node_modules` riêng nhưng gói nằm ở gốc workspace → không bị báo "cần cài gói"; phiên bản đọc đúng; nút cài gói (nếu cần) chạy ở gốc workspace.
3. Mở thẳng một dự án CRA hay Next.js → màn hình "chưa hỗ trợ" nói rõ: "Create React App đã bị React ngừng phát triển; KumiCraft hỗ trợ React + Vite" / "Next.js sẽ có ở bản 1.1", kèm gợi ý.
4. Inspector có nút **"Nhờ AI sửa phần tử này"**: bấm → panel phải chuyển sang tab chat, ngữ cảnh phần tử đang chọn được bật lại nếu đang ẩn, ô nhập có sẵn chữ gợi ý và được focus. Nút có ở:
   - `ViewOnlyInspector` (dự án chỉ xem);
   - chỗ Inspector báo một thuộc tính bị khóa kèm lý do (ví dụ `className={cn(…)}`, phần tử nằm ngoài nguồn), nếu chỗ đó đang có nút "Mở trong editor".

## 2. Đọc trước (CW-52)

| File                                                                                                         | Lý do                  |
| ------------------------------------------------------------------------------------------------------------ | ---------------------- |
| `p4-ke-hoach.md` (dòng K5, mục 9); `spec-log.md` #80, #81                                                    | Phạm vi                |
| `server/src/core/project/probe.ts`, `frameworks/index.ts` (`detectFramework`), `frameworks/*/detect.ts`      | Nhận diện              |
| `server/src/core/project/project-install.ts`, `project-service.ts` (`finishOpen`, `install`, `afterInstall`) | Kiểm cài gói, lệnh cài |
| `shared/src/project.ts` (`ProjectProbeSchema`, `UNSUPPORTED_REASONS`)                                        | Hợp đồng               |
| `studio/src/features/project/project-dialog-probe-view.tsx`, `project-dialog*.tsx`, `recent-project*`        | Hộp Mở dự án           |
| `studio/src/features/chat/chat-store.ts`, `chat-input.tsx`, `features/editor/side-panels.tsx`                | Nút "Nhờ AI sửa"       |
| `studio/src/features/inspector/components/view-only-inspector.tsx` và chỗ hiện lý do khóa trong Inspector    | Chỗ đặt nút            |

## 3. Hợp đồng

### 3.1. Shared

```ts
// project.ts
UNSUPPORTED_REASONS thêm: 'craUnsupported', 'nextUnsupported', 'webpackUnsupported'

export const AppCandidateSchema = z.strictObject({
  path: RelPathSchema,                       // tương đối thư mục đã mở, dùng '/'
  framework: z.enum(FRAMEWORK_IDS).optional(),
  kind: z.enum(['vite-react', 'express-pug', 'cra', 'next', 'webpack', 'other']),
  supported: z.boolean(),
  reasons: z.array(UnsupportedReasonSchema).readonly(),
});
ProjectProbeSchema thêm nhánh:
  z.strictObject({ kind: z.literal('apps'), apps: z.array(AppCandidateSchema).min(1).max(20) })

SupportReportSchema thêm: workspaceRoot: z.string().min(1).optional()
// đường dẫn tuyệt đối của gốc workspace khi gói nằm ở đó (không có = node_modules ngay trong dự án)
```

### 3.2. Tìm ứng dụng con (`server/src/core/project/app-candidates.ts`)

- Khi thư mục đã mở **không** phải dự án hỗ trợ được, gồm 2 trường hợp:
  - không có `package.json`;
  - có `package.json` nhưng không framework nào nhận, và có `workspaces` (hoặc có `pnpm-workspace.yaml`).

  Khi đó quét thư mục con tối đa **3 cấp**. Bỏ qua `node_modules`, `.git`, `.kumicraft`, `dist`, `build`, `out`, `bin`, `obj`, `.next`, `coverage`, `venv`, `.venv`, `__pycache__` và thư mục bắt đầu bằng `.`.

- Thư mục con có `package.json` → một ứng viên:
  - chạy `detectFramework` lấy `framework`, `supported`, `reasons`;
  - `kind` theo dependency: `next` → `next`; `react-scripts` → `cra`; `vite` + `react` → `vite-react`; `express` + `pug` → `express-pug`; `webpack` + `react` (không vite) → `webpack`; còn lại `other`.
- Chỉ giữ ứng viên có framework web: bỏ `kind: 'other'` không có `react`, `vue`, `express`.
- Sắp xếp: mở được trước, rồi theo đường dẫn. Tối đa 20. Quét xong không có ai → giữ `other` như cũ.
- Đọc tĩnh, không chạy code dự án. Đặt giới hạn số thư mục đã đọc (ví dụ 2000) để repo lớn không treo.

### 3.3. Gốc workspace và `node_modules` ở thư mục cha (`server/src/core/project/workspace-root.ts`)

- `findWorkspaceRoot(fs, root)`:
  - đi lên tối đa **5 cấp** từ thư mục dự án;
  - dừng ở thư mục đầu tiên có `pnpm-workspace.yaml`, hoặc `package.json` có `workspaces`, hoặc `.git`;
  - không gặp cái nào → `undefined`, không dùng thư mục cha.
- `findPackage(fs, root, name)`:
  - tìm `node_modules/<name>/package.json` ở `root`, rồi lần lượt các thư mục cha **đến gốc workspace** (không vượt);
  - trả đường dẫn thư mục chứa nó.
- Dùng `findPackage` ở:
  - `checkNeedsInstall`;
  - phần đọc phiên bản của cả 2 detect.
- Khi gói được tìm thấy ở thư mục cha → `support.workspaceRoot` = gốc workspace.
- Lệnh cài gói chạy với `cwd` = `workspaceRoot` khi có (cài cho cả workspace). Sau khi cài, kiểm tra lại như cũ.

### 3.4. Lý do chưa hỗ trợ

- `vite-react` detect: có `react-scripts` → `craUnsupported`; có `next` → `nextUnsupported`; có `webpack` mà không có `vite` → `webpackUnsupported`. Thêm vào `reasons`, không bỏ lý do cũ.
- `detectFramework` khi không adapter nào nhận: ưu tiên các lý do mới này.
- Chuỗi `vi`/`en`:
  - **CRA:** "Create React App đã bị React ngừng phát triển (2025). KumiCraft 1.0 hỗ trợ React + Vite; chuyển dự án sang Vite là cách được React khuyên."
  - **Next.js:** "Next.js chưa có ở KumiCraft 1.0, dự kiến bản 1.1."
  - **webpack:** "Dự án React chạy webpack tự cấu hình chưa được hỗ trợ; KumiCraft 1.0 hỗ trợ React + Vite."

### 3.5. Studio

- **Hộp Mở dự án, probe `apps`:**
  - liệt kê ứng viên (`data-testid="app-candidate-<path>"`): đường dẫn, nhãn loại, trạng thái;
  - ứng viên mở được có nút "Mở" (`app-candidate-open-<path>`) → mở `<thư mục đã chọn>/<path>` bằng luồng mở hiện có;
  - ứng viên chưa hỗ trợ: hiện lý do theo 3.4, không có nút mở.
- **Nút "Nhờ AI sửa phần tử này"** (`ask-ai-element-btn`):
  - một hàm dùng chung `askAiAboutElement()`, đặt ở `features/chat/`;
  - việc của hàm: chuyển panel phải sang tab `chat` (đưa trạng thái tab ra một store nhỏ dùng chung, giữ lưu `localStorage` như cũ), bật `hidden.element = false`, `setDraft` = chuỗi gợi ý (`vi`: "Sửa phần tử này: ", `en`: "Change this element: ") nếu ô nhập đang trống, focus ô nhập;
  - không gửi tin tự động.

## 4. Tình huống test (bắt buộc, tên test có `WP-4.00`)

| #   | Tình huống                                                                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | Probe `fixtures/projects/monorepo-apps` → `apps` có `frontend` (`vite-react`, supported), `legacy-cra` (`cra`, `craUnsupported`), `next-site` (`next`, `nextUnsupported`); không có `backend`; mở được đứng đầu |
| M2  | Thư mục tạm không có `package.json`, có `web/` (Vite + React) và `web/node_modules/` bên trong → `apps` có `web`; thư mục tạm chỉ có file lặt vặt → `other` như cũ                                              |
| M3  | Quét bỏ qua `node_modules/`, `.git/`, `dist/`; con sâu hơn 3 cấp không được liệt kê                                                                                                                             |
| M4  | `findWorkspaceRoot`: có `package.json` với `workspaces` ở cha → đúng thư mục đó; có `.git` ở cha → thư mục đó; không có gì trong 5 cấp → `undefined`                                                            |
| M5  | `checkNeedsInstall` cho `frontend/` khi `vite`, `react` chỉ có ở `node_modules` của gốc workspace → `false`; gói nằm ở thư mục cha **ngoài** gốc workspace → vẫn `true`                                         |
| M6  | Mở `frontend/` của fixture: `support.workspaceRoot` là gốc fixture, phiên bản `vite`/`react` đọc được; lệnh cài (khi thiếu gói) chạy với `cwd` = gốc workspace                                                  |
| M7  | Detect: `react-scripts` → `craUnsupported`; `next` → `nextUnsupported`; `webpack` + `react` không vite → `webpackUnsupported`; Vite + React thường không có lý do mới                                           |
| M8  | Studio, probe `apps`: hiện 3 ứng viên, bấm Mở `frontend` → gọi mở đúng đường dẫn `<gốc>/frontend`; ứng viên CRA hiện lý do, không có nút Mở                                                                     |
| M9  | Studio: bấm `ask-ai-element-btn` trong `ViewOnlyInspector` → tab chat được chọn, `hidden.element` là `false`, ô nhập có "Sửa phần tử này: " và được focus; ô nhập đã có chữ thì giữ nguyên                      |
| M10 | Chỗ Inspector khóa `className={cn(…)}` có nút `ask-ai-element-btn` (cùng hành vi M9)                                                                                                                            |

## 5. Bẫy đã biết

- Windows: so đường dẫn bằng `/`; `RelPath` của ứng viên không có `..`, không tuyệt đối.
- Đi lên thư mục cha phải dừng ở gốc workspace: một `node_modules` ở thư mục người dùng (`C:/Users/x/node_modules`) không được làm dự án trông như đã cài.
- `readDir` trên repo lớn: giới hạn số thư mục đọc, bỏ qua lỗi quyền truy cập từng thư mục con thay vì làm hỏng cả lượt quét.
- Đừng đổi luồng mở dự án thường: thư mục có `package.json` được hỗ trợ vẫn mở như cũ, không quét con.
- Store tab panel phải: test cũ của `side-panels` đọc/ghi `localStorage` phải còn xanh mà không nới.
- Ref DOM theo QC-40: `ref={(el) => { r.current = el ?? undefined; }}`.

## 6. Không được làm

- Không sửa `docs/spec.md`, MCP, `e2e/`, `fixtures/`.
- Không thêm dependency.
- Không `as unknown as`, `as any`, `!`, `@ts-ignore`, `eslint-disable`, `null`.
- Không nới test cũ cho xanh; không lọc theo đúng giá trị của test.
- File ≤ 400 dòng, hàm ≤ 50 dòng sau khi chạy Prettier.
- Không commit; không chạy git checkout/restore/reset/stash/clean; không cài gói.

## 7. Tự kiểm trước khi báo cáo (bắt buộc)

1. `pnpm format` → `pnpm verify` toàn bộ → `pnpm test:e2e` toàn bộ.
2. Chỉ báo cáo khi cả hai xanh; lỗi thì tự sửa đúng gốc rồi chạy lại, không dừng để hỏi.

## 8. Báo cáo (ngắn, tiếng Việt, ở cuối câu trả lời)

```
## BÁO CÁO K5
- verify: <số test> xanh | e2e: <số> xanh
- File tạo: …
- File sửa: …
- Test cũ đã sửa và lý do: …
- Tình huống: M1 <tên test đúng như trong code> — đạt; …
- Khác bản giao việc và lý do: …
```

Đề xuất commit message: `feat(server): open apps inside monorepos and name unsupported ones`.
