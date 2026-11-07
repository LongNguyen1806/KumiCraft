// AI chat with the fake agent (gate G3, SPEC-07 M-AG #7, #8): a backend mirror turned into a page
// that uses its API, then undone as one turn [AC-08]; a selected element sent as `file:line` and
// edited in the right place [AC-09]. The agent is `fake-agent.mjs` set through the server's test
// option (R-QA-12); its JSON script plays what a real agent would write.
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { expect, type Page, test } from '@playwright/test';

import { type CliSession, startAgentStudio } from './support/cli-session.ts';
import { copyFixture, makeTempDir, type TempDir } from './support/copy-fixture.ts';
import { getCanvasFrame, trustIfAsked } from './support/trust.ts';
import { ui } from './support/ui-text.ts';

const SECRET = 'RC_SECRET_MARKER_1';

/** Undo of the top bar: "Undo (Ctrl+Z)", or "Undo <step> (Ctrl+Z)" once there is a step. */
const undoLabel = () => new RegExp(`^${ui('editor.undo').split(' (')[0] ?? ''}\\b.*\\(`);

let project: TempDir;
let work: TempDir;
const sessions: CliSession[] = [];

/** What the fake agent received (RC_FAKE_AGENT_RECORD). */
type AgentRecord = { readonly argv: readonly string[]; readonly cwd: string };

const paths = () => ({
  script: join(work.path, 'script.json'),
  record: join(work.path, 'record.json'),
  backend: join(work.path, 'backend'),
  cache: join(work.path, 'cache'),
});

/** Every file of `dir` with the SHA-256 of its bytes, by relative path. */
async function hashTree(dir: string): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  for (const entry of await readdir(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const full = join(entry.parentPath, entry.name);
    const key = relative(dir, full).replaceAll('\\', '/');
    hashes[key] = createHash('sha256')
      .update(await readFile(full))
      .digest('hex');
  }
  return hashes;
}

async function readRecord(): Promise<AgentRecord> {
  return JSON.parse(await readFile(paths().record, 'utf8')) as AgentRecord;
}

function promptOf(record: AgentRecord): string {
  return record.argv[record.argv.indexOf('-p') + 1] ?? '';
}

/** A fake agent script (R-QA-11): stream events of the agy format, then file writes. */
async function writeScript(
  reply: string,
  writes: readonly { readonly path: string; readonly content: string }[],
  read?: string,
): Promise<void> {
  const steps: unknown[] = [
    { emit: { event: 'init', conversation_id: '$CONVERSATION' } },
    ...(read === undefined ? [] : [{ read }]),
    {
      emit: {
        event: 'step_update',
        step_update: { step_type: 'agent_response', text_delta: reply },
      },
    },
  ];
  for (const write of writes) {
    steps.push({
      emit: {
        event: 'step_update',
        step_update: {
          step_type: 'tool',
          state: 'ACTIVE',
          tool_name: 'write_file',
          tool_info: { parameters: { Path: write.path } },
        },
      },
    });
    steps.push({ write });
  }
  steps.push({ emit: { event: 'result', result: { status: 'SUCCESS' } } });
  await writeFile(paths().script, JSON.stringify({ steps }));
}

async function start(): Promise<CliSession> {
  const session = await startAgentStudio(
    project.path,
    { config: join(work.path, 'config'), cache: paths().cache, data: join(work.path, 'data') },
    { script: paths().script, record: paths().record },
  );
  sessions.push(session);
  // The user picked Antigravity in the chat's agent chooser (R-AG-21); here that is the fake agent.
  await session.api('settings', 'PATCH', { agent: { preferred: 'agy' } });
  return session;
}

/** Opens the Studio, trusts the project and waits for the fixture's home page on the Canvas. */
async function openStudio(page: Page, session: CliSession) {
  await page.goto(session.studioUrl);
  await trustIfAsked(page);
  const canvas = await getCanvasFrame(page);
  await expect(canvas.getByRole('heading', { name: 'Sản phẩm nổi bật' })).toBeVisible({
    timeout: 20_000,
  });
  return canvas;
}

async function sendChat(page: Page, request: string): Promise<void> {
  await page.getByTestId('chat-input').fill(request);
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('chat-turn-summary')).toBeVisible({ timeout: 30_000 });
}

