// Helpers every style writer shares: reading and writing the project's style files, the element's class.
import { err, ok, type Result, type StyleApplyRequest } from '@kumicraft/shared';

import type { WrittenFile } from '../../kernel/editing.ts';
import type { StyleApplyDeps } from '../../kernel/features.ts';
import { commitFileChanges } from '../../kernel/file-writer.ts';
import { computeSha256 } from '../../kernel/history/history-file-io.ts';
import type { FileSystemPort } from '../../ports/file-system-port.ts';

const MAX_CSS_BYTES = 2 * 1024 * 1024;

export async function readFile(
  fs: FileSystemPort,
  root: string,
  file: string,
): Promise<Result<string>> {
  return fs.readText(root, file, { maxBytes: MAX_CSS_BYTES });
}

export async function writeFile(
  fs: FileSystemPort,
  root: string,
  file: string,
  before: string | undefined,
  after: string,
): Promise<Result<WrittenFile>> {
  const written = await writeFiles(fs, root, [{ path: file, before, after }]);
  if (!written.ok) return written;
  const [one] = written.value;
  return one === undefined ? err({ code: 'E013', params: { file } }) : ok(one);
}

/** Several files of one style change, written together by the kernel's FileWriter (all or none). */
export async function writeFiles(
  fs: FileSystemPort,
  root: string,
  changes: readonly { readonly path: string; readonly before: string | undefined; after: string }[],
): Promise<Result<WrittenFile[]>> {
  const committed = await commitFileChanges({ fs }, root, changes);
  if (!committed.ok) return committed;
  return ok(
    changes.map((c) => ({
      path: c.path,
      before: c.before,
      after: c.after,
      beforeHash: c.before === undefined ? undefined : computeSha256(c.before),
      afterHash: computeSha256(c.after),
    })),
  );
}

export function mergeWrites(files: readonly WrittenFile[]): WrittenFile[] {
  const byPath = new Map<string, WrittenFile>();
  for (const f of files) {
    const first = byPath.get(f.path);
    byPath.set(
      f.path,
      first === undefined ? f : { ...f, before: first.before, beforeHash: first.beforeHash },
    );
  }
  return [...byPath.values()];
}

export type ElementContext = {
  readonly jsxFile: string;
  /** The tag in the source, not the one the request claims. */
  readonly tag: string;
  readonly classes: readonly string[];
  readonly className: string | undefined;
};

export async function elementContext(
  deps: StyleApplyDeps,
  root: string,
  loc: string,
): Promise<Result<ElementContext>> {
  const element = await deps.sourceEditor.getElement(root, loc);
  if (!element.ok) return element;
  const cls = element.value.className;
  if (
    cls.kind !== 'static' &&
    cls.kind !== 'none' &&
    cls.kind !== 'callStatic' &&
    cls.kind !== 'templateStatic'
  ) {
    return err({ code: 'E016', params: { reason: 'expression' } });
  }
  const className =
    cls.kind === 'static' || cls.kind === 'callStatic' || cls.kind === 'templateStatic'
      ? cls.value
      : undefined;
  return ok({
    jsxFile: loc.split(':')[0] ?? loc,
    tag: element.value.tag,
    classes: (className ?? '').split(/\s+/).filter((c) => c !== ''),
    className,
  });
}

/** Sets `nextClasses` as the element's static `className` (M-SE `setClassName`). */
export async function addClass(
  deps: StyleApplyDeps,
  root: string,
  request: StyleApplyRequest,
  ctx: ElementContext,
  nextClasses: readonly string[],
  writes: WrittenFile[],
): Promise<Result<unknown>> {
  return deps.sourceEditor.applyEdit(
    root,
    {
      kind: 'setClassName',
      loc: request.probe.ref.loc,
      tag: ctx.tag,
      before: ctx.className,
      after: nextClasses.join(' '),
    },
    (file) => {
      writes.push(file);
    },
  );
}
