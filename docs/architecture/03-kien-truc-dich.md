# Kiến trúc đích KumiCraft

Bước 3 của việc dựng lại kiến trúc. Dựa trên [01-muc-tieu.md](01-muc-tieu.md) (mục tiêu), [02-hien-trang.md](02-hien-trang.md) (hiện trạng) và [03a-ket-qua-thu-danh-dau.md](03a-ket-qua-thu-danh-dau.md) (kết quả thử Vue, Next.js, Razor). Bản 2, ngày 2026-11-22; chủ dự án duyệt. Mục 6.1 cập nhật theo code sau Đợt 0.

Tài liệu nói **KumiCraft nên được chia thế nào và vì sao**, chưa nói làm theo thứ tự nào (thứ tự ở bước 4). Tên trong code viết bằng tiếng Anh như quy ước của repo; đây là bản phác, tên cuối cùng chốt khi làm.

## 1. Ý tưởng chính trong một trang

1. **Một dự án được mô tả bằng một hồ sơ (`ProjectProfile`) theo 3 trục**: công cụ chạy, ngôn ngữ giao diện, hệ style. Nhận diện chỉ làm một việc: điền hồ sơ này.
2. **Mỗi trục có một interface**, mỗi công nghệ là một hiện thực cắm vào: `RuntimeAdapter` (Vite, Express, Next…), `ViewLanguage` (JSX, Pug, Vue, Razor…), `StyleSystem` (Tailwind, CSS…). Thêm công nghệ = thêm một hiện thực, **không sửa lõi**.
3. **Lõi không biết công nghệ nào.** Lõi chỉ biết: dự án, file, phần tử (qua vị trí `file:dòng:cột`), thao tác sửa, Undo.
4. **Mọi thao tác sửa đi một đường**: Studio gửi **ý định** → lõi hỏi hiện thực phù hợp phải sửa chữ nào trong file nào → **một bộ ghi file duy nhất** ghi, kiểm hash, lưu Undo.
5. **Mỗi ngôn ngữ giao diện khai báo nó làm được thao tác nào** (capability). Studio chỉ hiện công cụ làm được; "chỉ xem" = ngôn ngữ chưa có bộ sửa.
6. **Quy tắc phụ thuộc được máy kiểm**, và mỗi interface có **bộ test chung** mà mọi hiện thực phải qua.
7. AI **tự viết code** (agent CLI), không đi qua các thao tác sửa; lõi chỉ chụp trạng thái file để hoàn tác cả lượt (quyết định của chủ dự án, 2026-11-22).

## 2. Mô hình lõi (không phụ thuộc công nghệ)

| Khái niệm        | Nghĩa                                                                                                                          | Hiện nay tương ứng                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| `ProjectProfile` | Hồ sơ dự án: `runtime` (công cụ chạy + phiên bản), `view` (ngôn ngữ + phiên bản), `styling`, `packageManager`, `workspaceRoot` | `SupportReport` + `FrameworkAdapter`               |
| `SourceLoc`      | Vị trí một phần tử trong code: `file:dòng:cột` (cột tính từ 1), kèm số thứ tự khi một dòng code sinh nhiều phần tử             | `data-rc-loc` + `index` (giữ nguyên)               |
| `UseLoc`         | Chỗ một component được dùng: `file:dòng:cột\|Tên`                                                                              | `data-rc-use` (giữ nguyên)                         |
| `ViewDocument`   | Một file giao diện đã được ngôn ngữ của nó đọc: tìm phần tử theo `SourceLoc`, biết cha con                                     | AST Babel (chỉ JSX)                                |
| `ElementInfo`    | Thông tin một phần tử cho Inspector: thẻ, class (mục 3.5), chữ, thuộc tính, có trong vòng lặp không, thao tác nào làm được     | `ElementSource`                                    |
| `EditIntent`     | Ý định sửa do Studio gửi: đặt class, đặt chữ, đặt thuộc tính, chèn, xóa, di chuyển, bọc, đổi style…                            | `SourceEdit`, `StructureEdit`, `StyleApplyRequest` |
| `TextChange`     | Kết quả cụ thể: thay đoạn chữ từ vị trí A tới B trong file F, kèm hash file lúc đọc                                            | magic-string trong từng thao tác                   |
| `Capability`     | Thao tác nào làm được ở đâu, và lý do nếu không (mục 7)                                                                        | `editMode: viewOnly` + E023 rải rác                |
| `HistoryStep`    | Một bước Undo: nội dung trước và sau của các file đã ghi                                                                       | giữ nguyên `core/history`                          |

