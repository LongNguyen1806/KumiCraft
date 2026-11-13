// 16 library starter blocks (SPEC-04 section 15 M-LB, R-LB-10, R-LB-11, R-LB-12).
import { ADVANCED_BLOCKS } from './blocks-advanced.ts';
import { BASIC_BLOCKS } from './blocks-basic.ts';
import type { LibraryBlock } from './types.ts';

export * from './project-look.ts';
export * from './render-block.ts';
export * from './types.ts';

export const LIBRARY_BLOCKS: readonly LibraryBlock[] = [...BASIC_BLOCKS, ...ADVANCED_BLOCKS];
