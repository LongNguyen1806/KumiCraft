# Phase 3 — Lượt 4: Chạy lượt AI trong server (WP-3.03b)

Đọc `README.md` cùng thư mục trước, nhất là mục **"Lỗi lint hay vấp"**, rồi làm đúng bản này. Kế hoạch phase: `p3-ke-hoach.md`. Quy tắc: spec ADR-BE-33, mục 23 (R-AG-11 đến R-AG-17, khối API), SPEC-05 S-32, S-110, S-111, S-113, S-116, S-117, S-118.

Lượt này **ghép** các phần đã có thành một lượt AI hoàn chỉnh ở server và mở REST. Chưa có giao diện (lượt 5, 6). Không sửa Studio, Bridge, `e2e/`, `docs/spec.md`, `packages/shared/src/agent.ts`, các file trong `core/mirror/`, `core/agent/adapters/`, `core/agent/snapshot/` (chỉ **dùng**). Thiếu gì ở các module đó thì dừng và báo.

## 1. Mục tiêu (người dùng thấy gì — qua API, giao diện ở lượt 5)

1. `POST /api/v1/agent/turns { prompt, context, conversation, docs }` → `202 { data: { jobId } }`. Server: chụp dự án → làm mới bản sao backend → dựng lời nhắc → chạy agent trong thư mục dự án → phát từng `agent.event` qua WebSocket → so ảnh chụp lập danh sách file → lưu `TurnSummary`.
2. Chưa tin cậy dự án → E011; không có agent → E026; đang có lượt chạy → E018; chưa mở dự án → E021.
3. Hủy lượt (`POST /jobs/:id/cancel` có sẵn) hoặc quá 30 phút: dừng cả cây tiến trình. File đã đổi vẫn liệt kê và hoàn tác được.
4. Agent lỗi → E027, `TurnSummary` vẫn lưu với `state: 'failed'` và danh sách file.
5. `GET /agent/turns` (20 lượt gần nhất), `GET /agent/turns/:id/diff?file=…`, `POST /agent/turns/:id/revert`.
6. "Gõ tiếp" (`conversation: 'continue'`) dùng lại hội thoại của agent; "Hội thoại mới" thì không.

## 2. Đọc trước (CW-52)

| File                                                                   | Lý do                                                                                                                 |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `docs/spec.md` ADR-BE-33, mục 23, SPEC-05 mục 8                        | Quy tắc gốc                                                                                                           |
| `docs/construction/vg17-ket-qua.md`                                    | agy thật: `conversation_id`, cách hủy                                                                                 |
| `packages/server/src/core/agent/agent-service.ts`, `agent-types.ts`    | `resolve()` trả `adapter`, `command`; `buildArgs`, `parseLine`                                                        |
| `packages/server/src/core/agent/snapshot/snapshot-types.ts`            | `capture`, `finish`, `diff`, `revert`                                                                                 |
| `packages/server/src/core/mirror/mirror-types.ts`                      | `refresh` → `MirrorResult` (`state`, `dir`), `check`                                                                  |
| `packages/server/src/core/jobs/job-service.ts`                         | `start(kind, stepKey, run)`, `ctx.signal`, kết quả `ok`/`err` thành `job.completed`/`job.failed`, E018 khi trùng loại |
| `packages/server/src/core/shared/redact-secrets.ts`                    | S-32 cho mọi sự kiện agent                                                                                            |
| `packages/server/src/core/project/project-types.ts` (`getProjectInfo`) | `id`, `root`, `trusted`, `backends`                                                                                   |
| `packages/server/test-support/fake-agent.mjs`, `agent-scripts/*.json`  | Agent giả lập dùng cho mọi test lượt này                                                                              |
| `packages/server/src/adapters/http/routes/agents.ts`, `jobs.ts`        | Cách viết route, cách trả 202                                                                                         |
| `packages/shared/src/agent.ts`                                         | `StartTurnRequestSchema`, `TurnSummary`, `TurnNotice`, `TurnDiffSchema`, `AgentEventMessageSchema`                    |

## 3. Hợp đồng

Mã mới ở `packages/server/src/core/agent/`: `prompt.ts`, `turn-store.ts`, `turn-runner.ts` (tách thêm file nếu cần để hàm ≤ 50 dòng, file ≤ 400 dòng). Route ở `packages/server/src/adapters/http/routes/agent-turns.ts`.

### 3.1. `prompt.ts` (R-AG-13, S-117)

