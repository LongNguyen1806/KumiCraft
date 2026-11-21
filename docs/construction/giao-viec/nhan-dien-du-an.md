# Danh sách loại dự án KumiCraft sẽ nhận diện

Chốt ngày 2026-11-21 với chủ dự án (spec-log #160). Đây là danh sách và thứ tự, chưa có code nào được viết theo tài liệu này.

## Vì sao phải làm lại phần nhận diện

- Hiện nay mỗi loại dự án là một adapter gói cả ba việc: nhận diện, chạy trang lên Canvas, và sửa code (`server/src/core/project/frameworks/`). Có 2 adapter: `vite-react` và `express-pug`.
- Cách gói theo cặp này không mở rộng được: mỗi tổ hợp công cụ chạy × ngôn ngữ giao diện là một adapter riêng, và code bị lặp lại.
- ADR-BE-36 (`docs/spec.md`) đã định tách adapter thành các phần ghép được, nhưng chưa làm. Vì vậy **Đợt 0** dưới đây là bắt buộc, trước mọi loại dự án mới.

Một dự án được nhận diện theo 3 trục độc lập, rồi ghép lại:

- **Công cụ chạy**: ai chạy trang lên. Dùng để chạy Canvas, gắn Bridge và đánh dấu vị trí phần tử.
- **Ngôn ngữ giao diện**: code giao diện viết bằng gì. Dùng để đọc và sửa file.
- **Hệ style**: đã tách riêng từ trước, giữ nguyên.

Có runner cho công cụ chạy **và** có bộ sửa cho ngôn ngữ giao diện thì **Chỉnh** được. Chỉ có runner thì **Xem**. Không có runner thì **Báo** chưa hỗ trợ, kèm lý do đúng.

## Ký hiệu

- **Trạng thái:**
  - **Đã có**: chạy được trong bản 1.0.9.
  - **Đợt 1** đến **Đợt 5**: thứ tự làm, xem mục 8.
  - **Sau này**: chưa xếp đợt.
  - **Báo**: chỉ nhận ra và báo "chưa hỗ trợ".
- **Mức hỗ trợ:**
  - **Chỉnh**: sửa được trong Inspector.
  - **Xem**: hiện trên Canvas, không sửa.

## 1. Meta-framework (kiểm đầu tiên)

- **Next.js**: gói `next`. Đợt 2, Chỉnh.
- **Remix / React Router 7**: gói `@remix-run/*` hoặc `@react-router/dev`. Đợt 2, Chỉnh.
- **Nuxt**: gói `nuxt`. Sau này.
- **SvelteKit**: gói `@sveltejs/kit`. Sau này.
- **Astro**: gói `astro`. Sau này.

## 2. Framework phía server (chạy qua proxy)

- **Express + Pug**: gói `express`, `pug`. Đã có, Xem.
- **Express + EJS / Handlebars**: gói `ejs`, `hbs`. Sau này, Xem.
- **ASP.NET Core + Razor**: `*.csproj`, file `.cshtml`. Đợt 3, Xem.
- **Django**: `manage.py`, thư mục `templates/`. Đợt 3, Xem.
- **Laravel + Blade**: `composer.json` có `laravel/framework`, file `.blade.php`. Đợt 3, Xem.
- **Spring Boot + Thymeleaf**: `pom.xml` hoặc `build.gradle`. Sau này.
- **Ruby on Rails + ERB**: `Gemfile` có `rails`. Sau này.
- **Flask / FastAPI + Jinja2**: `requirements.txt` hoặc `pyproject.toml`. Sau này.

## 3. Công cụ build giao diện

- **Vite 7, 8**: gói `vite`, `vite.config.*`. Đã có.
- **Vite 5, 6**: như trên. Đợt 1.
- **Webpack**: gói `webpack`, `webpack.config.*`. Đợt 5.
- **Create React App**: gói `react-scripts`. Đợt 5.
- **Vue CLI**: gói `@vue/cli-service`. Đợt 5 (cùng họ webpack).
- **Angular CLI**: `angular.json`. Đợt 4 (đi cùng Angular).
- **Rspack / Rsbuild**: gói `@rspack/core`, `@rsbuild/core`. Sau này.
- **Không có công cụ build** (chỉ có HTML và JS): Đợt 5.
- **Parcel, Gulp, Grunt, Laravel Mix**: Báo.

## 4. Framework giao diện

- **React 18, 19**: gói `react`, file `.jsx` / `.tsx`. Đã có, Chỉnh.
- **React 17 trở xuống**: Đợt 1, cần xem xét thêm.
- **Vue 3**: gói `vue`, file `.vue`. Đợt 4, Xem trước, Chỉnh sau.
- **Angular**: gói `@angular/core`. Đợt 4, Xem trước, Chỉnh sau.
- **Svelte 5**: gói `svelte`, file `.svelte`. Đợt 5, Xem.
- **HTML thuần** (có thể kèm Alpine.js / HTMX): Đợt 5, Chỉnh.
- **Solid, Preact**: Sau này (cú pháp JSX, dùng lại được một phần bộ sửa).

## 5. Hệ style (đã có, giữ nguyên)

- **Chỉnh được:** Tailwind 3, 4; CSS; CSS Modules; Sass; Less; Bootstrap.
- **Nhận ra, chưa chỉnh riêng:** styled-components, Emotion, MUI, Ant Design, Chakra UI.

## 6. Không cần nhận diện riêng

- **esbuild, Rollup, Rolldown, SWC, Babel**: nằm bên trong các công cụ build ở mục 3.
- **npm, pnpm, Yarn, Bun**: đã nhận diện ở phần package manager.

## 7. Quy tắc khi một dự án có nhiều dấu hiệu

- Meta-framework thắng framework thường. Ví dụ: Next.js không bị coi là "React + webpack".
- Framework phía server thắng công cụ build. Ví dụ: Laravel dùng Vite vẫn là Laravel.
- Có cả `vite` lẫn `webpack`: xem lệnh `dev` trong `package.json` để biết thật sự chạy bằng gì.
- Monorepo: nhận diện từng app riêng (đã có).

## 8. Thứ tự làm

- **Đợt 0**: tách kiến trúc theo trục (ADR-BE-36). Người dùng không thấy thay đổi; hai adapter hiện có phải chạy y như cũ.
- **Đợt 1**: Vite 5, 6 (+ xem xét React cũ).
- **Đợt 2**: Next.js, Remix / React Router 7.
- **Đợt 3**: Razor, Django, Blade (Xem).
- **Đợt 4**: Vue, Angular (Xem).
- **Đợt 5**: họ webpack, Svelte, HTML thuần.

Mỗi đợt có kế hoạch riêng và ước tính thời gian trước khi làm.

## 9. Căn cứ số liệu (Stack Overflow Developer Survey 2026)

- Framework web ([bảng](https://survey.stackoverflow.co/2026/technology/data/web-framework)): React 41,5%, Next.js 20,6%, ASP.NET Core 19,9%, Vue 17,2%, Angular 16,0%, Django 11,3%, Laravel 7,6%.
- Công cụ build ([bảng](https://survey.stackoverflow.co/2026/technology/data/cloud-plat)): Vite 28,1%, Webpack 14,7%. Bảng này không có công cụ build giao diện nào khác.
- Công cụ build phía backend (cùng bảng): Maven 15,3%, Gradle 14,8%, MSBuild 11,8%, Composer 9,2%.
- Các mục ghi "Sau này" phần lớn chưa có số liệu; cần tra trước khi xếp đợt.
