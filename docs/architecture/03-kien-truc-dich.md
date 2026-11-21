# Kiến trúc đích KumiCraft

Bước 3 của việc dựng lại kiến trúc. Dựa trên [01-muc-tieu.md](01-muc-tieu.md) (mục tiêu) và [02-hien-trang.md](02-hien-trang.md) (hiện trạng). Bản nháp ngày 2026-11-22, chờ chủ dự án duyệt.

Tài liệu này nói **KumiCraft nên được chia thế nào**, chưa nói làm theo thứ tự nào (thứ tự ở bước 4). Tên trong code (interface, thư mục) viết bằng tiếng Anh như quy ước của repo; đây là bản phác, tên cuối cùng chốt khi làm.

## 1. Ý tưởng chính trong một trang

1. **Một dự án được mô tả bằng một "hồ sơ" (profile) theo 3 trục**: công cụ chạy, ngôn ngữ giao diện, hệ style. Nhận diện chỉ làm một việc: điền hồ sơ này.
2. **Mỗi trục có một interface riêng**, mỗi công nghệ là một hiện thực cắm vào: `RuntimeAdapter` (Vite, Express, Next…), `ViewLanguage` (JSX, Pug, Vue…), `StyleSystem` (Tailwind, CSS…). Thêm công nghệ mới = thêm một hiện thực, **không sửa lõi**.
3. **Lõi không biết công nghệ nào.** Lõi chỉ biết: dự án, file, phần tử (qua vị trí `file:dòng:cột`), thao tác sửa, Undo. Mọi thứ cụ thể (node JSX, class Tailwind, plugin Vite) nằm trong hiện thực của từng trục.
4. **Mọi thao tác sửa đi một đường**: Studio gửi **ý định** ("đổi màu chữ thành X", "chèn khối Y sau phần tử Z") → lõi hỏi hiện thực phù hợp xem phải sửa chữ nào trong file nào → một bộ ghi file duy nhất ghi, kiểm hash, lưu Undo.
5. **Mỗi ngôn ngữ giao diện khai báo nó làm được thao tác nào** (capability). Studio chỉ hiện công cụ làm được; "chỉ xem" đơn giản là ngôn ngữ chưa khai báo thao tác sửa nào.
6. **Quy tắc phụ thuộc được máy kiểm**, không chỉ ghi trên giấy.

## 2. Mô hình lõi (không phụ thuộc công nghệ)

| Khái niệm        | Nghĩa                                                                                                                                               | Hiện nay tương ứng                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `ProjectProfile` | Hồ sơ dự án: `runtime` (công cụ chạy + phiên bản), `view` (ngôn ngữ giao diện + phiên bản), `styling` (hệ style), `packageManager`, `workspaceRoot` | `SupportReport` + `FrameworkAdapter`               |
| `SourceLoc`      | Vị trí một phần tử trong code: `file:dòng:cột` (+ số thứ tự khi một dòng code sinh nhiều phần tử)                                                   | `data-rc-loc` + `index` (giữ nguyên)               |
| `ViewDocument`   | Một file giao diện đã được ngôn ngữ của nó đọc: tìm được phần tử theo `SourceLoc`, biết cha con                                                     | AST Babel (chỉ JSX)                                |
| `ElementInfo`    | Thông tin một phần tử cho Inspector: thẻ, class, chữ, thuộc tính, có trong vòng lặp không, có sửa được không                                        | `ElementSource` (giữ, bỏ phần riêng JSX)           |
| `EditIntent`     | Ý định sửa do Studio gửi: đặt class, đặt chữ, đặt thuộc tính, chèn, xóa, di chuyển, bọc, đổi style…                                                 | `SourceEdit`, `StructureEdit`, `StyleApplyRequest` |
| `TextChange`     | Kết quả cụ thể: thay đoạn chữ từ vị trí A tới B trong file F (kèm hash file lúc đọc)                                                                | magic-string trong từng thao tác                   |
| `Capability`     | Thao tác nào ngôn ngữ / hệ style của dự án làm được, và lý do nếu không                                                                             | `editMode: viewOnly` + E023 rải rác                |
| `HistoryStep`    | Một bước Undo: nội dung trước và sau của các file đã ghi                                                                                            | giữ nguyên `core/history`                          |

`SourceLoc` là **chỗ nối giữa các trục**: trục chạy và trục ngôn ngữ cùng gắn dấu này lên trang; Bridge, Canvas, Inspector chỉ làm việc với nó. Đây là điểm tốt nhất của kiến trúc hiện nay và được giữ nguyên.

