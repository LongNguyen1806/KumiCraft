// Tests for the answer text kept with a turn (R-AG-14).
import { TURN_REPLY_MAX } from '@kumicraft/shared';
import { describe, expect, it } from 'vitest';

import { createReplyCollector } from './turn-events.ts';

describe('createReplyCollector', () => {
  it('joins message pieces like the chat, starts a paragraph after a tool, and keeps the cap', () => {
    const reply = createReplyCollector();
    reply.add({ kind: 'message', text: 'Đang xem' });
    reply.add({ kind: 'message', text: ' file.' });
    reply.add({ kind: 'tool', name: 'Read', target: 'src/App.jsx' });
    reply.add({ kind: 'message', text: 'Xong.' });
    expect(reply.text()).toBe('Đang xem file.\n\nXong.');

    const long = createReplyCollector();
    long.add({ kind: 'message', text: 'x'.repeat(TURN_REPLY_MAX + 50) });
    long.add({ kind: 'message', text: 'more' });
    expect(long.text()).toHaveLength(TURN_REPLY_MAX);
  });

  it('keeps nothing for a turn without answer text', () => {
    const reply = createReplyCollector();
    reply.add({ kind: 'tool', name: 'Edit' });
    expect(reply.text()).toBe('');
  });
});
