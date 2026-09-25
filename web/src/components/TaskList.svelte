<script lang="ts">
  import type { AgentData, Task } from '../lib/domain';
  export let locale: 'en' | 'zh';
  export let data: AgentData;
  export let onSave: (data: AgentData) => Promise<void>;
  let newTask = '';
  let goalId = '';
  $: zh = locale === 'zh';

  async function add() {
    if (!newTask.trim()) return;
    const now = new Date().toISOString();
    const task: Task = { id: crypto.randomUUID(), goalId: goalId || null, title: newTask.trim(), notes: '', completed: false, createdAt: now, updatedAt: now };
    await onSave({ ...data, tasks: [...data.tasks, task] });
    newTask = '';
  }
  async function toggle(id: string, completed: boolean) {
    await onSave({ ...data, tasks: data.tasks.map(task => task.id === id ? { ...task, completed, updatedAt: new Date().toISOString() } : task) });
  }
  async function remove(id: string) { await onSave({ ...data, tasks: data.tasks.filter(task => task.id !== id) }); }
</script>

<div class="panel"><div class="panel-heading"><div><p class="workspace-kicker">{zh ? '一步一步前进' : 'THE NEXT STEP'}</p><h2>{zh ? '你的待办' : 'Your tasks'}</h2></div><span class="count-badge">{data.tasks.filter(task => !task.completed).length}</span></div>
  <form class="inline-form" onsubmit={(event) => { event.preventDefault(); add(); }}><label class="sr-only" for="new-task">{zh ? '新待办' : 'New task'}</label><input id="new-task" bind:value={newTask} maxlength="300" placeholder={zh ? '下一步要做什么？' : 'What is your next step?'} /><label>{zh ? '关联目标' : 'Goal'}<select bind:value={goalId}><option value="">{zh ? '不关联' : 'None'}</option>{#each data.goals.filter(goal => goal.status === 'active') as goal}<option value={goal.id}>{goal.title}</option>{/each}</select></label><button class="ws-primary" type="submit">{zh ? '添加待办' : 'Add task'}</button></form>
  {#if data.tasks.length === 0}<p class="empty-state">{zh ? '还没有待办。从一件小事开始。' : 'No tasks yet. Start with one small step.'}</p>{/if}
  <ul class="item-list">{#each data.tasks as task (task.id)}<li class:done={task.completed}><label class="task-check"><input type="checkbox" checked={task.completed} onchange={(event) => toggle(task.id, event.currentTarget.checked)} /><span>{task.title}</span></label>{#if task.goalId}<small>{data.goals.find(goal => goal.id === task.goalId)?.title}</small>{/if}<button class="icon-button" aria-label={zh ? '删除待办' : 'Delete task'} onclick={() => remove(task.id)}>×</button></li>{/each}</ul>
</div>
