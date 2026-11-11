// Last line of defence (spec-log #116): an error nobody handled is written to the terminal and
// KumiCraft keeps running, so one forgotten `catch` cannot close the Studio for the user.

type CrashGuardTarget = {
  on(event: 'unhandledRejection' | 'uncaughtException', listener: (reason: unknown) => void): void;
};

export function describeCrash(reason: unknown): string {
  if (reason instanceof Error) return reason.stack ?? `${reason.name}: ${reason.message}`;
  return String(reason);
}

/** Installs the two process handlers; `warn` writes one message per error. */
export function installCrashGuard(target: CrashGuardTarget, warn: (line: string) => void): void {
  const report = (kind: string) => (reason: unknown) => {
    warn(
      `kumicraft: ${kind}, KumiCraft keeps running. Please report it with the text below.\n${describeCrash(reason)}`,
    );
  };
  target.on('unhandledRejection', report('an error was not handled'));
  target.on('uncaughtException', report('an unexpected error happened'));
}
