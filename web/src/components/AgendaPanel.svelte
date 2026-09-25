<script lang="ts">
  import type { AgentData } from '../lib/domain';
  import { agenda } from '../lib/continuity';

  export let locale: 'en' | 'zh';
  export let data: AgentData;
  export let onStart: (goalId: string) => void;
  $: zh = locale === 'zh';
  $: items = agenda(data);

  function reason(value: 'due' | 'open_task' | 'continue'): string {
    if (value === 'due') return zh ? '已到回顾日期' : 'Review date reached';
    if (value === 'open_task') return zh ? '还有待完成的行动' : 'Has an open action';
    return zh ? '持续推进中的目标' : 'Active goal';
  }
</script>

<section class="agenda-panel" aria-label={zh ? '待推进事项' : 'Progress agenda'}>
  <div class="agenda-heading"><div><p class="workspace-kicker">PERSONAL COO</p><h2>{zh ? '接下来推进什么' : 'What to move forward'}</h2></div><small>{zh ? '根据已记录的目标与回顾排序' : 'Ranked from recorded goals and check-ins'}</small></div>
  {#if items.length === 0}<p class="subtle">{zh ? '先创建一个工作或生活目标。' : 'Start with a work or life goal.'}</p>{/if}
  <div class="agenda-grid">{#each items as item (item.goal.id)}
    <article class="agenda-card"><div><span class="agenda-domain">{item.goal.domain === 'work' ? (zh ? '工作' : 'Work') : item.goal.domain === 'life' ? (zh ? '生活' : 'Life') : item.goal.domain === 'learning' ? (zh ? '学习' : 'Learning') : (zh ? '其他' : 'Other')}</span><span class="agenda-reason">{reason(item.reason)}</span></div><h3>{item.goal.title}</h3>{#if item.goal.stage}<p>{item.goal.stage}</p>{/if}<button class="ws-secondary" aria-label={zh ? `为${item.goal.title}准备成果` : `Prepare ${item.goal.domain} for ${item.goal.title}`} onclick={() => onStart(item.goal.id)}>{zh ? '让 Agent 准备成果' : 'Prepare a work product'} →</button></article>
  {/each}</div>
</section>

<style>
  .agenda-panel { margin-top: 28px; background: #fffefa; border: 1px solid #dfe8dc; border-radius: 14px; padding: 25px; }
  .agenda-heading { display: flex; justify-content: space-between; align-items: end; gap: 18px; margin-bottom: 18px; }
  .agenda-heading h2 { font-family: Manrope, sans-serif; letter-spacing: -.04em; font-size: 24px; margin: 5px 0 0; }
  .agenda-heading small { color: #758677; font-size: 11px; }
  .agenda-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .agenda-card { border: 1px solid #e1e9dc; background: #f7f9f3; border-radius: 10px; padding: 18px; min-width: 0; }
  .agenda-card > div { display: flex; flex-wrap: wrap; gap: 9px; align-items: center; }
  .agenda-domain { color: #315942; font-weight: 800; font-size: 11px; }
  .agenda-reason { color: #718271; font-size: 11px; }
  .agenda-card h3 { margin: 10px 0 5px; font-size: 16px; overflow-wrap: anywhere; }
  .agenda-card p { color: #697b6c; font-size: 12px; margin: 0 0 12px; }
  .agenda-card button { margin-top: 8px; white-space: normal; text-align: left; }
  @media (max-width: 650px) { .agenda-grid { grid-template-columns: 1fr; } .agenda-heading { align-items: start; flex-direction: column; } }
</style>
