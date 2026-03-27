import { describe, it, expect, afterEach } from 'vitest';
import { generateReport } from './generator.js';
import { readFile, rm } from 'fs/promises';
import type { Session } from '../types.js';

describe('report generator', () => {
  const cleanupFiles: string[] = [];

  afterEach(async () => {
    for (const f of cleanupFiles) {
      await rm(f, { force: true });
    }
    cleanupFiles.length = 0;
  });

  it('generates a self-contained HTML report', async () => {
    const session: Session = {
      session_id: 'test-report-001',
      domain: 'example.com',
      task: 'test report generation',
      started_at: '2026-03-27T10:00:00.000Z',
      ended_at: '2026-03-27T10:01:00.000Z',
      outcome: 'success',
      notes: 'Everything worked',
      total_steps: 2,
      total_duration_ms: 5000,
      actions: [
        {
          index: 0,
          timestamp: '2026-03-27T10:00:01.000Z',
          action: 'navigate',
          params: { url: 'https://example.com' },
          result: { success: true, duration_ms: 1200, url_after: 'https://example.com', triggered_navigation: true },
          page_url: 'https://example.com',
          page_title: 'Example',
        },
        {
          index: 1,
          timestamp: '2026-03-27T10:00:03.000Z',
          action: 'click',
          params: { role: 'button', name: 'Submit' },
          result: { success: false, duration_ms: 300, error: 'Element not found', element_found: false },
          page_url: 'https://example.com',
          page_title: 'Example',
        },
      ],
      network: [
        {
          timestamp: '2026-03-27T10:00:01.000Z',
          method: 'GET',
          url: 'https://example.com',
          status: 200,
          response_time_ms: 800,
          content_type: 'text/html',
          size_bytes: 15000,
        },
      ],
    };

    const reportPath = await generateReport(session);
    cleanupFiles.push(reportPath);

    const html = await readFile(reportPath, 'utf-8');

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Serge');
    expect(html).toContain('example.com');
    expect(html).toContain('test report generation');
    expect(html).toContain('Success');
    expect(html).toContain('Element not found');
    expect(html).toContain('navigate');
    expect(html).toContain('click');
  });

  it('escapes HTML in user-controlled fields to prevent XSS', async () => {
    const xssPayload = '<img src=x onerror=alert(1)>';
    const session: Session = {
      session_id: 'test-report-xss',
      domain: xssPayload,
      task: xssPayload,
      started_at: '2026-03-27T10:00:00.000Z',
      ended_at: '2026-03-27T10:01:00.000Z',
      outcome: 'failure',
      notes: xssPayload,
      total_steps: 1,
      total_duration_ms: 1000,
      actions: [
        {
          index: 0,
          timestamp: '2026-03-27T10:00:01.000Z',
          action: 'click',
          params: { name: xssPayload },
          result: { success: false, duration_ms: 100, error: xssPayload },
          page_url: `https://evil.com?q=${xssPayload}`,
          page_title: 'Test',
        },
      ],
      network: [
        {
          timestamp: '2026-03-27T10:00:01.000Z',
          method: 'GET',
          url: `https://evil.com?q=${xssPayload}`,
          status: 200,
          response_time_ms: 100,
          content_type: 'text/html',
          size_bytes: 500,
        },
      ],
    };

    const reportPath = await generateReport(session);
    cleanupFiles.push(reportPath);

    const html = await readFile(reportPath, 'utf-8');

    // The raw XSS payload must NOT appear unescaped anywhere in the HTML
    expect(html).not.toContain(xssPayload);
    // The escaped version must be present
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});
