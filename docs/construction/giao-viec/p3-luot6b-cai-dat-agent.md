# Phase 3 — Lượt 6b: Cài đặt và đăng nhập agent ngay trong Studio (R-AG-21)

Đọc `README.md` cùng thư mục trước, nhất là mục **"Lỗi lint hay vấp"**, rồi làm đúng bản này. Kế hoạch phase: `p3-ke-hoach.md`. Quy tắc gốc: spec R-AG-10, R-AG-21, S-54, S-112. Lệnh cài và đăng nhập chính thức đã chốt ở `docs/construction/vg17-ket-qua.md`, mục "Bổ sung 2026-10-22".

Lượt này làm **cả server, shared và Studio**. Không sửa Bridge, `e2e/`, `docs/spec.md`, adapter `parseLine`/`buildArgs`, `turn-runner.ts`.

## 1. Mục tiêu (người dùng thấy gì)

1. **Cài đặt → mục "Trợ lý AI"** (mục mới, dưới "Công cụ"):
   - Chọn agent ưu tiên: **Tự động / Antigravity (agy) / Claude Code**. Lưu ngay vào `settings.agent.preferred`, giống các lựa chọn khác.
   - Mỗi agent một dòng: tên, trạng thái (**Chưa cài** / **Đã cài · phiên bản 1.4.3**), và các nút **Cài đặt**, **Đăng nhập**, **Kiểm tra lại**.
2. **Cài đặt agent** (S-54, R-AG-21):
   - Bấm **Cài đặt** → hộp xác nhận hiện **đúng** lệnh sẽ chạy (monospace), câu cảnh báo "Lệnh này tải và chạy trình cài chính thức từ Internet", và liên kết "Hướng dẫn chính thức".
   - Bấm **Đồng ý** → chạy như job, với các dòng tiến trình cuộn và nút **Hủy**.
   - Xong: tự kiểm tra lại, dòng chuyển sang "Đã cài". Lỗi: câu đã dịch kèm vài dòng cuối của trình cài.
3. **Đăng nhập** (chỉ khi đã cài):
   - Bấm → ReactCraft mở **cửa sổ terminal của hệ điều hành** chạy agent. Người dùng đăng nhập Google trong đó, ReactCraft không thấy và không giữ gì.
   - Studio hiện: "Đã mở cửa sổ đăng nhập. Làm xong trong cửa sổ đó rồi quay lại đây."
4. **Ô chat bị khóa vì chưa có agent** (R-CH-06): ngoài câu hiện có, hiện cùng các dòng agent như trong Cài đặt (dùng chung component). Cài xong thì ô chat **tự mở khóa**, không cần F5.
5. **Vừa cài xong vẫn dò được** (R-AG-10): PATH của server là PATH cũ lúc khởi động. Server thử thêm đường dẫn mặc định của trình cài, nên không cần khởi động lại ReactCraft.

## 2. Đọc trước (CW-52)

| File                                                                                                           | Lý do                                                                    |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `docs/construction/vg17-ket-qua.md` (mục 2026-10-22)                                                           | Lệnh cài, đăng nhập, đường dẫn mặc định                                  |
| `packages/server/src/core/agent/agent-service.ts`, `agent-types.ts`, `adapters/agy.ts`                         | Dò agent hiện tại, `AgentCommand`                                        |
| `packages/server/src/core/project/project-install.ts`                                                          | Mẫu job cài: so lệnh (E016 `commandMismatch`), spawn, hủy, quá giờ, E028 |
| `packages/server/src/server-services.ts`, `adapters/http/routes/agents.ts`, `adapters/http/create-http-app.ts` | Nơi lắp service và route                                                 |
| `packages/server/src/core/ports/process-port.ts`, `adapters/system/node-process.ts`                            | Mã 127 = không tìm thấy lệnh; `shell: false`                             |
| `packages/shared/src/agent.ts`, `job.ts`                                                                       | `AgentStatusSchema`, `JOB_KINDS` (đã có `agent.install`, `agent.login`)  |
| `packages/studio/src/features/project/use-install-job.ts`                                                      | `useJobFollower` (theo dõi job qua WebSocket) để dùng lại                |
| `packages/studio/src/features/settings/settings-dialog.tsx`, `store/settings-store.ts`                         | Mẫu mục Cài đặt, `ChoicePill`, `update({ agent })`                       |
| `packages/studio/src/features/chat/chat-panel.tsx`, `chat-lock.tsx`                                            | `useAgentDiscovery`, màn hình khóa                                       |