`SourceLoc` / `UseLoc` là **chỗ nối giữa các trục**. Bản thử ([03a](03a-ket-qua-thu-danh-dau.md)) đã cho thấy JSX, Vue, Next.js và Razor đều ra **cùng định dạng** dấu này, nên Bridge, Canvas, Inspector dùng chung được.

## 3. Ba trục mở rộng

### 3.1. Trục A: công cụ chạy (`RuntimeAdapter`)

Việc: chạy trang của dự án lên Canvas, gắn Bridge, và cho bộ đánh dấu của ngôn ngữ giao diện một chỗ để cắm.

```ts
interface RuntimeAdapter {
  readonly id: RuntimeId; // 'vite' | 'express' | 'next' | 'webpack' | 'aspnet' …
  detect(input: DetectInput): RuntimeMatch | undefined; // phiên bản, lý do không hỗ trợ
  readonly stampHost: StampHost; // kiểu cắm bộ đánh dấu, xem dưới
  runner(ctx: RunnerContext): RunnerSpec; // tiến trình con, lệnh, cổng, cách gắn Bridge
  /** Chỉ với stampHost 'shadowCopy': đồng bộ bản sao khi file gốc đổi. */
  shadow?: ShadowSync;
  restartOn?(relPath: string): boolean;
  buildCheck?(ctx: BuildCheckContext): BuildCheckSpec;
  requiredPackages(profile: ProjectProfile): readonly string[];
}
```

**Ba kiểu cắm bộ đánh dấu** (đã thử thật, xem 03a):

| `StampHost`    | Nghĩa                                                                                | Dùng cho                                      |
| -------------- | ------------------------------------------------------------------------------------ | --------------------------------------------- |
| `buildPlugin`  | Công cụ build cho cắm transform / loader; KumiCraft cắm vào cấu hình đã có của dự án | Vite (JSX, Vue), Next.js (Turbopack), webpack |
| `templateHook` | Trình biên dịch template cho cắm hook                                                | Express + Pug                                 |
| `shadowCopy`   | Không cắm được: chép dự án ra bản sao, đánh dấu bản sao, chạy bản sao                | ASP.NET Razor; dự kiến Blade, Django, Jinja   |

Quy tắc chung của trục A:

- **Không bao giờ sửa file cấu hình của người dùng** (`vite.config`, `next.config`…). Bộ đánh dấu được thêm vào cấu hình lúc chạy, trong tiến trình KumiCraft điều khiển.
- **Không chặn theo số phiên bản** (chủ dự án, 2026-11-22; [03b](03b-next-va-khoi-chung.md) mục 0). Khi cách cắm dựa vào **phần nội bộ** của công cụ (Next.js: bọc module cấu hình) mà bản sau đổi, runtime báo đúng lỗi thật (không bọc được, file nào), ghi log; dự án mẫu của vài bản phổ biến chạy trong E2E.
- Với `shadowCopy`, `ShadowSync` chịu trách nhiệm: tạo bản sao (bỏ `bin`, `obj`, `node_modules`), đánh dấu lại đúng file vừa đổi, để công cụ watch của dự án (vd. `dotnet watch`) nạp lại. File gốc là nguồn sự thật; bản sao không bao giờ được sửa trực tiếp.

### 3.2. Trục B: ngôn ngữ giao diện (`ViewLanguage`)

Việc: biết file giao diện viết thế nào, cung cấp bộ đánh dấu, đọc phần tử, biến ý định sửa thành `TextChange`.

```ts
interface ViewLanguage {
  readonly id: ViewLanguageId; // 'jsx' | 'pug' | 'vue' | 'razor' | 'html' …
  readonly extensions: readonly string[];
  detect(input: DetectInput): ViewMatch | undefined;
  /** Bộ đánh dấu SourceLoc / UseLoc cho từng kiểu cắm mà ngôn ngữ làm được. */
  stamper(host: StampHost): LocStamper | undefined;
  parse(file: string, text: string): Result<ViewDocument>;
  readonly capabilities: ViewCapabilities;
  readonly editor?: ViewEditor; // vắng = chỉ xem
  readonly snippets?: SnippetRenderer; // khối thư viện → code của ngôn ngữ này (mục 5)
  readonly pages?: PagesProvider; // khi ngôn ngữ / meta-framework tự quyết trang (file-based)
}

interface ViewEditor {
  readClass(doc: ViewDocument, at: SourceLoc): ClassSlot; // mục 3.5
  setClass(doc: ViewDocument, at: SourceLoc, change: ClassChange): Result<TextChange[]>;
  setText(doc: ViewDocument, at: SourceLoc, text: string): Result<TextChange[]>;
  setAttribute(
    doc: ViewDocument,
    at: SourceLoc,
    name: string,
    value: AttrValue,
  ): Result<TextChange[]>;
  insert?(doc: ViewDocument, target: InsertTarget, snippet: Snippet): Result<TextChange[]>;
  remove?(doc: ViewDocument, at: SourceLoc): Result<TextChange[]>;
  move?(from: ViewDocument, at: SourceLoc, to: InsertTarget): Result<TextChange[]>;
  wrap?(doc: ViewDocument, at: SourceLoc, wrapper: Snippet): Result<TextChange[]>;
}
```

