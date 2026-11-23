# 03c. Kiến trúc Razor (ASP.NET Core: Razor Pages và MVC)

Đợt 4 của [04-lo-trinh.md](04-lo-trinh.md). Bản phân tích ngày 2026-11-23, chủ dự án duyệt (Razor Pages và MVC, Tailwind theo phương án (a)); đã làm, kết quả và chỗ khác bản phân tích ở mục 9. Dựa trên [03-kien-truc-dich.md](03-kien-truc-dich.md) (các trục, `shadowCopy`), [03a](03a-ket-qua-thu-danh-dau.md) mục 3 (bản thử Razor) và code hiện tại (đã đọc: `kernel/stacks.ts`, `kernel/editing.ts`, `services/project/app-candidates.ts`, `runners/next-react.ts`, `runners/bridge-proxy.ts`).

Mục tiêu: dự án Razor Pages và MVC làm được **đủ thao tác** như React: mở, chọn phần tử, đọc style, sửa, chèn khối, Undo, nhờ AI sửa, quản lý trang. Backend của dự án (cơ sở dữ liệu, API ngoài) **không cần**: thiếu dữ liệu thì trang hiện phần giao diện, thiếu phần dữ liệu.

## 0. Khác gì Next.js

|                          | Next.js                            | Razor                                                                       |
| ------------------------ | ---------------------------------- | --------------------------------------------------------------------------- |
| Ai dựng trang            | `next dev` (Node)                  | `dotnet` (C#): HTML do code C# sinh ra lúc chạy                             |
| Gắn nhãn `file:dòng:cột` | Loader cắm vào Turbopack / webpack | **Không cắm được**: gắn vào **bản sao** của dự án, chạy bản sao             |
| Bộ sửa                   | Dùng lại bộ sửa JSX                | **Bộ sửa mới** cho `.cshtml`                                                |
| Tìm dự án                | `package.json`                     | `.csproj` (dự án .NET không có `package.json`)                              |
| Trang                    | File trong `app/`, `pages/`        | Razor Pages: file trong `Pages/`. MVC: `Views/<Controller>/<Action>.cshtml` |

## 1. Điều kiện cần

### 1.1 Trên máy người dùng

1. Cài **.NET SDK** đúng bản dự án dùng (`TargetFramework` trong `.csproj`). Thiếu: app báo rõ cần cài bản nào, không đoán.
2. Dự án tự chạy được bằng `dotnet run`. Trang cần cơ sở dữ liệu mà chưa có: trang hiện lỗi hoặc trống phần đó, như khi người dùng tự chạy.
3. Không cần mạng: chương trình phụ của KumiCraft (mục 2.2) build bằng SDK có sẵn, chỉ tham chiếu file trong SDK, không tải gói NuGet.

### 1.2 Điều kiện kỹ thuật phải thử trước (bước 0 của đợt)

Ba điểm bản thử chưa trả lời. Làm trước, **nếu điểm nào không đạt thì dừng lại báo chủ dự án**, không làm tiếp phần sau:

| #   | Thử gì                                                                                                                                                                                                                   | Đạt khi                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| 0a  | Chương trình phụ dùng **trình biên dịch Razor trong SDK** (`Sdks/Microsoft.NET.Sdk.Razor/tools/Microsoft.CodeAnalysis.Razor.Compiler.dll`, có sẵn trong SDK 10.0.302 trên máy chủ dự án). Bản thử dùng gói NuGet 6.0 cũ. | Gắn nhãn và ra bản đồ vị trí (mục 2.3) đúng cho mẫu `dotnet new webapp` và `dotnet new mvc` |
| 0b  | Bản sao đặt trong `obj/kumicraft/shadow/` của dự án, chạy bằng `dotnet watch`. Sửa một `.cshtml` gốc → gắn nhãn lại → trang đổi. **Đo thời gian.**                                                                       | Chạy được; thời gian sửa → Canvas đổi đo được và ghi lại (PB-02 là 500 ms cho Vite)         |
| 0c  | Proxy Bridge (đang dùng cho Express, Next) đứng trước `dotnet`                                                                                                                                                           | Bridge vào trang, chọn được phần tử, `dotnet watch` vẫn tự nạp lại trang                    |

Nếu 0b chậm quá mức dùng được: báo số đo, chủ dự án chọn hướng (03 mục 11, ADR-A3).

### 1.3 Chỗ code hiện tại chặn (đã đọc, có thật)

| Chỗ chặn                                                                                       | Phải đổi                                                                                      |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Tìm app chỉ quét `package.json` (`app-candidates.ts`); `DetectInput` bắt buộc có `packageJson` | Quét thêm `.csproj`; `DetectInput` cho phép không có `package.json`                           |
| Chỉ có **một** bộ sửa (JSX), tạo một lần trong `server-services.ts`, mọi dự án dùng chung      | Mỗi ngôn ngữ giao diện có bộ sửa riêng; route lấy bộ sửa theo bộ (`stack`) của dự án đang mở  |
| `StampHost` chỉ có `buildPlugin`, `templateHook`; `RuntimeAdapter.id` không có `dotnet`        | Thêm `shadowCopy` và runtime `dotnet`                                                         |
| `ViewLanguage.id` chỉ có `jsx`, `pug`                                                          | Thêm `razor`                                                                                  |
| Cài gói (`requiredPackages`, `node_modules`) giả định dự án Node                               | Runtime `dotnet` không có gói Node; thay bằng kiểm SDK                                        |
| Nhận diện style đọc `package.json` (Tailwind, Bootstrap)                                       | Đọc thêm `wwwroot/` (mẫu ASP.NET để Bootstrap ở `wwwroot/lib/bootstrap`, CSS ở `wwwroot/css`) |

## 2. Cấu trúc

### 2.1 Các phần và chỗ nằm

```
packages/server/src/
  razor-helper/                 chương trình phụ C# (nguồn), build bằng SDK của người dùng
  lib/razor/                    đọc HTML của .cshtml quanh các đoạn C# (markup.ts), gắn nhãn (stamp.ts)
  runners/dotnet-razor.ts       tiến trình con: bản sao + dotnet watch + proxy Bridge
  runners/razor/                chạy chương trình phụ (helper.ts), bản sao (shadow.ts), chờ trang mới (served-page.ts)
  runners/dotnet-css-watch.ts   chạy script Tailwind `--watch` của dự án (mục 5)
  stacks/runtime/dotnet/        nhận diện .csproj (Razor Pages / MVC), runtime `dotnet`
  stacks/view/razor/            ngôn ngữ giao diện `razor`: bộ sửa .cshtml (TypeScript)
  stacks/meta/razor-pages/      trang của Razor Pages (Pages/)
  stacks/meta/mvc/              trang của MVC (Views/ + controller)
  kernel/editing.ts             editorByView: route dùng bộ sửa của ngôn ngữ giao diện đang mở
  kernel/text-view-editor.ts    khung chung của bộ sửa theo đoạn chữ (Razor, Pug; từ đợt Pug, 03d mục 7)
packages/content/src/tree/      render-razor (HTML + `@` thành `@@`, xuống dòng an toàn)
```

Bộ trong bảng tổ hợp (`stacks/index.ts`):

```
aspnet-razor-pages = runtime dotnet (Razor Pages) + view razor + pages razor-pages
aspnet-mvc         = runtime dotnet (MVC)         + view razor + pages mvc
```

Cùng một bộ sửa `.cshtml` cho cả hai; khác nhau chỉ ở cách tìm trang. Mỗi loại có runtime riêng (cùng code) vì bảng tổ hợp chọn bộ theo "runtime nào nhận dự án trước".

### 2.2 Chương trình phụ Razor (`razor-helper`)

Một tiến trình .NET chạy suốt lúc dự án mở, nói chuyện với server KumiCraft qua stdin / stdout (JSON từng dòng). Đây là **bộ đọc Razor duy nhất**: dùng chính trình biên dịch Razor của SDK, nên hiểu đúng mọi cú pháp (`@if`, `@foreach`, `@(...)`, `@{ }`, tag helper, `@* *@`).

Một lệnh duy nhất: gửi `{ file, text }`, nhận **các đoạn C#** của file (vị trí đầu, cuối). Phần còn lại là HTML.

- Nguồn C# đi kèm gói npm của KumiCraft (`dist/razor-helper`). Lần đầu dùng: `dotnet build` vào `<dự án>/obj/kumicraft/razor-helper/<bản SDK>`, runner và bộ sửa dùng chung. Tham chiếu thẳng file `.dll` trong SDK (trình biên dịch Razor, Roslyn), không tải NuGet.
- Nạp phần mở rộng MVC của Razor (`@model`, `@page`, `@section`, `@inject`); thiếu nó, `List<string>` sau `@model` bị coi là HTML.
- Chạy suốt để tránh mỗi lần sửa phải khởi động .NET lại: lần đầu khoảng 300 ms, sau đó 1–25 ms một file.

### 2.3 Bản đồ vị trí: vì sao bộ sửa không tự đọc Razor

Bộ sửa (TypeScript) cần biết từng thẻ nằm ở đâu để thay đúng chữ trong file. Phần khó của Razor là **biết C# bắt đầu và kết thúc ở đâu** (`@if`, `@foreach`, `@(...)`, `@{ }`, `@:`, `<text>`, `@@`, email `me@x.com`): việc đó do trình biên dịch Razor của SDK làm (mục 2.2). Phần dễ, đọc thẻ HTML của phần còn lại, do `lib/razor/markup.ts` làm: mỗi thẻ có vị trí `<`, cuối tên thẻ, `>`, thẻ đóng; mỗi thuộc tính có giá trị chia thành đoạn chữ và đoạn C#; mỗi phần tử biết nó nằm trong khối C# nào (`@foreach` là vòng lặp).

Bộ sửa chỉ ghép **đoạn thay chữ** từ các vị trí này, như bộ sửa JSX làm với cây Babel. Phần C# không bao giờ bị sửa: class có C# thì chỉ sửa phần chữ cố định, giữ phần `@(...)` (03 mục 4, `ClassSlot.kept`).

Cây cú pháp đầy đủ của Razor (`MarkupElementSyntax`) không công khai trong SDK 10; tầng trung gian (`DocumentIntermediateNode`) công khai nhưng hàm lấy nó (`RazorCodeDocument.GetDocumentNode`) thì không: chương trình phụ gọi hàm đó bằng reflection, ở đúng một chỗ. Bản SDK sau đổi tên hàm: chương trình phụ báo đúng lỗi đó (E023 `razorNotRead`), không đoán.

### 2.4 Bản sao (`shadowCopy`)

- Đặt ở `<dự án>/obj/kumicraft/shadow/`. `obj/` là thư mục build của .NET: .NET không đưa file trong đó vào build của dự án gốc, và `.gitignore` của .NET (`dotnet new gitignore`, Visual Studio) bỏ qua nó. `dotnet new webapp` / `mvc` không tự tạo `.gitignore`: dự án chưa có thì git của người dùng sẽ thấy `obj/` như thấy bản build của chính họ.
- Bộ theo dõi file của server bỏ qua `obj/` và `bin/`, nên việc gắn nhãn lại bản sao không làm Studio nhận "file đổi".
- Chép mọi file trừ `bin/`, `obj/`, `node_modules/`, `.git/`. File `.cshtml` được gắn nhãn khi chép.
- Đường dẫn tương đối trong `.csproj` (ví dụ `<ProjectReference Include="..\Core\Core.csproj">`) được đổi thành đường dẫn tuyệt đối trong bản sao, vì bản sao nằm sâu hơn 3 cấp. Phần này cần thử ở bước 0b với dự án có tham chiếu sang dự án khác.
- File gốc đổi (người dùng, KumiCraft, AI): bộ theo dõi file sẵn có báo → chép / gắn nhãn lại **đúng file đó** vào bản sao → `dotnet watch` của bản sao nạp lại.

## 3. Luồng

### 3.1 Mở dự án

```
Người dùng chọn thư mục
   │
   ▼
Tìm app: thấy *.csproj có Sdk="Microsoft.NET.Sdk.Web"
   │
   ├── có thư mục Pages/  ──► bộ dotnet-razor-pages
   ├── có thư mục Views/ + Controllers/ ──► bộ dotnet-mvc
   └── không có cả hai (API thuần, Blazor) ──► "không có giao diện Razor" (lý do rõ)
   │
   ▼
Kiểm .NET SDK: `dotnet --list-sdks` có bản khớp TargetFramework?
   ├── không ──► báo "cần .NET SDK <bản>", dừng
   └── có
   │
   ▼
Build chương trình phụ (lần đầu, vào cache) ──► khởi động nó
   │
   ▼
Tạo bản sao obj/kumicraft/shadow/ (chép + gắn nhãn mọi .cshtml)
   │
   ▼
dotnet watch run (trong bản sao, cổng trong)  ◄── proxy Bridge (cổng runner) ◄── Canvas
   │
   ▼
Studio hiện trang; danh sách trang lấy từ Pages/ hoặc Views/
```

### 3.2 Chọn phần tử

```
Người dùng bấm trên Canvas
   │
   ▼
Bridge đọc data-rc-loc="Pages/Index.cshtml:12:5" của thẻ (do bản sao gắn)
   │
   ▼
Studio hỏi server: phần tử ở loc này
   │
   ▼
Bộ sửa Razor ──► chương trình phụ: map(Pages/Index.cshtml) (giữ trong bộ nhớ đến khi file đổi)
   │
   ▼
Trả về: thẻ, class (phần sửa được / phần C# giữ nguyên), chữ, thuộc tính, có trong @foreach không
   │
   ▼
Inspector hiện các ô như với React
```

Phần tử trong `_Layout.cshtml` có nhãn của chính file layout, nên sửa đúng file layout.

### 3.3 Sửa (Inspector, chèn khối, xóa, kéo thả)

```
Inspector đổi class "p-4" → "p-8"
   │
   ▼
Server: ClassEditResolver (dùng chung, Đợt S) ra class mới
   │
   ▼
Bộ sửa Razor: từ bản đồ vị trí ──► TextChange trên Pages/Index.cshtml (chỉ đoạn chữ của class)
   │
   ▼
Ghi file GỐC (đường ghi chung, có lịch sử cho Undo)
   │
   ▼
Runner theo dõi file gốc: Pages/Index.cshtml đổi
   └──► chương trình phụ: các đoạn C# ──► gắn nhãn ──► ghi vào bản sao
            │
            ▼
        dotnet watch thấy bản sao đổi ──► nạp lại (không báo khi xong)
            │
            ▼
        Runner hỏi lại trang Canvas đang mở (proxy nhớ nó) đến khi HTML khác
            │
            ▼
        "pageChanged" ──► server ──► sự kiện runner.pageChanged ──► Studio tải lại Canvas
```

File tĩnh (CSS do Tailwind dựng, ảnh): chép xong là báo ngay, vì `dotnet` phục vụ chúng thẳng từ đĩa. Đo trên 2 mẫu: lần sửa đầu khoảng 3,7–4,7 giây (.NET khởi động phần nạp nóng), sau đó 180–260 ms từ lúc ghi file đến lúc `dotnet` phục vụ trang mới.

Chèn khối: cây khối (Đợt 3) ──► `render-razor` (HTML, `@` trong chữ thành `@@`) ──► TextChange chèn vào sau / trong thẻ đích. Cùng đường ghi như trên.

### 3.4 Undo

```
Undo ──► lịch sử ghi lại đúng nội dung cũ của file GỐC ──► như mục 3.3 từ bước "Bộ theo dõi file"
```

Không có đường riêng: bản sao luôn đi theo file gốc.

### 3.5 Nhờ AI sửa

```
Người dùng chọn phần tử, nhờ AI ──► AI nhận loc "Pages/Index.cshtml:12:5" + nội dung file GỐC
   │
   ▼
AI sửa file GỐC ──► như mục 3.3 từ bước "Bộ theo dõi file"
```

AI không bao giờ thấy hay sửa bản sao.

### 3.6 Trang

```
Razor Pages                                   MVC
Pages/Index.cshtml        → /                 Views/Home/Index.cshtml     → /           (HomeController.Index)
Pages/About.cshtml        → /About            Views/Home/Privacy.cshtml   → /Home/Privacy
Pages/Shop/Item.cshtml    → /Shop/Item        Views/Shop/Item.cshtml      → /Shop/Item  (ShopController.Item)
Pages/Shared/_*.cshtml    → không phải trang  Views/Shared/_*.cshtml      → không phải trang
@page "/san-pham/{id}"    → theo chỉ thị @page
```

- **Razor Pages:** trang là file có dòng `@page`. Thêm trang = tạo `X.cshtml` + `X.cshtml.cs` (như `dotnet new page`); đổi tên, xóa = đổi / xóa cả hai file; Undo được.
- **MVC:** địa chỉ theo quy ước `{controller=Home}/{action=Index}`. Danh sách trang = view có action cùng tên trong controller (đọc tên hàm trong `Controllers/*Controller.cs`). Thêm trang = tạo view + thêm action `public IActionResult X() => View();` vào controller; đổi tên, xóa = đổi cả view và action. Undo được (cả hai file trong một bước lịch sử).
- Route tự đặt (`[Route]`, `MapControllerRoute` khác mặc định): danh sách trang ghi rõ "địa chỉ do code tự đặt", vẫn mở và sửa được view.

## 4. Sửa được gì trên `.cshtml`

| Thao tác                                                    | Razor                                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Class, style (Inspector)                                    | Có. Class trộn C# (`class="a @x"`): sửa phần chữ, giữ phần C#                               |
| Chữ                                                         | Có với chữ thường. Chữ là biểu thức (`@Model.Title`): chỉ xem, báo "dữ liệu từ code"        |
| Thuộc tính (`href`, `src`, `alt`, `asp-page`…)              | Có với giá trị cố định; giá trị có C# chỉ xem                                               |
| Đổi thẻ, chèn khối, nhân bản, xóa, di chuyển, bọc, gỡ bọc   | Có, trong cùng một khối HTML. Không di chuyển thẻ ra / vào giữa `@if`, `@foreach` khác nhau |
| Thẻ trong `@foreach`                                        | Sửa một lần là đổi mọi lần lặp (như React, Studio báo "trong vòng lặp")                     |
| Ảnh                                                         | Chép ảnh vào `wwwroot/images`, `src="/images/<file>"`                                       |
| Riêng React (props component, mảng dữ liệu, tách component) | Không áp dụng. Tương ứng Razor (partial, view component) để sau                             |
| Chữ nhiều đoạn, bọc chữ, thay SVG                           | Chưa có cho Razor: báo E023 `notForRazor`                                                   |

## 5. Style

- Mẫu `dotnet new webapp` / `mvc`: Bootstrap (`wwwroot/lib/bootstrap`) + `wwwroot/css/site.css`. Dùng bộ style CSS và Bootstrap đã có; nhận diện đọc thêm `wwwroot/`.
- Dự án ASP.NET có Tailwind (chủ dự án chọn (a)): nhận ra khi có file CSS `@import "tailwindcss"` và `tailwindcss` trong `package.json` của dự án. Runner chạy script `--watch` của dự án (ví dụ `"css:watch": "tailwindcss -i ./Styles/app.css -o ./wwwroot/css/site.css --watch"`) bằng trình quản lý gói của dự án, song song với `dotnet watch`; CSS dựng ra nằm trong `wwwroot` và vào bản sao như mọi file khác. Tailwind CLI v4 ở chế độ `--watch` tự thoát khi stdin đóng: runner giữ stdin mở.

## 6. Studio

- Không đổi cấu trúc. Thêm chữ: lý do không mở được (`noRazorViews`), không có .NET SDK (E025 `dotnetNotFound`), các lý do E023 của Razor.
- Tải lại Canvas khi nhận `runner.pageChanged` (mục 3.3), cùng chỗ với Express + Pug.
- Trang nháp, kiểm build: chưa có cho Razor, Studio ghi rõ (như Next).

## 7. Kiểm thử (cần và đủ)

| Loại     | Kiểm gì                                                                                                                       |
| -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Unit     | Bộ sửa Razor: từ bản đồ vị trí ghi sẵn (file JSON) ra đúng TextChange cho class (có / không có C#), chữ, chèn, xóa, di chuyển |
| Unit     | Trang Razor Pages và MVC: đọc, thêm, đổi tên, xóa (cả hai file), Undo                                                         |
| Unit     | `render-razor`: thêm vào bộ 305 mẫu của Đợt 3 (`@` thoát đúng)                                                                |
| Tích hợp | Chương trình phụ trên 2 mẫu: nhãn đúng `file:dòng:cột`, bản đồ khớp file (cần `dotnet`)                                       |
| E2E      | Mẫu Razor Pages và MVC (.NET 10): mở, chọn đúng phần tử (kể cả layout), sửa class, Undo đúng từng byte, chèn khối, thêm trang |
| Đo       | Thời gian sửa → Canvas đổi (bước 0b), ghi vào spec-log                                                                        |

Máy chạy test cần .NET SDK. Máy không có SDK: test Razor tự bỏ qua và ghi rõ lý do, không báo qua giả.

## 8. Câu hỏi đã chốt

1. **Tailwind trong dự án ASP.NET:** phương án (a), KumiCraft chạy script dựng CSS của dự án (mục 5).
2. **Blazor (`.razor`)** không thuộc đợt này: loại file và cách chạy khác hẳn.

## 9. Kết quả Đợt 4 (2026-11-23, spec-log #166)

**Bước 0 đạt cả ba:** 0a trình biên dịch Razor trong SDK 10.0.302 tách đúng C# và HTML trên cả cú pháp khó; 0b số đo ở mục 3.3; 0c Bridge vào trang qua proxy.

**Khác bản phân tích (làm thật mới biết):**

- Chương trình phụ trả **các đoạn C#**, không trả "bản đồ vị trí" từng thẻ: cây cú pháp Razor không công khai (mục 2.3). Đọc thẻ HTML làm ở `lib/razor/markup.ts`.
- `dotnet watch` không tự tải lại Canvas qua proxy và không in gì khi nạp xong một view: runner hỏi lại trang đến khi HTML đổi (mục 3.3). E2E kiểm bằng nhân bản một thẻ: thẻ mới chỉ có nhãn dòng mới khi trang thật đã dựng lại.
- Proxy Bridge gửi trang có `Content-Length` mà vẫn giữ `Transfer-Encoding: chunked` của ASP.NET (hai header mâu thuẫn): đã bỏ header cũ. Express và Next không trả kiểu chia khúc nên trước đây không lộ.
- Bộ theo dõi file của runner nhận cả sự kiện của thư mục: chép thư mục như chép file làm runner sập (đã sửa, và một file chép lỗi không còn làm sập runner).
- Đọc file phải giữ BOM (`keepBom`): mẫu .NET ghi `.cshtml` có BOM.
- Khởi động lần đầu (build chương trình phụ và dự án) có thể quá 1 phút: runtime khai thời gian chờ riêng (`startupTimeoutMs`, 5 phút cho `dotnet`).

**Dự án mẫu:** `fixtures/projects/razor-pages-net10` (Razor Pages, Tailwind 4 qua CLI, có `@foreach`) và `fixtures/projects/mvc-net10` (MVC, Bootstrap), tạo từ `dotnet new webapp` / `mvc` (.NET 10).

**Kiểm thử:** unit cho bộ đọc HTML và gắn nhãn, bộ sửa (class có C#, chữ có `@`, thuộc tính, đổi thẻ, chèn khối, bọc theo hệ style, xóa, chặn di chuyển qua `@foreach`, giữ BOM), trang Razor Pages và MVC, nhận diện 2 mẫu; `render-razor` trong bộ 305 khối. E2E (`e2e/razor.e2e.ts`): mở 2 mẫu, chọn đúng phần tử của trang và của layout, sửa class Tailwind (CSS dựng lại, Canvas đổi màu), sửa chữ, nhân bản (Canvas tải lại trang thật), Undo đúng từng byte.

**Chưa làm:** trang nháp, kiểm build; chữ nhiều đoạn, bọc chữ, thay SVG (E023 `notForRazor`); các công cụ chỉ có ở JSX (hiệu ứng tương tác, hiện dần) báo "chỉ xem"; danh sách trang chưa ghi riêng route tự đặt (`[Route]`); E2E chưa có chèn khối từ thư viện và thêm trang (unit test có).
