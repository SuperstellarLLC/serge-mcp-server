import type { Page } from 'playwright';
import { writeFile } from 'fs/promises';
import path from 'path';
import type { SessionState } from '../types.js';

const log = (msg: string) => process.stderr.write(`[serge] ${msg}\n`);

export async function captureScreenshot(page: Page, state: SessionState): Promise<string> {
  const stepNum = String(state.current_step).padStart(3, '0');
  const filename = `step-${stepNum}.png`;
  const filepath = path.join(state.screenshots_dir, filename);

  try {
    const buffer = await page.screenshot({ type: 'png', fullPage: false });
    await writeFile(filepath, buffer);
    log(`Screenshot saved: ${filename}`);
    return filepath;
  } catch (err: unknown) {
    log(`Screenshot failed: ${err instanceof Error ? err.message : String(err)}`);
    return '';
  }
}
