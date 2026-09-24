import { SCHEMA_VERSION, type AgentData, type ConversationTurn, type Memory, type Profile, type Task } from './domain';

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

export function validateAgentData(value: unknown): AgentData {
  const data = object(value, ['schemaVersion', 'profile', 'memories', 'tasks', 'conversation']);
  if (data.schemaVersion !== SCHEMA_VERSION) throw new Error('Unsupported data version');
  const p = object(data.profile, ['name', 'about', 'preferences', 'goals']);
  const profile: Profile = {
    name: string(p.name, 120),
    about: string(p.about, 4000),
    preferences: string(p.preferences, 4000),
    goals: list(p.goals, 30, item => string(item, 500)),
  };
  const memories = uniqueIds(list(data.memories, 500, item => {
    const m = object(item, ['id', 'text', 'createdAt', 'updatedAt']);
    return { id: string(m.id, 100), text: string(m.text, 4000), createdAt: timestamp(m.createdAt), updatedAt: timestamp(m.updatedAt) } satisfies Memory;
  }));
  const tasks = uniqueIds(list(data.tasks, 1000, item => {
    const t = object(item, ['id', 'title', 'notes', 'completed', 'createdAt', 'updatedAt']);
    if (typeof t.completed !== 'boolean') throw new Error('Invalid task state');
    return { id: string(t.id, 100), title: string(t.title, 300), notes: string(t.notes, 2000), completed: t.completed, createdAt: timestamp(t.createdAt), updatedAt: timestamp(t.updatedAt) } satisfies Task;
  }));
  const conversation = uniqueIds(list(data.conversation, 1000, item => {
    const c = object(item, ['id', 'role', 'content', 'createdAt']);
    if (c.role !== 'user' && c.role !== 'assistant') throw new Error('Invalid conversation role');
    return { id: string(c.id, 100), role: c.role, content: string(c.content, 20_000), createdAt: timestamp(c.createdAt) } satisfies ConversationTurn;
  }));
  return { schemaVersion: SCHEMA_VERSION, profile, memories, tasks, conversation };
}

export function emptyData(): AgentData {
  return { schemaVersion: SCHEMA_VERSION, profile: { name: '', about: '', preferences: '', goals: [] }, memories: [], tasks: [], conversation: [] };
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
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}

export async function loadData(): Promise<AgentData> {
  const value = await record<unknown>('readonly', store => store.get(RECORD));
  return value === undefined ? emptyData() : validateAgentData(value);
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
  return validateAgentData(JSON.parse(text));
}

export function exportData(data: AgentData): string {
  return JSON.stringify(validateAgentData(data), null, 2);
}
