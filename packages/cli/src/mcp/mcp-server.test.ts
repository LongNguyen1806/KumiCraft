// `reactcraft mcp` seen by a real MCP client (R-AG-19, R-AG-20): tool list, calls through the REST
// API with the session token, readable errors, and nothing on stdout but the protocol.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApiClient } from './api-client.ts';
import { createMcpServer } from './mcp-server.ts';
import type { ServerAddress } from './server-locator.ts';

const ADDRESS: ServerAddress = { port: 4310, token: 'tok-mcp-test' };

type Call = { readonly url: string; readonly init: RequestInit | undefined };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function connect(
  answer: (url: string, init: RequestInit | undefined) => Response | Promise<Response>,
  running = true,
) {
  const address: ServerAddress | undefined = running ? ADDRESS : undefined;
  const calls: Call[] = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, init });
    return answer(url, init);
  };
  const api = createApiClient({
    locate: () => Promise.resolve(address),
    projectDir: 'D:/ws',
    fetch: fakeFetch,
  });
  const server = createMcpServer(api, '0.0.0-test');
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await client.connect(clientSide);
  return { client, calls };
}

function textOf(result: Awaited<ReturnType<Client['callTool']>>): string {
  const content = Array.isArray(result.content) ? result.content : [];
  const first: unknown = content[0];
  if (typeof first !== 'object' || !first || !('text' in first)) return '';
  return typeof first.text === 'string' ? first.text : '';
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('reactcraft mcp server [R-AG-19]', () => {
  it('lists the read, edit and report tools with object input schemas [R-AG-19]', async () => {
    const { client } = await connect(() => jsonResponse(200, { data: {} }));

    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'reactcraft_create_page',
      'reactcraft_duplicate_elements',
      'reactcraft_get_element',
      'reactcraft_get_page_tree',
      'reactcraft_get_project',
      'reactcraft_get_theme',
      'reactcraft_insert_image',
      'reactcraft_insert_jsx',
      'reactcraft_list_assets',
      'reactcraft_list_components',
      'reactcraft_list_files',
      'reactcraft_list_pages',
      'reactcraft_list_tool_gaps',
      'reactcraft_move_elements',
      'reactcraft_redo',
      'reactcraft_remove_elements',
      'reactcraft_report_tool_gap',
      'reactcraft_set_attribute',
      'reactcraft_set_class_name',
      'reactcraft_set_text',
      'reactcraft_set_theme_token',
      'reactcraft_undo',
      'reactcraft_unwrap_element',
      'reactcraft_update_classes',
      'reactcraft_wrap_elements',
    ]);
    for (const tool of tools) {
      expect(tool.description?.length ?? 0).toBeGreaterThan(10);
      expect(tool.inputSchema.type).toBe('object');
    }
    expect(client.getInstructions()).toContain('reactcraft_report_tool_gap');
  });

  it('asks the server for the page tree with the session token [R-AG-19]', async () => {
    const tree = { file: 'src/pages/Home.tsx', roots: [], truncated: false };
    const { client, calls } = await connect(() => jsonResponse(200, { data: tree }));

    const result = await client.callTool({
      name: 'reactcraft_get_page_tree',
      arguments: { file: 'src/pages/Home.tsx' },
    });

    expect(calls[0]?.url).toBe(
      'http://127.0.0.1:4310/api/v1/source/tree?file=src%2Fpages%2FHome.tsx',
    );
    expect(new Headers(calls[0]?.init?.headers).get('authorization')).toBe('Bearer tok-mcp-test');
    expect(result.isError).not.toBe(true);
    expect(JSON.parse(textOf(result))).toEqual(tree);
  });

  it('turns API errors and a stopped ReactCraft into readable tool errors [R-AG-19]', async () => {
    const refused = await connect(() => jsonResponse(409, { error: { code: 'E011' } }));
    const stopped = await connect(() => jsonResponse(200, {}), false);
    const unreachable = await connect(() => Promise.reject(new TypeError('fetch failed')));

    const untrusted = await refused.client.callTool({
      name: 'reactcraft_list_pages',
      arguments: {},
    });
    const notRunning = await stopped.client.callTool({
      name: 'reactcraft_list_pages',
      arguments: {},
    });
    const down = await unreachable.client.callTool({ name: 'reactcraft_get_theme', arguments: {} });

    expect(untrusted.isError).toBe(true);
    expect(textOf(untrusted)).toMatch(/^E011: The project is not trusted/);
    expect(notRunning.isError).toBe(true);
    expect(textOf(notRunning)).toContain('No ReactCraft session has the project D:/ws open');
    expect(textOf(down)).toContain('No ReactCraft session has the project');
    expect(stopped.calls).toEqual([]);
  });

  it('records a tool gap and lists it back [R-AG-20]', async () => {
    const saved: unknown[] = [];
    const { client, calls } = await connect((_url, init) => {
      if (init?.method === 'POST' && typeof init.body === 'string') {
        const body: unknown = JSON.parse(init.body);
        saved.push(body);
        return jsonResponse(201, { data: body });
      }
      return jsonResponse(200, { data: saved });
    });

    await client.callTool({
      name: 'reactcraft_report_tool_gap',
      arguments: { need: 'Set text color', why: 'no edit tools yet', example: 'h1 red' },
    });
    const listed = await client.callTool({ name: 'reactcraft_list_tool_gaps', arguments: {} });

    expect(calls[0]?.url).toBe('http://127.0.0.1:4310/api/v1/tool-gaps');
    expect(new Headers(calls[0]?.init?.headers).get('content-type')).toBe('application/json');
    expect(JSON.parse(textOf(listed))).toEqual([
      { need: 'Set text color', why: 'no edit tools yet', example: 'h1 red' },
    ]);
  });

  it('writes nothing to stdout, even when a call fails [R-AG-19]', async () => {
    const write = vi.spyOn(process.stdout, 'write');
    const { client } = await connect(() => jsonResponse(500, { error: { code: 'E013' } }));

    const result = await client.callTool({ name: 'reactcraft_get_project', arguments: {} });
    const invalid = await client.callTool({ name: 'reactcraft_get_element', arguments: {} });

    expect(result.isError).toBe(true);
    expect(invalid.isError).toBe(true);
    expect(write).not.toHaveBeenCalled();
  });
});
