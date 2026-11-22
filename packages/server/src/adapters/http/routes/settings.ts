// User settings endpoints (SPEC-03 section 5.2). There is no API key to store or return (V-108).
import { issuesToDetails } from '@kumicraft/shared';
import type { FastifyInstance } from 'fastify';

import { type ConfigStore, SettingsPatchSchema } from '../../../services/config/user-config.ts';
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
