import { describe, expect, it } from 'vitest';

import { node } from './test-support.ts';
import { walkTree } from './tree.ts';

describe('walkTree', () => {
  it('visits children in order, then instance slots, with depth, parent and path', () => {
    const text = node('Text');
    const button = node('Button');
    const instance = node('ComponentInstance', { slots: { actions: [button] } });
    const root = node('Stack', { children: [text, instance] });
    const visited: string[] = [];

    walkTree(root, (current, { depth, parent, path }) => {
      visited.push(`${current.type}@${String(depth)}<${parent?.type ?? '-'}>${path.join('.')}`);
    });

    expect(visited).toEqual([
      'Stack@1<->',
      'Text@2<Stack>children.0',
      'ComponentInstance@2<Stack>children.1',
      'Button@3<ComponentInstance>children.1.slots.actions.0',
    ]);
  });
});
