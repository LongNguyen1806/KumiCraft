# Phase 3 — Lượt 1: Hợp đồng Phase 3 và bản sao backend (WP-3.02)

Đọc `README.md` cùng thư mục trước, nhất là mục **"Lỗi lint hay vấp"**, rồi làm đúng bản này. Kế hoạch phase: `p3-ke-hoach.md`. Quy tắc: spec ADR-BE-34, mục 22 (M-MR, R-MR-01 đến R-MR-04), SPEC-05 S-30 đến S-33, S-86, S-89, S-120 đến S-125.

Lượt này **chỉ làm server và shared**. Không sửa Studio, Bridge, `e2e/`, `docs/spec.md`. Không gọi agent.

## 1. Mục tiêu (người dùng thấy gì)

1. Gắn một backend vào dự án đã tin cậy: KumiCraft tạo **bản sao chỉ đọc** của backend trong thư mục cache của người dùng (`%LOCALAPPDATA%\kumicraft\Cache\mirrors\<projectId>\<backendId>\` trên Windows). Ở Phase 3 agent chỉ được đọc bản sao này, không bao giờ đọc backend thật.
2. Bản sao **không có**: file bí mật (`.env`, khóa, `credentials*`…), `node_modules`, `.git`, thư mục build, file theo `.gitignore`, file nhị phân, file > 1 MB, symlink.
3. Trong file được chép, giá trị bí mật bị thay bằng `«redacted»`. Ví dụ `SECRET_KEY = "abc"` của Django thành `SECRET_KEY = "«redacted»"`.
4. Gỡ backend: bản sao của nó bị xóa.
5. Backend quá 50 MB: không tạo bản sao (lượt AI sau này sẽ báo).
6. Không có giao diện mới. Kiểm tay bằng cách mở thư mục cache (mục 5).

## 2. Đọc trước (CW-52)

| File                                                          | Lý do                                                                               |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `docs/spec.md` mục ADR-BE-34, 22, SPEC-05 mục 7, 8, 9         | Quy tắc gốc                                                                         |
| `packages/server/src/core/ports/file-system-port.ts`          | Cổng file duy nhất; thêm `stat` ở lượt này                                          |
| `packages/server/src/adapters/fs/node-file-system.ts` + test  | `readDir` bỏ symlink (S-25), cách kiểm đường dẫn, `withRetry`                       |
| `packages/server/src/core/workspace/test-support.ts`          | `nodeFs`, `directWriteFs`: phải thêm `stat` vào đây                                 |
| `packages/server/src/core/runner/redact-secrets.ts` + test    | Bộ che bí mật; **có lỗi** phải sửa (mục 3.3)                                        |
| `packages/server/src/core/project/project-backends.ts` + test | `applyAddBackend`, `applyRemoveBackend`, `BackendInfo.status`                       |
| `packages/server/src/core/project/project-types.ts`           | `ProjectServiceDeps`                                                                |
| `packages/server/src/index.ts`                                | `initServerContext`, `createServices`, `ensureConfigDir`, `StartServerOptions.deps` |
| `packages/shared/src/project.ts`, `job.ts`, `index.ts`        | Cách khai báo schema, `SERVER_EVENT_TYPES`, cách export                             |

## 3. Hợp đồng

### 3.1. Shared: `packages/shared/src/agent.ts` (mới, export qua `index.ts`)

Kiểu dùng chung cho **cả Phase 3**. Lượt sau chỉ dùng, không đổi. Ghi đúng tên và giới hạn sau:

```ts
export const AGENT_IDS = ['agy', 'claude'] as const;
export const AgentIdSchema = z.enum(AGENT_IDS);

export const AGENT_LOGIN_STATES = ['unknown', 'loggedIn', 'loggedOut'] as const;
export const AgentStatusSchema = z.strictObject({
  id: AgentIdSchema,
  installed: z.boolean(),
  version: z.string().max(100).optional(),
  login: z.enum(AGENT_LOGIN_STATES),
});

export const AgentEventSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('message'), text: z.string().max(100_000) }),
  z.strictObject({
    kind: z.literal('tool'),
    name: z.string().min(1).max(200),
    target: z.string().max(1024).optional(),
  }),
  z.strictObject({ kind: z.literal('conversation'), id: z.string().min(1).max(200) }),
  z.strictObject({ kind: z.literal('error'), message: z.string().max(4000) }),
]);