## 3. Hợp đồng

### 3.1. Shared (`agent.ts`)

`AgentStatusSchema` thêm ba trường:

```ts
installCommand: z.array(z.string().min(1).max(2000)).min(1).max(10).optional(), // đúng argv sẽ chạy (S-54)
docsUrl: z.url().max(500).optional(),
loginAvailable: z.boolean(), // máy này có cách mở terminal để đăng nhập
```

Thêm `AgentInstallRequestSchema = z.strictObject({ command: z.array(z.string().min(1).max(2000)).min(1).max(10) })`.

### 3.2. Kế hoạch cài theo hệ điều hành (adapter, không phải core)

File mới `packages/server/src/adapters/system/agent-setup-plans.ts`. Đây là hàm **thuần**, test được trên mọi máy:

```ts
export type AgentSetupPlan = {
  readonly installCommand: readonly string[];
  readonly docsUrl: string;
  /** Đường dẫn trình cài chính thức đặt agent vào; thử khi tên lệnh không có trong PATH. */
  readonly fallbackCommand?: string | undefined;
};
export type SetupEnvironment = {
  readonly platform: NodeJS.Platform;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly homeDir: string;
};
export function agentSetupPlans(sys: SetupEnvironment): Partial<Record<AgentId, AgentSetupPlan>>;
export function terminalCommand(
  sys: SetupEnvironment,
  agentCommand: string,
): readonly string[] | undefined;
```

| Agent    | Hệ điều hành  | `installCommand`                                                                                                           | `fallbackCommand`                                             |
| -------- | ------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `agy`    | win32         | `['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', 'irm https://antigravity.google/cli/install.ps1 \| iex']` | `%LOCALAPPDATA%\agy\bin\agy.exe` (nối bằng `path.win32.join`) |
| `agy`    | darwin, linux | `['bash', '-c', 'curl -fsSL https://antigravity.google/cli/install.sh \| bash']`                                           | `~/.local/bin/agy`                                            |
| `claude` | win32         | `['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', 'irm https://claude.ai/install.ps1 \| iex']`              | `%USERPROFILE%\.local\bin\claude.exe`                         |
| `claude` | darwin, linux | `['bash', '-c', 'curl -fsSL https://claude.ai/install.sh \| bash']`                                                        | `~/.local/bin/claude`                                         |

- `docsUrl`: agy `https://codelabs.developers.google.com/antigravity-cli-hands-on`; claude `https://docs.claude.com/en/docs/claude-code/setup`.
- Thiếu biến môi trường (ví dụ không có `LOCALAPPDATA`) thì bỏ `fallbackCommand`. Hệ điều hành khác ba hệ trên thì không có plan.
- **Không** thêm `-ExecutionPolicy Bypass` hay cờ nới quyền nào.

`terminalCommand` (mở cửa sổ terminal chạy agent):

| Hệ điều hành | argv                                                                                                                                                                 |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| win32        | `['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', "Start-Process -FilePath '<cmd>'"]`; dấu `'` trong `<cmd>` nhân đôi thành `''`                      |
| darwin       | `['osascript', '-e', 'tell application "Terminal" to do script "<cmd>"']`. `<cmd>` bọc nháy đơn của shell (`'` → `'\''`), rồi thoát `\` và `"` cho chuỗi AppleScript |
| linux        | `['x-terminal-emulator', '-e', '<cmd>']`                                                                                                                             |
| khác         | `undefined`                                                                                                                                                          |

### 3.3. Core: dò agent có đường dẫn dự phòng (`agent-service.ts`)

