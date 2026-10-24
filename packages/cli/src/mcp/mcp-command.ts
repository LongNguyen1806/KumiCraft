// `kumicraft mcp [project-dir]` (R-AG-19): an MCP server over stdio for an external AI agent,
// talking to the KumiCraft server that has that project open.
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import envPaths from 'env-paths';

import type { McpOptions } from '../args.ts';
import { createApiClient } from './api-client.ts';
import { createMcpServer } from './mcp-server.ts';
import { locateServer } from './server-locator.ts';

export async function runMcpCommand(options: McpOptions, version: string): Promise<void> {
  const configDir = process.env.KUMICRAFT_CONFIG_DIR ?? envPaths('kumicraft').config;
  const api = createApiClient({
    // Looked up on every call: KumiCraft may start, stop or restart while the agent runs.
    locate: () => locateServer(options, { configDir }),
    projectDir: options.projectDir,
  });
  const server = createMcpServer(api, version);
  server.server.onerror = (error) => {
    console.error(`kumicraft mcp: ${error.message}`);
  };
  await server.connect(new StdioServerTransport());
}
