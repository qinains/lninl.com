<script lang="ts">
  import type { AgentData, Deliverable } from '../lib/domain';

  export let locale: 'en' | 'zh';
  export let data: AgentData;
  export let onSave: (data: AgentData) => Promise<void>;
  export let onGoal: (goalId: string) => void;
  let editing: string | null = null;
  let title = '';
  let body = '';
  let error = '';
  $: zh = locale === 'zh';

  function start(item: Deliverable) { editing = item.id; title = item.title; body = item.body; error = ''; }
  async function save() {
    if (!editing || !title.trim() || !body.trim()) return;
    try {
      await onSave({ ...data, deliverables: data.deliverables.map(item => item.id === editing ? { ...item, title: title.trim(), body: body.trim(), updatedAt: new Date().toISOString() } : item) });
      editing = null; error = '';
    } catch { error = zh ? '无法保存成果，请保留草稿后重试。' : 'Could not save the work product. Keep your draft and retry.'; }
  }
</script>

<div class="panel"><div class="panel-heading"><div><p class="workspace-kicker">WORK PRODUCTS</p><h2>{zh ? 'Agent 准备的成果' : 'Deliverables'}</h2></div><span class="count-badge">{data.deliverables.length}</span></div>
  <p class="subtle">{zh ? '这些是你确认保存的可编辑草稿，保存在当前浏览器，并包含在数据导出中。' : 'These editable drafts were saved with your approval. They stay in this browser and are included in exports.'}</p>
  {#if error}<p role="alert" class="error-message">{error}</p>{/if}
  {#if data.deliverables.length === 0}<p class="empty-state">{zh ? '还没有成果。从概览中的目标开始。' : 'No work products yet. Start from a goal on the overview.'}</p>{/if}
  {#each [...data.deliverables].reverse() as item (item.id)}<article class="deliverable-card"><small>{data.goals.find(goal => goal.id === item.goalId)?.title} · {item.updatedAt.slice(0, 10)}</small>{#if editing === item.id}<form class="field-grid" onsubmit={(event) => { event.preventDefault(); save(); }}><label>{zh ? '编辑成果标题' : 'Edit deliverable title'}<input bind:value={title} maxlength="160" required /></label><label>{zh ? '编辑成果正文' : 'Edit deliverable body'}<textarea bind:value={body} maxlength="12000" rows="12" required></textarea></label><div><button class="ws-primary" type="submit">{zh ? '保存修改' : 'Save changes'}</button> <button class="ws-secondary" type="button" onclick={() => editing = null}>{zh ? '取消' : 'Cancel'}</button></div></form>{:else}<h3>{item.title}</h3><p class="deliverable-body">{item.body}</p><div class="deliverable-actions"><button class="ws-secondary" onclick={() => start(item)}>{zh ? '编辑成果' : 'Edit deliverable'}</button><button class="ws-secondary" onclick={() => onGoal(item.goalId)}>{zh ? '查看关联目标' : 'View linked goal'}</button></div>{/if}</article>{/each}
</div>

<style>
  .deliverable-card { border-top: 1px solid #e5e9e1; padding: 22px 0; }
  .deliverable-card small { color: #758675; }
  .deliverable-card h3 { margin: 8px 0; }
  .deliverable-body { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.65; font-size: 14px; }
  .deliverable-actions { display: flex; gap: 8px; flex-wrap: wrap; }
</style>
