// Workspace root discovery and package resolution (SPEC-04 K5, Section 3.3).
import type { FileSystemPort } from '../ports/file-system-port.ts';
import { parentPath } from '../shared/paths.ts';

function hasWorkspacesField(value: unknown): boolean {
  if (!value || typeof value !== 'object' || !('workspaces' in value)) return false;
  const ws = (value as { readonly workspaces?: unknown }).workspaces;
  return Array.isArray(ws) || (typeof ws === 'object' && Boolean(ws));
}

/** An npm, pnpm or yarn workspace: `pnpm-workspace.yaml`, or a `package.json` with `workspaces`. */
export async function isPackageWorkspace(fs: FileSystemPort, dir: string): Promise<boolean> {
  if (await fs.exists(dir, 'pnpm-workspace.yaml')) return true;
  if (!(await fs.exists(dir, 'package.json'))) return false;
  const read = await fs.readText(dir, 'package.json', { maxBytes: 512 * 1024 });
  if (!read.ok) return false;
  try {
    return hasWorkspacesField(JSON.parse(read.value));
  } catch {
    return false;
  }
}

async function isWorkspaceDir(fs: FileSystemPort, dir: string): Promise<boolean> {
  return (await isPackageWorkspace(fs, dir)) || fs.exists(dir, '.git');
}

/**
 * The package workspace a project belongs to, where its installs run (K5 3.3). A folder with only
 * `.git` (MarketLink: `frontend/` and `backend/` side by side) is a repo, not a workspace: it ends
 * the search, and the project installs in its own folder.
 */
export async function findPackageWorkspaceRoot(
  fs: FileSystemPort,
  root: string,
): Promise<string | undefined> {
  let current = parentPath(root.replaceAll('\\', '/').replace(/\/+$/, ''));
  for (let level = 1; level <= 5 && current !== undefined; level += 1) {
    if (await isPackageWorkspace(fs, current)) return current;
    if (await fs.exists(current, '.git')) return undefined;
    current = parentPath(current);
  }
  return undefined;
}

/**
 * Searches parent directories up to 5 levels for the nearest workspace root
 * having pnpm-workspace.yaml, package.json with workspaces, or .git.
 */
export async function findWorkspaceRoot(
  fs: FileSystemPort,
  root: string,
): Promise<string | undefined> {
  const normRoot = root.replaceAll('\\', '/').replace(/\/+$/, '');
  let current = parentPath(normRoot);
  for (let level = 1; level <= 5 && current !== undefined; level += 1) {
    if (await isWorkspaceDir(fs, current)) {
      return current;
    }
    current = parentPath(current);
  }
  return undefined;
}

/**
 * Looks for node_modules/<name>/package.json in root and parent directories
 * up to workspaceRoot (never beyond workspaceRoot).
 * Returns the package directory containing package.json, e.g. <dir>/node_modules/<name>.
 */
export async function findPackage(
  fs: FileSystemPort,
  root: string,
  name: string,
): Promise<string | undefined> {
  const normRoot = root.replaceAll('\\', '/').replace(/\/+$/, '');
  const workspaceRoot = await findWorkspaceRoot(fs, normRoot);

  let current: string | undefined = normRoot;
  while (current !== undefined) {
    const pkgJsonRel = `node_modules/${name}/package.json`;
    if (await fs.exists(current, pkgJsonRel)) {
      return `${current}/node_modules/${name}`;
    }
    if (workspaceRoot === undefined || current === workspaceRoot) {
      break;
    }
    current = parentPath(current);
  }
  return undefined;
}
