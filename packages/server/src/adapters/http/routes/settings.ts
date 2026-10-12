// User settings endpoints (SPEC-03 section 10.2). API keys never appear in a response: Settings
// only says whether each key is configured. The AI key routes come with the `ai` feature.
import { issuesToDetails } from '@reactcraft/model';
import type { FastifyInstance } from 'fastify';

import { type ConfigStore, SettingsPatchSchema } from '../../../core/shared/user-config.ts';
import { sendError } from '../send-error.ts';

export type SettingsRoutesDeps = {
  readonly config: Pick<ConfigStore, 'settings' | 'updateSettings'>;
};

export function registerSettingsRoutes(api: FastifyInstance, deps: SettingsRoutesDeps): void {
  api.get('/settings', () => ({ data: deps.config.settings() }));

  api.patch('/settings', async (request, reply) => {
    const parsed = SettingsPatchSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return sendError(reply, { code: 'E016', details: issuesToDetails(parsed.error.issues) });
    }
    const updated = await deps.config.updateSettings(parsed.data);
    if (!updated.ok) return sendError(reply, updated.error);
    return { data: updated.value };
  });
}