- **Mọi hàm sửa chỉ trả `TextChange`**, không tự ghi file. Ghi, kiểm hash, định dạng, Undo do lõi làm (mục 4).
- Thao tác chung nằm trong interface. Thao tác chỉ một ngôn ngữ có (sửa prop component, kit tương tác React, Reveal, data repeat) là **phần mở rộng riêng** của ngôn ngữ đó, khai báo qua `capabilities`, không ép mọi ngôn ngữ phải có.
- Bộ sửa JSX hiện nay trở thành hiện thực `jsx` đầu tiên. Pug là hiện thực thứ hai, chưa có `editor`.

### 3.3. Trục C: hệ style (`StyleSystem`)

Việc: đọc style hiện tại của phần tử và biến ý định "đổi thuộc tính style" thành thay đổi cụ thể.

```ts
interface StyleSystem {
  readonly id: StyleSystemId; // 'tailwind' | 'css' | 'cssModules' | 'sass' | 'less' | 'bootstrap' …
  detect(input: DetectInput): StylingMatch | undefined;
  read(ctx: StyleContext, at: SourceLoc): Result<StyleReading>; // giá trị theo thuộc tính CSS
  plan(ctx: StyleContext, at: SourceLoc, intent: StyleIntent): Result<StylePlan>;
  readonly tokens?: ThemeTokens;
}

type StyleIntent = {
  property: string; // thuộc tính CSS, vd. 'color'
  value: string | undefined; // undefined = bỏ
  state?: 'hover' | 'focus' | 'active' | …;
  breakpoint?: string;
  scope: 'onlyThis' | 'allMatching';
};

type StylePlan =
  | { kind: 'classes'; change: ClassChange } // lõi đưa cho ViewEditor.setClass
  | { kind: 'stylesheet'; changes: TextChange[] }; // sửa file CSS / Sass / Less
```

Tailwind trả `classes` nên chạy được trên mọi ngôn ngữ có `setClass` (JSX, Vue, Razor…). CSS trả `stylesheet`.

**Gộp hai đường style hiện nay: chọn phương án B** (lý do đầy đủ ở ADR-A4, mục 9).

| Phương án                                            | Cách làm                                                                                                                                                                                                                                                                                            | Chi phí                                                 | Tốc độ                                                           | Chọn                                                                          |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| A. Chuyển hết sang Server                            | Studio chỉ gửi ý định và hỏi Server mọi giá trị                                                                                                                                                                                                                                                     | Viết lại phần lớn Inspector (khoảng 13.000 dòng)        | Mỗi lần đọc giá trị phải hỏi Server; nguy cơ vượt PB-02 (500 ms) | Không                                                                         |
| **B. Một package Tailwind thuần, dùng ở cả hai đầu** | Gom logic Tailwind (`shared/src/tailwind` + phần tính class trong Inspector) thành package `style-tailwind` chỉ gồm hàm thuần. Studio dùng nó để **hiện giá trị và xem trước tức thì**; khi xác nhận, Studio gửi **ý định**, Server chạy **cùng hàm đó** để ra `ClassChange` rồi đi đường sửa chung | Vừa: chuyển code, không viết lại; Inspector đổi chỗ gọi | Như hiện nay                                                     | **Có**                                                                        |
| C. Giữ nguyên                                        | Studio tự tính class, gửi `setClassName`                                                                                                                                                                                                                                                            | Không                                                   | Như hiện nay                                                     | Không: hai đường, Server không kiểm được ý định, không dùng cho ngôn ngữ khác |

Đã làm ở Đợt S: Studio gửi edit `setClasses` gồm các bước ý định (`shared/src/class-intent.ts`), Server chạy `applyClassSteps` của `style-tailwind` (`services/edit/class-edits.ts`).

Với B, **chỉ có một bản logic Tailwind**; Server là nơi quyết định cuối cùng; Studio vẫn nhanh. Xem trước khi kéo thanh trượt vẫn dùng inline style tạm (giá trị CSS), như `sendStylePreview` hiện nay.

