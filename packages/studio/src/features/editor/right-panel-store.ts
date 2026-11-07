// Shared store for right panel active tab with localStorage persistence (SPEC-04 K5, Section 3.5).
import { useSyncExternalStore } from 'react';

export const RIGHT_PANEL_KEY = 'kumicraft.rightPanelTab';

export type RightPanelTab = 'properties' | 'chat';

export function readRightPanelTab(): RightPanelTab {
  try {
    const saved = localStorage.getItem(RIGHT_PANEL_KEY) ?? undefined;
    if (saved === 'chat') return 'chat';
    return 'properties';
  } catch {
    return 'properties';
  }
}

export function saveRightPanelTab(tab: RightPanelTab): void {
  try {
    localStorage.setItem(RIGHT_PANEL_KEY, tab);
  } catch {
    // Private browsing or quota exceeded
  }
}

const listeners = new Set<() => void>();
// The tab on screen even when storage is blocked (private window): storage only remembers it.
let current: RightPanelTab | undefined;

export function subscribeRightPanelTab(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getRightPanelTab(): RightPanelTab {
  current ??= readRightPanelTab();
  return current;
}

export function setRightPanelTab(tab: RightPanelTab): void {
  current = tab;
  saveRightPanelTab(tab);
  for (const listener of listeners) {
    listener();
  }
}

export function useRightPanelTab(): [RightPanelTab, (tab: RightPanelTab) => void] {
  const tab = useSyncExternalStore(subscribeRightPanelTab, getRightPanelTab);
  return [tab, setRightPanelTab];
}
