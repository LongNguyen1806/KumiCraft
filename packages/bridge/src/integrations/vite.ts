// Vite plugin bridge connecting target project dev server to ReactCraft Studio (SPEC-04 M-BR, R-BR-04, R-BR-05).
import { BRIDGE_CLIENT_CODE } from '../client/bridge-client.generated.ts';
import { transformJsx } from '../transform/transform-jsx.ts';

export type BridgePluginOptions = {
  readonly rootDir: string;
  readonly sourceDir: string;
  readonly nonce: string;
  readonly studioOrigin: string;
  readonly sourceExtensions?: readonly string[] | undefined;
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

    resolveId(id: string): string | undefined {
      return id === BRIDGE_CLIENT_URL ? BRIDGE_CLIENT_ID : undefined;
    },

    load(id: string): string | undefined {
      return id === BRIDGE_CLIENT_ID ? BRIDGE_CLIENT_CODE : undefined;
    },

    transformIndexHtml(): readonly HtmlTagDescriptor[] {
      return createIndexHtmlTags(options);
    },
  };
}
