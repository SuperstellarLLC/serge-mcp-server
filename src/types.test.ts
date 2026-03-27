import { describe, it, expect } from 'vitest';
import type { Session, ActionEvent, NetworkEvent } from './types.js';

describe('types', () => {
  it('Session object satisfies the interface', () => {
    const session: Session = {
      session_id: 'test-123',
      domain: 'example.com',
      task: 'test task',
      started_at: new Date().toISOString(),
      total_steps: 0,
      total_duration_ms: 0,
      actions: [],
      network: [],
    };
    expect(session.session_id).toBe('test-123');
    expect(session.actions).toHaveLength(0);
  });

  it('ActionEvent object satisfies the interface', () => {
    const event: ActionEvent = {
      index: 0,
      timestamp: new Date().toISOString(),
      action: 'navigate',
      params: { url: 'https://example.com' },
      result: { success: true, duration_ms: 100 },
      page_url: 'https://example.com',
      page_title: 'Example',
    };
    expect(event.result.success).toBe(true);
  });

  it('NetworkEvent object satisfies the interface', () => {
    const event: NetworkEvent = {
      timestamp: new Date().toISOString(),
      method: 'GET',
      url: 'https://example.com',
      status: 200,
      response_time_ms: 50,
      content_type: 'text/html',
      size_bytes: 1024,
    };
    expect(event.status).toBe(200);
  });
});
