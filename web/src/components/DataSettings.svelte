<script lang="ts">
  import type { AgentData } from '../lib/domain';
  import { clearData, exportData, parseImport } from '../lib/storage';
  export let locale: 'en' | 'zh';
  export let data: AgentData;
  export let onSave: (data: AgentData) => Promise<void>;
  export let onClear: () => void;
  let error = '';
  let importPreview: AgentData | null = null;
  let confirmClear = false;
  $: zh = locale === 'zh';

  function download() {
    const url = URL.createObjectURL(new Blob([exportData(data)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'personal-agent-data.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function pick(event: Event) {
    error = '';
    importPreview = null;
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    try { importPreview = parseImport(await file.text()); }
    catch { error = zh ? '无法导入：文件格式或版本无效。' : 'Import failed: invalid format or version.'; }
  }
  async function replace() {
    if (!importPreview) return;
    await onSave(importPreview);
    importPreview = null;
  }
  async function erase() { await clearData(); onClear(); confirmClear = false; }
</script>

<div class="panel"><div class="panel-heading"><div><p class="workspace-kicker">{zh ? '掌控你的资料' : 'OWN YOUR DATA'}</p><h2>{zh ? '数据管理' : 'Your data'}</h2></div></div>
  <div class="data-row"><div><h3>{zh ? '导出数据' : 'Export data'}</h3><p>{zh ? '下载包含档案、记忆、待办和对话的 JSON 文件。' : 'Download your profile, memories, tasks, and conversation as JSON.'}</p></div><button class="ws-secondary" onclick={download}>{zh ? '导出数据' : 'Export data'}</button></div>
  <div class="data-row"><div><h3>{zh ? '导入数据' : 'Import data'}</h3><p>{zh ? '选择先前导出的文件。确认后将替换当前数据。' : 'Choose a previous export. You will review it before replacing this data.'}</p></div><label class="file-picker">{zh ? '导入数据文件' : 'Import data file'}<input type="file" accept="application/json,.json" aria-label={zh ? '导入数据文件' : 'Import data file'} onchange={pick} /></label></div>
  {#if error}<p role="alert" class="error-message">{error}</p>{/if}
  {#if importPreview}<div class="confirm-box"><p>{zh ? `将导入 ${importPreview.memories.length} 条记忆和 ${importPreview.tasks.length} 条待办，并替换当前数据。` : `Import ${importPreview.memories.length} memories and ${importPreview.tasks.length} tasks, replacing current data.`}</p><button class="ws-primary" onclick={replace}>{zh ? '确认替换' : 'Confirm replace'}</button><button class="ws-secondary" onclick={() => importPreview = null}>{zh ? '取消' : 'Cancel'}</button></div>{/if}
  <div class="data-row danger-row"><div><h3>{zh ? '清空本地数据' : 'Clear local data'}</h3><p>{zh ? '删除当前浏览器中的所有个人资料。此操作无法撤销。' : 'Delete all personal data from this browser. This cannot be undone.'}</p></div><button class="ws-danger" onclick={() => confirmClear = true}>{zh ? '清空数据' : 'Clear data'}</button></div>
  {#if confirmClear}<div class="confirm-box"><p>{zh ? '确定要删除所有本地数据吗？' : 'Delete all local data?'}</p><button class="ws-danger" onclick={erase}>{zh ? '确认清空' : 'Confirm clear'}</button><button class="ws-secondary" onclick={() => confirmClear = false}>{zh ? '取消' : 'Cancel'}</button></div>{/if}
</div>
