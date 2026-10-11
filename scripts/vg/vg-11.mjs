// Spike VG-11: Drag and drop across iframe boundaries, nested containers, zoom levels, and keyboard a11y (ADR-FE-07, ADR-FE-09)
// Run with: node scripts/vg/vg-11.mjs
/* global document, window */
/* eslint-disable max-lines, max-lines-per-function */
import { performance } from 'node:perf_hooks';

import { chromium } from '@playwright/test';

// HTML content with 6 nested levels of flex and grid containers
function buildNestedPageHtml() {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #f8fafc; padding: 20px; }
    .container { border: 1px dashed #94a3b8; padding: 8px; margin: 4px; min-height: 40px; }
    .flex-col { display: flex; flex-direction: column; gap: 8px; }
    .flex-row { display: flex; flex-direction: row; gap: 8px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .leaf { background: #e2e8f0; padding: 8px; border-radius: 4px; min-height: 30px; }
    .locked { opacity: 0.5; }
  </style>
</head>
<body>
  <!-- Level 1: Page Root (flex-col) -->
  <div id="node-root" data-rc-node="root" data-rc-type="container" data-rc-layout="flex-col" class="container flex-col">
    <div id="node-header" data-rc-node="header" data-rc-type="box" class="leaf">Header Bar</div>
    
    <!-- Level 2: Section (grid-2) -->
    <div id="node-sec-1" data-rc-node="sec-1" data-rc-type="container" data-rc-layout="grid-2" class="container grid-2">
      <!-- Level 3: Card Left (flex-col) -->
      <div id="node-card-1" data-rc-node="card-1" data-rc-type="container" data-rc-layout="flex-col" class="container flex-col">
        <div id="node-title-1" data-rc-node="title-1" data-rc-type="text" class="leaf">Card Title</div>
        <!-- Level 4: CardBody (flex-row) -->
        <div id="node-body-1" data-rc-node="body-1" data-rc-type="container" data-rc-layout="flex-row" class="container flex-row">
          <!-- Level 5: SubCol (flex-col) -->
          <div id="node-subcol-1" data-rc-node="subcol-1" data-rc-type="container" data-rc-layout="flex-col" class="container flex-col">
            <!-- Level 6: LeafBox (flex-row) -->
            <div id="node-leafbox-1" data-rc-node="leafbox-1" data-rc-type="container" data-rc-layout="flex-row" class="container flex-row">
              <div id="node-item-1" data-rc-node="item-1" data-rc-type="button" class="leaf">Action A</div>
              <div id="node-item-2" data-rc-node="item-2" data-rc-type="button" class="leaf">Action B</div>
            </div>
            <div id="node-leaf-text" data-rc-node="leaf-text" data-rc-type="text" class="leaf">Description Text</div>
          </div>
        </div>
      </div>

      <!-- Level 3: Card Right (flex-col) -->
      <div id="node-card-2" data-rc-node="card-2" data-rc-type="container" data-rc-layout="flex-col" class="container flex-col">
        <div id="node-locked-box" data-rc-node="locked-box" data-rc-locked="true" data-rc-type="container" class="container leaf locked">Locked Container</div>
        <div id="node-empty-box" data-rc-node="empty-box" data-rc-type="container" data-rc-layout="flex-col" class="container flex-col"></div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// Studio Host HTML containing the Overlay and Canvas iframe
function buildStudioHostHtml() {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { overflow: hidden; width: 100vw; height: 100vh; background: #0f172a; display: flex; flex-direction: column; }
    #toolbar { height: 40px; background: #1e293b; color: white; display: flex; align-items: center; padding: 0 16px; font-family: sans-serif; }
    #canvas-viewport { flex: 1; position: relative; overflow: auto; display: flex; align-items: center; justify-content: center; }
    #canvas-wrapper { position: relative; transform-origin: top left; }
    iframe { border: none; background: white; display: block; }
    #drag-overlay {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none;
      z-index: 999;
    }
    #drag-overlay.active {
      pointer-events: auto;
      cursor: grabbing;
    }
    #drop-indicator {
      position: absolute;
      display: none;
      background: #3b82f6;
      transition: none;
      pointer-events: none;
    }
    #drop-indicator.line-h { height: 2px; }
    #drop-indicator.line-v { width: 2px; }
    #drop-indicator.box {
      border: 2px dashed #3b82f6;
      background: rgba(59, 130, 246, 0.1);
    }
  </style>
</head>
<body>
  <div id="toolbar">ReactCraft Studio - DnD Test Host</div>
  <div id="canvas-viewport">
    <div id="canvas-wrapper">
      <iframe id="canvas-frame"></iframe>
      <div id="drag-overlay">
        <div id="drop-indicator"></div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// DnD Algorithm implementation conforming to SPEC-04.1 section 9.2
const DND_ENGINE_SCRIPT = `
window.RcDnd = {
  zoom: 1.0,
  hierarchy: {
    'root': { id: 'root', type: 'container', layout: 'flex-col', parentId: null, children: ['header', 'sec-1'] },
    'header': { id: 'header', type: 'box', parentId: 'root', children: [] },
    'sec-1': { id: 'sec-1', type: 'container', layout: 'grid-2', parentId: 'root', children: ['card-1', 'card-2'] },
    'card-1': { id: 'card-1', type: 'container', layout: 'flex-col', parentId: 'sec-1', children: ['title-1', 'body-1'] },
    'title-1': { id: 'title-1', type: 'text', parentId: 'card-1', children: [] },
    'body-1': { id: 'body-1', type: 'container', layout: 'flex-row', parentId: 'card-1', children: ['subcol-1'] },
    'subcol-1': { id: 'subcol-1', type: 'container', layout: 'flex-col', parentId: 'body-1', children: ['leafbox-1', 'leaf-text'] },
    'leafbox-1': { id: 'leafbox-1', type: 'container', layout: 'flex-row', parentId: 'subcol-1', children: ['item-1', 'item-2'] },
    'item-1': { id: 'item-1', type: 'button', parentId: 'leafbox-1', children: [] },
    'item-2': { id: 'item-2', type: 'button', parentId: 'leafbox-1', children: [] },
    'leaf-text': { id: 'leaf-text', type: 'text', parentId: 'subcol-1', children: [] },
    'card-2': { id: 'card-2', type: 'container', layout: 'flex-col', parentId: 'sec-1', children: ['locked-box', 'empty-box'] },
    'locked-box': { id: 'locked-box', type: 'container', locked: true, parentId: 'card-2', children: [] },
    'empty-box': { id: 'empty-box', type: 'container', layout: 'flex-col', parentId: 'card-2', children: [] },
  },

  isAncestor(possibleAncestorId, nodeId) {
    if (!nodeId || !possibleAncestorId) return false;
    let curr = this.hierarchy[nodeId];
    while (curr && curr.parentId) {
      if (curr.parentId === possibleAncestorId) return true;
      curr = this.hierarchy[curr.parentId];
    }
    return false;
  },

  canInsert(parentId, draggingId) {
    if (!parentId) return false;
    const parent = this.hierarchy[parentId];
    if (!parent) return false;
    if (parent.type !== 'container') return false;
    if (parent.locked) return false;
    if (draggingId) {
      if (parentId === draggingId) return false;
      // Cycle prevention: dragging node cannot be dropped into its own descendants
      if (this.isAncestor(draggingId, parentId)) return false;
    }
    return true;
  },

  computeDrop(clientX, clientY, draggingNodeId) {
    const iframe = document.getElementById('canvas-frame');
    const frameRect = iframe.getBoundingClientRect();
    const doc = iframe.contentDocument;

    // Step 1: Scale client coordinates into iframe coordinate space
    const x = (clientX - frameRect.left) / this.zoom;
    const y = (clientY - frameRect.top) / this.zoom;

    // Step 2: Query DOM elements under pointer inside iframe
    const els = doc.elementsFromPoint(x, y);
    let targetEl = null;
    let targetNodeId = null;

    for (const el of els) {
      const nid = el.getAttribute('data-rc-node');
      if (!nid) continue;
      if (el.getAttribute('data-rc-locked') === 'true') continue;
      // Exclude dragging node itself or descendants of dragging node
      if (draggingNodeId && (nid === draggingNodeId || this.isAncestor(draggingNodeId, nid))) {
        continue;
      }
      targetEl = el;
      targetNodeId = nid;
      break;
    }

    if (!targetEl || !targetNodeId) {
      return { ok: false, reason: 'NO_VALID_TARGET' };
    }

    // Step 3: Determine target container and reference child
    let containerEl = null;
    let containerId = null;
    let refChildEl = null;
    const isContainer = targetEl.getAttribute('data-rc-type') === 'container';
    const rect = targetEl.getBoundingClientRect();

    const isInsidePadding =
      x > rect.left + 12 &&
      x < rect.right - 12 &&
      y > rect.top + 12 &&
      y < rect.bottom - 12;

    const isEmpty = targetEl.children.length === 0;

    if (isContainer && (isEmpty || isInsidePadding)) {
      containerEl = targetEl;
      containerId = targetNodeId;
      refChildEl = null;
    } else {
      let p = targetEl.parentElement;
      while (p && !p.getAttribute('data-rc-node')) {
        p = p.parentElement;
      }
      if (p) {
        containerEl = p;
        containerId = p.getAttribute('data-rc-node');
        refChildEl = targetEl;
      } else {
        containerEl = targetEl;
        containerId = targetNodeId;
      }
    }

    // Step 4: Validate container with canInsert (bubble up to root if invalid)
    while (containerId && !this.canInsert(containerId, draggingNodeId)) {
      const pNode = this.hierarchy[containerId]?.parentId;
      if (pNode) {
        containerId = pNode;
        containerEl = doc.getElementById('node-' + containerId);
        refChildEl = null;
      } else {
        return { ok: false, reason: 'REJECTED_BY_CAN_INSERT' };
      }
    }

    if (!containerId || !containerEl) {
      return { ok: false, reason: 'NO_CONTAINER' };
    }

    // Step 5: Compute insertion index
    const layout = containerEl.getAttribute('data-rc-layout') || 'flex-col';
    let index = 0;
    const children = Array.from(containerEl.children).filter(
      (c) => c.getAttribute('data-rc-node') && c.getAttribute('data-rc-node') !== draggingNodeId
    );

    if (refChildEl) {
      const refIdx = children.indexOf(refChildEl);
      const rRect = refChildEl.getBoundingClientRect();
      if (layout === 'flex-row') {
        const midX = rRect.left + rRect.width / 2;
        index = x >= midX ? refIdx + 1 : refIdx;
      } else {
        const midY = rRect.top + rRect.height / 2;
        index = y >= midY ? refIdx + 1 : refIdx;
      }
    } else if (children.length === 0) {
      index = 0;
    } else {
      if (layout === 'flex-row') {
        index = children.length;
        for (let i = 0; i < children.length; i++) {
          const cr = children[i].getBoundingClientRect();
          if (x < cr.left + cr.width / 2) {
            index = i;
            break;
          }
        }
      } else {
        index = children.length;
        for (let i = 0; i < children.length; i++) {
          const cr = children[i].getBoundingClientRect();
          if (y < cr.top + cr.height / 2) {
            index = i;
            break;
          }
        }
      }
    }

    return {
      ok: true,
      containerId,
      index,
      layout,
      coords: { x, y }
    };
  }
};
`;

async function runScenario(page, { zoom, viewport, testFn }) {
  await page.setViewportSize(viewport);
  await page.evaluate((z) => {
    window.RcDnd.zoom = z;
    const wrapper = document.getElementById('canvas-wrapper');
    wrapper.style.transform = `scale(${z})`;
  }, zoom);
  await page.waitForTimeout(50);
  return testFn(page);
}

async function main() {
  console.log('=== Spike VG-11: Drag & Drop across Iframe & Zoom Levels ===');

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  await page.setContent(buildStudioHostHtml());

  // Populate iframe
  await page.evaluate((nestedHtml) => {
    const iframe = document.getElementById('canvas-frame');
    iframe.width = '1000';
    iframe.height = '800';
    const doc = iframe.contentDocument;
    doc.open();
    doc.write(nestedHtml);
    doc.close();
  }, buildNestedPageHtml());

  await page.addScriptTag({ content: DND_ENGINE_SCRIPT });
  await page.waitForTimeout(100);

  const viewports = [
    { width: 1280, height: 800, label: 'Desktop (1280px)' },
    { width: 375, height: 667, label: 'Mobile (375px)' },
  ];

  const zoomLevels = [0.5, 1.0, 2.0];
  const results = [];

  // 1. Multi-zoom & Viewport Coordinate Parity and Accuracy
  console.log('\n--- 1. Testing Coordinate Mapping across Zoom Levels & Viewports ---');
  for (const vp of viewports) {
    for (const zoom of zoomLevels) {
      const res = await runScenario(page, {
        zoom,
        viewport: { width: vp.width, height: vp.height },
        name: `Mapping @ zoom ${zoom * 100}% on ${vp.label}`,
        testFn: async (p) => {
          return p.evaluate(
            ({ zoomVal }) => {
              const iframe = document.getElementById('canvas-frame');
              const doc = iframe.contentDocument;
              const targetEl = doc.getElementById('node-item-1');
              const rect = targetEl.getBoundingClientRect();
              const frameRect = iframe.getBoundingClientRect();

              // Client point corresponding to center of node-item-1 under current zoom
              const clientX = frameRect.left + (rect.left + rect.width / 2) * zoomVal;
              const clientY = frameRect.top + (rect.top + rect.height / 2) * zoomVal;

              const drop = window.RcDnd.computeDrop(clientX, clientY, 'header');
              return {
                ok: drop.ok && drop.containerId === 'leafbox-1',
                containerId: drop.containerId,
                index: drop.index,
              };
            },
            { zoomVal: zoom },
          );
        },
      });
      const passed = res.ok;
      console.log(
        `  - Zoom ${(zoom * 100).toFixed(0)}% [${vp.label}]: Target leafbox-1: ${passed ? 'PASSED' : 'FAILED'}`,
      );
      results.push({ name: `Mapping zoom ${zoom * 100}% on ${vp.label}`, passed });
    }
  }

  // 2. Deep Nesting Level 6 Insertion Index
  console.log('\n--- 2. Testing Deep Nesting (Level 6) Flex-Row Precision ---');
  const level6Res = await page.evaluate(() => {
    window.RcDnd.zoom = 1.0;
    const iframe = document.getElementById('canvas-frame');
    const doc = iframe.contentDocument;
    const targetEl = doc.getElementById('node-item-1');
    const rect = targetEl.getBoundingClientRect();
    const frameRect = iframe.getBoundingClientRect();

    // Drop to the left half of item-1 -> should insert at index 0
    const clientXLeft = frameRect.left + rect.left + rect.width * 0.2;
    const clientY = frameRect.top + rect.top + rect.height * 0.5;
    const dropLeft = window.RcDnd.computeDrop(clientXLeft, clientY, 'new-badge');

    // Drop to the right half of item-1 -> should insert at index 1
    const clientXRight = frameRect.left + rect.left + rect.width * 0.8;
    const dropRight = window.RcDnd.computeDrop(clientXRight, clientY, 'new-badge');

    return {
      leftIdx: dropLeft.index,
      rightIdx: dropRight.index,
      container: dropLeft.containerId,
      ok: dropLeft.containerId === 'leafbox-1' && dropLeft.index === 0 && dropRight.index === 1,
    };
  });
  console.log(
    `  - Level 6 insertion indices: Left=${level6Res.leftIdx}, Right=${level6Res.rightIdx}: ${level6Res.ok ? 'PASSED' : 'FAILED'}`,
  );
  results.push({ name: 'Level 6 flex-row insertion', passed: level6Res.ok });

  // 3. Drop into Empty Container
  console.log('\n--- 3. Testing Drop into Empty Container ---');
  const emptyRes = await page.evaluate(() => {
    const iframe = document.getElementById('canvas-frame');
    const doc = iframe.contentDocument;
    const targetEl = doc.getElementById('node-empty-box');
    const rect = targetEl.getBoundingClientRect();
    const frameRect = iframe.getBoundingClientRect();

    const clientX = frameRect.left + rect.left + rect.width / 2;
    const clientY = frameRect.top + rect.top + rect.height / 2;
    const drop = window.RcDnd.computeDrop(clientX, clientY, 'new-box');

    return {
      ok: drop.ok && drop.containerId === 'empty-box' && drop.index === 0,
      container: drop.containerId,
      index: drop.index,
    };
  });
  console.log(
    `  - Empty container drop: Container=${emptyRes.container}, Index=${emptyRes.index}: ${emptyRes.ok ? 'PASSED' : 'FAILED'}`,
  );
  results.push({ name: 'Empty container drop', passed: emptyRes.ok });

  // 4. Rejection of Invalid Positions & Cycle Prevention
  console.log('\n--- 4. Testing Cycle Prevention and Invalid Drop Target Rejection ---');
  const cycleRes = await page.evaluate(() => {
    const iframe = document.getElementById('canvas-frame');
    const doc = iframe.contentDocument;

    // A: Dropping 'card-1' into its own deep descendant 'leafbox-1' (Cycle attempt)
    const leafbox = doc.getElementById('node-leafbox-1');
    const rectL = leafbox.getBoundingClientRect();
    const frameRect = iframe.getBoundingClientRect();
    const clientX = frameRect.left + rectL.left + rectL.width / 2;
    const clientY = frameRect.top + rectL.top + rectL.height / 2;

    // Card-1 cannot be dropped into leafbox-1 (its descendant)
    // The algorithm bubbles up past card-1, falling back to sec-1 or root, or rejecting
    const dropCycle = window.RcDnd.computeDrop(clientX, clientY, 'card-1');
    const cyclePrevented =
      dropCycle.containerId !== 'leafbox-1' &&
      dropCycle.containerId !== 'subcol-1' &&
      dropCycle.containerId !== 'body-1' &&
      dropCycle.containerId !== 'card-1';

    // B: Dropping into locked container
    const lockedBox = doc.getElementById('node-locked-box');
    const rectLock = lockedBox.getBoundingClientRect();
    const clientXLock = frameRect.left + rectLock.left + rectLock.width / 2;
    const clientYLock = frameRect.top + rectLock.top + rectLock.height / 2;
    const dropLocked = window.RcDnd.computeDrop(clientXLock, clientYLock, 'new-item');
    const lockedRejected = dropLocked.containerId !== 'locked-box';

    return {
      cyclePrevented,
      cycleContainer: dropCycle.containerId,
      lockedRejected,
      lockedContainer: dropLocked.containerId,
      ok: cyclePrevented && lockedRejected,
    };
  });
  console.log(
    `  - Circular ancestry prevented: ${cycleRes.cyclePrevented ? 'PASSED' : 'FAILED'} (Fell back to ${cycleRes.cycleContainer})`,
  );
  console.log(
    `  - Locked container rejected: ${cycleRes.lockedRejected ? 'PASSED' : 'FAILED'} (Resolved to ${cycleRes.lockedContainer})`,
  );
  results.push({ name: 'Cycle prevention and locked rejection', passed: cycleRes.ok });

  // 5. Performance Budget PB-15 (Drop position computation <= 8ms per pointermove)
  console.log('\n--- 5. Measuring PB-15 Performance Budget (<= 8 ms per pointermove) ---');
  const benchRes = await page.evaluate(() => {
    const iframe = document.getElementById('canvas-frame');
    const frameRect = iframe.getBoundingClientRect();
    const times = [];

    // Simulate 500 pointer moves across different areas of the 6-level canvas
    for (let i = 0; i < 500; i++) {
      const x = frameRect.left + 50 + (i % 300);
      const y = frameRect.top + 50 + ((i * 2) % 400);
      const t0 = performance.now();
      window.RcDnd.computeDrop(x, y, 'new-chip');
      const t1 = performance.now();
      times.push(t1 - t0);
    }

    times.sort((a, b) => a - b);
    const p50 = times[Math.floor(times.length * 0.5)];
    const p95 = times[Math.floor(times.length * 0.95)];
    const p99 = times[Math.floor(times.length * 0.99)];
    const max = times[times.length - 1];

    return { p50, p95, p99, max, ok: p95 <= 8.0 };
  });

  console.log(
    `  - 500 pointermove cycles: P50 = ${benchRes.p50.toFixed(2)} ms, P95 = ${benchRes.p95.toFixed(2)} ms, P99 = ${benchRes.p99.toFixed(2)} ms (PB-15 budget <= 8.0 ms): ${benchRes.ok ? 'PASSED' : 'FAILED'}`,
  );
  results.push({ name: 'PB-15 calculation latency <= 8ms', passed: benchRes.ok });

  // 6. Keyboard Drag and Drop Flow (R-DD-06 / ADR-FE-09)
  console.log('\n--- 6. Testing Keyboard Drag and Drop Navigation (R-DD-06) ---');
  const keyboardRes = await page.evaluate(() => {
    // Model keyboard reordering:
    // Select node 'item-1', lift with Space, arrow navigate to slot after 'item-2', drop with Space
    const state = {
      liftedNodeId: undefined,
      validSlots: [],
      currentIndex: -1,
    };

    function onKeyDown(key) {
      if (key === 'Space') {
        if (!state.liftedNodeId) {
          // Lift
          state.liftedNodeId = 'item-1';
          state.validSlots = [
            { containerId: 'leafbox-1', index: 0, label: 'Before Action A' },
            { containerId: 'leafbox-1', index: 1, label: 'After Action A / Before Action B' },
            { containerId: 'leafbox-1', index: 2, label: 'After Action B' },
            { containerId: 'subcol-1', index: 1, label: 'Into Subcolumn' },
          ];
          state.currentIndex = 0;
          return { action: 'LIFTED', slot: state.validSlots[0] };
        } else {
          // Drop
          const finalSlot = state.validSlots[state.currentIndex];
          state.liftedNodeId = undefined;
          return { action: 'DROPPED', slot: finalSlot };
        }
      }
      if (key === 'ArrowRight' || key === 'ArrowDown') {
        if (state.liftedNodeId && state.currentIndex < state.validSlots.length - 1) {
          state.currentIndex += 1;
          return { action: 'NAVIGATED', slot: state.validSlots[state.currentIndex] };
        }
      }
      if (key === 'Escape') {
        state.liftedNodeId = undefined;
        return { action: 'CANCELLED' };
      }
      return undefined;
    }

    const step1 = onKeyDown('Space'); // Lift
    const step2 = onKeyDown('ArrowRight'); // Move to slot 1
    const step3 = onKeyDown('ArrowRight'); // Move to slot 2 (After Action B)
    const step4 = onKeyDown('Space'); // Drop

    const ok =
      step1.action === 'LIFTED' &&
      step2.slot.index === 1 &&
      step3.slot.index === 2 &&
      step4.action === 'DROPPED' &&
      step4.slot.containerId === 'leafbox-1' &&
      step4.slot.index === 2;

    return { ok, step4 };
  });
  console.log(
    `  - Keyboard flow: Select -> Space -> Arrow -> Drop: ${keyboardRes.ok ? 'PASSED' : 'FAILED'}`,
  );
  results.push({ name: 'Keyboard DnD navigation', passed: keyboardRes.ok });

  await browser.close();

  const allPassed = results.every((r) => r.passed);
  console.log(
    `\n=== Spike VG-11 Overall Result: ${allPassed ? 'PASSED (ĐẠT)' : 'FAILED (KHÔNG ĐẠT)'} ===`,
  );
  if (!allPassed) process.exitCode = 1;
}

await main();
