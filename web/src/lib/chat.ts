import type { AgentData } from './domain';

export interface ChatRequest { message: string; context: unknown; conversation: { role: 'user' | 'assistant'; content: string }[] }
export interface ChatResult { text: string; proposals: unknown[] }
export class ChatError extends Error { constructor(public code: string) { super(code); } }

export function createChatRequest(data: AgentData, message: string): ChatRequest {
  return {
    message: message.trim().slice(0, 4000),
    context: {
      profile: {
        name: data.profile.name.slice(0, 120),
        about: data.profile.about.slice(0, 2000),
        preferences: data.profile.preferences.slice(0, 2000),
        goals: data.profile.goals.slice(0, 10).map(goal => goal.slice(0, 300)),
      },
      memories: data.memories.slice(-20).map(memory => ({ id: memory.id, text: memory.text.slice(0, 400) })),
      tasks: data.tasks.filter(task => !task.completed).slice(0, 20).map(task => ({ id: task.id, title: task.title.slice(0, 200) })),
    },
    conversation: data.conversation.slice(-10).map(turn => ({ role: turn.role, content: turn.content.slice(0, 1500) })),
  };
}

export function validateChatResult(value: unknown): ChatResult {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new ChatError('malformed_response');
  const result = value as Record<string, unknown>;
  if (typeof result.text !== 'string' || !result.text.trim() || result.text.length > 20_000 || !Array.isArray(result.proposals) || result.proposals.length > 8) throw new ChatError('malformed_response');
  return { text: result.text, proposals: result.proposals };
}

export async function sendChat(request: ChatRequest, key: string, signal?: AbortSignal): Promise<ChatResult> {
  if (!key.trim()) throw new ChatError('missing_key');
  let response: Response;
  try {
    response = await fetch('/api/chat', {
      method: 'POST', signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key.trim()}` },
      body: JSON.stringify(request),
    });
  } catch (error) {
    throw new ChatError(error instanceof DOMException && error.name === 'AbortError' ? 'timeout' : 'network_error');
  }
  if (!response.ok) {
    if (response.status === 401) throw new ChatError('invalid_key');
    if (response.status === 504) throw new ChatError('timeout');
    if (response.status === 429) throw new ChatError('rate_limited');
    throw new ChatError('server_error');
  }
  try { return validateChatResult(await response.json()); }
  catch { throw new ChatError('malformed_response'); }
}
