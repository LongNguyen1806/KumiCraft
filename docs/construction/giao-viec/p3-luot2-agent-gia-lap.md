# Phase 3 — Lượt 2: Agent giả lập, adapter agent, dò agent (WP-3.03a)

Đọc `README.md` cùng thư mục trước, nhất là mục **"Lỗi lint hay vấp"**, rồi làm đúng bản này. Kế hoạch phase: `p3-ke-hoach.md`. Kết quả chạy agent thật: `docs/construction/vg17-ket-qua.md` (**bắt buộc đọc**). Quy tắc: spec mục 23 (M-AG, interface `AgentAdapter`), R-AG-10, SPEC-06 mục 5 (R-QA-10 đến R-QA-13), SPEC-05 S-53, S-111, S-112, S-115.

Lượt này **chỉ làm server**. Chưa chạy lượt AI (lượt 4), chưa làm giao diện (lượt 5). Không sửa Studio, Bridge, `e2e/`, `docs/spec.md`, `packages/shared/src/agent.ts` (hợp đồng đã chốt ở lượt 1).

## 1. Mục tiêu (người dùng thấy gì)

1. Server biết máy có `agy` / `claude` không, phiên bản nào: `GET /api/v1/agents` trả `[{ id: 'agy', installed: true, version: '1.4.3', login: 'unknown' }, { id: 'claude', installed: false, login: 'unknown' }]`. Dò mỗi agent tối đa 5 giây.
2. Server dựng đúng **dòng lệnh** chạy agent: chỉ đọc thêm thư mục bản sao, không bao giờ có cờ nới quyền.
3. Server đọc được **đầu ra thật** của agy (mẫu ghi ở VG-17), đổi thành sự kiện chuẩn `AgentEvent`.
4. Có **agent giả lập** `fake-agent.mjs` cho mọi test sau này: nhận đúng tham số như agy, chạy theo kịch bản JSON (in sự kiện, ghi file, chờ, thoát).
5. Biến môi trường đăng nhập của agent (ví dụ `GH_TOKEN`, `ANTHROPIC_AUTH_TOKEN`) không còn bị xóa khi spawn (sửa lỗi S-53).

## 2. Đọc trước (CW-52)

| File                                                                         | Lý do                                                                |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `docs/construction/vg17-ket-qua.md`                                          | Tham số agy, định dạng stream-json, các loại `step_type`             |
| `packages/server/src/core/agent/adapters/fixtures/agy-*.jsonl`               | Đầu ra **thật** của agy (đã ẩn đường dẫn). Không sửa các file này    |
| `docs/spec.md` mục 23 (khối `interface AgentAdapter`), SPEC-06 mục 5         | Hợp đồng gốc                                                         |
| `packages/shared/src/agent.ts`                                               | `AgentId`, `AgentStatus`, `AgentEvent` (dùng, không sửa)             |
| `packages/server/src/core/ports/process-port.ts`                             | `spawn(command, args, { cwd, env, timeoutMs })`, `wait()`, `kill()`  |
| `packages/server/src/adapters/system/node-process.ts` + test                 | `sanitizeEnvironment` (lỗi S-53), không tìm thấy lệnh → mã thoát 127 |
| `packages/server/src/adapters/http/routes/settings.ts`, `create-http-app.ts` | Cách khai báo route và deps                                          |
| `packages/server/src/server-services.ts`, `index.ts`                         | Nơi tạo service                                                      |
| `packages/server/src/core/shared/user-config.ts`                             | `settings().agent.preferred`                                         |

## 3. Hợp đồng

### 3.1. `core/agent/agent-types.ts` (mới)

```ts
import type { AgentEvent, AgentId } from '@kumicraft/shared';

/** How to start an agent: the real CLI name, or (tests only) `node fake-agent.mjs` (R-QA-12). */
export type AgentCommand = { readonly command: string; readonly prefixArgs: readonly string[] };

export type AgentTurnArgs = {
  readonly prompt: string;
  readonly mirrorDirs: readonly string[];
  readonly conversationId?: string | undefined;
};

export interface AgentAdapter {
  readonly id: AgentId;
  /** Default command when no test command is configured. */
  readonly defaultCommand: AgentCommand;
  /** S-111, S-112: fixed args, never a flag that widens the agent's permissions. */
  buildArgs(turn: AgentTurnArgs): readonly string[];
  /** One stdout line → a standard event; anything not understood → undefined. Never throws. */
  parseLine(line: string): AgentEvent | undefined;
}
```

