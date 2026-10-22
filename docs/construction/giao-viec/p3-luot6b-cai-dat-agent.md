# Phase 3 — Lượt 6b: Server cài agent, mở đăng nhập, dò đăng nhập (R-AG-10, R-AG-21)

Đọc `README.md` cùng thư mục trước, nhất là mục **"Lỗi lint hay vấp"**, rồi làm đúng bản này. Kế hoạch phase: `p3-ke-hoach.md`. Quy tắc gốc: spec R-AG-10, R-AG-21, S-54, S-112. Lệnh cài, đăng nhập và cách dò đăng nhập đã chốt ở `docs/construction/vg17-ket-qua.md`, mục "Bổ sung 2026-10-22".

Lượt này **chỉ làm server, shared và agent giả lập**. Không sửa Studio, Bridge, `e2e/`, `docs/spec.md`, `turn-runner.ts`, `parseLine`/`buildArgs` của adapter.

Lượt 6c (sau) làm Studio: màn hướng dẫn từng bước trong ô chat (cài → chọn agent → đăng nhập → sẵn sàng), mục "Trợ lý AI" trong Cài đặt. Lượt này phải cung cấp đủ API cho 6c.

## 1. Mục tiêu

Studio (lượt 6c) dựa vào API của lượt này để dẫn người dùng:

1. **Biết agent nào đã cài, cài bằng lệnh gì** (`GET /agents`). Vừa cài xong vẫn dò được, dù PATH của server là PATH cũ lúc khởi động.
2. **Cài agent bằng lệnh chính thức** như job, có tiến trình và hủy. Người dùng xác nhận đúng lệnh trước (S-54).
3. **Biết agent đã đăng nhập chưa.**
   - `agy`: dò bằng `agy models` (1 giây, không tốn lượt AI).
   - `claude`: chưa có cách dò, nên giữ `unknown`.
4. **Mở cửa sổ terminal của hệ điều hành** chạy agent để người dùng đăng nhập trong đó. Màn đăng nhập của agy bắt buộc terminal thật, qua ống dẫn thì không chạy (VG-17).
5. **Không bao giờ chạy lượt AI khi agent chưa đăng nhập.** Trước đây `agy -p` gặp lúc chưa đăng nhập thì mở trình duyệt rồi treo. Giờ `resolve()` trả E026 `notLoggedIn` ngay, và ô chat (6c) chuyển sang bước đăng nhập.

## 2. Đọc trước (CW-52)

| File                                                                                                           | Lý do                                                                    |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `docs/construction/vg17-ket-qua.md` (mục 2026-10-22)                                                           | Lệnh cài, đăng nhập, dò đăng nhập, đường dẫn mặc định                    |
| `packages/server/src/core/agent/agent-service.ts`, `agent-types.ts`, `adapters/agy.ts`, `adapters/claude.ts`   | Dò agent hiện tại, `AgentCommand`, `AgentAdapter`                        |
| `packages/server/src/core/project/project-install.ts`                                                          | Mẫu job cài: so lệnh (E016 `commandMismatch`), spawn, hủy, quá giờ, E028 |
| `packages/server/src/server-services.ts`, `adapters/http/routes/agents.ts`, `adapters/http/create-http-app.ts` | Nơi lắp service và route                                                 |
| `packages/server/src/core/ports/process-port.ts`, `adapters/system/node-process.ts`                            | Mã 127 = không tìm thấy lệnh; `shell: false`                             |
| `packages/server/test-support/fake-agent.mjs`                                                                  | Agent giả lập; thêm lệnh `models`                                        |
| `packages/shared/src/agent.ts`, `job.ts`                                                                       | `AgentStatusSchema`, `AGENT_LOGIN_STATES`, `JOB_KINDS`                   |
| `docs/spec.md` bảng mã lỗi (E016, E018, E020, E021, E026, E028)                                                | E026 đã có `reason: 'notLoggedIn'`                                       |

## 3. Hợp đồng

### 3.1. Shared (`agent.ts`)

`AgentStatusSchema` thêm ba trường. `login` giữ nguyên kiểu, nhưng giờ có giá trị thật (3.3).

```ts
installCommand: z.array(z.string().min(1).max(2000)).min(1).max(10).optional(), // đúng argv sẽ chạy (S-54)
docsUrl: z.url().max(500).optional(),
loginAvailable: z.boolean(), // agent đã cài và máy này có cách mở terminal để đăng nhập
```

