import { describe, expect, it } from 'vitest';

import {
  checkBlockedPath,
  checkPathSyntax,
  isInside,
  jsonDepth,
  MAX_PATH_LENGTH,
  resolveBackendPath,
  toStoredBackendPath,
} from './paths.ts';

const reason = (path: string, platform: 'win32' | 'linux' = 'win32') =>
  checkPathSyntax(path, platform)?.params?.['reason'];

describe('checkPathSyntax', () => {
  it('accepts ordinary relative paths', () => {
    expect(checkPathSyntax('.reactcraft/pages/p_home000001.json', 'win32')).toBeUndefined();
    expect(checkPathSyntax('C:\\work\\shop', 'win32')).toBeUndefined();
  });

  it('rejects control characters and overlong paths everywhere [S-20]', () => {
    expect(reason('a\u0000b', 'linux')).toBe('controlCharacter');
    expect(reason('a\nb', 'linux')).toBe('controlCharacter');
    expect(reason('a'.repeat(MAX_PATH_LENGTH + 1), 'linux')).toBe('tooLong');
  });

  it('rejects Windows UNC, device, drive-relative, stream and reserved paths [S-21]', () => {
    expect(reason('\\\\server\\share\\x')).toBe('uncOrDevicePath');
    expect(reason('\\\\?\\C:\\x')).toBe('uncOrDevicePath');
    expect(reason('\\\\.\\pipe\\x')).toBe('uncOrDevicePath');
    expect(reason('C:foo')).toBe('driveRelative');
    expect(reason('file.txt:stream')).toBe('alternateDataStream');
    for (const name of ['NUL', 'con.txt', 'pages/COM1', 'lpt9.json', 'aux .']) {
      expect(reason(name)).toBe('reservedName');
    }
  });

  it('leaves Windows-only names alone on Linux and macOS [S-21]', () => {
    expect(checkPathSyntax('con.txt', 'linux')).toBeUndefined();
  });
});

describe('isInside', () => {
  it('needs the prefix to end at a separator [S-23]', () => {
    expect(isInside('/work/app', '/work/app/src', 'linux')).toBe(true);
    expect(isInside('/work/app', '/work/app', 'linux')).toBe(true);
    expect(isInside('/work/app', '/work/application', 'linux')).toBe(false);
  });

  it('ignores case on Windows and macOS only [S-23]', () => {
    expect(isInside('C:\\Work\\App', 'c:\\work\\app\\x', 'win32')).toBe(true);
    expect(isInside('/Work/App', '/work/app/x', 'darwin')).toBe(true);
    expect(isInside('/Work/App', '/work/app/x', 'linux')).toBe(false);
  });
});

describe('jsonDepth', () => {
  it('counts nesting outside strings [S-29]', () => {
    expect(jsonDepth('{"a":[1,{"b":2}]}')).toBe(3);
    expect(jsonDepth('{"a":"[[[{{{"}')).toBe(1);
    expect(jsonDepth('"\\"["')).toBe(0);
    expect(jsonDepth('['.repeat(70) + ']'.repeat(70))).toBe(70);
  });
});

describe('toStoredBackendPath [V-03, V-04]', () => {
  it('stores relative path with / when backend is inside project parent folder [V-03]', () => {
    expect(toStoredBackendPath('/work/projects/frontend', '/work/projects/shop-api', 'linux')).toBe(
      '../shop-api',
    );
    expect(toStoredBackendPath('D:\\work\\frontend', 'D:\\work\\services\\api', 'win32')).toBe(
      '../services/api',
    );
  });

  it('stores absolute path with / when backend is outside project parent folder [V-04]', () => {
    expect(toStoredBackendPath('/work/projects/frontend', '/var/data/api', 'linux')).toBe(
      '/var/data/api',
    );
    expect(toStoredBackendPath('D:\\work\\frontend', 'E:\\external\\api', 'win32')).toBe(
      'E:/external/api',
    );
  });
});

describe('resolveBackendPath', () => {
  it('resolves relative path against project root', () => {
    expect(resolveBackendPath('/work/projects/frontend', '../shop-api')).toBe(
      '/work/projects/shop-api',
    );
    expect(resolveBackendPath('D:/work/frontend', '../services/api')).toBe('D:/work/services/api');
  });

  it('leaves absolute paths untouched', () => {
    expect(resolveBackendPath('/work/projects/frontend', '/var/data/api')).toBe('/var/data/api');
  });
});

describe('checkBlockedPath', () => {
  it('refuses drive roots, the home folder and system folders [S-28]', () => {
    expect(checkBlockedPath('C:/', 'win32')).toEqual({
      code: 'E012',
      params: { path: 'C:/', reason: 'driveRoot' },
    });
    expect(checkBlockedPath('C:\\Windows\\System32', 'win32')).toEqual({
      code: 'E012',
      params: { path: 'C:\\Windows\\System32', reason: 'systemFolder' },
    });
    expect(checkBlockedPath('C:/Users/me', 'win32', 'C:\\Users\\me')).toEqual({
      code: 'E012',
      params: { path: 'C:/Users/me', reason: 'homeDir' },
    });
    expect(checkBlockedPath('/etc/nginx', 'linux')).toEqual({
      code: 'E012',
      params: { path: '/etc/nginx', reason: 'systemFolder' },
    });
    expect(checkBlockedPath('D:/work/shop', 'win32', 'C:/Users/me')).toBeUndefined();
  });
});
