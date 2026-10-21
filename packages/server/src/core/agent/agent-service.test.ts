// Tests for AgentService (WP-3.03a, R-AG-10, R-QA-12).
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createNodeProcess } from '../../adapters/system/node-process.ts';
import type { Settings } from '../shared/user-config.ts';
import { agyAdapter } from './adapters/agy.ts';
import { claudeAdapter } from './adapters/claude.ts';
import { createAgentService } from './agent-service.ts';

const FAKE_AGENT_PATH = fileURLToPath(
  new URL('../../../test-support/fake-agent.mjs', import.meta.url),
);

function makeSettings(preferred: 'auto' | 'agy' | 'claude'): () => Settings {
  return () => ({
    editor: 'vscode',
    agent: { preferred },
  });
}

describe('AgentService', () => {
  const proc = createNodeProcess();

  it('[R-AG-10, R-QA-12] detects installed and missing agents in parallel, and resolves according to preference', async () => {
    let currentPreferred: 'auto' | 'agy' | 'claude' = 'auto';
    const service = createAgentService({
      process: proc,
      settings: () => makeSettings(currentPreferred)(),
      commands: {
        agy: { command: process.execPath, prefixArgs: [FAKE_AGENT_PATH] },
        claude: { command: 'rc-no-such-agent-xyz', prefixArgs: [] },
      },
      adapters: { agy: agyAdapter, claude: claudeAdapter },
    });

    const statuses = await service.statuses();
    expect(statuses).toEqual([
      { id: 'agy', installed: true, version: '0.0.0-fake', login: 'unknown' },
      { id: 'claude', installed: false, login: 'unknown' },
    ]);

    // auto -> agy
    currentPreferred = 'auto';
    const autoRes = await service.resolve();
    expect(autoRes.ok).toBe(true);
    if (autoRes.ok) {
      expect(autoRes.value.adapter.id).toBe('agy');
      expect(autoRes.value.status.installed).toBe(true);
    }

    // claude -> E026 notInstalled
    currentPreferred = 'claude';
    const claudeRes = await service.resolve();
    expect(claudeRes.ok).toBe(false);
    if (!claudeRes.ok) {
      expect(claudeRes.error.code).toBe('E026');
      expect(claudeRes.error.params).toEqual({
        agent: 'claude',
        reason: 'notInstalled',
      });
    }

    // agy -> agy
    currentPreferred = 'agy';
    const agyRes = await service.resolve();
    expect(agyRes.ok).toBe(true);
    if (agyRes.ok) {
      expect(agyRes.value.adapter.id).toBe('agy');
    }
  });

  it('[R-AG-10] timeout handling marks agent as uninstalled within timeout limit', async () => {
    const startTime = Date.now();
    const service = createAgentService({
      process: proc,
      settings: makeSettings('auto'),
      adapters: { agy: agyAdapter, claude: claudeAdapter },
      commands: {
        agy: {
          command: process.execPath,
          prefixArgs: ['-e', 'setTimeout(() => {}, 10000)', '--'],
        },
        claude: { command: 'rc-no-such-agent-xyz', prefixArgs: [] },
      },
      detectTimeoutMs: 300,
    });

    const statuses = await service.statuses();
    const elapsed = Date.now() - startTime;

    expect(elapsed).toBeLessThan(2000);
    expect(statuses[0]?.installed).toBe(false);
    expect(statuses[0]?.id).toBe('agy');
  });
});