export const TURN_STATES = ['running', 'completed', 'failed', 'cancelled'] as const;
export const TURN_FILE_CHANGES = ['modified', 'created', 'deleted'] as const;
export const TurnFileSchema = z.strictObject({
  path: RelPathSchema,
  change: z.enum(TURN_FILE_CHANGES),
});

/** Chat notice about a backend mirror (R-MR-03, S-118, S-124). */
export const TURN_NOTICE_CODES = ['backendSkipped', 'backendTooLarge', 'mirrorModified'] as const;
export const TurnNoticeSchema = z.strictObject({
  code: z.enum(TURN_NOTICE_CODES),
  backendId: z.string().regex(/^[A-Za-z0-9_-]{10}$/),
  label: z.string().min(1).max(64),
});

export const TurnSummarySchema = z.strictObject({
  id: z.string().regex(/^[A-Za-z0-9_-]{10}$/),
  agent: AgentIdSchema,
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().optional(),
  prompt: z.string().min(1).max(20_000),
  state: z.enum(TURN_STATES),
  files: z.array(TurnFileSchema).max(5000),
  revertible: z.boolean(),
  notices: z.array(TurnNoticeSchema).max(20),
});

/** Context of a turn (SRS FR-62, R-AG-13). */
export const TurnContextSchema = z.strictObject({
  element: z
    .strictObject({ loc: z.string().min(1).max(1100), tag: z.string().min(1).max(100) })
    .optional(),
  route: z.string().max(2048).optional(),
  frame: z
    .strictObject({ id: z.string().min(1).max(64), width: z.number().int().min(1).max(10_000) })
    .optional(),
});

export const StartTurnRequestSchema = z.strictObject({
  prompt: z.string().trim().min(1).max(20_000),
  context: TurnContextSchema,
  conversation: z.enum(['new', 'continue']),
  docs: z.array(RelPathSchema).max(10),
});

export const TurnDiffSchema = z.strictObject({ diff: z.string() });

export const ToolGapSchema = z.strictObject({
  need: z.string().min(1).max(200),
  why: z.string().max(2000),
  example: z.string().max(4000),
  count: z.number().int().min(1),
  lastAt: z.iso.datetime(),
});