- `AgentServiceDeps` thêm `fallbackCommands?: Partial<Record<AgentId, AgentCommand>>`. Composition root lấy từ `plan.fallbackCommand` với `prefixArgs: []`.
- `detectAgent`: thử lệnh như hiện nay. Chưa cài **và** agent không có lệnh test (`deps.commands?.[id]`) **và** có `fallbackCommands[id]` → thử lệnh dự phòng.
- Lệnh nào trả lời đúng thì **dùng lệnh đó** cho `resolve()` (lượt AI) và cho Đăng nhập. Cụ thể: `detectAgent` trả kèm `command` đã dùng (kiểu nội bộ, không đưa ra API), và `resolve()` lấy `command` từ đó thay vì `resolveCommand`.
- `statuses()` vẫn trả `AgentStatus` theo shared (thêm `installCommand`, `docsUrl`, `loginAvailable` từ deps mới `setup`, xem 3.4).

### 3.4. Core: `agent-setup-service.ts` (mới, `core/agent/`)

```ts
export type AgentSetupDeps = {
  readonly process: ProcessPort;
  readonly jobs: JobService;
  readonly agents: AgentService;
  readonly plans: Partial<Record<AgentId, { installCommand: readonly string[]; docsUrl: string }>>;
  /** argv mở terminal chạy lệnh agent; undefined khi máy này không có cách (composition root truyền `terminalCommand`). */
  readonly terminal: (agentCommand: string) => readonly string[] | undefined;
};
export type AgentSetupService = {
  startInstall(id: AgentId, command: readonly string[]): Result<{ readonly jobId: string }>;
  openLogin(id: AgentId): Promise<Result<void>>;
};
```

**`startInstall`:**

- Không có plan, hoặc `command` khác `installCommand` → E016 `{ reason: 'commandMismatch' }`. Dùng lại `checkInstallCommand` của `project-install.ts`: import từ core sang core là hợp lệ. Nếu thấy nên chuyển hàm sang `core/shared/` thì chuyển và giữ test cũ xanh.
- Chạy `jobs.start('agent.install', 'jobs:agentInstall.running', …)`: spawn với `cwd: homeDir` (truyền vào deps) và `timeoutMs: 600_000`; `ctx.reportLine` từng dòng; hủy thì `kill()`.
- Mã ra: 124 → E020 `{ timeout: 600 }`; 127 → E021 `{ missing: 'installer' }`; khác 0 → E028 kèm 200 dòng cuối.
- Thành công: gọi `agents.statuses()` (dò lại). Job đang chạy thì E018 (JobService đã lo).
- **Không** cần dự án mở, **không** cần tin cậy: cài agent là việc của máy, không của dự án.

**`openLogin`:**

- Agent chưa cài → E021 `{ missing: 'agent' }`.
- `terminal(command.command)` trả `undefined` → E021 `{ missing: 'terminal' }`.
- Spawn argv đó (`cwd: homeDir`, **không** `timeoutMs`), rồi đợi tối đa 3 s bằng `Promise.race(wait, 3 s)`:
  - thoát mã 127 → E021 `{ missing: 'terminal' }`;
  - thoát mã khác 0 → E028;
  - còn chạy sau 3 s (Linux: terminal chạy tới khi người dùng đóng) → coi là đã mở, **không** kill.
