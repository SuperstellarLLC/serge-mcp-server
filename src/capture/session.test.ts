import { describe, it, expect, afterEach } from 'vitest';
import { startSession, endSession, listSessions, getSessionsDir } from './session.js';
import { rm } from 'fs/promises';
import path from 'path';

describe('session lifecycle', () => {
  const cleanupIds: string[] = [];

  afterEach(async () => {
    for (const id of cleanupIds) {
      await rm(path.join(getSessionsDir(), id), { recursive: true, force: true });
    }
    cleanupIds.length = 0;
  });

  it('startSession creates a valid session state', async () => {
    const state = await startSession('example.com', 'test task');
    cleanupIds.push(state.session.session_id);

    expect(state.session.domain).toBe('example.com');
    expect(state.session.task).toBe('test task');
    expect(state.session.session_id).toMatch(/^\d{4}-\d{2}-\d{2}-example-com-.{12}$/);
    expect(state.session.actions).toHaveLength(0);
    expect(state.session.network).toHaveLength(0);
    expect(state.current_step).toBe(0);
  });

  it('endSession populates final fields and writes JSON', async () => {
    const state = await startSession('example.com', 'end test');
    cleanupIds.push(state.session.session_id);

    const { summary } = await endSession(state, 'success', 'all good');

    expect(summary.outcome).toBe('success');
    expect(summary.notes).toBe('all good');
    expect(summary.ended_at).toBeDefined();
    expect(summary.total_duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('listSessions returns created sessions', async () => {
    const state = await startSession('list-test.com', 'list test');
    cleanupIds.push(state.session.session_id);
    await endSession(state, 'success', 'done');

    const sessions = await listSessions();
    const found = sessions.find(s => s.session_id === state.session.session_id);
    expect(found).toBeDefined();
    expect(found?.domain).toBe('list-test.com');
  });
});
