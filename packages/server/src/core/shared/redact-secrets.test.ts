import { describe, expect, it } from 'vitest';

import { redactSecrets } from './redact-secrets.ts';

describe('redactSecrets [S-32, S-33, S-86]', () => {
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

  it('redacts keys containing sensitive keywords anywhere in name and ignores regular text [S-33]', () => {
    const input =
      'SECRET_KEY = "a1b2c3", DJANGO_SECRET_KEY=a1b2c3, AUTH_TOKEN_VALUE: \'a1b2c3\', password: "a1b2c3"; the secret garden is nice';
    const expected =
      'SECRET_KEY = "«redacted»", DJANGO_SECRET_KEY=«redacted», AUTH_TOKEN_VALUE: \'«redacted»\', password: "«redacted»"; the secret garden is nice';
    expect(redactSecrets(input)).toBe(expected);
  });

  it('processes 1 MB string without = in <= 100 ms without catastrophic backtracking [S-86]', () => {
    const input = ('a'.repeat(50) + 'secret').repeat(18000); // ~1 MB
    const start = performance.now();
    const result = redactSecrets(input);
    const duration = performance.now() - start;

    expect(result).toBe(input);
    expect(duration).toBeLessThanOrEqual(100);
  });

  it('stays linear on names broken by dots or dashes, 1 MB in <= 100 ms [S-86]', () => {
    // Every `.` or `-` used to start a new name attempt that ran to the end of the string.
    for (const input of ['a.'.repeat(512 * 1024), 'a-'.repeat(512 * 1024)]) {
      const start = performance.now();
      expect(redactSecrets(input)).toBe(input);
      expect(performance.now() - start).toBeLessThanOrEqual(100);
    }
  });
});
