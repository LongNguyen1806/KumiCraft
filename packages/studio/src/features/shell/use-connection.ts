// Connection to the server through the event WebSocket (SPEC-04.1 section 6.1, last row).
import { useEffect, useRef, useState } from 'react';

import { createEventsClient } from '../../api/events-client.ts';

/** `offline` only after the socket was open once, so a slow first connect shows no overlay. */
export type ConnectionState = 'connecting' | 'online' | 'offline';

/**
 * Opens the event socket while `enabled`. `onReconnect` runs when the socket comes back after a
 * loss, so the Studio can read the session again (the server may have restarted).
 */
export function useConnection(enabled: boolean, onReconnect: () => void): ConnectionState {
  const [state, setState] = useState<ConnectionState>('connecting');
  const reconnect = useRef(onReconnect);

  useEffect(() => {
    reconnect.current = onReconnect;
  });

  useEffect(() => {
    if (!enabled) return undefined;
    let wasOnline = false;
    const client = createEventsClient({
      onConnectionChange: (connected) => {
        if (connected && wasOnline) reconnect.current();
        if (connected) wasOnline = true;
        setState(connected ? 'online' : wasOnline ? 'offline' : 'connecting');
      },
    });
    return () => {
      client.close();
    };
  }, [enabled]);

  return state;
}
