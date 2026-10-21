# Phase 3 — Lượt 5: Ô chat, phần 1 (WP-3.05a)

Đọc `README.md` cùng thư mục trước, nhất là mục **"Lỗi lint hay vấp"**, rồi làm đúng bản này. Kế hoạch phase: `p3-ke-hoach.md`. Quy tắc: spec mục 24 (R-CH-01, R-CH-02, R-CH-03, R-CH-06, R-CH-07), SPEC-05 S-14, S-15, S-114.

Lượt này **chỉ làm Studio** (`packages/studio`). Server đã có đủ API từ lượt 2 và 4. Không sửa `packages/server`, `packages/shared`, Bridge, `e2e/`, `docs/spec.md`. Thiếu gì ở server thì dừng và báo.

Phần 2 (lượt 6) mới làm: danh sách file đổi chi tiết, xem diff, Hoàn tác lượt, lịch sử hội thoại, nút Hội thoại mới, Cài đặt/Đăng nhập agent.

## 1. Mục tiêu (người dùng thấy gì)

1. Panel phải có tab **AI** (đang bị khóa) được mở: `data-testid="right-tab-chat"`. Nhớ tab đang chọn như hai tab kia.
2. **Ô chat bị khóa** khi:
   - dự án chưa tin cậy: hiện "Dự án chưa được tin cậy. Mở hộp Project và chọn Tin cậy để dùng AI.";
   - không có agent: hiện "Chưa cài agent AI (agy hoặc claude). Cài agent rồi mở lại tab này.".

   Ô nhập và nút Gửi bị vô hiệu (R-CH-06).

3. **Ô nhập nhiều dòng**: Enter xuống dòng, **Ctrl+Enter** (⌘+Enter trên macOS) gửi; nút **Gửi**. Ô rỗng thì không gửi được (R-CH-01).
4. **Thẻ ngữ cảnh** phía trên ô nhập (R-CH-02), mỗi thẻ có nút ✕ để bỏ cho lượt sắp gửi:
   - phần tử đang chọn: `Header · src/components/Header.tsx:12`;
   - trang: `/about`;
   - khung: `Desktop · 1440 px`.
5. **Đính kèm tài liệu**: nút 📎 mở ô nhập đường dẫn tương đối trong dự án (ví dụ `docs/san-pham.md`), Enter thêm thành thẻ, ✕ để gỡ. Tối đa 10 (R-CH-02).
6. **Backend** (R-CH-07):
   - dải thẻ các backend đang gắn với dự án (nhãn, ✕ để gỡ);
   - nút **Thêm backend** mở hộp chọn thư mục (dùng lại `DirectoryBrowser`), chọn xong là gắn ngay;
   - thêm liên tiếp được; lỗi (quá 10, trùng, đường dẫn sai) hiện bằng chữ.

   Dùng **cùng API** với hộp Project, không có danh sách riêng.

7. **Trong lượt** (R-CH-03):
   - tin nhắn của agent hiện dần theo từng mẩu, hiển thị **Markdown an toàn**;
   - mỗi công cụ hiện một dòng có icon (đọc file, sửa file, chạy lệnh, tìm kiếm…) và đường dẫn;
   - nút **Hủy**.
8. **Hết lượt**: dòng tóm tắt "Xong · 3 file đã đổi" hoặc "Đã hủy" hoặc lỗi đã dịch (E027, E020…). Danh sách file chi tiết làm ở lượt 6.
9. Lượt sau trong cùng phiên gửi `conversation: 'continue'`, lượt đầu tiên gửi `'new'`.

## 2. Đọc trước (CW-52)

