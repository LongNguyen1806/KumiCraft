import { type KitComponentId, kitFileNameFor } from '@kumicraft/shared';

import { buildCarouselTemplate } from './carousel.ts';
import { buildDataTableTemplate } from './data-table.ts';
import { buildDropdownTemplate, buildTooltipTemplate } from './dropdown-tooltip.ts';
import { buildLoadingButtonTemplate } from './loading-button.ts';
import { buildMobileMenuTemplate } from './mobile-menu.ts';
import { buildDrawerTemplate, buildModalTemplate } from './modal-drawer.ts';
import { buildRevealTemplate } from './reveal.ts';
import { buildScrollSpyTemplate } from './scroll-spy.ts';
import { buildSelectGroupTemplate } from './select-group.ts';
import { buildTabsTemplate } from './tabs.ts';
import { buildChoiceTemplate, buildToggleTemplate } from './toggle-choice.ts';

export type KitFilePlan = {
  readonly fileBase: string;
  readonly exportedSymbols: readonly KitComponentId[];
  readonly buildCode: (typescript: boolean) => string;
};

const KIT_FILE_SPECS: Readonly<Record<string, Omit<KitFilePlan, 'fileBase'>>> = {
  Reveal: { exportedSymbols: ['Reveal'], buildCode: buildRevealTemplate },
  Tabs: { exportedSymbols: ['Tabs', 'Tab'], buildCode: buildTabsTemplate },
  Toggle: { exportedSymbols: ['Toggle'], buildCode: buildToggleTemplate },
  Choice: { exportedSymbols: ['Choice'], buildCode: buildChoiceTemplate },
  Carousel: { exportedSymbols: ['Carousel'], buildCode: buildCarouselTemplate },
  Modal: { exportedSymbols: ['Modal'], buildCode: buildModalTemplate },
  Drawer: { exportedSymbols: ['Drawer'], buildCode: buildDrawerTemplate },
  Dropdown: { exportedSymbols: ['Dropdown'], buildCode: buildDropdownTemplate },
  Tooltip: { exportedSymbols: ['Tooltip'], buildCode: buildTooltipTemplate },
  MobileMenu: { exportedSymbols: ['MobileMenu'], buildCode: buildMobileMenuTemplate },
  DataTable: { exportedSymbols: ['DataTable'], buildCode: buildDataTableTemplate },
  SelectGroup: {
    exportedSymbols: ['SelectGroup', 'SelectItem', 'SelectPanel'],
    buildCode: buildSelectGroupTemplate,
  },
  LoadingButton: { exportedSymbols: ['LoadingButton'], buildCode: buildLoadingButtonTemplate },
  ScrollSpy: { exportedSymbols: ['ScrollSpy'], buildCode: buildScrollSpyTemplate },
};

export function kitFileNames(): readonly string[] {
  return Object.keys(KIT_FILE_SPECS);
}

export function buildKitTemplateCode(fileBase: string, typescript: boolean): string | undefined {
  return KIT_FILE_SPECS[fileBase]?.buildCode(typescript);
}

export function groupKitComponentsByFile(
  components: readonly KitComponentId[],
): readonly KitFilePlan[] {
  const byFile = new Map<string, Set<KitComponentId>>();
  for (const symbol of components) {
    const fileBase = kitFileNameFor(symbol);
    const set = byFile.get(fileBase) ?? new Set<KitComponentId>();
    set.add(symbol);
    byFile.set(fileBase, set);
  }
  const plans: KitFilePlan[] = [];
  for (const [fileBase, symbols] of byFile) {
    const spec = KIT_FILE_SPECS[fileBase];
    if (spec === undefined) continue;
    plans.push({
      fileBase,
      exportedSymbols: [...symbols],
      buildCode: spec.buildCode,
    });
  }
  return plans;
}