Thêm `AgentInstallRequestSchema = z.strictObject({ command: z.array(z.string().min(1).max(2000)).min(1).max(10) })`, xuất qua `index.ts`.

Studio chưa dùng các trường mới, nhưng client parse bằng `AgentStatusSchema` nên vẫn phải chạy đúng. Sửa dữ liệu mẫu trong test Studio (thêm `loginAvailable`) nếu test cũ đỏ vì schema. Đây là sửa dữ liệu mẫu, **không** sửa assertion.

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

`terminalCommand` mở cửa sổ terminal chạy agent **không tham số**. Theo agy: "Launch the CLI without arguments to sign in".

| Hệ điều hành | argv                                                                                                                                                                 |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| win32        | `['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', "Start-Process -FilePath '<cmd>'"]`; dấu `'` trong `<cmd>` nhân đôi thành `''`                      |
| darwin       | `['osascript', '-e', 'tell application "Terminal" to do script "<cmd>"']`. `<cmd>` bọc nháy đơn của shell (`'` → `'\''`), rồi thoát `\` và `"` cho chuỗi AppleScript |
| linux        | `['x-terminal-emulator', '-e', '<cmd>']`                                                                                                                             |
| khác         | `undefined`                                                                                                                                                          |

### 3.3. Core: dò agent (`agent-service.ts`, `agent-types.ts`)

**Đường dẫn dự phòng:**

- `AgentServiceDeps` thêm `fallbackCommands?: Partial<Record<AgentId, AgentCommand>>`. Composition root lấy từ `plan.fallbackCommand` với `prefixArgs: []`.
- `detectAgent`: thử lệnh như hiện nay. Khi chưa cài **và** agent không có lệnh test (`deps.commands?.[id]`) **và** có `fallbackCommands[id]` thì thử lệnh dự phòng.
- Lệnh nào trả lời đúng thì **dùng lệnh đó** cho `resolve()` (lượt AI) và cho Đăng nhập. `detectAgent` trả kèm `command` đã dùng (kiểu nội bộ, không đưa ra API).

**Dò đăng nhập:**

- `AgentAdapter` thêm trường tùy chọn (không đụng `buildArgs`/`parseLine`):

  ```ts
  /** Lệnh hỏi nhanh trạng thái đăng nhập, không chạy lượt AI (VG-17). Không có thì login = 'unknown'. */
  readonly loginProbe?: {
    readonly args: readonly string[];
    classify(output: ProcessOutput): AgentLoginState;
  } | undefined;
  ```

- `agy`: `args: ['models']`. Phân loại:
  - mã 0 → `loggedIn`;
  - stdout hoặc stderr khớp `/sign in/i` → `loggedOut`;
  - còn lại → `unknown`.
