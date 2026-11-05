// Helper to generate Bridge HTML head injection (SPEC-04 M-BR, Section 3.5).
import { BRIDGE_CLIENT_URL } from './vite.ts';

export type BridgeHeadHtmlOptions = {
  readonly nonce: string;
  readonly studioOrigin: string;
  readonly rootDir?: string | undefined;
  readonly root?: string | undefined;
  readonly navigation?: 'history' | 'document' | undefined;
  readonly cspNonce?: string | undefined;
};

export function bridgeHeadHtml(options: BridgeHeadHtmlOptions): string {
  const root = options.rootDir ?? options.root ?? '';
  const payload: Record<string, unknown> = {
    nonce: options.nonce,
    studioOrigin: options.studioOrigin,
    root,
  };
  if (options.navigation !== undefined) {
    payload.navigation = options.navigation;
  }
  const safeJson = JSON.stringify(payload).replace(/</g, '\\u003c');
  const nonceAttr = options.cspNonce !== undefined ? ` nonce="${options.cspNonce}"` : '';
  return `<script type="application/json" id="__rc_bridge"${nonceAttr}>${safeJson}</script>\n<script type="module" src="${BRIDGE_CLIENT_URL}"${nonceAttr}></script>`;
}
