import { describe, expect, it } from 'vitest';

import { compiledCssUrl, createCompiledCssReader } from './compiled-css-reader.ts';

describe('compiled CSS reader [R-ST-04]', () => {
  it('asks Vite for the compiled sheet by /@fs/ and ?direct, for Windows and POSIX paths', () => {
    expect(compiledCssUrl('http://localhost:5173', 'D:/app/src/main.scss?used')).toBe(
      'http://localhost:5173/@fs/D:/app/src/main.scss?direct',
    );
    expect(compiledCssUrl('http://127.0.0.1:5173/', '/home/a b/app/x.css')).toBe(
      'http://127.0.0.1:5173/@fs/home/a%20b/app/x.css?direct',
    );
  });

  it('gives undefined while the dev server is not running', async () => {
    expect(await createCompiledCssReader(() => undefined).read('D:/app/x.css')).toBeUndefined();
  });
});
