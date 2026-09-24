<script lang="ts">
  import { onMount } from 'svelte';
  import type { AgentData } from '../lib/domain';
  import { emptyData, loadData, saveData } from '../lib/storage';
  import Onboarding from './Onboarding.svelte';
  import ProfileEditor from './ProfileEditor.svelte';
  import MemoryList from './MemoryList.svelte';
  import TaskList from './TaskList.svelte';
  import DataSettings from './DataSettings.svelte';
  import Conversation from './Conversation.svelte';
  import './workspace.css';

  export let locale: 'en' | 'zh';
  let data: AgentData | null = null;
  let tab: 'home' | 'chat' | 'profile' | 'memories' | 'tasks' | 'data' = 'home';
  let error = '';
  let apiKey = '';
  $: zh = locale === 'zh';
  $: firstName = data?.profile.name.split(' ')[0] || '';

  onMount(async () => {
    try { data = await loadData(); }
    catch { error = zh ? '无法读取本地数据。请检查浏览器存储设置。' : 'Could not read local data. Check browser storage settings.'; }
  });

  async function persist(updated: AgentData) {
    await saveData(updated);
    data = updated;
    error = '';
  }

  async function commit(updated: AgentData) {
    try { await persist(updated); }
    catch { error = zh ? '保存失败。请检查浏览器存储空间。' : 'Save failed. Check browser storage space.'; }
  }

  function cleared() { data = emptyData(); tab = 'home'; }
  function setApiKey(value: string) { apiKey = value; }
  const tabs = [
    { id: 'home', en: 'Overview', zh: '概览', icon: '◫' },
    { id: 'chat', en: 'Conversation', zh: '对话', icon: '✳' },
    { id: 'profile', en: 'My context', zh: '个人档案', icon: '◉' },
    { id: 'memories', en: 'Memories', zh: '记忆', icon: '◇' },
    { id: 'tasks', en: 'Tasks', zh: '待办', icon: '✓' },
    { id: 'data', en: 'Data', zh: '数据', icon: '⇩' },
  ] as const;
</script>

{#if data === null}
  <main class="workspace-loading" aria-live="polite">{error || (zh ? '正在载入工作台…' : 'Loading your workspace…')}</main>
{:else if !data.profile.name.trim()}
  <main class="onboarding-wrap" aria-label={zh ? '个人工作台' : 'Personal workspace'}>
    {#if error}<p role="alert" class="error-message">{error}</p>{/if}
    <Onboarding {locale} {data} onSave={commit} />
  </main>
{:else}
  <main class="workspace" aria-label={zh ? '个人工作台' : 'Personal workspace'}>
    <aside class="workspace-sidebar"><div class="sidebar-heading"><span class="sidebar-agent-icon">✳</span><div><strong>{zh ? '我的 Agent' : 'My Agent'}</strong><small>{zh ? '个人工作台' : 'PERSONAL WORKSPACE'}</small></div></div>
      <nav aria-label={zh ? '工作台导航' : 'Workspace navigation'}>{#each tabs as item}<button class:active={tab === item.id} onclick={() => tab = item.id}><span class="tab-icon">{item.icon}</span>{zh ? item.zh : item.en}</button>{/each}</nav>
      <div class="sidebar-bottom"><span class="status-dot"></span>{zh ? '本地优先 · 数据由你掌控' : 'Local-first · In your control'}</div>
    </aside>
    <div class="workspace-main"><div class="workspace-topbar"><span>{zh ? '你的个人空间' : 'YOUR PERSONAL SPACE'}</span><span>{data.profile.name}</span></div>
      {#if error}<p role="alert" class="error-message">{error}</p>{/if}
      {#if tab === 'home'}
        <div class="welcome"><p class="workspace-kicker">{zh ? '欢迎回来' : 'WELCOME BACK'}</p><h1>{zh ? `${firstName}，今天想推进什么？` : `What matters today, ${firstName}?`}</h1><p>{zh ? '你的背景、目标和下一步，都在这里。' : 'Your context, goals, and next steps are here when you need them.'}</p></div>
        <div class="overview-grid"><button onclick={() => tab = 'chat'} class="overview-card overview-primary"><span>✳</span><h2>{zh ? '和 Agent 聊聊' : 'Talk with your agent'}</h2><p>{zh ? '带着你的背景和目标，一起思考下一步。' : 'Think through your next step with your context in mind.'}</p><b aria-hidden="true">↗</b></button><button onclick={() => tab = 'memories'} class="overview-card"><span>◇</span><h2>{zh ? '记忆' : 'Memories'}</h2><p>{zh ? `${data.memories.length} 条由你管理的记忆` : `${data.memories.length} memories you control`}</p><b aria-hidden="true">↗</b></button><button onclick={() => tab = 'tasks'} class="overview-card"><span>✓</span><h2>{zh ? '待办' : 'Tasks'}</h2><p>{zh ? `${data.tasks.filter(task => !task.completed).length} 件待完成的事` : `${data.tasks.filter(task => !task.completed).length} open tasks`}</p><b aria-hidden="true">↗</b></button></div>
        <div class="goals-panel"><p class="workspace-kicker">{zh ? '当前目标' : 'CURRENT GOALS'}</p>{#if data.profile.goals.length}{#each data.profile.goals as goal}<div class="goal-row"><span>◎</span>{goal}</div>{/each}{:else}<p class="subtle">{zh ? '在个人档案中添加目标。' : 'Add your goals in My context.'}</p>{/if}</div>
      {:else if tab === 'chat'}
        <Conversation {locale} {data} {apiKey} onKeyChange={setApiKey} onSave={persist} />
      {:else if tab === 'profile'}
        <ProfileEditor {locale} {data} onSave={commit} />
      {:else if tab === 'memories'}
        <MemoryList {locale} {data} onSave={commit} />
      {:else if tab === 'tasks'}
        <TaskList {locale} {data} onSave={commit} />
      {:else}
        <DataSettings {locale} {data} onSave={commit} onClear={cleared} />
      {/if}
    </div>
  </main>
{/if}
