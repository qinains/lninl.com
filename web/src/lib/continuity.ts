import type { AgentData, Goal } from './domain';
import { validateAgentData } from './storage';

export interface CheckInInput { goalId: string; outcome: string; learned: string; nextStep: string; nextReviewAt: string | null }

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function addCheckIn(data: AgentData, input: CheckInInput, now = new Date().toISOString()): AgentData {
  const goal = data.goals.find(item => item.id === input.goalId && item.status === 'active');
  if (!goal || !input.outcome.trim()) throw new Error('Invalid check-in');
  const nextStep = input.nextStep.trim();
  const updated = {
    ...data,
    goals: data.goals.map(item => item.id === goal.id ? { ...item, nextReviewAt: input.nextReviewAt, updatedAt: now } : item),
    checkIns: [...data.checkIns, { id: crypto.randomUUID(), goalId: goal.id, outcome: input.outcome.trim(), learned: input.learned.trim(), nextStep, createdAt: now }],
    tasks: nextStep ? [...data.tasks, { id: crypto.randomUUID(), goalId: goal.id, title: nextStep, notes: '', completed: false, createdAt: now, updatedAt: now }] : data.tasks,
  };
  return validateAgentData(updated);
}

export function nextDueGoal(data: AgentData, today = localDate()): Goal | null {
  return data.goals.filter(goal => goal.status === 'active' && goal.nextReviewAt && goal.nextReviewAt <= today).sort((a, b) => a.nextReviewAt!.localeCompare(b.nextReviewAt!))[0] || null;
}

export interface AgendaItem { goal: Goal; reason: 'due' | 'open_task' | 'continue' }

export function agenda(data: AgentData, today = localDate()): AgendaItem[] {
  return data.goals
    .filter(goal => goal.status === 'active')
    .map(goal => ({
      goal,
      reason: goal.nextReviewAt && goal.nextReviewAt <= today ? 'due' as const
        : data.tasks.some(task => task.goalId === goal.id && !task.completed) ? 'open_task' as const
          : 'continue' as const,
    }))
    .sort((a, b) => {
      const score = { due: 0, open_task: 1, continue: 2 };
      return score[a.reason] - score[b.reason]
        || (a.goal.nextReviewAt || '9999-12-31').localeCompare(b.goal.nextReviewAt || '9999-12-31')
        || a.goal.createdAt.localeCompare(b.goal.createdAt)
        || a.goal.id.localeCompare(b.goal.id);
    })
    .slice(0, 4);
}
