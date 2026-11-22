// Next.js as a preset of the axes (ADR-A1, 03b section 1): runtime `next`, view `jsx`, and pages
// that are files in `app/` and `pages/`.
import type { PagesProvider } from '../../../kernel/stacks.ts';
import { readNextPages } from './pages-read.ts';
import { addNextPage, deleteNextPage, renameNextPage } from './pages-write.ts';

export const nextPages: PagesProvider = {
  read: readNextPages,
  add: addNextPage,
  rename: renameNextPage,
  remove: deleteNextPage,
};
