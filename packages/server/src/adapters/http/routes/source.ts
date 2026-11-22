// Source Editor HTTP endpoints (SPEC-03 section 5.5, SPEC-04 section 6).
import type {
  AttributeLevelEdit,
  HistoryLabel,
  StructureEdit,
  StylingReport,
} from '@kumicraft/shared';
import {
  BatchEditRequestSchema,
  EditRequestSchema,
  InteractionActionSchema,
  issuesToDetails,
  ok,
  PAGE_TREE_MAX_DEPTH,
  RevealRequestSchema,
} from '@kumicraft/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { ClassEditResolver, SourceEditorService } from '../../../kernel/editing.ts';
import type { ViewFeatures } from '../../../kernel/features.ts';
import type { HistoryService } from '../../../kernel/history/history-service.ts';
import type { FileSystemPort } from '../../../ports/file-system-port.ts';
import { sendError } from '../send-error.ts';
import { VIEW_ONLY } from '../view-features.ts';

export type SourceRoutesDeps = {
  readonly sourceEditorService: SourceEditorService;
  /** Class edits sent as intents become the classes they write (03 section 4). */
  readonly classEdits: ClassEditResolver;
  readonly historyService: HistoryService;
  readonly getProjectRoot: () => string | undefined;
  readonly getStyling?: (() => StylingReport | undefined) | undefined;
  readonly getSourceDir?: (() => string | undefined) | undefined;
  readonly fs: FileSystemPort;
  /** Tools of the open project's view language (03 section 3.2). */
  readonly getViewFeatures: () => ViewFeatures | undefined;
};

const VIEW_ONLY_RESULT = { ok: false, error: VIEW_ONLY } as const;
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

function buildStructureHistoryLabel(
  edit: StructureEdit,
  features: ViewFeatures | undefined,
): HistoryLabel {
  if (edit.kind === 'insert') {
    const jsxRes = features?.validateInsertedMarkup(edit.jsx) ?? VIEW_ONLY_RESULT;
    const fallbackTag =
      edit.target.kind === 'sibling' ? edit.target.ref.tag : edit.target.parent.tag;
    const tag = jsxRes.ok ? jsxRes.value.firstTag : fallbackTag;
    return { key: 'history:insert', params: { tag, count: '1' } };
  }
  if (edit.kind === 'insertImage') {
    const name =
      edit.image.kind === 'upload' ? edit.image.name : (edit.image.src.split('/').pop() ?? 'image');
    return { key: 'history:insertImage', params: { name } };
  }
  if (edit.kind === 'unwrap') {
    return {
      key: 'history:unwrap',
      params: { tag: edit.element.tag, count: '1' },
    };
  }
  if (edit.kind === 'wrapText' || edit.kind === 'replaceSvg') {
    return {
      key: `history:${edit.kind}`,
      params: { tag: edit.tag },
    };
  }
  if (edit.kind === 'setDataArray') {
    return {
      key: 'history:setDataArray',
      params: { name: edit.exportName },
    };
  }
  const tag = edit.elements[0]?.tag ?? 'div';
  return {
    key: `history:${edit.kind}`,
    params: { tag, count: String(edit.elements.length) },
  };
}

const TreeQuerySchema = z.strictObject({
  file: z.string().min(1).max(1024),
  maxDepth: z.coerce.number().int().min(1).max(PAGE_TREE_MAX_DEPTH).optional(),
});

