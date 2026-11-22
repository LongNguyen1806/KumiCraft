// The style stack (docs/architecture/03 section 3.3): reading and writing styles for every view
// language, as one StyleService for the HTTP routes.
import type { StyleService, ThemeTokens } from '../../kernel/features.ts';
import type { CompiledCssPort } from '../../ports/compiled-css-port.ts';
import type { FileSystemPort } from '../../ports/file-system-port.ts';
import { applyStyleChange } from './style-apply.ts';
import { createStyleService } from './style-service.ts';
import { countUsage, editTokens, readTokens } from './tokens/token-service.ts';

export const styleThemeTokens: ThemeTokens = { read: readTokens, edit: editTokens, countUsage };

export function createStyleStack(deps: {
  readonly fs: FileSystemPort;
  readonly compiledCss?: CompiledCssPort | undefined;
}): StyleService {
  const reader = createStyleService(deps);
  return { read: (project, probe) => reader.read(project, probe), apply: applyStyleChange };
}