### 3.4. Ghép ba trục: hồ sơ và bảng tổ hợp

- Nhận diện theo thứ tự trong [nhan-dien-du-an.md](../construction/giao-viec/nhan-dien-du-an.md): meta-framework → framework phía server → công cụ build → ngôn ngữ giao diện → hệ style. Kết quả là `ProjectProfile`.
- **Meta-framework** (Next, Nuxt, SvelteKit, Astro) là một **gói cấu hình sẵn**: chọn runtime, ngôn ngữ và cách tìm trang. Không phải trục thứ tư (ADR-A1).
- **Bảng tổ hợp** nói tổ hợp nào chạy được và qua kiểu cắm nào (vd. `vite + jsx: buildPlugin`, `aspnet + razor: shadowCopy`). Tổ hợp không có trong bảng → báo "chưa hỗ trợ" kèm lý do đúng.
- Mức hỗ trợ **suy ra** từ hồ sơ, không gán tay: có runner + có `editor` → chỉnh được; có runner, không `editor` → chỉ xem; không runner → không mở được.

### 3.5. Class viết động

Class thường không phải chữ cố định: `className={cn('p-4', isActive && 'ring')}` (React), `class="card" :class="{ on: x }"` (Vue), `class="item @(on ? "on" : "")"` (Razor). Code hiện nay đã phân biệt các trường hợp này cho JSX (`static`, `callStatic`, `templateStatic`, `expression`, `none`, `duplicate`); kiến trúc đích tổng quát hóa nó cho mọi ngôn ngữ:

```ts
type ClassSlot =
  | { kind: 'editable'; value: string; kept?: KeptPart } // phần chữ cố định sửa được, phần động giữ nguyên
  | { kind: 'readonly'; reason: CapabilityReason } // toàn biểu thức, hoặc nhiều chỗ khai báo
  | { kind: 'absent' }; // chưa có class: setClass sẽ thêm thuộc tính
```

- `kept` là phần động, **đục** đối với lõi và Studio: chỉ `ViewEditor` của ngôn ngữ đó biết ghép lại khi ghi.
- Ví dụ: JSX `cn('p-4', rest)` → `editable` "p-4", `kept` = `rest`; Vue `class="card" :class="…"` → `editable` "card", `kept` = binding `:class`; Razor `class="item @(…)"` → `editable` "item", `kept` = `@(…)`; JSX `className={styles}` → `readonly` (`classExpression`).
- `StyleSystem` (Tailwind) chỉ làm việc với phần `editable`; Inspector cho biết lớp động đang thêm gì khi đọc được từ DOM, nhưng không sửa nó.

## 4. Một đường cho mọi thao tác sửa

```
 Studio (Inspector, kéo thả, thư viện…)
   │  EditIntent (ý định, không chứa code)
   ▼
 EditService (lõi)
   │ 1. đọc file, ViewLanguage.parse → ViewDocument
   │ 2. nếu là style: StyleSystem.plan → StylePlan
   │ 3. ViewEditor (hoặc StylePlan 'stylesheet') → TextChange[]
   ▼
 FileWriter (lõi, duy nhất)
   │ kiểm hash (file vừa bị sửa tay → từ chối, E017), định dạng, ghi nguyên tử, hàng đợi theo file
   ▼
 History: lưu bước Undo đúng từng byte → sự kiện cho Studio
```

- Thay cho hiện nay: mỗi thao tác tự dùng magic-string rồi tự ghi; style CSS đi đường riêng.
- **Chất lượng số 1 (không làm hỏng code người dùng) chỉ phải đảm bảo ở một chỗ**: `FileWriter` + `History`, và có test riêng cho hai phần này.
- Với runtime `shadowCopy`, sau khi `FileWriter` ghi file gốc, `ShadowSync` cập nhật bản sao. `FileWriter` không biết gì về bản sao.
- AI không đi qua đường này (mục 1, ý 7).

## 5. Nội dung giao diện (thư viện khối, kit)

- Khối thư viện hiện là chuỗi JSX + class Tailwind (6.027 dòng trong `shared`). Đích: mỗi khối mô tả bằng **cây phần tử trung lập** (thẻ, chữ, thuộc tính, `StyleIntent`). `SnippetRenderer` của từng ngôn ngữ biến cây thành code; `StyleSystem` quyết định style thành class hay CSS.
- Kit tương tác (modal, carousel…) là component của một framework; mỗi ngôn ngữ có bộ kit riêng hoặc không có (thì công cụ không hiện).
- Nội dung ra khỏi `shared` vào package nội dung riêng.
- Chỉ cần xong **trước khi ngôn ngữ thứ hai được chỉnh sửa**. Rủi ro: cây trung lập có thể làm mất chi tiết làm khối đẹp; phải giữ nguyên ảnh chụp của từng khối khi chuyển đổi (test so ảnh).

