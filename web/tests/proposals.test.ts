import { describe, expect, it } from 'vitest';
import { emptyData } from '../src/lib/storage';
import { applyProposal, validateProposal } from '../src/lib/proposals';

const original = () => ({
  ...emptyData(),
  tasks: [{ id: 't1', goalId: null, title: 'Outline', notes: '', completed: false, createdAt: '2026-09-25T00:00:00.000Z', updatedAt: '2026-09-25T00:00:00.000Z' }],
});

describe('untrusted task proposals', () => {
  it('validates without changing tasks, then creates only when applied', () => {
    const data = original();
    const proposal = validateProposal({ id: 'p1', kind: 'create', taskId: 't2', title: 'Draft', notes: 'Friday' }, data);
    expect(data.tasks).toHaveLength(1);
    const updated = applyProposal(data, proposal);
    expect(updated.tasks).toHaveLength(2);
    expect(updated.tasks[1]).toMatchObject({ id: 't2', title: 'Draft', notes: 'Friday', completed: false });
    expect(data.tasks).toHaveLength(1);
  });

  it('updates, completes, and deletes an existing task without mutating the input', () => {
    const data = original();
    const updated = applyProposal(data, validateProposal({ id: 'p2', kind: 'update', taskId: 't1', title: 'New outline' }, data));
    expect(updated.tasks[0].title).toBe('New outline');
    expect(data.tasks[0].title).toBe('Outline');
    const completed = applyProposal(updated, validateProposal({ id: 'p3', kind: 'complete', taskId: 't1' }, updated));
    expect(completed.tasks[0].completed).toBe(true);
    expect(updated.tasks[0].completed).toBe(false);
    expect(applyProposal(completed, validateProposal({ id: 'p4', kind: 'delete', taskId: 't1' }, completed)).tasks).toEqual([]);
  });

  it('rejects nonexistent tasks and duplicate create IDs', () => {
    expect(() => validateProposal({ id: 'p1', kind: 'delete', taskId: 'missing' }, original())).toThrow();
    expect(() => validateProposal({ id: 'p1', kind: 'create', taskId: 't1', title: 'Duplicate' }, original())).toThrow();
  });

  it('rejects empty titles, unknown fields, and unsupported actions', () => {
    expect(() => validateProposal({ id: 'p1', kind: 'create', taskId: 't2', title: ' ' }, original())).toThrow();
    expect(() => validateProposal({ id: 'p1', kind: 'complete', taskId: 't1', secret: 'x' }, original())).toThrow();
    expect(() => validateProposal({ id: 'p1', kind: 'email', taskId: 't1' }, original())).toThrow();
  });

  it('allows a task without notes and allows clearing old notes', () => {
    const data = original();
    const created = applyProposal(data, validateProposal({ id: 'p5', kind: 'create', taskId: 't2', title: 'Draft' }, data));
    expect(created.tasks[1].notes).toBe('');
    const cleared = applyProposal(created, validateProposal({ id: 'p6', kind: 'update', taskId: 't2', notes: '' }, created));
    expect(cleared.tasks[1].notes).toBe('');
  });
});