## 3. Ba trục mở rộng

### 3.1. Trục A: công cụ chạy (`RuntimeAdapter`)

Việc: chạy trang của dự án lên Canvas và gắn Bridge vào.

```ts
interface RuntimeAdapter {
  readonly id: RuntimeId; // 'vite' | 'express' | 'next' | 'webpack' | 'aspnet' …
  detect(input: DetectInput): RuntimeMatch | undefined; // phiên bản, lý do không hỗ trợ
  /** Các ngôn ngữ giao diện chạy được trên runtime này, và cách cắm bộ đánh dấu của chúng. */
  readonly stampHost: 'buildPlugin' | 'templateHook' | 'htmlProxy';
  runner(ctx: RunnerContext): RunnerSpec; // tiến trình con, lệnh, cổng, cách gắn Bridge
  restartOn?(relPath: string): boolean;
  buildCheck?(ctx: BuildCheckContext): BuildCheckSpec;
  requiredPackages(profile: ProjectProfile): readonly string[];
}
```

- Vite, webpack, Next gắn Bridge bằng plugin build (`buildPlugin`).
- Express, ASP.NET, Django, Laravel: KumiCraft đứng trước server của dự án bằng proxy (`htmlProxy`), như Express hiện nay.
- Pug, Razor… đánh dấu lúc biên dịch template (`templateHook`), khi runtime cho phép.

### 3.2. Trục B: ngôn ngữ giao diện (`ViewLanguage`)

Việc: biết file giao diện viết thế nào, đánh dấu vị trí, đọc phần tử, và biến ý định sửa thành `TextChange`.

```ts
interface ViewLanguage {
  readonly id: ViewLanguageId; // 'jsx' | 'pug' | 'vue' | 'razor' | 'html' …
  readonly extensions: readonly string[];
  detect(input: DetectInput): ViewMatch | undefined;
  /** Bộ đánh dấu `SourceLoc`, theo từng kiểu cắm mà runtime hỗ trợ. */
  stamper(host: StampHost): LocStamper | undefined;
  parse(file: string, text: string): Result<ViewDocument>;
  readonly capabilities: ViewCapabilities; // thao tác nào làm được
  readonly editor?: ViewEditor; // vắng = chỉ xem
  readonly snippets?: SnippetRenderer; // biến khối thư viện thành code của ngôn ngữ này
  readonly pages?: PagesProvider; // tìm trang / route, nếu ngôn ngữ tự quyết (vd. file-based)
}

interface ViewEditor {
  setClass(doc: ViewDocument, at: SourceLoc, classes: ClassChange): Result<TextChange[]>;
  setText(doc: ViewDocument, at: SourceLoc, text: string): Result<TextChange[]>;
  setAttribute(doc: ViewDocument, at: SourceLoc, name: string, value: AttrValue): Result<TextChange[]>;
  insert?(doc: ViewDocument, target: InsertTarget, snippet: Snippet): Result<TextChange[]>;
  remove?(doc: ViewDocument, at: SourceLoc): Result<TextChange[]>;
  move?(…): Result<TextChange[]>;
  wrap?(…): Result<TextChange[]>;
  // Thao tác riêng của một ngôn ngữ (component, prop, kit tương tác của React) nằm ở phần mở rộng
  // của chính ngôn ngữ đó, không nằm trong interface chung.
}
```

- **Mọi hàm sửa chỉ trả về `TextChange`**, không tự ghi file. Ghi file, kiểm hash, định dạng code và Undo do lõi làm, một chỗ duy nhất, giống nhau cho mọi ngôn ngữ.
- Thao tác chung (class, chữ, thuộc tính, chèn, xóa, di chuyển, bọc) có trong interface. Thao tác chỉ một ngôn ngữ có (sửa prop component, kit tương tác React, Reveal) khai báo thêm qua `capabilities` của ngôn ngữ đó.
- Bộ sửa JSX hiện nay (`core/source-editor`, phần JSX của `core/project`) trở thành hiện thực `ViewLanguage` đầu tiên, `jsx`. Pug thành hiện thực thứ hai, hiện chưa có `editor` (chỉ xem).

### 3.3. Trục C: hệ style (`StyleSystem`)

Việc: đọc style hiện tại của phần tử và biến ý định "đổi thuộc tính style" thành thay đổi cụ thể.