## 6. Chia module và quy tắc phụ thuộc

### 6.1. Server

Cấu trúc này **đã có từ Đợt 0** (2026-11-22); quy tắc ở bảng được máy kiểm (`pnpm lint:deps`, mục 6.4).

```
server/src/
  kernel/     mô hình lõi (model.ts), interface các trục (stacks.ts), tính năng theo ngôn ngữ
              (features.ts), interface bộ sửa (editing.ts), FileWriter, History, Result, đường dẫn
  ports/      file, tiến trình, hệ thống, log, sự kiện, theo dõi file, CSS đã biên dịch
  lib/        tiện ích trung lập: đọc JS/TS (Babel), phiên bản gói, cây file, ảnh, workspace root
  services/   dự án (mở, tạo, nhận diện theo bảng tổ hợp, cài đặt), sửa class theo ý định (edit),
              runner, AI, mirror, tác vụ nền,
              cấu hình người dùng, khóa workspace, kiểm build, đọc dữ liệu backend
  stacks/     hiện thực theo trục
    index.ts           bảng tổ hợp (vite + jsx, express + pug)
    runtime/vite, runtime/express (… runtime/next, runtime/aspnet)
    view/jsx (bộ sửa JSX + tính năng riêng của JSX), view/pug (… view/vue, view/razor)
    style (CSS, CSS Modules, Sass, Less, Bootstrap, token theme; tách theo hệ ở Đợt S)
  adapters/   http, fs, process, log, watcher (hiện thực ports)
  runners/    tiến trình con chạy dev server, định dạng code, đọc kiểu prop
  index.ts, server-config.ts, server-services.ts, server-http.ts
              nơi ghép tất cả (composition root): chỉ ở đây mới nhắc tên hiện thực cụ thể
```

| Module     | Được dùng                                                 | Không được dùng                                                        |
| ---------- | --------------------------------------------------------- | ---------------------------------------------------------------------- |
| `kernel`   | `shared`, `ports`                                         | mọi thứ khác                                                           |
| `ports`    | `kernel` (kiểu)                                           | mọi thứ khác                                                           |
| `lib`      | `kernel`, `ports`, `shared`, thư viện trung lập (Babel)   | `services`, `stacks`, `adapters`                                       |
| `services` | `kernel`, `ports`, `lib`, `shared`                        | `stacks`, `adapters`                                                   |
| `stacks/*` | `kernel`, `ports`, `lib`, `shared`, thư viện của chính nó | `services`, `adapters`, `stacks` khác (trừ `stacks/style`, dùng chung) |
| `adapters` | `kernel`, `ports`, `services`, `shared`                   | `stacks`                                                               |
| ghép nối   | tất cả                                                    | —                                                                      |

- Không có vòng phụ thuộc.
- Service và route HTTP gọi phần riêng của một ngôn ngữ giao diện qua `ProjectStack.view.features` (interface `ViewFeatures` / `ProjectFeatures` trong `kernel/features.ts`); ngôn ngữ không có (Pug) thì trả "chỉ xem" (E023).
- Phần style tới service và route qua `StyleService` và `ThemeTokens` (cũng trong `kernel/features.ts`), được ghép ở `index.ts` / `server-http.ts`.
- Mọi lần ghi file của một thao tác sửa đi qua `kernel/file-writer.ts` (mục 4); file riêng của KumiCraft (`.kumicraft/…`) đi qua `kernel/own-files.ts`. Test kiến trúc `architecture.test.ts` kiểm điều này.

### 6.2. Studio

```
studio/src/
  app/, routes/   khung ứng dụng
  core/           trạng thái và lệnh dùng chung (dưới)
  api/            gọi Server
  components/     thành phần giao diện dùng chung
  features/<x>/   mỗi tính năng; chỉ lộ ra ngoài qua features/<x>/index.ts
```

**`core/` của Studio chứa** những gì nhiều tính năng cùng cần. Đã dựng ở Đợt S (cột phải là nơi ở trước đó):

