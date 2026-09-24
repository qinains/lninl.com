<script lang="ts">
  export let locale: 'en' | 'zh';
  export let value: string;
  export let onChange: (value: string) => void;
  let visible = false;
  $: zh = locale === 'zh';
</script>

<div class="key-settings"><div><label for="api-key">OpenAI API Key</label><p>{zh ? '仅在当前页面会话中使用，刷新后需要重新输入。' : 'Used for this page session only. You will re-enter it after a refresh.'}</p></div><div class="key-input"><input id="api-key" type={visible ? 'text' : 'password'} autocomplete="off" spellcheck="false" value={value} oninput={(event) => onChange(event.currentTarget.value)} placeholder="sk-…" /><button type="button" aria-label={zh ? '切换 Key 可见性' : 'Toggle key visibility'} onclick={() => visible = !visible}>{visible ? '◉' : '◎'}</button></div></div>