### 3.2. Adapter `agy` — `core/agent/adapters/agy.ts` (mới)

`defaultCommand = { command: 'agy', prefixArgs: [] }`.

`buildArgs` trả **đúng thứ tự**:

```
['-p', prompt, '--output-format', 'stream-json', ...mirrorDirs.flatMap(d => ['--add-dir', d]), ...(conversationId ? ['--conversation', conversationId] : [])]
```

Cấm tuyệt đối các cờ `--dangerously-skip-permissions`, `--mode`, `--sandbox`, `--continue`, `-c`, `--prompt-interactive`, `-i`, `--remote-control` (S-112: quyền do cấu hình agy của người dùng quyết định).

`parseLine` (mỗi dòng một JSON; xem `vg17-ket-qua.md`):

| Dòng                                                                                                 | Sự kiện                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `event: 'init'` có `conversation_id` là chuỗi                                                        | `{ kind: 'conversation', id }`                                                                                                                                                                                      |
| `event: 'step_update'`, `step_type: 'agent_response'`, có `text_delta` là chuỗi khác rỗng            | `{ kind: 'message', text: text_delta }` (một **mẩu** chữ; Studio sẽ nối các mẩu liền nhau ở lượt 5)                                                                                                                 |
| `event: 'step_update'`, `step_type: 'tool'`, `state: 'ACTIVE'`, có `tool_name`                       | `{ kind: 'tool', name: tool_name, target? }`. `target` lấy theo thứ tự `tool_info.parameters.Path`, `.TargetFile`, `.AbsolutePath`, `.CommandLine`; không có thì bỏ trường. Cắt `name` ≤ 200, `target` ≤ 1024 ký tự |
| `event: 'step_update'`, `step_type: 'tool'`, `state: 'DONE'`                                         | `undefined` (đã báo lúc `ACTIVE`)                                                                                                                                                                                   |
| `event: 'result'`, `result.status` khác `'SUCCESS'`                                                  | `{ kind: 'error', message: 'agy: <status>' }` (cắt ≤ 4000)                                                                                                                                                          |
| `event: 'result'` với `SUCCESS`; `user_input`; `system_message`; dòng rỗng; không phải JSON; JSON lạ | `undefined`                                                                                                                                                                                                         |

Đọc JSON bằng `JSON.parse` trong `try`, rồi kiểm từng trường bằng **schema Zod khai báo trong file** (`z.looseObject` hoặc `.passthrough()` cho phần không dùng). Không ép kiểu `as`. Kết quả cuối qua `AgentEventSchema.safeParse` của shared trước khi trả.

### 3.3. Adapter `claude` — `core/agent/adapters/claude.ts` (mới)

Chưa có máy chạy thật nên viết theo định dạng `--output-format stream-json` đã công bố của Claude Code. Spec-log ghi "chưa kiểm bằng VG-17".

`defaultCommand = { command: 'claude', prefixArgs: [] }`.

`buildArgs`:

```
['-p', prompt, '--output-format', 'stream-json', '--verbose', ...mirrorDirs.flatMap(d => ['--add-dir', d]), ...(conversationId ? ['--resume', conversationId] : [])]
```

Cấm `--dangerously-skip-permissions`, `--permission-mode`, `--allowedTools`, `--continue`. Người dùng `claude` muốn agent tự sửa file thì tự cấu hình quyền trong Claude Code (S-112).

`parseLine`:

| Dòng                                                                                                         | Sự kiện                                                                                                             |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `type: 'system'`, `subtype: 'init'`, có `session_id`                                                         | `conversation`                                                                                                      |
| `type: 'assistant'`, `message.content[]`: lấy **phần tử đầu tiên** có `type: 'text'` hoặc `type: 'tool_use'` | `text` → `message`; `tool_use` → `tool` với `name`, `target` = `input.file_path` ?? `input.path` ?? `input.command` |
| `type: 'result'`, `is_error: true`                                                                           | `error` với `message: 'claude: ' + (result ?? subtype)`                                                             |
| còn lại                                                                                                      | `undefined`                                                                                                         |

