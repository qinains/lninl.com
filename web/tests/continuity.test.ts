import { describe, expect, it } from 'vitest';
import { emptyData } from '../src/lib/storage';
import { addCheckIn, localDate, nextDueGoal } from '../src/lib/continuity';

const now = '2026-09-25T00:00:00.000Z';
function data() {
  const value = emptyData();
  value.goals.push({ id: 'g1', title: 'Write weekly', domain: 'work', stage: 'First article', status: 'active', nextReviewAt: '2026-09-24', createdAt: now, updatedAt: now });
  return value;
}

describe('continuous goal loop', () => {
  it('uses the browser local calendar date for due reviews', () => {
    const date = new Date(2026, 8, 25, 0, 30);
    expect(localDate(date)).toBe('2026-09-25');
  });
  it('records a check-in and optional linked next action without losing history', () => {
    const updated = addCheckIn(data(), { goalId: 'g1', outcome: 'Drafted', learned: 'Mornings work', nextStep: 'Edit draft', nextReviewAt: '2026-09-30' }, now);
    expect(updated.checkIns[0]).toMatchObject({ goalId: 'g1', outcome: 'Drafted', learned: 'Mornings work' });
    expect(updated.tasks[0]).toMatchObject({ title: 'Edit draft', goalId: 'g1', completed: false });
    expect(updated.goals[0].nextReviewAt).toBe('2026-09-30');
    expect(nextDueGoal(updated, '2026-09-25')).toBeNull();
  });

  it('rejects unknown goals and blank outcomes', () => {
    expect(() => addCheckIn(data(), { goalId: 'bad', outcome: 'Done', learned: '', nextStep: '', nextReviewAt: null }, now)).toThrow();
    expect(() => addCheckIn(data(), { goalId: 'g1', outcome: ' ', learned: '', nextStep: '', nextReviewAt: null }, now)).toThrow();
    expect(nextDueGoal(data(), '2026-09-25')?.id).toBe('g1');
  });
});