```ts
interface StyleSystem {
  readonly id: StyleSystemId; // 'tailwind' | 'css' | 'cssModules' | 'sass' | 'less' | 'bootstrap' …
  detect(input: DetectInput): StylingMatch | undefined;
  read(ctx: StyleContext, at: SourceLoc): Result<StyleReading>; // giá trị theo thuộc tính CSS
  apply(ctx: StyleContext, at: SourceLoc, intent: StyleIntent): Result<StylePlan>;
  readonly tokens?: ThemeTokens; // màu, cỡ chữ… của dự án
}

type StylePlan =
  | { kind: 'classes'; change: ClassChange } // lõi chuyển cho ViewEditor.setClass
  | { kind: 'stylesheet'; changes: TextChange[] }; // sửa file CSS / Sass / Less
```

- **Studio chỉ gửi ý định**: `{ property: 'color', value: '#e11d48', state: 'hover', breakpoint: 'md', scope: 'onlyThis' }`. Studio không còn tự tính class Tailwind.
- Tailwind trả `classes` (lõi đưa cho `ViewEditor` của ngôn ngữ đang dùng, nên Tailwind chạy được trên JSX, Vue, Razor… như nhau). CSS trả `stylesheet`.
- Xem trước khi kéo thanh trượt vẫn ở Studio, nhưng chỉ dùng **giá trị CSS** (inline style tạm), không cần biết hệ style. Đây là cách `sendStylePreview` đang làm.
- Bộ đọc class Tailwind (`shared/src/tailwind`) chuyển vào hiện thực `tailwind`; Studio chỉ dùng phần nào cần cho hiển thị (bảng màu) qua API hoặc một package riêng.

### 3.4. Ghép ba trục: hồ sơ và bảng tổ hợp

- Nhận diện chạy theo thứ tự đã chốt ở [nhan-dien-du-an.md](../construction/giao-viec/nhan-dien-du-an.md): meta-framework → framework phía server → công cụ build → ngôn ngữ giao diện → hệ style. Kết quả là một `ProjectProfile`.
- **Meta-framework** (Next, Nuxt, SvelteKit, Astro) là một gói cấu hình sẵn: nó chọn luôn runtime, ngôn ngữ, và cách tìm trang. Không phải trục thứ tư.
- Một **bảng tổ hợp** nói tổ hợp nào chạy được (ví dụ: runtime `vite` + ngôn ngữ `jsx` qua `buildPlugin`). Tổ hợp không có trong bảng → báo "chưa hỗ trợ" kèm lý do đúng (không còn báo chung chung "thiếu React").
- Mức hỗ trợ suy ra từ hồ sơ, không gán tay: có runner + có `editor` → chỉnh được; có runner, không có `editor` → chỉ xem; không có runner → không mở được.

## 4. Một đường cho mọi thao tác sửa

```
 Studio (Inspector, kéo thả, thư viện…)
   │  EditIntent  (ý định, không chứa code)
   ▼
 EditService (lõi)
   │ 1. đọc file, ViewLanguage.parse → ViewDocument
   │ 2. hỏi StyleSystem (nếu là style) → StylePlan
   │ 3. hỏi ViewEditor → TextChange[]
   ▼
 FileWriter (lõi, duy nhất)
   │ kiểm hash (file vừa bị sửa tay thì từ chối), định dạng, ghi nguyên tử
   ▼
 History: lưu bước Undo đúng từng byte  →  sự kiện cho Studio
```

- Thay cho hiện nay: mỗi thao tác tự dùng magic-string rồi tự ghi, và style CSS đi một đường riêng.
- **Nguyên tắc "không làm hỏng code người dùng" (chất lượng số 1) chỉ phải đúng ở một chỗ:** `FileWriter` + `History`.
- AI không đi qua đường này: agent tự viết code, lõi chỉ chụp trạng thái file trước và sau lượt để hoàn tác (như hiện nay, quyết định B ở bước 2).

## 5. Nội dung giao diện (thư viện khối, kit)

