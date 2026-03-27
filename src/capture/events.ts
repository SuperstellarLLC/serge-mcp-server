import type { Page } from 'playwright';
import type { ActionEvent, SessionState } from '../types.js';
import { captureScreenshot } from './screenshots.js';

const log = (msg: string) => process.stderr.write(`[serge] ${msg}\n`);

export async function captureAction(
  page: Page,
  state: SessionState,
  actionName: ActionEvent['action'],
  params: Record<string, unknown>,
  executeFn: () => Promise<Record<string, unknown>>
): Promise<ActionEvent> {
  const startTime = performance.now();

  try {
    const result = await executeFn();
    const duration = Math.round(performance.now() - startTime);

    const screenshotPath = await captureScreenshot(page, state);

    const event: ActionEvent = {
      index: state.current_step++,
      timestamp: new Date().toISOString(),
      action: actionName,
      params,
      result: {
        success: true,
        duration_ms: duration,
        ...result,
      },
      screenshot_path: screenshotPath,
      page_url: page.url(),
      page_title: await page.title(),
    };

    state.session.actions.push(event);
    log(`Action captured: ${actionName} (${duration}ms)`);
    return event;
  } catch (err: unknown) {
    const duration = Math.round(performance.now() - startTime);

    const screenshotPath = await captureScreenshot(page, state).catch(() => '');

    const event: ActionEvent = {
      index: state.current_step++,
      timestamp: new Date().toISOString(),
      action: actionName,
      params,
      result: {
        success: false,
        duration_ms: duration,
        error: err instanceof Error ? err.message : String(err),
      },
      screenshot_path: screenshotPath,
      page_url: page.url(),
      page_title: await page.title().catch(() => ''),
    };

    state.session.actions.push(event);
    log(`Action failed: ${actionName} - ${err instanceof Error ? err.message : String(err)}`);
    return event;
  }
}
