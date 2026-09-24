import { describe, expect, it, vi } from 'vitest';
import { emptyData } from '../src/lib/storage';
import { createChatRequest, sendChat } from '../src/lib/chat';

describe('browser chat boundary', () => {
  it('sends selected context with a session-only key', async () => {
    const data = emptyData();
    data.profile.name = 'Ada';
    data.memories.push({ id: 'm1', text: 'I write weekly', createdAt: '2026-09-25T00:00:00.000Z', updatedAt: '2026-09-25T00:00:00.000Z' });
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.headers).toMatchObject({ authorization: 'Bearer sk-test-secret' });
      expect(JSON.stringify(init.body)).not.toContain('sk-test-secret');
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
    data.memories = Array.from({ length: 40 }, (_, index) => ({ id: `${index}`, text: 'x'.repeat(2000), createdAt: '2026-09-25T00:00:00.000Z', updatedAt: '2026-09-25T00:00:00.000Z' }));
    expect(JSON.stringify(createChatRequest(data, 'Hi').context).length).toBeLessThan(24_000);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ text: '', proposals: [] }), { status: 200 })));
    await expect(sendChat(createChatRequest(data, 'Hi'), 'sk-test')).rejects.toMatchObject({ code: 'malformed_response' });
    vi.unstubAllGlobals();
  });
});
