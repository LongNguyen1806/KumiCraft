// Composite presets (SPEC-04.1 section 10.2).
import type { DesignNode } from '../schema/node.schema.ts';
import type { Preset, PresetContext } from './types.ts';

const isVi = (locale?: string) => locale?.startsWith('vi') === true;

function createCard(ctx?: PresetContext): DesignNode {
  const vi = isVi(ctx?.contentLocale);
  return {
    id: 'tmp_1',
    type: 'Card',
    content: { kind: 'none' },
    style: {
      padding: {
        top: 'token:spacing.6',
        bottom: 'token:spacing.6',
        left: 'token:spacing.6',
        right: 'token:spacing.6',
      },
      radius: 'token:radius.lg',
      background: 'token:color.surface',
      shadow: 'token:shadow.sm',
      gap: 'token:spacing.3',
    },
    children: [
      {
        id: 'tmp_2',
        type: 'Heading',
        content: { kind: 'heading', level: 3, text: vi ? 'Tiêu đề thẻ' : 'Card heading' },
      },
      {
        id: 'tmp_3',
        type: 'Text',
        content: { kind: 'text', text: vi ? 'Nội dung thẻ mô tả.' : 'Card description text.' },
      },
    ],
  };
}

function createNavbar(ctx?: PresetContext): DesignNode {
  const vi = isVi(ctx?.contentLocale);
  return {
    id: 'tmp_1',
    type: 'Navbar',
    content: { kind: 'none' },
    style: {
      direction: 'row',
      justify: 'between',
      align: 'center',
      padding: {
        top: 'token:spacing.4',
        bottom: 'token:spacing.4',
        left: 'token:spacing.6',
        right: 'token:spacing.6',
      },
    },
    children: [
      {
        id: 'tmp_2',
        type: 'Text',
        content: { kind: 'text', text: 'Logo' },
        style: { fontWeight: 'token:fontWeight.bold', fontSize: 'token:fontSize.lg' },
      },
      {
        id: 'tmp_3',
        type: 'Stack',
        content: { kind: 'none' },
        style: { direction: 'row', gap: 'token:spacing.4', align: 'center' },
        children: [
          {
            id: 'tmp_4',
            type: 'Link',
            content: { kind: 'link', text: vi ? 'Trang chủ' : 'Home', href: '#' },
          },
          {
            id: 'tmp_5',
            type: 'Link',
            content: { kind: 'link', text: vi ? 'Giới thiệu' : 'About', href: '#' },
          },
          {
            id: 'tmp_6',
            type: 'Link',
            content: { kind: 'link', text: vi ? 'Liên hệ' : 'Contact', href: '#' },
          },
        ],
      },
    ],
  };
}

function createSidebar(ctx?: PresetContext): DesignNode {
  const vi = isVi(ctx?.contentLocale);
  return {
    id: 'tmp_1',
    type: 'Sidebar',
    content: { kind: 'none' },
    style: {
      direction: 'column',
      width: { fixed: { px: 240 } },
      padding: {
        top: 'token:spacing.4',
        bottom: 'token:spacing.4',
        left: 'token:spacing.4',
        right: 'token:spacing.4',
      },
      gap: 'token:spacing.2',
    },
    children: [
      {
        id: 'tmp_2',
        type: 'Link',
        content: { kind: 'link', text: vi ? 'Tổng quan' : 'Dashboard', href: '#' },
      },
      {
        id: 'tmp_3',
        type: 'Link',
        content: { kind: 'link', text: vi ? 'Dự án' : 'Projects', href: '#' },
      },
      {
        id: 'tmp_4',
        type: 'Link',
        content: { kind: 'link', text: vi ? 'Báo cáo' : 'Reports', href: '#' },
      },
      {
        id: 'tmp_5',
        type: 'Link',
        content: { kind: 'link', text: vi ? 'Cài đặt' : 'Settings', href: '#' },
      },
    ],
  };
}

function createFooter(ctx?: PresetContext): DesignNode {
  const vi = isVi(ctx?.contentLocale);
  return {
    id: 'tmp_1',
    type: 'Footer',
    content: { kind: 'none' },
    style: {
      direction: 'row',
      justify: 'between',
      align: 'center',
      padding: {
        top: 'token:spacing.8',
        bottom: 'token:spacing.8',
        left: 'token:spacing.6',
        right: 'token:spacing.6',
      },
    },
    children: [
      {
        id: 'tmp_2',
        type: 'Text',
        content: {
          kind: 'text',
          text: vi ? '© 2026 Bản quyền thuộc về công ty' : '© 2026 All rights reserved',
        },
      },
      {
        id: 'tmp_3',
        type: 'Text',
        content: { kind: 'text', text: vi ? 'Chính sách bảo mật' : 'Privacy Policy' },
      },
    ],
  };
}

