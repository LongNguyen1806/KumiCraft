// The page inside the Canvas iframe: flex and grid nested 6 levels (SPEC-01.2 VG-11), with the
// `data-rc-*` attributes the Canvas Renderer puts on every node.

const CSS = `
* { box-sizing: border-box; margin: 0; }
body { font: 14px system-ui, sans-serif; background: #fff; padding: 16px; }
[data-rc-container] { border: 1px dashed #94a3b8; padding: 8px; min-height: 44px; gap: 8px; }
.col { display: flex; flex-direction: column; }
.row { display: flex; flex-direction: row; }
.grid { display: grid; grid-template-columns: 1fr 1fr; }
.leaf { background: #e2e8f0; padding: 8px; border-radius: 4px; }
`;

const node = (id: string, kind: 'col' | 'row' | 'grid' | 'leaf', inner = '', extra = '') =>
  kind === 'leaf'
    ? `<div data-rc-node="${id}" class="leaf" ${extra}>${inner}</div>`
    : `<div data-rc-node="${id}" data-rc-container="${kind}" class="${kind}" ${extra}>${inner}</div>`;

/** Level 1 root › 2 section (grid) › 3 card › 4 body (row) › 5 column › 6 leafbox (row). */
export const CANVAS_HTML = `<!doctype html><html><head><style>${CSS}</style></head><body>${node(
  'root',
  'col',
  node('header', 'leaf', 'Header') +
    node(
      'sec-1',
      'grid',
      node(
        'card-1',
        'col',
        node('title-1', 'leaf', 'Card title') +
          node(
            'body-1',
            'row',
            node(
              'subcol-1',
              'col',
              node(
                'leafbox-1',
                'row',
                node('item-1', 'leaf', 'Action A') + node('item-2', 'leaf', 'Action B'),
              ) + node('leaf-text', 'leaf', 'Description'),
            ),
          ),
      ) +
        node(
          'card-2',
          'col',
          node(
            'locked-box',
            'col',
            node('locked-child', 'leaf', 'Locked'),
            'data-rc-locked="true"',
          ) + node('empty-box', 'col'),
        ),
    ),
)}</body></html>`;
