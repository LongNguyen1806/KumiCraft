// Event bus port for broadcasting server-sent WebSocket events (SPEC-03 section 6).

export type ServerEvent<T extends string = string, P = unknown> = {
  readonly v: 1;
  readonly type: T;
  readonly at: string; // ISO 8601 UTC
  readonly correlationId?: string;
  readonly payload: P;
};

export type WorkspaceSavedPayload = {
  readonly revision: number;
  readonly files: readonly string[];
};

export type WorkspaceExternalChangePayload = {
  readonly files: readonly string[];
  readonly truncated?: boolean;
};

export interface EventBusPort {
  publish(type: string, payload: unknown, correlationId?: string): void;
  subscribe(listener: (event: ServerEvent) => void): () => void;
}

export function createEventBus(): EventBusPort {
  const listeners = new Set<(event: ServerEvent) => void>();

  return {
    publish(type: string, payload: unknown, correlationId?: string): void {
      const event: ServerEvent = {
        v: 1,
        type,
        at: new Date().toISOString(),
        ...(correlationId === undefined ? {} : { correlationId }),
        payload,
      };
      for (const listener of listeners) {
        listener(event);
      }
    },

    subscribe(listener: (event: ServerEvent) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
