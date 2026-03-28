import { getPage, closeBrowser } from '../browser/manager.js';
import * as actions from '../browser/actions.js';
import { startSession, endSession } from '../capture/session.js';
import type { SessionState } from '../types.js';
import { captureAction } from '../capture/events.js';
import { attachNetworkListeners, resetNetworkState } from '../capture/network.js';
import { generateReport } from '../report/generator.js';
import open from 'open';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

let activeSession: SessionState | null = null;
let sessionTimer: ReturnType<typeof setTimeout> | null = null;

function clearSessionTimer(): void {
  if (sessionTimer) {
    clearTimeout(sessionTimer);
    sessionTimer = null;
  }
}

async function forceEndSession(): Promise<void> {
  if (!activeSession) return;
  process.stderr.write('[serge] Session timed out after 30 minutes. Forcing cleanup.\n');
  try {
    await endSession(activeSession, 'failure', 'Session timed out after 30 minutes');
    await generateReport(activeSession.session);
  } catch {
    // Best effort
  }
  await closeBrowser();
  resetNetworkState();
  activeSession = null;
}

function requireSession(): SessionState {
  if (!activeSession) {
    throw new Error('No active session. Call serge_start_session first to begin a benchmarking session.');
  }
  return activeSession;
}

export async function handleStartSession(args: { domain: string; task: string }) {
  if (activeSession) {
    return {
      content: [{ type: 'text' as const, text: 'A session is already active. End the current session with serge_end_session before starting a new one.' }],
    };
  }

  activeSession = await startSession(args.domain, args.task);

  // Launch browser and attach network listeners
  const page = await getPage();
  attachNetworkListeners(page, activeSession.session.network);

  // Start session timeout
  clearSessionTimer();
  sessionTimer = setTimeout(() => { void forceEndSession(); }, SESSION_TIMEOUT_MS);

  return {
    content: [{
      type: 'text' as const,
      text: `Serge session started.\nSession ID: ${activeSession.session.session_id}\nDomain: ${args.domain}\nTask: ${args.task}\n\nYou can now use serge_navigate, serge_click, serge_type, serge_scroll, serge_read_page, and serge_screenshot. When done, call serge_end_session.`,
    }],
  };
}

export async function handleNavigate(args: { url: string }) {
  const session = requireSession();
  const page = await getPage();

  const event = await captureAction(page, session, 'navigate', { url: args.url }, async () => {
    const result = await actions.navigate(page, args.url);
    return { url_after: result.url, triggered_navigation: true };
  });

  // Auto-read the page after navigation
  let tree = '';
  try {
    tree = await actions.readPage(page);
  } catch {
    tree = '[Could not read accessibility tree]';
  }

  const status = event.result.success
    ? `Navigated to ${page.url()}\nPage title: ${await page.title()}`
    : `Navigation failed: ${event.result.error}`;

  return {
    content: [
      { type: 'text' as const, text: `${status}\n\nAccessibility tree:\n${tree}` },
    ],
  };
}

export async function handleReadPage() {
  const session = requireSession();
  const page = await getPage();

  await captureAction(page, session, 'read_page', {}, async () => {
    return {};
  });

  const tree = await actions.readPage(page);

  return {
    content: [
      { type: 'text' as const, text: tree },
    ],
  };
}

export async function handleClick(args: { role?: string; name: string }) {
  const session = requireSession();
  const page = await getPage();

  const event = await captureAction(page, session, 'click', args, async () => {
    const result = await actions.click(page, args.role, args.name);
    if (!result.found) {
      throw new Error(result.error ?? 'Element not found');
    }
    return {
      element_found: true,
      element_tag: result.tag,
      element_aria_label: result.ariaLabel,
      url_after: result.newUrl,
      triggered_navigation: !!result.newUrl,
    };
  });

  if (!event.result.success) {
    return {
      content: [{ type: 'text' as const, text: `Click failed: ${event.result.error}\n\nTip: Use serge_read_page to see available elements.` }],
    };
  }

  let response = `Clicked ${args.role ?? 'element'}: "${args.name}"`;
  if (event.result.url_after) {
    response += `\nNavigated to: ${event.result.url_after}`;
  }

  // Auto-read page after click
  let tree = '';
  try {
    tree = await actions.readPage(page);
  } catch {
    tree = '[Could not read accessibility tree]';
  }

  return {
    content: [
      { type: 'text' as const, text: `${response}\n\nAccessibility tree:\n${tree}` },
    ],
  };
}

export async function handleType(args: { role?: string; name: string; text: string; pressEnter?: boolean }) {
  const session = requireSession();
  const page = await getPage();

  const event = await captureAction(page, session, 'type', args, async () => {
    const result = await actions.type(page, args.role, args.name, args.text, args.pressEnter ?? false);
    if (!result.found) {
      throw new Error(result.error ?? 'Field not found');
    }
    return { element_found: true };
  });

  if (!event.result.success) {
    return {
      content: [{ type: 'text' as const, text: `Type failed: ${event.result.error}\n\nTip: Use serge_read_page to see available form fields.` }],
    };
  }

  let response = `Typed "${args.text}" into "${args.name}"`;
  if (args.pressEnter) {
    response += ' and pressed Enter';

    // Read page after Enter since it may trigger navigation
    let tree = '';
    try {
      tree = await actions.readPage(page);
    } catch {
      tree = '[Could not read accessibility tree]';
    }
    return {
      content: [{ type: 'text' as const, text: `${response}\n\nAccessibility tree:\n${tree}` }],
    };
  }

  return {
    content: [{ type: 'text' as const, text: response }],
  };
}

export async function handleScroll(args: { direction: string }) {
  const session = requireSession();
  const page = await getPage();

  await captureAction(page, session, 'scroll', args, async () => {
    const result = await actions.scroll(page, args.direction as 'up' | 'down');
    return { scrolledTo: result.scrolledTo };
  });

  // Read page after scroll
  let tree = '';
  try {
    tree = await actions.readPage(page);
  } catch {
    tree = '[Could not read accessibility tree]';
  }

  return {
    content: [
      { type: 'text' as const, text: `Scrolled ${args.direction}.\n\nAccessibility tree:\n${tree}` },
    ],
  };
}

export async function handleScreenshot() {
  const session = requireSession();
  const page = await getPage();

  const buffer = await actions.screenshot(page);

  // Also capture as an event
  await captureAction(page, session, 'screenshot', {}, async () => ({}));

  return {
    content: [
      { type: 'text' as const, text: `Screenshot of ${page.url()}` },
      { type: 'image' as const, data: buffer.toString('base64'), mimeType: 'image/png' },
    ],
  };
}

export async function handleEndSession(args: { outcome: string; notes: string }) {
  const session = requireSession();

  const { session_id, report_path, summary } = await endSession(
    session,
    args.outcome as 'success' | 'failure' | 'partial',
    args.notes
  );

  // Generate the HTML report and open it in the browser
  const reportFile = await generateReport(summary);
  open(reportFile).catch((_: unknown) => { /* best effort */ });

  // Cleanup
  clearSessionTimer();
  resetNetworkState();
  await closeBrowser();
  activeSession = null;

  const failures = summary.actions.filter(a => !a.result.success).length;

  return {
    content: [{
      type: 'text' as const,
      text: `Session ended.\n\nSession ID: ${session_id}\nOutcome: ${args.outcome}\nTotal steps: ${summary.total_steps}\nTotal time: ${(summary.total_duration_ms / 1000).toFixed(1)}s\nFailures: ${failures}\n\nReport saved to: ${report_path}\n\nThe user can view the report by running:\n  npx @serge-ai/mcp-server report`,
    }],
  };
}
