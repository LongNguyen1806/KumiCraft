# Phase 3 — Lượt 6c: Studio dẫn người dùng cài, chọn, đăng nhập agent (R-AG-21, R-CH-06)

Đọc `README.md` cùng thư mục trước, nhất là mục **"Lỗi lint hay vấp"**, rồi làm đúng bản này. Kế hoạch phase: `p3-ke-hoach.md`. Quy tắc gốc: spec R-AG-10, R-AG-21, R-CH-06, S-54. Nền: lượt 6b đã làm xong server (`GET /agents`, `POST /agents/:id/install`, `POST /agents/:id/login`, E026 `notLoggedIn`), xem `p3-luot6b-cai-dat-agent.md` mục 3.

Lượt này **chỉ làm Studio**. Không sửa server, shared, Bridge, `e2e/`, `docs/spec.md`.

## 1. Mục tiêu (người dùng thấy gì)

Ô chat (tab AI) của dự án đã tin cậy dẫn người dùng qua từng bước. Không bắt đăng nhập trước; chỉ hỏi khi cần.

1. **Chưa cài agent nào:** ô chat hiện "Để dùng AI, hãy cài Antigravity CLI hoặc Claude Code". Bên dưới là hai thẻ agent, mỗi thẻ có nút **Cài đặt** và liên kết "Hướng dẫn chính thức".
   - Bấm **Cài đặt** → hộp xác nhận hiện **đúng** lệnh sẽ chạy (monospace) và câu "Lệnh này tải và chạy trình cài chính thức từ Internet".
   - Bấm **Đồng ý** → các dòng tiến trình cuộn, có nút **Dừng**.
   - Xong: tự kiểm tra lại và chuyển sang bước kế. Lỗi: câu đã dịch kèm vài dòng cuối.
2. **Phải chọn agent:** khi đã cài cả hai mà Cài đặt đang để "Tự động", hoặc agent đang chọn chưa cài nhưng agent kia đã cài.
   - Ô chat hiện "Chọn trợ lý AI" với hai thẻ. Thẻ đã cài có nút **Dùng agent này**; thẻ chưa cài có nút **Cài đặt**.
   - Chọn xong thì lưu vào `settings.agent.preferred` và vào ô chat.
3. **Sẵn sàng:** ô chat như hiện nay. Đầu ô chat có một dòng nhỏ: tên agent đang dùng + trạng thái đăng nhập (chấm xanh "Đã đăng nhập" / chấm xám "Chưa rõ đăng nhập" / chấm vàng "Chưa đăng nhập").
4. **Gửi khi chưa đăng nhập:** người dùng gõ yêu cầu rồi bấm Gửi; server từ chối E026 `notLoggedIn`.
   - Studio **tự mở cửa sổ đăng nhập** (`POST /agents/:id/login`), không cần bấm thêm. Yêu cầu vừa gõ vẫn nằm trong ô nhập.
   - Ô chat hiện thẻ "Đăng nhập Antigravity" với 3 bước:
     1. chọn đăng nhập Google trong cửa sổ terminal vừa mở;
     2. đăng nhập trên trình duyệt rồi bấm Copy mã;
     3. **dán mã vào cửa sổ terminal đó**, không dán vào ReactCraft.
   - Kèm vòng quay "Đang chờ bạn đăng nhập…", nút **Mở lại cửa sổ** và nút **Hủy**.
   - Studio dò `GET /agents` mỗi 3 s. Thấy agent đã `loggedIn` → thẻ chuyển "✓ Đã đăng nhập" rồi **tự gửi lại** đúng yêu cầu và tài liệu đính kèm đã có.
   - Sau 10 phút chưa xong thì dừng dò, hiện "Chưa thấy đăng nhập xong" với nút **Kiểm tra lại**.
5. **Agent không dò được đăng nhập (Claude):** server không chặn trước. Lượt thất bại (job lỗi E027) với agent `claude` thì dưới lỗi có gợi ý "Có thể Claude Code chưa đăng nhập" và nút **Đăng nhập**. Nút này mở cửa sổ và hiện cùng thẻ 3 bước, nhưng thay vì tự dò thì có nút **Tôi đã đăng nhập xong — gửi lại**.
6. **Cài đặt → mục "Trợ lý AI"** (dưới "Công cụ"):
   - Chọn agent: **Tự động / Antigravity / Claude Code**.
   - Mỗi agent một dòng: tên, trạng thái (Chưa cài / Đã cài · 1.4.3 · Đã đăng nhập…), nút **Cài đặt**, **Đăng nhập**, **Kiểm tra lại**.
   - Dùng chung component với ô chat.

