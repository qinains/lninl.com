import { describe, expect, it, vi } from 'vitest';
import { emptyData } from '../src/lib/storage';
import { ChatError, createChatRequest, sendChat } from '../src/lib/chat';

describe('browser chat boundary', () => {
  it('sends selected context with a session-only key', async () => {
    const data = emptyData();
    data.profile.name = 'Ada';
    data.memories.push({ id: 'm1', text: 'I write weekly', domain: 'work', createdAt: '2026-09-25T00:00:00.000Z', updatedAt: '2026-09-25T00:00:00.000Z' });
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.headers).toMatchObject({ authorization: 'Bearer sk-test-secret' });
      expect(JSON.stringify(init.body)).not.toContain('sk-test-secret');
      expect(JSON.parse(init.body as string)).toMatchObject({ provider: 'openai_responses', apiUrl: 'https://api.openai.com/v1/responses', model: 'gpt-5-mini' });
      return new Response(JSON.stringify({ text: 'Start with an outline.', proposals: [] }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await sendChat(createChatRequest(data, 'Help me plan'), 'sk-test-secret');
    expect(result.text).toBe('Start with an outline.');
    expect(JSON.stringify(data)).not.toContain('sk-test-secret');
    expect(fetchMock).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it('rejects missing keys before network and never exposes upstream error bodies', async () => {
    const fetchMock = vi.fn(async () => new Response('sk-test-secret', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(sendChat(createChatRequest(emptyData(), 'Hello'), '')).rejects.toMatchObject({ code: 'missing_key' });
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(sendChat(createChatRequest(emptyData(), 'Hello'), 'sk-test-secret')).rejects.toMatchObject({ code: 'invalid_key' });
    vi.unstubAllGlobals();
  });

  it('bounds context and rejects malformed model output', async () => {
    const data = emptyData();
    data.memories = Array.from({ length: 40 }, (_, index) => ({ id: `${index}`, text: 'x'.repeat(2000), domain: 'other', createdAt: '2026-09-25T00:00:00.000Z', updatedAt: '2026-09-25T00:00:00.000Z' }));
    expect(JSON.stringify(createChatRequest(data, 'Hi').context).length).toBeLessThan(24_000);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ text: '', proposals: [] }), { status: 200 })));
    await expect(sendChat(createChatRequest(data, 'Hi'), 'sk-test')).rejects.toMatchObject({ code: 'malformed_response' });
    vi.unstubAllGlobals();
  });

  it('includes selected goal and bounded recent outcomes in a review request', () => {
    const data = emptyData();
    const at = '2026-09-25T00:00:00.000Z';
    data.goals.push({ id: 'g1', title: 'Write', domain: 'work', stage: 'Draft', status: 'active', nextReviewAt: null, createdAt: at, updatedAt: at });
    data.checkIns = Array.from({ length: 20 }, (_, index) => ({ id: `c${index}`, goalId: 'g1', outcome: `Outcome ${index} ${'x'.repeat(1000)}`, learned: 'Morning is best', nextStep: '', createdAt: at }));
    const context = createChatRequest(data, 'Review my progress', 'g1').context;
    expect(JSON.stringify(context)).toContain('Outcome 19');
    expect(JSON.stringify(context)).not.toContain('Outcome 0');
    expect(JSON.stringify(context)).toContain('"selectedGoalId":"g1"');
    expect(JSON.stringify(context).length).toBeLessThan(24_000);
  });

  it('carries a bounded prior work product into the selected goal context', () => {
    const data = emptyData();
    const at = '2026-09-25T00:00:00.000Z';
    data.goals.push({ id: 'work', title: 'Ship', domain: 'work', stage: '', status: 'active', nextReviewAt: null, createdAt: at, updatedAt: at });
    data.goals.push({ id: 'life', title: 'Move', domain: 'life', stage: '', status: 'active', nextReviewAt: null, createdAt: at, updatedAt: at });
    data.deliverables.push({ id: 'd1', goalId: 'work', title: 'Launch brief', body: 'Important prior decision', createdAt: at, updatedAt: at });
    data.deliverables.push({ id: 'd2', goalId: 'life', title: 'Private trip', body: 'Unrelated personal detail', createdAt: at, updatedAt: at });
    const context = JSON.stringify(createChatRequest(data, 'Continue', 'work').context);
    expect(context).toContain('Important prior decision');
    expect(context).not.toContain('Unrelated personal detail');
  });

  it('stays below gateway limit with maximum-length local data', () => {
    const data = emptyData();
    const at = '2026-09-25T00:00:00.000Z';
    data.profile = { name: '你'.repeat(120), about: '背'.repeat(4000), preferences: '偏'.repeat(4000) };
    data.goals = Array.from({ length: 30 }, (_, index) => ({ id: `goal-${index}`, title: 'g'.repeat(500), domain: 'work', stage: 's'.repeat(500), status: 'active', nextReviewAt: null, createdAt: at, updatedAt: at }));
    data.memories = Array.from({ length: 500 }, (_, index) => ({ id: `memory-${index}`, text: 'm'.repeat(4000), domain: 'other', createdAt: at, updatedAt: at }));
    data.tasks = Array.from({ length: 1000 }, (_, index) => ({ id: `task-${index}`, goalId: null, title: 't'.repeat(300), notes: '', completed: false, createdAt: at, updatedAt: at }));
    data.checkIns = Array.from({ length: 1000 }, (_, index) => ({ id: `check-${index}`, goalId: 'goal-0', outcome: 'o'.repeat(2000), learned: 'l'.repeat(2000), nextStep: 'n'.repeat(300), createdAt: at }));
    data.deliverables = Array.from({ length: 100 }, (_, index) => ({ id: `draft-${index}`, goalId: 'goal-0', title: '大'.repeat(160), body: '文'.repeat(12000), createdAt: at, updatedAt: at }));
    expect(new TextEncoder().encode(JSON.stringify(createChatRequest(data, 'Review', 'goal-0').context)).length).toBeLessThan(24_000);
  });

  it('rejects a UTF-8 message the gateway cannot accept', () => {
    expect(() => createChatRequest(emptyData(), '中'.repeat(1400))).toThrow(ChatError);
  });

  it('sends a custom Chat Completions endpoint and model without persisting its key', async () => {
    const config = { provider: 'openai_chat_completions' as const, apiUrl: 'https://api.deepseek.com/chat/completions', model: 'deepseek-flash' };
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(JSON.parse(init.body as string)).toMatchObject(config);
      expect(init.headers).toMatchObject({ authorization: 'Bearer deepseek-secret' });
      return new Response(JSON.stringify({ text: 'Next', proposals: [] }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    await sendChat(createChatRequest(emptyData(), 'Plan', undefined, config), 'deepseek-secret');
    expect(fetchMock).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it('accepts a bounded deliverable and rejects malformed ones', async () => {
    const valid = { text: 'Drafted', proposals: [], deliverable: { title: 'Brief', body: 'Content' } };
    const { validateChatResult } = await import('../src/lib/chat');
    expect(validateChatResult(valid).deliverable).toEqual(valid.deliverable);
    expect(validateChatResult({ text: 'Fine', proposals: [] }).deliverable).toBeUndefined();
    expect(validateChatResult({ text: 'Fine', proposals: [], deliverable: null }).deliverable).toBeUndefined();
    expect(() => validateChatResult({ ...valid, deliverable: { title: 'Brief', body: 'x'.repeat(12001) } })).toThrow(ChatError);
    expect(() => validateChatResult({ ...valid, deliverable: { title: 'Brief', body: 'Content', secret: 'x' } })).toThrow(ChatError);
  });
});