| File                                                                                                                                                                           | Lý do                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `docs/spec.md` mục 24, SPEC-05 S-14, S-15, S-114                                                                                                                               | Quy tắc gốc                                                                                         |
| `packages/studio/src/features/editor/side-panels.tsx`                                                                                                                          | `RightPanel`, `Tab`, tab AI đang `disabled`, lưu tab vào `localStorage`                             |
| `packages/studio/src/features/editor/editor-shell.tsx`, `routes/editor-screen.tsx`                                                                                             | `trusted`, `projectId` đi xuống thế nào                                                             |
| `packages/studio/src/api/http.ts`, `project-client.ts`, `jobs-client.ts`                                                                                                       | Cách gọi API và **parse bằng schema** (lượt 15 Phase 2); `addBackend`, `removeBackend`, `cancelJob` |
| `packages/studio/src/api/events-client.ts`                                                                                                                                     | `createEventsClient({ onEvent })`, một kết nối dùng chung                                           |
| `packages/studio/src/features/project/backends-view.tsx`, `directory-browser.tsx`                                                                                              | Hiển thị và chọn thư mục backend có sẵn                                                             |
| `packages/studio/src/features/selection/selection-store.ts`, `structure/structure-commands.ts` (`resolveTargetTag`), `editor/canvas-view-store.ts` (`frames`, `activeFrameId`) | Dữ liệu cho thẻ ngữ cảnh                                                                            |
| `packages/studio/src/routes/error-text.ts`                                                                                                                                     | `errorText`, `toErrorInfo`: dịch mã lỗi                                                             |
| `packages/studio/src/i18n/i18n.ts`, `locales/vi/*.json`, `scripts/check-i18n.mjs`                                                                                              | Cách thêm namespace mới                                                                             |
| `packages/shared/src/agent.ts`                                                                                                                                                 | `AgentStatusSchema`, `StartTurnRequest`, `TurnSummarySchema`, `AgentEventMessageSchema`             |

## 3. Hợp đồng

### 3.1. API client — `packages/studio/src/api/agent-client.ts` (mới)

Theo đúng cách các client khác parse phản hồi bằng schema của shared:

```ts
export async function fetchAgents(): Promise<readonly AgentStatus[]>; // GET agents
export async function startTurn(request: StartTurnRequest): Promise<{ readonly jobId: string }>; // POST agent/turns (202)
export async function fetchTurns(): Promise<readonly TurnSummary[]>; // GET agent/turns
export async function fetchTurnDiff(turnId: string, file: string): Promise<string>; // GET agent/turns/:id/diff?file=
export async function revertTurn(turnId: string): Promise<TurnSummary>; // POST agent/turns/:id/revert
```

Hai hàm cuối dùng ở lượt 6, viết luôn cho trọn client. `file` qua `encodeURIComponent`.

### 3.2. Thư viện Markdown

Thêm `"react-markdown": "10.1.0"` vào `packages/studio/package.json`, rồi `pnpm install`. **Không** thêm `rehype-raw` hay plugin nào cho phép HTML.

`features/chat/chat-markdown.tsx`:

```tsx
<Markdown skipHtml disallowedElements={['img']} unwrapDisallowed components={{ a: SafeLink }}>
  {text}
</Markdown>
```

- `SafeLink`: `href` bắt đầu bằng `http://` hoặc `https://` → `<a href target="_blank" rel="noreferrer">`. Còn lại (`javascript:`, `file:`, `data:`, tương đối) → chỉ hiện chữ, không phải liên kết (S-15).
- Ảnh bị bỏ để Studio không tự tải ảnh từ ngoài.

### 3.3. Store và luồng sự kiện — `features/chat/`

`chat-store.ts` (zustand):

```ts
export type ChatItem =
  | { readonly kind: 'user'; readonly text: string }
  | { readonly kind: 'message'; readonly text: string } // consecutive deltas joined
  | { readonly kind: 'tool'; readonly name: string; readonly target?: string | undefined }
  | { readonly kind: 'error'; readonly message: string };

export type ChatTurnView = {
  readonly jobId: string;
  readonly turnId?: string | undefined; // learnt from the first agent.event of this turn
  readonly state: 'running' | 'completed' | 'failed' | 'cancelled';
  readonly items: readonly ChatItem[];
  readonly fileCount?: number | undefined;
  readonly error?: ErrorInfo | undefined;
};
```

Store giữ: `turns: ChatTurnView[]` của phiên (cũ trước), `draft`, `docs: string[]`, `hidden: { element: boolean; page: boolean; frame: boolean }`, `hasConversation: boolean`. Các hàm: `startLocal`, `applyAgentEvent`, `finish`, `reset`.

