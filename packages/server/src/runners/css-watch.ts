// A project that builds its CSS with Tailwind (ASP.NET 03c section 5, Express 03d section 0): its
// own watch script (`"css:watch": "tailwindcss -i … -o wwwroot/css/site.css --watch"`) runs next
// to `dotnet watch`, so a class written by KumiCraft is in the CSS the Canvas loads. The output
// lands in the project's wwwroot and reaches the copy like any other changed file.
import { type ChildProcess, execFile, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The project's script that rebuilds Tailwind CSS on change, if it has one. */
export function tailwindWatchScript(root: string): string | undefined {
  const file = join(root, 'package.json');
  if (!existsSync(file)) return undefined;
  try {
    const pkg: unknown = JSON.parse(readFileSync(file, 'utf8'));
    const scripts: unknown =
      typeof pkg === 'object' && pkg ? Reflect.get(pkg, 'scripts') : undefined;
    if (typeof scripts !== 'object' || !scripts) return undefined;
    return Object.entries(scripts).find(
      ([, command]) =>
        typeof command === 'string' &&
        command.includes('tailwindcss') &&
        /(^|\s)(--watch|-w)(\s|$)/.test(command),
    )?.[0];
  } catch {
    return undefined;
  }
}

function packageManager(root: string): string {
  if (existsSync(join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(root, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

/** Ends a process and the processes it started (`dotnet watch` runs the app as a child). */
export function killTree(child: ChildProcess): void {
  if (child.pid === undefined || typeof child.exitCode === 'number') return;
  if (process.platform === 'win32') {
    execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true }, () => {});
  } else child.kill('SIGTERM');
}

/** Starts the project's Tailwind watch script when there is one; returns how to stop it. */
export function startCssWatch(root: string): () => void {
  const script = tailwindWatchScript(root);
  if (script === undefined) return () => {};
  const child = spawn(packageManager(root), ['run', script], {
    cwd: root,
    // Tailwind's `--watch` stops when its stdin closes: keep an open pipe for as long as it runs.
    stdio: ['pipe', 'ignore', 'ignore'],
    shell: process.platform === 'win32',
    windowsHide: true,
  });
  return () => {
    killTree(child);
  };
}