function createModal(ctx?: PresetContext): DesignNode {
  const vi = isVi(ctx?.contentLocale);
  return {
    id: 'tmp_1',
    type: 'Modal',
    content: { kind: 'modal', title: vi ? 'Hộp thoại' : 'Dialog', openByDefault: true },
    children: [
      {
        id: 'tmp_2',
        type: 'Heading',
        content: { kind: 'heading', level: 3, text: vi ? 'Xác nhận' : 'Confirm' },
      },
      {
        id: 'tmp_3',
        type: 'Text',
        content: {
          kind: 'text',
          text: vi ? 'Bạn có chắc chắn muốn thực hiện?' : 'Are you sure you want to proceed?',
        },
      },
      {
        id: 'tmp_4',
        type: 'Stack',
        content: { kind: 'none' },
        style: { direction: 'row', gap: 'token:spacing.2', justify: 'end' },
        children: [
          {
            id: 'tmp_5',
            type: 'Button',
            content: { kind: 'button', variant: 'outline', text: vi ? 'Hủy' : 'Cancel' },
          },
          {
            id: 'tmp_6',
            type: 'Button',
            content: { kind: 'button', variant: 'primary', text: vi ? 'Đồng ý' : 'OK' },
          },
        ],
      },
    ],
  };
}

function createTabs(ctx?: PresetContext): DesignNode {
  const vi = isVi(ctx?.contentLocale);
  return {
    id: 'tmp_1',
    type: 'Tabs',
    content: {
      kind: 'tabs',
      items: [
        { id: 'tab-1', label: vi ? 'Mục 1' : 'Tab 1' },
        { id: 'tab-2', label: vi ? 'Mục 2' : 'Tab 2' },
      ],
    },
    children: [
      {
        id: 'tmp_2',
        type: 'Stack',
        content: { kind: 'none' },
        children: [
          {
            id: 'tmp_3',
            type: 'Text',
            content: { kind: 'text', text: vi ? 'Nội dung mục 1' : 'Content of Tab 1' },
          },
        ],
      },
      {
        id: 'tmp_4',
        type: 'Stack',
        content: { kind: 'none' },
        children: [
          {
            id: 'tmp_5',
            type: 'Text',
            content: { kind: 'text', text: vi ? 'Nội dung mục 2' : 'Content of Tab 2' },
          },
        ],
      },
    ],
  };
}

function heroButtons(vi: boolean): DesignNode {
  return {
    id: 'tmp_4',
    type: 'Stack',
    content: { kind: 'none' },
    style: { direction: 'row', gap: 'token:spacing.4', align: 'center' },
    children: [
      {
        id: 'tmp_5',
        type: 'Button',
        content: { kind: 'button', variant: 'primary', text: vi ? 'Bắt đầu ngay' : 'Get started' },
      },
      {
        id: 'tmp_6',
        type: 'Button',
        content: { kind: 'button', variant: 'outline', text: vi ? 'Tìm hiểu thêm' : 'Learn more' },
      },
    ],
  };
}

function createHero(ctx?: PresetContext): DesignNode {
  const vi = isVi(ctx?.contentLocale);
  return {
    id: 'tmp_1',
    type: 'Section',
    content: { kind: 'section', as: 'section' },
    style: {
      direction: 'column',
      align: 'center',
      padding: { top: 'token:spacing.24', bottom: 'token:spacing.24' },
      gap: 'token:spacing.4',
    },
    children: [
      {
        id: 'tmp_2',
        type: 'Heading',
        content: {
          kind: 'heading',
          level: 1,
          text: vi ? 'Xây dựng tương lai hôm nay' : 'Build the future today',
        },
        style: { fontSize: 'token:fontSize.5xl', fontWeight: 'token:fontWeight.bold' },
      },
      {
        id: 'tmp_3',
        type: 'Text',
        content: {
          kind: 'text',
          text: vi
            ? 'Nền tảng giúp bạn kiến tạo sản phẩm nhanh chóng và hiện đại.'
            : 'The modern platform designed to help you build great software.',
        },
        style: { fontSize: 'token:fontSize.lg', textColor: 'token:color.muted' },
      },
      heroButtons(vi),
    ],
  };
}

export const COMPOSITE_PRESETS: readonly Preset[] = [
  {
    id: 'composite.card',
    category: 'composite',
    labelKey: 'presets.card',
    icon: 'CreditCard',
    create: createCard,
  },
  {
    id: 'composite.navbar',
    category: 'composite',
    labelKey: 'presets.navbar',
    icon: 'Navigation',
    create: createNavbar,
  },
  {
    id: 'composite.sidebar',
    category: 'composite',
    labelKey: 'presets.sidebar',
    icon: 'PanelLeft',
    create: createSidebar,
  },
  {
    id: 'composite.footer',
    category: 'composite',
    labelKey: 'presets.footer',
    icon: 'PanelBottom',
    create: createFooter,
  },
  {
    id: 'composite.modal',
    category: 'composite',
    labelKey: 'presets.modal',
    icon: 'AppWindow',
    create: createModal,
  },
  {
    id: 'composite.tabs',
    category: 'composite',
    labelKey: 'presets.tabs',
    icon: 'FolderTabs',
    create: createTabs,
  },
  {
    id: 'composite.hero',
    category: 'composite',
    labelKey: 'presets.hero',
    icon: 'LayoutTemplate',
    create: createHero,
  },
];
