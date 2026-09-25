<script lang="ts">
  import type { Provider, ProviderConfig } from '../lib/chat';
  export let locale: 'en' | 'zh';
  export let value: string;
  export let config: ProviderConfig;
  export let onChange: (value: string) => void;
  export let onProviderChange: (provider: Provider) => void;
  export let onUrlChange: (url: string) => void;
  export let onModelChange: (model: string) => void;
  let visible = false;
  $: zh = locale === 'zh';
</script>

<div class="key-settings">
  <div><label for="provider">{zh ? '接入协议' : 'API protocol'}</label><select id="provider" value={config.provider} onchange={(event) => onProviderChange(event.currentTarget.value as Provider)}><option value="openai_responses">OpenAI-compatible Responses</option><option value="openai_chat_completions">OpenAI-compatible Chat Completions (DeepSeek)</option><option value="anthropic_messages">Anthropic Messages</option></select></div>
  <div><label for="api-url">{zh ? 'API URL（完整地址）' : 'API URL (full endpoint)'}</label><input id="api-url" type="url" autocomplete="off" spellcheck="false" value={config.apiUrl} oninput={(event) => onUrlChange(event.currentTarget.value)} /></div>
  <div><label for="model-id">{zh ? '模型 ID' : 'Model ID'}</label><input id="model-id" type="text" autocomplete="off" spellcheck="false" value={config.model} oninput={(event) => onModelChange(event.currentTarget.value)} placeholder={zh ? '填写服务商提供的模型 ID' : 'Enter provider model ID'} /></div>
  <div><label for="api-key">API Key</label><p>{zh ? '仅在当前页面内存中使用；切换协议或修改 URL 会清除 Key。发送时，所选个人背景会经由本站网关发往上方地址。' : 'Held only in page memory. Changing the protocol or URL clears the key. Selected personal context is sent through our gateway to the URL above.'}</p></div>
  <div class="key-input"><input id="api-key" type={visible ? 'text' : 'password'} autocomplete="off" spellcheck="false" value={value} oninput={(event) => onChange(event.currentTarget.value)} placeholder="API Key" /><button type="button" aria-label={zh ? '切换 Key 可见性' : 'Toggle key visibility'} onclick={() => visible = !visible}>{visible ? '◉' : '◎'}</button></div>
</div>
<style>
  .key-settings { display: grid; grid-template-columns: 1fr 1fr; align-items: start; }
  .key-settings > div { min-width: 0; }
  .key-settings label { display: block; margin-bottom: 6px; }
  .key-settings select, .key-settings input:not(#api-key) { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #d7e2d4; border-radius: 7px; background: #fffefa; color: #213f31; font: inherit; font-size: 12px; }
  .key-settings .key-input { min-width: 0; }
  @media (max-width: 650px) { .key-settings { grid-template-columns: 1fr; } }
</style>