```ts
export const PROMPT_MAX_CHARS = 30_000; // Windows command lines stop near 32 767 characters
export const GUIDE_MAX_CHARS = 8_000;
export type PromptInput = {
  readonly request: string;
  readonly context: TurnContext;
  readonly mirrors: readonly { readonly label: string; readonly dir: string }[];
  readonly docs: readonly string[];
  readonly guide?: string | undefined; // content of .kumicraft/agent-guide.md
};
export function buildPrompt(input: PromptInput): Result<string>; // E016 { reason: 'promptTooLong', limit } over the cap
```

Văn bản trả về, đúng thứ tự, bỏ hẳn những dòng không có dữ liệu:

```
<request>

--- KumiCraft context ---
Selected element: <element.loc> (<element.tag>)
Page: <route>
Viewport: <frame.id>, <frame.width> px
Backend mirrors (read-only copies; never edit them):
- <label>: <dir>
Documents the user pointed to:
- <doc>

--- Project guide (.kumicraft/agent-guide.md) ---
<guide, cắt ở GUIDE_MAX_CHARS>
```

Không chèn bất kỳ nội dung file nào khác (S-117). Không bao giờ có đường dẫn **thật** của backend: chỉ `dir` của bản sao.

### 3.2. `turn-store.ts` (R-AG-16)

Lưu dưới `dataDir` (gốc FS), thư mục **con** `turns/<projectId>/meta/` để không lẫn với manifest ảnh chụp ở `turns/<projectId>/*.json`:

- `meta/summaries.json`: `{ version: 1, turns: TurnSummary[] }`, mới nhất **trước**, tối đa `keepTurns` (mặc định 20, test truyền nhỏ hơn).
- `meta/conversation.json`: `{ version: 1, agent: AgentId, id: string }`.

```ts
export type TurnStore = {
  list(projectId: string): Promise<readonly TurnSummary[]>;
  get(projectId: string, turnId: string): Promise<TurnSummary | undefined>;
  save(projectId: string, summary: TurnSummary): Promise<Result<void>>; // insert or replace by id, then trim
  conversation(
    projectId: string,
  ): Promise<{ readonly agent: AgentId; readonly id: string } | undefined>;
  setConversation(
    projectId: string,
    value: { readonly agent: AgentId; readonly id: string } | undefined,
  ): Promise<Result<void>>;
};
```

Đọc qua schema Zod (dùng `TurnSummarySchema` của shared). Hỏng hoặc thiếu thì coi như rỗng. Không lưu đầu ra thô của agent (R-AG-16).

### 3.3. `turn-runner.ts` (R-AG-11, R-AG-12, R-AG-14, R-AG-17)

```ts
export const AGENT_TURN_TIMEOUT_MS = 30 * 60 * 1000; // S-116
export type TurnRunnerDeps = {
  readonly fs: FileSystemPort;
  readonly process: ProcessPort;
  readonly jobs: JobService;
  readonly agents: Pick<AgentService, 'resolve'>;
  readonly mirror: Pick<MirrorService, 'refresh' | 'check'>;
  readonly snapshots: TurnSnapshotStore;
  readonly store: TurnStore;
  readonly project: () => Result<ProjectInfo>; // projectService.getProjectInfo
  readonly eventBus?: EventBusPort | undefined;
  readonly logger: LoggerPort;
  readonly now: () => Date;
  readonly newTurnId?: () => string; // default nanoid(10)
  readonly timeoutMs?: number | undefined; // tests only; default AGENT_TURN_TIMEOUT_MS
};
export type TurnRunner = {
  start(
    request: StartTurnRequest,
  ): Promise<Result<{ readonly jobId: string; readonly turnId: string }>>;
  list(): Promise<Result<readonly TurnSummary[]>>;
  diff(turnId: string, file: string): Promise<Result<string>>;
  revert(turnId: string): Promise<Result<TurnSummary>>;
};
```

**`start`** — kiểm theo thứ tự, mỗi bước sai thì trả lỗi **trước khi** tạo job:

1. `project()` lỗi → trả lỗi đó (E021).
2. `!trusted` → E011 `{ reason: 'untrusted' }` (S-110, S-81).
3. `agents.resolve()` lỗi → trả lỗi đó (E026).
4. Mỗi `docs[i]`: `fs.exists(root, doc)` sai → E015 `{ resource: 'file', id: doc }`.
5. `jobs.start('agent.turn', 'agent.turn', run)` (E018 nếu đang có lượt). Trả `{ jobId, turnId }`. Route chỉ gửi `{ jobId }` (spec); `turnId` dùng nội bộ và có trong mọi `agent.event`.

**`run(ctx)`**, theo đúng trình tự R-AG-12:

1. `snapshots.capture(projectId, root, turnId)`. Lỗi (ví dụ E016 `projectTooLarge`) → `return err(...)`, **không** spawn.
2. Với mỗi backend: `mirror.refresh(projectId, backend)`. `ready` → thêm `{ label, dir }`. `skipped`/`failed` → notice `backendSkipped`; `tooLarge` → notice `backendTooLarge` (R-MR-03, S-124).
3. Đọc `.kumicraft/agent-guide.md` của dự án nếu có (`fs.readText`, lỗi thì bỏ qua). `buildPrompt(...)`; lỗi → `return err(...)`.
4. `conversation === 'continue'` và `store.conversation()` cùng `agent` → `conversationId` đó. `'new'` → `store.setConversation(projectId, undefined)`.
5. Lưu `TurnSummary` ban đầu `state: 'running'`, `files: []`, `revertible: false`, `notices`.
6. Spawn `command.command`, args `[...command.prefixArgs, ...adapter.buildArgs({ prompt, mirrorDirs, conversationId })]`, `{ cwd: root, timeoutMs }` (S-111, S-115). `ctx.signal` bị hủy → `handle.kill()`.
7. `handle.onLine`: `adapter.parseLine(line)`. Có sự kiện → **che bí mật** (S-32) trong `text`, `target`, `message` bằng `redactSecrets`, rồi `eventBus.publish('agent.event', { turnId, event })`. Sự kiện `conversation` → `store.setConversation(projectId, { agent, id })`. Nhớ có sự kiện `error` hay không.
8. `const out = await handle.wait()`. Rồi `snapshots.finish(...)` → `files`. Với mỗi bản sao `ready`: `mirror.check` → `modified` → notice `mirrorModified` (S-118).
9. Trạng thái:
   - `ctx.signal.aborted` → `cancelled`;
   - `out.exitCode === 124` → `failed`, lỗi E020 `{ operation: 'agent', timeoutMs }`;
   - mã khác 0 hoặc có sự kiện `error` → `failed`, lỗi E027 `{ agent, exitCode }`;
   - còn lại → `completed`.
10. Lưu `TurnSummary` cuối: `finishedAt`, `files`, `revertible: files.length > 0`, `notices`. `completed` → `return ok(summary)`; `failed` → `return err(lỗi)`; `cancelled` → `return err({ code: 'E019', params: { jobId } })` (job service đã đánh dấu hủy).

Không ghi lời nhắc, đầu ra agent, đường dẫn file vào log (S-89). Log chỉ `projectId`, `turnId`, `agent`, mã thoát.

**`list`** → `store.list(projectId)`. **`diff`** → `snapshots.diff(projectId, turnId, file)`. **`revert`** → `snapshots.revert(projectId, root, turnId)`; thành công → `revertible: false`, lưu và trả `TurnSummary`. Cả ba: project chưa mở → E021.

### 3.4. Routes `agent-turns.ts`

| Route                                   | Đầu vào                           | Trả                                            |
| --------------------------------------- | --------------------------------- | ---------------------------------------------- |
| `POST /agent/turns`                     | body qua `StartTurnRequestSchema` | `202 { data: { jobId } }`; body sai → 400 E016 |
| `GET /agent/turns`                      | —                                 | `200 { data: TurnSummary[] }`                  |
| `GET /agent/turns/:id/diff?file=<path>` | `file` bắt buộc                   | `200 { data: { diff } }` (`TurnDiffSchema`)    |
| `POST /agent/turns/:id/revert`          | —                                 | `200 { data: TurnSummary }`                    |

Lỗi đi qua `sendError` như các route khác. Nối qua `createHttpApp` (`agentTurnRoutes?`) và `server-services.ts`.

**Thêm `'agent.event'` vào danh sách sự kiện WebSocket** được gửi cho Studio, nếu có bộ lọc ở `adapters/http` (kiểm `events.ts`). Payload đúng `AgentEventMessageSchema`.

### 3.5. Spec-log (số tiếp theo sau #43)

- `#44` R-AG-13: lời nhắc đi qua tham số dòng lệnh, giới hạn 30 000 ký tự (Windows), hướng dẫn `agent-guide.md` cắt ở 8 000 ký tự; vượt thì E016 `promptTooLong`. `POST /agent/turns` chỉ trả `{ jobId }` như spec; `turnId` có trong `agent.event` và kết quả job.
- `#45` R-AG-16: tóm tắt lượt và mã hội thoại lưu ở `<data>/turns/<projectId>/meta/`. Lượt bị hủy, quá hạn, lỗi vẫn lưu `TurnSummary` có danh sách file để hoàn tác.