export const AgentEventMessageSchema = z.strictObject({
  turnId: z.string().regex(/^[A-Za-z0-9_-]{10}$/),
  event: AgentEventSchema,
});
```

- Dùng cách viết của `project.ts`: mỗi schema có `export type X = z.infer<typeof XSchema>`. `RelPathSchema` lấy từ file shared đang có. Tra trong `project.ts` cách viết ISO datetime đang dùng và theo đúng cách đó.
- Thêm `'agent.event'` vào cuối `SERVER_EVENT_TYPES` (`project.ts`). Nếu Studio có `switch` vét hết các loại sự kiện thì thêm nhánh bỏ qua `agent.event` (chỉ chỗ đó, không làm UI).
- Thêm `'agent.install'`, `'agent.login'` vào `JOB_KINDS` (`job.ts`). Kiểm mọi nơi dùng `JobKind` vẫn typecheck.

### 3.2. Server: nhận diện file bí mật `core/shared/secret-paths.ts` (mới)

```ts
/** S-30: true when a path (relative, `/` separators) is a secrets file or lies in a secrets folder. */
export function isSecretPath(relPath: string): boolean;
```

- So **tên file** (phần sau `/` cuối), không phân biệt hoa thường, với danh sách S-30: `.env`; `.env.*` **trừ** `.env.example`, `.env.sample`, `.env.template`; `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.jks`, `*.keystore`, `*.ppk`, `*.secret`; `id_rsa*`, `id_ed25519*`; `credentials*`, `secrets*`, `kubeconfig*`; `.npmrc`, `.pypirc`, `.netrc`; `service-account*.json`, `*-credentials.json`.
- Thư mục `.aws`, `.ssh`, `.gnupg` ở **bất kỳ độ sâu nào**: mọi đường dẫn có một đoạn bằng tên đó là bí mật.
- Viết bằng so chuỗi (`startsWith`, `endsWith`, `===`) hoặc regex không lồng lượng từ (S-86). Không dùng glob library.
- Lượt này chỉ **bản sao** dùng hàm này. Không đưa vào `node-file-system.ts`, vì tên như `CredentialsForm.tsx` trong dự án frontend sẽ bị chặn nhầm (ghi spec-log, mục 3.7).

### 3.3. Server: sửa và chuyển `redactSecrets`

1. `git mv packages/server/src/core/runner/redact-secrets.ts packages/server/src/core/shared/redact-secrets.ts` (test chuyển theo), rồi sửa import ở `runner-service.ts`.
2. **Lỗi hiện có:** `SENSITIVE_KEY_PATTERN` chỉ nhận tên **kết thúc ngay** bằng từ khóa. Vì vậy `SECRET_KEY = "x"`, `DJANGO_SECRET_KEY=x`, `AUTH_TOKEN_VALUE: 'x'` **không** bị che. S-33 nói "tên khớp", tức tên **chứa** từ khóa. Sửa để tên là một định danh `[A-Za-z0-9_.-]*` có chứa từ khóa ở bất kỳ đâu, rồi mới tới `:` hoặc `=`.
3. Giữ nguyên các mẫu còn lại và ký hiệu `«redacted»`.
4. Không để regex backtracking thảm họa (S-86): chuỗi 1 MB không có dấu `=` xử lý ≤ 100 ms.

### 3.4. Cổng file: thêm `stat`

`file-system-port.ts`:

```ts
export type FileStat = { readonly size: number; readonly mtimeMs: number };
/** Size and modification time without following symlinks (lstat). Missing: E015; outside root: E012. */
stat(root: string, path: string): Promise<Result<FileStat>>;
```

Cài trong `node-file-system.ts` bằng `lstat` sau khi kiểm đường dẫn như `readText`. Thêm vào `test-support.ts` (`nodeFs`, `directWriteFs`) và mọi đối tượng `FileSystemPort` giả trong test (TypeScript sẽ chỉ ra).

### 3.5. Server: `core/mirror/` (mới)

Tách file để không hàm nào quá 50 dòng, không file nào quá 400 dòng. Gợi ý: `mirror-scan.ts` (duyệt), `mirror-manifest.ts` (đọc/ghi manifest, sha256), `mirror-service.ts` (ghép).

```ts
export const MIRROR_MAX_TOTAL_BYTES = 50 * 1024 * 1024; // S-124
export const MIRROR_MAX_FILE_BYTES = 1024 * 1024; // S-122
export const MIRROR_EXCLUDED_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.venv',
  'venv',
  '__pycache__',
  'target',
] as const; // S-120

export type MirrorState = 'ready' | 'skipped' | 'tooLarge' | 'failed';
export type MirrorResult = {
  readonly backendId: string;
  readonly label: string;
  readonly state: MirrorState;
  /** Absolute folder the agent may read; only when `state` is 'ready'. */
  readonly dir?: string | undefined;
  readonly files: number; // files in the mirror after the refresh
  readonly bytes: number; // sum of their source sizes
  readonly copied: number; // files written in this refresh (new or changed)
};
export type MirrorCheck = 'intact' | 'modified' | 'absent';

