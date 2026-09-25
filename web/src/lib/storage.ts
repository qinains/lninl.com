import { SCHEMA_VERSION, type AgentData, type CheckIn, type ConversationTurn, type Deliverable, type Domain, type Goal, type Memory, type Profile, type Task } from './domain';

const DB_NAME = 'personal-agent';
const STORE = 'state';
const RECORD = 'agent';
const MAX_IMPORT_BYTES = 2_000_000;

function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid data');
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some(key => !keys.includes(key)) || keys.some(key => !(key in record))) throw new Error('Unexpected data fields');
  return record;
}

function string(value: unknown, max = 10_000): string {
  if (typeof value !== 'string' || value.length > max) throw new Error('Invalid text');
  return value;
}

function timestamp(value: unknown): string {
  const text = string(value, 30);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(text) || !Number.isFinite(Date.parse(text)) || new Date(text).toISOString() !== text) throw new Error('Invalid timestamp');
  return text;
}

function list<T>(value: unknown, max: number, validate: (item: unknown) => T): T[] {
  if (!Array.isArray(value) || value.length > max) throw new Error('Invalid list');
  return value.map(validate);
}

function uniqueIds<T extends { id: string }>(items: T[]): T[] {
  if (new Set(items.map(item => item.id)).size !== items.length) throw new Error('Duplicate ID');
  return items;
}

function domain(value: unknown): Domain {
  if (value !== 'work' && value !== 'learning' && value !== 'life' && value !== 'other') throw new Error('Invalid domain');
  return value;
}

function date(value: unknown): string | null {
  if (value === null) return null;
  const text = string(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(Date.parse(`${text}T00:00:00.000Z`)) || new Date(`${text}T00:00:00.000Z`).toISOString().slice(0, 10) !== text) throw new Error('Invalid review date');
  return text;
}

export function migrateAgentData(value: unknown): AgentData {
  const raw = value as Record<string, unknown>;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return validateAgentData(value);
  if (raw.schemaVersion === 2) {
    const old = object(value, ['schemaVersion', 'profile', 'goals', 'checkIns', 'memories', 'tasks', 'conversation']);
    return validateAgentData({ ...old, schemaVersion: 3, deliverables: [] });
  }
  if (raw.schemaVersion !== 1) return validateAgentData(value);
  const old = object(value, ['schemaVersion', 'profile', 'memories', 'tasks', 'conversation']);
  const p = object(old.profile, ['name', 'about', 'preferences', 'goals']);
  const goals = list(p.goals, 30, item => string(item, 500));
  const now = new Date().toISOString();
  return validateAgentData({
    schemaVersion: 3,
    profile: { name: p.name, about: p.about, preferences: p.preferences },
    goals: goals.map((title, index) => ({ id: `legacy-${index}`, title, domain: 'other', stage: '', status: 'active', nextReviewAt: null, createdAt: now, updatedAt: now })),
    checkIns: [],
    memories: list(old.memories, 500, item => ({ ...object(item, ['id', 'text', 'createdAt', 'updatedAt']), domain: 'other' })),
    tasks: list(old.tasks, 1000, item => ({ ...object(item, ['id', 'title', 'notes', 'completed', 'createdAt', 'updatedAt']), goalId: null })),
    conversation: old.conversation,
    deliverables: [],
  });
}

