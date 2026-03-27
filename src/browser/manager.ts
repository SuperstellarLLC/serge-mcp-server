import { chromium, Browser, Page } from 'playwright';
import { execFileSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const log = (msg: string) => process.stderr.write(`[serge] ${msg}\n`);

let browser: Browser | null = null;
let page: Page | null = null;
let networkListener: ((session: any) => void) | null = null;

function isChromiumInstalled(): boolean {
  try {
    const execPath = chromium.executablePath();
    return fs.existsSync(execPath);
  } catch {
    return false;
  }
}

function installChromium(): void {
  log('Chromium not found. Installing via Playwright...');
  execFileSync('npx', ['playwright', 'install', 'chromium'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });
  log('Chromium installed successfully.');
}

export async function getBrowser(): Promise<Browser> {
  if (browser && browser.isConnected()) {
    return browser;
  }

  if (!isChromiumInstalled()) {
    installChromium();
  }

  log('Launching Chromium...');

  // Try headed first, fall back to headless if no display
  let headed = true;
  if (!process.env.DISPLAY && process.platform === 'linux') {
    headed = false;
  }

  browser = await chromium.launch({
    headless: !headed,
    args: [
      '--disable-blink-features=AutomationControlled',
    ],
  });

  log(`Browser launched (${headed ? 'headed' : 'headless'})`);
  return browser;
}

export async function getPage(): Promise<Page> {
  if (page && !page.isClosed()) {
    return page;
  }

  const b = await getBrowser();
  const context = await b.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'en-US',
  });

  page = await context.newPage();
  log('New page created');
  return page;
}

export function getCurrentPage(): Page | null {
  return page && !page.isClosed() ? page : null;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    log('Closing browser...');
    await browser.close();
    browser = null;
    page = null;
    log('Browser closed');
  }
}
