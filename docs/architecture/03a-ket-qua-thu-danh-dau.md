# Kết quả 3 bản thử đánh dấu vị trí (spike)

Ngày 2026-11-22. Code thử nằm ở thư mục `spikes/` trên máy của chủ dự án, không commit vì là code nháp (git bỏ qua qua `.git/info/exclude`). Mục đích: trả lời "đánh dấu `data-rc-loc` cho Vue, Next.js, Razor có làm được không, bằng cách nào" trước khi chốt kiến trúc đích ([03-kien-truc-dich.md](03-kien-truc-dich.md)).

Mọi kết quả dưới đây đều chạy thật trên máy (Windows, Node 22.19, .NET SDK 10.0.302); file cấu hình và file nguồn của "dự án người dùng" không bị sửa.

## 1. Vue 3.5 + Vite 8: làm được, dễ

- **Cách làm:** thêm một `nodeTransform` vào trình biên dịch template của Vue (`spikes/vue/stamp.js`). KumiCraft không sửa `vite.config.js` của người dùng: plugin của KumiCraft tìm plugin `vite:vue` có sẵn và thêm transform qua `api.options` (`spikes/vue/kumicraft-plugin.js`).
- **Kết quả:** thẻ HTML có `data-rc-loc`, component có `data-rc-use="file:dòng:cột|Tên"` giống hệt JSX. Đúng ở cả render server (SSR) lẫn bản build cho trình duyệt. Thẻ trong `v-for` mang cùng một dấu; thẻ trong slot mang vị trí ở file cha (`App.vue:9:7`).
- **Cột** tính từ 1, khớp quy ước của `transform-jsx`.
- **Rủi ro:** thấp. Dựa trên API công khai (`compilerOptions.nodeTransforms`, `api.options` của plugin-vue).

## 2. Next.js 16.4 (Turbopack): làm được, nhưng dựa vào phần nội bộ của Next

- **Cách làm:** loader kiểu webpack (`spikes/next/kumicraft-loader.cjs`, cùng ý tưởng `transform-jsx`) khai báo trong `turbopack.rules`. Turbopack chạy loader này cho cả Server Component và Client Component.
- **Không sửa `next.config` của người dùng:** KumiCraft chạy Next trong tiến trình của nó (custom server) và bọc module cấu hình của Next khi Node nạp (`spikes/next/run.mjs`), để thêm rule vào cấu hình đọc từ file của người dùng. Cấu hình riêng của người dùng vẫn được áp dụng (đã kiểm `poweredByHeader: false`).
- **Phát hiện:** trong Next 16, tham số `conf` của custom server **không** tới được dev server thật (`getRequestHandlers` đọc lại `next.config` từ ổ đĩa); đọc trong `node_modules/next/dist/server/next.js`. Vì vậy phải bọc module.
- **Kết quả:** `app/layout.tsx`, `app/page.tsx`, `components/Counter.tsx` (client) đều có dấu đúng dòng / cột.
- **Rủi ro:** vừa. Đường dẫn `next/dist/server/config.js` và cách bọc là **nội bộ** của Next, có thể đổi giữa các bản lớn. Cần: kiểm phiên bản Next lúc mở dự án, test riêng cho mỗi bản Next lớn được hỗ trợ, và báo lỗi rõ nếu không bọc được. Chế độ `next dev --webpack` cần làm riêng (chưa thử).
- **Lưu ý nhỏ:** Next tự tạo `tsconfig.json` và `next-env.d.ts` trong dự án khi chạy lần đầu (hành vi của Next, không phải của KumiCraft).

## 3. ASP.NET Core Razor Pages (.NET 10): làm được bằng "bản sao có đánh dấu"

- **Không có chỗ cắm kiểu plugin:** `.cshtml` do .NET biên dịch; không có hook JavaScript nào.
- **Cách làm:** chương trình nhỏ (`spikes/razor/stamper/`) chép dự án ra thư mục bản sao, dùng **chính trình biên dịch Razor** (tầng trung gian công khai, `GetDocumentIntermediateNode`) để biết đoạn nào là HTML, đoạn nào là C#, rồi thêm `data-rc-loc` vào thẻ HTML của bản sao. Sau đó chạy bản sao bằng `dotnet run`. File gốc không bị ghi.
- **Kết quả:** 37 thẻ của trang đều có dấu đúng, kể cả layout (`_Layout.cshtml`), thẻ trong `@foreach` / `@if`, thuộc tính có biểu thức C# (`class="item @(...)"` ra `item on`), tag helper (`asp-page` vẫn thành `href`).
- **Rủi ro:**
  - Gói `Microsoft.AspNetCore.Razor.Language` trên NuGet dừng ở bản 6.0 (cú pháp Razor cũ). Bản mới nằm trong SDK người dùng đã cài (`Sdks/Microsoft.NET.Sdk.Razor/tools/Microsoft.CodeAnalysis.Razor.Compiler.dll`); nên dùng bản đó để khớp với dự án. Chưa thử.
  - Chưa đo độ trễ khi sửa: mỗi lần sửa phải đánh dấu lại file và để `dotnet watch` của bản sao nạp lại.
  - Blazor (`.razor`) là loại file khác, chưa thử.
- **Ý nghĩa rộng hơn:** cách "bản sao có đánh dấu" dùng được cho mọi template phía server (Blade, Django, Jinja, Thymeleaf), chỉ cần một bộ phân tích biết đâu là HTML.

## 4. Hệ quả cho kiến trúc đích

1. `SourceLoc` / `data-rc-loc` đứng vững làm chỗ nối chung: cả 3 công nghệ cho ra **cùng định dạng** dấu.
2. Cách cắm bộ đánh dấu có **3 kiểu**, không phải 2 như bản nháp ghi:
   - `buildPlugin`: Vite, Turbopack / webpack (Vue, JSX, Next).
   - `templateHook`: trình biên dịch template cho phép cắm (Pug).
   - `shadowCopy`: không cắm được, phải đánh dấu trên bản sao rồi chạy bản sao (Razor; có thể cả Blade, Django).
3. Với `shadowCopy`, runtime phải biết đồng bộ bản sao khi người dùng hoặc KumiCraft sửa file gốc. Đây là việc của `RuntimeAdapter`, cần thêm vào interface.
4. Hỗ trợ Next phải có **kiểm phiên bản + test theo từng bản lớn**, vì dựa vào phần nội bộ của Next.