- Khối thư viện hiện là chuỗi JSX + class Tailwind. Đích: mỗi khối mô tả bằng **cây phần tử trung lập** (thẻ, chữ, thuộc tính, ý định style), và `SnippetRenderer` của từng ngôn ngữ biến nó thành code (JSX, Vue, Razor…), còn `StyleSystem` quyết định style viết thành class hay CSS.
- Kit tương tác (modal, carousel…) là component của một framework cụ thể; mỗi ngôn ngữ giao diện có bộ kit riêng, hoặc không có (thì công cụ đó không hiện).
- Nội dung ra khỏi `shared` (vốn chỉ để chứa hợp đồng) và vào một package nội dung riêng.
- Phần này chỉ cần xong **trước khi ngôn ngữ thứ hai được chỉnh sửa** (bước 4 xếp lịch).

## 6. Chia module và quy tắc phụ thuộc

### 6.1. Server

```
server/src/
  kernel/        mô hình lõi (mục 2), interface 3 trục, FileWriter, History, EditService
  services/      dự án, trang, style, chạy dự án, AI, tác vụ nền — chỉ dùng kernel + ports
  ports/         file, tiến trình, hệ thống, log, sự kiện, theo dõi file
  stacks/        hiện thực theo trục
    runtime/vite, runtime/express-proxy, …
    view/jsx, view/pug, …
    style/tailwind, style/css, style/bootstrap, …
    meta/next, … (sau này)
  adapters/      http, fs, process, log, watcher (hiện thực ports)
  index.ts       nơi duy nhất ghép tất cả (đăng ký các hiện thực vào registry)
```

| Module     | Được dùng                                          | Không được dùng                                                                           |
| ---------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `kernel`   | `shared` (hợp đồng)                                | mọi thứ khác                                                                              |
| `services` | `kernel`, `ports`, `shared`                        | `stacks`, `adapters`, thư viện của một công nghệ (Babel, postcss…)                        |
| `stacks/*` | `kernel`, `ports`, `shared`, thư viện của chính nó | `services`, `adapters`, `stacks` khác (trừ khi khai báo, vd. `meta/next` dùng `view/jsx`) |
| `adapters` | `kernel`, `ports`, `services`, `shared`            | `stacks`                                                                                  |
| `index.ts` | tất cả                                             | —                                                                                         |

- Không có vòng phụ thuộc nào giữa các module trên.
- `core/project` hiện nay được chia: phần nhận diện → `stacks`; phần trang, bản nháp, theme, cài đặt → `services`; phần JSX → `stacks/view/jsx`.

### 6.2. Studio

```
studio/src/
  app/, routes/   khung ứng dụng
  core/           trạng thái dùng chung: dự án đang mở, phần tử đang chọn, gửi EditIntent, capability
  api/            gọi Server
  components/     thành phần giao diện dùng chung
  features/<x>/   mỗi tính năng; chỉ lộ ra ngoài qua features/<x>/index.ts
```

- Tính năng dùng `core`, `api`, `components`, `shared`. Tính năng dùng tính năng khác **chỉ qua `index.ts`** của nó, và **không được có vòng**.
- Phần `editor` hiện là trung tâm (dính 23 nhóm) được tách: phần trạng thái dùng chung xuống `core/`, phần bố cục màn hình ở lại `features/editor`.
- Studio đọc `Capability` của dự án để hiện / ẩn công cụ (UX first: không có nút bấm mà không làm gì).

### 6.3. Bridge và Shared

- **Bridge client** giữ nguyên nguyên tắc: chỉ biết DOM và `SourceLoc`.
- Bộ đánh dấu của từng ngôn ngữ (`transform-jsx`, hook Pug) là một phần của hiện thực `ViewLanguage`, đóng gói sao cho runner (tiến trình con) nạp được. Cách gắn vào từng runtime (plugin Vite, proxy) ở `bridge/integrations`.
- **Shared** chỉ chứa hợp đồng: schema API, sự kiện, thông điệp Bridge, `EditIntent`, `ProjectProfile`, `Capability`. Bộ đọc Tailwind và thư viện khối chuyển ra (mục 3.3, 5).

### 6.4. Máy kiểm quy tắc

- Một công cụ kiểm phụ thuộc (dependency-cruiser hoặc luật lint tương đương; chọn ở bước 4) chạy trong `pnpm lint` và CI, kiểm mọi quy tắc ở 6.1 và 6.2.
- Vi phạm cũ được ghi vào một **danh sách nợ** cho phép tạm; vi phạm mới làm lint đỏ. Danh sách nợ chỉ được giảm.
- **Bộ test chung cho mỗi interface** (contract test): mọi `ViewEditor` phải qua cùng một bộ test (chèn, xóa, di chuyển, giữ định dạng, Undo trả đúng byte). Thêm ngôn ngữ mới = chạy bộ test đó cho nó.

