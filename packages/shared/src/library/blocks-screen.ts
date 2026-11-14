import { NEUTRAL_SCREEN_BLOCKS } from './blocks-neutral-screen.ts';
import type { LibraryBlock } from './types.ts';

export const SCREEN_LIBRARY_BLOCKS: readonly LibraryBlock[] = [
  {
    id: 'screen.login',
    category: 'screen',
    labelKey: 'library:blocks.screenLogin',
    keywords: {
      vi: ['đăng nhập', 'dang nhap', 'tài khoản', 'login', 'man hinh'],
      en: ['login', 'sign in', 'auth', 'screen'],
    },
    icon: 'LogIn',
    jsx: {
      vi: `<main className="min-h-96 flex items-center justify-center p-6 bg-{surface-muted}">\n  <section className="w-full max-w-md p-7 bg-{surface} border border-{border} rounded-{radius} {shadow} {effect}">\n    <h1 className="text-2xl font-bold font-{heading} text-{text} mb-1">Đăng nhập</h1>\n    <p className="text-sm text-{muted} mb-5">Nhập thông tin tài khoản để tiếp tục làm việc.</p>\n    <form className="flex flex-col gap-4">\n      <div className="flex flex-col gap-1">\n        <label htmlFor="kc-login-email" className="text-xs font-medium text-{text}">Email</label>\n        <input id="kc-login-email" type="email" placeholder="ban@congty.vn" className="px-3 py-2 bg-{surface} text-{text} border border-{border} rounded-{radius}" />\n      </div>\n      <div className="flex flex-col gap-1">\n        <label htmlFor="kc-login-pass" className="text-xs font-medium text-{text}">Mật khẩu</label>\n        <input id="kc-login-pass" type="password" placeholder="••••••••" className="px-3 py-2 bg-{surface} text-{text} border border-{border} rounded-{radius}" />\n      </div>\n      <button type="submit" className="w-full py-2.5 bg-{primary} text-{on-primary} rounded-{radius} font-semibold">Đăng nhập</button>\n    </form>\n  </section>\n</main>`,
      en: `<main className="min-h-96 flex items-center justify-center p-6 bg-{surface-muted}">\n  <section className="w-full max-w-md p-7 bg-{surface} border border-{border} rounded-{radius} {shadow} {effect}">\n    <h1 className="text-2xl font-bold font-{heading} text-{text} mb-1">Sign in</h1>\n    <p className="text-sm text-{muted} mb-5">Enter your credentials to access your workspace.</p>\n    <form className="flex flex-col gap-4">\n      <div className="flex flex-col gap-1">\n        <label htmlFor="kc-login-email" className="text-xs font-medium text-{text}">Email</label>\n        <input id="kc-login-email" type="email" placeholder="you@company.com" className="px-3 py-2 bg-{surface} text-{text} border border-{border} rounded-{radius}" />\n      </div>\n      <div className="flex flex-col gap-1">\n        <label htmlFor="kc-login-pass" className="text-xs font-medium text-{text}">Password</label>\n        <input id="kc-login-pass" type="password" placeholder="••••••••" className="px-3 py-2 bg-{surface} text-{text} border border-{border} rounded-{radius}" />\n      </div>\n      <button type="submit" className="w-full py-2.5 bg-{primary} text-{on-primary} rounded-{radius} font-semibold">Sign in</button>\n    </form>\n  </section>\n</main>`,
    },
    neutral: NEUTRAL_SCREEN_BLOCKS['screen.login'],
  },
  {
    id: 'screen.dashboard',
    category: 'screen',
    labelKey: 'library:blocks.screenDashboard',
    keywords: {
      vi: ['bảng điều khiển', 'bang dieu khien', 'tổng quan', 'dashboard', 'admin'],
      en: ['dashboard', 'overview', 'admin', 'analytics'],
    },
    icon: 'LayoutDashboard',
    jsx: {
      vi: `<main className="p-6 bg-{surface-muted} flex flex-col gap-5">\n  <header className="flex flex-wrap items-center justify-between gap-3">\n    <h1 className="text-xl font-bold font-{heading} text-{text}">Tổng quan hệ thống</h1>\n    <button type="button" className="px-4 py-2 bg-{primary} text-{on-primary} rounded-{radius} text-sm font-semibold">Tạo báo cáo</button>\n  </header>\n  <section className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-4">\n    <div className="p-4 bg-{surface} border border-{border} rounded-{radius}"><p className="text-xs text-{muted}">Người dùng</p><p className="text-2xl font-bold text-{text}">2.480</p></div>\n    <div className="p-4 bg-{surface} border border-{border} rounded-{radius}"><p className="text-xs text-{muted}">Đơn mới</p><p className="text-2xl font-bold text-{text}">146</p></div>\n    <div className="p-4 bg-{surface} border border-{border} rounded-{radius}"><p className="text-xs text-{muted}">Tỉ lệ giữ chân</p><p className="text-2xl font-bold text-{text}">94%</p></div>\n  </section>\n  <section className="p-5 bg-{surface} border border-{border} rounded-{radius}">\n    <h2 className="text-base font-semibold text-{text} mb-1">Hoạt động gần đây</h2>\n    <p className="text-sm text-{muted}">Hệ thống vận hành bình thường, chưa phát sinh cảnh báo mới.</p>\n  </section>\n</main>`,
      en: `<main className="p-6 bg-{surface-muted} flex flex-col gap-5">\n  <header className="flex flex-wrap items-center justify-between gap-3">\n    <h1 className="text-xl font-bold font-{heading} text-{text}">Workspace overview</h1>\n    <button type="button" className="px-4 py-2 bg-{primary} text-{on-primary} rounded-{radius} text-sm font-semibold">New report</button>\n  </header>\n  <section className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-4">\n    <div className="p-4 bg-{surface} border border-{border} rounded-{radius}"><p className="text-xs text-{muted}">Active users</p><p className="text-2xl font-bold text-{text}">2,480</p></div>\n    <div className="p-4 bg-{surface} border border-{border} rounded-{radius}"><p className="text-xs text-{muted}">New orders</p><p className="text-2xl font-bold text-{text}">146</p></div>\n    <div className="p-4 bg-{surface} border border-{border} rounded-{radius}"><p className="text-xs text-{muted}">Retention</p><p className="text-2xl font-bold text-{text}">94%</p></div>\n  </section>\n  <section className="p-5 bg-{surface} border border-{border} rounded-{radius}">\n    <h2 className="text-base font-semibold text-{text} mb-1">Recent activity</h2>\n    <p className="text-sm text-{muted}">All services are operating normally with zero open alerts.</p>\n  </section>\n</main>`,
    },
    neutral: NEUTRAL_SCREEN_BLOCKS['screen.dashboard'],
  },
  {
    id: 'screen.settings',
    category: 'screen',
    labelKey: 'library:blocks.screenSettings',
    keywords: {
      vi: ['cài đặt', 'cai dat', 'thiết lập', 'hồ sơ', 'settings'],
      en: ['settings', 'preferences', 'account', 'profile'],
    },
    icon: 'Settings',
    jsx: {
      vi: `<main className="p-6">\n  <section className="max-w-xl mx-auto p-6 bg-{surface} border border-{border} rounded-{radius} flex flex-col gap-4">\n    <h1 className="text-xl font-bold font-{heading} text-{text}">Cài đặt tài khoản</h1>\n    <div className="flex flex-col gap-1.5">\n      <label htmlFor="kc-set-name" className="text-xs font-medium text-{text}">Tên hiển thị</label>\n      <input id="kc-set-name" type="text" defaultValue="Khánh An" className="px-3 py-2 bg-{surface} text-{text} border border-{border} rounded-{radius}" />\n    </div>\n    <div className="flex flex-col gap-1.5">\n      <label htmlFor="kc-set-bio" className="text-xs font-medium text-{text}">Giới thiệu ngắn</label>\n      <textarea id="kc-set-bio" defaultValue="Thiết kế sản phẩm tại KumiCraft." className="min-h-20 px-3 py-2 bg-{surface} text-{text} border border-{border} rounded-{radius}" />\n    </div>\n    <button type="button" className="self-start px-4 py-2 bg-{primary} text-{on-primary} rounded-{radius} text-sm font-semibold">Lưu thay đổi</button>\n  </section>\n</main>`,
      en: `<main className="p-6">\n  <section className="max-w-xl mx-auto p-6 bg-{surface} border border-{border} rounded-{radius} flex flex-col gap-4">\n    <h1 className="text-xl font-bold font-{heading} text-{text}">Account settings</h1>\n    <div className="flex flex-col gap-1.5">\n      <label htmlFor="kc-set-name" className="text-xs font-medium text-{text}">Display name</label>\n      <input id="kc-set-name" type="text" defaultValue="Alex Kim" className="px-3 py-2 bg-{surface} text-{text} border border-{border} rounded-{radius}" />\n    </div>\n    <div className="flex flex-col gap-1.5">\n      <label htmlFor="kc-set-bio" className="text-xs font-medium text-{text}">Short bio</label>\n      <textarea id="kc-set-bio" defaultValue="Product designer at KumiCraft." className="min-h-20 px-3 py-2 bg-{surface} text-{text} border border-{border} rounded-{radius}" />\n    </div>\n    <button type="button" className="self-start px-4 py-2 bg-{primary} text-{on-primary} rounded-{radius} text-sm font-semibold">Save changes</button>\n  </section>\n</main>`,
    },
    neutral: NEUTRAL_SCREEN_BLOCKS['screen.settings'],
  },
  {
    id: 'screen.list-detail',
    category: 'screen',
    labelKey: 'library:blocks.screenListDetail',
    keywords: {
      vi: ['danh sách chi tiết', 'hai cột', 'inbox', 'list detail'],
      en: ['list detail', 'master detail', 'split view', 'inbox'],
    },
    icon: 'Columns',
    jsx: {
      vi: `<main className="p-6 flex flex-wrap gap-5">\n  <aside className="flex-1 basis-60 flex flex-col gap-2">\n    <div className="p-3 bg-{primary} text-{on-primary} rounded-{radius} text-sm font-semibold">Yêu cầu #1024 — Cập nhật trang chủ</div>\n    <div className="p-3 bg-{surface} text-{text} border border-{border} rounded-{radius} text-sm">Yêu cầu #1025 — Tối ưu bảng giá</div>\n    <div className="p-3 bg-{surface} text-{text} border border-{border} rounded-{radius} text-sm">Yêu cầu #1026 — Đồng bộ bộ màu</div>\n  </aside>\n  <section className="flex-[2] basis-80 p-6 bg-{surface} border border-{border} rounded-{radius}">\n    <h1 className="text-xl font-bold font-{heading} text-{text} mb-2">Yêu cầu #1024 — Cập nhật trang chủ</h1>\n    <p className="text-sm text-{muted}">Chi tiết nội dung công việc đang chọn sẽ hiển thị ở khung bên phải để dễ đối chiếu.</p>\n  </section>\n</main>`,
      en: `<main className="p-6 flex flex-wrap gap-5">\n  <aside className="flex-1 basis-60 flex flex-col gap-2">\n    <div className="p-3 bg-{primary} text-{on-primary} rounded-{radius} text-sm font-semibold">Task #1024 — Refresh homepage</div>\n    <div className="p-3 bg-{surface} text-{text} border border-{border} rounded-{radius} text-sm">Task #1025 — Refine pricing tiers</div>\n    <div className="p-3 bg-{surface} text-{text} border border-{border} rounded-{radius} text-sm">Task #1026 — Sync brand tokens</div>\n  </aside>\n  <section className="flex-[2] basis-80 p-6 bg-{surface} border border-{border} rounded-{radius}">\n    <h1 className="text-xl font-bold font-{heading} text-{text} mb-2">Task #1024 — Refresh homepage</h1>\n    <p className="text-sm text-{muted}">Detailed information for the active item appears here for quick review.</p>\n  </section>\n</main>`,
    },
    neutral: NEUTRAL_SCREEN_BLOCKS['screen.list-detail'],
  },
  {
    id: 'screen.not-found',
    category: 'screen',
    labelKey: 'library:blocks.screenNotFound',
    keywords: {
      vi: ['404', 'không tìm thấy', 'lỗi trang', 'not found'],
      en: ['404', 'not found', 'error page', 'empty'],
    },
    icon: 'AlertTriangle',
    jsx: {
      vi: `<main className="min-h-80 flex flex-col items-center justify-center text-center p-10">\n  <p className="text-5xl font-extrabold text-{primary} mb-2">404</p>\n  <h1 className="text-2xl font-bold font-{heading} text-{text} mb-2">Không tìm thấy trang</h1>\n  <p className="text-sm text-{muted} mb-5">Liên kết bạn truy cập có thể đã đổi hoặc không còn tồn tại.</p>\n  <a href="#" className="px-5 py-2.5 bg-{primary} text-{on-primary} rounded-{radius} text-sm font-semibold">Quay về trang chủ</a>\n</main>`,
      en: `<main className="min-h-80 flex flex-col items-center justify-center text-center p-10">\n  <p className="text-5xl font-extrabold text-{primary} mb-2">404</p>\n  <h1 className="text-2xl font-bold font-{heading} text-{text} mb-2">Page not found</h1>\n  <p className="text-sm text-{muted} mb-5">The link you followed may have moved or no longer exists.</p>\n  <a href="#" className="px-5 py-2.5 bg-{primary} text-{on-primary} rounded-{radius} text-sm font-semibold">Back to home</a>\n</main>`,
    },
    neutral: NEUTRAL_SCREEN_BLOCKS['screen.not-found'],
  },
  {
    id: 'screen.landing-a',
    category: 'screen',
    labelKey: 'library:blocks.screenLandingA',
    keywords: {
      vi: ['trang chủ mẫu 1', 'landing', 'trang dich'],
      en: ['landing page', 'home screen', 'saas', 'template'],
    },
    icon: 'Monitor',
    jsx: {
      vi: `<main className="bg-{surface}">\n  <header className="flex items-center justify-between px-6 py-4 border-b border-{border}">\n    <span className="font-bold text-{text}">KumiCraft</span>\n    <button type="button" className="px-3.5 py-1.5 bg-{primary} text-{on-primary} rounded-{radius} text-xs font-semibold">Bắt đầu</button>\n  </header>\n  <section className="py-12 px-4 text-center bg-{surface-muted}">\n    <h1 className="text-3xl font-extrabold font-{heading} text-{text} mb-3">Xây dựng sản phẩm số nhanh và gọn</h1>\n    <p className="text-sm text-{muted} mb-5">Thiết kế trực quan, đồng bộ token và giữ mã nguồn sạch đẹp.</p>\n    <button type="button" className="px-5 py-2.5 bg-{primary} text-{on-primary} rounded-{radius} text-sm font-semibold">Dùng thử miễn phí</button>\n  </section>\n  <section className="max-w-4xl mx-auto py-8 px-4 grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-4">\n    <div className="p-5 border border-{border} rounded-{radius}"><h3 className="font-semibold text-{text} mb-1">Nhanh chóng</h3><p className="text-sm text-{muted}">Kéo thả các khối dựng sẵn chuẩn responsive.</p></div>\n    <div className="p-5 border border-{border} rounded-{radius}"><h3 className="font-semibold text-{text} mb-1">Linh hoạt</h3><p className="text-sm text-{muted}">Tùy chỉnh trực tiếp trên Canvas.</p></div>\n  </section>\n</main>`,
      en: `<main className="bg-{surface}">\n  <header className="flex items-center justify-between px-6 py-4 border-b border-{border}">\n    <span className="font-bold text-{text}">KumiCraft</span>\n    <button type="button" className="px-3.5 py-1.5 bg-{primary} text-{on-primary} rounded-{radius} text-xs font-semibold">Start</button>\n  </header>\n  <section className="py-12 px-4 text-center bg-{surface-muted}">\n    <h1 className="text-3xl font-extrabold font-{heading} text-{text} mb-3">Ship clean digital products faster</h1>\n    <p className="text-sm text-{muted} mb-5">Visual assembly backed by clean React code and project tokens.</p>\n    <button type="button" className="px-5 py-2.5 bg-{primary} text-{on-primary} rounded-{radius} text-sm font-semibold">Start free trial</button>\n  </section>\n  <section className="max-w-4xl mx-auto py-8 px-4 grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-4">\n    <div className="p-5 border border-{border} rounded-{radius}"><h3 className="font-semibold text-{text} mb-1">Fast</h3><p className="text-sm text-{muted}">Drop responsive sections in seconds.</p></div>\n    <div className="p-5 border border-{border} rounded-{radius}"><h3 className="font-semibold text-{text} mb-1">Flexible</h3><p className="text-sm text-{muted}">Edit copy and layout directly on canvas.</p></div>\n  </section>\n</main>`,
    },
    neutral: NEUTRAL_SCREEN_BLOCKS['screen.landing-a'],
  },
  {
    id: 'screen.landing-b',
    category: 'screen',
    labelKey: 'library:blocks.screenLandingB',
    keywords: {
      vi: ['trang chủ mẫu 2', 'landing pricing', 'san pham'],
      en: ['landing pricing', 'product screen', 'saas', 'showcase'],
    },
    icon: 'Monitor',
    jsx: {
      vi: `<main className="bg-{surface}">\n  <section className="py-12 px-4 text-center">\n    <h1 className="text-3xl font-extrabold font-{heading} text-{text} mb-3">Giải pháp giao diện cho đội ngũ hiện đại</h1>\n    <p className="text-sm text-{muted}">Tích hợp sẵn bảng màu, font chữ và các khối tương tác không cần cài thêm gói.</p>\n  </section>\n  <section className="max-w-3xl mx-auto px-4 pb-12 grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-5">\n    <div className="p-6 border border-{border} rounded-{radius}"><p className="text-xs font-semibold text-{muted} mb-1">Cơ bản</p><p className="text-2xl font-bold text-{text} mb-4">Miễn phí</p><button type="button" className="w-full py-2 border border-{border} rounded-{radius} text-sm font-semibold text-{text}">Chọn</button></div>\n    <div className="p-6 border-2 border-{primary} bg-{surface-muted} rounded-{radius}"><p className="text-xs font-semibold text-{primary} mb-1">Chuyên nghiệp</p><p className="text-2xl font-bold text-{text} mb-4">499k</p><button type="button" className="w-full py-2 bg-{primary} text-{on-primary} rounded-{radius} text-sm font-semibold">Nâng cấp</button></div>\n  </section>\n</main>`,
      en: `<main className="bg-{surface}">\n  <section className="py-12 px-4 text-center">\n    <h1 className="text-3xl font-extrabold font-{heading} text-{text} mb-3">Interface toolkit for modern product teams</h1>\n    <p className="text-sm text-{muted}">Built-in color tokens, typography scale and interactive kits with zero extra packages.</p>\n  </section>\n  <section className="max-w-3xl mx-auto px-4 pb-12 grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-5">\n    <div className="p-6 border border-{border} rounded-{radius}"><p className="text-xs font-semibold text-{muted} mb-1">Starter</p><p className="text-2xl font-bold text-{text} mb-4">Free</p><button type="button" className="w-full py-2 border border-{border} rounded-{radius} text-sm font-semibold text-{text}">Select</button></div>\n    <div className="p-6 border-2 border-{primary} bg-{surface-muted} rounded-{radius}"><p className="text-xs font-semibold text-{primary} mb-1">Pro</p><p className="text-2xl font-bold text-{text} mb-4">$49</p><button type="button" className="w-full py-2 bg-{primary} text-{on-primary} rounded-{radius} text-sm font-semibold">Upgrade</button></div>\n  </section>\n</main>`,
    },
    neutral: NEUTRAL_SCREEN_BLOCKS['screen.landing-b'],
  },
];