## 4. Tình huống test

Dùng **file thật** (dự án tạm có `src/App.tsx`, `src/main.tsx`), `dataDir` tạm, `createNodeProcess()` thật, agent = `fake-agent.mjs` qua `createAgentService({ commands: { agy: { command: process.execPath, prefixArgs: [fakeAgentPath] }, claude: <lệnh không tồn tại> }, adapters })`, mirror và snapshot **thật**, job service thật, event bus thật (thu sự kiện). `project()` trả một `ProjectInfo` dựng trong test. Kịch bản truyền qua `RC_FAKE_AGENT_SCRIPT` (đặt `process.env` trong test, xóa ở `afterEach`; S-53 giữ biến không có tiền tố `KUMICRAFT_`).

Chờ job xong bằng cách nghe `job.completed` / `job.failed` / `job.cancelled` trên event bus, **không** dùng `setTimeout` cố định.

| #   | Tình huống                                                                                                                                                                                                                                                                                         | Kỳ vọng                                                                                                                                                                                   | Mã               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 1   | `buildPrompt` đủ dữ liệu (element, route, frame, 2 bản sao, 1 tài liệu, guide 9 000 ký tự); rồi chỉ có `request`; rồi `request` 29 000 ký tự + guide                                                                                                                                               | Lần 1: đúng văn bản mục 3.1, guide bị cắt còn 8 000; lần 2: chỉ `request` + phần context rỗng bị bỏ; lần 3: E016 `promptTooLong`                                                          | [R-AG-13, S-117] |
| 2   | `start` khi: `project()` trả E021; dự án `trusted: false`; `claude` được chọn mà chưa cài (`preferred: 'claude'`); `docs: ['docs/none.md']`                                                                                                                                                        | E021; E011 `untrusted`; E026; E015. Không có job nào được tạo, agent không chạy (file ghi lần gọi không tồn tại)                                                                          | [R-AG-11, S-110] |
| 3   | Lượt `success-edit.json`                                                                                                                                                                                                                                                                           | `job.completed` với `TurnSummary` `completed`, `files` = 2 `modified` + 1 `created` (đúng đường dẫn), `revertible: true`; `agent.event` theo đúng thứ tự adapter trả, mỗi cái có `turnId` | [R-AG-12]        |
| 4   | Lượt 3 với `RC_FAKE_AGENT_RECORD`; dự án có một backend `ok` trỏ tới thư mục tạm khác                                                                                                                                                                                                              | Bản ghi: `cwd` = gốc dự án; `argv` có `--add-dir <thư mục bản sao trong cacheDir>`, **không** có đường dẫn thật của backend; không có cờ cấm của S-112                                    | [S-111, S-112]   |
| 5   | Đang chạy `hang.json`, gọi `start` lần nữa                                                                                                                                                                                                                                                         | E018                                                                                                                                                                                      | [R-AG-11]        |
| 6   | `fail-midway.json`                                                                                                                                                                                                                                                                                 | `job.failed` E027 `{ agent: 'agy', exitCode: 1 }`; `TurnSummary` `failed`, `files` = `[src/App.tsx modified]`, `revertible: true`                                                         | [R-AG-17]        |
| 7   | `hang.json`, đợi `agent.event` đầu tiên rồi `jobs.cancel(jobId)`                                                                                                                                                                                                                                   | `job.cancelled`; tiến trình agent không còn (`process.kill(pid, 0)` ném); `TurnSummary` `cancelled`                                                                                       | [R-AG-14, S-116] |
| 8   | `hang.json` với `timeoutMs: 500`                                                                                                                                                                                                                                                                   | `job.failed` E020 `{ operation: 'agent', timeoutMs: 500 }`; `TurnSummary` `failed`                                                                                                        | [R-AG-14, S-116] |
| 9   | Lượt 1 `new` → lượt 2 `continue` → lượt 3 `new`, ghi lần gọi mỗi lượt                                                                                                                                                                                                                              | Lượt 2 có `--conversation fake-conv-1`; lượt 1 và 3 không có `--conversation`                                                                                                             | [R-AG-16]        |
| 10  | `keepTurns: 3`, chạy 4 lượt; tạo lại `TurnStore` mới cùng `dataDir`                                                                                                                                                                                                                                | `list` trả 3 lượt mới nhất, mới nhất trước                                                                                                                                                | [R-AG-16]        |
| 11  | Kịch bản `emit` tin nhắn `password=RC_SECRET_MARKER_9 done` và tool có `Path` chứa `api_key=RC_SECRET_MARKER_8`                                                                                                                                                                                    | Sự kiện phát ra chứa `«redacted»`; không sự kiện nào chứa `RC_SECRET_MARKER`                                                                                                              | [S-32]           |
| 12  | Backend `status: 'missing'`; và một bản sao `mirror` giả (đối tượng thỏa `Pick<MirrorService, 'refresh' \| 'check'>`) trả `ready` rồi `check` → `modified`                                                                                                                                         | Notice `backendSkipped`; notice `mirrorModified` trong `TurnSummary`                                                                                                                      | [R-MR-03, S-118] |
| 13  | Route qua `createHttpApp`: `POST /agent/turns` body thiếu `prompt` → 400 E016; body đúng → 202 `{ jobId }`; sau `job.completed`: `GET /agent/turns`, `GET …/diff?file=src/App.tsx` (có dòng `+`), `POST …/revert` → `revertible: false` và file về như cũ, revert lần hai → E016 `alreadyReverted` | Đúng như mô tả                                                                                                                                                                            | [R-AG-15]        |
| 14  | Dự án quá lớn (`snapshots` thật với `maxBytes` nhỏ)                                                                                                                                                                                                                                                | `job.failed` E016 `projectTooLarge`; agent **không** chạy (file ghi lần gọi không tồn tại)                                                                                                | [S-113]          |

