import { Page } from 'playwright';
import { resolveLocator } from './selectors.js';

const log = (msg: string) => process.stderr.write(`[serge] ${msg}\n`);

export interface NavigateResult {
  url: string;
  title: string;
}

export async function navigate(page: Page, url: string): Promise<NavigateResult> {
  log(`Navigating to ${url}`);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  } catch (err: any) {
    if (err.name === 'TimeoutError') {
      log(`Navigation timeout for ${url}, continuing with partial load`);
    } else {
      throw err;
    }
  }
  return {
    url: page.url(),
    title: await page.title(),
  };
}

export async function readPage(page: Page): Promise<string> {
  log('Reading page accessibility tree');
  const snapshot = await page.locator('body').ariaSnapshot();
  if (snapshot.length > 15000) {
    return snapshot.substring(0, 15000) + '\n\n[Tree truncated. Use serge_scroll or serge_click to explore specific sections.]';
  }
  return snapshot;
}

export interface ClickResult {
  found: boolean;
  tag?: string;
  ariaLabel?: string;
  newUrl?: string;
  error?: string;
}

export async function click(page: Page, role?: string, name?: string): Promise<ClickResult> {
  try {
    const locator = await resolveLocator(page, role, name);
    const tag = await locator.evaluate(el => el.tagName.toLowerCase());
    const ariaLabel = await locator.getAttribute('aria-label');

    const urlBefore = page.url();
    await locator.click({ timeout: 5000 });

    // Wait briefly for any navigation or DOM changes
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 3000 });
    } catch {
      // Timeout is fine — not all clicks trigger navigation
    }

    return {
      found: true,
      tag,
      ariaLabel: ariaLabel ?? undefined,
      newUrl: page.url() !== urlBefore ? page.url() : undefined,
    };
  } catch (err: any) {
    return {
      found: false,
      error: err.message,
    };
  }
}

export interface TypeResult {
  found: boolean;
  fieldType?: string;
  error?: string;
}

export async function type(page: Page, role: string | undefined, name: string, text: string, pressEnter: boolean): Promise<TypeResult> {
  try {
    const locator = await resolveLocator(page, role, name);
    const fieldType = await locator.getAttribute('type') ?? 'text';

    await locator.clear();
    await locator.fill(text);

    if (pressEnter) {
      await page.keyboard.press('Enter');
      try {
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
      } catch {
        // Timeout is fine
      }
    }

    return {
      found: true,
      fieldType,
    };
  } catch (err: any) {
    return {
      found: false,
      error: err.message,
    };
  }
}

export interface ScrollResult {
  scrolledTo: number;
}

export async function scroll(page: Page, direction: 'up' | 'down'): Promise<ScrollResult> {
  const delta = direction === 'down' ? 500 : -500;
  await page.mouse.wheel(0, delta);
  // Brief wait for lazy loading
  await page.waitForTimeout(500);
  const scrollY = await page.evaluate(() => window.scrollY);
  return { scrolledTo: scrollY };
}

export async function screenshot(page: Page): Promise<Buffer> {
  return await page.screenshot({ type: 'png', fullPage: false }) as Buffer;
}
