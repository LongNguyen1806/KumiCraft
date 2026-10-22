// Unit tests for agent setup plans and terminal commands (WP-3.06b, Situations 1, 2, 3).
import { describe, expect, it } from 'vitest';

import { agentSetupPlans, terminalCommand } from './agent-setup-plans.ts';

describe('agentSetupPlans [R-AG-21]', () => {
  it('1 [R-AG-21] resolves win32 install command and fallback path from LOCALAPPDATA', () => {
    const plans = agentSetupPlans({
      platform: 'win32',
      env: {
        LOCALAPPDATA: 'C:\\Users\\A\\AppData\\Local',
        USERPROFILE: 'C:\\Users\\A',
      },
      homeDir: 'C:\\Users\\A',
    });

    expect(plans.agy?.installCommand).toEqual([
      'powershell.exe',
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'irm https://antigravity.google/cli/install.ps1 | iex',
    ]);
    expect(plans.agy?.fallbackCommand).toBe('C:\\Users\\A\\AppData\\Local\\agy\\bin\\agy.exe');
    expect(plans.agy?.docsUrl).toBe(
      'https://codelabs.developers.google.com/antigravity-cli-hands-on',
    );

    expect(plans.claude?.fallbackCommand).toBe('C:\\Users\\A\\.local\\bin\\claude.exe');
  });

  it('2 [R-AG-21] handles linux, win32 with missing LOCALAPPDATA, and unsupported platforms (aix)', () => {
    const linuxPlans = agentSetupPlans({
      platform: 'linux',
      env: {},
      homeDir: '/home/alice',
    });
    expect(linuxPlans.agy?.installCommand).toEqual([
      'bash',
      '-c',
      'curl -fsSL https://antigravity.google/cli/install.sh | bash',
    ]);
    expect(linuxPlans.agy?.fallbackCommand).toBe('/home/alice/.local/bin/agy');

    const winMissingEnv = agentSetupPlans({
      platform: 'win32',
      env: {},
      homeDir: 'C:\\Users\\A',
    });
    expect(winMissingEnv.agy?.fallbackCommand).toBeUndefined();
    expect(winMissingEnv.claude?.fallbackCommand).toBeUndefined();

    const aixPlans = agentSetupPlans({
      platform: 'aix',
      env: {},
      homeDir: '/home/alice',
    });
    expect(aixPlans).toEqual({});
  });
});

describe('terminalCommand [R-AG-21]', () => {
  it('3 [R-AG-21] formats terminal command correctly for win32, darwin, linux, and returns undefined for aix', () => {
    const winCmd = terminalCommand(
      { platform: 'win32', env: {}, homeDir: 'C:\\Users\\A' },
      "C:\\Users\\O'Neil\\agy.exe",
    );
    expect(winCmd).toEqual([
      'powershell.exe',
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "Start-Process -FilePath 'C:\\Users\\O''Neil\\agy.exe'",
    ]);

    const darwinCmd = terminalCommand(
      { platform: 'darwin', env: {}, homeDir: '/Users/a b' },
      '/Users/a b/.local/bin/agy',
    );
    expect(darwinCmd).toEqual([
      'osascript',
      '-e',
      'tell application "Terminal" to do script "\'/Users/a b/.local/bin/agy\'"',
    ]);

    const linuxCmd = terminalCommand(
      { platform: 'linux', env: {}, homeDir: '/home/alice' },
      '/usr/local/bin/agy',
    );
    expect(linuxCmd).toEqual(['x-terminal-emulator', '-e', '/usr/local/bin/agy']);

    const aixCmd = terminalCommand(
      { platform: 'aix', env: {}, homeDir: '/home/alice' },
      '/usr/bin/agy',
    );
    expect(aixCmd).toBeUndefined();
  });
});
