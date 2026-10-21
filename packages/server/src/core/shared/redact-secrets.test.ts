import { describe, expect, it } from 'vitest';

import { redactSecrets } from './redact-secrets.ts';

describe('redactSecrets [S-32, S-33]', () => {
  it('redacts connection string passwords', () => {
    const input = 'postgres://user:super_secret_pw@localhost:5432/mydb';
    expect(redactSecrets(input)).toBe('postgres://user:«redacted»@localhost:5432/mydb');
  });

  it('redacts sensitive variable assignments', () => {
    const input = 'API_KEY="AIzaSyA_fake_secret_key" and password=my_password123';
    const output = redactSecrets(input);
    expect(output).toContain('API_KEY="«redacted»"');
    expect(output).toContain('password=«redacted»');
  });

  it('redacts AWS access keys', () => {
    const input = 'aws_key: AKIAIOSFODNN7EXAMPLE in config';
    expect(redactSecrets(input)).toBe('aws_key: «redacted» in config');
  });

  it('redacts sk- API keys', () => {
    const input = 'sk-ant-api03-abcdef1234567890abcdef1234567890';
    expect(redactSecrets(input)).toBe('«redacted»');
  });

  it('redacts GitHub PATs', () => {
    const input = 'Token: ghp_1234567890abcdef1234567890abcdef1234';
    expect(redactSecrets(input)).toBe('Token: «redacted»');
  });

  it('redacts Slack tokens', () => {
    const input = 'xoxb-123456789-abcdef123456';
    expect(redactSecrets(input)).toBe('«redacted»');
  });

  it('leaves clean text untouched', () => {
    const input = 'Vite dev server running at http://127.0.0.1:5173/';
    expect(redactSecrets(input)).toBe(input);
  });
});
