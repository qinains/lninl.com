<script lang="ts">
  import type { AgentData, Domain, Goal } from '../lib/domain';
  import CheckInForm from './CheckInForm.svelte';

  export let locale: 'en' | 'zh';
  export let data: AgentData;
  export let onSave: (data: AgentData) => Promise<void>;
  let title = '';
  let domain: Domain = 'other';
  let stage = '';
  let reviewing: string | null = null;
  let editing: string | null = null;
  let editTitle = '';
  let editDomain: Domain = 'other';
  let editStage = '';
  let error = '';
  $: zh = locale === 'zh';
  const domains: { value: Domain; en: string; zh: string }[] = [
    { value: 'work', en: 'Work', zh: '工作' }, { value: 'learning', en: 'Learning', zh: '学习' },
    { value: 'life', en: 'Life', zh: '生活' }, { value: 'other', en: 'Other', zh: '其他' },
  ];

  async function add() {
    if (!title.trim()) return;
    const now = new Date().toISOString();
    const goal: Goal = { id: crypto.randomUUID(), title: title.trim(), domain, stage: stage.trim(), status: 'active', nextReviewAt: null, createdAt: now, updatedAt: now };
    try { await onSave({ ...data, goals: [...data.goals, goal] }); title = ''; stage = ''; error = ''; }
    catch { error = zh ? '无法保存目标。' : 'Could not save goal.'; }
  }

  async function changeStatus(goal: Goal, status: Goal['status']) {
    try { await onSave({ ...data, goals: data.goals.map(item => item.id === goal.id ? { ...item, status, updatedAt: new Date().toISOString() } : item) }); error = ''; }
    catch { error = zh ? '无法更新目标。' : 'Could not update goal.'; }
  }

  function startEdit(goal: Goal) { editing = goal.id; editTitle = goal.title; editDomain = goal.domain; editStage = goal.stage; }
  async function saveEdit() {
    if (!editing || !editTitle.trim()) return;
    try {
      await onSave({ ...data, goals: data.goals.map(item => item.id === editing ? { ...item, title: editTitle.trim(), domain: editDomain, stage: editStage.trim(), updatedAt: new Date().toISOString() } : item) });
      editing = null; error = '';
    } catch { error = zh ? '无法保存目标。' : 'Could not save goal.'; }
  }
</script>

<div class="panel goal-list"><div class="panel-heading"><div><p class="workspace-kicker">{zh ? '持续推进' : 'CONTINUOUS PROGRESS'}</p><h2>{zh ? '你的目标' : 'Your goals'}</h2></div><span class="count-badge">{data.goals.filter(goal => goal.status === 'active').length}</span></div>
  <p class="subtle">{zh ? '从一个目标开始，记录行动和回顾。你的 Agent 会在后续对话中参考这些进展。' : 'Start with a goal, act, then check in. Your agent can use this progress in later conversations.'}</p>
  <form class="field-grid goal-create" onsubmit={(event) => { event.preventDefault(); add(); }}>
    <label>{zh ? '目标名称' : 'Goal title'}<input bind:value={title} maxlength="500" required /></label>
    <label>{zh ? '领域' : 'Domain'}<select bind:value={domain}>{#each domains as item}<option value={item.value}>{zh ? item.zh : item.en}</option>{/each}</select></label>
    <label>{zh ? '当前阶段' : 'Current stage'}<input bind:value={stage} maxlength="500" placeholder={zh ? '可选' : 'Optional'} /></label>
    {#if error}<p role="alert" class="error-message">{error}</p>{/if}
    <button class="ws-primary" type="submit">{zh ? '创建目标' : 'Create goal'}</button>
  </form>
  {#if data.goals.length === 0}<p class="empty-state">{zh ? '还没有目标。' : 'No goals yet.'}</p>{/if}
  <div class="goal-cards">{#each data.goals as goal (goal.id)}
    <section class="goal-card"><div class="goal-card-heading"><div><small>{zh ? domains.find(item => item.value === goal.domain)?.zh : domains.find(item => item.value === goal.domain)?.en} · {goal.status === 'active' ? (zh ? '进行中' : 'Active') : goal.status === 'paused' ? (zh ? '已暂停' : 'Paused') : (zh ? '已完成' : 'Done')}</small><h3>{goal.title}</h3></div><select aria-label={zh ? `更新${goal.title}状态` : `Update ${goal.title} status`} value={goal.status} onchange={(event) => changeStatus(goal, event.currentTarget.value as Goal['status'])}><option value="active">{zh ? '进行中' : 'Active'}</option><option value="paused">{zh ? '暂停' : 'Paused'}</option><option value="done">{zh ? '完成' : 'Done'}</option></select></div>
      {#if editing === goal.id}<form class="field-grid goal-edit" onsubmit={(event) => { event.preventDefault(); saveEdit(); }}><label>{zh ? '编辑目标名称' : 'Edit goal title'}<input bind:value={editTitle} maxlength="500" required /></label><label>{zh ? '编辑领域' : 'Edit domain'}<select bind:value={editDomain}>{#each domains as item}<option value={item.value}>{zh ? item.zh : item.en}</option>{/each}</select></label><label>{zh ? '编辑当前阶段' : 'Edit current stage'}<input bind:value={editStage} maxlength="500" /></label><div class="checkin-actions"><button class="ws-secondary" type="button" onclick={() => editing = null}>{zh ? '取消' : 'Cancel'}</button><button class="ws-primary" type="submit">{zh ? '保存目标' : 'Save goal'}</button></div></form>{:else}<button class="ws-secondary" onclick={() => startEdit(goal)}>{zh ? '编辑目标' : 'Edit goal'}</button>{/if}
      {#if goal.stage}<p>{zh ? '当前阶段：' : 'Current stage: '}{goal.stage}</p>{/if}
      {#if goal.nextReviewAt}<p>{zh ? '下次回顾：' : 'Next review: '}{goal.nextReviewAt}</p>{/if}
      {#each data.tasks.filter(task => task.goalId === goal.id && !task.completed).slice(0, 3) as task}<p class="goal-action">↗ {task.title}</p>{/each}
      {#if goal.status === 'active'}<button class="ws-secondary" onclick={() => reviewing = reviewing === goal.id ? null : goal.id}>{zh ? '回顾目标' : 'Check in'}</button>{/if}
      {#if reviewing === goal.id}<CheckInForm {locale} {data} goalId={goal.id} {onSave} onDone={() => reviewing = null} />{/if}
      {#each data.checkIns.filter(item => item.goalId === goal.id).slice(-3).reverse() as item}<div class="checkin-history"><small>{item.createdAt.slice(0, 10)}</small><p>{item.outcome}</p>{#if item.learned}<small>{zh ? '变化与经验：' : 'Learning: '}{item.learned}</small>{/if}</div>{/each}
    </section>
  {/each}</div>
</div>
