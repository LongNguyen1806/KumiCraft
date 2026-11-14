// Pure form & data-table generators from structured DataField definitions (TK-33, TK-34).
import type { UiKitReport } from '../project.ts';
import type { DataArrayRow, DataField } from '../source-data.ts';
import type { StyleSystemId } from '../style.ts';
import { v4ToV3Classes } from '../tailwind/v3-names.ts';
import { type ProjectLook, resolveCssRoles, resolveTailwindRoles } from './project-look.ts';
import type { RenderedBlock, RenderedCssRule } from './render-block.ts';

const EMPTY_LOOK: ProjectLook = { roles: {} };
const CSS_SYSTEMS = new Set<StyleSystemId>(['css', 'cssModules', 'sass', 'less']);

function escapeAttr(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function escapeText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function toSafeId(name: string): string {
  const clean = name.replace(/[^a-zA-Z0-9_-]/g, '-');
  return `field-${clean.length > 0 ? clean : 'item'}`;
}

function resolveTw(raw: string, look: ProjectLook, isV3: boolean): string {
  const resolved = resolveTailwindRoles(raw, look);
  return isV3 ? v4ToV3Classes(resolved) : resolved;
}

function hasUiComp(uiKit: UiKitReport | undefined, name: string): boolean {
  return uiKit !== undefined && uiKit.components.includes(name);
}

function htmlInputType(fieldType: DataField['type']): string {
  if (fieldType === 'datetime') return 'datetime-local';
  if (
    fieldType === 'email' ||
    fieldType === 'number' ||
    fieldType === 'date' ||
    fieldType === 'url' ||
    fieldType === 'password'
  ) {
    return fieldType;
  }
  return 'text';
}

type FormRenderCtx = {
  readonly system: StyleSystemId | undefined;
  readonly look: ProjectLook;
  readonly uiKit: UiKitReport | undefined;
  readonly imports: Set<string>;
};

function renderTailwindFieldControl(field: DataField, id: string, ctx: FormRenderCtx): string {
  const isV3 = ctx.system === 'tailwind3';
  const base = ctx.uiKit?.importBase;
  const req = field.required ? ' required' : '';
  const max = field.maxLength !== undefined ? ` maxLength={${String(field.maxLength)}}` : '';
  const inputCls = resolveTw(
    'w-full px-3 py-2 bg-{surface} text-{text} border border-{border} rounded-{radius} text-sm',
    ctx.look,
    isV3,
  );

  if (field.type === 'select') {
    const opts = (field.options ?? []).map(
      (opt) => `      <option value="${escapeAttr(opt)}">${escapeText(opt)}</option>`,
    );
    return `    <select id="${id}" name="${escapeAttr(field.name)}"${req} className="${inputCls}">\n${opts.join('\n')}\n    </select>`;
  }
  if (field.type === 'textarea') {
    if (base !== undefined && hasUiComp(ctx.uiKit, 'textarea')) {
      ctx.imports.add(`import { Textarea } from '${base}/textarea';`);
      return `    <Textarea id="${id}" name="${escapeAttr(field.name)}" rows={3}${req}${max} />`;
    }
    return `    <textarea id="${id}" name="${escapeAttr(field.name)}" rows={3}${req}${max} className="${inputCls}" />`;
  }
  if (base !== undefined && hasUiComp(ctx.uiKit, 'input')) {
    ctx.imports.add(`import { Input } from '${base}/input';`);
    return `    <Input id="${id}" name="${escapeAttr(field.name)}" type="${htmlInputType(field.type)}"${req}${max} />`;
  }
  return `    <input id="${id}" name="${escapeAttr(field.name)}" type="${htmlInputType(field.type)}"${req}${max} className="${inputCls}" />`;
}

function renderTailwindField(field: DataField, ctx: FormRenderCtx): string {
  const isV3 = ctx.system === 'tailwind3';
  const id = toSafeId(field.name);
  const labelText = escapeText(field.label);
  const base = ctx.uiKit?.importBase;
  const useLabel = base !== undefined && hasUiComp(ctx.uiKit, 'label');
  if (useLabel) ctx.imports.add(`import { Label } from '${base}/label';`);
  const labelCls = resolveTw('text-sm font-medium text-{text}', ctx.look, isV3);
  const labelOpen = useLabel
    ? `<Label htmlFor="${id}">`
    : `<label htmlFor="${id}" className="${labelCls}">`;
  const labelClose = useLabel ? '</Label>' : '</label>';

  if (field.type === 'boolean') {
    const useCb = base !== undefined && hasUiComp(ctx.uiKit, 'checkbox');
    if (useCb) ctx.imports.add(`import { Checkbox } from '${base}/checkbox';`);
    const ctrl = useCb
      ? `<Checkbox id="${id}" name="${escapeAttr(field.name)}" />`
      : `<input id="${id}" name="${escapeAttr(field.name)}" type="checkbox" className="h-4 w-4 rounded" />`;
    return `  <div className="flex items-center gap-2 min-w-[220px] flex-1">\n    ${ctrl}\n    ${labelOpen}${labelText}${labelClose}\n  </div>`;
  }
  const ctrl = renderTailwindFieldControl(field, id, ctx);
  return `  <div className="flex flex-col gap-1.5 min-w-[220px] flex-1">\n    ${labelOpen}${labelText}${labelClose}\n${ctrl}\n  </div>`;
}

function renderBootstrapField(field: DataField): string {
  const id = toSafeId(field.name);
  const labelText = escapeText(field.label);
  const req = field.required ? ' required' : '';
  const max = field.maxLength !== undefined ? ` maxLength={${String(field.maxLength)}}` : '';
  if (field.type === 'boolean') {
    return `  <div className="col-12 col-md-6 form-check">\n    <input id="${id}" name="${escapeAttr(field.name)}" type="checkbox" className="form-check-input" />\n    <label htmlFor="${id}" className="form-check-label">${labelText}</label>\n  </div>`;
  }
  if (field.type === 'select') {
    const opts = (field.options ?? []).map(
      (opt) => `      <option value="${escapeAttr(opt)}">${escapeText(opt)}</option>`,
    );
    return `  <div className="col-12 col-md-6">\n    <label htmlFor="${id}" className="form-label">${labelText}</label>\n    <select id="${id}" name="${escapeAttr(field.name)}"${req} className="form-select">\n${opts.join('\n')}\n    </select>\n  </div>`;
  }
  if (field.type === 'textarea') {
    return `  <div className="col-12 col-md-6">\n    <label htmlFor="${id}" className="form-label">${labelText}</label>\n    <textarea id="${id}" name="${escapeAttr(field.name)}" rows={3}${req}${max} className="form-control" />\n  </div>`;
  }
  return `  <div className="col-12 col-md-6">\n    <label htmlFor="${id}" className="form-label">${labelText}</label>\n    <input id="${id}" name="${escapeAttr(field.name)}" type="${htmlInputType(field.type)}"${req}${max} className="form-control" />\n  </div>`;
}

function renderCssField(field: DataField): string {
  const id = toSafeId(field.name);
  const labelText = escapeText(field.label);
  const req = field.required ? ' required' : '';
  const max = field.maxLength !== undefined ? ` maxLength={${String(field.maxLength)}}` : '';
  if (field.type === 'boolean') {
    return `  <div className="kc-form-check">\n    <input id="${id}" name="${escapeAttr(field.name)}" type="checkbox" />\n    <label htmlFor="${id}" className="kc-form-label">${labelText}</label>\n  </div>`;
  }
  if (field.type === 'select') {
    const opts = (field.options ?? []).map(
      (opt) => `      <option value="${escapeAttr(opt)}">${escapeText(opt)}</option>`,
    );
    return `  <div className="kc-form-field">\n    <label htmlFor="${id}" className="kc-form-label">${labelText}</label>\n    <select id="${id}" name="${escapeAttr(field.name)}"${req} className="kc-form-input">\n${opts.join('\n')}\n    </select>\n  </div>`;
  }
  if (field.type === 'textarea') {
    return `  <div className="kc-form-field">\n    <label htmlFor="${id}" className="kc-form-label">${labelText}</label>\n    <textarea id="${id}" name="${escapeAttr(field.name)}" rows={3}${req}${max} className="kc-form-input" />\n  </div>`;
  }
  return `  <div className="kc-form-field">\n    <label htmlFor="${id}" className="kc-form-label">${labelText}</label>\n    <input id="${id}" name="${escapeAttr(field.name)}" type="${htmlInputType(field.type)}"${req}${max} className="kc-form-input" />\n  </div>`;
}

const CSS_FORM_RULE_ENTRIES: readonly (readonly [string, Readonly<Record<string, string>>])[] = [
  [
    '.kc-form',
    {
      display: 'flex',
      'flex-direction': 'column',
      gap: '16px',
      padding: '20px',
      'background-color': '{surface}',
      border: '1px solid {border}',
      'border-radius': '{radius}',
    },
  ],
  [
    '.kc-form-grid',
    {
      display: 'grid',
      'grid-template-columns': 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: '16px',
    },
  ],
  ['.kc-form-field', { display: 'flex', 'flex-direction': 'column', gap: '6px' }],
  ['.kc-form-check', { display: 'flex', 'align-items': 'center', gap: '8px' }],
  ['.kc-form-label', { 'font-size': '14px', 'font-weight': '500', color: '{text}' }],
  [
    '.kc-form-input',
    {
      width: '100%',
      padding: '8px 12px',
      border: '1px solid {border}',
      'border-radius': '{radius}',
      'background-color': '{surface}',
      color: '{text}',
    },
  ],
  [
    '.kc-form-submit',
    {
      'align-self': 'flex-start',
      padding: '10px 18px',
      'background-color': '{primary}',
      color: '{on-primary}',
      border: 'none',
      'border-radius': '{radius}',
      'font-weight': '500',
    },
  ],
];

function buildCssFormRules(look: ProjectLook): readonly RenderedCssRule[] {
  return CSS_FORM_RULE_ENTRIES.map(([selector, decl]) => ({
    selector,
    declarations: resolveCssRoles(decl, look),
  }));
}

export type GenerateFormInput = {
  readonly fields: readonly DataField[];
  readonly system?: StyleSystemId | undefined;
  readonly lang?: 'vi' | 'en' | undefined;
  readonly look?: ProjectLook | undefined;
  readonly uiKit?: UiKitReport | undefined;
};

/** Generates a form JSX + optional CSS rules and imports from structured data fields (TK-33). */
export function generateFormFromFields(input: GenerateFormInput): RenderedBlock {
  const system = input.system;
  const lang = input.lang ?? 'vi';
  const look = input.look ?? EMPTY_LOOK;
  const submitLabel = lang === 'vi' ? 'Lưu' : 'Save';

  if (system === 'bootstrap5') {
    const items = input.fields.map(renderBootstrapField).join('\n');
    const jsx = `<form className="card p-4 d-flex flex-column gap-3">\n  <div className="row g-3">\n${items}\n  </div>\n  <button type="submit" className="btn btn-primary align-self-start">${submitLabel}</button>\n</form>`;
    return { jsx, rules: [] };
  }

  if (system !== undefined && CSS_SYSTEMS.has(system)) {
    const items = input.fields.map(renderCssField).join('\n');
    const jsx = `<form className="kc-form">\n  <div className="kc-form-grid">\n${items}\n  </div>\n  <button type="submit" className="kc-form-submit">${submitLabel}</button>\n</form>`;
    return { jsx, rules: buildCssFormRules(look) };
  }

  const isV3 = system === 'tailwind3';
  const imports = new Set<string>();
  const ctx: FormRenderCtx = { system, look, uiKit: input.uiKit, imports };
  const items = input.fields.map((f) => renderTailwindField(f, ctx)).join('\n');
  const formCls = resolveTw(
    'flex flex-col gap-4 p-5 bg-{surface} border border-{border} rounded-{radius} {shadow}',
    look,
    isV3,
  );
  const useBtn = input.uiKit !== undefined && hasUiComp(input.uiKit, 'button');
  if (useBtn) imports.add(`import { Button } from '${input.uiKit.importBase}/button';`);
  const btnCls = resolveTw(
    'self-start px-4 py-2 bg-{primary} text-{on-primary} rounded-{radius} font-medium',
    look,
    isV3,
  );
  const submitBtn = useBtn
    ? `<Button type="submit" className="${btnCls}">${submitLabel}</Button>`
    : `<button type="submit" className="${btnCls}">${submitLabel}</button>`;
  const jsx = `<form className="${formCls}">\n  <div className="flex flex-wrap gap-4">\n${items}\n  </div>\n  ${submitBtn}\n</form>`;
  return { jsx, rules: [], imports: [...imports], usedUiKit: imports.size > 0 };
}

function sampleCellValue(field: DataField, rowIdx: number): string | number | boolean {
  const n = rowIdx + 1;
  if (field.type === 'select' && field.options !== undefined && field.options.length > 0) {
    return field.options[rowIdx % field.options.length] ?? field.options[0] ?? '';
  }
  if (field.type === 'boolean') return rowIdx % 2 === 0;
  if (field.type === 'number') return 100 + rowIdx * 25;
  if (field.type === 'email') return `user${String(n)}@example.com`;
  if (field.type === 'url') return `https://example.com/${String(n)}`;
  if (field.type === 'date') return `2026-01-0${String(n)}`;
  if (field.type === 'datetime') return `2026-01-0${String(n)}T09:00`;
  return `${field.label} ${String(n)}`;
}

/** Builds `count` deterministic sample rows typed to match each `DataField` (TK-34). */
export function buildSampleRowsForFields(
  fields: readonly DataField[],
  count = 5,
): readonly DataArrayRow[] {
  const rows: DataArrayRow[] = [];
  for (let i = 0; i < count; i++) {
    const row: Record<string, string | number | boolean> = { id: String(i + 1) };
    for (const f of fields) {
      row[f.name] = sampleCellValue(f, i);
    }
    rows.push(row);
  }
  return rows;
}

export type GenerateTableInput = {
  readonly fields: readonly DataField[];
  readonly sourceName: string;
  readonly system?: StyleSystemId | undefined;
  readonly lang?: 'vi' | 'en' | undefined;
  readonly look?: ProjectLook | undefined;
  readonly exportName?: string | undefined;
  readonly dataImportPath?: string | undefined;
};

export type GeneratedTableBundle = {
  readonly rendered: RenderedBlock;
  readonly exportName: string;
  readonly fileBaseName: string;
  readonly dataRows: readonly DataArrayRow[];
};

function normalizeExportBase(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9]+/g, '');
  if (cleaned.length === 0) return 'itemsData';
  return `${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}Data`;
}

