// `pnpm gen:large-workspace -- --out <dir> [--pages 50] [--nodes 500] [--seed 1]`
// Writes the large reference workspace of SPEC-01.1 section 11.1 (50 pages × 500 nodes) as the
// `.reactcraft/` folder of ADR-BE-11. Same seed, same bytes (SPEC-07 WP-0.07). The result is
// checked with checkDocument before it is written.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import {
  checkDocument,
  type DataSourceCatalog,
  type DesignDocument,
  type DesignNode,
  type DesignTokens,
  documentToFiles,
  type Page,
  WORKSPACE_DIR,
  type WorkspaceMeta,
} from '@reactcraft/model';

type Random = () => number;

/** mulberry32: small, fast and deterministic. */
function createRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(random: Random, items: readonly T[]): T =>
  items[Math.floor(random() * items.length)] as T;
const id = (prefix: string, n: number) => `${prefix}_${n.toString(36).padStart(10, '0')}`;

const WORDS = [
  'Áo',
  'thun',
  'mùa',
  'hè',
  'giảm',
  'giá',
  'mới',
  'nhất',
  'cửa',
  'hàng',
  'sản',
  'phẩm',
  'đẹp',
  'bền',
];
const sentence = (random: Random, length: number) =>
  Array.from({ length }, () => pick(random, WORDS)).join(' ');

class PageBuilder {
  private count = 0;
  private readonly random: Random;
  private readonly nextId: () => string;

  constructor(random: Random, nextId: () => string) {
    this.random = random;
    this.nextId = nextId;
  }

  get size() {
    return this.count;
  }

  node(
    type: DesignNode['type'],
    content: DesignNode['content'],
    extra: Partial<DesignNode> = {},
  ): DesignNode {
    this.count++;
    return { id: this.nextId(), type, content, ...extra };
  }

  card(): DesignNode {
    const random = this.random;
    const children = [
      this.node('Heading', { kind: 'heading', text: sentence(random, 3), level: 3 }),
      this.node(
        'Text',
        { kind: 'text', text: sentence(random, 12) },
        { style: { textColor: 'token:color.muted' } },
      ),
      this.node('Button', {
        kind: 'button',
        text: sentence(random, 2),
        variant: pick(random, ['primary', 'outline'] as const),
      }),
    ];
    return this.node(
      'Card',
      { kind: 'none' },
      {
        style: {
          gap: 'token:spacing.2',
          padding: { top: 'token:spacing.4', bottom: 'token:spacing.4' },
          radius: 'token:radius.lg',
        },
        states: { hover: { shadow: 'token:shadow.md' } },
        children,
      },
    );
  }

  /** Section > Container > Grid > cards: 3 + 4 × cards nodes. */
  section(cards: number): DesignNode {
    const columns = pick(this.random, [2, 3, 4]);
    const grid = this.node(
      'Grid',
      { kind: 'none' },
      {
        style: { columns, gap: 'token:spacing.4' },
        responsive: { md: { columns: 1 } },
        children: Array.from({ length: cards }, () => this.card()),
      },
    );
    const container = this.node(
      'Container',
      { kind: 'container', maxWidth: 'xl' },
      { children: [grid] },
    );
    return this.node(
      'Section',
      { kind: 'section' },
      {
        style: { padding: { top: { px: pick(this.random, [32, 48, 64]) } } },
        children: [container],
      },
    );
  }
}

function buildPage(index: number, nodes: number, random: Random, nextId: () => string): Page {
  const builder = new PageBuilder(random, nextId);
  const root = builder.node('Stack', { kind: 'none' }, { children: [] });
  const children = root.children as DesignNode[];
  while (builder.size + 3 + 4 <= nodes) {
    const room = Math.floor((nodes - builder.size - 3) / 4);
    children.push(builder.section(Math.min(room, 1 + Math.floor(random() * 8))));
  }
  while (builder.size < nodes)
    children.push(builder.node('Text', { kind: 'text', text: sentence(random, 6) }));
  return {
    schemaVersion: 1,
    id: id('p', index + 1),
    name: `Trang ${String(index + 1)}`,
    route: index === 0 ? '/' : `/page-${String(index + 1)}`,
    root,
  };
}

const TOKENS: DesignTokens = {
  schemaVersion: 1,
  color: {
    muted: { value: '#6b7280', dark: '#9ca3af' },
    surface: { value: '#ffffff', dark: '#111827' },
  },
  spacing: { '2': { value: { px: 8 } }, '4': { value: { px: 16 } } },
  radius: { lg: { value: { px: 8 } } },
  shadow: { md: { value: '0 4px 6px -1px rgb(0 0 0 / 0.1)' } },
  fontSize: {},
  fontWeight: {},
  lineHeight: {},
  fontFamily: {},
};
const CATALOG: DataSourceCatalog = {
  schemaVersion: 1,
  auth: { kind: 'none' },
  entities: [],
  endpoints: [],
};

export function generateLargeWorkspace(pages: number, nodes: number, seed: number): DesignDocument {
  const random = createRandom(seed);
  let nodeCounter = 0;
  const nextId = () => id('n', ++nodeCounter);
  const pageList = Array.from({ length: pages }, (_, i) => buildPage(i, nodes, random, nextId));
  const workspace: WorkspaceMeta = {
    schemaVersion: 1,
    id: 'largews001',
    name: 'Large workspace',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    revision: 0,
    pageOrder: pageList.map((page) => page.id),
    backends: [],
    responsiveMode: 'desktop-first',
    frames: [
      { id: 'desktop', label: 'Desktop', width: 1440, height: 900 },
      { id: 'mobile', label: 'Mobile', width: 375, height: 812 },
    ],
    primaryFrameId: 'desktop',
    contentLocale: 'vi-VN',
    darkMode: 'none',
  };
  return {
    workspace,
    tokens: TOKENS,
    pages: Object.fromEntries(pageList.map((page) => [page.id, page])),
    components: {},
    dataSources: CATALOG,
  };
}

/** Writes the canonical files of ADR-BE-11 (SPEC-04.1 R-DS-07 to R-DS-10). */
function writeWorkspace(document: DesignDocument, out: string) {
  rmSync(join(out, WORKSPACE_DIR), { recursive: true, force: true });
  for (const [path, content] of Object.entries(documentToFiles(document))) {
    mkdirSync(dirname(join(out, path)), { recursive: true });
    writeFileSync(join(out, path), content);
  }
}

function main() {
  const { values } = parseArgs({
    options: {
      out: { type: 'string' },
      pages: { type: 'string', default: '50' },
      nodes: { type: 'string', default: '500' },
      seed: { type: 'string', default: '1' },
    },
  });
  if (values.out === undefined) {
    console.error('Usage: gen-large-workspace --out <dir> [--pages 50] [--nodes 500] [--seed 1]');
    process.exit(1);
  }
  const document = generateLargeWorkspace(
    Number(values.pages),
    Number(values.nodes),
    Number(values.seed),
  );
  const result = checkDocument(document);
  if (!result.ok) {
    console.error(JSON.stringify(result.error.details?.slice(0, 10), undefined, 2));
    process.exit(1);
  }
  const out = resolve(values.out);
  writeWorkspace(document, out);
  console.log(
    `gen-large-workspace: ${values.pages} pages × ${values.nodes} nodes, seed ${values.seed} → ${out}`,
  );
}

if (
  process.argv[1] !== undefined &&
  process.argv[1].replace(/\\/g, '/').endsWith('gen-large-workspace.ts')
) {
  main();
}
