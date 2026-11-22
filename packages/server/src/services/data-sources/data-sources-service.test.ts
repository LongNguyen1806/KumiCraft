// Test 3: 4 Data Source readers (TypeScript runner, Zod static AST, Django static regex, OpenAPI JSON).
import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createNodeFileSystem } from '../../adapters/fs/node-file-system.ts';
import { createNodeProcess } from '../../adapters/system/node-process.ts';
import { resolveRunnerScript } from '../../index.ts';
import { listProjectDataSources, readProjectDataSourceFields } from './data-sources-service.ts';

const req = createRequire(import.meta.url);

describe('Data Sources readers [TK-33, Test 3]', () => {
  let tmpRoot = '';
  const nodeFs = createNodeFileSystem('linux');
  const nodeProcess = createNodeProcess();

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(tmpdir(), 'kumicraft-datasources-'));
    await fs.mkdir(path.join(tmpRoot, 'src/types'), { recursive: true });
    await fs.mkdir(path.join(tmpRoot, 'src/schemas'), { recursive: true });
    await fs.mkdir(path.join(tmpRoot, 'backend/app'), { recursive: true });
    const tsPkg = path.dirname(req.resolve('typescript/package.json'));
    await fs.mkdir(path.join(tmpRoot, 'node_modules'), { recursive: true });
    await fs.symlink(tsPkg, path.join(tmpRoot, 'node_modules/typescript'), 'junction');
    await fs.writeFile(
      path.join(tmpRoot, 'package.json'),
      '{"name":"test","type":"module"}\n',
      'utf8',
    );
    await fs.writeFile(
      path.join(tmpRoot, 'tsconfig.json'),
      '{"compilerOptions":{"target":"ES2022","strict":true},"include":["src"]}\n',
      'utf8',
    );
  });

  afterEach(async () => {
    if (tmpRoot.length > 0) {
      // Windows may still hold a file of the TypeScript runner for a moment after it exits.
      await fs.rm(tmpRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
  });

  it('discovers and reads fields from TypeScript (via runner), Zod (static AST), Django (regex), and OpenAPI JSON', async () => {
    await fs.writeFile(
      path.join(tmpRoot, 'src/types/user.ts'),
      "export interface User {\n  email: string;\n  role: 'admin' | 'member';\n  age?: number;\n  active: boolean;\n}\n",
      'utf8',
    );
    await fs.writeFile(
      path.join(tmpRoot, 'src/schemas/product.ts'),
      "import { z } from './mini-zod';\nexport const ProductSchema = z.object({\n  name: z.string().max(120),\n  contactEmail: z.string().email().optional(),\n  price: z.number(),\n  status: z.enum(['draft', 'published']),\n  inStock: z.boolean(),\n});\n",
      'utf8',
    );
    await fs.writeFile(
      path.join(tmpRoot, 'backend/app/models.py'),
      "from django.db import models\n\nclass Article(models.Model):\n    title = models.CharField(max_length=150, verbose_name='Tiêu đề')\n    author_email = models.EmailField()\n    views = models.IntegerField(blank=True)\n    status = models.CharField(max_length=20, choices=[('draft', 'Draft'), ('live', 'Live')])\n    published = models.BooleanField()\n",
      'utf8',
    );
    await fs.writeFile(
      path.join(tmpRoot, 'openapi.json'),
      JSON.stringify({
        openapi: '3.0.3',
        components: {
          schemas: {
            Customer: {
              required: ['email'],
              properties: {
                email: { type: 'string', format: 'email' },
                tier: { type: 'string', enum: ['free', 'pro'] },
                bio: { type: 'string', maxLength: 500 },
              },
            },
          },
        },
      }),
      'utf8',
    );
    await fs.writeFile(path.join(tmpRoot, 'openapi.yaml'), 'openapi: 3.0.3\n', 'utf8');

    const script = resolveRunnerScript(undefined, 'ts-inspect');
    const deps = { fs: nodeFs, process: nodeProcess, tsInspectScript: script };

    const list = await listProjectDataSources(deps, tmpRoot);
    expect(list.yamlUnsupportedFiles).toContain('openapi.yaml');
    expect(list.sources.map((s) => `${s.kind}:${s.name}`)).toEqual(
      expect.arrayContaining([
        'typescript:User',
        'zod:ProductSchema',
        'django:Article',
        'openapi:Customer',
      ]),
    );

    const tsFields = await readProjectDataSourceFields(deps, tmpRoot, {
      kind: 'typescript',
      file: 'src/types/user.ts',
      name: 'User',
    });
    expect(tsFields.ok).toBe(true);
    if (tsFields.ok) {
      expect(tsFields.value.fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'email', type: 'email', required: true }),
          expect.objectContaining({
            name: 'role',
            type: 'select',
            options: ['admin', 'member'],
            required: true,
          }),
          expect.objectContaining({ name: 'age', type: 'number', required: false }),
          expect.objectContaining({ name: 'active', type: 'boolean', required: true }),
        ]),
      );
    }

    const zodFields = await readProjectDataSourceFields(deps, tmpRoot, {
      kind: 'zod',
      file: 'src/schemas/product.ts',
      name: 'ProductSchema',
    });
    expect(zodFields.ok).toBe(true);
    if (zodFields.ok) {
      expect(zodFields.value.fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'name', type: 'text', maxLength: 120, required: true }),
          expect.objectContaining({ name: 'contactEmail', type: 'email', required: false }),
          expect.objectContaining({
            name: 'status',
            type: 'select',
            options: ['draft', 'published'],
          }),
        ]),
      );
    }

    const djFields = await readProjectDataSourceFields(deps, tmpRoot, {
      kind: 'django',
      file: 'backend/app/models.py',
      name: 'Article',
    });
    expect(djFields.ok).toBe(true);
    if (djFields.ok) {
      expect(djFields.value.fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'title',
            label: 'Tiêu đề',
            maxLength: 150,
            required: true,
          }),
          expect.objectContaining({ name: 'author_email', type: 'email', required: true }),
          expect.objectContaining({ name: 'views', type: 'number', required: false }),
          expect.objectContaining({ name: 'status', type: 'select', options: ['draft', 'live'] }),
        ]),
      );
    }

    const oaFields = await readProjectDataSourceFields(deps, tmpRoot, {
      kind: 'openapi',
      file: 'openapi.json',
      name: 'Customer',
    });
    expect(oaFields.ok).toBe(true);
    if (oaFields.ok) {
      expect(oaFields.value.fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'email', type: 'email', required: true }),
          expect.objectContaining({
            name: 'tier',
            type: 'select',
            options: ['free', 'pro'],
            required: false,
          }),
          expect.objectContaining({ name: 'bio', maxLength: 500, required: false }),
        ]),
      );
    }
    // It starts a real TypeScript runner: under a full `pnpm test` the machine is busy and 5 s
    // (the default) was not always enough.
  }, 30_000);
});