/** A small Express backend with a secret in `.env` (G3 manual step 1, done automatically). */
async function writeBackend(dir: string): Promise<void> {
  await mkdir(join(dir, 'routes'), { recursive: true });
  await writeFile(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'shop-api', type: 'module', dependencies: { express: '5.1.0' } }),
  );
  await writeFile(join(dir, '.env'), `DATABASE_URL=postgres://admin:${SECRET}@db/shop\n`);
  await writeFile(
    join(dir, 'routes', 'products.js'),
    [
      "import { Router } from 'express';",
      'export const products = Router();',
      "products.get('/api/products', (_req, res) => res.json([{ id: 1, name: 'Bàn phím' }]));",
      "products.post('/api/products', (req, res) => res.status(201).json(req.body));",
      '',
    ].join('\n'),
  );
}

const API_CLIENT = `export type Product = { readonly id: number; readonly name: string };

export async function listProducts(): Promise<Product[]> {
  const response = await fetch('/api/products');
  return (await response.json()) as Product[];
}
`;

const PRODUCTS_PAGE = `import { useEffect, useState } from 'react';

import { listProducts, type Product } from '../api/products.ts';

export function Products() {
  const [items, setItems] = useState<Product[]>([]);
  useEffect(() => {
    listProducts().then(setItems, () => {
      setItems([]);
    });
  }, []);
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">Quản lý sản phẩm</h1>
      <ul>
        {items.map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </main>
  );
}
`;

test.beforeEach(async () => {
  project = await copyFixture('projects/vite8-react19-ts');
  work = await makeTempDir('agent-chat');
});

test.afterEach(async () => {
  for (const session of sessions.splice(0)) await session.stop();
  await project.remove();
  await work.remove();
});