export function validateAgentData(value: unknown): AgentData {
  const data = object(value, ['schemaVersion', 'profile', 'goals', 'checkIns', 'memories', 'tasks', 'conversation', 'deliverables']);
  if (data.schemaVersion !== SCHEMA_VERSION) throw new Error('Unsupported data version');
  const p = object(data.profile, ['name', 'about', 'preferences']);
  const profile: Profile = {
    name: string(p.name, 120),
    about: string(p.about, 4000),
    preferences: string(p.preferences, 4000),
  };
  const goals = uniqueIds(list(data.goals, 30, item => {
    const g = object(item, ['id', 'title', 'domain', 'stage', 'status', 'nextReviewAt', 'createdAt', 'updatedAt']);
    if (g.status !== 'active' && g.status !== 'paused' && g.status !== 'done') throw new Error('Invalid goal status');
    const title = string(g.title, 500);
    if (!title.trim()) throw new Error('Empty goal');
    return { id: string(g.id, 100), title, domain: domain(g.domain), stage: string(g.stage, 500), status: g.status, nextReviewAt: date(g.nextReviewAt), createdAt: timestamp(g.createdAt), updatedAt: timestamp(g.updatedAt) } satisfies Goal;
  }));
  const goalIds = new Set(goals.map(goal => goal.id));
  const checkIns = uniqueIds(list(data.checkIns, 1000, item => {
    const c = object(item, ['id', 'goalId', 'outcome', 'learned', 'nextStep', 'createdAt']);
    const goalId = string(c.goalId, 100);
    if (!goalIds.has(goalId)) throw new Error('Unknown check-in goal');
    const outcome = string(c.outcome, 2000);
    if (!outcome.trim()) throw new Error('Empty check-in');
    return { id: string(c.id, 100), goalId, outcome, learned: string(c.learned, 2000), nextStep: string(c.nextStep, 300), createdAt: timestamp(c.createdAt) } satisfies CheckIn;
  }));
  const memories = uniqueIds(list(data.memories, 500, item => {
    const m = object(item, ['id', 'text', 'domain', 'createdAt', 'updatedAt']);
    return { id: string(m.id, 100), text: string(m.text, 4000), domain: domain(m.domain), createdAt: timestamp(m.createdAt), updatedAt: timestamp(m.updatedAt) } satisfies Memory;
  }));
  const tasks = uniqueIds(list(data.tasks, 1000, item => {
    const t = object(item, ['id', 'goalId', 'title', 'notes', 'completed', 'createdAt', 'updatedAt']);
    if (typeof t.completed !== 'boolean') throw new Error('Invalid task state');
    const goalId = t.goalId === null ? null : string(t.goalId, 100);
    if (goalId !== null && !goalIds.has(goalId)) throw new Error('Unknown task goal');
    return { id: string(t.id, 100), goalId, title: string(t.title, 300), notes: string(t.notes, 2000), completed: t.completed, createdAt: timestamp(t.createdAt), updatedAt: timestamp(t.updatedAt) } satisfies Task;
  }));
  const conversation = uniqueIds(list(data.conversation, 1000, item => {
    const c = object(item, ['id', 'role', 'content', 'createdAt']);
    if (c.role !== 'user' && c.role !== 'assistant') throw new Error('Invalid conversation role');
    return { id: string(c.id, 100), role: c.role, content: string(c.content, 20_000), createdAt: timestamp(c.createdAt) } satisfies ConversationTurn;
  }));
  const deliverables = uniqueIds(list(data.deliverables, 100, item => {
    const d = object(item, ['id', 'goalId', 'title', 'body', 'createdAt', 'updatedAt']);
    const goalId = string(d.goalId, 100);
    if (!goalIds.has(goalId)) throw new Error('Unknown deliverable goal');
    const title = string(d.title, 160);
    const body = string(d.body, 12_000);
    if (!title.trim() || !body.trim()) throw new Error('Empty deliverable');
    return { id: string(d.id, 100), goalId, title, body, createdAt: timestamp(d.createdAt), updatedAt: timestamp(d.updatedAt) } satisfies Deliverable;
  }));
  return { schemaVersion: SCHEMA_VERSION, profile, goals, checkIns, memories, tasks, conversation, deliverables };
}

export function emptyData(): AgentData {
  return { schemaVersion: SCHEMA_VERSION, profile: { name: '', about: '', preferences: '' }, goals: [], checkIns: [], memories: [], tasks: [], conversation: [], deliverables: [] };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore(STORE); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function record<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = work(tx.objectStore(STORE));
      let result: T;
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
      tx.oncomplete = () => resolve(result);
    });
  } finally { db.close(); }
}

export async function loadData(): Promise<AgentData> {
  const value = await record<unknown>('readonly', store => store.get(RECORD));
  if (value === undefined) return emptyData();
  const migrated = migrateAgentData(value);
  if ((value as AgentData).schemaVersion !== SCHEMA_VERSION) await saveData(migrated);
  return migrated;
}

export async function saveData(data: AgentData): Promise<void> {
  const valid = validateAgentData(data);
  await record('readwrite', store => store.put(valid, RECORD));
}

export async function clearData(): Promise<void> {
  await record('readwrite', store => store.delete(RECORD));
}

export function parseImport(text: string): AgentData {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) throw new Error('Import too large');
  return migrateAgentData(JSON.parse(text));
}

export function exportData(data: AgentData): string {
  return JSON.stringify(validateAgentData(data), null, 2);
}
