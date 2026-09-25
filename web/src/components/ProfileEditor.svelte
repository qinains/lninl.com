<script lang="ts">
  import type { AgentData } from '../lib/domain';
  export let locale: 'en' | 'zh';
  export let data: AgentData;
  export let onSave: (data: AgentData) => Promise<void>;
  $: zh = locale === 'zh';
  $: name = data.profile.name;
  $: about = data.profile.about;
  $: preferences = data.profile.preferences;
  let name: string;
  let about: string;
  let preferences: string;

  async function save() {
    if (!name.trim()) return;
    await onSave({ ...data, profile: { name: name.trim(), about: about.trim(), preferences: preferences.trim() } });
  }
</script>

<div class="panel"><div class="panel-heading"><div><p class="workspace-kicker">{zh ? '个人背景' : 'PERSONAL CONTEXT'}</p><h2>{zh ? '关于你' : 'About you'}</h2></div></div>
  <form class="field-grid" onsubmit={(event) => { event.preventDefault(); save(); }}>
    <label>{zh ? '我的名字' : 'My name'}<input bind:value={name} maxlength="120" required /></label>
    <label>{zh ? '关于我' : 'About me'}<textarea bind:value={about} maxlength="4000" rows="4"></textarea></label>
    <label>{zh ? '我的偏好' : 'My preferences'}<textarea bind:value={preferences} maxlength="4000" rows="3"></textarea></label>
    <button class="ws-primary" type="submit">{zh ? '保存档案' : 'Save profile'}</button>
  </form>
</div>
