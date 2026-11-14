// Unit tests for data-tools form & table generators and state blocks across 7 systems (TK-33..35).
import { describe, expect, it } from 'vitest';

import type { UiKitReport } from '../project.ts';
import type { DataField } from '../source-data.ts';
import { STYLE_SYSTEM_IDS } from '../style.ts';
import { LIBRARY_BLOCKS } from './blocks.ts';
import { generateFormFromFields, generateTableFromFields } from './data-generators.ts';
import { lookFromTheme } from './project-look.ts';
import { renderBlock } from './render-block.ts';

const SAMPLE_FIELDS: readonly DataField[] = [
  { name: 'fullName', label: 'Full Name', type: 'text', required: true, maxLength: 80 },
  { name: 'email', label: 'Email', type: 'email', required: true },
  { name: 'age', label: 'Age', type: 'number', required: false },
  { name: 'role', label: 'Role', type: 'select', required: true, options: ['admin', 'member'] },
  { name: 'active', label: 'Active', type: 'boolean', required: false },
  { name: 'bio', label: 'Bio', type: 'textarea', required: false },
];

const SHADCN_UI_KIT: UiKitReport = {
  kind: 'shadcn',
  uiDir: 'src/components/ui',
  importBase: '@/components/ui',
  components: ['button', 'input', 'label', 'checkbox', 'textarea'],
};

describe('data form and table generators [TK-33, TK-34, TK-35]', () => {
  it('generates valid form JSX with matching htmlFor/id, required, options and primary button across all 7 systems', () => {
    const look = lookFromTheme(undefined, 'default');
    for (const system of STYLE_SYSTEM_IDS) {
      const out = generateFormFromFields({ fields: SAMPLE_FIELDS, system, lang: 'en', look });
      expect(out.jsx).toContain('<form');
      expect(out.jsx).toContain('htmlFor="field-fullName"');
      expect(out.jsx).toContain('id="field-fullName"');
      expect(out.jsx).toContain('maxLength={80}');
      expect(out.jsx).toContain('type="email"');
      expect(out.jsx).toContain('type="number"');
      expect(out.jsx).toContain('<select id="field-role"');
      expect(out.jsx).toContain('<option value="admin">admin</option>');
      expect(out.jsx).toContain('<textarea id="field-bio"');
      expect(out.jsx).toContain('type="checkbox"');
      expect(out.jsx).not.toMatch(/\{primary\}|\{surface\}|\{border\}/);
      if (system === 'css' || system === 'cssModules' || system === 'sass' || system === 'less') {
        expect(out.rules.length).toBeGreaterThan(0);
      }
    }
  });

  it('uses shadcn Input, Label, Checkbox, Textarea, Button when project uiKit is present', () => {
    const out = generateFormFromFields({
      fields: SAMPLE_FIELDS,
      system: 'tailwind4',
      lang: 'vi',
      uiKit: SHADCN_UI_KIT,
    });
    expect(out.usedUiKit).toBe(true);
    expect(out.jsx).toContain('<Input ');
    expect(out.jsx).toContain('<Label ');
    expect(out.jsx).toContain('<Checkbox ');
    expect(out.jsx).toContain('<Textarea ');
    expect(out.jsx).toContain('<Button ');
    expect(out.imports).toContain("import { Input } from '@/components/ui/input';");
    expect(out.imports).toContain("import { Label } from '@/components/ui/label';");
    expect(out.imports).toContain("import { Button } from '@/components/ui/button';");
  });

  it('generates DataTable block + 5 typed sample rows across all 7 style systems', () => {
    for (const system of STYLE_SYSTEM_IDS) {
      const bundle = generateTableFromFields({
        fields: SAMPLE_FIELDS,
        sourceName: 'User',
        system,
        lang: 'vi',
      });
      expect(bundle.dataRows).toHaveLength(5);
      expect(bundle.dataRows[0]?.['email']).toBe('user1@example.com');
      expect(bundle.dataRows[0]?.['role']).toBe('admin');
      expect(bundle.rendered.kit?.components).toContain('DataTable');
      expect(bundle.rendered.jsx).toContain('<DataTable ');
      expect(bundle.rendered.jsx).toContain('Chưa có dữ liệu');
    }
  });

  it('renders data.loading, data.empty, data.error, data.states across all 7 systems with motion-safe skeleton', () => {
    const ids = ['data.loading', 'data.empty', 'data.error', 'data.states'] as const;
    for (const id of ids) {
      const block = LIBRARY_BLOCKS.find((b) => b.id === id);
      expect(block).toBeDefined();
      if (block === undefined) continue;
      for (const system of STYLE_SYSTEM_IDS) {
        const rendered = renderBlock(block, system, 'vi');
        expect(rendered.jsx.length).toBeGreaterThan(20);
        if (
          (id === 'data.loading' || id === 'data.states') &&
          (system === 'tailwind3' || system === 'tailwind4')
        ) {
          expect(rendered.jsx).toContain('motion-safe:animate-pulse');
        }
      }
    }
  });
});
