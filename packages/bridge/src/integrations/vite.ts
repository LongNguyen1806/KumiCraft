// Vite plugin bridge connecting target project dev server to ReactCraft Studio (SPEC-04 M-BR, R-BR-04, R-BR-05).
import { BRIDGE_CLIENT_CODE } from '../client/bridge-client.generated.ts';
import { transformJsx } from '../transform/transform-jsx.ts';
import { createDraftPageHooks, type DraftDevServer } from './draft-page.ts';

export type BridgePluginOptions = {
  readonly rootDir: string;
  readonly sourceDir: string;
  readonly nonce: string;
  readonly studioOrigin: string;
  readonly sourceExtensions?: readonly string[] | undefined;
  /** Drafts folder served at `/__reactcraft/draft` (R-DR-12); absent: no draft page. */
  readonly draftsDir?: string | undefined;
  /** The project's global CSS entries, loaded by the draft page (R-DR-12, Round S1). */
  readonly globalCss?: readonly string[] | undefined;
};

/** The URL the page loads; served as a module so Vite gives it `import.meta.hot` (R-BR-17). */
export const BRIDGE_CLIENT_URL = '/@reactcraft/bridge-client.js';
const BRIDGE_CLIENT_ID = '\0reactcraft-bridge-client';

export type HtmlTagDescriptor = {
  readonly tag: string;
  readonly attrs?: Record<string, string | boolean | undefined> | undefined;
  readonly children?: string | undefined;
  readonly injectTo?: 'head' | 'body' | 'head-prepend' | 'body-prepend' | undefined;
};

function createIndexHtmlTags(options: BridgePluginOptions): readonly HtmlTagDescriptor[] {
  return [
    {
      tag: 'script',
      attrs: {
        type: 'application/json',
        id: '__rc_bridge',
      },
      children: JSON.stringify({
        nonce: options.nonce,
        studioOrigin: options.studioOrigin,
        root: options.rootDir,
      }),
      injectTo: 'head-prepend',
    },
    {
      tag: 'script',
      attrs: {
        type: 'module',
        src: BRIDGE_CLIENT_URL,
      },
      injectTo: 'head-prepend',
    },
  ];
}

export function createReactCraftBridgePlugin(options: BridgePluginOptions) {
  const draftPage = createDraftPageHooks(options);

  return {
    name: 'reactcraft:bridge',
    apply: 'serve' as const,
    enforce: 'pre' as const,

    // R-BR-02, VG-15: run before every other transform. With Vite 7, @vitejs/plugin-react (also
    // `enforce: 'pre'`, listed first by the project's config) prepends the Fast Refresh preamble;
    // reading that code would put every `data-rc-loc` some 19 lines off the file on disk.
    transform: {
      order: 'pre' as const,
      handler(code: string, id: string) {
        return transformJsx(code, id, {
          rootDir: options.rootDir,
          sourceDir: options.sourceDir,
          ...(options.sourceExtensions === undefined
            ? {}
            : { sourceExtensions: options.sourceExtensions }),
        });
      },
    },

    // R-DR-12: the draft preview page at `/__reactcraft/draft`.
    configureServer(server: DraftDevServer): void {
      draftPage.configureServer(server);
    },

    resolveId(id: string): string | undefined {
      return id === BRIDGE_CLIENT_URL ? BRIDGE_CLIENT_ID : draftPage.resolveId(id);
    },

    load(id: string): string | Promise<string> | undefined {
      return id === BRIDGE_CLIENT_ID ? BRIDGE_CLIENT_CODE : draftPage.load(id);
    },

    transformIndexHtml(): readonly HtmlTagDescriptor[] {
      return createIndexHtmlTags(options);
    },
  };
}