## 2. Đọc trước (CW-52)

| File                                                                                                                      | Lý do                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `docs/construction/giao-viec/p3-luot6b-cai-dat-agent.md` mục 3                                                            | Hợp đồng server: `AgentStatus` (`installCommand`, `docsUrl`, `loginAvailable`, `login`) |
| `packages/shared/src/agent.ts`                                                                                            | `AgentStatusSchema`, `AgentInstallRequestSchema`                                        |
| `packages/studio/src/api/agent-client.ts`, `jobs-client.ts`                                                               | Thêm hàm gọi API; `cancelJob`                                                           |
| `packages/studio/src/features/project/use-install-job.ts`                                                                 | `useJobFollower` để tách dùng chung                                                     |
| `packages/studio/src/features/chat/chat-panel.tsx`, `chat-lock.tsx`, `chat-input.tsx`, `chat-thread.tsx`, `chat-store.ts` | `useAgentDiscovery`, màn khóa, `useSendTurn` (bắt lỗi khi gửi), lượt lỗi                |
| `packages/studio/src/features/settings/settings-dialog.tsx`, `store/settings-store.ts`                                    | Mẫu mục Cài đặt, `ChoicePill`, `update({ agent: { preferred } })`                       |
| `packages/studio/src/components/ui/dialog.tsx`                                                                            | Hộp xác nhận cài                                                                        |
| `packages/studio/src/routes/error-text.ts`                                                                                | `errorText` (đã đọc cả `params.missing` của E021)                                       |
| `packages/studio/src/app/styles.css`                                                                                      | Token màu của Studio (**không** có `brand`)                                             |

## 3. Hợp đồng

### 3.1. Client (`api/agent-client.ts`)

- `installAgent(id: AgentId, command: readonly string[]): Promise<{ jobId: string }>` → `POST agents/{id}/install` với `{ command }`, parse bằng `JobStartedSchema`.
- `openAgentLogin(id: AgentId): Promise<void>` → `POST agents/{id}/login` (204).

### 3.2. Store agent (`store/agents-store.ts`, zustand, mới)

```ts
type LoginFlow = {
  readonly agent: AgentId;
  readonly phase: 'opening' | 'waiting' | 'done' | 'timedOut' | 'failed';
  /** true khi agent không dò được đăng nhập (login 'unknown'): không tự dò, chờ người dùng bấm. */
  readonly manual: boolean;
  readonly error?: ErrorInfo | undefined;
  /** Gửi lại yêu cầu đang nằm trong ô nhập khi đăng nhập xong. */
  readonly resend: boolean;
};
type AgentsState = {
  readonly agents?: readonly AgentStatus[] | undefined;
  readonly checking: boolean;
  readonly loginFlow?: LoginFlow | undefined;
  refresh(): Promise<void>; // bỏ qua nếu đang có một lần refresh chạy
  startLogin(agent: AgentId, resend: boolean): Promise<void>;
  cancelLogin(): void;
  finishLogin(): void; // 'done' → xóa loginFlow sau khi đã gửi lại
};
```

- `startLogin`: `phase: 'opening'` → `openAgentLogin`. Lỗi thì `failed` + `error`; được thì `waiting`. `manual` = trạng thái hiện tại của agent là `unknown`.
- Hàm thuần `selectedAgent(agents, preferred)` (file `features/agents/agent-select.ts`):
  - `preferred` là `agy`/`claude` và đã cài → agent đó.
  - `auto` → agent đầu tiên (agy, claude) đã cài và không `loggedOut`; không có thì agent đầu tiên đã cài.
  - Còn lại → `undefined`.
- Hàm thuần `onboardingStep(agents, preferred)`:
  - `'install'` khi không agent nào cài;
  - `'choose'` khi (`auto` và cả hai đã cài) hoặc (`preferred` cụ thể chưa cài nhưng agent kia đã cài);
  - `'ready'` khi còn lại.

`chat-panel.tsx` bỏ `useAgentDiscovery` nội bộ, dùng store: gọi `refresh()` khi `trusted` và `agents === undefined`. Settings gọi `refresh()` khi mở hộp.

### 3.3. Dò chờ đăng nhập (`features/agents/use-login-watcher.ts`)

- Mount trong `ChatPanel`. Khi `loginFlow.phase === 'waiting'` và `!manual`: mỗi 3 s gọi `refresh()`. Agent trong flow có `login === 'loggedIn'` → `phase: 'done'`.
- Đếm 10 phút từ lúc bắt đầu chờ; quá thì `timedOut`. Dừng hẹn giờ khi unmount hoặc khi phase đổi.
- Dùng `setTimeout` lồng nhau (đợi `refresh()` xong mới hẹn lần sau), không dùng `setInterval`.

