import type { NeutralBlock } from './types.ts';

export const NEUTRAL_INTERACTIVE_BLOCKS = {
  'interactive.tabs': {
    jsx: {
      vi: `<Tabs className="@root">\n  <Tab label="Tổng quan">\n    <p className="@body">Nội dung tổng quan của thẻ thứ nhất.</p>\n  </Tab>\n  <Tab label="Chi tiết">\n    <p className="@body">Thông tin kỹ thuật ở thẻ thứ hai.</p>\n  </Tab>\n  <Tab label="Hỏi đáp">\n    <p className="@body">Giải đáp nhanh ở thẻ thứ ba.</p>\n  </Tab>\n</Tabs>`,
      en: `<Tabs className="@root">\n  <Tab label="Overview">\n    <p className="@body">Overview summary inside the first tab panel.</p>\n  </Tab>\n  <Tab label="Details">\n    <p className="@body">Technical specifications inside the second panel.</p>\n  </Tab>\n  <Tab label="FAQ">\n    <p className="@body">Common questions answered in the third panel.</p>\n  </Tab>\n</Tabs>`,
    },
    styles: {
      root: {
        padding: '16px',
        'background-color': '{surface}',
        border: '1px solid {border}',
        'border-radius': '{radius}',
      },
      body: { 'font-size': '14px', color: '{text}', margin: '0' },
    },
    bootstrap: { root: 'p-3 bg-white border rounded', body: 'small mb-0' },
  },
  'interactive.accordion': {
    jsx: {
      vi: `<div className="@root">\n  <details className="@item" open>\n    <summary className="@summary">Tính năng hoạt động như thế nào?</summary>\n    <p className="@body">Mọi khối dùng thẻ HTML chuẩn nên đóng mở mượt mà không cần cài thêm thư viện.</p>\n  </details>\n  <details className="@item">\n    <summary className="@summary">Tôi có thể đổi nội dung trực tiếp?</summary>\n    <p className="@body">Nhấp đúp vào tiêu đề hoặc đoạn văn trên Canvas để sửa ngay.</p>\n  </details>\n</div>`,
      en: `<div className="@root">\n  <details className="@item" open>\n    <summary className="@summary">How does this accordion work?</summary>\n    <p className="@body">It uses native disclosure elements for instant toggle without extra libraries.</p>\n  </details>\n  <details className="@item">\n    <summary className="@summary">Can I edit text inline?</summary>\n    <p className="@body">Double-click any summary or paragraph directly on the canvas.</p>\n  </details>\n</div>`,
    },
    styles: {
      root: { display: 'flex', 'flex-direction': 'column', gap: '8px' },
      item: {
        padding: '14px 16px',
        'background-color': '{surface}',
        border: '1px solid {border}',
        'border-radius': '{radius}',
      },
      summary: { 'font-size': '14px', 'font-weight': '600', color: '{text}', cursor: 'pointer' },
      body: { 'font-size': '14px', color: '{muted}', margin: '8px 0 0 0' },
    },
    bootstrap: {
      root: 'd-flex flex-column gap-2',
      item: 'p-3 bg-white border rounded',
      summary: 'fw-semibold',
      body: 'small text-secondary mt-2 mb-0',
    },
  },
  'interactive.toggle': {
    jsx: {
      vi: `<Toggle label="Nhận thông báo tức thì" className="@root" />`,
      en: `<Toggle label="Enable instant alerts" className="@root" />`,
    },
    styles: {
      root: {
        padding: '12px 16px',
        'background-color': '{surface}',
        border: '1px solid {border}',
        'border-radius': '{radius}',
      },
    },
    bootstrap: { root: 'p-3 bg-white border rounded' },
  },
  'interactive.choice': {
    jsx: {
      vi: `<Choice name="kc-tier" label="Chọn gói phù hợp" options="Cơ bản, Chuyên nghiệp, Doanh nghiệp" defaultValue="Cơ bản" className="@root" />`,
      en: `<Choice name="kc-tier" label="Choose your plan" options="Starter, Pro, Enterprise" defaultValue="Starter" className="@root" />`,
    },
    styles: {
      root: {
        padding: '16px',
        'background-color': '{surface}',
        border: '1px solid {border}',
        'border-radius': '{radius}',
      },
    },
    bootstrap: { root: 'p-3 bg-white border rounded' },
  },
  'interactive.carousel': {
    jsx: {
      vi: `<Carousel className="@root">\n  <div className="@slide"><h3 className="@title">Slide 1: Bố cục tự động</h3><p className="@body">Tự xuống dòng gọn gàng trên mọi kích thước màn hình.</p></div>\n  <div className="@slide"><h3 className="@title">Slide 2: Đồng bộ thương hiệu</h3><p className="@body">Khớp ngay màu sắc và bo góc của dự án.</p></div>\n  <div className="@slide"><h3 className="@title">Slide 3: Chỉnh sửa trực tiếp</h3><p className="@body">Sửa từng dòng chữ ngay trên Canvas.</p></div>\n</Carousel>`,
      en: `<Carousel className="@root">\n  <div className="@slide"><h3 className="@title">Slide 1: Responsive by default</h3><p className="@body">Wraps cleanly without complex breakpoint classes.</p></div>\n  <div className="@slide"><h3 className="@title">Slide 2: Brand synced</h3><p className="@body">Automatically matches project palette and corners.</p></div>\n  <div className="@slide"><h3 className="@title">Slide 3: Inline editing</h3><p className="@body">Update any headline right on the visual canvas.</p></div>\n</Carousel>`,
    },
    styles: {
      root: {
        padding: '20px',
        'background-color': '{surface}',
        border: '1px solid {border}',
        'border-radius': '{radius}',
      },
      slide: { padding: '12px' },
      title: { 'font-size': '18px', 'font-weight': '700', color: '{text}', margin: '0 0 6px 0' },
      body: { 'font-size': '14px', color: '{muted}', margin: '0' },
    },
    bootstrap: {
      root: 'p-4 bg-white border rounded',
      slide: 'p-2',
      title: 'h5 fw-bold mb-1',
      body: 'small text-secondary mb-0',
    },
  },
  'interactive.modal': {
    jsx: {
      vi: `<Modal triggerLabel="Mở hộp thoại" title="Xác nhận thay đổi" className="@root">\n  <p className="@body">Bạn có chắc chắn muốn áp dụng cấu hình này cho dự án?</p>\n</Modal>`,
      en: `<Modal triggerLabel="Open dialog" title="Confirm changes" className="@root">\n  <p className="@body">Are you sure you want to apply these workspace changes?</p>\n</Modal>`,
    },
    styles: {
      root: { display: 'inline-block' },
      body: { 'font-size': '14px', color: '{muted}', margin: '0' },
    },
    bootstrap: { root: 'd-inline-block', body: 'small text-secondary mb-0' },
  },
  'interactive.drawer': {
    jsx: {
      vi: `<Drawer triggerLabel="Mở ngăn kéo" title="Bộ lọc hiển thị" className="@root">\n  <p className="@body">Điều chỉnh danh mục và tiêu chí lọc dữ liệu tại đây.</p>\n</Drawer>`,
      en: `<Drawer triggerLabel="Open drawer" title="Display filters" className="@root">\n  <p className="@body">Adjust categories and display filters inside this panel.</p>\n</Drawer>`,
    },
    styles: {
      root: { display: 'inline-block' },
      body: { 'font-size': '14px', color: '{muted}', margin: '0' },
    },
    bootstrap: { root: 'd-inline-block', body: 'small text-secondary mb-0' },
  },
  'interactive.dropdown': {
    jsx: {
      vi: `<Dropdown triggerLabel="Tùy chọn" className="@root">\n  <button type="button" className="@item">Chỉnh sửa</button>\n  <button type="button" className="@item">Nhân bản</button>\n  <button type="button" className="@item">Xóa mục</button>\n</Dropdown>`,
      en: `<Dropdown triggerLabel="Actions" className="@root">\n  <button type="button" className="@item">Edit item</button>\n  <button type="button" className="@item">Duplicate</button>\n  <button type="button" className="@item">Delete</button>\n</Dropdown>`,
    },
    styles: {
      root: { display: 'inline-block' },
      item: {
        width: '100%',
        'text-align': 'left',
        padding: '6px 10px',
        border: 'none',
        background: 'transparent',
        color: '{text}',
        'font-size': '13px',
        cursor: 'pointer',
      },
    },
    bootstrap: { root: 'd-inline-block', item: 'dropdown-item' },
  },
  'interactive.tooltip': {
    jsx: {
      vi: `<Tooltip label="Di chuột xem gợi ý" content="Thông tin giải thích ngắn gọn cho thao tác này." className="@root" />`,
      en: `<Tooltip label="Hover for tip" content="Brief helpful context explaining this action." className="@root" />`,
    },
    styles: {
      root: { display: 'inline-block' },
    },
    bootstrap: { root: 'd-inline-block' },
  },
  'interactive.mobile-menu': {
    jsx: {
      vi: `<MobileMenu brand="KumiCraft" className="@root">\n  <a href="#" className="@link">Trang chủ</a>\n  <a href="#" className="@link">Tính năng</a>\n  <a href="#" className="@link">Bảng giá</a>\n  <a href="#" className="@link">Liên hệ</a>\n</MobileMenu>`,
      en: `<MobileMenu brand="KumiCraft" className="@root">\n  <a href="#" className="@link">Home</a>\n  <a href="#" className="@link">Features</a>\n  <a href="#" className="@link">Pricing</a>\n  <a href="#" className="@link">Contact</a>\n</MobileMenu>`,
    },
    styles: {
      root: {
        width: '100%',
        'background-color': '{surface}',
        border: '1px solid {border}',
        'border-radius': '{radius}',
      },
      link: { 'font-size': '14px', color: '{text}', 'text-decoration': 'none' },
    },
    bootstrap: { root: 'w-100 bg-white border rounded', link: 'nav-link' },
  },
} satisfies Record<string, NeutralBlock>;
