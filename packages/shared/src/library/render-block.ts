// Pure block renderer translating a LibraryBlock into target style system JSX + CSS rules (R-LB-11, R-ST-12, TK-43, TK-47).
import type { UiKitReport } from '../project.ts';
import type { StyleSystemId } from '../style.ts';
import { v4ToV3Classes } from '../tailwind/v3-names.ts';
import type { KitBlockSpec } from './kit-types.ts';
import { type ProjectLook, resolveCssRoles, resolveTailwindRoles } from './project-look.ts';
import type { LibraryBlock, NeutralBlock } from './types.ts';
import { renderWithUiKit } from './ui-kit-blocks.ts';
import { renderInteractiveUiKit } from './ui-kit-interactive.ts';

export type RenderedCssRule = {
  readonly selector: string;
  readonly declarations: Readonly<Record<string, string>>;
};

export type RenderedBlock = {
  readonly jsx: string;
  /** Rule CSS cần thêm (chỉ hệ CSS thường, CSS Modules, Sass, Less, hoặc fallback của Bootstrap), mỗi rule `.kc-…{…}`. */
  readonly rules: readonly RenderedCssRule[];
  readonly imports?: readonly string[];
  readonly usedUiKit?: boolean;
  readonly kit?: KitBlockSpec;
};

const CLASS_ATTR_RE = /className="([^"]*)"/g;
const KEY_ATTR_RE = /className="@([a-zA-Z0-9_-]+)"/g;
const EMPTY_LOOK: ProjectLook = { roles: {} };

function shortBlockId(blockId: string): string {
  const dot = blockId.indexOf('.');
  return dot >= 0 ? blockId.slice(dot + 1) : blockId;
}

function kcClassName(prefix: string, key: string): string {
  return key === 'root' ? `kc-${prefix}` : `kc-${prefix}-${key}`;
}

function renderTailwind(rawJsx: string, look: ProjectLook, isV3: boolean): RenderedBlock {
  const jsx = rawJsx.replace(CLASS_ATTR_RE, (_full, classes: string) => {
    const resolved = resolveTailwindRoles(classes, look);
    return `className="${isV3 ? v4ToV3Classes(resolved) : resolved}"`;
  });
  return { jsx, rules: [] };
}

function renderFromNeutral(
  prefix: string,
  neutral: NeutralBlock,
  lang: 'vi' | 'en',
  useBootstrap: boolean,
  look: ProjectLook,
): RenderedBlock {
  const { styles, bootstrap } = neutral;
  const rawNeutralJsx = neutral.jsx[lang];
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
    return `className="${kcClassName(prefix, key)}"`;
  });

  const rules: RenderedCssRule[] = [];
  for (const key of ruleKeys) {
    const rawDeclarations = styles[key];
    if (rawDeclarations !== undefined) {
      const declarations = resolveCssRoles(rawDeclarations, look);
      if (Object.keys(declarations).length > 0) {
        rules.push({
          selector: `.${kcClassName(prefix, key)}`,
          declarations,
        });
      }
    }
  }

  return { jsx, rules };
}

function tryRenderUiKitSystem(
  blockId: string,
  system: StyleSystemId | undefined,
  lang: 'vi' | 'en',
  look: ProjectLook,
  variantId: string | undefined,
  uiKit: UiKitReport | undefined,
): RenderedBlock | undefined {
  const isTailwind = system === undefined || system === 'tailwind4' || system === 'tailwind3';
  if (!isTailwind) return undefined;
  const uiKitInteractive = renderInteractiveUiKit(blockId, lang, uiKit);
  if (uiKitInteractive !== undefined) {
    return {
      jsx: uiKitInteractive.jsx,
      rules: [],
      imports: uiKitInteractive.imports,
      usedUiKit: true,
    };
  }
  const kitRendered = renderWithUiKit(
    blockId,
    uiKit,
    lang,
    look,
    variantId,
    system === 'tailwind3',
  );
  if (kitRendered === undefined) return undefined;
  return { jsx: kitRendered.jsx, rules: [], imports: kitRendered.imports, usedUiKit: true };
}

export function renderBlock(
  block: LibraryBlock,
  system: StyleSystemId | undefined,
  lang: 'vi' | 'en',
  look?: ProjectLook,
  variantId?: string,
  uiKit?: UiKitReport,
): RenderedBlock {
  const activeLook = look ?? EMPTY_LOOK;
  const variant =
    variantId !== undefined ? block.variants?.find((v) => v.id === variantId) : undefined;
  const uiKitResult = tryRenderUiKitSystem(block.id, system, lang, activeLook, variant?.id, uiKit);
  if (uiKitResult !== undefined) return uiKitResult;

  const rawJsx = variant !== undefined ? variant.jsx[lang] : block.jsx[lang];
  const neutral = variant !== undefined ? variant.neutral : block.neutral;
  const kitProp = block.kit !== undefined ? { kit: block.kit } : {};

  if (system === undefined || system === 'tailwind4') {
    return { ...renderTailwind(rawJsx, activeLook, false), ...kitProp };
  }
  if (system === 'tailwind3') {
    return { ...renderTailwind(rawJsx, activeLook, true), ...kitProp };
  }
  const shortId = shortBlockId(block.id);
  const prefix = variant !== undefined ? `${shortId}-${variant.id}` : shortId;
  return {
    ...renderFromNeutral(prefix, neutral, lang, system === 'bootstrap5', activeLook),
    ...kitProp,
  };
}