| Trong `core/`                       | Trước Đợt S                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| Dự án đang mở, hồ sơ, capability    | `features/project/project-store.ts`                                                         |
| Phần tử đang chọn                   | `features/selection/selection-store.ts`                                                     |
| Kênh nói chuyện với Bridge          | `features/selection/bridge-channel.ts`                                                      |
| Lịch sử Undo                        | `features/history/history-store.ts`                                                         |
| Gửi `EditIntent` (một hàm duy nhất) | rải trong `api/source-client`, `style-client`, các tính năng                                |
| Khung màn hình đang xem, breakpoint | `features/editor/canvas-view-store.ts`, `frame-focus-store.ts`, `inspector/screen-scope.ts` |
| Cài đặt người dùng                  | `store/settings-store.ts`                                                                   |

Quy tắc:

- Tính năng dùng `core`, `api`, `components`, `shared`. Tính năng dùng tính năng khác **chỉ qua `index.ts`** của nó và **không có vòng**.
- Tính năng không tự gọi API sửa file; mọi sửa đi qua `core/edits.ts` (lint kiểm).
- `core` không dùng tính năng nào (`studio-core-not-features`); tính năng tự đăng ký với `core` khi cần, vd. hàm xử lý tin nhắn Bridge đăng ký ở `main.tsx`.
- Cài đặt người dùng hiện vẫn ở `store/settings-store.ts`.
- `features/editor` (hiện dính 23 nhóm) chỉ còn là **bố cục màn hình** ghép các tính năng; trạng thái của nó xuống `core`.
- Studio đọc `Capability` để hiện / ẩn công cụ, kèm lý do khi người dùng hỏi (UX first).

### 6.3. Bridge và Shared

- **Bridge client** giữ nguyên nguyên tắc: chỉ biết DOM, `SourceLoc`, `UseLoc`.
- Bộ đánh dấu (`LocStamper`) thuộc về hiện thực `ViewLanguage`, đóng gói sao cho runner (tiến trình con, hoặc công cụ ngoài như chương trình .NET đánh dấu Razor) nạp được. Cách gắn vào từng runtime (plugin Vite, loader Turbopack, proxy) ở `bridge/integrations`.
- **Shared** chỉ chứa hợp đồng: schema API, sự kiện, thông điệp Bridge, `EditIntent`, `StyleIntent`, `ProjectProfile`, `Capability`. Bộ đọc Tailwind đã ra package `@kumicraft/style-tailwind`, thư viện khối ra `@kumicraft/content` (Đợt S).

### 6.4. Máy kiểm quy tắc

- Công cụ kiểm phụ thuộc (chọn ở bước 4) chạy trong `pnpm lint` và CI, kiểm mọi quy tắc 6.1 và 6.2. Vi phạm cũ ghi vào **danh sách nợ**, vi phạm mới làm lint đỏ; danh sách nợ chỉ được giảm.
- **Bộ test chung (contract test) cho mỗi interface**:
  - mọi `ViewEditor`: chèn, xóa, di chuyển, bọc, giữ định dạng, ghép lại phần `kept` của class, Undo trả đúng byte;
  - mọi `RuntimeAdapter`: chạy được dự án mẫu, trang có dấu đúng, không sửa file cấu hình của người dùng;
  - mọi `StyleSystem`: đọc lại đúng giá trị vừa ghi, cho mọi thuộc tính trong danh sách hỗ trợ.

## 7. Báo lỗi và lý do "không làm được"

- Giữ cách hiện nay: mọi lỗi là `Result` với mã `E0xx` (20 mã) và tham số; Studio dịch thành câu dễ hiểu.
- **Lý do "không làm được" thống nhất thành `CapabilityReason`**, dùng chung cho mọi ngôn ngữ. Các lý do E023 hiện có (`viewOnly`, `classExpression`, `textExpression`, `textMixed`, `componentNotFound`, `differentParents`, `rootElement`…) trở thành danh sách này. Ngôn ngữ mới **dùng lại** lý do có sẵn trước khi thêm lý do mới.
- Studio biết lý do **trước khi** người dùng bấm (qua `ElementInfo` và `Capability`), nên công cụ không làm được thì ẩn hoặc hiện kèm lý do, không để người dùng bấm rồi mới báo lỗi.
- Lỗi do môi trường (không khởi chạy được lệnh, sai phiên bản công cụ, không bọc được cấu hình Next) ghi vào file log (`kumicraft.log`) kèm tên lỗi gốc, như đã làm cho lỗi pnpm trên Mac.

## 8. Ngân sách tốc độ

Giữ ngân sách hiện có trong `spec.md` (PB-01 đến PB-11), thêm hai điểm:

- PB-02 (xác nhận ô Inspector → Canvas hiện thay đổi ≤ 500 ms) **áp dụng cho runtime `buildPlugin` và `templateHook`**. Runtime `shadowCopy` (Razor) có ngân sách riêng, đặt sau khi đo (chưa đo trong bản thử).
- Phương án B của style (mục 3.3) giữ đọc giá trị và xem trước ở Studio, không thêm vòng gọi Server.

## 9. Các quyết định kiến trúc (ADR)

Mỗi quyết định ghi các phương án đã xét và lý do chọn, để sau này biết quyết định còn đúng không.

**ADR-A1: Hồ sơ dự án theo 3 trục; meta-framework là gói cấu hình sẵn.**

- Phương án đã xét: (a) giữ adapter theo cặp như hiện nay; (b) 3 trục; (c) 4 trục, thêm meta-framework.
- Chọn (b). (a) tăng theo cấp số nhân và lặp code (02-hien-trang mục 8). (c) thừa: meta-framework không có hành vi riêng ngoài việc chọn sẵn 3 trục và cách tìm trang.

**ADR-A2: Một đường sửa, một `FileWriter`.**

- Phương án: (a) mỗi thao tác tự ghi như hiện nay; (b) mọi thao tác trả `TextChange`, lõi ghi.
- Chọn (b): chất lượng số 1 chỉ phải đảm bảo một chỗ; ngôn ngữ mới không phải viết lại phần ghi, kiểm hash, Undo.

**ADR-A3: Ba kiểu cắm bộ đánh dấu, kể cả bản sao.**

- Phương án: (a) chỉ hỗ trợ công cụ cho cắm plugin; (b) đọc vị trí lúc chạy từ framework (React 19 đã bỏ `_debugSource`, các framework khác không có); (c) thêm kiểu bản sao cho template phía server.
- Chọn (c): bản thử Razor chạy đúng (03a). (a) loại mất ASP.NET, Django, Laravel, là nhóm người dùng mục tiêu. (b) không có nguồn tin cậy.

**ADR-A4: Gộp style bằng một package Tailwind thuần dùng ở cả Studio và Server (phương án B, mục 3.3).**

- Lý do: một bản logic, Server quyết định cuối, không thêm độ trễ, không viết lại Inspector.

**ADR-A5: `Capability` thay cờ `viewOnly`.**

- Phương án: (a) giữ cờ `viewOnly` + kiểm rải rác; (b) mỗi ngôn ngữ khai báo thao tác làm được.
- Chọn (b): hỗ trợ được mức "chỉnh được một phần" (vd. đổi class được, chèn khối chưa được), và Studio ẩn đúng công cụ.

**ADR-A6: Quy tắc phụ thuộc kiểm bằng máy, có danh sách nợ.**

- Phương án: (a) chỉ ghi trong tài liệu; (b) kiểm bằng máy, sửa hết vi phạm trước khi bật; (c) kiểm bằng máy, có danh sách nợ.
- Chọn (c). (a) đã thất bại (160 dòng lệch trong spec-log). (b) chặn mọi việc khác quá lâu.

**ADR-A7: Chỉ "đóng băng" interface sau khi có hiện thực chỉnh được thứ hai.**

- Phương án: (a) chốt interface ngay; (b) chốt sau khi ngôn ngữ thứ hai (dự kiến Vue) chỉnh được và qua bộ test chung.
- Chọn (b): hiện chỉ có một bộ sửa thật (JSX); interface thiết kế từ một ví dụ dễ lệch. Trước khi đóng băng, interface được phép đổi mà không cần ADR mới.

**ADR-A8: AI tự viết code, không gọi thao tác sửa.**

- Quyết định của chủ dự án (2026-11-22), ghi ở 01-muc-tieu. MCP chỉ để kiểm thử.

## 10. Thử thiết kế bằng ba ví dụ

**Thêm Vue (chỉ xem, rồi chỉnh được).** Viết `stacks/view/vue` với `stamper('buildPlugin')` (cách đã thử: cắm `nodeTransforms` vào plugin Vue có sẵn). Thêm dòng `vite + vue` vào bảng tổ hợp → mở được ở chế độ chỉ xem. Sau đó viết `editor` cho Vue (đọc template bằng `@vue/compiler-sfc`) và cho qua bộ test chung → chỉnh được; Tailwind / CSS chạy ngay. Không sửa lõi, Studio, Bridge client, runtime Vite.

**Thêm Next.js.** Viết `stacks/runtime/next` (chạy Next trong tiến trình KumiCraft, thêm loader Turbopack và webpack vào cấu hình lúc nạp) và `stacks/meta/next` (chọn `next` + `jsx` + `PagesProvider` theo `app/`, `pages/`). Bộ sửa JSX, style, Undo, Studio dùng nguyên.

