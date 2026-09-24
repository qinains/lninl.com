<script lang="ts">
  import type { AgentData } from '../lib/domain';
  export let locale: 'en' | 'zh';
  export let data: AgentData;
  export let onSave: (data: AgentData) => Promise<void>;
  let name = '';
  let about = '';
  let preferences = '';
  let goals = '';
  $: zh = locale === 'zh';

  async function save() {
    if (!name.trim()) return;
    await onSave({ ...data, profile: { name: name.trim(), about: about.trim(), preferences: preferences.trim(), goals: goals.split('\n').map(value => value.trim()).filter(Boolean) } });
  }
</script>

<section class="onboarding-card">
  <div class="step-indicator">01 <span>/</span> 01</div>
  <p class="workspace-kicker">{zh ? '让 Agent 从了解你开始' : 'MAKE IT YOURS'}</p>
  <h1>{zh ? '创建你的 Agent' : 'Create your agent'}</h1>
  <p class="subtle">{zh ? '先告诉它你是谁、希望完成什么。之后你可以随时修改。' : 'Start with who you are and what matters. You can change everything later.'}</p>
  <form onsubmit={(event) => { event.preventDefault(); save(); }}>
    <label>{zh ? '我的名字' : 'My name'}<input bind:value={name} maxlength="120" required placeholder={zh ? '你希望 Agent 如何称呼你？' : 'What should your agent call you?'} /></label>
    <label>{zh ? '关于我' : 'About me'}<textarea bind:value={about} maxlength="4000" rows="3" placeholder={zh ? '职业、兴趣、当下的背景…' : 'Your work, interests, current context…'}></textarea></label>
    <label>{zh ? '我的偏好' : 'My preferences'}<textarea bind:value={preferences} maxlength="4000" rows="2" placeholder={zh ? '例如：请给出简洁、具体的建议' : 'For example: concise, concrete suggestions'}></textarea></label>
    <label>{zh ? '我的目标' : 'My goals'}<textarea bind:value={goals} maxlength="2000" rows="3" placeholder={zh ? '每行一个目标' : 'One goal per line'}></textarea></label>
    <div class="onboarding-bottom"><span>{zh ? '数据仅保存在当前浏览器' : 'Your data stays in this browser'}</span><button class="ws-primary" type="submit">{zh ? '保存档案' : 'Save profile'} <span aria-hidden="true">→</span></button></div>
  </form>
</section>
