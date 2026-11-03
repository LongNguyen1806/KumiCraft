# Phase 4 — Lượt K3d chặng B: Cài router, chọn file router, hằng số route, phiên đăng nhập, nút gạt AI sửa file

Đọc `README.md` cùng thư mục trước, nhất là mục **"Lỗi lint hay vấp"**. Chặng A (`p4-luot-k3d-tim-route.md`) đã xong; đọc mục 3 của bản đó để biết hợp đồng `RouterStatus` và `routing.file`.

Lượt này có **4 phần**: B (cài router + chọn file router, như mục 3.5–3.6 của bản K3d), C (đường dẫn route dạng hằng số), D (phiên đăng nhập theo origin), E (nút gạt "AI được sửa file"). Quyết định: spec-log #74, #76.

## 0. Bối cảnh

- Dự án thật để đối chiếu: MarketLink (`router/AppRouter.jsx` gọi `createBrowserRouter`, gộp các mảng `export const xRoutes = [...]` ở `router/routes/*.routes.jsx`; 15 route dùng `path: ROUTES.FARMER.HOME` lấy từ `constants/routes.js`: `export const ROUTES = Object.freeze({ HOME: '/', FARMER: Object.freeze({ HOME: '/farmer', ORDER: (id) => \`…\` }) })`).
- MarketLink có 2 cổng đăng nhập (`PORTALS.MARKET` cho customer và farmer, `PORTALS.ADMIN`), token trong `localStorage`. Canvas luôn mở `http://127.0.0.1:<cổng>` nên customer và farmer không đăng nhập cùng lúc được.
- Claude Code chạy `claude -p` mặc định **cấm sửa file** khi không có người duyệt; trong KumiCraft không có hộp duyệt nên mọi yêu cầu sửa bị chặn. Antigravity mặc định cho sửa.
- Đã có sẵn: `findRouter`, `readPages` (`server/src/core/project/route-finder.ts`, `pages.ts`); `startInstallJob` (`project-install.ts`); `FolderPicker` chế độ file; menu cây `features/files/files-design-menu.tsx`; `PATCH /project`; `bridgeChannel.attach(iframeWindow, runnerOrigin, nonce)` (`features/selection/bridge-channel.ts`, gọi từ `features/editor/canvas-frame.tsx`); adapter agent `core/agent/adapters/claude.ts`, `agy.ts`.

Không sửa: `docs/spec.md`, `e2e/`, `fixtures/`, MCP.

## 1. Mục tiêu (người dùng thấy gì)

1. **Cài router** (mục 3.5 và B1–B3 của bản K3d, giữ nguyên hợp đồng ở đó).
2. **Chọn file router** trong panel Trang và từ cây (mục 3.6 và B4–B8 của bản K3d).
3. **Route dùng hằng số** (`path: ROUTES.FARMER.HOME`) hiện trong danh sách trang với đúng đường dẫn `/farmer`.
4. **Phiên đăng nhập:** thanh công cụ Canvas có ô **"Phiên: …"**. Mỗi phiên giữ đăng nhập riêng; đổi phiên không phải đăng nhập lại. Đặt tên được (ví dụ "Customer", "Farmer"). Chọn phần tử và sửa vẫn chạy ở mọi phiên.
5. **Nút gạt "AI được sửa file"** ở đầu panel chat: bật thì AI đọc và sửa file trong dự án; tắt thì chỉ đọc và trả lời. Nhớ theo dự án, dự án mới mặc định **bật**. Chạy lệnh (Bash) vẫn theo cấu hình của agent ở cả hai chế độ.

## 2. Hợp đồng

### 2.1. `workspace.json` (shared `workspace-file.ts`)

```ts
// thêm vào WorkspaceFileSchema, tất cả optional (file cũ vẫn hợp lệ, không tăng schemaVersion)
sessions: z.array(z.strictObject({
  id: z.number().int().min(1).max(8),
  label: z.string().trim().min(1).max(32),
})).max(8).optional(),
ai: z.strictObject({ allowEdits: z.boolean() }).optional(), // không có = true
```

`ProjectInfo` thêm `sessions` (luôn có ít nhất phiên 1 `{ id: 1, label: 'Phiên 1' }` khi file không ghi) và `ai: { allowEdits }` (mặc định `true`). `PATCH /project` nhận `sessions` và `ai`.