### 3.4. Gửi và tự gửi lại (`chat-input.tsx`)

- Trong `useSendTurn`, khi `startTurn` từ chối **E026 `notLoggedIn`** → `startLogin(params.agent, true)`, **không** hiện `chat-send-error`. Ô nhập đã được trả lại yêu cầu như hiện nay.
- Khi `loginFlow.phase === 'done' && resend` → gọi `send(draft, docs)` **đúng một lần**, rồi `finishLogin()`. Đặt trong một effect của `ChatInput`, có cờ chống gửi hai lần (ví dụ so `loginFlow` object, hoặc gọi `finishLogin()` trước khi gửi).
- Thẻ manual: bấm **Tôi đã đăng nhập xong — gửi lại** → `refresh()`, đặt `phase: 'done'` (giữ `resend`) → gửi lại như trên.
- E026 `notInstalled` khi gửi: `refresh()`; ô chat tự chuyển sang bước cài/chọn.

### 3.5. Giao diện

| File                                                               | `data-testid`                                                                                                                                                                                                                | Nội dung                                                                                                                                                                    |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/jobs/use-job-follower.ts` (tách từ `use-install-job.ts`) | —                                                                                                                                                                                                                            | Xuất `useJobFollower`, `failureOf`; `use-install-job.ts` import lại. Test cũ phải xanh nguyên                                                                               |
| `features/agents/use-agent-install.ts`                             | —                                                                                                                                                                                                                            | `phase` (`idle`/`confirming`/`running`/`failed`), `lines`, `failure`, `ask()`, `confirm()`, `stop()`, `close()`; xong thì `refresh()`                                       |
| `features/agents/agent-install-dialog.tsx`                         | `agent-install-dialog`, `agent-install-command`, `agent-install-docs`, `agent-install-confirm`, `agent-install-cancel`, `agent-install-lines`, `agent-install-stop`, `agent-install-error`                                   | Lệnh hiện nối bằng dấu cách; gửi lên đúng mảng `installCommand`. Tối đa `MAX_JOB_LINES` dòng                                                                                |
| `features/agents/agent-card.tsx`                                   | `agent-card-<id>`, `agent-status-<id>`, `agent-install-<id>`, `agent-use-<id>`, `agent-login-<id>`, `agent-recheck-<id>`                                                                                                     | Một agent: tên ("Antigravity CLI", "Claude Code"), trạng thái, nút theo tình huống (`variant: 'onboarding' \| 'settings'`). Đăng nhập chỉ khi `installed && loginAvailable` |
| `features/agents/agent-onboarding.tsx`                             | `agent-onboarding-install`, `agent-onboarding-choose`                                                                                                                                                                        | Bước install / choose của mục 1                                                                                                                                             |
| `features/agents/agent-login-card.tsx`                             | `agent-login-card`, `agent-login-steps`, `agent-login-waiting`, `agent-login-reopen`, `agent-login-cancel`, `agent-login-done`, `agent-login-timeout`, `agent-login-recheck`, `agent-login-manual-done`, `agent-login-error` | Thẻ 3 bước của mục 1.4, 1.5. Hiện phía trên ô nhập khi có `loginFlow`                                                                                                       |
| `features/agents/agent-badge.tsx`                                  | `agent-badge`                                                                                                                                                                                                                | Dòng tên agent + chấm trạng thái ở đầu ô chat (bước ready)                                                                                                                  |
| `features/agents/agent-section.tsx`                                | `settings-agent-preferred` (fieldset)                                                                                                                                                                                        | Mục "Trợ lý AI" trong Cài đặt: `ChoicePill` `auto`/`agy`/`claude` + hai `AgentCard variant="settings"`                                                                      |
| `features/settings/settings-dialog.tsx`                            | —                                                                                                                                                                                                                            | Chỉ thêm `<Section title=…><AgentSection /></Section>`                                                                                                                      |
| `features/chat/chat-panel.tsx`                                     | giữ `chat-panel`, `chat-locked-untrusted`                                                                                                                                                                                    | Theo `onboardingStep`: install / choose / ready. `ChatLock` bỏ nhánh `no-agent` (thay bằng onboarding)                                                                      |
| `features/chat/chat-thread.tsx`                                    | `chat-login-hint`                                                                                                                                                                                                            | Lượt `failed` với E027 và `agent === 'claude'`: gợi ý + nút gọi `startLogin('claude', true)`                                                                                |

Liên kết "Hướng dẫn chính thức": `<a href={docsUrl} target="_blank" rel="noreferrer noopener">`.

### 3.6. i18n

Khóa mới ở namespace `chat` (ô chat, thẻ đăng nhập, onboarding) và chỗ đang chứa `settings.*` (mục Cài đặt), đủ vi và en. Tên agent cố định: "Antigravity CLI", "Claude Code".

### 3.7. Spec-log (số tiếp theo sau #51)

- `#52` R-AG-21, R-CH-06: ô chat dẫn từng bước (cài → chọn → sẵn sàng). Gửi khi chưa đăng nhập thì tự mở cửa sổ đăng nhập, dò mỗi 3 s (tối đa 10 phút), xong tự gửi lại. Claude (không dò được) dùng nút "Tôi đã đăng nhập xong".

