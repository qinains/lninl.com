import type { AgentData } from './domain';

export interface ChatRequest { message: string; context: unknown; conversation: { role: 'user' | 'assistant'; content: string }[] }
export interface ChatResult { text: string; proposals: unknown[] }
export class ChatError extends Error { constructor(public code: string) { super(code); } }

export function createChatRequest(data: AgentData, message: string, goalId?: string): ChatRequest {
  const cleanMessage = message.trim();
  if (!cleanMessage || new TextEncoder().encode(cleanMessage).length > 4000) throw new ChatError('message_too_long');
  const selectedGoal = data.goals.find(goal => goal.id === goalId);
  const recentCheckIns = data.checkIns.filter(item => !selectedGoal || item.goalId === selectedGoal.id).slice(-5);
  const context = {
    profile: {
      name: data.profile.name.slice(0, 80),
      about: data.profile.about.slice(0, 1200),
      preferences: data.profile.preferences.slice(0, 1200),
      goals: [...(selectedGoal ? [selectedGoal] : []), ...data.goals.filter(goal => goal.id !== selectedGoal?.id)].slice(0, 8).map(goal => ({ id: goal.id, title: goal.title.slice(0, 200), domain: goal.domain, stage: goal.stage.slice(0, 120), status: goal.status })),
    },
    selectedGoalId: selectedGoal?.id ?? null,
    checkIns: recentCheckIns.map(item => ({ goalId: item.goalId, outcome: item.outcome.slice(0, 400), learned: item.learned.slice(0, 200), nextStep: item.nextStep.slice(0, 120), date: item.createdAt.slice(0, 10) })),
    memories: data.memories.slice(-15).map(memory => ({ id: memory.id, domain: memory.domain, text: memory.text.slice(0, 280) })),
    tasks: data.tasks.filter(task => !task.completed).slice(-15).map(task => ({ id: task.id, goalId: task.goalId, title: task.title.slice(0, 160) })),
  };
  const bytes = () => new TextEncoder().encode(JSON.stringify(context)).length;
  while (bytes() > 22_000) {
    if (context.memories.length > 4) context.memories.shift();
    else if (context.tasks.length > 4) context.tasks.shift();
    else if (context.profile.goals.length > 1) context.profile.goals.pop();
    else if (context.checkIns.length > 2) context.checkIns.shift();
    else { context.profile.about = context.profile.about.slice(0, 500); context.profile.preferences = context.profile.preferences.slice(0, 500); break; }
  }
  return {
    message: cleanMessage,
    context,
    conversation: data.conversation.slice(-8).map(turn => ({ role: turn.role, content: turn.content.slice(0, 800) })),
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