### 2.2. Phần C: hằng số route (server)

- Trong `readPages`, trước khi đi các file, đọc **bảng hằng số**: mỗi `export const X = { … }` hoặc `export const X = Object.freeze({ … })` (lồng `Object.freeze` cũng được) có giá trị là chuỗi literal → khóa `X.A.B` → chuỗi. Giá trị là hàm, template literal, biến → bỏ qua.
- `path` dạng `MemberExpression` (`ROUTES.FARMER.HOME`) mà gốc `ROUTES` được `import` (tương đối hoặc `@/`) từ file có bảng đó → dùng chuỗi. Không giải được → **bỏ route như hiện nay** (không gán `/`).
- Áp dụng cả cho `<Route path={ROUTES.X} … />`.
- Chỉ đọc, không sửa: thêm/đổi tên/xóa trang có `path` hằng số vẫn đi qua route literal mới (trang mới viết chuỗi literal).

### 2.3. Phần D: phiên đăng nhập (spec-log #76)

- Phiên 1 dùng origin runner như hiện nay `http://127.0.0.1:<cổng>` (giữ nguyên đăng nhập sẵn có). Phiên `n ≥ 2` dùng `http://s<n>.localhost:<cổng>`. Hàm thuần trong shared: `sessionOrigin(runnerOrigin: string, sessionId: number): string`.
- `canvas-frame.tsx`: `src` của iframe và đối số `runnerOrigin` của `bridgeChannel.attach` đều dùng `sessionOrigin(…)` của phiên đang chọn. Bridge **chỉ** nhận đúng origin của phiên đang chọn (V-111 giữ nguyên: kiểm `event.source`, `event.origin`, nonce, schema). Đổi phiên → `detach` rồi `attach` với origin mới.
- Phiên đang chọn lưu theo dự án trong Studio (`localStorage` của Studio, khóa `kumicraft.session.<projectId>`), không lưu vào `workspace.json`.
- Trước khi mở phiên `n ≥ 2` lần đầu, Studio kiểm trình duyệt mở được `s<n>.localhost` (tải thử với thời hạn 3 giây). Không được → báo "Trình duyệt này không mở được địa chỉ `*.localhost`; dùng Chrome, Edge hoặc Firefox" và ở lại phiên cũ.
- Ô "Phiên" trên thanh Canvas: danh sách phiên, "Thêm phiên", đổi tên, xóa (không xóa phiên 1). Ghi qua `PATCH /project { sessions }`.
- Nút "Mở trong trình duyệt"/"Xem thử" (nếu có) mở đúng origin của phiên đang chọn.

### 2.4. Phần E: nút gạt AI sửa file (S-112 đổi: spec-log #76)

- `AgentTurnArgs` thêm `allowEdits: boolean` (turn runner lấy từ `ProjectInfo.ai.allowEdits`).
- **claude:** bật → thêm `--permission-mode acceptEdits`; tắt → `--permission-mode plan`. Không bao giờ dùng `bypassPermissions`, `--dangerously-skip-permissions`, `--allowedTools`.
- **agy:** bật → như hiện nay (không thêm cờ); tắt → `--mode plan`. Không dùng `--dangerously-skip-permissions`, `--mode auto`.
- Sửa test S-112 của hai adapter: danh sách cờ cấm vẫn kiểm, chỉ cho đúng các cờ và giá trị trên.
- Lời nhắc gửi agent khi tắt có thêm một câu: chế độ chỉ đọc, đừng sửa file; nếu được nhờ sửa thì trả lời rằng cần bật "AI được sửa file".
- Studio: nút gạt ở đầu panel chat (cạnh "New conversation"), `PATCH /project { ai: { allowEdits } }`; khi tắt, ô nhập có dòng nhỏ "Chỉ đọc: AI không sửa file".

## 3. Tình huống test (bắt buộc, tên test có `WP-4.00`)

B1–B8 như mục 4 của `p4-luot-k3d-tim-route.md`, cộng:

| #   | Tình huống                                                                                                                                                                                                                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Dự án kiểu MarketLink: `ROUTES = Object.freeze({ FORBIDDEN: '/403', FARMER: Object.freeze({ HOME: '/farmer', ORDER: (id) => … }) })`, route `path: ROUTES.FARMER.HOME` và `path: ROUTES.FORBIDDEN` trong file khác → trang `/farmer`, `/403` có đúng file; `ROUTES.FARMER.ORDER` (hàm) bị bỏ |
| C2  | `<Route path={ROUTES.HOME} element={<Home />} />` → trang `/`; gốc không được import (biến cục bộ không phải hằng) → bỏ, không gán `/`                                                                                                                                                       |
| D1  | `sessionOrigin('http://127.0.0.1:5173', 1)` = `http://127.0.0.1:5173`; `(…, 3)` = `http://s3.localhost:5173`; origin sai dạng → lỗi rõ ràng, không đoán                                                                                                                                      |
| D2  | Canvas đổi phiên 1 → 2: iframe `src` dùng `s2.localhost`, `bridgeChannel.attach` nhận origin `s2`; tin nhắn từ origin phiên 1 sau khi đổi bị bỏ qua                                                                                                                                          |
| D3  | Ô "Phiên": thêm phiên "Farmer" → PATCH `sessions` đúng; không xóa được phiên 1; phiên đang chọn nhớ sau khi tải lại theo dự án                                                                                                                                                               |
| D4  | Trình duyệt không mở được `s2.localhost` (kiểm thử giả thất bại) → báo lỗi, vẫn ở phiên 1                                                                                                                                                                                                    |
| E1  | claude `buildArgs` với `allowEdits: true` có `--permission-mode acceptEdits`, `false` có `--permission-mode plan`; không cờ cấm nào khác                                                                                                                                                     |
| E2  | agy `buildArgs` với `allowEdits: false` có `--mode plan`, `true` không có `--mode`; lời nhắc khi tắt có câu chỉ đọc                                                                                                                                                                          |
| E3  | Turn runner đọc `ai.allowEdits` của dự án (không ghi = bật) và truyền vào adapter                                                                                                                                                                                                            |
| E4  | Nút gạt trong panel chat: tắt → PATCH `ai.allowEdits: false`, hiện dòng "Chỉ đọc"; bật lại → PATCH `true`                                                                                                                                                                                    |

## 4. Bẫy đã biết

- `bridge-channel.ts`: mọi chỗ so `runnerOrigin` (nhận và gửi `postMessage`) phải dùng origin của phiên; đừng nới thành "mọi `*.localhost`".
- Vite cho phép sẵn `localhost` và `*.localhost`; không thêm cấu hình vào dự án người dùng.
- Đọc hằng số: chỉ chuỗi literal; `Object.freeze` lồng nhau; đừng chạy code của dự án (không `eval`, không `import()`).
- `workspace.json` cũ không có `sessions`, `ai`: test phải dùng đúng một file cũ.
- Test cũ của adapter (S-112) đang cấm `--mode` và `--permission-mode`: sửa cho đúng quy tắc mới, ghi trong báo cáo, không xóa kiểm cờ nguy hiểm.
- Ref DOM theo QC-40: `ref={(el) => { r.current = el ?? undefined; }}`.

## 5. Không được làm

- Không sửa `docs/spec.md`, MCP, `e2e/`, `fixtures/` (Claude viết E2E và fixture ở lượt QA).
- Không thêm dependency vào repo.
- Không `as unknown as`, `as any`, `!`, `@ts-ignore`, `eslint-disable`, `null`.
- Không nới test cũ cho xanh; không lọc theo đúng giá trị của test.
- File ≤ 400 dòng, hàm ≤ 50 dòng sau khi chạy Prettier.
- Không commit; không chạy git checkout/restore/reset/stash/clean; không cài gói.

## 6. Tự kiểm trước khi báo cáo (bắt buộc)

1. `pnpm format` → `pnpm verify` toàn bộ → `pnpm test:e2e` toàn bộ.
2. Chỉ báo cáo khi cả hai xanh; lỗi thì tự sửa đúng gốc rồi chạy lại, không dừng để hỏi.

## 7. Báo cáo (ngắn, tiếng Việt, ở cuối câu trả lời)

```
## BÁO CÁO K3d chặng B
- verify: <số test> xanh | e2e: <số> xanh
- File tạo: …
- File sửa: …
- Test cũ đã sửa và lý do: …
- Tình huống: B1 <tên test đúng như trong code> — đạt; … C1 …; D1 …; E1 …
- Khác bản giao việc và lý do: …
```

Đề xuất commit message: `feat(studio): install router, login sessions and ai edit switch` (đã qua commitlint).
