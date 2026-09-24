<script lang="ts">
  import type { AgentData, Memory } from '../lib/domain';
  export let locale: 'en' | 'zh';
  export let data: AgentData;
  export let onSave: (data: AgentData) => Promise<void>;
  let newMemory = '';
  let editing: string | null = null;
  let editText = '';
  $: zh = locale === 'zh';

  async function add() {
    if (!newMemory.trim()) return;
    const now = new Date().toISOString();
    const memory: Memory = { id: crypto.randomUUID(), text: newMemory.trim(), createdAt: now, updatedAt: now };
    await onSave({ ...data, memories: [...data.memories, memory] });
    newMemory = '';
  }
  function startEdit(memory: Memory) { editing = memory.id; editText = memory.text; }
  async function saveEdit() {
    if (!editText.trim()) return;
    await onSave({ ...data, memories: data.memories.map(memory => memory.id === editing ? { ...memory, text: editText.trim(), updatedAt: new Date().toISOString() } : memory) });
    editing = null;
  }
  async function remove(id: string) {
    await onSave({ ...data, memories: data.memories.filter(memory => memory.id !== id) });
  }
</script>

<div class="panel"><div class="panel-heading"><div><p class="workspace-kicker">{zh ? '由你决定 Agent 记住什么' : 'MEMORY YOU CONTROL'}</p><h2>{zh ? '你的记忆' : 'Your memories'}</h2></div><span class="count-badge">{data.memories.length}</span></div>
  <form class="inline-form" onsubmit={(event) => { event.preventDefault(); add(); }}><label class="sr-only" for="new-memory">{zh ? '新记忆' : 'New memory'}</label><input id="new-memory" bind:value={newMemory} maxlength="4000" placeholder={zh ? '记下一件值得 Agent 了解的事…' : 'Something your agent should know…'} /><button class="ws-primary" type="submit">{zh ? '添加记忆' : 'Add memory'}</button></form>
  {#if data.memories.length === 0}<p class="empty-state">{zh ? '还没有记忆。添加第一条，Agent 才能更了解你。' : 'No memories yet. Add one to give your agent more context.'}</p>{/if}
  <ul class="item-list">{#each data.memories as memory (memory.id)}<li>
    {#if editing === memory.id}
      <label class="sr-only" for="edit-memory">{zh ? '编辑记忆内容' : 'Edit memory text'}</label><input id="edit-memory" bind:value={editText} maxlength="4000" />
      <button class="ws-secondary" onclick={saveEdit}>{zh ? '保存记忆' : 'Save memory'}</button>
    {:else}
      <span class="item-text">{memory.text}</span><div class="item-actions"><button class="icon-button" aria-label={zh ? '编辑记忆' : 'Edit memory'} onclick={() => startEdit(memory)}>✎</button><button class="icon-button" aria-label={zh ? '删除记忆' : 'Delete memory'} onclick={() => remove(memory.id)}>×</button></div>
    {/if}
  </li>{/each}</ul>
</div>
