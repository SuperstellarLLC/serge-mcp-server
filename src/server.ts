import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  handleStartSession,
  handleNavigate,
  handleReadPage,
  handleClick,
  handleType,
  handleScroll,
  handleScreenshot,
  handleEndSession,
} from './tools/handlers.js';

const log = (msg: string) => process.stderr.write(`[serge] ${msg}\n`);

export async function startServer(): Promise<void> {
  const server = new McpServer({
    name: 'serge',
    version: '0.1.0',
  });

  // serge_start_session
  server.tool(
    'serge_start_session',
    'Start a Serge benchmarking session to measure how well a website works for AI agents. Call this before browsing. The session tracks timing, screenshots, and interaction quality for every step.',
    {
      domain: z.string().describe('Target domain to benchmark (e.g. "digitec.ch")'),
      task: z.string().describe('What you are trying to accomplish (e.g. "buy AA batteries")'),
    },
    async (args) => handleStartSession(args)
  );

  // serge_navigate
  server.tool(
    'serge_navigate',
    'Navigate the browser to a URL. Returns page title and accessibility tree summary.',
    {
      url: z.string().describe('URL to navigate to'),
    },
    async (args) => handleNavigate(args)
  );

  // serge_read_page
  server.tool(
    'serge_read_page',
    'Read the current page content as a structured accessibility tree. Use this to understand what elements are on the page before interacting.',
    {},
    async () => handleReadPage()
  );

  // serge_click
  server.tool(
    'serge_click',
    'Click an element on the page identified by its accessibility role and name.',
    {
      role: z.string().optional().describe('ARIA role: button, link, searchbox, textbox, menuitem, tab, checkbox, radio, combobox, option, heading, img, etc.'),
      name: z.string().describe('Accessible name of the element (visible text, aria-label, or title)'),
    },
    async (args) => handleClick(args)
  );

  // serge_type
  server.tool(
    'serge_type',
    'Type text into a form field. Clears existing content first.',
    {
      role: z.string().optional().describe('ARIA role of the input (textbox, searchbox, combobox, etc.)'),
      name: z.string().describe('Accessible name of the field'),
      text: z.string().describe('Text to type'),
      pressEnter: z.boolean().optional().describe('Press Enter after typing (useful for search fields). Default: false'),
    },
    async (args) => handleType(args)
  );

  // serge_scroll
  server.tool(
    'serge_scroll',
    'Scroll the page up or down.',
    {
      direction: z.enum(['up', 'down']).describe('Scroll direction'),
    },
    async (args) => handleScroll(args)
  );

  // serge_screenshot
  server.tool(
    'serge_screenshot',
    'Take a screenshot of the current page and return it as an image. Use when you need to visually inspect the page.',
    {},
    async () => handleScreenshot()
  );

  // serge_end_session
  server.tool(
    'serge_end_session',
    'End the benchmarking session. Generates a performance report. Call this when the task is complete or when you determine it cannot be completed.',
    {
      outcome: z.enum(['success', 'failure', 'partial']).describe('Whether the task was completed'),
      notes: z.string().describe('Summary of what happened and any issues encountered'),
    },
    async (args) => handleEndSession(args)
  );

  // Start on stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('Serge MCP server started on stdio');
}
