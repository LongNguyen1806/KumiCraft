// MCP server of `kumicraft mcp` (R-AG-19): registers the tools; each runs through the REST API.
// stdout carries the protocol only; anything else goes to stderr.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { ApiClient } from './api-client.ts';
import { MCP_TOOLS } from './mcp-tools.ts';

export const MCP_INSTRUCTIONS =
  'Build and change the open KumiCraft project with these tools instead of editing files. Read ' +
  'before you write: every edit needs the loc of an element from kumicraft_get_page_tree, and locs ' +
  'change after an edit, so read the tree again before the next one. Each edit is one step the ' +
  'user can undo in the KumiCraft Studio. When you need an operation no tool offers, call ' +
  'kumicraft_report_tool_gap, then continue as best you can.';

type ToolResult = {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
};

const textResult = (text: string, isError = false): ToolResult => ({
  content: [{ type: 'text', text }],
  ...(isError ? { isError: true } : {}),
});

/** The SDK checks the arguments against each tool's schema before `run` sees them. */
export function createMcpServer(api: ApiClient, version: string): McpServer {
  const server = new McpServer(
    { name: 'kumicraft', version },
    { capabilities: { tools: {} }, instructions: MCP_INSTRUCTIONS },
  );
  for (const tool of MCP_TOOLS) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.input },
      async (args: unknown) => {
        const result = await tool.run(api, args);
        if (!result.ok) return textResult(result.message, true);
        return textResult(JSON.stringify(result.data ?? {}, undefined, 2));
      },
    );
  }
  return server;
}