Mẫu cho test (tạo file `fixtures/claude-sample.jsonl` đúng 5 dòng này):

```
{"type":"system","subtype":"init","session_id":"sess-123","cwd":"C:\\work\\project","tools":["Read","Edit"]}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"I will read the API."}]}}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"t1","name":"Read","input":{"file_path":"C:\\work\\mirror\\api.js"}}]}}
{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"t1","content":"..."}]}}
{"type":"result","subtype":"error_max_turns","is_error":true,"result":"Reached max turns"}
```

### 3.4. Dò agent và chọn agent — `core/agent/agent-service.ts` (mới)

```ts
export type AgentServiceDeps = {
  readonly process: ProcessPort;
  readonly settings: () => Settings; // settings().agent.preferred
  /** Tests point agents at fake-agent.mjs here (R-QA-12); production leaves it undefined. */
  readonly commands?: Partial<Record<AgentId, AgentCommand>> | undefined;
  /** Default 5000 (R-AG-10); tests pass a small value. */
  readonly detectTimeoutMs?: number | undefined;
};

export type AgentService = {
  /** R-AG-10: every agent, detected in parallel. */
  statuses(): Promise<readonly AgentStatus[]>;
  /** The agent to run: preferred, or 'auto' = agy then claude. None → E026 notInstalled. */
  resolve(): Promise<
    Result<{
      readonly adapter: AgentAdapter;
      readonly command: AgentCommand;
      readonly status: AgentStatus;
    }>
  >;
};
export function createAgentService(deps: AgentServiceDeps): AgentService;
```

**Dò một agent:** spawn `command` với `[...prefixArgs, '--version']`, `cwd: os.tmpdir()`, `timeoutMs: detectTimeoutMs`.

- Mã thoát 0 **và** dòng đầu của stdout (đã trim) khớp `/^v?\d+\.\d+/` → `installed: true`, `version` = dòng đó (cắt ≤ 100).
- Còn lại (127 = không tìm thấy, 124 = quá giờ, mã khác) → `installed: false`, không có `version`.
- `login` luôn `'unknown'`: VG-17 chưa tìm được cách dò đăng nhập mà không tốn lượt. Ghi spec-log.

**`resolve`:**

- `preferred: 'agy'` hoặc `'claude'`: agent đó cài rồi thì dùng; chưa cài → `err({ code: 'E026', params: { agent: <id>, reason: 'notInstalled' } })`.
- `'auto'`: `agy` nếu cài, không thì `claude`; cả hai chưa cài → E026 với `agent: 'agy'`.

Kiểm cách `err` và `params` được khai báo ở `core/shared/result.ts`, theo đúng kiểu đó.

### 3.5. Route `GET /api/v1/agents` — `adapters/http/routes/agents.ts` (mới)

`registerAgentRoutes(api, { agentService })` → `200 { data: AgentStatus[] }`. Nối qua `createHttpApp` (`agentRoutes?: AgentRoutesDeps`) giống `settingsRoutes`. Tạo `agentService` trong `server-services.ts` với `settings: () => config.settings()`. Không cần dự án đang mở.

### 3.6. Agent giả lập — `packages/server/test-support/fake-agent.mjs` (mới)

Script Node thuần (ESM, không phụ thuộc gói ngoài), **chỉ dùng trong test**. Đặt ngoài `src/` để không vào bản build. Kiểm `pnpm lint` có quét file này; nếu cấu hình eslint không phủ thư mục `test-support/` thì báo trong báo cáo, không sửa cấu hình eslint.

**Tham số (R-QA-10), giống adapter agy:**

- `--version` (đứng một mình): in `0.0.0-fake` và thoát 0.
- Chạy lượt: bắt buộc `-p <prompt>` và `--output-format stream-json`; tùy chọn `--add-dir <dir>` (lặp được), `--conversation <id>`.
- Thiếu tham số bắt buộc, tham số lạ (ví dụ `--mode`), cờ thiếu giá trị → ghi lý do ra **stderr**, thoát mã **2**.