- Không dùng job `agent.login`: mở cửa sổ xong là hết việc, server không biết khi nào người dùng đăng nhập xong (spec-log #50).

### 3.5. REST (`routes/agents.ts`)

| Method | Path                  | Body                  | Trả                             | Lỗi                      |
| ------ | --------------------- | --------------------- | ------------------------------- | ------------------------ |
| GET    | `/agents`             | —                     | `AgentStatus[]` (đủ trường mới) | —                        |
| POST   | `/agents/:id/install` | `AgentInstallRequest` | 202 `{ jobId }`                 | E016, E018               |
| POST   | `/agents/:id/login`   | —                     | 204                             | E016 (id lạ), E021, E028 |

`:id` kiểm bằng `AgentIdSchema`, sai thì E016. Viết theo mẫu route có sẵn (envelope `{ data }`, mã lỗi qua helper chung).

### 3.6. i18n server-side / Studio

- `jobs.json` (vi, en): `agentInstall.running` ("Đang cài trợ lý AI…").
- `errors.json` E021: thêm câu cho `missing: 'agent'`, `'terminal'`, `'installer'`. Xem cách E021 đang dịch theo `missing`, thêm đúng kiểu đó; nếu E021 hiện chỉ có một câu chung thì thêm nhánh `missings` như E023 có `reasons`.
  - `terminal`: "Không mở được cửa sổ terminal. Hãy tự mở terminal và chạy lệnh agy."
  - `installer`: "Máy chưa có PowerShell/bash để chạy trình cài."
- Namespace `settings` (hoặc khóa `settings.*` trong `common.json`, theo chỗ đang dùng) và `chat`: các chữ mới.

### 3.7. Studio

| File                                                                             | `data-testid`                                                                                                                                                                              | Nội dung                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api/agent-client.ts`                                                            | —                                                                                                                                                                                          | `installAgent(id, command)` → `{ jobId }`; `openAgentLogin(id)`                                                                                                                                                             |
| `store/agents-store.ts` (mới, zustand)                                           | —                                                                                                                                                                                          | `{ agents?, checking, refresh() }`. Settings và Chat dùng chung, để cài trong Cài đặt thì Chat mở khóa ngay. `chat-panel.tsx` bỏ `useAgentDiscovery` nội bộ, dùng store (gọi `refresh()` khi `trusted` và chưa có `agents`) |
| `features/project/use-install-job.ts` → tách `features/jobs/use-job-follower.ts` | —                                                                                                                                                                                          | Xuất `useJobFollower` (+ `applyEvent`, `applyStatus`, `failureOf`) dùng chung; `use-install-job.ts` import lại, test cũ phải xanh nguyên                                                                                    |
| `features/agents/agent-setup-row.tsx` (mới)                                      | `agent-row-<id>`, `agent-status-<id>`, `agent-install-<id>`, `agent-login-<id>`, `agent-recheck-<id>`                                                                                      | Một dòng agent: tên, trạng thái, nút. Nút Cài đặt chỉ khi `!installed && installCommand`; Đăng nhập chỉ khi `installed && loginAvailable`                                                                                   |
| `features/agents/agent-install-dialog.tsx` (mới)                                 | `agent-install-dialog`, `agent-install-command`, `agent-install-docs`, `agent-install-confirm`, `agent-install-cancel`, `agent-install-lines`, `agent-install-stop`, `agent-install-error` | Xác nhận (lệnh nối bằng dấu cách, chỉ để hiển thị; gửi lên đúng mảng `installCommand`) → tiến trình (tối đa `MAX_JOB_LINES` dòng) → xong thì `refresh()` và đóng; lỗi hiện câu đã dịch + dòng cuối                          |
| `features/agents/use-agent-install.ts` (mới)                                     | —                                                                                                                                                                                          | Như `useInstallJob`: `phase`, `lines`, `failure`, `start()`, `cancel()`                                                                                                                                                     |
| `features/agents/agent-login-note.tsx` hoặc trong row                            | `agent-login-opened`, `agent-login-error`                                                                                                                                                  | Sau `openAgentLogin` thành công: câu nhắc; lỗi: câu đã dịch                                                                                                                                                                 |
| `features/settings/settings-dialog.tsx`                                          | `settings-agent-preferred` (fieldset)                                                                                                                                                      | Mục "Trợ lý AI": pill `auto`/`agy`/`claude` + hai `AgentSetupRow`. Khi mở hộp Cài đặt thì `refresh()`                                                                                                                       |
| `features/chat/chat-lock.tsx`                                                    | giữ `chat-locked-no-agent`                                                                                                                                                                 | Với `no-agent`: thêm hai `AgentSetupRow` dưới câu khóa                                                                                                                                                                      |

Liên kết "Hướng dẫn chính thức": `<a href={docsUrl} target="_blank" rel="noreferrer noopener">`.

Màu: chỉ dùng token của Studio (`bg-primary`, `text-on-charcoal`, `text-ink-soft`, `border-line`, `text-danger`…), **không** có `brand`.

### 3.8. Composition root (`server-services.ts`)

- `const setupEnv = { platform: process.platform, env: process.env, homeDir: os.homedir() }`.
- `plans = agentSetupPlans(setupEnv)`. Truyền `fallbackCommands` vào `createAgentService`, rồi tạo `createAgentSetupService({ …, terminal: (cmd) => terminalCommand(setupEnv, cmd) })`.
- Lắp route mới.
- `server-services.ts` đang gần 400 dòng? Nếu vượt thì tách phần agent ra `server-agent-services.ts`.

### 3.9. Spec-log (số tiếp theo sau #48)

- `#49` R-AG-21: lệnh cài chính thức theo hệ điều hành (bảng 3.2). Đường dẫn dự phòng macOS/Linux (`~/.local/bin`) chưa kiểm trên máy thật.
- `#50` R-AG-21: Đăng nhập mở terminal hệ điều hành, không dùng job `agent.login` (server không biết khi nào đăng nhập xong). Trạng thái đăng nhập giữ `unknown`. Giữ `agent.login` trong `JOB_KINDS` để không đổi hợp đồng.
- `#51` R-AG-10: dò thêm đường dẫn mặc định của trình cài khi PATH cũ; lệnh tìm được dùng cho lượt AI.

## 4. Tình huống test

Server: unit test với `ProcessPort` giả (ghi lại argv), `JobService` thật, route test qua `app.inject`. Studio: component test, mock client bằng `vi.spyOn`, sự kiện job bằng `FakeSocket` như lượt 5.

| #   | Tình huống                                                                                                         | Kỳ vọng                                                                                                          | Mã                 |
| --- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------ |
| 1   | `agentSetupPlans` với win32, `LOCALAPPDATA=C:\Users\A\AppData\Local`                                               | `agy.installCommand` đúng bảng; `fallbackCommand` = `C:\Users\A\AppData\Local\agy\bin\agy.exe`                   | [R-AG-21]          |
| 2   | `agentSetupPlans` với linux; với win32 thiếu `LOCALAPPDATA`; với `aix`                                             | linux: lệnh `bash -c curl…`, fallback `~/.local/bin/agy`; thiếu biến: không có fallback; aix: `{}`               | [R-AG-21]          |
| 3   | `terminalCommand` win32 với `C:\Users\O'Neil\agy.exe`; darwin với `/Users/a b/.local/bin/agy`; linux; aix          | win32: `''` đúng chỗ; darwin: chuỗi AppleScript đúng thoát; linux: `x-terminal-emulator -e`; aix: `undefined`    | [R-AG-21]          |
| 4   | Dò: `agy --version` mã 127, lệnh dự phòng trả `1.4.3`                                                              | `installed: true`, `version: '1.4.3'`; `resolve()` trả `command` là đường dẫn dự phòng                           | [R-AG-10]          |
| 5   | Dò khi có lệnh test (`commands.agy`) lỗi, có fallback                                                              | **Không** thử fallback; `installed: false`                                                                       | [R-AG-10, R-QA-12] |
| 6   | `GET /agents`                                                                                                      | Mỗi agent có `installCommand`, `docsUrl`, `loginAvailable` theo plan                                             | [R-AG-21]          |
| 7   | `POST /agents/agy/install` với lệnh khác `installCommand` một phần tử                                              | 400 E016 `commandMismatch`; không spawn                                                                          | [R-AG-21, S-54]    |
| 8   | Cài thành công: tiến trình in 2 dòng rồi mã 0                                                                      | 202 `jobId`; job có 2 dòng; `completed`; `statuses()` được gọi lại sau khi xong                                  | [R-AG-21]          |
| 9   | Cài lỗi mã 1; mã 124; mã 127                                                                                       | E028 có dòng cuối; E020 `{ timeout: 600 }`; E021 `{ missing: 'installer' }`                                      | [R-AG-21]          |
| 10  | Hủy job cài đang chạy; gửi cài lần hai khi lần một chưa xong                                                       | Tiến trình bị `kill`, job `cancelled`; lần hai 409 E018                                                          | [R-AG-21]          |
| 11  | `POST /agents/agy/login`: agy đã cài (qua fallback); chưa cài; `terminal` trả `undefined`; spawn mã 127            | 204 và argv mở terminal chứa đường dẫn fallback; E021 `agent`; E021 `terminal`; E021 `terminal`                  | [R-AG-21]          |
| 12  | `POST /agents/xyz/install`                                                                                         | 400 E016                                                                                                         | [R-AG-21]          |
| 13  | Studio, Cài đặt: agy chưa cài, bấm `agent-install-agy`                                                             | Hộp xác nhận hiện đúng chuỗi lệnh và liên kết docs; bấm hủy thì `installAgent` **không** được gọi                | [R-AG-21, S-54]    |
| 14  | Bấm `agent-install-confirm`, server gửi 2 `job.progress` rồi `job.completed`; `fetchAgents` lần sau trả agy đã cài | `installAgent('agy', installCommand)` đúng mảng; 2 dòng tiến trình; xong thì `agent-status-agy` "Đã cài · 1.4.3" | [R-AG-21]          |
| 15  | `job.failed` E028 có 3 dòng chi tiết; và bấm `agent-install-stop` khi đang chạy                                    | `agent-install-error` có câu E028 + dòng cuối; dừng thì `cancelJob(jobId)`                                       | [R-AG-21]          |
| 16  | Bấm `agent-login-agy`: thành công; bị từ chối E021 `terminal`                                                      | `agent-login-opened` hiện; lỗi thì `agent-login-error` có câu terminal đã dịch                                   | [R-AG-21]          |
| 17  | Chọn pill `claude` trong `settings-agent-preferred`                                                                | `update({ agent: { preferred: 'claude' } })`                                                                     | [R-AG-10]          |
| 18  | Chat khóa `no-agent` → cài agy ngay trong ô chat (giả job xong, `fetchAgents` trả đã cài)                          | Ô chat mở khóa (có ô nhập `chat-input`) mà không tải lại trang                                                   | [R-AG-21, R-CH-06] |
| 19  | Agent đã cài nhưng `loginAvailable: false`                                                                         | Không có nút `agent-login-<id>`                                                                                  | [R-AG-21]          |

## 5. Kiểm tay (chủ dự án)

`npm run dev`, mở Studio.

1. Mở **Cài đặt**: mục "Trợ lý AI" có Antigravity "Đã cài · 1.4.3", Claude Code "Chưa cài".
2. Bấm **Cài đặt** ở Claude Code: hộp hiện lệnh `powershell.exe … irm https://claude.ai/install.ps1 | iex` và liên kết hướng dẫn. Bấm **Hủy** (không cần cài thật). Muốn thử thật thì bấm Đồng ý và xem các dòng chạy.
3. Bấm **Đăng nhập** ở Antigravity: một cửa sổ terminal mở ra chạy `agy`. Đóng nó.
4. Chọn agent ưu tiên **Antigravity**, đóng rồi mở lại Cài đặt: vẫn chọn Antigravity.

## 6. Bẫy đã biết

1. Không thêm cờ nới quyền cho agent hay cho PowerShell (S-112). Lệnh cài phải giống **từng ký tự** với bảng 3.2.
2. `process.platform`, `process.env`, `os.homedir()` chỉ đọc ở composition root. Core nhận qua deps. Test truyền giá trị giả, **không** sửa `process.platform`.
3. Hàm >50 dòng hoặc file >400 dòng thì tách. `settings-dialog.tsx` chỉ thêm `<AgentSection />`, phần thân để ở `features/agents/agent-section.tsx`.
4. Hủy job phải dừng cả cây tiến trình: dùng `handle.kill()` như `project-install.ts`.
5. Đừng gọi `fetchAgents` ở cả Chat và Settings riêng rẽ: dùng `agents-store`.
6. Không lách luật lint bằng mẹo. Gặp luật cản thì đổi thiết kế hoặc dừng và báo.

## 7. Báo cáo và commit

Báo cáo:

- file tạo và sửa, kèm số dòng;
- bảng 19 tình huống → tên test;
- kết quả `pnpm verify` (số test);
- chỗ nào làm khác bản này và vì sao.

Commit (đã qua commitlint):

```
feat(server): install the ai agent and open its login from studio
```
