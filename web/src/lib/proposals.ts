import type { AgentData, TaskProposal } from './domain';

function record(value: unknown, allowed: string[], required: string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid proposal');
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some(key => !allowed.includes(key)) || required.some(key => !(key in result))) throw new Error('Invalid proposal fields');
  return result;
}

function identifier(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(value)) throw new Error('Invalid proposal ID');
  return value;
}

function text(value: unknown, max: number, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim()) || value.length > max) throw new Error('Invalid proposal text');
  return value.trim();
}

export function validateProposal(value: unknown, data: AgentData): TaskProposal {
  const base = record(value, ['id', 'kind', 'taskId', 'title', 'notes'], ['id', 'kind', 'taskId']);
  const id = identifier(base.id);
  const taskId = identifier(base.taskId);
  if (base.kind === 'create') {
    record(value, ['id', 'kind', 'taskId', 'title', 'notes'], ['id', 'kind', 'taskId', 'title']);
    if (data.tasks.some(task => task.id === taskId)) throw new Error('Task already exists');
    return { id, kind: 'create', taskId, title: text(base.title, 300), notes: base.notes === undefined ? '' : text(base.notes, 2000, true) };
  }
  if (!data.tasks.some(task => task.id === taskId)) throw new Error('Task not found');
  if (base.kind === 'update') {
    record(value, ['id', 'kind', 'taskId', 'title', 'notes'], ['id', 'kind', 'taskId']);
    if (base.title === undefined && base.notes === undefined) throw new Error('Empty update');
    return { id, kind: 'update', taskId, ...(base.title === undefined ? {} : { title: text(base.title, 300) }), ...(base.notes === undefined ? {} : { notes: text(base.notes, 2000, true) }) };
  }
  if (base.kind === 'complete' || base.kind === 'delete') {
    record(value, ['id', 'kind', 'taskId'], ['id', 'kind', 'taskId']);
    if (base.kind === 'complete' && data.tasks.find(task => task.id === taskId)?.completed) throw new Error('Task already complete');
    return { id, kind: base.kind, taskId };
  }
  throw new Error('Unsupported action');
}

export function applyProposal(data: AgentData, proposal: TaskProposal): AgentData {
  const valid = validateProposal(proposal, data);
  const now = new Date().toISOString();
  switch (valid.kind) {
    case 'create':
      return { ...data, tasks: [...data.tasks, { id: valid.taskId, goalId: null, title: valid.title, notes: valid.notes, completed: false, createdAt: now, updatedAt: now }] };
    case 'update':
      return { ...data, tasks: data.tasks.map(task => task.id === valid.taskId ? { ...task, ...(valid.title === undefined ? {} : { title: valid.title }), ...(valid.notes === undefined ? {} : { notes: valid.notes }), updatedAt: now } : task) };
    case 'complete':
      return { ...data, tasks: data.tasks.map(task => task.id === valid.taskId ? { ...task, completed: true, updatedAt: now } : task) };
    case 'delete':
      return { ...data, tasks: data.tasks.filter(task => task.id !== valid.taskId) };
  }
}
