// Pure formatting functions for styling report labels and tooltips (SPEC-04 Round S1, R-PJ-02).
import type { StylingReport, StylingSystem } from '@kumicraft/shared';
import type { TFunction } from 'i18next';

function parseMajor(version?: string): string | undefined {
  if (!version) return undefined;
  const match = version.replace(/^[~^>=<v\s]+/, '').match(/^(\d+)/);
  return match ? match[1] : undefined;
}

export function systemDisplayName(sys: StylingSystem, t: TFunction): string {
  const major = parseMajor(sys.version);
  switch (sys.id) {
    case 'tailwind':
      return major ? `Tailwind ${major}` : 'Tailwind';
    case 'css':
      return t('styling.css', { defaultValue: 'CSS thường' });
    case 'cssModules':
      return 'CSS Modules';
    case 'bootstrap':
      return major ? `Bootstrap ${major}` : 'Bootstrap';
    case 'sass':
      return 'Sass';
    case 'less':
      return 'Less';
    case 'styledComponents':
      return 'styled-components';
    case 'emotion':
      return 'Emotion';
    case 'mui':
      return 'MUI';
    case 'antd':
      return 'Ant Design';
    case 'chakra':
      return 'Chakra UI';
  }
}

export function systemShortLabel(sys: StylingSystem): string {
  const major = parseMajor(sys.version);
  switch (sys.id) {
    case 'tailwind':
      return major ? `Tailwind ${major}` : 'Tailwind';
    case 'css':
      return 'CSS';
    case 'cssModules':
      return 'CSS Modules';
    case 'bootstrap':
      return major ? `Bootstrap ${major}` : 'Bootstrap';
    case 'sass':
      return 'Sass';
    case 'less':
      return 'Less';
    case 'styledComponents':
      return 'styled-components';
    case 'emotion':
      return 'Emotion';
    case 'mui':
      return 'MUI';
    case 'antd':
      return 'Ant Design';
    case 'chakra':
      return 'Chakra';
  }
}

export function systemsCombinedName(systems: readonly StylingSystem[], t: TFunction): string {
  if (systems.length === 0) return t('styling.none', { defaultValue: 'Không rõ' });
  return systems.map((s) => systemDisplayName(s, t)).join(' + ');
}

export type StylingLabelInfo = {
  readonly shortLabel: string;
  readonly fullDescription: string;
};

export function stylingLabel(report: StylingReport | undefined, t: TFunction): StylingLabelInfo {
  if (report === undefined || report.systems.length === 0) {
    return {
      shortLabel: 'CSS',
      fullDescription: t('project.styleNotEditable', {
        defaultValue: 'Chỉnh kiểu dáng trực quan: chưa hỗ trợ cho hệ này, dùng AI để đổi kiểu dáng',
      }),
    };
  }

  const primarySys = report.systems.find((s) => s.id === report.primary) ?? report.systems[0];
  const shortLabel = primarySys ? systemShortLabel(primarySys) : 'CSS';

  const combined = systemsCombinedName(report.systems, t);
  const editInfo = report.editable
    ? t('project.styleEditable', { defaultValue: 'Chỉnh kiểu dáng trực quan: có' })
    : t('project.styleNotEditable', {
        defaultValue: 'Chỉnh kiểu dáng trực quan: chưa hỗ trợ cho hệ này, dùng AI để đổi kiểu dáng',
      });

  return {
    shortLabel,
    fullDescription: `${combined} · ${editInfo}`,
  };
}