/** GET /source/tree: element tree of one JSX file for external AI agents (R-AG-19). */
async function handleGetPageTree(
  deps: SourceRoutesDeps,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const projectRoot = deps.getProjectRoot();
  if (!projectRoot) return sendError(reply, NO_PROJECT);
  const query = TreeQuerySchema.safeParse(request.query);
  if (!query.success) {
    return sendError(reply, { code: 'E016', details: issuesToDetails(query.error.issues) });
  }
  const result = await deps.sourceEditorService.getPageTree(
    projectRoot,
    query.data.file,
    query.data.maxDepth,
  );
  if (!result.ok) return sendError(reply, result.error);
  return reply.status(200).send({ data: result.value });
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
    edit.kind === 'insertImage' ||
    edit.kind === 'remove' ||
    edit.kind === 'duplicate' ||
    edit.kind === 'move' ||
    edit.kind === 'wrap' ||
    edit.kind === 'unwrap' ||
    edit.kind === 'wrapText' ||
    edit.kind === 'replaceSvg' ||
    edit.kind === 'setDataArray'
  ) {
    const label = buildStructureHistoryLabel(edit, deps.getViewFeatures());
    const edited = await deps.sourceEditorService.applyStructureEdit(projectRoot, edit, (files) => {
      for (const f of files) {
        deps.historyService.recordInternalWrite(f.path, f.afterHash);
      }
      deps.historyService.push({ label, coalesceKey, files });
    });
    if (!edited.ok) return sendError(reply, edited.error);
    return reply.status(200).send({ data: edited.value });
  }

  const resolved = edit.kind === 'setClasses' ? await deps.classEdits.resolve(edit) : ok(edit);
  if (!resolved.ok) return sendError(reply, resolved.error);
  const sourceEdit = resolved.value;
  const label: HistoryLabel = {
    key: `history:${sourceEdit.kind}`,
    params: { tag: sourceEdit.tag },
  };
  const edited = await deps.sourceEditorService.applyEdit(projectRoot, sourceEdit, (file) => {
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

  const { coalesceKey } = parsed.data;
  const edits: AttributeLevelEdit[] = [];
  for (const edit of parsed.data.edits) {
    const resolved = edit.kind === 'setClasses' ? await deps.classEdits.resolve(edit) : ok(edit);
    if (!resolved.ok) return sendError(reply, resolved.error);
    edits.push(resolved.value);
  }
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

async function handlePostInteraction(
  deps: SourceRoutesDeps,
  req: FastifyRequest,
  rep: FastifyReply,
) {
  const projectRoot = deps.getProjectRoot();
  if (!projectRoot) return sendError(rep, NO_PROJECT);
  const parsed = InteractionActionSchema.safeParse(req.body);
  if (!parsed.success)
    return sendError(rep, { code: 'E016', details: issuesToDetails(parsed.error.issues) });
  const features = deps.getViewFeatures();
  if (!features) return sendError(rep, VIEW_ONLY);
  const result = await features.applyInteraction(
    {
      fs: deps.fs,
      styling: deps.getStyling?.(),
      sourceDir: deps.getSourceDir?.(),
      onWritten: (files, key, tag) => {
        for (const f of files) deps.historyService.recordInternalWrite(f.path, f.afterHash);
        deps.historyService.push({ label: { key, params: { tag } }, files });
      },
    },
    projectRoot,
    parsed.data,
  );
  if (!result.ok) return sendError(rep, result.error);
  return rep.status(200).send({ data: result.value });
}

export function registerSourceRoutes(api: FastifyInstance, deps: SourceRoutesDeps): void {
  api.get('/source/element', (req, rep) => handleGetElement(deps, req, rep));
  api.get('/source/element-text', (req, rep) => handleGetElementText(deps, req, rep));
  api.get('/source/tree', (req, rep) => handleGetPageTree(deps, req, rep));
  api.get('/source/files', async (_req, rep) => {
    const projectRoot = deps.getProjectRoot();
    if (!projectRoot) return sendError(rep, NO_PROJECT);
    const result = await deps.sourceEditorService.listFiles(projectRoot);
    if (!result.ok) return sendError(rep, result.error);
    return rep.status(200).send({ data: result.value });
  });
  api.post('/source/edits', { bodyLimit: 10 * 1024 * 1024 }, (req, rep) =>
    handleApplyEdit(deps, req, rep),
  );
  api.post('/source/edits/batch', (req, rep) => handleApplyBatchEdit(deps, req, rep));
  api.post('/source/reveal', async (req, rep) => {
    const projectRoot = deps.getProjectRoot();
    if (!projectRoot) return sendError(rep, NO_PROJECT);
    const parsed = RevealRequestSchema.safeParse(req.body);
    if (!parsed.success)
      return sendError(rep, { code: 'E016', details: issuesToDetails(parsed.error.issues) });
    const features = deps.getViewFeatures();
    if (!features) return sendError(rep, VIEW_ONLY);
    const result = await features.applyReveal(
      {
        fs: deps.fs,
        onWritten: (files) => {
          for (const f of files) deps.historyService.recordInternalWrite(f.path, f.afterHash);
          const label: HistoryLabel = {
            key: `history:${parsed.data.action === 'wrap' ? 'wrap' : 'unwrap'}`,
            params: { tag: parsed.data.tag },
          };
          deps.historyService.push({ label, files });
        },
      },
      projectRoot,
      parsed.data,
    );
    if (!result.ok) return sendError(rep, result.error);
    return rep.status(200).send({ data: result.value });
  });
  api.post('/source/interaction', (req, rep) => handlePostInteraction(deps, req, rep));
}
