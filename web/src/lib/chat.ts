import type { AgentData } from './domain';

export type Provider = 'openai_responses' | 'openai_chat_completions' | 'anthropic_messages';
export interface ProviderConfig { provider: Provider; apiUrl: string; model: string }
export const defaultProviderConfig: ProviderConfig = { provider: 'openai_responses', apiUrl: 'https://api.openai.com/v1/responses', model: 'gpt-5-mini' };
export const providerDefaults: Record<Provider, ProviderConfig> = {
  openai_responses: defaultProviderConfig,
  openai_chat_completions: { provider: 'openai_chat_completions', apiUrl: 'https://api.deepseek.com/chat/completions', model: 'deepseek-flash' },
  anthropic_messages: { provider: 'anthropic_messages', apiUrl: 'https://api.anthropic.com/v1/messages', model: '' },
};
export interface ChatRequest extends ProviderConfig { message: string; context: unknown; conversation: { role: 'user' | 'assistant'; content: string }[] }
export interface ChatResult { text: string; proposals: unknown[]; deliverable?: { title: string; body: string } }
export class ChatError extends Error { constructor(public code: string) { super(code); } }

export function createChatRequest(data: AgentData, message: string, goalId?: string, config: ProviderConfig = defaultProviderConfig): ChatRequest {
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
    deliverables: data.deliverables.filter(item => !selectedGoal || item.goalId === selectedGoal.id).slice(-5).map(item => ({ goalId: item.goalId, title: item.title.slice(0, 160), draftExcerpt: item.body.slice(0, 1000), updatedAt: item.updatedAt.slice(0, 10) })),
  };
  const bytes = () => new TextEncoder().encode(JSON.stringify(context)).length;
  while (bytes() > 22_000) {
    if (context.memories.length > 4) context.memories.shift();
    else if (context.tasks.length > 4) context.tasks.shift();
    else if (context.deliverables.length > 1) context.deliverables.shift();
    else if (context.profile.goals.length > 1) context.profile.goals.pop();
    else if (context.checkIns.length > 2) context.checkIns.shift();
    else { context.profile.about = context.profile.about.slice(0, 500); context.profile.preferences = context.profile.preferences.slice(0, 500); break; }
  }
  return {
    ...config,
    message: cleanMessage,
    context,
    conversation: data.conversation.slice(-8).map(turn => ({ role: turn.role, content: turn.content.slice(0, 800) })),
  };
}

export function validateChatResult(value: unknown): ChatResult {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new ChatError('malformed_response');
  const result = value as Record<string, unknown>;
  if (typeof result.text !== 'string' || !result.text.trim() || result.text.length > 20_000 || !Array.isArray(result.proposals) || result.proposals.length > 8) throw new ChatError('malformed_response');
  let deliverable: ChatResult['deliverable'];
  if (result.deliverable !== undefined && result.deliverable !== null) {
    const raw = result.deliverable;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ChatError('malformed_response');
    const draft = raw as Record<string, unknown>;
    if (Object.keys(draft).sort().join(',') !== 'body,title' || typeof draft.title !== 'string' || !draft.title.trim() || draft.title.length > 160 || typeof draft.body !== 'string' || !draft.body.trim() || draft.body.length > 12_000) throw new ChatError('malformed_response');
    deliverable = { title: draft.title, body: draft.body };
  }
  return { text: result.text, proposals: result.proposals, ...(deliverable ? { deliverable } : {}) };
}

export async function sendChat(request: ChatRequest, key: string, signal?: AbortSignal): Promise<ChatResult> {
  if (!key.trim()) throw new ChatError('missing_key');
  let url: URL;
  try { url = new URL(request.apiUrl); } catch { throw new ChatError('invalid_config'); }
  const suffix = { openai_responses: '/responses', openai_chat_completions: '/chat/completions', anthropic_messages: '/messages' }[request.provider];
  if (!suffix || url.protocol !== 'https:' || !url.pathname.endsWith(suffix) || !request.model.trim()) throw new ChatError('invalid_config');
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
    if (response.status === 400) throw new ChatError('invalid_config');
    throw new ChatError('server_error');
  }
  try { return validateChatResult(await response.json()); }
  catch { throw new ChatError('malformed_response'); }
}
