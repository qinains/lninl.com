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
  import GoalList from './GoalList.svelte';
  import { nextDueGoal } from '../lib/continuity';
  import { defaultProviderConfig, providerDefaults, type Provider, type ProviderConfig } from '../lib/chat';
  import './workspace.css';

  export let locale: 'en' | 'zh';
  let data: AgentData | null = null;
  let tab: 'home' | 'goals' | 'chat' | 'profile' | 'memories' | 'tasks' | 'data' = 'home';
  let error = '';
  let apiKey = '';
  let providerConfig: ProviderConfig = { ...defaultProviderConfig };
  $: zh = locale === 'zh';
  $: firstName = data?.profile.name.split(' ')[0] || '';
  $: dueGoal = data ? nextDueGoal(data) : null;

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
  function setProvider(provider: Provider) { providerConfig = { ...providerDefaults[provider] }; apiKey = ''; }
  function setApiUrl(apiUrl: string) { providerConfig = { ...providerConfig, apiUrl }; apiKey = ''; }
  function setModel(model: string) { providerConfig = { ...providerConfig, model }; }
  const tabs = [
    { id: 'home', en: 'Overview', zh: '概览', icon: '◫' },
    { id: 'goals', en: 'Goals', zh: '目标', icon: '◎' },
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
        <div class="welcome"><p class="workspace-kicker">{zh ? '欢迎回来' : 'WELCOME BACK'}</p><h1>{zh ? `${firstName}，今天想推进什么？` : `What matters today, ${firstName}?`}</h1><p>{zh ? '围绕你的目标，行动、回顾，再调整下一步。' : 'Act, check in, and adjust your next step around your goals.'}</p></div>
        {#if dueGoal}<button class="due-banner" onclick={() => tab = 'goals'}>{zh ? '该回顾目标了：' : 'Time to review: '}{dueGoal.title} →</button>{/if}
        <div class="overview-grid"><button onclick={() => tab = 'goals'} class="overview-card overview-primary"><span>◎</span><h2>{zh ? '目标与回顾' : 'Goals & check-ins'}</h2><p>{zh ? `${data.goals.filter(goal => goal.status === 'active').length} 个进行中的目标` : `${data.goals.filter(goal => goal.status === 'active').length} active goals`}</p><b aria-hidden="true">↗</b></button><button onclick={() => tab = 'chat'} class="overview-card"><span>✳</span><h2>{zh ? '和 Agent 聊聊' : 'Talk with your agent'}</h2><p>{zh ? '结合你的进展讨论下一步。' : 'Discuss the next step using your progress.'}</p><b aria-hidden="true">↗</b></button><button onclick={() => tab = 'tasks'} class="overview-card"><span>✓</span><h2>{zh ? '待办' : 'Tasks'}</h2><p>{zh ? `${data.tasks.filter(task => !task.completed).length} 件待完成的事` : `${data.tasks.filter(task => !task.completed).length} open tasks`}</p><b aria-hidden="true">↗</b></button></div>
        <div class="goals-panel"><p class="workspace-kicker">{zh ? '持续推进' : 'KEEP MOVING'}</p>{#if data.goals.length}{#each data.goals.filter(goal => goal.status === 'active') as goal}<div class="goal-row"><span>◎</span><div><strong>{goal.title}</strong>{#if goal.stage}<small>{goal.stage}</small>{/if}{#each data.checkIns.filter(item => item.goalId === goal.id).slice(-1) as item}<small>{zh ? '最近回顾：' : 'Last check-in: '}{item.outcome}</small>{/each}</div></div>{/each}{:else}<p class="subtle">{zh ? '创建一个目标，再记录行动和回顾。' : 'Create a goal, then track actions and check-ins.'}</p>{/if}</div>
      {:else if tab === 'goals'}
        <GoalList {locale} {data} onSave={persist} />
      {:else if tab === 'chat'}
        <Conversation {locale} {data} {apiKey} {providerConfig} onKeyChange={setApiKey} onProviderChange={setProvider} onUrlChange={setApiUrl} onModelChange={setModel} onSave={persist} />
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