test('a backend mirror becomes a page that uses its API, undone as one turn [AC-08]', async ({
  page,
}) => {
  const { backend, cache } = paths();
  await writeBackend(backend);
  const backendBefore = await hashTree(backend);
  const projectBefore = await hashTree(join(project.path, 'src'));
  const main = await readFile(join(project.path, 'src', 'main.tsx'), 'utf8');
  await writeScript(
    'I read the products routes and wrote an API client and a products page.',
    [
      { path: 'src/api/products.ts', content: API_CLIENT },
      { path: 'src/pages/Products.tsx', content: PRODUCTS_PAGE },
      {
        path: 'src/main.tsx',
        content: main
          .replace(
            "import { Home } from './pages/Home.tsx';",
            "import { Products } from './pages/Products.tsx';",
          )
          .replace('<Home />', '<Products />'),
      },
    ],
    'routes/products.js',
  );

  const canvas = await openStudio(page, await start());
  await page.getByTestId('right-tab-chat').click();
  await page.getByTestId('chat-import').click();
  await page.getByTestId('chat-import-path').fill(backend);
  await page.getByTestId('chat-import-confirm').click();
  await expect(page.locator('[data-testid^="chat-backend-"]')).toHaveCount(1);

  await sendChat(page, 'Tạo trang quản lý sản phẩm theo API của backend');

  await expect(canvas.getByRole('heading', { name: 'Quản lý sản phẩm' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByTestId('chat-files')).toContainText('src/api/products.ts');
  await expect(page.getByTestId('chat-files')).toContainText('src/pages/Products.tsx');
  await expect(page.getByTestId('chat-files')).toContainText('src/main.tsx');

  // S-111: the agent got the mirror, never the real backend folder; S-120: no secret file in it.
  const record = await readRecord();
  const mirror = record.argv[record.argv.indexOf('--add-dir') + 1] ?? '';
  expect(relative(cache, mirror).startsWith('..')).toBe(false);
  expect(record.argv.join('\n')).not.toContain(backend);
  expect(promptOf(record)).toContain(mirror);
  const mirrorFiles = await hashTree(mirror);
  expect(Object.keys(mirrorFiles)).toContain('routes/products.js');
  expect(Object.keys(mirrorFiles)).not.toContain('.env');
  for (const file of Object.keys(mirrorFiles)) {
    expect(await readFile(join(mirror, file), 'utf8')).not.toContain(SECRET);
  }
  expect(await hashTree(backend)).toEqual(backendBefore);

  await page.getByTestId('chat-revert').click();
  await page.getByTestId('chat-revert-confirm').click();
  await expect(page.getByTestId('chat-reverted')).toBeVisible();
  expect(await hashTree(join(project.path, 'src'))).toEqual(projectBefore);
  await expect(canvas.getByRole('heading', { name: 'Sản phẩm nổi bật' })).toBeVisible({
    timeout: 20_000,
  });
  expect(await hashTree(backend)).toEqual(backendBefore);
});

test('a selected element reaches the agent as file:line and is edited in place [AC-09, R-AG-18]', async ({
  page,
}) => {
  const cardFile = join(project.path, 'src', 'components', 'Card.tsx');
  const card = await readFile(cardFile, 'utf8');
  const withButton = card.replace(
    '      <div className="mt-2 text-sm text-slate-600">{children}</div>\n',
    '      <div className="mt-2 text-sm text-slate-600">{children}</div>\n' +
      '      <button type="button" className="mt-3 rounded bg-blue-600 px-3 py-1 text-white">\n' +
      '        Mua\n' +
      '      </button>\n',
  );
  expect(withButton).not.toBe(card);
  await writeScript('I added a Buy button under the card content.', [
    { path: 'src/components/Card.tsx', content: withButton },
  ]);

  // The Card's own root element: the place the agent has to edit.
  const cardLine = card.split('\n').findIndex((line) => line.includes('rounded-xl')) + 1;
  const cardLoc = `src/components/Card.tsx:${String(cardLine)}`;

  const canvas = await openStudio(page, await start());
  // A click on the Canvas selects the outer group first; the Layers tree picks the Card itself.
  await page
    .getByRole('treeitem', { name: /rounded-xl.*Card/ })
    .first()
    .click();
  // A Studio edit before the turn: an Undo step on Card.tsx.
  await page.getByTestId('raw-class-details').locator('summary').click();
  const rawClass = page.getByTestId('raw-class-input');
  await rawClass.fill(`${await rawClass.inputValue()} p-8`);
  await rawClass.press('Enter');
  await expect.poll(async () => (await readFile(cardFile, 'utf8')).includes('p-8')).toBe(true);
  const undo = page.getByRole('button', { name: undoLabel() });
  await expect(undo).toBeEnabled();
  await page.getByTestId('right-tab-chat').click();
  await expect(page.getByTestId('chat-chip-element')).toHaveText(`Div · ${cardLoc}`);

  await sendChat(page, 'thêm nút Mua');

  const prompt = promptOf(await readRecord());
  expect(prompt).toContain(`Selected element: ${cardLoc}:`);
  expect(prompt).toMatch(/Selected element: \S+:\d+:\d+ \(div\)/);
  // Both cards render the edited component; the rest of the page is untouched.
  await expect(canvas.getByRole('button', { name: 'Mua', exact: true })).toHaveCount(2, {
    timeout: 20_000,
  });
  await expect(canvas.getByRole('button', { name: 'Mua ngay' })).toHaveCount(1);
  expect(await readFile(cardFile, 'utf8')).toBe(withButton);
  // R-AG-18: the agent's write is an outside change, so the Studio step on that file is dropped.
  await expect(undo).toBeDisabled();
  await expect(page.getByTestId('chat-files')).toContainText('src/components/Card.tsx');
});

test('the model chip sends the picked effort and shows the turn usage without overflowing [K9.5, R-CH-02]', async ({
  page,
}) => {
  await writeFile(
    paths().script,
    JSON.stringify({
      steps: [
        { emit: { event: 'init', conversation_id: '$CONVERSATION' } },
        {
          emit: {
            event: 'step_update',
            step_update: { step_type: 'agent_response', text_delta: 'Done.' },
          },
        },
        { emit: { event: 'result', result: { status: 'SUCCESS', usage: { total_tokens: 4321 } } } },
      ],
    }),
  );
  const session = await start();
  await openStudio(page, session);

  await page.getByRole('tab', { name: 'AI' }).click();
  const chip = page.getByTestId('agent-settings-chip');
  await chip.click();
  await page.getByTestId('agent-settings-effort-high').click();
  await expect(chip).toContainText('Cao');
  await page.keyboard.press('Escape');

  await sendChat(page, 'Say hi');
  const record = await readRecord();
  expect(
    record.argv.slice(record.argv.indexOf('--effort'), record.argv.indexOf('--effort') + 2),
  ).toEqual(['--effort', 'high']);

  await chip.click();
  await expect(page.getByTestId('agent-settings-usage')).toContainText('4.321');
  await expect(page.getByTestId('agent-settings-usage')).toContainText(
    'Antigravity CLI không báo hạn mức',
  );
  await page.keyboard.press('Escape');

  // Chip and Send stay on one row inside the input box (the old switch broke a narrow panel).
  const box = await page.getByTestId('chat-input').locator('..').boundingBox();
  const chipBox = await chip.boundingBox();
  const sendBox = await page.getByTestId('chat-send').boundingBox();
  expect(box && chipBox && sendBox).toBeTruthy();
  if (box && chipBox && sendBox) {
    expect(chipBox.x).toBeGreaterThanOrEqual(box.x);
    expect(chipBox.x + chipBox.width).toBeLessThanOrEqual(sendBox.x);
    expect(
      Math.abs(chipBox.y + chipBox.height / 2 - (sendBox.y + sendBox.height / 2)),
    ).toBeLessThan(4);
  }
});
