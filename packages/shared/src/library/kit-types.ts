import { z } from 'zod';

export const KIT_COMPONENT_IDS = [
  'Reveal',
  'Tabs',
  'Tab',
  'Toggle',
  'Choice',
  'Carousel',
  'Modal',
  'Drawer',
  'Dropdown',
  'Tooltip',
  'MobileMenu',
  'DataTable',
  'SelectGroup',
  'SelectItem',
  'SelectPanel',
  'ToastHost',
  'ToastTrigger',
  'LoadingButton',
  'ScrollSpy',
] as const;

export const KitComponentIdSchema = z.enum(KIT_COMPONENT_IDS);
export type KitComponentId = z.infer<typeof KitComponentIdSchema>;

export type KitBlockSpec = {
  readonly components: readonly KitComponentId[];
};

const KIT_FILE_MAP: Readonly<Record<KitComponentId, string>> = {
  Reveal: 'Reveal',
  Tabs: 'Tabs',
  Tab: 'Tabs',
  Toggle: 'Toggle',
  Choice: 'Choice',
  Carousel: 'Carousel',
  Modal: 'Modal',
  Drawer: 'Drawer',
  Dropdown: 'Dropdown',
  Tooltip: 'Tooltip',
  MobileMenu: 'MobileMenu',
  DataTable: 'DataTable',
  SelectGroup: 'SelectGroup',
  SelectItem: 'SelectGroup',
  SelectPanel: 'SelectGroup',
  ToastHost: 'Toast',
  ToastTrigger: 'Toast',
  LoadingButton: 'LoadingButton',
  ScrollSpy: 'ScrollSpy',
};

export function kitFileNameFor(component: KitComponentId): string {
  return KIT_FILE_MAP[component];
}
