// Unit tests for bridge protocol schemas (SPEC-03 section 7, V-110..V-114).
import { describe, expect, it } from 'vitest';

import {
  BridgeEnvelopeSchema,
  BridgeReadyPayloadSchema,
  BridgeSelectionInfoPayloadSchema,
  BridgeTextCancelPayloadSchema,
  BridgeTextCommitPayloadSchema,
  BridgeTextEditRequestPayloadSchema,
  BridgeTreePayloadSchema,
  ElementRefSchema,
  RectSchema,
  StudioTextEditEndPayloadSchema,
  StudioTextEditStartPayloadSchema,
  TreeNodeSchema,
} from './bridge.ts';

describe('Bridge Protocol Schemas', () => {
  it('validates ElementRef [V-103]', () => {
    const valid = { loc: 'src/App.tsx:12:5', index: 0 };
    expect(ElementRefSchema.parse(valid)).toEqual(valid);

    expect(() => ElementRefSchema.parse({ loc: '', index: 0 })).toThrow();
    expect(() => ElementRefSchema.parse({ loc: 'a', index: -1 })).toThrow();
  });

  it('validates Rect [V-104]', () => {
    const valid = { x: 10, y: 20, width: 300, height: 150 };
    expect(RectSchema.parse(valid)).toEqual(valid);
  });

  it('validates TreeNode [R-SL-08, R-SL-11]', () => {
    const node = {
      ref: { loc: 'src/App.tsx:10:1', index: 0 },
      parent: 0,
      tag: 'button',
      label: 'btn-primary',
      instances: 1,
    };
    expect(TreeNodeSchema.parse(node)).toEqual(node);
  });

  it('validates BridgeEnvelope [V-110, V-111]', () => {
    const envelope = {
      rc: 1,
      nonce: 'nonce-12345678901234567890',
      type: 'ready',
      payload: { bridgeVersion: '1.0.0', route: '/' },
    };
    expect(BridgeEnvelopeSchema.parse(envelope)).toEqual(envelope);

    expect(() =>
      BridgeEnvelopeSchema.parse({ rc: 2, nonce: 'n', type: 'ready', payload: {} }),
    ).toThrow();
  });

  it('validates BridgeReadyPayload and BridgeTreePayload [V-113]', () => {
    const ready = { bridgeVersion: '1.0.0', route: '/about' };
    expect(BridgeReadyPayloadSchema.parse(ready)).toEqual(ready);

    const tree = {
      nodes: [
        {
          ref: { loc: 'src/App.tsx:1:1', index: 0 },
          tag: 'div',
          instances: 1,
        },
      ],
      truncated: false,
    };
    expect(BridgeTreePayloadSchema.parse(tree)).toEqual(tree);
  });

  it('validates BridgeSelectionInfoPayload', () => {
    const info = {
      items: [
        {
          ref: { loc: 'src/App.tsx:5:1', index: 0 },
          found: true,
          tag: 'div',
          rect: { x: 0, y: 0, width: 100, height: 50 },
          instances: 1,
          domClass: 'p-4 bg-white',
        },
      ],
    };
    expect(BridgeSelectionInfoPayloadSchema.parse(info)).toEqual(info);
  });

  it('validates text-edit payloads [SPEC-03 section 7, R-TX-01..05]', () => {
    const ref = { loc: 'src/App.tsx:5:1', index: 0 };
    const req = { ref };
    expect(BridgeTextEditRequestPayloadSchema.parse(req)).toEqual(req);

    const commit = { ref, text: 'Sản phẩm mới' };
    expect(BridgeTextCommitPayloadSchema.parse(commit)).toEqual(commit);

    const cancel = { ref };
    expect(BridgeTextCancelPayloadSchema.parse(cancel)).toEqual(cancel);

    const start = { ref };
    expect(StudioTextEditStartPayloadSchema.parse(start)).toEqual(start);

    const end = { ref };
    expect(StudioTextEditEndPayloadSchema.parse(end)).toEqual(end);
  });
});