export type MirrorService = {
  /** R-MR-02: incremental refresh; never throws. */
  refresh(projectId: string, backend: BackendInfo): Promise<MirrorResult>;
  /** R-MR-04, S-118: compares mirror files with the manifest; 'modified' also deletes the mirror. */
  check(projectId: string, backendId: string): Promise<MirrorCheck>;
  /** S-125: deletes the mirror and its manifest; missing is fine. */
  remove(projectId: string, backendId: string): Promise<void>;
};
export function createMirrorService(deps: {
  readonly fs: FileSystemPort;
  readonly cacheDir: string;
  readonly logger: LoggerPort;
}): MirrorService;
```

**Vị trí:** mọi đường dẫn ghi tương đối với gốc `cacheDir`:

- bản sao: `mirrors/<projectId>/<backendId>/<đường dẫn trong backend>`;
- manifest: `mirrors/<projectId>/<backendId>.manifest.json`. Manifest đặt **cạnh** thư mục bản sao, không nằm trong, để agent không đọc được.

Manifest: `{ "version": 1, "files": [{ "path", "size", "mtimeMs", "sha256" }] }`. Trong đó `size`, `mtimeMs` là của file **gốc**, còn `sha256` là của nội dung **đã ghi vào bản sao** (sau khi che bí mật). Đọc manifest qua một schema Zod khai báo trong `mirror-manifest.ts`; hỏng hoặc thiếu thì coi như rỗng.

**Thuật toán `refresh`** (gốc đọc là `backend.resolvedPath`):

1. `backend.status` khác `'ok'` → trả `skipped` (R-MR-03), không đụng bản sao cũ.
2. Đọc `.gitignore` ở **gốc** backend (nếu có, qua `fs.readText`), nạp vào `ignore` (thêm dependency `"ignore": "7.0.12"` vào `packages/server/package.json`, đúng kiểu ghim phiên bản của file đó, rồi `pnpm install`). `.gitignore` lồng trong thư mục con: không xét (ghi spec-log).
3. Duyệt đệ quy bằng `fs.readDir` (đã bỏ symlink và junction, S-121). Bỏ thư mục trong `MIRROR_EXCLUDED_DIRS` (so đúng tên, mọi độ sâu), bỏ đường dẫn mà `isSecretPath` trả `true`, bỏ đường dẫn mà `ignore` loại (thư mục thử với `/` ở cuối). **Không mở** file bị bỏ (S-31).
4. Với mỗi file còn lại: `fs.stat`. Lớn hơn `MIRROR_MAX_FILE_BYTES` thì bỏ. Cộng dồn `size`. Tổng vượt `MIRROR_MAX_TOTAL_BYTES` thì dừng, **xóa** bản sao và manifest cũ, trả `tooLarge` (S-124).
5. Với mỗi file: cùng `size` và `mtimeMs` với manifest **và** file bản sao còn đó thì giữ nguyên, không đọc. Nếu khác: `fs.readBytes`, có byte `0` trong 8192 byte đầu thì bỏ (nhị phân, S-122); không thì giải mã UTF-8, `redactSecrets`, `fs.writeTextAtomic` vào bản sao, tính `sha256` của chuỗi đã ghi (`node:crypto`).
6. Xóa trong bản sao các file có trong manifest cũ mà lần này không còn (`fs.remove`).
7. Ghi manifest mới, trả `ready` với `dir` là đường dẫn tuyệt đối `join(cacheDir, 'mirrors', projectId, backendId)`.
8. Lỗi bất ngờ: `logger.warn` (chỉ `backendId` và mã lỗi, **không** nội dung file hay đường dẫn file của backend, S-89), trả `failed`.

**`check`:** không có manifest thì `absent`. Có thì đọc từng file bản sao, so `sha256`; thêm duyệt bản sao tìm file thừa không có trong manifest. Khác hoặc thừa → `remove` rồi trả `modified`.

**Quyền thư mục (S-125):** trong `index.ts`, tạo `join(cacheDir, 'mirrors')` bằng `mkdir(..., { recursive: true, mode: 0o700 })` giống `ensureConfigDir`. Trên Windows `mode` bị bỏ qua, như vậy là đúng.

### 3.6. Nối vào server

- `StartServerOptions.deps` thêm `cacheDir?: string`. Mặc định `envPaths('kumicraft').cache`. Test truyền thư mục tạm.
- `ProjectServiceDeps` thêm `mirror?: Pick<MirrorService, 'refresh' | 'remove'> | undefined`.
- `applyRemoveBackend` thành công → `await deps.mirror?.remove(projectId, id)`.
- `applyAddBackend` thành công, dự án **tin cậy** và backend `status: 'ok'` → bắt đầu `refresh` ở nền (`void …catch`), không chờ, để thêm backend vẫn nhanh.
- `index.ts` đang 399 dòng. Thêm dòng mà vượt 400 thì chuyển `createServices` sang `src/server-services.ts`, giữ nguyên hành vi.

### 3.7. Spec-log (thêm vào `docs/construction/spec-log.md`, số tiếp theo)

- `#36` R-MR-02: ngoài "trước mỗi lượt", bản sao còn được làm mới ở nền khi thêm backend. `.gitignore` chỉ đọc ở gốc backend. Manifest đặt cạnh thư mục bản sao (`<backendId>.manifest.json`) để agent không đọc được.
- `#37` S-31: `isSecretPath` chỉ áp cho bản sao (và ảnh chụp lượt AI ở lượt 3), chưa áp vào `FileSystemPort` của dự án frontend, vì tên như `CredentialsForm.tsx` sẽ bị chặn nhầm.
- `#38` Hợp đồng Phase 3: `TurnSummary` thêm `agent`, `notices` (báo backend bị bỏ, quá lớn, bản sao bị sửa); `AgentStatus.login`; job `agent.install`, `agent.login`.