**Thêm ASP.NET Razor (chỉ xem).** Viết `stacks/runtime/aspnet` với `stampHost: 'shadowCopy'` và `ShadowSync` (chạy `dotnet watch` trên bản sao), và `stacks/view/razor` với bộ đánh dấu dùng trình biên dịch Razor trong SDK của người dùng. Tailwind / CSS đọc được ngay; chỉnh sửa Razor là bước sau.

Nếu một ví dụ buộc phải sửa lõi hay Studio, thiết kế còn thiếu; sửa thiết kế trước khi làm.

## 11. Rủi ro khi chuyển đổi

| Rủi ro                                                     | Cách giảm                                                                                                        |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Chuyển một khối 110.000 dòng làm hỏng tính năng đang chạy  | Chuyển từng bước nhỏ, mỗi bước app vẫn chạy; không viết lại cùng lúc; giữ toàn bộ 392 file test làm lưới an toàn |
| Đổi đường sửa làm sai Undo hoặc ghi hỏng file              | Làm `FileWriter` + `History` trước, có contract test riêng, rồi mới chuyển từng thao tác sang                    |
| Interface đầu tiên thiết kế lệch vì chỉ có một ví dụ (JSX) | ADR-A7: cho phép đổi tới khi có ngôn ngữ chỉnh được thứ hai                                                      |
| Next.js đổi phần nội bộ ở bản sau                          | Báo đúng lỗi thật khi không bọc được cấu hình; E2E trên dự án mẫu Next 15 và 16                                  |
| Bản sao (Razor) chậm khi sửa                               | Đo trước khi hứa; ngân sách riêng (mục 8)                                                                        |
| Khối thư viện xấu đi khi chuyển sang cây trung lập         | Test so ảnh từng khối trước và sau                                                                               |
| Phạm vi phình ra, làm mãi không xong                       | Bước 4 chia đợt nhỏ, mỗi đợt có điều kiện xong đo được                                                           |

## 12. Đối chiếu hiện tại → đích

| Hiện tại                                             | Đích                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------ |
| `FrameworkAdapter` (vite-react, express-pug)         | `RuntimeAdapter` (vite, express-proxy) + `ViewLanguage` (jsx, pug)       |
| `SupportReport` + `editMode`                         | `ProjectProfile` + `Capability`                                          |
| `core/source-editor` + phần JSX của `core/project`   | `stacks/view/jsx`                                                        |
| Phần còn lại của `core/project`                      | `services`                                                               |
| `core/style` (CSS…) + Tailwind trong Studio          | `stacks/style/*` + package `style-tailwind`, một đường qua `EditService` |
| `ElementClassName` (riêng JSX)                       | `ClassSlot` (mọi ngôn ngữ)                                               |
| Mỗi thao tác tự ghi file                             | `FileWriter` duy nhất                                                    |
| `transform-jsx` (bridge), `pug-loc-plugin` (runners) | `LocStamper` của từng `ViewLanguage`                                     |
| Thư viện khối trong `shared` (chuỗi JSX)             | Package nội dung, cây trung lập + `SnippetRenderer`                      |
| Lý do E023 rải rác, kiểm `viewOnly` ở 4 chỗ          | `CapabilityReason` + `Capability`, một chỗ                               |
| 29 store zustand rải trong các tính năng             | Trạng thái dùng chung ở `studio/src/core`                                |
| 2 quy tắc phụ thuộc được lint kiểm                   | Toàn bộ quy tắc mục 6, có danh sách nợ, có contract test                 |

**Giữ nguyên**: `SourceLoc` / `UseLoc` (`data-rc-loc`, `data-rc-use`), Bridge client, Undo đúng byte, các port của Server, AI agent tự viết code, hợp đồng có schema zod, mã lỗi `E0xx`.

## 13. Những gì bước 4 phải quyết

1. Thứ tự chuyển đổi, sao cho mỗi bước app vẫn chạy và test cũ vẫn qua.
2. Chọn công cụ kiểm phụ thuộc và lập danh sách nợ ban đầu.
3. Đợt 0 gồm những phần nào (tối thiểu: mục 2, 3.1, 3.2, 4, 6.1, 6.4).
4. Khi nào làm gộp style (3.3), class động cho ngôn ngữ khác (3.5), tách nội dung (5), `core/` của Studio (6.2).
5. Tài liệu kiến trúc thay phần nào của `spec.md`, và cách giữ nó khớp với code.