## 5. Kiểm tay (chủ dự án) — có dùng **agy thật**, tốn ít hạn mức

Studio chưa có ô chat; thử bằng Console của Studio (F12). Dùng **dự án mới tạo** (không có quy tắc riêng; trên máy bạn agy sẽ hỏi xác nhận, gửi tiếp "Đồng ý" với `conversation: 'continue'`).

```js
const H = {
  authorization: 'Bearer ' + sessionStorage.getItem('kumicraft.sessionToken'),
  'content-type': 'application/json',
};
const send = (prompt, conversation = 'new') =>
  fetch('/api/v1/agent/turns', {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ prompt, context: {}, conversation, docs: [] }),
  })
    .then((r) => r.json())
    .then(console.log);
const turns = () =>
  fetch('/api/v1/agent/turns', { headers: H })
    .then((r) => r.json())
    .then(console.log);
```

1. Tin cậy dự án. `send('Đổi tiêu đề trang Home thành "Xin chào KumiCraft"')` → nhận `jobId`.
2. Đợi khoảng 1 phút, `turns()` → lượt mới nhất `completed`, `files` có `src/pages/Home.tsx` (nếu agy hỏi xác nhận: `send('Đồng ý', 'continue')` rồi `turns()` lại).
3. Canvas đổi tiêu đề.
4. `fetch('/api/v1/agent/turns/<id>/revert', { method: 'POST', headers: H }).then(r => r.json()).then(console.log)` → tiêu đề về như cũ trên Canvas.
5. Gửi một yêu cầu dài, gọi `fetch('/api/v1/jobs/<jobId>/cancel', { method: 'POST', headers: H })` → Task Manager không còn `agy.exe` của lượt đó.
6. Bỏ tin cậy dự án, `send('x')` → lỗi E011.

## 6. Bẫy đã biết

1. `jobs.start` gọi `run` ngay; mọi kiểm tra điều kiện phải xong **trước** `jobs.start`.
2. Khi hủy, job service tự đánh dấu `cancelled`; `run` vẫn phải chờ tiến trình dừng, `finish` ảnh chụp và lưu `TurnSummary` trước khi trả.
3. `onLine` trộn stdout và stderr; `parseLine` đã bỏ qua dòng lạ.
4. `ProcessPort` báo quá hạn bằng mã 124, không phải lỗi ném ra.
5. Đọc `agent-guide.md` bằng `readText` với gốc là thư mục dự án, đường dẫn `.kumicraft/agent-guide.md`.
6. Test đặt `process.env.RC_FAKE_AGENT_SCRIPT` phải xóa ở `afterEach`; các test chạy agent dùng `describe.sequential` nếu chung một biến môi trường.
7. Không lách luật lint bằng mẹo. Gặp luật cản thì đổi thiết kế hoặc dừng và báo.

## 7. Báo cáo và commit

Báo cáo: file tạo và sửa (kèm số dòng), bảng 14 tình huống → tên test, kết quả `pnpm verify` (số test), kết quả Kiểm tay nếu đã thử, chỗ nào làm khác bản này và vì sao.

Commit (đã qua commitlint):

```
feat(server): run agent turns end to end
```
