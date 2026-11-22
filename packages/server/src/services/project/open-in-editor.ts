// "Open in editor" (SPEC-03 section 5.1, R-SL-06): starts the editor chosen in Settings at the file
// and position of an element. The command is a fixed argument array, never a shell (S-50, S-51).
import { parseLocString, relPathProblem } from '@kumicraft/shared';

import { err, ok, type Result } from '../../kernel/result.ts';
import type { Platform } from '../../kernel/session.ts';
import type { FileSystemPort } from '../../ports/file-system-port.ts';
import type { ProcessPort } from '../../ports/process-port.ts';
import type { Settings } from '../config/user-config.ts';

export type Editor = Settings['editor'];

/** How long a missing command takes to fail; an editor CLI that is found keeps running or exits 0. */
const SPAWN_CHECK_MS = 1500;
/** Exit code the process adapter reports when the command cannot be started (not found). */
const NOT_FOUND = 127;

/** The command line of each editor (SPEC-03 section 5.2). */
export function editorCommand(
  editor: Editor,
  file: string,
  line: number,
  column: number,
): { readonly command: string; readonly args: readonly string[] } {
  const position = `${file}:${String(line)}:${String(column)}`;
  switch (editor) {
    case 'vscode':
      return { command: 'code', args: ['-g', position] };
    case 'cursor':
      return { command: 'cursor', args: ['-g', position] };
    case 'webstorm':
      return {
        command: 'webstorm',
        args: ['--line', String(line), '--column', String(column), file],
      };
    case 'zed':
      return { command: 'zed', args: [position] };
  }
}

export type OpenInEditorDeps = {
  readonly fs: FileSystemPort;
  readonly process: ProcessPort;
  readonly platform: Platform;
  readonly editor: () => Editor;
};

const joinPath = (root: string, rel: string, platform: Platform): string => {
  const joined = `${root.replace(/[\\/]+$/, '')}/${rel}`;
  return platform === 'win32' ? joined.replaceAll('/', '\\') : joined;
};

export async function openInEditor(
  deps: OpenInEditorDeps,
  projectRoot: string,
  loc: string,
): Promise<Result<void>> {
  const parsed = parseLocString(loc);
  if (parsed === undefined) return err({ code: 'E016', params: { field: 'loc' } });
  const problem = relPathProblem(parsed.file);
  if (problem !== undefined)
    return err({ code: 'E016', params: { field: 'loc', reason: problem } });
  if (!(await deps.fs.exists(projectRoot, parsed.file))) {
    return err({ code: 'E015', params: { resource: 'file', id: parsed.file } });
  }

  const editor = deps.editor();
  const file = joinPath(projectRoot, parsed.file, deps.platform);
  const { command, args } = editorCommand(editor, file, parsed.line, parsed.column);
  const handle = deps.process.spawn(command, args, { cwd: projectRoot });
  const outcome = await Promise.race([
    handle.wait(),
    new Promise<undefined>((resolve) => {
      setTimeout(() => {
        resolve(undefined);
      }, SPAWN_CHECK_MS);
    }),
  ]);
  if (outcome?.exitCode === NOT_FOUND) {
    return err({ code: 'E021', params: { missing: 'editor', editor } });
  }
  return ok(undefined);
}
