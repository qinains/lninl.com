<script lang="ts">
  import type { AgentData, ConversationTurn, TaskProposal } from '../lib/domain';
  import { applyProposal, validateProposal } from '../lib/proposals';
  import { ChatError, createChatRequest, sendChat } from '../lib/chat';
  import ApiKeySettings from './ApiKeySettings.svelte';
  import ProposalCard from './ProposalCard.svelte';

  export let locale: 'en' | 'zh';
  export let data: AgentData;
  export let apiKey: string;
  export let onKeyChange: (value: string) => void;
  export let onSave: (data: AgentData) => Promise<void>;
  let draft = '';
  let busy = false;
  let error = '';
  let notice = '';
  let proposals: TaskProposal[] = [];
  $: zh = locale === 'zh';

  function messageFor(code: string): string {
    const messages: Record<string, [string, string]> = {
      missing_key: ['Enter your OpenAI API key first.', '请先输入 OpenAI API Key。'],
      invalid_key: ['Your OpenAI API key is invalid or unavailable.', 'API Key 无效或不可用。'],
      timeout: ['The model request timed out. You can retry.', '模型请求超时，可以重试。'],
      rate_limited: ['Too many requests. Please try again later.', '请求过于频繁，请稍后再试。'],
      malformed_response: ['The model returned an invalid response. Please retry.', '模型返回无效内容，请重试。'],
      network_error: ['Network unavailable. Check your connection and retry.', '网络不可用，请检查连接后重试。'],
      storage_error: ['Could not save your response. Check browser storage and retry.', '无法保存回答，请检查浏览器存储空间后重试。'],
      server_error: ['The model service is temporarily unavailable. Please retry.', '模型服务暂不可用，请重试。'],
    };
    const pair = messages[code] || messages.server_error;
    return zh ? pair[1] : pair[0];
  }

  async function submit() {
    if (busy || !draft.trim()) return;
    error = '';
    notice = '';
    busy = true;
    const prompt = draft.trim();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 42_000);
    try {
      const result = await sendChat(createChatRequest(data, prompt), apiKey, controller.signal);
      const now = new Date().toISOString();
      const turns: ConversationTurn[] = [
        { id: crypto.randomUUID(), role: 'user', content: prompt, createdAt: now },
        { id: crypto.randomUUID(), role: 'assistant', content: result.text, createdAt: now },
      ];
      try { await onSave({ ...data, conversation: [...data.conversation, ...turns].slice(-1000) }); }
      catch { throw new ChatError('storage_error'); }
      draft = '';
      const valid: TaskProposal[] = [];
      for (const raw of result.proposals) {
        try { valid.push(validateProposal(raw, data)); }
        catch { notice = zh ? '已忽略无效的行动建议。' : 'An invalid action suggestion was ignored.'; }
      }
      proposals = valid;
    } catch (failure) {
      error = messageFor(failure instanceof ChatError ? failure.code : 'server_error');
    } finally { clearTimeout(timeout); busy = false; }
  }

  async function approve(proposal: TaskProposal) {
    let updated: AgentData;
    try {
      updated = applyProposal(data, proposal);
    } catch {
      error = zh ? '待办已变化，请重新请求建议。' : 'Your tasks changed. Ask for a fresh suggestion.';
      return;
    }
    try { await onSave(updated); }
    catch { error = messageFor('storage_error'); return; }
    proposals = proposals.filter(item => item.id !== proposal.id);
    notice = zh ? '已批准并更新待办。' : 'Approved and updated your tasks.';
  }
  function reject(proposal: TaskProposal) { proposals = proposals.filter(item => item.id !== proposal.id); }
</script>

<div class="conversation-view"><div class="panel-heading"><div><p class="workspace-kicker">PERSONAL AI AGENT</p><h2>{zh ? '和你的 Agent 对话' : 'Talk with your agent'}</h2></div></div>
  <ApiKeySettings {locale} value={apiKey} onChange={onKeyChange} />
  <div class="conversation-list" aria-live="polite">{#if data.conversation.length === 0}<div class="chat-empty"><span>✳</span><h3>{zh ? '从一个问题开始。' : 'Start with a question.'}</h3><p>{zh ? '你的 Agent 会参考你提供的背景、记忆和目标。' : 'Your agent can use the context, memories, and goals you chose to share.'}</p></div>{:else}{#each data.conversation as turn (turn.id)}<article class:user-turn={turn.role === 'user'} class:assistant-turn={turn.role === 'assistant'}><span>{turn.role === 'user' ? (zh ? '你' : 'You') : 'Agent'}</span><p>{turn.content}</p></article>{/each}{/if}</div>
  {#if error}<p role="alert" class="error-message">{error}</p><button class="ws-secondary retry-button" onclick={submit}>{zh ? '重试' : 'Retry'}</button>{/if}
  {#if notice}<p role="alert" class="notice-message">{notice}</p>{/if}
  {#each proposals as proposal (proposal.id)}<ProposalCard {locale} {proposal} onApprove={() => approve(proposal)} onReject={() => reject(proposal)} />{/each}
  <form class="composer" onsubmit={(event) => { event.preventDefault(); submit(); }}><label class="sr-only" for="chat-message">{zh ? '你的消息' : 'Your message'}</label><textarea id="chat-message" bind:value={draft} maxlength="4000" rows="3" placeholder={zh ? '你正在思考什么？' : 'What is on your mind?'}></textarea><div><small>{zh ? 'Agent 的建议不会自动执行' : 'Suggestions never run automatically'}</small><button class="ws-primary" type="submit" disabled={busy}>{busy ? (zh ? '正在思考…' : 'Thinking…') : (zh ? '发送' : 'Send')} <span aria-hidden="true">↗</span></button></div></form>
</div>