**Ghi lại lần gọi (cho test S-111, S-115):** nếu có biến môi trường `RC_FAKE_AGENT_RECORD` (đường dẫn file), ghi JSON `{ "argv": [...tham số sau tên script], "cwd": process.cwd(), "envKeys": [tên mọi biến môi trường, đã sort] }` **trước** khi chạy kịch bản.

**Kịch bản (R-QA-11):** biến `RC_FAKE_AGENT_SCRIPT` là đường dẫn file JSON `{ "steps": Step[] }`. Không có biến thì in một dòng `init` và một dòng `result` `SUCCESS` rồi thoát 0. Các loại bước:

| Bước                                 | Làm gì                                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `{ "emit": <object> }`               | In `JSON.stringify(object)` + `\n` ra stdout                                                                                         |
| `{ "write": { "path", "content" } }` | Ghi file trong `cwd`, tạo thư mục cha. Đường dẫn tuyệt đối hoặc có `..` → stderr, thoát 3 (giả lập không bao giờ ghi ra ngoài dự án) |
| `{ "read": "<path>" }`               | Đọc file (trong `cwd` hoặc một `--add-dir`); không có thì bỏ qua                                                                     |
| `{ "stderr": "<text>" }`             | In ra stderr                                                                                                                         |
| `{ "wait": <ms> }`                   | Chờ                                                                                                                                  |
| `{ "exit": <code> }`                 | Thoát ngay với mã đó                                                                                                                 |

Hết bước mà chưa `exit` → thoát 0. Trong chuỗi `emit`, giá trị `"$CONVERSATION"` được thay bằng `--conversation` nếu có, không thì `"fake-conv-1"`.

**Kịch bản mẫu bắt buộc (R-QA-13)** ở `packages/server/test-support/agent-scripts/`, dòng `emit` theo **đúng định dạng agy** trong fixtures:

1. `success-edit.json`: `init` → 2 mẩu `agent_response` → tool `write_file` `ACTIVE` (`Path` là `src/App.tsx`) → ghi `src/App.tsx` → tool `write_file` cho `src/main.tsx` → ghi `src/main.tsx` → tool `write_file` cho `src/pages/Products.tsx` → ghi file mới đó → `result` `SUCCESS`. Ba file có nội dung chứa chuỗi `fake-agent`.
2. `fail-midway.json`: `init` → ghi `src/App.tsx` → `stderr` "fake failure" → `result` với `status: "ERROR"` → `exit` 1.
3. `hang.json`: `init` → 1 mẩu `agent_response` → `wait` 3600000.

### 3.7. Sửa S-53 — `sanitizeEnvironment`

S-53: "bỏ mọi biến `KUMICRAFT_*` và token phiên. Biến khác giữ nguyên (agent cần cấu hình đăng nhập của chính nó)". Token phiên của KumiCraft **không** nằm trong biến môi trường (lưu trong file cấu hình). Vì vậy chỉ bỏ biến bắt đầu bằng `KUMICRAFT_`, **bỏ** điều kiện `key.toLowerCase().includes('token')`.

Test cũ `strips KUMICRAFT_* and token env variables` đang khẳng định `SESSION_TOKEN`, `my_token` bị xóa, tức là khẳng định **sai** so với spec. Được phép sửa test đó: đổi tên thành `strips only KUMICRAFT_* variables [S-53]` và khẳng định `GH_TOKEN`, `my_token` **còn**, `KUMICRAFT_X` **mất**. Đây là ngoại lệ duy nhất được sửa test cũ.

### 3.8. Spec-log (số tiếp theo sau #38)

- `#39` R-AG-10: `login` luôn `'unknown'` vì VG-17 chưa có cách dò đăng nhập không tốn lượt; lỗi đăng nhập sẽ hiện qua E027 khi chạy lượt (lượt 4).
- `#40` M-AG: sự kiện `message` của agy là **mẩu** chữ (`text_delta`); Studio nối các mẩu liền nhau. Adapter `claude` viết theo định dạng công bố, chưa kiểm bằng VG-17 vì máy chủ dự án chưa có `claude`. Adapter `claude` không truyền `--permission-mode`: người dùng tự cấu hình quyền trong Claude Code (S-112).
- `#41` S-53: `sanitizeEnvironment` trước đây xóa mọi biến chứa `token` (kể cả biến đăng nhập của agent). Sửa: chỉ xóa `KUMICRAFT_*`.

