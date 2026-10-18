// Source Editor HTTP endpoints (SPEC-03 section 5.5, SPEC-04 section 6).
import type { HistoryLabel, StructureEdit } from '@reactcraft/shared';
import { BatchEditRequestSchema, EditRequestSchema, issuesToDetails } from '@reactcraft/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { HistoryService } from '../../../core/history/history-service.ts';
import type { FileSystemPort } from '../../../core/ports/file-system-port.ts';
import type { SourceEditorService } from '../../../core/source-editor/source-editor-service.ts';
import { validateInsertedJsx } from '../../../core/source-editor/structure/structure-ops.ts';
import { sendError } from '../send-error.ts';

export type SourceRoutesDeps = {
  readonly sourceEditorService: SourceEditorService;
  readonly historyService: HistoryService;
  readonly getProjectRoot: () => string | undefined;
  readonly fs: FileSystemPort;
};

const NO_PROJECT = { code: 'E021', params: { missing: 'project' } } as const;

async function handleGetElement(
  deps: SourceRoutesDeps,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const projectRoot = deps.getProjectRoot();
  if (!projectRoot) return sendError(reply, NO_PROJECT);

  const { loc } = request.query as { loc?: unknown };
  if (typeof loc !== 'string' || loc === '') {
    return sendError(reply, { code: 'E016', params: { field: 'loc' } });
  }

  const result = await deps.sourceEditorService.getElement(projectRoot, loc);
  if (!result.ok) return sendError(reply, result.error);
  return reply.status(200).send({ data: result.value });
}

function buildStructureHistoryLabel(edit: StructureEdit): HistoryLabel {
  if (edit.kind === 'insert') {
    const jsxRes = validateInsertedJsx(edit.jsx);
    const fallbackTag =
      edit.target.kind === 'sibling' ? edit.target.ref.tag : edit.target.parent.tag;
    const tag = jsxRes.ok ? jsxRes.value.firstTag : fallbackTag;
    return { key: 'history:insert', params: { tag, count: '1' } };
  }
  if (edit.kind === 'unwrap') {
    return {
      key: 'history:unwrap',
      params: { tag: edit.element.tag, count: '1' },
    };
  }
  const tag = edit.elements[0]?.tag ?? 'div';
  return {
    key: `history:${edit.kind}`,
    params: { tag, count: String(edit.elements.length) },
  };
}

async function handleGetElementText(
  deps: SourceRoutesDeps,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const projectRoot = deps.getProjectRoot();
  if (!projectRoot) return sendError(reply, NO_PROJECT);

  const { loc } = request.query as { loc?: unknown };
  if (typeof loc !== 'string' || loc === '') {
    return sendError(reply, { code: 'E016', params: { field: 'loc' } });
  }

  const result = await deps.sourceEditorService.getElementText(projectRoot, loc);
  if (!result.ok) return sendError(reply, result.error);
  return reply.status(200).send({ data: result.value });
}

/**
 * One edit, recorded in the history from inside the queue of the file (R-SE-13, R-HI-01): the
 * entry holds exactly the bytes this edit replaced, even when edits of the same file overlap.
 */
async function handleApplyEdit(
  deps: SourceRoutesDeps,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const projectRoot = deps.getProjectRoot();
  if (!projectRoot) return sendError(reply, NO_PROJECT);

  const parsed = EditRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return sendError(reply, { code: 'E016', details: issuesToDetails(parsed.error.issues) });
  }

  const { edit, coalesceKey } = parsed.data;
  if (
    edit.kind === 'insert' ||
    edit.kind === 'remove' ||
    edit.kind === 'duplicate' ||
    edit.kind === 'move' ||
    edit.kind === 'wrap' ||
    edit.kind === 'unwrap'
  ) {
    const label = buildStructureHistoryLabel(edit);
    const edited = await deps.sourceEditorService.applyStructureEdit(projectRoot, edit, (files) => {
      deps.historyService.push({ label, coalesceKey, files });
    });
    if (!edited.ok) return sendError(reply, edited.error);
    return reply.status(200).send({ data: edited.value });
  }

  const label: HistoryLabel = { key: `history:${edit.kind}`, params: { tag: edit.tag } };
  const edited = await deps.sourceEditorService.applyEdit(projectRoot, edit, (file) => {
    deps.historyService.push({ label, coalesceKey, files: [file] });
  });
  if (!edited.ok) return sendError(reply, edited.error);
  return reply.status(200).send({ data: edited.value });
}

async function handleApplyBatchEdit(
  deps: SourceRoutesDeps,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const projectRoot = deps.getProjectRoot();
  if (!projectRoot) return sendError(reply, NO_PROJECT);

  const parsed = BatchEditRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return sendError(reply, { code: 'E016', details: issuesToDetails(parsed.error.issues) });
  }

  const { edits, coalesceKey } = parsed.data;
  const label: HistoryLabel = {
    key: 'history:batch',
    params: { count: String(edits.length) },
  };

  const edited = await deps.sourceEditorService.applyEditBatch(projectRoot, edits, (files) => {
    deps.historyService.push({ label, coalesceKey, files });
  });
  if (!edited.ok) return sendError(reply, edited.error);
  return reply.status(200).send({ data: edited.value });
}

export function registerSourceRoutes(api: FastifyInstance, deps: SourceRoutesDeps): void {
  api.get('/source/element', (req, rep) => handleGetElement(deps, req, rep));
  api.get('/source/element-text', (req, rep) => handleGetElementText(deps, req, rep));
  api.post('/source/edits', (req, rep) => handleApplyEdit(deps, req, rep));
  api.post('/source/edits/batch', (req, rep) => handleApplyBatchEdit(deps, req, rep));
}
