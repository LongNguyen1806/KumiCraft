// Official installation plans and terminal launch commands by platform (WP-3.06b, R-AG-21, S-112).
import path from 'node:path';

import type { AgentId } from '@kumicraft/shared';

export type AgentSetupPlan = {
  readonly installCommand: readonly string[];
  readonly docsUrl: string;
  /** Official installer target location; tested when the command name is not in PATH. */
  readonly fallbackCommand?: string | undefined;
};

export type SetupEnvironment = {
  readonly platform: NodeJS.Platform;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly homeDir: string;
};

const AGY_DOCS_URL = 'https://codelabs.developers.google.com/antigravity-cli-hands-on';
const CLAUDE_DOCS_URL = 'https://docs.claude.com/en/docs/claude-code/setup';

const WIN_POWERSHELL_INSTALL_PREFIX = [
  'powershell.exe',
  '-NoProfile',
  '-NonInteractive',
  '-Command',
] as const;

function resolveWin32Plans(sys: SetupEnvironment): Partial<Record<AgentId, AgentSetupPlan>> {
  const localAppData = sys.env['LOCALAPPDATA'];
  const userProfile = sys.env['USERPROFILE'];

  const agyFallback =
    localAppData !== undefined && localAppData !== ''
      ? path.win32.join(localAppData, 'agy', 'bin', 'agy.exe')
      : undefined;

  const claudeFallback =
    userProfile !== undefined && userProfile !== ''
      ? path.win32.join(userProfile, '.local', 'bin', 'claude.exe')
      : undefined;

  return {
    agy: {
      installCommand: [
        ...WIN_POWERSHELL_INSTALL_PREFIX,
        'irm https://antigravity.google/cli/install.ps1 | iex',
      ],
      docsUrl: AGY_DOCS_URL,
      fallbackCommand: agyFallback,
    },
    claude: {
      installCommand: [...WIN_POWERSHELL_INSTALL_PREFIX, 'irm https://claude.ai/install.ps1 | iex'],
      docsUrl: CLAUDE_DOCS_URL,
      fallbackCommand: claudeFallback,
    },
  };
}

function resolveUnixPlans(sys: SetupEnvironment): Partial<Record<AgentId, AgentSetupPlan>> {
  return {
    agy: {
      installCommand: ['bash', '-c', 'curl -fsSL https://antigravity.google/cli/install.sh | bash'],
      docsUrl: AGY_DOCS_URL,
      fallbackCommand: path.posix.join(sys.homeDir, '.local', 'bin', 'agy'),
    },
    claude: {
      installCommand: ['bash', '-c', 'curl -fsSL https://claude.ai/install.sh | bash'],
      docsUrl: CLAUDE_DOCS_URL,
      fallbackCommand: path.posix.join(sys.homeDir, '.local', 'bin', 'claude'),
    },
  };
}

export function agentSetupPlans(sys: SetupEnvironment): Partial<Record<AgentId, AgentSetupPlan>> {
  if (sys.platform === 'win32') {
    return resolveWin32Plans(sys);
  }
  if (sys.platform === 'darwin' || sys.platform === 'linux') {
    return resolveUnixPlans(sys);
  }
  return {};
}

function darwinTerminalCommand(agentCommand: string): readonly string[] {
  const shellQuoted = `'${agentCommand.replaceAll("'", "'\\''")}'`;
  const appleScriptEscaped = shellQuoted.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  return ['osascript', '-e', `tell application "Terminal" to do script "${appleScriptEscaped}"`];
}

export function terminalCommand(
  sys: SetupEnvironment,
  agentCommand: string,
): readonly string[] | undefined {
  if (sys.platform === 'win32') {
    const escaped = agentCommand.replaceAll("'", "''");
    return [
      'powershell.exe',
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Start-Process -FilePath '${escaped}'`,
    ];
  }
  if (sys.platform === 'darwin') {
    return darwinTerminalCommand(agentCommand);
  }
  if (sys.platform === 'linux') {
    return ['x-terminal-emulator', '-e', agentCommand];
  }
  return undefined;
}
