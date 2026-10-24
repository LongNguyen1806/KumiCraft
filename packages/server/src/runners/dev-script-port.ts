// The port a project's `dev` script gives Vite (`vite --port 3000`). KumiCraft starts Vite itself
// instead of running the script, so it reads the flag to run on the same port (SPEC-04 R-RN-04).
const PORT_FLAG = /(?:^|\s)--port(?:=|\s+)(\d{4,5})(?=\s|$)/;

function devScript(packageJson: unknown): string | undefined {
  if (!(packageJson instanceof Object) || !('scripts' in packageJson)) return undefined;
  const scripts = packageJson.scripts;
  if (!(scripts instanceof Object) || !('dev' in scripts)) return undefined;
  return typeof scripts.dev === 'string' ? scripts.dev : undefined;
}

export function devScriptPort(packageJson: unknown): number | undefined {
  const script = devScript(packageJson);
  if (script === undefined || !/\bvite\b/.test(script)) return undefined;
  const port = Number(PORT_FLAG.exec(script)?.[1]);
  return port >= 1024 && port <= 65535 ? port : undefined;
}

/** The port named in Vite's "Port 5173 is already in use" error. */
export function portInMessage(message: string): number | undefined {
  const port = Number(/\bport (\d{4,5})\b/i.exec(message)?.[1]);
  return Number.isInteger(port) && port > 0 ? port : undefined;
}
