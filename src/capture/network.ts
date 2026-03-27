import type { Page, Request, Response } from 'playwright';
import type { NetworkEvent } from '../types.js';

const log = (msg: string) => process.stderr.write(`[serge] ${msg}\n`);

const MAX_PENDING_REQUESTS = 1000;
const MAX_NETWORK_EVENTS = 5000;

const pendingRequests = new Map<Request, { timestamp: string; startTime: number }>();

export function resetNetworkState(): void {
  pendingRequests.clear();
}

export function attachNetworkListeners(page: Page, networkEvents: NetworkEvent[]): void {
  page.on('request', (request: Request) => {
    // Evict oldest entry if map is full to prevent unbounded growth
    if (pendingRequests.size >= MAX_PENDING_REQUESTS) {
      const oldest = pendingRequests.keys().next().value;
      if (oldest) pendingRequests.delete(oldest);
    }

    pendingRequests.set(request, {
      timestamp: new Date().toISOString(),
      startTime: performance.now(),
    });
  });

  page.on('response', async (response: Response) => {
    const request = response.request();
    const pending = pendingRequests.get(request);
    if (!pending) return;

    pendingRequests.delete(request);

    // Cap stored events to prevent unbounded memory growth
    if (networkEvents.length >= MAX_NETWORK_EVENTS) return;

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

  page.on('requestfailed', (request: Request) => {
    pendingRequests.delete(request);
  });

  log('Network listeners attached');
}
