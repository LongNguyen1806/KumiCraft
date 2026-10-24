// Entry point for page edits (R-PG-11 to R-PG-14).
export { addPage } from './page-add.ts';
export {
  type AddPageInput,
  type DeletePageInput,
  type PageEditDeps,
  type RenamePageInput,
} from './page-common.ts';
export { deletePage } from './page-delete.ts';
export { renamePage } from './page-rename.ts';
export { pageNames, type PageNamesResult } from '@kumicraft/shared';