## 4. Tình huống test

Component test, mock client bằng `vi.spyOn`, sự kiện job bằng `FakeSocket` như lượt 5, hẹn giờ bằng `vi.useFakeTimers()` (nhớ `vi.useRealTimers()` ở `afterEach`). Hàm thuần test riêng.

| #   | Tình huống                                                                                                                                                                       | Kỳ vọng                                                                                                                                         | Mã                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 1   | `onboardingStep`, `selectedAgent` với các tổ hợp: không cài; chỉ agy; cả hai + auto; cả hai + claude; claude chọn nhưng chưa cài, agy cài; auto với agy `loggedOut` + claude cài | install; ready/agy; choose; ready/claude; choose; ready/claude                                                                                  | [R-AG-10, R-AG-21] |
| 2   | Ô chat, không agent nào cài                                                                                                                                                      | `agent-onboarding-install` có hai `agent-card-*`, mỗi thẻ có `agent-install-*` và liên kết docs đúng `docsUrl`                                  | [R-AG-21, R-CH-06] |
| 3   | Bấm `agent-install-agy` rồi `agent-install-cancel`                                                                                                                               | `agent-install-command` hiện đúng chuỗi lệnh; `installAgent` **không** được gọi                                                                 | [R-AG-21, S-54]    |
| 4   | Bấm `agent-install-confirm`; 2 `job.progress` rồi `job.completed`; `fetchAgents` lần sau trả agy đã cài                                                                          | `installAgent('agy', installCommand)` đúng mảng; 2 dòng; xong thì ô chat ở bước ready (có `chat-input` bật)                                     | [R-AG-21]          |
| 5   | `job.failed` E028 có 3 dòng; và bấm `agent-install-stop` khi đang chạy                                                                                                           | `agent-install-error` có câu E028 + dòng cuối; dừng gọi `cancelJob(jobId)`                                                                      | [R-AG-21]          |
| 6   | Cả hai đã cài, preferred `auto`                                                                                                                                                  | `agent-onboarding-choose`; bấm `agent-use-claude` → `update({ agent: { preferred: 'claude' } })`, sang bước ready                               | [R-AG-10]          |
| 7   | Bước ready với agy `loggedIn`; claude `unknown`; agy `loggedOut`                                                                                                                 | `agent-badge` có tên và trạng thái đúng từng trường hợp                                                                                         | [R-AG-21]          |
| 8   | Gửi; `startTurn` từ chối E026 `{ agent: 'agy', reason: 'notLoggedIn' }`                                                                                                          | `openAgentLogin('agy')` một lần; `agent-login-card` có 3 bước và `agent-login-waiting`; **không** có `chat-send-error`; ô nhập vẫn chứa yêu cầu | [R-AG-21]          |
| 9   | Tiếp #8: tiến 3 s, `fetchAgents` vẫn `loggedOut`; tiến thêm 3 s, `fetchAgents` trả `loggedIn`                                                                                    | `fetchAgents` gọi đúng 2 lần; `agent-login-done` hiện; `startTurn` được gọi lại **đúng một lần** với cùng `prompt` và `docs`                    | [R-AG-21]          |
| 10  | Tiếp #8: tiến 10 phút, agent vẫn `loggedOut`                                                                                                                                     | `agent-login-timeout` + `agent-login-recheck`; sau đó tiến thêm 30 s **không** gọi `fetchAgents` nữa                                            | [R-AG-21]          |
| 11  | Tiếp #8: bấm `agent-login-reopen`; rồi bấm `agent-login-cancel`                                                                                                                  | `openAgentLogin` lần hai; hủy thì thẻ biến mất, ngừng dò, `startTurn` không được gọi lại                                                        | [R-AG-21]          |
| 12  | `openAgentLogin` bị từ chối E021 `{ missing: 'terminal' }`                                                                                                                       | `agent-login-error` có câu "Không mở được cửa sổ terminal…"                                                                                     | [R-AG-21]          |
| 13  | Claude (`login: 'unknown'`): `job.failed` E027 cho lượt của claude                                                                                                               | `chat-login-hint`; bấm → `openAgentLogin('claude')`, thẻ có `agent-login-manual-done`, **không** dò định kỳ                                     | [R-AG-21]          |
| 14  | Tiếp #13: bấm `agent-login-manual-done`                                                                                                                                          | `startTurn` gọi lại một lần với yêu cầu cũ                                                                                                      | [R-AG-21]          |
| 15  | Gửi; `startTurn` từ chối E026 `notInstalled`                                                                                                                                     | `fetchAgents` gọi lại; ô chat chuyển bước install hoặc choose theo kết quả                                                                      | [R-AG-21]          |
| 16  | Cài đặt: mở hộp                                                                                                                                                                  | `fetchAgents` được gọi; `settings-agent-preferred` có 3 lựa chọn; hai `agent-card-*` dạng settings                                              | [R-AG-21]          |
| 17  | Cài đặt: chọn pill `agy`; bấm `agent-login-agy`                                                                                                                                  | `update({ agent: { preferred: 'agy' } })`; `openAgentLogin('agy')`                                                                              | [R-AG-10, R-AG-21] |
| 18  | Agent đã cài, `loginAvailable: false`                                                                                                                                            | Không có `agent-login-<id>`                                                                                                                     | [R-AG-21]          |
| 19  | Chat và Cài đặt cùng mở; cài agy trong Cài đặt xong                                                                                                                              | Ô chat tự sang bước ready, không tải lại trang (chung `agents-store`)                                                                           | [R-AG-21, R-CH-06] |

