// Style layer API (SPEC-04 section 25.2).
import {
  type BridgeStyleProbePayload,
  type StyleApplyRequest,
  type StyleApplyResult,
  StyleApplyResultSchema,
  type StyleReading,
  StyleReadingSchema,
} from '@reactcraft/shared';

import { apiPost, parseResponse } from './http.ts';

/** R-ST-04: the server maps the Bridge's probe of one element to properties and their sources. */
export async function readStyle(probe: BridgeStyleProbePayload): Promise<StyleReading> {
  return parseResponse(StyleReadingSchema, await apiPost('style/read', { probe }));
}

/** R-ST-06: one Inspector change; the server records it as one history entry (R-ST-15). */
export async function applyStyle(request: StyleApplyRequest): Promise<StyleApplyResult> {
  return parseResponse(StyleApplyResultSchema, await apiPost('style/apply', request));
}
