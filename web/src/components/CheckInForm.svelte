<script lang="ts">
  import type { AgentData } from '../lib/domain';
  import { addCheckIn } from '../lib/continuity';

  export let locale: 'en' | 'zh';
  export let data: AgentData;
  export let goalId: string;
  export let onSave: (data: AgentData) => Promise<void>;
  export let onDone: () => void;
  let outcome = '';
  let learned = '';
  let nextStep = '';
  let nextReviewAt = '';
  let error = '';
  $: zh = locale === 'zh';

  async function save() {
    try {
      const updated = addCheckIn(data, { goalId, outcome, learned, nextStep, nextReviewAt: nextReviewAt || null });
      await onSave(updated);
      onDone();
    } catch {
      error = zh ? '无法保存回顾，请检查输入和浏览器存储。' : 'Could not save check-in. Check your input and browser storage.';
    }
  }
</script>

<form class="checkin-form field-grid" onsubmit={(event) => { event.preventDefault(); save(); }}>
  <h3>{zh ? '回顾这段进展' : 'Review your progress'}</h3>
  <label>{zh ? '这次进展' : 'What happened'}<textarea bind:value={outcome} maxlength="2000" required rows="3"></textarea></label>
  <label>{zh ? '你学到了什么或情况有何变化？' : 'What changed or did you learn?'}<textarea bind:value={learned} maxlength="2000" rows="2"></textarea></label>
  <label>{zh ? '下一步行动' : 'Next action'}<input bind:value={nextStep} maxlength="300" placeholder={zh ? '可选，保存后成为待办' : 'Optional; becomes a task'} /></label>
  <label>{zh ? '下次回顾日期' : 'Next review date'}<input type="date" bind:value={nextReviewAt} /></label>
  {#if error}<p role="alert" class="error-message">{error}</p>{/if}
  <div class="checkin-actions"><button type="button" class="ws-secondary" onclick={onDone}>{zh ? '取消' : 'Cancel'}</button><button type="submit" class="ws-primary">{zh ? '保存回顾' : 'Save check-in'}</button></div>
</form>