- `claude`: không có `loginProbe`, nên luôn `unknown` (spec-log #50).
- `detectAgent`: khi đã cài và adapter có `loginProbe`, chạy `command` đã dùng + `prefixArgs` + `probe.args` với `timeoutMs: 10_000`, `cwd: tmpdir()`. Spawn lỗi hoặc quá giờ thì `unknown`. Chạy cả với lệnh test, vì agent giả lập có `models` (3.6).
- `statuses()` trả thêm `installCommand`, `docsUrl` (từ deps mới `plans`) và `loginAvailable` (`installed && terminal(...) !== undefined`, deps mới `terminalAvailable: boolean`).

**Chặn lượt AI khi chưa đăng nhập:**

- `resolvePreferred`: agent đã cài mà `login === 'loggedOut'` → E026 `{ agent, reason: 'notLoggedIn' }`.
- `resolveAuto`: chọn agent đầu tiên (thứ tự agy, claude) đã cài **và** `login !== 'loggedOut'`. Có agent đã cài nhưng tất cả `loggedOut` → E026 `notLoggedIn` của agent đầu tiên đã cài. Không agent nào cài → E026 `notInstalled` như cũ.
- `unknown` **không** chặn.
- `turn-runner.ts` đã gọi `agents.resolve()` trước khi spawn và trả lỗi đó cho job, nên **không** cần sửa turn-runner.

### 3.4. Core: `agent-setup-service.ts` (mới, `core/agent/`)

```ts
export type AgentSetupDeps = {
  readonly process: ProcessPort;
  readonly jobs: JobService;
  readonly agents: AgentService;
  readonly homeDir: string;
  readonly plans: Partial<Record<AgentId, { installCommand: readonly string[]; docsUrl: string }>>;
  /** argv mở terminal chạy lệnh agent; undefined khi máy này không có cách (composition root truyền `terminalCommand`). */
  readonly terminal: (agentCommand: string) => readonly string[] | undefined;
};
export type AgentSetupService = {
  startInstall(id: AgentId, command: readonly string[]): Result<{ readonly jobId: string }>;
  openLogin(id: AgentId): Promise<Result<void>>;
};
```

`AgentService` thêm `commandOf(id): Promise<AgentCommand | undefined>`, trả lệnh đã dò được của agent đã cài, để `openLogin` dùng đúng đường dẫn dự phòng.

**`startInstall`:**

- Không có plan, hoặc `command` khác `installCommand` → E016 `{ reason: 'commandMismatch' }`. Dùng lại `checkInstallCommand` của `project-install.ts` (import core sang core là hợp lệ). Thấy nên chuyển hàm sang `core/shared/` thì chuyển, và giữ test cũ xanh.
- Chạy `jobs.start('agent.install', 'jobs:agentInstall.running', …)`:
  - spawn với `cwd: homeDir`, `timeoutMs: 600_000`;
  - gọi `ctx.reportLine` cho từng dòng;
  - hủy thì `kill()`.
- Mã ra: 124 → E020 `{ timeout: 600 }`; 127 → E021 `{ missing: 'installer' }`; khác 0 → E028 kèm 200 dòng cuối.
- Thành công: gọi `agents.statuses()` để dò lại. Job đang chạy thì E018 (JobService đã lo).
- **Không** cần dự án mở, **không** cần tin cậy: cài agent là việc của máy, không của dự án.

**`openLogin`:**

- Agent chưa cài (`commandOf` trả `undefined`) → E021 `{ missing: 'agent' }`.
- `terminal(command.command)` trả `undefined` → E021 `{ missing: 'terminal' }`. Có `prefixArgs` (chỉ lệnh test) thì cũng E021 `terminal`, vì lệnh test không mở terminal.
- Spawn argv đó (`cwd: homeDir`, **không** `timeoutMs`), rồi đợi tối đa 3 s bằng `Promise.race(wait, 3 s)`:
  - thoát mã 127 → E021 `{ missing: 'terminal' }`;
  - thoát mã khác 0 → E028;
  - còn chạy sau 3 s (Linux: terminal chạy tới khi người dùng đóng) → coi là đã mở, **không** kill.
- Không dùng job `agent.login`. Studio (6c) tự hỏi lại `GET /agents` mỗi 3 s để biết khi nào đăng nhập xong.

### 3.5. REST (`routes/agents.ts`)

| Method | Path                  | Body                  | Trả                             | Lỗi                      |
| ------ | --------------------- | --------------------- | ------------------------------- | ------------------------ |
| GET    | `/agents`             | —                     | `AgentStatus[]` (đủ trường mới) | —                        |
| POST   | `/agents/:id/install` | `AgentInstallRequest` | 202 `{ jobId }`                 | E016, E018               |
| POST   | `/agents/:id/login`   | —                     | 204                             | E016 (id lạ), E021, E028 |

`:id` kiểm bằng `AgentIdSchema`, sai thì E016. Viết theo mẫu route có sẵn (envelope `{ data }`, mã lỗi qua helper chung).

### 3.6. Agent giả lập (`test-support/fake-agent.mjs`)

- `models` là tham số duy nhất:
  - `RC_FAKE_AGENT_LOGIN=loggedOut` → stderr `Error: Please sign in to view available models. Launch the CLI without arguments to sign in.`, mã 1;
  - ngược lại → stdout `fake-model`, mã 0.
- **Không** ghi `RC_FAKE_AGENT_RECORD` cho `models` và `--version`, để lần dò không ghi đè bản ghi của lượt.

### 3.7. i18n

- `jobs.json` (vi, en): `agentInstall.running` ("Đang cài trợ lý AI…").
- `errors.json` E021 (vi, en): thêm câu cho `missing: 'agent'`, `'terminal'`, `'installer'` theo kiểu E021 đang dịch. Nếu E021 chỉ có một câu chung thì thêm nhánh như E023 có `reasons`.
  - `agent`: "Trợ lý AI này chưa được cài."
  - `terminal`: "Không mở được cửa sổ terminal. Hãy tự mở terminal và chạy lệnh agy."
  - `installer`: "Máy chưa có PowerShell/bash để chạy trình cài."
- E026 `notLoggedIn` đã có câu, không đổi.

### 3.8. Composition root (`server-services.ts`)

- `const setupEnv = { platform: process.platform, env: process.env, homeDir: os.homedir() }`.
- `plans = agentSetupPlans(setupEnv)`. Truyền `fallbackCommands`, `plans`, `terminalAvailable` vào `createAgentService`, rồi tạo `createAgentSetupService({ …, terminal: (cmd) => terminalCommand(setupEnv, cmd) })`.
- Lắp route mới.
- File vượt 400 dòng thì tách phần agent ra `server-agent-services.ts`.

### 3.9. Spec-log (số tiếp theo sau #48)

- `#49` R-AG-21: lệnh cài chính thức theo hệ điều hành (bảng 3.2). Đường dẫn dự phòng macOS/Linux (`~/.local/bin`) chưa kiểm trên máy thật.
- `#50` R-AG-21: đăng nhập mở terminal hệ điều hành chạy agent không tham số (màn đăng nhập agy cần terminal thật, qua ống dẫn thì không chạy, VG-17). Không dùng job `agent.login`, nhưng giữ nó trong `JOB_KINDS`. Dò đăng nhập agy bằng `agy models`; claude giữ `unknown`. Mã 0 = `loggedIn` (chủ dự án đã kiểm 2026-10-22).
- `#51` R-AG-10: dò thêm đường dẫn mặc định của trình cài khi PATH cũ; lệnh tìm được dùng cho lượt AI và Đăng nhập. Agent `loggedOut` thì `resolve()` trả E026 `notLoggedIn`, lượt AI không chạy.

## 4. Tình huống test

Unit test với `ProcessPort` giả (ghi lại argv, trả kết quả theo argv), `JobService` thật, route test qua `app.inject`. Test agent giả lập chạy thật `fake-agent.mjs` như `fake-agent.test.ts`.

| #   | Tình huống                                                                                                | Kỳ vọng                                                                                                                     | Mã                 |
| --- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 1   | `agentSetupPlans` với win32, `LOCALAPPDATA=C:\Users\A\AppData\Local`                                      | `agy.installCommand` đúng bảng; `fallbackCommand` = `C:\Users\A\AppData\Local\agy\bin\agy.exe`                              | [R-AG-21]          |
| 2   | `agentSetupPlans` với linux; với win32 thiếu `LOCALAPPDATA`; với `aix`                                    | linux: lệnh `bash -c curl…`, fallback `~/.local/bin/agy`; thiếu biến: không có fallback; aix: `{}`                          | [R-AG-21]          |
| 3   | `terminalCommand` win32 với `C:\Users\O'Neil\agy.exe`; darwin với `/Users/a b/.local/bin/agy`; linux; aix | win32: `''` đúng chỗ; darwin: chuỗi AppleScript đúng thoát; linux: `x-terminal-emulator -e`; aix: `undefined`               | [R-AG-21]          |
| 4   | Dò: `agy --version` mã 127, lệnh dự phòng trả `1.4.3`                                                     | `installed: true`, `version: '1.4.3'`; `resolve()` trả `command` là đường dẫn dự phòng                                      | [R-AG-10]          |
| 5   | Dò khi có lệnh test (`commands.agy`) lỗi, có fallback                                                     | **Không** thử fallback; `installed: false`                                                                                  | [R-AG-10, R-QA-12] |
| 6   | Dò đăng nhập agy: `models` mã 0; mã 1 với stderr "Please sign in…"; mã 1 chữ khác; quá giờ (124)          | `loggedIn`; `loggedOut`; `unknown`; `unknown`. Lệnh dò đúng `[<cmd>, 'models']`                                             | [R-AG-10, R-AG-21] |
| 7   | Claude đã cài                                                                                             | `login: 'unknown'`, **không** spawn lệnh dò nào cho claude                                                                  | [R-AG-21]          |
| 8   | `resolve()`: preferred `agy`, agy `loggedOut`                                                             | E026 `{ agent: 'agy', reason: 'notLoggedIn' }`                                                                              | [R-AG-21]          |
| 9   | `resolve()` auto: agy `loggedOut`, claude đã cài `unknown`; rồi chỉ agy cài và `loggedOut`                | Lần 1 chọn claude; lần 2 E026 `notLoggedIn` agent `agy`                                                                     | [R-AG-10]          |
| 10  | Lượt AI khi agy `loggedOut` (turn-runner thật + `ProcessPort` giả)                                        | Job lỗi E026 `notLoggedIn`; **không** spawn lệnh `-p`                                                                       | [R-AG-21]          |
| 11  | Agent giả lập: `models` có và không có `RC_FAKE_AGENT_LOGIN=loggedOut`, có `RC_FAKE_AGENT_RECORD`         | Mã 1 + "sign in" / mã 0 + `fake-model`; file ghi **không** được tạo                                                         | [R-QA-12]          |
| 12  | `GET /agents`                                                                                             | Mỗi agent có `installCommand`, `docsUrl`, `loginAvailable`, `login` theo dò                                                 | [R-AG-21]          |
| 13  | `POST /agents/agy/install` với lệnh khác `installCommand` một phần tử                                     | 400 E016 `commandMismatch`; không spawn                                                                                     | [R-AG-21, S-54]    |
| 14  | Cài thành công: tiến trình in 2 dòng rồi mã 0                                                             | 202 `jobId`; job có 2 dòng; `completed`; dò lại sau khi xong                                                                | [R-AG-21]          |
| 15  | Cài lỗi mã 1; mã 124; mã 127                                                                              | E028 có dòng cuối; E020 `{ timeout: 600 }`; E021 `{ missing: 'installer' }`                                                 | [R-AG-21]          |
| 16  | Hủy job cài đang chạy; gửi cài lần hai khi lần một chưa xong                                              | Tiến trình bị `kill`, job `cancelled`; lần hai 409 E018                                                                     | [R-AG-21]          |
| 17  | `POST /agents/agy/login`: agy đã cài (qua fallback); chưa cài; `terminal` trả `undefined`; spawn mã 127   | 204 và argv mở terminal chứa đường dẫn fallback, **không** có tham số agent; E021 `agent`; E021 `terminal`; E021 `terminal` | [R-AG-21]          |
| 18  | `POST /agents/agy/login`, tiến trình mở terminal còn chạy sau 3 s                                         | 204; tiến trình **không** bị kill                                                                                           | [R-AG-21]          |
| 19  | `POST /agents/xyz/install`, `POST /agents/xyz/login`                                                      | 400 E016                                                                                                                    | [R-AG-21]          |

## 5. Kiểm tay (chủ dự án)

`npm run dev`. Gọi API bằng cách mở `http://127.0.0.1:<cổng server>/api/agents` không chạy được vì cần token, nên kiểm qua test là chính. Phần kiểm tay đầy đủ để sau lượt 6c, khi có giao diện.

Đã kiểm 2026-10-22: `agy models` trả mã 0 và danh sách model khi đã đăng nhập; mã 1 với "Please sign in" khi chưa.

## 6. Bẫy đã biết

1. Không thêm cờ nới quyền cho agent hay cho PowerShell (S-112). Lệnh cài phải giống **từng ký tự** với bảng 3.2.
2. `process.platform`, `process.env`, `os.homedir()` chỉ đọc ở composition root. Core nhận qua deps. Test truyền giá trị giả, **không** sửa `process.platform`.
3. Hàm >50 dòng hoặc file >400 dòng thì tách. `agent-service.ts` thêm nhiều thì tách phần dò (`agent-detect.ts`).
4. Hủy job phải dừng cả cây tiến trình: dùng `handle.kill()` như `project-install.ts`.
5. `detectAgent` chạy dò version và dò đăng nhập **tuần tự** cho một agent, nhưng hai agent vẫn song song như hiện nay.
6. Test cũ của `agent-service`/`turn-runner` dùng `ProcessPort` giả có thể gặp thêm lệnh `models`. Hãy cho `ProcessPort` giả trả kết quả hợp lệ cho `models`; **không** nới assertion về lệnh `-p`.
7. Không lách luật lint bằng mẹo. Gặp luật cản thì đổi thiết kế hoặc dừng và báo.

## 7. Báo cáo và commit

Báo cáo:

- file tạo và sửa, kèm số dòng;
- bảng 19 tình huống → tên test;
- kết quả `pnpm verify` (số test);
- chỗ nào làm khác bản này và vì sao.

Commit (đã qua commitlint):

```
feat(server): install agents, open their login and detect sign-in
```
