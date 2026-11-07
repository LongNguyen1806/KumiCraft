// K9.5, FR-71: the Brand tab (theme tokens) on COPIES of real projects (`pnpm test:real`). Per
// folder in KC_REAL_PROJECTS: the tokens the project declares are read and listed in Brand; a
// colour changed there writes only the theme file and reaches the Canvas; a new colour is added;
// two Undo give every file back byte for byte. The copy is always put back as it started.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, type Frame, type Page, test } from '@playwright/test';

import { type CliSession, startCli } from '../support/cli-session.ts';
import { makeTempDir } from '../support/copy-fixture.ts';
import { getCanvasFrame, trustIfAsked } from '../support/trust.ts';
import { backup, changedSince, restore, snapshot } from './real-files.ts';

const PROJECTS = (process.env.KC_REAL_PROJECTS ?? '')
  .split(';')
  .map((p) => p.trim())
  .filter((p) => p !== '');
const NEW_VALUE = '#ff00aa';
const ADDED = { name: 'kcqa-added', value: '#123456' };

test.use({ trace: 'off', viewport: { width: 1600, height: 1000 } });

function report(name: string, value: unknown): void {
  process.stdout.write(`[real] ${name}: ${JSON.stringify(value)}\n`);
}

function dataOf(body: unknown): unknown {
  return body instanceof Object && 'data' in body ? body.data : body;
}

type ThemeToken = {
  readonly name: string;
  readonly value: string;
  readonly variable?: string;
  readonly inherited?: boolean;
};
type ThemeInfo = {
  readonly file?: string;
  readonly system?: string;
  readonly colors: readonly ThemeToken[];
  readonly counts: Readonly<Record<string, number>>;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && Boolean(v);

function tokensOf(v: unknown): ThemeToken[] {
  if (!Array.isArray(v)) return [];
  return v.filter(isRecord).flatMap((t) =>
    typeof t['name'] === 'string' && typeof t['value'] === 'string'
      ? [
          {
            name: t['name'],
            value: t['value'],
            ...(typeof t['variable'] === 'string' ? { variable: t['variable'] } : {}),
            ...(t['inherited'] === true ? { inherited: true } : {}),
          },
        ]
      : [],
  );
}

/** `GET /project/theme`, read field by field (the e2e package has no zod schemas). */
async function themeOf(session: CliSession): Promise<ThemeInfo> {
  const data = dataOf(await session.api('project/theme'));
  const d = isRecord(data) ? data : {};
  const counts: Record<string, number> = {};
  for (const kind of ['fontSizes', 'radii', 'fonts', 'shadows'])
    counts[kind] = tokensOf(d[kind]).length;
  return {
    ...(typeof d['file'] === 'string' ? { file: d['file'] } : {}),
    ...(typeof d['system'] === 'string' ? { system: d['system'] } : {}),
    colors: tokensOf(d['colors']),
    counts,
  };
}

async function canvasFrame(tab: Page): Promise<Frame> {
  await getCanvasFrame(tab);
  const handle = await tab.locator('iframe[data-testid="canvas-iframe"]').first().elementHandle();
  const frame = (await handle.contentFrame()) ?? undefined;
  if (frame === undefined) throw new Error('canvas frame missing');
  return frame;
}

const edited = (appDir: string, base: ReturnType<typeof snapshot>) =>
  changedSince(appDir, base).filter((f) => !f.startsWith('.kumicraft/'));

/** The value of a CSS variable on the Canvas page's root, as the browser computes it. */
function cssVar(frame: Frame, variable: string): Promise<string> {
  return frame
    .evaluate(
      (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim().toLowerCase(),
      variable,
    )
    .catch(() => '');
}

/** True once the variable has a value on the Canvas page; false when it never gets one. */
async function waitForVar(frame: Frame, variable: string): Promise<boolean> {
  for (let i = 0; i < 30; i++) {
    if ((await cssVar(frame, variable)) !== '') return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

const variableOf = (token: ThemeToken) => token.variable ?? `--color-${token.name}`;

for (const appDir of PROJECTS) {
  test(`theme tokens in ${appDir}: read, change, add, Undo [K9.5, FR-71]`, async ({ page }) => {
    test.setTimeout(10 * 60_000);
    expect(existsSync(appDir), `${appDir} exists`).toBe(true);
    const base = snapshot(appDir);
    const saved = backup(appDir);
    const config = await makeTempDir('real-theme');
    let session: CliSession | undefined;
    try {
      session = await startCli(appDir, config.path);
      await page.goto(session.studioUrl);
      await trustIfAsked(page);
      const frame = await canvasFrame(page);

      const theme = await themeOf(session);
      report('theme', {
        file: theme.file,
        system: theme.system,
        colors: theme.colors.map((t) => `${t.name}=${t.value}${t.inherited ? ' (inherited)' : ''}`),
        ...theme.counts,
      });
      const color = theme.colors.find((t) => t.inherited !== true);
      expect(color, 'a colour the project declares').toBeDefined();
      if (color === undefined || theme.file === undefined) return;

      // Brand lists what the project declares.
      await page.getByRole('button', { name: 'Brand', exact: true }).click();
      await expect(page.getByText(color.name, { exact: true }).first()).toBeVisible();

      // Edit once the page has its styles: an edit while the CSS still loads can miss Vite's update.
      // Tailwind 4 leaves out theme variables no class uses: then there is nothing to see.
      const onPage = await waitForVar(frame, variableOf(color));
      const before = await cssVar(frame, variableOf(color));
      report('canvas before', { variable: variableOf(color), value: before, onPage });
      await session.api('project/theme', 'PATCH', {
        op: 'set',
        kind: 'color',
        name: color.name,
        value: NEW_VALUE,
      });
      expect(edited(appDir, base), 'only the theme file changes').toEqual([theme.file]);
      expect(readFileSync(join(appDir, theme.file), 'utf8')).toContain(NEW_VALUE);
      if (onPage) {
        await expect
          .poll(() => cssVar(frame, variableOf(color)), { timeout: 20_000 })
          .toBe(NEW_VALUE);
      }

      await session.api('project/theme', 'PATCH', { op: 'add', kind: 'color', ...ADDED });
      expect(edited(appDir, base)).toEqual([theme.file]);
      const added = (await themeOf(session)).colors.find((t) => t.name === ADDED.name);
      report('added', added);
      expect(added?.value).toBe(ADDED.value);

      await session.api('history/undo', 'POST', {});
      await session.api('history/undo', 'POST', {});
      await expect.poll(() => edited(appDir, base), { timeout: 15_000 }).toEqual([]);
      if (onPage) {
        await expect.poll(() => cssVar(frame, variableOf(color)), { timeout: 20_000 }).toBe(before);
      }
    } finally {
      await session?.stop();
      await config.remove();
      const fixed = restore(appDir, saved);
      if (fixed.length > 0) report('restored after a failure', fixed);
    }
  });
}
