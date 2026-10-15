// Unit tests for Vite bridge plugin (SPEC-04 M-BR, R-BR-04, R-BR-05).
import { describe, expect, it } from 'vitest';

import { BRIDGE_CLIENT_CODE } from '../client/bridge-client.generated.ts';
import { createReactCraftBridgePlugin } from './vite.ts';

const options = {
  rootDir: 'D:/test-project',
  sourceDir: 'src',
  nonce: 'test-nonce-1234567890',
  studioOrigin: 'http://127.0.0.1:4173',
};

describe('createReactCraftBridgePlugin', () => {
  it('configures plugin metadata for dev server only [R-BR-04]', () => {
    const plugin = createReactCraftBridgePlugin(options);
    expect(plugin.name).toBe('reactcraft:bridge');
    expect(plugin.apply).toBe('serve');
    expect(plugin.enforce).toBe('pre');
  });

  it('transforms JSX files in sourceDir [R-BR-02]', () => {
    const plugin = createReactCraftBridgePlugin(options);
    const code = 'export function App() { return <div>Hello</div>; }';
    const result = plugin.transform(code, 'D:/test-project/src/App.tsx');
    expect(result).toBeDefined();
    expect(result?.code).toContain('data-rc-loc="src/App.tsx:1:32"');
  });

  it('skips transformation for files outside sourceDir [R-BR-01]', () => {
    const plugin = createReactCraftBridgePlugin(options);
    const code = 'export function App() { return <div>Hello</div>; }';
    const result = plugin.transform(code, 'D:/test-project/scripts/run.ts');
    expect(result).toBeUndefined();
  });

  it('serves the client as a module at /@reactcraft/bridge-client.js, so Vite adds import.meta.hot [R-BR-05, R-BR-17]', () => {
    const plugin = createReactCraftBridgePlugin(options);

    const id = plugin.resolveId('/@reactcraft/bridge-client.js');

    expect(id).toMatch(/^\0/);
    expect(id === undefined ? undefined : plugin.load(id)).toBe(BRIDGE_CLIENT_CODE);
    expect(BRIDGE_CLIENT_CODE).toContain('import.meta.hot');
    expect(plugin.resolveId('/src/main.tsx')).toBeUndefined();
    expect(plugin.load('/src/main.tsx')).toBeUndefined();
  });

  it('injects config JSON script and module script into head [R-BR-05]', () => {
    const plugin = createReactCraftBridgePlugin(options);
    const tags = plugin.transformIndexHtml();
    expect(tags).toHaveLength(2);

    const configTag = tags[0];
    expect(configTag?.tag).toBe('script');
    expect(configTag?.attrs?.['id']).toBe('__rc_bridge');
    expect(configTag?.attrs?.['type']).toBe('application/json');
    expect(configTag?.injectTo).toBe('head-prepend');
    expect(configTag?.children).toBe(
      JSON.stringify({
        nonce: options.nonce,
        studioOrigin: options.studioOrigin,
        root: options.rootDir,
      }),
    );

    const clientTag = tags[1];
    expect(clientTag?.tag).toBe('script');
    expect(clientTag?.attrs?.['type']).toBe('module');
    expect(clientTag?.attrs?.['src']).toBe('/@reactcraft/bridge-client.js');
    expect(clientTag?.injectTo).toBe('head-prepend');
  });
});