## 7. Thử thiết kế bằng hai ví dụ

### 7.1. Thêm Vue (chỉ xem, rồi chỉnh được)

1. Viết `stacks/view/vue`: `detect` (gói `vue`), `extensions: ['.vue']`, `stamper('buildPlugin')` (đánh dấu template khi Vite biên dịch). Chưa có `editor`.
2. Thêm dòng `vite + vue` vào bảng tổ hợp.
3. Kết quả: mở được dự án Vue + Vite ở chế độ chỉ xem. **Không sửa** lõi, Studio, Bridge client, runtime Vite.
4. Sau đó viết `editor` cho Vue và cho chạy qua bộ test chung → chỉnh được. Tailwind / CSS chạy ngay vì `StyleSystem` không biết ngôn ngữ.

### 7.2. Thêm Next.js

1. Viết `stacks/runtime/next`: chạy dev server của Next, gắn Bridge bằng plugin build của Next.
2. Viết `stacks/meta/next`: chọn runtime `next` + ngôn ngữ `jsx` + `PagesProvider` theo thư mục `app/` / `pages/`.
3. Bộ sửa JSX, style, Undo, Studio dùng nguyên.

Nếu một ví dụ ở trên buộc phải sửa lõi hay Studio, nghĩa là thiết kế còn thiếu; phải sửa thiết kế trước khi làm.

## 8. Trả lời các câu hỏi của bước 2

| Câu hỏi (02-hien-trang mục 9)          | Trả lời                                                         |
| -------------------------------------- | --------------------------------------------------------------- |
| 1. Mô hình lõi                         | Mục 2                                                           |
| 2. Interface bộ sửa code theo ngôn ngữ | `ViewLanguage` + `ViewEditor` + `Capability` (mục 3.2)          |
| 3. Gộp hai đường style                 | `StyleSystem` trên Server, Studio chỉ gửi ý định (mục 3.3, 4)   |
| 4. Thao tác dùng chung cho AI          | Đã bỏ (quyết định B)                                            |
| 5. Tách nội dung giao diện             | Cây phần tử trung lập + `SnippetRenderer` theo ngôn ngữ (mục 5) |
| 6. Quy tắc phụ thuộc kiểm bằng máy     | Mục 6.4                                                         |

## 9. Đối chiếu hiện tại → đích

| Hiện tại                                             | Đích                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| `FrameworkAdapter` (vite-react, express-pug)         | `RuntimeAdapter` (vite, express-proxy) + `ViewLanguage` (jsx, pug) |
| `SupportReport` + `editMode`                         | `ProjectProfile` + `Capability`                                    |
| `core/source-editor` + phần JSX của `core/project`   | `stacks/view/jsx`                                                  |
| Phần còn lại của `core/project`                      | `services` (dự án, trang, bản nháp, theme, cài đặt)                |
| `core/style` (CSS…) + Tailwind trong Studio          | `stacks/style/*`, một đường qua `EditService`                      |
| Mỗi thao tác tự ghi file                             | `FileWriter` duy nhất                                              |
| `transform-jsx` (bridge), `pug-loc-plugin` (runners) | `LocStamper` của từng `ViewLanguage`                               |
| Thư viện khối trong `shared` (chuỗi JSX)             | Package nội dung, cây trung lập + `SnippetRenderer`                |
| Kiểm `viewOnly` ở 4 chỗ                              | Một chỗ: `Capability`                                              |
| 2 quy tắc phụ thuộc được lint kiểm                   | Toàn bộ quy tắc mục 6, có danh sách nợ                             |

Những phần **giữ nguyên**: `SourceLoc` / `data-rc-loc`, Bridge client, Undo đúng byte, các port của Server, AI agent tự viết code, hợp đồng có schema zod.

## 10. Những gì bước 4 phải quyết

1. Thứ tự chuyển đổi, sao cho mỗi bước app vẫn chạy và test cũ vẫn qua.
2. Chọn công cụ kiểm phụ thuộc, và lập danh sách nợ ban đầu.
3. Đợt 0 gồm những phần nào của tài liệu này (tối thiểu: mục 2, 3.1, 3.2, 4, 6.1, 6.4).
4. Khi nào làm gộp style (mục 3.3) và tách nội dung (mục 5).
5. Tài liệu kiến trúc thay phần nào của `spec.md`, và cách giữ nó khớp với code.
