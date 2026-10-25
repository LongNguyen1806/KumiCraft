// Pure block renderer translating a LibraryBlock into target style system JSX + CSS rules (R-LB-11, R-ST-12).
import type { StyleSystemId } from '../style.ts';
import { v4ToV3Classes } from '../tailwind/v3-names.ts';
import type { LibraryBlock } from './types.ts';

export type RenderedCssRule = {
  readonly selector: string;
  readonly declarations: Readonly<Record<string, string>>;
};

export type RenderedBlock = {
  readonly jsx: string;
  /** Rule CSS cần thêm (chỉ hệ CSS thường, CSS Modules, Sass, Less, hoặc fallback của Bootstrap), mỗi rule `.kc-…{…}`. */
  readonly rules: readonly RenderedCssRule[];
};

const CLASS_ATTR_RE = /className="([^"]*)"/g;
const KEY_ATTR_RE = /className="@([a-zA-Z0-9_-]+)"/g;

function shortBlockId(blockId: string): string {
  const dot = blockId.indexOf('.');
  return dot >= 0 ? blockId.slice(dot + 1) : blockId;
}

function kcClassName(shortId: string, key: string): string {
  return key === 'root' ? `kc-${shortId}` : `kc-${shortId}-${key}`;
}

function renderTailwind3(rawJsx: string): RenderedBlock {
  const jsx = rawJsx.replace(CLASS_ATTR_RE, (_full, classes: string) => {
    return `className="${v4ToV3Classes(classes)}"`;
  });
  return { jsx, rules: [] };
}

function renderFromNeutral(
  block: LibraryBlock,
  lang: 'vi' | 'en',
  useBootstrap: boolean,
): RenderedBlock {
  const shortId = shortBlockId(block.id);
  const { styles, bootstrap } = block.neutral;
  const rawNeutralJsx = block.neutral.jsx[lang];
  const ruleKeys: string[] = [];
  const seenKeys = new Set<string>();

  const jsx = rawNeutralJsx.replace(KEY_ATTR_RE, (_full, key: string) => {
    const bsClass = useBootstrap ? bootstrap[key] : undefined;
    if (bsClass !== undefined && bsClass.length > 0) {
      return `className="${bsClass}"`;
    }
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      ruleKeys.push(key);
    }
    return `className="${kcClassName(shortId, key)}"`;
  });

  const rules: RenderedCssRule[] = [];
  for (const key of ruleKeys) {
    const declarations = styles[key];
    if (declarations !== undefined) {
      rules.push({
        selector: `.${kcClassName(shortId, key)}`,
        declarations,
      });
    }
  }

  return { jsx, rules };
}

export function renderBlock(
  block: LibraryBlock,
  system: StyleSystemId | undefined,
  lang: 'vi' | 'en',
): RenderedBlock {
  if (system === undefined || system === 'tailwind4') {
    return { jsx: block.jsx[lang], rules: [] };
  }
  if (system === 'tailwind3') {
    return renderTailwind3(block.jsx[lang]);
  }
  if (system === 'bootstrap5') {
    return renderFromNeutral(block, lang, true);
  }
  return renderFromNeutral(block, lang, false);
}
