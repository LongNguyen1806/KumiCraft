// Tests for Pug data-rc-loc AST plugin (SPEC-04 M-RN, Phase 4 K4).
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { hookPug } from './pug-loc-plugin.ts';

const FIXTURE_ROOT = join(process.cwd(), 'fixtures/projects/express-pug');

describe('Pug Location Plugin [WP-4.00]', () => {
  it('[WP-4.00] B1: Plugin Pug với fixture: h1.hero-title có views/index.pug:5:3, nav có views/partials/nav.pug:1:1, .card có views/mixins.pug:2:3; html/head/body/meta không có', () => {
    const projectRequire = createRequire(join(FIXTURE_ROOT, 'package.json'));
    const pug = projectRequire('pug') as Record<string, unknown>;
    hookPug(FIXTURE_ROOT, pug);

    const compileFile = pug.compileFile as (
      path: string,
      options?: unknown,
    ) => (locals?: unknown) => string;
    const renderFn = compileFile(join(FIXTURE_ROOT, 'views/index.pug'), {
      basedir: join(FIXTURE_ROOT, 'views'),
    });

    const html = renderFn({
      title: 'Chợ phiên',
      products: [{ id: 1, name: 'Rau muống', price: '15.000đ' }],
    });

    // h1.hero-title có views/index.pug:5:3
    expect(html).toContain('data-rc-loc="views/index.pug:5:3"');
    expect(html).toMatch(/<h1[^>]*class="hero-title"[^>]*data-rc-loc="views\/index\.pug:5:3"/);

    // nav có views/partials/nav.pug:1:1
    expect(html).toContain('data-rc-loc="views/partials/nav.pug:1:1"');
    expect(html).toMatch(/<nav[^>]*data-rc-loc="views\/partials\/nav\.pug:1:1"/);

    // .card có views/mixins.pug:2:3
    expect(html).toContain('data-rc-loc="views/mixins.pug:2:3"');
    expect(html).toMatch(/<article[^>]*class="card"[^>]*data-rc-loc="views\/mixins\.pug:2:3"/);

    // html/head/body/meta không có data-rc-loc
    expect(html).not.toMatch(/<html[^>]*data-rc-loc/);
    expect(html).not.toMatch(/<head[^>]*data-rc-loc/);
    expect(html).not.toMatch(/<body[^>]*data-rc-loc/);
    expect(html).not.toMatch(/<meta[^>]*data-rc-loc/);
    expect(html).not.toMatch(/<title[^>]*data-rc-loc/);
    expect(html).not.toMatch(/<link[^>]*data-rc-loc/);
  });
});
