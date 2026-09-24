import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentData } from '../src/lib/domain';
import { clearData, exportData, loadData, parseImport, saveData } from '../src/lib/storage';

const fixture: AgentData = {
  schemaVersion: 1,
  profile: { name: 'Ada', about: 'Writer', preferences: 'Short answers', goals: ['Publish weekly'] },
  memories: [{ id: 'm1', text: 'I write on Fridays', createdAt: '2026-09-25T00:00:00.000Z', updatedAt: '2026-09-25T00:00:00.000Z' }],
  tasks: [{ id: 't1', title: 'Outline article', notes: '', completed: false, createdAt: '2026-09-25T00:00:00.000Z', updatedAt: '2026-09-25T00:00:00.000Z' }],
  conversation: [{ id: 'c1', role: 'user', content: 'Help me plan', createdAt: '2026-09-25T00:00:00.000Z' }],
};

beforeEach(async () => { await clearData(); });

describe('local agent data', () => {
  it('round-trips profile, memories, tasks, and conversation', async () => {
    await saveData(fixture);
    expect(await loadData()).toEqual(fixture);
  });

  it('round-trips a versioned JSON export', () => {
    expect(parseImport(exportData(fixture))).toEqual(fixture);
  });

  it('keeps existing data after invalid or future-version imports', async () => {
    await saveData(fixture);
    expect(() => parseImport('{')).toThrow();
    expect(() => parseImport(JSON.stringify({ ...fixture, schemaVersion: 999 }))).toThrow();
    expect(await loadData()).toEqual(fixture);
  });

  it('rejects duplicate IDs, invalid timestamps, secret fields, and oversized imports', () => {
    expect(() => parseImport(JSON.stringify({ ...fixture, memories: [fixture.memories[0], fixture.memories[0]] }))).toThrow();
    expect(() => parseImport(JSON.stringify({ ...fixture, tasks: [{ ...fixture.tasks[0], createdAt: 'yesterday' }] }))).toThrow();
    expect(() => parseImport(JSON.stringify({ ...fixture, apiKey: 'secret' }))).toThrow();
    expect(() => parseImport(' '.repeat(2_000_001))).toThrow();
  });

  it('does not report a write complete before its IndexedDB transaction commits', async () => {
    let committed = false;
    const original = IDBDatabase.prototype.transaction;
    const spy = vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (this: IDBDatabase, storeNames, mode, options) {
      const tx = original.call(this, storeNames, mode, options);
      if (mode === 'readwrite') tx.addEventListener('complete', () => { committed = true; });
      return tx;
    });
    try {
      await saveData(fixture);
      expect(committed).toBe(true);
    } finally { spy.mockRestore(); }
  });
});