## 4. Tình huống test

Test agent giả lập spawn thật qua `createNodeProcess()` với `command: process.execPath`, `prefixArgs: [<đường dẫn tuyệt đối fake-agent.mjs>]`, `cwd` là thư mục tạm (`mkdtemp`).

| #   | Tình huống                                                                                                                                                                                                                                                     | Kỳ vọng                                                                                                                                                                                                                         | Mã                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| 1   | agy `buildArgs` với prompt `"Tạo trang"`, `mirrorDirs` hai thư mục, không `conversationId`; rồi có `conversationId: 'c-1'`                                                                                                                                     | Mảng đúng thứ tự mục 3.2; lần hai đuôi là `--conversation`, `c-1`; không chứa cờ nào trong danh sách cấm                                                                                                                        | [S-111, S-112]       |
| 2   | agy `parseLine` trên **từng dòng** `fixtures/agy-11-add-dir.jsonl`                                                                                                                                                                                             | Sự kiện đầu `{ kind: 'conversation', id: 'cf1d6f30-5286-449d-8cd7-d10571136c00' }`; đúng **một** `tool` `read_file` có `target` kết thúc bằng `api.js`; nối các `message` chứa `/api/products`; không có `error`                |                      |
| 3   | agy `parseLine` trên `fixtures/agy-13-approve.jsonl`                                                                                                                                                                                                           | Đúng **một** `tool` `write_file` (`ACTIVE`), `target` kết thúc bằng `b.txt`; không có `error`                                                                                                                                   |                      |
| 4   | agy `parseLine` với: `''`, `'not json'`, `'{}'`, `'{"event":"step_update","step_update":{"step_type":"user_input"}}'`, dòng `result` `SUCCESS`, dòng `result` có `status: "ERROR"`                                                                             | 5 dòng đầu → `undefined`; dòng cuối → `{ kind: 'error', message: 'agy: ERROR' }`                                                                                                                                                |                      |
| 5   | claude `buildArgs` (có và không `conversationId`) và `parseLine` trên 5 dòng `claude-sample.jsonl`                                                                                                                                                             | Args đúng mục 3.3, không có cờ cấm. Sự kiện: `conversation sess-123`, `message`, `tool Read` với target `C:\work\mirror\api.js`, `undefined`, `error 'claude: Reached max turns'`                                               | [S-112]              |
| 6   | Giả lập: `--version`                                                                                                                                                                                                                                           | stdout `0.0.0-fake`, mã 0                                                                                                                                                                                                       | [R-QA-10]            |
| 7   | Giả lập: `-p x --output-format stream-json --mode accept-edits`; rồi thiếu `-p`; rồi `--add-dir` không có giá trị                                                                                                                                              | Cả ba mã 2, stderr nêu tham số sai                                                                                                                                                                                              | [R-QA-10]            |
| 8   | Giả lập chạy `success-edit.json` trong dự án tạm có sẵn `src/App.tsx`, `src/main.tsx`; mọi dòng stdout qua adapter agy                                                                                                                                         | Hai file đổi, `src/pages/Products.tsx` được tạo; sự kiện theo thứ tự: `conversation`, `message`, `message`, `tool`, `tool`, `tool`; mã 0                                                                                        | [R-QA-11, R-QA-13]   |
| 9   | Giả lập chạy `fail-midway.json`                                                                                                                                                                                                                                | Mã 1; `src/App.tsx` đã đổi; có sự kiện `error` `agy: ERROR`                                                                                                                                                                     | [R-QA-13]            |
| 10  | Giả lập chạy `hang.json`; đợi dòng `init` qua `onLine`, rồi `kill()`                                                                                                                                                                                           | `wait()` xong trong < 5 s; `process.kill(pid, 0)` báo tiến trình không còn                                                                                                                                                      | [R-QA-13]            |
| 11  | Giả lập với `write` có `path: "../outside.txt"`                                                                                                                                                                                                                | Mã 3; file ngoài không được tạo                                                                                                                                                                                                 | [R-QA-11]            |
| 12  | Ghi lần gọi: spawn qua `createNodeProcess` với `env: { RC_FAKE_AGENT_RECORD: <file>, GH_TOKEN: 'x' }` khi `process.env` có `KUMICRAFT_TEST_SECRET` (đặt trong test, xóa ở `afterEach`); args từ adapter agy với một thư mục bản sao                            | File ghi: `cwd` là thư mục dự án tạm; `argv` bằng đúng `buildArgs`; `envKeys` có `GH_TOKEN`, **không** có `KUMICRAFT_TEST_SECRET`                                                                                               | [S-111, S-115, S-53] |
| 13  | `sanitizeEnvironment` (sửa test cũ như mục 3.7)                                                                                                                                                                                                                | Chỉ `KUMICRAFT_*` bị xóa                                                                                                                                                                                                        | [S-53]               |
| 14  | `createAgentService` với `commands.agy` = giả lập, `commands.claude` = `{ command: 'rc-no-such-agent-xyz', prefixArgs: [] }`; `statuses()`; rồi `resolve()` với `preferred` lần lượt `auto`, `claude`, `agy`                                                   | `statuses` = `[{ id:'agy', installed:true, version:'0.0.0-fake', login:'unknown' }, { id:'claude', installed:false, login:'unknown' }]`; `auto` → agy; `claude` → E026 `{ agent:'claude', reason:'notInstalled' }`; `agy` → agy | [R-AG-10, R-QA-12]   |
| 15  | Dò quá giờ: `commands.agy = { command: process.execPath, prefixArgs: ['-e', 'setTimeout(() => {}, 10000)'] }` (node chờ 10 s, bỏ qua `--version`), `detectTimeoutMs: 300`. Kèm route: `GET /api/v1/agents` có token → 200, `data` 2 phần tử; không token → 401 | agy `installed: false`, dò xong < 2 s; route đúng                                                                                                                                                                               | [R-AG-10]            |

