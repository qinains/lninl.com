<script lang="ts">
  import type { TaskProposal } from '../lib/domain';
  export let locale: 'en' | 'zh';
  export let proposal: TaskProposal;
  export let onApprove: () => Promise<void>;
  export let onReject: () => void;
  $: zh = locale === 'zh';
  $: verb = ({ create: zh ? '创建待办' : 'Create task', update: zh ? '修改待办' : 'Update task', complete: zh ? '完成待办' : 'Complete task', delete: zh ? '删除待办' : 'Delete task' })[proposal.kind];
</script>

<div class="proposal-card"><p class="workspace-kicker">{zh ? '需要你的确认' : 'YOUR APPROVAL REQUIRED'}</p><h3>{verb}</h3><p>{proposal.kind === 'create' ? proposal.title : proposal.kind === 'update' ? (proposal.title || proposal.notes || proposal.taskId) : proposal.taskId}</p><div><button class="ws-primary" onclick={onApprove}>{zh ? '批准' : 'Approve'}</button><button class="ws-secondary" onclick={onReject}>{zh ? '拒绝' : 'Reject'}</button></div></div>