## 4. Tình huống test

Test bản sao dùng **file thật** trong thư mục tạm (`mkdtemp`) với `createNodeFileSystem`, không mock cổng file. Riêng tình huống 3 dùng spy bọc quanh FS thật. Gắn đúng mã trong ngoặc vuông.

| #   | Tình huống                                                                                                                                                                                                                                    | Kỳ vọng                                                                                                                                    | Mã               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| 1   | `AgentEventSchema`, `TurnSummarySchema`, `StartTurnRequestSchema`: một mẫu hợp lệ mỗi loại; `prompt` rỗng hoặc chỉ khoảng trắng; `docs` 11 mục; `kind` lạ                                                                                     | Hợp lệ qua; ba ca sau bị từ chối                                                                                                           | (không mã)       |
| 2   | `isSecretPath` với: `.env`, `api/.env.local`, `.env.example` (false), `.ENV`, `certs/server.pem`, `id_rsa.pub`, `config/credentials.yml`, `secrets.json`, `a/.aws/config`, `src/Login.tsx` (false), `service-account-prod.json`, `kubeconfig` | Đúng từng giá trị                                                                                                                          | [S-30]           |
| 3   | Backend có `.env`, `.env.local`, `deploy/id_rsa`, `.ssh/known_hosts`, `.env.example`; spy bọc `readText`/`readBytes`/`stat`                                                                                                                   | Bản sao chỉ có `.env.example` (và file thường); spy **không** thấy lần gọi nào với các file bí mật                                         | [S-30, S-31]     |
| 4   | Backend có `node_modules/x.js`, `src/node_modules/y.js`, `.git/HEAD`, `dist/a.js`, `.venv/b.py`, `__pycache__/c.pyc`, `target/d`; `.gitignore` chứa `*.log` và `tmp/`, có `app.log`, `tmp/t.txt`                                              | Không file nào ở trên vào bản sao; `.gitignore` và `src/main.py` có                                                                        | [S-120]          |
| 5   | Symlink file và junction thư mục (Windows: `junction`; nơi khác: `dir`) trỏ ra ngoài backend                                                                                                                                                  | Không có trong bản sao; không đọc file ngoài                                                                                               | [S-121]          |
| 6   | File có byte `0` ở vị trí 100; file văn bản đúng 1 MB; file 1 MB + 1 byte; file 2 MB                                                                                                                                                          | Chỉ file đúng 1 MB được chép                                                                                                               | [S-122]          |
| 7   | `settings.py` có `SECRET_KEY = "RC_SECRET_MARKER_1"`, `config.ts` có `apiKey: 'RC_SECRET_MARKER_2'`, `db.yml` có `url: postgres://u:RC_SECRET_MARKER_3@h/db`                                                                                  | File có trong bản sao, chứa `«redacted»`; đọc **mọi** file của bản sao và manifest: không có chuỗi `RC_SECRET_MARKER`                      | [S-123, AC-11]   |
| 8   | `redactSecrets`: `SECRET_KEY = "a1b2c3"`, `DJANGO_SECRET_KEY=a1b2c3`, `AUTH_TOKEN_VALUE: 'a1b2c3'`, `password: "a1b2c3"`; câu thường `the secret garden is nice`                                                                              | Bốn ca đầu bị che; câu thường giữ nguyên                                                                                                   | [S-33]           |
| 9   | `redactSecrets` trên chuỗi 1 MB chỉ gồm `a` và `secret` lặp lại, không có `=`                                                                                                                                                                 | Xong ≤ 100 ms                                                                                                                              | [S-86]           |
| 10  | Lần `refresh` đầu: thư mục và manifest                                                                                                                                                                                                        | `state: 'ready'`, `dir` đúng; manifest có đủ `path`, `size`, `mtimeMs` của file gốc, `sha256` khớp nội dung bản sao; `files`, `bytes` đúng | [R-MR-01]        |
| 11  | Lần hai: đổi nội dung một file (đổi cả `mtime`), xóa một file, thêm một file, các file khác giữ nguyên                                                                                                                                        | `copied` = 2; file xóa biến mất khỏi bản sao và manifest; spy cho thấy file không đổi không bị `readBytes`                                 | [R-MR-02]        |
| 12  | Backend `status: 'missing'`, rồi `'blocked'`                                                                                                                                                                                                  | `state: 'skipped'`, không tạo thư mục                                                                                                      | [R-MR-03]        |
| 13  | Tổng vượt giới hạn: test truyền giới hạn nhỏ qua tham số tùy chọn của `createMirrorService` (ví dụ `maxTotalBytes` chỉ dùng cho test, mặc định `MIRROR_MAX_TOTAL_BYTES`); có bản sao cũ trước đó                                              | `state: 'tooLarge'`; bản sao cũ và manifest đã bị xóa                                                                                      | [S-124]          |
| 14  | `check`: chưa có → `absent`; nguyên vẹn → `intact`; sửa một file trong bản sao → `modified` và thư mục bị xóa; thêm file lạ vào bản sao → `modified`                                                                                          | Đúng từng giá trị                                                                                                                          | [R-MR-04, S-118] |
| 15  | Qua `ProjectService`: thêm backend ở dự án tin cậy → bản sao xuất hiện (chờ bằng `vi.waitFor`); gỡ backend → thư mục và manifest bị xóa; dự án chưa tin cậy thêm backend → không tạo bản sao                                                  | Đúng                                                                                                                                       | [S-125, R-MR-02] |

