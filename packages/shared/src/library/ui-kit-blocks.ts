// shadcn/ui component block rendering helpers when project uiKit is present (TK-44).
import type { UiKitReport } from '../project.ts';
import { v4ToV3Classes } from '../tailwind/v3-names.ts';
import { type ProjectLook, resolveTailwindRoles } from './project-look.ts';

export type UiKitRendered = {
  readonly jsx: string;
  readonly imports: readonly string[];
};

function hasComponent(uiKit: UiKitReport, name: string): boolean {
  return uiKit.components.includes(name);
}

/** Returns true when a library block id can be rendered using a detected project UI kit component. */
export function supportsUiKitBlock(blockId: string, uiKit: UiKitReport | undefined): boolean {
  if (uiKit === undefined) return false;
  if (blockId === 'form.button') return hasComponent(uiKit, 'button');
  if (blockId === 'form.input') return hasComponent(uiKit, 'input');
  if (blockId === 'composite.card') return hasComponent(uiKit, 'card');
  return false;
}

function resolveClasses(raw: string, look: ProjectLook, isV3: boolean): string {
  const resolved = resolveTailwindRoles(raw, look);
  return isV3 ? v4ToV3Classes(resolved) : resolved;
}

function styleExtraClasses(look: ProjectLook, isV3: boolean, forPrimaryBtn = false): string {
  if (look.style === undefined || look.style === 'default') return '';
  if (forPrimaryBtn && look.style === 'bold') {
    return resolveClasses(
      'bg-{primary} text-{on-primary} hover:bg-{primary}/90 {shadow}',
      look,
      isV3,
    );
  }
  return resolveClasses('{shadow} {effect}', look, isV3);
}

function classAttr(classes: string): string {
  return classes.length > 0 ? ` className="${classes}"` : '';
}

function renderUiKitButton(
  uiKit: UiKitReport,
  lang: 'vi' | 'en',
  look: ProjectLook,
  variantId: string | undefined,
  isV3: boolean,
): UiKitRendered {
  const label = lang === 'vi' ? 'Bấm vào đây' : 'Click here';
  const variantAttr = variantId === 'outline' || variantId === 'ghost' ? variantId : 'default';
  const sizeAttr = variantId === 'sm' || variantId === 'lg' ? ` size="${variantId}"` : '';
  const extra = styleExtraClasses(look, isV3, variantAttr === 'default');
  return {
    jsx: `<Button variant="${variantAttr}"${sizeAttr}${classAttr(extra)}>\n  ${label}\n</Button>`,
    imports: [`import { Button } from '${uiKit.importBase}/button';`],
  };
}

function renderUiKitInput(
  uiKit: UiKitReport,
  lang: 'vi' | 'en',
  look: ProjectLook,
  isV3: boolean,
): UiKitRendered {
  const labelText = lang === 'vi' ? 'Họ và tên' : 'Full Name';
  const placeholder = lang === 'vi' ? 'Nhập văn bản...' : 'Enter text...';
  const imports = [`import { Input } from '${uiKit.importBase}/input';`];
  const hasLabel = hasComponent(uiKit, 'label');
  const labelEl = hasLabel
    ? `<Label>${labelText}</Label>`
    : `<label className="${resolveClasses('text-sm font-medium text-{text}', look, isV3)}">${labelText}</label>`;
  if (hasLabel) {
    imports.push(`import { Label } from '${uiKit.importBase}/label';`);
  }
  const inputExtra = styleExtraClasses(look, isV3);
  return {
    jsx: `<div className="flex flex-col gap-1.5">\n  ${labelEl}\n  <Input type="text" placeholder="${placeholder}"${classAttr(inputExtra)} />\n</div>`,
    imports,
  };
}

function renderUiKitCard(
  uiKit: UiKitReport,
  lang: 'vi' | 'en',
  look: ProjectLook,
  variantId: string | undefined,
  isV3: boolean,
): UiKitRendered {
  const title = lang === 'vi' ? 'Tiêu đề thẻ' : 'Card Title';
  const body =
    lang === 'vi'
      ? 'Nội dung mô tả ngắn gọn giúp người dùng hiểu thông tin chính của thẻ này.'
      : 'A short description helping the user understand the primary card details.';
  let rawCardClasses = '';
  if (look.style !== undefined && look.style !== 'default') {
    rawCardClasses =
      variantId === 'flat' ? 'bg-{surface-muted} {shadow} {effect}' : '{shadow} {effect}';
  } else if (variantId === 'flat') {
    rawCardClasses = 'bg-{surface-muted} shadow-none';
  } else if (variantId === 'elevated') {
    rawCardClasses = 'shadow-md';
  }
  const cardClasses = rawCardClasses.length > 0 ? resolveClasses(rawCardClasses, look, isV3) : '';
  const bodyCls = resolveClasses('text-sm text-{muted}', look, isV3);

  return {
    jsx: `<Card${classAttr(cardClasses)}>\n  <CardHeader>\n    <CardTitle>${title}</CardTitle>\n  </CardHeader>\n  <CardContent>\n    <p className="${bodyCls}">${body}</p>\n  </CardContent>\n</Card>`,
    imports: [
      `import { Card, CardContent, CardHeader, CardTitle } from '${uiKit.importBase}/card';`,
    ],
  };
}

/** Attempts to render a library block using detected shadcn/ui components. */
export function renderWithUiKit(
  blockId: string,
  uiKit: UiKitReport | undefined,
  lang: 'vi' | 'en',
  look: ProjectLook,
  variantId: string | undefined,
  isV3: boolean,
): UiKitRendered | undefined {
  if (!supportsUiKitBlock(blockId, uiKit) || uiKit === undefined) {
    return undefined;
  }
  if (blockId === 'form.button') {
    return renderUiKitButton(uiKit, lang, look, variantId, isV3);
  }
  if (blockId === 'form.input') {
    return renderUiKitInput(uiKit, lang, look, isV3);
  }
  if (blockId === 'composite.card') {
    return renderUiKitCard(uiKit, lang, look, variantId, isV3);
  }
  return undefined;
}
