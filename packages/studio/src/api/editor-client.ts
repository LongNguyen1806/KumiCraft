// POST /open-in-editor (SPEC-03 section 5.1): the server starts the editor chosen in Settings.
import { apiPost } from './http.ts';

/** Opens `file:line:column` of the project in the user's editor (R-SL-06). */
export async function openInEditor(loc: string): Promise<void> {
  await apiPost('open-in-editor', { loc });
}