`use-chat-events.ts`: dùng `createEventsClient({ onEvent })`, đóng khi unmount.

- `agent.event`: parse payload bằng `AgentEventMessageSchema`. Chỉ nhận khi có lượt `running`. Lượt chưa có `turnId` thì lấy `turnId` của sự kiện đầu; sự kiện có `turnId` khác thì bỏ.
- `message`: nối vào item `message` cuối **nếu** item cuối là `message`, không thì thêm item mới.
- `tool`, `error`: thêm item. `conversation`: bỏ qua (server lưu).
- `job.completed` (đúng `jobId`, `kind: 'agent.turn'`): `state: 'completed'`, `fileCount` = `result.files.length` (parse `result` bằng `TurnSummarySchema`).
- `job.failed`: `failed`, `error`.
- `job.cancelled`: `cancelled`.

Xem `events.ts` của server và payload thật của `job.*` trong `job-service.ts` để parse đúng.

### 3.4. Giao diện — `features/chat/`

| File                | Nội dung                                                                                                                                                                                                                                                                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chat-panel.tsx`    | Ghép mọi phần; khi khóa thì hiện lý do; `data-testid="chat-panel"`                                                                                                                                                                                                                                                                                 |
| `chat-lock.tsx`     | Trạng thái khóa: `chat-locked-untrusted`, `chat-locked-no-agent`. Dò agent bằng `fetchAgents()` khi mở tab (R-AG-10); đang dò hiện "Đang kiểm tra agent…"                                                                                                                                                                                          |
| `chat-thread.tsx`   | Danh sách `ChatItem` theo lượt; tin nhắn qua `ChatMarkdown`; dòng công cụ `chat-tool` có icon `lucide-react` theo tên (`read`/`view`/`list`/`find`/`grep`/`search` → kính lúp hoặc tài liệu; `write`/`replace`/`edit`/`sed` → bút; `run_command` → terminal; khác → cờ lê); tóm tắt cuối lượt `chat-turn-summary`; nút `chat-cancel` khi đang chạy |
| `chat-context.tsx`  | Thẻ `chat-chip-element`, `chat-chip-page`, `chat-chip-frame`, mỗi thẻ có nút ✕ `…-remove`. Không có dữ liệu thì không hiện thẻ đó                                                                                                                                                                                                                  |
| `chat-docs.tsx`     | Nút `chat-attach`, ô `chat-doc-input`, thẻ `chat-doc-<index>` có ✕                                                                                                                                                                                                                                                                                 |
| `chat-backends.tsx` | Thẻ `chat-backend-<id>` có ✕, nút `chat-add-backend` mở hộp thoại có `DirectoryBrowser` và nút xác nhận `chat-backend-confirm`; lỗi `chat-backend-error`                                                                                                                                                                                           |
| `chat-input.tsx`    | `textarea` `chat-input`, nút `chat-send`. Ctrl+Enter / ⌘+Enter gửi (kiểm `event.ctrlKey \|\| event.metaKey`), Enter thường xuống dòng                                                                                                                                                                                                              |

**Gửi** (`chat-send` hoặc phím):

1. `prompt` = nội dung đã trim; rỗng thì nút bị vô hiệu.
2. `context`:
   - `element`: phần tử chính (ref cuối của `selectedRefs`) với `tag` từ `resolveTargetTag`, nếu không ẩn;
   - `route`: `currentRoute`, nếu không ẩn;
   - `frame`: `{ id, width }` của khung đang xem, nếu không ẩn.
3. `conversation`: `hasConversation ? 'continue' : 'new'`. `docs` = danh sách thẻ tài liệu.
4. `startTurn(...)`.
   - Thành công: thêm lượt `running` với item `user`, xóa ô nhập, xóa tài liệu, bỏ mọi `hidden`, `hasConversation = true`.
   - Lỗi (E011, E026, E018, E015…): hiện `chat-send-error` bằng `errorText`, giữ nguyên ô nhập.

**Hủy:** `cancelJob(jobId)`.

**Backend:** đọc danh sách qua `fetchProject()` (`backends`). Thêm hoặc gỡ xong thì đọc lại. Chưa tin cậy thì phần backend vẫn hiện (gắn backend không cần chạy agent) nhưng ô chat bị khóa.

**Tab:** `RightPanelTab` thêm `'chat'`. `RightPanel` nhận `trusted` (truyền từ `EditorShell`). Nhãn tab dùng khóa `editor.ai` có sẵn.

### 3.5. i18n

Namespace mới `chat` (`locales/vi/chat.json`, `locales/en/chat.json`), đăng ký như các namespace khác. Mọi chữ hiện ra đi qua khóa, đủ `vi` và `en`. `pnpm check:i18n` phải xanh.

### 3.6. Spec-log (số tiếp theo sau #45)

- `#46` R-CH-02: đính kèm tài liệu bằng ô nhập đường dẫn tương đối (server kiểm tồn tại, E015), chưa có hộp duyệt file của dự án. Ảnh trong tin nhắn agent không hiển thị (Studio không tải tài nguyên ngoài).
- `#47` R-CH-03: Studio nhận `turnId` từ `agent.event` đầu tiên của lượt đang chạy, vì `POST /agent/turns` chỉ trả `jobId` (spec-log #44).

## 4. Tình huống test

Component test (Testing Library, jsdom) và unit test. Mock module `agent-client`, `project-client`, `jobs-client` bằng `vi.spyOn`. Sự kiện server giả bằng `FakeSocket` giống `install-dialog.test.tsx` (gửi tới mọi socket đang mở).

| #   | Tình huống                                                                                                                                                                                           | Kỳ vọng                                                                                                                                                                            | Mã                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| 1   | `agent-client`: mỗi hàm với phản hồi đúng; `fetchTurns` với phản hồi thiếu trường `state`                                                                                                            | Trả dữ liệu đã parse; phản hồi sai → promise bị từ chối                                                                                                                            |                     |
| 2   | Bấm `right-tab-chat`, render lại `RightPanel`                                                                                                                                                        | `chat-panel` hiện; lần render sau vẫn mở tab chat                                                                                                                                  | [R-CH-01]           |
| 3   | `trusted: false`                                                                                                                                                                                     | `chat-locked-untrusted` hiện đúng câu; `chat-input`, `chat-send` vô hiệu                                                                                                           | [R-CH-06]           |
| 4   | `trusted: true`, `fetchAgents` trả cả hai `installed: false`                                                                                                                                         | `chat-locked-no-agent` hiện; ô nhập vô hiệu                                                                                                                                        | [R-CH-06]           |
| 5   | Có phần tử chọn (`src/components/Header.tsx:12:5`, tag `header`), route `/about`, khung `desktop` 1440; gõ "Đổi màu" rồi Ctrl+Enter                                                                  | `startTurn` nhận đúng `{ prompt: 'Đổi màu', context: { element: { loc, tag: 'header' }, route: '/about', frame: { id: 'desktop', width: 1440 } }, conversation: 'new', docs: [] }` | [R-CH-01, R-CH-02]  |
| 6   | Enter (không Ctrl) trong ô nhập; ô chỉ có khoảng trắng                                                                                                                                               | Không gửi; nút `chat-send` vô hiệu khi rỗng                                                                                                                                        | [R-CH-01]           |
| 7   | Bấm ✕ thẻ phần tử rồi gửi; gửi lượt thứ hai                                                                                                                                                          | Lượt 1 không có `context.element`; sau khi gửi thẻ hiện lại; lượt 2 có `conversation: 'continue'`                                                                                  | [R-CH-02]           |
| 8   | Thêm tài liệu `docs/a.md`, `docs/b.md`, gỡ `docs/a.md`, gửi                                                                                                                                          | `docs: ['docs/b.md']`; sau gửi không còn thẻ tài liệu                                                                                                                              | [R-CH-02]           |
| 9   | Đang chạy: FakeSocket gửi `agent.event` lần lượt: `message "Đang "`, `message "đọc API"`, `tool read_file src/api.ts`, `message "Xong"`; rồi một sự kiện có `turnId` khác                            | Thread có: `user`, một bong bóng "Đang đọc API", dòng công cụ có `src/api.ts`, bong bóng "Xong"; sự kiện khác `turnId` không hiện                                                  | [R-CH-03]           |
| 10  | Tin nhắn agent: `**đậm** <img src=x onerror="alert(1)"> <script>alert(1)</script> [xấu](javascript:alert(1)) [tốt](https://example.com)`                                                             | Có `<strong>`; **không** có phần tử `img`, `script` trong DOM; "xấu" không phải thẻ `a`; "tốt" là `a` với `target="_blank"`, `rel="noreferrer"`                                    | [S-14, S-15, S-114] |
| 11  | Đang chạy, bấm `chat-cancel`; rồi FakeSocket gửi `job.cancelled` đúng `jobId`                                                                                                                        | `cancelJob(jobId)` được gọi; tóm tắt hiện "Đã hủy"; nút Hủy biến mất                                                                                                               | [R-CH-03]           |
| 12  | `job.completed` với `TurnSummary` có 3 file; lượt khác: `job.failed` E027 `{ agent: 'agy', exitCode: 1 }`                                                                                            | Tóm tắt "Xong · 3 file đã đổi"; lượt lỗi hiện câu E027 đã dịch                                                                                                                     | [R-CH-03]           |
| 13  | `startTurn` từ chối với E018                                                                                                                                                                         | `chat-send-error` hiện câu E018 đã dịch; ô nhập giữ nguyên chữ                                                                                                                     | [R-CH-03]           |
| 14  | Backend: `fetchProject` có 1 backend → thẻ hiện; ✕ gọi `removeBackend(id)` rồi đọc lại; `chat-add-backend` → chọn thư mục → `chat-backend-confirm` gọi `addBackend(path)`; `addBackend` từ chối E016 | Đúng các lần gọi; lỗi hiện ở `chat-backend-error`                                                                                                                                  | [R-CH-07]           |

## 5. Kiểm tay (chủ dự án)

Chạy `npm run dev` như thường lệ. Dùng **dự án mới tạo**.

1. Panel phải có tab **AI** bấm được. Chưa tin cậy dự án: ô chat báo lý do, không gõ được.
2. Tin cậy dự án, mở lại tab AI: ô chat mở.
3. Chọn tiêu đề trên Canvas: thẻ ngữ cảnh hiện phần tử, trang `/`, khung Desktop.
4. Gõ "Đổi tiêu đề này thành Xin chào", Ctrl+Enter:
   - tin nhắn của agent hiện dần, có dòng "đọc file / sửa file";
   - trên máy bạn agy sẽ hỏi xác nhận: gõ "Đồng ý" rồi Ctrl+Enter;
   - xong: "Xong · 1 file đã đổi", Canvas đổi tiêu đề.
5. Gửi một yêu cầu dài rồi bấm **Hủy**: dòng "Đã hủy".
6. Bấm **Thêm backend**, chọn một thư mục: thẻ backend hiện; hộp Project cũng thấy backend đó. Gỡ bằng ✕.
7. Chuyển giao diện sang `en`: mọi chữ trong ô chat là tiếng Anh.

## 6. Bẫy đã biết

1. Sự kiện `agent.event` đến **trước** khi `startTurn` trả `jobId` là chuyện có thể xảy ra. Tạo lượt `running` (chưa có `jobId`) ngay khi bấm Gửi, gắn `jobId` khi API trả về.
2. React StrictMode chạy effect hai lần: `createEventsClient` đã chịu được (một kết nối dùng chung), luôn `close()` trong cleanup.
3. Không dùng `dangerouslySetInnerHTML` ở bất kỳ đâu.
4. Phím: `event.key === 'Enter' && (event.ctrlKey || event.metaKey)`; gọi `preventDefault` chỉ khi gửi.
5. `react-markdown` 10 là ESM; kiểm `pnpm build` của Studio.
6. Không lách luật lint bằng mẹo. Gặp luật cản thì đổi thiết kế hoặc dừng và báo.

## 7. Báo cáo và commit

Báo cáo: file tạo và sửa (kèm số dòng), bảng 14 tình huống → tên test, kết quả `pnpm verify` (số test), các bước Kiểm tay đã tự thử, chỗ nào làm khác bản này và vì sao.

Commit (đã qua commitlint):

```
feat(studio): chat with the agent from the right panel
```