## 5. Kiểm tay (chủ dự án)

`npm run dev`, dự án đã tin cậy, tab AI.

1. Máy đã có agy và đã đăng nhập: ô chat ở bước sẵn sàng, đầu ô chat hiện "Antigravity CLI · Đã đăng nhập" chấm xanh.
2. Mở **Cài đặt → Trợ lý AI**: Antigravity "Đã cài · 1.4.3 · Đã đăng nhập", Claude Code "Chưa cài".
3. Bấm **Cài đặt** ở Claude Code: hộp hiện lệnh `powershell.exe … irm https://claude.ai/install.ps1 | iex`. Bấm **Hủy** (hoặc Đồng ý nếu muốn cài thật).
4. Bấm **Đăng nhập** ở Antigravity: một cửa sổ terminal bật lên chạy agy. Đóng cửa sổ.
5. Gửi "Đổi tiêu đề trang Home thành Xin chào": chạy bình thường.
6. (Nếu cài Claude ở bước 3) Chọn Claude Code trong Cài đặt rồi gửi một yêu cầu: lượt lỗi thì thấy gợi ý đăng nhập; bấm vào thì cửa sổ terminal chạy `claude`.

Trường hợp "agy chưa đăng nhập" không giả lập được trên máy đã đăng nhập (VG-17); phần đó dựa vào test 8 đến 12.

## 6. Bẫy đã biết

1. Hẹn giờ dò phải dọn khi unmount và khi phase đổi; test kiểm "không gọi thêm" (#10, #11).
2. Tự gửi lại **đúng một lần**: React StrictMode chạy effect hai lần ở dev, nên phải có cờ chống gửi đôi (bấm `finishLogin()` trước khi gửi).
3. Không dùng `null`; ref theo mẫu `el ?? undefined`. Không `as`, `any`, `!`, eslint-disable.
4. Màu chỉ dùng token của Studio (`bg-primary`, `text-on-charcoal`, `text-ink-soft`, `border-line`, `bg-leaf`, `bg-sun`, `text-danger`…), **không** có `brand`.
5. Hàm >50 dòng hoặc file >400 dòng thì tách. `chat-input.tsx` đang 149 dòng: phần đăng nhập để trong `features/agents/`, `chat-input.tsx` chỉ gọi.
6. Liên kết ngoài luôn có `rel="noreferrer noopener"`.
7. Không lách luật lint bằng mẹo. Gặp luật cản thì đổi thiết kế hoặc dừng và báo.

## 7. Báo cáo và commit

Báo cáo:

- file tạo và sửa, kèm số dòng;
- bảng 19 tình huống → tên test;
- kết quả `pnpm verify` (số test);
- chỗ nào làm khác bản này và vì sao.

Commit (đã qua commitlint):

```
feat(studio): guide users to install, pick and sign in to an ai agent
```
