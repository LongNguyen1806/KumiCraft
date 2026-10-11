// Entry points of document validation (SPEC-07 WP-1.01): every V-xx rule that needs more than one
// node, on top of what the Zod schemas already check.
import type { z } from 'zod';

import { err, type ErrorDetail, ok, type Result } from '../../result.ts';
import { type DesignDocument, DesignDocumentSchema } from '../document.schema.ts';
import { buildIndex, type ValidateOptions } from './context.ts';
import { checkData } from './rules-data.ts';
import { checkInteractions } from './rules-interactions.ts';
import { checkReferences } from './rules-references.ts';
import { checkStructure } from './rules-structure.ts';

export type { ValidateOptions } from './context.ts';

/**
 * Checks the rules that span nodes, trees or files of a document that already passed
 * {@link DesignDocumentSchema}.
 *
 * @returns Every violation found, each with its rule code and the path to the offending value.
 *   Empty when the document is valid.
 */
export function validateDocument(
  document: DesignDocument,
  options: ValidateOptions = {},
): readonly ErrorDetail[] {
  const details: ErrorDetail[] = [];
  const report = (detail: ErrorDetail) => {
    details.push(detail);
  };
  const index = buildIndex(document, options);
  checkReferences(index, report);
  checkStructure(index, report);
  checkData(index, report);
  checkInteractions(index, report);
  return details;
}

/** Turns Zod issues into error details that keep the rule code of each issue. */
export function issuesToDetails(issues: readonly z.core.$ZodIssue[]): ErrorDetail[] {
  return issues.map((issue) => {
    const rule = (issue as { params?: { rule?: unknown } }).params?.rule;
    return {
      path: issue.path.map(String).join('.'),
      message: issue.message,
      ...(typeof rule === 'string' ? { rule } : {}),
    };
  });
}

/**
 * Parses and fully validates a document read from disk.
 *
 * @returns The document, or E004 (Design Model Schema Error) with every violation in `details`.
 */
export function checkDocument(
  input: unknown,
  options: ValidateOptions = {},
): Result<DesignDocument> {
  const parsed = DesignDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return err({ code: 'E004', details: issuesToDetails(parsed.error.issues) });
  }
  const details = validateDocument(parsed.data, options);
  return details.length === 0 ? ok(parsed.data) : err({ code: 'E004', details });
}
