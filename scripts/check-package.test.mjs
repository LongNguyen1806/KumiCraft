import { describe, expect, it } from 'vitest';

import { checkPackage } from './check-package.mjs';

function validInput() {
  return {
    files: [
      'package/package.json',
      'package/dist/index.js',
      'package/dist/studio/index.html',
      'package/dist/studio/assets/index-abc.js',
      'package/dist/runners/vite-react.js',
      'package/dist/templates/vite-react-ts-tailwind4/package.json',
      'package/dist/templates/vite-react-ts-tailwind4/src/App.tsx',
    ],
    contents: {
      'package/package.json': JSON.stringify({
        name: 'kumicraft',
        version: '0.0.0',
        bin: { kumicraft: './dist/index.js' },
      }),
      'package/dist/index.js': '#!/usr/bin/env node\nconsole.log("ok");\n',
      'package/dist/runners/vite-react.js': 'const BRIDGE_CLIENT_CODE = "data-rc-id";\n',
      'package/dist/templates/vite-react-ts-tailwind4/package.json': '{"name":"oakline"}',
      'package/dist/templates/vite-react-ts-tailwind4/src/App.tsx':
        'export default function App() { return <h1>Oakline</h1>; }',
    },
  };
}

describe('checkPackage [R-CL-03]', () => {
  it('accepts a valid package and rejects postinstall, missing studio, missing template, or raw src [R-CL-03]', () => {
    // (a) valid package
    const a = checkPackage(validInput());
    expect(a).toMatchObject({ ok: true });

    // (b) package.json with postinstall
    const bInput = validInput();
    bInput.contents['package/package.json'] = JSON.stringify({
      name: 'kumicraft',
      bin: { kumicraft: './dist/index.js' },
      scripts: { postinstall: 'node x.js' },
    });
    const b = checkPackage(bInput);
    expect(b).toMatchObject({ ok: false, reason: 'postinstall' });

    // (c) missing package/dist/studio/index.html
    const cInput = validInput();
    cInput.files = cInput.files.filter((f) => f !== 'package/dist/studio/index.html');
    const c = checkPackage(cInput);
    expect(c).toMatchObject({ ok: false, reason: 'studio' });

    // (d) missing package/dist/templates/vite-react-ts-tailwind4/src/App.tsx
    const dInput = validInput();
    dInput.files = dInput.files.filter(
      (f) => f !== 'package/dist/templates/vite-react-ts-tailwind4/src/App.tsx',
    );
    const d = checkPackage(dInput);
    expect(d).toMatchObject({ ok: false, reason: 'template' });

    // (e) has package/src/index.ts
    const eInput = validInput();
    eInput.files.push('package/src/index.ts');
    const e = checkPackage(eInput);
    expect(e).toMatchObject({ ok: false, reason: 'src' });
  });
});
