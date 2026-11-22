// The tools only the JSX view language has (docs/architecture/03 section 3.2), offered to the HTTP
// routes through `jsxView.features`.
import type { ProjectFeatures, ViewFeatures } from '../../../kernel/features.ts';
import { extractComponent } from './project/component-extract.ts';
import { createPropTypesPort } from './project/component-props.ts';
import { readComponentProps } from './project/component-props-reader.ts';
import { listProjectComponents } from './project/components-list.ts';
import { enableProjectDarkMode } from './project/dark-mode-service.ts';
import { promoteDraft } from './project/draft-promote.ts';
import {
  createDraft,
  deleteDraft,
  duplicateDraft,
  listDrafts,
  renameDraft,
} from './project/drafts.ts';
import { findFileImporters } from './project/file-importers.ts';
import { addPage, deletePage, renamePage } from './project/page-edits.ts';
import { readPages } from './project/pages.ts';
import { writeRouterFiles } from './project/router-install.ts';
import { applyProjectSmoothScroll } from './project/smooth-scroll-service.ts';
import { applyInteractionAction } from './structure/interaction-ops.ts';
import { applyRevealEdit } from './structure/reveal-service.ts';
import { validateInsertedJsx } from './structure/structure-ops.ts';

const jsxProjectFeatures: ProjectFeatures = {
  readPages,
  addPage,
  renamePage,
  deletePage,
  extractComponent,
  createPropTypesPort,
  listDrafts,
  createDraft,
  renameDraft,
  duplicateDraft,
  deleteDraft,
  promoteDraft,
  writeRouterFiles,
};

export const jsxFeatures: ViewFeatures = {
  project: jsxProjectFeatures,
  readComponentProps,
  findFileImporters,
  enableDarkMode: enableProjectDarkMode,
  applySmoothScroll: applyProjectSmoothScroll,
  listComponents: listProjectComponents,
  applyInteraction: applyInteractionAction,
  applyReveal: applyRevealEdit,
  validateInsertedMarkup: validateInsertedJsx,
};
