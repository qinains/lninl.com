export const SCHEMA_VERSION = 2;

export interface Profile { name: string; about: string; preferences: string }
export type Domain = 'work' | 'learning' | 'life' | 'other';
export interface Goal { id: string; title: string; domain: Domain; stage: string; status: 'active' | 'paused' | 'done'; nextReviewAt: string | null; createdAt: string; updatedAt: string }
export interface CheckIn { id: string; goalId: string; outcome: string; learned: string; nextStep: string; createdAt: string }
export interface Memory { id: string; text: string; domain: Domain; createdAt: string; updatedAt: string }
export interface Task { id: string; goalId: string | null; title: string; notes: string; completed: boolean; createdAt: string; updatedAt: string }
export interface ConversationTurn { id: string; role: 'user' | 'assistant'; content: string; createdAt: string }
export interface AgentData {
  schemaVersion: number;
  profile: Profile;
  goals: Goal[];
  checkIns: CheckIn[];
  memories: Memory[];
  tasks: Task[];
  conversation: ConversationTurn[];
}

export type TaskProposal =
  | { id: string; kind: 'create'; taskId: string; title: string; notes: string }
  | { id: string; kind: 'update'; taskId: string; title?: string; notes?: string }
  | { id: string; kind: 'complete'; taskId: string }
  | { id: string; kind: 'delete'; taskId: string };
