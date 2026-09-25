import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentData } from '../src/lib/domain';
import { clearData, exportData, loadData, parseImport, saveData } from '../src/lib/storage';

const oldFixture = {
  schemaVersion: 1,
  profile: { name: 'Ada', about: 'Writer', preferences: 'Short answers', goals: ['Publish weekly'] },
  memories: [{ id: 'm1', text: 'I write on Fridays', createdAt: '2026-09-25T00:00:00.000Z', updatedAt: '2026-09-25T00:00:00.000Z' }],
  tasks: [{ id: 't1', title: 'Outline article', notes: '', completed: false, createdAt: '2026-09-25T00:00:00.000Z', updatedAt: '2026-09-25T00:00:00.000Z' }],
  conversation: [{ id: 'c1', role: 'user', content: 'Help me plan', createdAt: '2026-09-25T00:00:00.000Z' }],
};
const fixture: AgentData = {
  schemaVersion: 2,
  profile: { name: 'Ada', about: 'Writer', preferences: 'Short answers' },
  goals: [{ id: 'g1', title: 'Publish weekly', domain: 'work', stage: '', status: 'active', nextReviewAt: null, createdAt: '2026-09-25T00:00:00.000Z', updatedAt: '2026-09-25T00:00:00.000Z' }],
  checkIns: [],
  memories: [{ ...oldFixture.memories[0], domain: 'other' }],
  tasks: [{ ...oldFixture.tasks[0], goalId: null }],
  conversation: oldFixture.conversation as AgentData['conversation'],
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

  it('migrates a version-1 record and preserves its contents', () => {
    const migrated = parseImport(JSON.stringify(oldFixture));
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.goals.map(goal => goal.title)).toEqual(['Publish weekly']);
    expect(migrated.tasks[0]).toMatchObject({ title: 'Outline article', goalId: null });
    expect(migrated.memories[0]).toMatchObject({ text: 'I write on Fridays', domain: 'other' });
    expect(migrated.conversation).toEqual(oldFixture.conversation);
  });

  it('migrates an existing IndexedDB record before returning it', async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('personal-agent', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('state', 'readwrite');
      tx.objectStore('state').put(oldFixture, 'agent');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    const migrated = await loadData();
    expect(migrated.goals[0].title).toBe('Publish weekly');
    expect(await loadData()).toEqual(migrated);
  });

  it('rejects missing goal references and malformed check-ins', () => {
    expect(() => parseImport(JSON.stringify({ ...fixture, tasks: [{ ...fixture.tasks[0], goalId: 'missing' }] }))).toThrow();
    expect(() => parseImport(JSON.stringify({ ...fixture, checkIns: [{ id: 'c', goalId: 'missing', outcome: 'Done', learned: '', nextStep: '', createdAt: '2026-09-25T00:00:00.000Z' }] }))).toThrow();
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
