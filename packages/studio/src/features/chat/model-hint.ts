// Glow around the "Default" model chip (owner, 2026-11-15): "Default" lets the agent CLI run
// whatever model its own settings say, which may be a costly one. Each time the Studio opens with
// "Default", the chip glows until the user sends a message or picks a model; old chats do not count.
import { useChatStore } from './chat-store.ts';

/** True while the chip should glow: no model picked, and nothing sent since the Studio opened. */
export function useModelHint(pickedModel: string | undefined): boolean {
  const sent = useChatStore((s) => s.sentThisVisit);
  return pickedModel === undefined && !sent;
}
