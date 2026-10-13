// Form presets (SPEC-04.1 section 10.2).
import type { DesignNode } from '../schema/node.schema.ts';
import type { Preset, PresetContext } from './types.ts';

const isVi = (locale?: string) => locale?.startsWith('vi') === true;

function createForm(ctx?: PresetContext): DesignNode {
  const vi = isVi(ctx?.contentLocale);
  return {
    id: 'tmp_1',
    type: 'Form',
    content: { kind: 'none' },
    style: { direction: 'column', gap: 'token:spacing.4' },
    children: [
      {
        id: 'tmp_2',
        type: 'Input',
        content: {
          kind: 'input',
          inputType: 'text',
          label: vi ? 'Tên trường' : 'Field label',
          fieldName: 'field_name',
        },
      },
      {
        id: 'tmp_3',
        type: 'Button',
        content: {
          kind: 'button',
          buttonType: 'submit',
          variant: 'primary',
          text: vi ? 'Gửi' : 'Submit',
        },
      },
    ],
  };
}

function createInput(ctx?: PresetContext): DesignNode {
  const vi = isVi(ctx?.contentLocale);
  return {
    id: 'tmp_1',
    type: 'Input',
    content: {
      kind: 'input',
      inputType: 'text',
      label: vi ? 'Tên trường' : 'Field label',
      fieldName: 'field_name',
    },
  };
}

function createTextarea(ctx?: PresetContext): DesignNode {
  const vi = isVi(ctx?.contentLocale);
  return {
    id: 'tmp_1',
    type: 'Textarea',
    content: {
      kind: 'textarea',
      label: vi ? 'Nội dung' : 'Content',
      fieldName: 'content',
      rows: 4,
    },
  };
}

function createSelect(ctx?: PresetContext): DesignNode {
  const vi = isVi(ctx?.contentLocale);
  return {
    id: 'tmp_1',
    type: 'Select',
    content: {
      kind: 'select',
      label: vi ? 'Chọn' : 'Select',
      fieldName: 'select_field',
      options: [
        { value: 'opt1', label: vi ? 'Lựa chọn 1' : 'Option 1' },
        { value: 'opt2', label: vi ? 'Lựa chọn 2' : 'Option 2' },
      ],
    },
  };
}

function createChoice(type: 'Checkbox' | 'Radio' | 'Switch', ctx?: PresetContext): DesignNode {
  const vi = isVi(ctx?.contentLocale);
  const defaultLabel =
    type === 'Switch' ? (vi ? 'Bật / Tắt' : 'Toggle') : vi ? 'Lựa chọn' : 'Option';
  return {
    id: 'tmp_1',
    type,
    content: {
      kind: 'choice',
      label: defaultLabel,
      fieldName: `${type.toLowerCase()}_field`,
    },
  };
}

function createButton(ctx?: PresetContext): DesignNode {
  const vi = isVi(ctx?.contentLocale);
  return {
    id: 'tmp_1',
    type: 'Button',
    content: { kind: 'button', variant: 'primary', text: vi ? 'Nút' : 'Button' },
    style: {
      padding: {
        top: 'token:spacing.2',
        bottom: 'token:spacing.2',
        left: 'token:spacing.4',
        right: 'token:spacing.4',
      },
      radius: 'token:radius.md',
    },
  };
}

export const FORM_PRESETS: readonly Preset[] = [
  {
    id: 'form.form',
    category: 'form',
    labelKey: 'presets.form',
    icon: 'FormInput',
    create: createForm,
  },
  {
    id: 'form.input',
    category: 'form',
    labelKey: 'presets.input',
    icon: 'TextCursorInput',
    create: createInput,
  },
  {
    id: 'form.textarea',
    category: 'form',
    labelKey: 'presets.textarea',
    icon: 'AlignLeft',
    create: createTextarea,
  },
  {
    id: 'form.select',
    category: 'form',
    labelKey: 'presets.select',
    icon: 'ChevronDownSquare',
    create: createSelect,
  },
  {
    id: 'form.checkbox',
    category: 'form',
    labelKey: 'presets.checkbox',
    icon: 'CheckSquare',
    create: (c) => createChoice('Checkbox', c),
  },
  {
    id: 'form.radio',
    category: 'form',
    labelKey: 'presets.radio',
    icon: 'CircleDot',
    create: (c) => createChoice('Radio', c),
  },
  {
    id: 'form.switch',
    category: 'form',
    labelKey: 'presets.switch',
    icon: 'ToggleRight',
    create: (c) => createChoice('Switch', c),
  },
  {
    id: 'form.button',
    category: 'form',
    labelKey: 'presets.button',
    icon: 'SquarePlay',
    create: createButton,
  },
];
