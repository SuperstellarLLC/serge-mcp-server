import { Page, Request, Response } from 'playwright';
import { NetworkEvent } from '../types.js';

const log = (msg: string) => process.stderr.write(`[serge] ${msg}\n`);

const pendingRequests = new Map<string, { timestamp: string; startTime: number }>();

export function attachNetworkListeners(page: Page, networkEvents: NetworkEvent[]): void {
  page.on('request', (request: Request) => {
    pendingRequests.set(request.url() + request.method(), {
      timestamp: new Date().toISOString(),
      startTime: performance.now(),
    });
  });

  page.on('response', async (response: Response) => {
    const key = response.url() + response.request().method();
    const pending = pendingRequests.get(key);
    if (!pending) return;

    pendingRequests.delete(key);

    let sizeBytes = 0;
    try {
      const body = await response.body();
      sizeBytes = body.length;
    } catch {
      // Response body may not be available
    }

    const event: NetworkEvent = {
      timestamp: pending.timestamp,
      method: response.request().method(),
      url: response.url(),
      status: response.status(),
      response_time_ms: Math.round(performance.now() - pending.startTime),
      content_type: response.headers()['content-type'] ?? '',
      size_bytes: sizeBytes,
    };

    networkEvents.push(event);
  });

  log('Network listeners attached');
}
