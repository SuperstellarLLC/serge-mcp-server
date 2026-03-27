// Tool definitions are registered directly in server.ts using the McpServer.tool() API.
// This file exports the tool metadata for reference and reuse.

export const TOOLS = {
  serge_start_session: {
    description: 'Start a Serge benchmarking session to measure how well a website works for AI agents. Call this before browsing. The session tracks timing, screenshots, and interaction quality for every step.',
    params: {
      domain: { type: 'string' as const, description: 'Target domain to benchmark (e.g. "digitec.ch")' },
      task: { type: 'string' as const, description: 'What you are trying to accomplish (e.g. "buy AA batteries")' },
    },
    required: ['domain', 'task'] as const,
  },

  serge_navigate: {
    description: 'Navigate the browser to a URL. Returns page title and accessibility tree summary.',
    params: {
      url: { type: 'string' as const, description: 'URL to navigate to' },
    },
    required: ['url'] as const,
  },

  serge_read_page: {
    description: 'Read the current page content as a structured accessibility tree. Use this to understand what elements are on the page before interacting.',
    params: {},
    required: [] as const,
  },

  serge_click: {
    description: 'Click an element on the page identified by its accessibility role and name.',
    params: {
      role: { type: 'string' as const, description: 'ARIA role: button, link, searchbox, textbox, menuitem, tab, checkbox, radio, combobox, option, heading, img, etc.' },
      name: { type: 'string' as const, description: 'Accessible name of the element (visible text, aria-label, or title)' },
    },
    required: ['name'] as const,
  },

  serge_type: {
    description: 'Type text into a form field. Clears existing content first.',
    params: {
      role: { type: 'string' as const, description: 'ARIA role of the input (textbox, searchbox, combobox, etc.)' },
      name: { type: 'string' as const, description: 'Accessible name of the field' },
      text: { type: 'string' as const, description: 'Text to type' },
      pressEnter: { type: 'boolean' as const, description: 'Press Enter after typing (useful for search fields). Default: false' },
    },
    required: ['name', 'text'] as const,
  },

  serge_scroll: {
    description: 'Scroll the page up or down.',
    params: {
      direction: { type: 'string' as const, description: 'Scroll direction: "up" or "down"' },
    },
    required: ['direction'] as const,
  },

  serge_screenshot: {
    description: 'Take a screenshot of the current page and return it as an image. Use when you need to visually inspect the page.',
    params: {},
    required: [] as const,
  },

  serge_end_session: {
    description: 'End the benchmarking session. Generates a performance report. Call this when the task is complete or when you determine it cannot be completed.',
    params: {
      outcome: { type: 'string' as const, description: 'Whether the task was completed: "success", "failure", or "partial"' },
      notes: { type: 'string' as const, description: 'Summary of what happened and any issues encountered' },
    },
    required: ['outcome', 'notes'] as const,
  },
} as const;
