import { buildRevealComponentCode } from '../reveal-template.ts';

export function buildRevealTemplate(typescript: boolean): string {
  return buildRevealComponentCode(typescript);
}