function normalizeFileBase(name: string): string {
  const kebab = name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return kebab.length > 0 ? kebab : 'items';
}

function buildTableRenderedBlock(
  system: StyleSystemId | undefined,
  look: ProjectLook,
  tableTag: string,
  imports: readonly string[],
): RenderedBlock {
  if (system === 'bootstrap5') {
    return {
      jsx: `<div className="card p-3">\n  ${tableTag}\n</div>`,
      rules: [],
      imports,
      kit: { components: ['DataTable'] },
    };
  }
  if (system !== undefined && CSS_SYSTEMS.has(system)) {
    const decl = resolveCssRoles(
      {
        padding: '16px',
        'background-color': '{surface}',
        border: '1px solid {border}',
        'border-radius': '{radius}',
      },
      look,
    );
    return {
      jsx: `<div className="kc-data-table">\n  ${tableTag}\n</div>`,
      rules: [{ selector: '.kc-data-table', declarations: decl }],
      imports,
      kit: { components: ['DataTable'] },
    };
  }
  const wrapCls = resolveTw(
    'p-4 bg-{surface} border border-{border} rounded-{radius} {shadow}',
    look,
    system === 'tailwind3',
  );
  return {
    jsx: `<div className="${wrapCls}">\n  ${tableTag}\n</div>`,
    rules: [],
    imports,
    kit: { components: ['DataTable'] },
  };
}

/** Generates a DataTable block + sample rows array definition from DataField metadata (TK-34). */
export function generateTableFromFields(input: GenerateTableInput): GeneratedTableBundle {
  const lang = input.lang ?? 'vi';
  const look = input.look ?? EMPTY_LOOK;
  const exportName = input.exportName ?? normalizeExportBase(input.sourceName);
  const fileBaseName = normalizeFileBase(input.sourceName);
  const dataImportPath = input.dataImportPath ?? `./kumicraft/data/${fileBaseName}.data`;
  const dataRows = buildSampleRowsForFields(input.fields, 5);
  const colsCode = input.fields
    .map((f) => `{ key: ${JSON.stringify(f.name)}, label: ${JSON.stringify(f.label)} }`)
    .join(', ');
  const searchPh = lang === 'vi' ? 'Tìm kiếm...' : 'Search...';
  const tableTag = `<DataTable data={${exportName}} columns={[${colsCode}]} searchPlaceholder="${searchPh}" emptyMessage="Chưa có dữ liệu" />`;
  const imports = [`import { ${exportName} } from '${dataImportPath}';`];

  return {
    exportName,
    fileBaseName,
    dataRows,
    rendered: buildTableRenderedBlock(input.system, look, tableTag, imports),
  };
}
