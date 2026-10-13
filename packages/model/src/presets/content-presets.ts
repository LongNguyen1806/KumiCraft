// Content presets (SPEC-04.1 section 10.2).
import type { DesignNode } from '../schema/node.schema.ts';
import type { Preset, PresetContext } from './types.ts';

const isVi = (locale?: string) => locale?.startsWith('vi') === true;

function createHeading(ctx?: PresetContext): DesignNode {
  const vi = isVi(ctx?.contentLocale);
  return {
    id: 'tmp_1',
    type: 'Heading',
    content: { kind: 'heading', level: 2, text: vi ? 'Tiêu đề' : 'Heading' },
    style: { fontSize: 'token:fontSize.3xl', fontWeight: 'token:fontWeight.bold' },
  };
}

function createText(ctx?: PresetContext): DesignNode {
  const vi = isVi(ctx?.contentLocale);
  return {
    id: 'tmp_1',
    type: 'Text',
    content: { kind: 'text', text: vi ? 'Đoạn văn bản mẫu.' : 'Sample paragraph text.' },
    style: { fontSize: 'token:fontSize.base', textColor: 'token:color.muted' },
  };
}

function createImage(): DesignNode {
  return {
    id: 'tmp_1',
    type: 'Image',
    content: {
      kind: 'image',
      src: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809',
      alt: 'Image',
    },
    style: { width: 'fill', aspectRatio: '16/9', radius: 'token:radius.lg' },
  };
}

function createIcon(): DesignNode {
  return {
    id: 'tmp_1',
    type: 'Icon',
    content: { kind: 'icon', name: 'star', size: { px: 24 } },
  };
}

function createLink(ctx?: PresetContext): DesignNode {
  const vi = isVi(ctx?.contentLocale);
  return {
    id: 'tmp_1',
    type: 'Link',
    content: { kind: 'link', text: vi ? 'Liên kết' : 'Link', href: '#' },
    style: { textColor: 'token:color.primary' },
  };
}

function createDivider(): DesignNode {
  return {
    id: 'tmp_1',
    type: 'Divider',
    content: { kind: 'none' },
    style: { borderColor: 'token:color.border' },
  };
}

function createBadge(ctx?: PresetContext): DesignNode {
  const vi = isVi(ctx?.contentLocale);
  return {
    id: 'tmp_1',
    type: 'Text',
    content: { kind: 'text', as: 'span', text: vi ? 'Huy hiệu' : 'Badge' },
    style: {
      fontSize: 'token:fontSize.xs',
      fontWeight: 'token:fontWeight.medium',
      padding: { top: { px: 2 }, bottom: { px: 2 }, left: { px: 8 }, right: { px: 8 } },
      radius: 'token:radius.full',
      background: 'token:color.secondary',
    },
  };
}

function createAvatar(): DesignNode {
  return {
    id: 'tmp_1',
    type: 'Image',
    content: {
      kind: 'image',
      src: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
      alt: 'Avatar',
    },
    style: {
      width: { fixed: { px: 40 } },
      height: { fixed: { px: 40 } },
      radius: 'token:radius.full',
      aspectRatio: '1/1',
    },
  };
}

export const CONTENT_PRESETS: readonly Preset[] = [
  {
    id: 'content.heading',
    category: 'content',
    labelKey: 'presets.heading',
    icon: 'Heading',
    create: createHeading,
  },
  {
    id: 'content.text',
    category: 'content',
    labelKey: 'presets.text',
    icon: 'Type',
    create: createText,
  },
  {
    id: 'content.image',
    category: 'content',
    labelKey: 'presets.image',
    icon: 'Image',
    create: createImage,
  },
  {
    id: 'content.icon',
    category: 'content',
    labelKey: 'presets.icon',
    icon: 'Sparkles',
    create: createIcon,
  },
  {
    id: 'content.link',
    category: 'content',
    labelKey: 'presets.link',
    icon: 'Link',
    create: createLink,
  },
  {
    id: 'content.divider',
    category: 'content',
    labelKey: 'presets.divider',
    icon: 'Minus',
    create: createDivider,
  },
  {
    id: 'content.badge',
    category: 'content',
    labelKey: 'presets.badge',
    icon: 'Tag',
    create: createBadge,
  },
  {
    id: 'content.avatar',
    category: 'content',
    labelKey: 'presets.avatar',
    icon: 'UserCircle',
    create: createAvatar,
  },
];
