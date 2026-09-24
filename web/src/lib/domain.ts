export const SCHEMA_VERSION = 1;

export interface Profile { name: string; about: string; preferences: string; goals: string[] }
export interface Memory { id: string; text: string; createdAt: string; updatedAt: string }
export interface Task { id: string; title: string; notes: string; completed: boolean; createdAt: string; updatedAt: string }
export interface ConversationTurn { id: string; role: 'user' | 'assistant'; content: string; createdAt: string }
export interface AgentData {
  schemaVersion: number;
  profile: Profile;
  memories: Memory[];
  tasks: Task[];
  conversation: ConversationTurn[];
}
