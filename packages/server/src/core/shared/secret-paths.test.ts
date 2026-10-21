import { describe, expect, it } from 'vitest';

import { isSecretPath } from './secret-paths.ts';

describe('isSecretPath [S-30]', () => {
  it('correctly classifies secret and non-secret paths [S-30]', () => {
    // S-30 test cases required by spec
    expect(isSecretPath('.env')).toBe(true);
    expect(isSecretPath('api/.env.local')).toBe(true);
    expect(isSecretPath('.env.example')).toBe(false);
    expect(isSecretPath('.ENV')).toBe(true);
    expect(isSecretPath('certs/server.pem')).toBe(true);
    expect(isSecretPath('id_rsa.pub')).toBe(true);
    expect(isSecretPath('config/credentials.yml')).toBe(true);
    expect(isSecretPath('secrets.json')).toBe(true);
    expect(isSecretPath('a/.aws/config')).toBe(true);
    expect(isSecretPath('src/Login.tsx')).toBe(false);
    expect(isSecretPath('service-account-prod.json')).toBe(true);
    expect(isSecretPath('kubeconfig')).toBe(true);
  });

  it('allows other .env templates', () => {
    expect(isSecretPath('.env.sample')).toBe(false);
    expect(isSecretPath('.env.template')).toBe(false);
  });

  it('detects nested secret directories (.ssh, .gnupg)', () => {
    expect(isSecretPath('home/user/.ssh/id_ed25519')).toBe(true);
    expect(isSecretPath('keys/.gnupg/secring.gpg')).toBe(true);
  });
});
