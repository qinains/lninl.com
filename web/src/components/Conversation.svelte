<script lang="ts">
  import type { AgentData, ConversationTurn, TaskProposal } from '../lib/domain';
  import { applyProposal, validateProposal } from '../lib/proposals';
  import { ChatError, createChatRequest, sendChat, type Provider, type ProviderConfig } from '../lib/chat';
  import ApiKeySettings from './ApiKeySettings.svelte';
  import ProposalCard from './ProposalCard.svelte';

  export let locale: 'en' | 'zh';
  export let data: AgentData;
  export let apiKey: string;
  export let starterGoalId: string | undefined = undefined;
  export let providerConfig: ProviderConfig;
  export let onProviderChange: (provider: Provider) => void;
  export let onUrlChange: (url: string) => void;
  export let onModelChange: (model: string) => void;
  export let onKeyChange: (value: string) => void;
  export let onSave: (data: AgentData) => Promise<void>;
  let draft = '';
  let busy = false;
  let error = '';
  let notice = '';
  let proposals: TaskProposal[] = [];
  let selectedGoalId: string | undefined;
  let appliedStarter: string | undefined;
  let preview: { goalId: string; title: string; body: string } | null = null;
  $: zh = locale === 'zh';
  $: if (starterGoalId && starterGoalId !== appliedStarter) {
    const goal = data.goals.find(item => item.id === starterGoalId && item.status === 'active');
    if (goal) {
      selectedGoalId = goal.id;
      draft = goal.domain === 'life'
        ? (zh ? `请为生活目标「${goal.title}」准备一份可执行的筹办清单，列出当前情况、关键决定、下一步和需要我补充的信息。只依据我提供的背景，输出可编辑的 deliverable 草稿，不要声称已联系或预订。` : `Prepare an actionable planning checklist for my life goal "${goal.title}". Include current context, decisions, next steps, and missing information. Use only my supplied context, return an editable deliverable draft, and do not claim to have contacted or booked anything.`)
        : (zh ? `请为目标「${goal.title}」准备一份可执行的项目简报，列出当前进展、下一里程碑、风险和下一步。只依据我提供的背景，输出可编辑的 deliverable 草稿，不要编造来源或已完成的工作。` : `Prepare an actionable project brief for my goal "${goal.title}". Include current progress, next milestone, risks, and next steps. Use only my supplied context, return an editable deliverable draft, and do not invent sources or completed work.`);
      appliedStarter = starterGoalId;
    }
  }

  function messageFor(code: string): string {
    const messages: Record<string, [string, string]> = {
      missing_key: ['Enter your API key first.', '请先输入 API Key。'],
      invalid_config: ['Check the API URL and model ID, then retry.', '请检查 API URL 和模型 ID 后重试。'],
      message_too_long: ['Your message is too long for the model gateway. Shorten it and retry.', '消息过长，请缩短后重试。'],
      invalid_key: ['Your API key is invalid or unavailable.', 'API Key 无效或不可用。'],
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
    if (busy || preview || !draft.trim()) return;
    error = '';
    notice = '';
    busy = true;
    const prompt = draft.trim();
    const goalId = selectedGoalId;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 42_000);
    try {
      const result = await sendChat(createChatRequest(data, prompt, selectedGoalId, providerConfig), apiKey, controller.signal);
      const now = new Date().toISOString();
      const turns: ConversationTurn[] = [
        { id: crypto.randomUUID(), role: 'user', content: prompt, createdAt: now },
        { id: crypto.randomUUID(), role: 'assistant', content: result.text, createdAt: now },
      ];
      try { await onSave({ ...data, conversation: [...data.conversation, ...turns].slice(-1000) }); }
      catch { throw new ChatError('storage_error'); }
      draft = '';
      selectedGoalId = undefined;
      const valid: TaskProposal[] = [];
      for (const raw of result.proposals) {
        try { valid.push(validateProposal(raw, data)); }
        catch { notice = zh ? '已忽略无效的行动建议。' : 'An invalid action suggestion was ignored.'; }
      }
      proposals = valid;
      if (result.deliverable && goalId && data.goals.some(goal => goal.id === goalId)) {
        preview = { goalId, ...result.deliverable };
      } else if (result.deliverable) {
        notice = zh ? '要保存成果，请先从一个目标发起。' : 'Start from a goal to save this work product.';
      }
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
  async function savePreview() {
    if (!preview || !preview.title.trim() || !preview.body.trim()) return;
    const now = new Date().toISOString();
    try {
      await onSave({ ...data, deliverables: [...data.deliverables, { id: crypto.randomUUID(), goalId: preview.goalId, title: preview.title.trim(), body: preview.body.trim(), createdAt: now, updatedAt: now }] });
      preview = null;
      error = '';
      notice = zh ? '成果已保存到当前浏览器。' : 'Work product saved in this browser.';
    } catch { error = messageFor('storage_error'); }
  }
</script>

<div class="conversation-view"><div class="panel-heading"><div><p class="workspace-kicker">PERSONAL AI AGENT</p><h2>{zh ? '和你的 Agent 对话' : 'Talk with your agent'}</h2></div></div>
  {#if data.goals.some(goal => goal.status === 'active')}<div class="review-starters"><small>{zh ? '围绕一个目标继续' : 'Continue with a goal'}</small>{#each data.goals.filter(goal => goal.status === 'active').slice(0, 6) as goal}<button class="ws-secondary" onclick={() => { selectedGoalId = goal.id; draft = zh ? `请根据我的目标「${goal.title}」和之前的回顾，帮我评估进展并提出下一步。` : `Review my progress on "${goal.title}" using my past check-ins and suggest a next step.`; }}>{zh ? `回顾 ${goal.title}` : `Review ${goal.title}`}</button>{/each}</div>{/if}
  <ApiKeySettings {locale} value={apiKey} config={providerConfig} onChange={onKeyChange} {onProviderChange} {onUrlChange} {onModelChange} />
  <div class="conversation-list" aria-live="polite">{#if data.conversation.length === 0}<div class="chat-empty"><span>✳</span><h3>{zh ? '从一个问题开始。' : 'Start with a question.'}</h3><p>{zh ? '你的 Agent 会参考你提供的背景、记忆和目标。' : 'Your agent can use the context, memories, and goals you chose to share.'}</p></div>{:else}{#each data.conversation as turn (turn.id)}<article class:user-turn={turn.role === 'user'} class:assistant-turn={turn.role === 'assistant'}><span>{turn.role === 'user' ? (zh ? '你' : 'You') : 'Agent'}</span><p>{turn.content}</p></article>{/each}{/if}</div>
  {#if error}<p role="alert" class="error-message">{error}</p><button class="ws-secondary retry-button" onclick={submit}>{zh ? '重试' : 'Retry'}</button>{/if}
  {#if notice}<p role="alert" class="notice-message">{notice}</p>{/if}
  {#each proposals as proposal (proposal.id)}<ProposalCard {locale} {proposal} onApprove={() => approve(proposal)} onReject={() => reject(proposal)} />{/each}
  {#if preview}<section class="deliverable-preview" aria-label={zh ? '成果预览' : 'Deliverable preview'}><p class="workspace-kicker">DRAFT · {zh ? '尚未保存' : 'NOT SAVED'}</p><h3>{zh ? '审阅 Agent 准备的成果' : 'Review the work product'}</h3><p>{zh ? '可先编辑，再确认保存到当前浏览器。不会自动发送给外部服务。' : 'Edit before saving in this browser. Nothing is sent to an external service.'}</p><div class="field-grid"><label>{zh ? '成果标题' : 'Deliverable title'}<input bind:value={preview.title} maxlength="160" required /></label><label>{zh ? '成果正文' : 'Deliverable body'}<textarea bind:value={preview.body} maxlength="12000" rows="10" required></textarea></label></div><div class="preview-actions"><button class="ws-primary" disabled={!preview.title.trim() || !preview.body.trim()} onclick={savePreview}>{zh ? '保存成果' : 'Save deliverable'}</button><button class="ws-secondary" onclick={() => preview = null}>{zh ? '丢弃草稿' : 'Discard draft'}</button></div></section>{/if}
  <form class="composer" onsubmit={(event) => { event.preventDefault(); submit(); }}><label class="sr-only" for="chat-message">{zh ? '你的消息' : 'Your message'}</label><textarea id="chat-message" bind:value={draft} maxlength="4000" rows="3" placeholder={zh ? '你正在思考什么？' : 'What is on your mind?'}></textarea><div><small>{zh ? 'Agent 的建议不会自动执行' : 'Suggestions never run automatically'}</small><button class="ws-primary" type="submit" disabled={busy || !!preview}>{busy ? (zh ? '正在思考…' : 'Thinking…') : (zh ? '发送' : 'Send')} <span aria-hidden="true">↗</span></button></div></form>
</div>
<style>
  .deliverable-preview { margin: 20px 0; padding: 22px; background: #f6f9ef; border: 1px solid #d6e5cc; border-radius: 12px; }
  .deliverable-preview h3 { margin: 8px 0; }
  .deliverable-preview > p:not(.workspace-kicker) { color: #6e7f70; font-size: 12px; }
  .preview-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
</style>