## 5. Kiểm tay (chủ dự án)

1. `pnpm build`, chạy `kumicraft` trong thư mục cha của **WorkTracker**, mở WorkTracker, tin cậy dự án.
2. Hộp Project → thêm backend Django của WorkTracker.
3. Mở `%LOCALAPPDATA%\kumicraft\Cache\mirrors\`. Có thư mục `<projectId>\<backendId>\` và file `<backendId>.manifest.json` nằm cạnh.
4. Trong bản sao: không có `.env`, `venv`, `__pycache__`, `.git`, `db.sqlite3` (nhị phân), `media/` nếu `.gitignore` loại.
5. Mở `settings.py` trong bản sao: dòng `SECRET_KEY = ...` có `«redacted»`; file thật trong backend vẫn y nguyên.
6. Sửa một file `.py` trong backend thật. Gỡ backend rồi thêm lại: bản sao có nội dung mới.
7. Gỡ backend: thư mục bản sao và manifest biến mất.
8. Dự án mới tạo: thêm một thư mục backend nhỏ có `.env` → không có `.env` trong bản sao.

## 6. Bẫy đã biết

1. `readDir` của adapter đã bỏ symlink. **Đừng** thêm `realpath` hay `stat` theo symlink để "đọc cho đủ".
2. `fs.stat` phải dùng `lstat`, không phải `stat`.
3. Manifest so `size` và `mtimeMs` của file **gốc**, còn `sha256` là của file **bản sao**. Đừng trộn hai thứ.
4. Đường dẫn trong manifest và trong `ignore` luôn dùng `/`, kể cả trên Windows.
5. Không log nội dung file, lời nhắc, đường dẫn file trong backend (S-89). Log chỉ gồm `backendId`, số file, mã lỗi.
6. Test 13 không được tạo file 50 MB thật. Dùng tham số giới hạn cho test như đã ghi.
7. Test tạo junction trên Windows cần thư mục đích tồn tại. Xem cách làm ở `node-file-system.test.ts` dòng 65.
8. Sửa shared thì chạy `pnpm --filter @kumicraft/bridge build` trước `pnpm verify`. Test `bridge-client-generated` so bundle với bản build mới.
9. Không sửa test có sẵn để cho qua. Nếu test cũ của `redactSecrets` đỏ sau khi sửa regex, dừng lại và báo.

## 7. Báo cáo và commit

Báo cáo: file tạo và sửa (kèm số dòng), bảng 15 tình huống → tên test, kết quả `pnpm verify` (số test), các bước Kiểm tay đã tự thử, chỗ nào làm khác bản này và vì sao.

Commit (đã qua commitlint):

```
feat(server): mirror linked backends without secrets
```
