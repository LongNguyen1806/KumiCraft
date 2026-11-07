// Agent events of a turn: secrets taken out, and the answer text kept for history (R-AG-14).
import { type AgentEvent, TURN_REPLY_MAX } from '@kumicraft/shared';

import { redactSecrets } from '../shared/redact-secrets.ts';

/** What the agent process left: its exit code, whether it reported an error, its answer text. */
export type AgentRun = {
  readonly exitCode: number;
  readonly hasErrorEvent: boolean;
  readonly reply: string;
};

export function redactEventSecrets(event: AgentEvent): AgentEvent {
  if (event.kind === 'message') return { ...event, text: redactSecrets(event.text) };
  if (event.kind === 'error') return { ...event, message: redactSecrets(event.message) };
  if (event.kind === 'tool') {
    return {
      ...event,
      ...(event.target !== undefined ? { target: redactSecrets(event.target) } : {}),
    };
  }
  return event;
}

/**
 * Collects the answer text the way the chat shows it: pieces of one message run on, a tool or
 * error in between starts a new paragraph. Capped at TURN_REPLY_MAX.
 */
export function createReplyCollector() {
  let reply = '';
  let lastWasMessage = false;
  return {
    add(event: AgentEvent): void {
      // Usage reports are not part of the text and do not break a paragraph.
      if (event.kind === 'usage') return;
      if (event.kind === 'message' && reply.length < TURN_REPLY_MAX) {
        const joint = reply === '' || lastWasMessage ? '' : '\n\n';
        reply = `${reply}${joint}${event.text}`.slice(0, TURN_REPLY_MAX);
      }
      lastWasMessage = event.kind === 'message';
    },
    text: (): string => reply,
  };
}
