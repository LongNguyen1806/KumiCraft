// S-30: Secrets file and folder detection (ADR-BE-34, S-30, S-86).

const SECRET_FOLDERS = new Set(['.aws', '.ssh', '.gnupg']);

const SECRET_EXTENSIONS = [
  '.pem',
  '.key',
  '.p12',
  '.pfx',
  '.jks',
  '.keystore',
  '.ppk',
  '.secret',
] as const;

const SECRET_PREFIXES = ['id_rsa', 'id_ed25519', 'credentials', 'secrets', 'kubeconfig'] as const;

const SECRET_EXACT_NAMES = new Set(['.env', '.npmrc', '.pypirc', '.netrc']);

const ENV_ALLOWLIST = new Set(['.env.example', '.env.sample', '.env.template']);

function isSecretFilename(name: string): boolean {
  if (SECRET_EXACT_NAMES.has(name)) {
    return true;
  }
  if (name.startsWith('.env.')) {
    return !ENV_ALLOWLIST.has(name);
  }
  if (SECRET_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return true;
  }
  if (SECRET_PREFIXES.some((prefix) => name.startsWith(prefix))) {
    return true;
  }
  if (name.startsWith('service-account') && name.endsWith('.json')) {
    return true;
  }
  if (name.endsWith('-credentials.json')) {
    return true;
  }
  return false;
}

/**
 * S-30: true when a path (relative, `/` separators) is a secrets file or lies in a secrets folder.
 * Uses string operations without glob libraries or nested regex (S-86).
 */
export function isSecretPath(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, '/');
  const segments = normalized.split('/').filter((s) => s.length > 0);
  if (segments.length === 0) {
    return false;
  }

  // Any directory or file segment matching secret folder names
  for (const seg of segments) {
    if (SECRET_FOLDERS.has(seg.toLowerCase())) {
      return true;
    }
  }

  const filename = segments[segments.length - 1]?.toLowerCase() ?? '';
  return isSecretFilename(filename);
}