## 5. Kiểm tay (chủ dự án)

1. `pnpm build`, chạy `kumicraft` như thường lệ, mở Studio.
2. Mở DevTools của Studio (F12) → Console, chạy:
   `fetch('/api/v1/agents', { headers: { authorization: 'Bearer ' + sessionStorage.getItem('kumicraft.sessionToken') } }).then(r => r.json()).then(console.log)`.
3. Kết quả có `agy` `installed: true`, `version: "1.4.3"`; `claude` `installed: false`.
4. Đổi tên tạm `agy.exe` (hoặc gỡ khỏi PATH), gọi lại: `agy` `installed: false`, phản hồi trong vài giây. Trả tên lại.
5. Không có bước nào gọi AI thật hay tốn hạn mức.

## 6. Bẫy đã biết

1. `onLine` của `ProcessPort` trộn cả stdout **và** stderr. `parseLine` phải bỏ qua dòng không phải JSON mà không ném lỗi.
2. agy in help ra **stderr**; `--version` in ra stdout. Dò chỉ dựa vào mã thoát + stdout.
3. Trên Windows, lệnh không tồn tại qua `cross-spawn` cho mã 127 (đã xử lý trong `setupExitPromise`); đừng thêm `shell: true`.
4. Test 10, 15: không dùng `setTimeout` cố định để "chờ cho chắc"; chờ dòng `init` bằng `onLine` + `Promise`.
5. Không đưa `fake-agent.mjs` vào `src/`, không import nó trong code sản phẩm.
6. Prompt đi qua tham số dòng lệnh: Windows giới hạn khoảng 32 000 ký tự. Lượt này không xử lý; ghi nhận cho lượt 4.
7. Không đọc, không in nội dung lời nhắc hay đầu ra agent vào log (S-89).

## 7. Báo cáo và commit

Báo cáo: file tạo và sửa (kèm số dòng), bảng 15 tình huống → tên test, kết quả `pnpm verify` (số test), các bước Kiểm tay đã tự thử, chỗ nào làm khác bản này và vì sao.

Commit (đã qua commitlint):

```
feat(server): detect agents and drive them through adapters
```
