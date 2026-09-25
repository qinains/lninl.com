import { expect, test, type Page } from '@playwright/test';

test('a goal review starter prepares a grounded draft without sending it', async ({ page }) => {
  await page.goto('/app/');
  await page.getByLabel('My name').fill('Ada');
  await page.getByLabel('My goals').fill('Write weekly');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('button', { name: 'Conversation' }).click();
  await page.getByRole('button', { name: 'Review Write weekly' }).click();
  await expect(page.getByLabel('Your message')).toHaveValue(/Write weekly/);
});

async function onboard(page: Page, zh = false) {
  await page.goto(zh ? '/zh/app/' : '/app/');
  await page.getByLabel(zh ? '我的名字' : 'My name').fill('Ada');
  await page.getByRole('button', { name: zh ? '保存档案' : 'Save profile' }).click();
  await page.getByRole('navigation', { name: zh ? '工作台导航' : 'Workspace navigation' }).getByRole('button', { name: zh ? '对话' : 'Conversation' }).click();
}

test('invalid key is localized and is forgotten on reload', async ({ page }) => {
  await onboard(page, true);
  await page.route('**/api/chat', route => route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"invalid_key"}' }));
  await page.getByLabel('API Key', { exact: true }).fill('sk-test-secret');
  await page.getByLabel('你的消息').fill('你好');
  await page.getByRole('button', { name: '发送' }).click();
  await expect(page.getByRole('alert')).toContainText('API Key 无效');
  await expect(page.getByText('sk-test-secret')).toHaveCount(0);
  await page.reload();
  await page.getByRole('navigation', { name: '工作台导航' }).getByRole('button', { name: '对话' }).click();
  await expect(page.getByLabel('API Key', { exact: true })).toHaveValue('');
});

test('timeout retries and proposals require approval', async ({ page }) => {
  await onboard(page);
  let calls = 0;
  await page.route('**/api/chat', route => {
    calls++;
    if (calls === 1) return route.fulfill({ status: 504, contentType: 'application/json', body: '{"error":"upstream_timeout"}' });
    if (calls === 2) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'I can suggest a task.', proposals: [{ id: 'p1', kind: 'create', taskId: 't2', title: 'Draft outline' }] }) });
    if (calls === 3) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'Another suggestion.', proposals: [{ id: 'p2', kind: 'create', taskId: 't3', title: 'Write draft' }] }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'Here is advice.', proposals: [{ kind: 'delete', taskId: 'missing' }] }) });
  });
  await page.getByLabel('API Key', { exact: true }).fill('sk-test-secret');
  await page.getByLabel('Your message').fill('Help me plan');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('alert')).toContainText('timed out');
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByText('Draft outline')).toBeVisible();
  await page.getByRole('button', { name: 'Reject' }).click();
  await page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('button', { name: 'Tasks' }).click();
  await expect(page.getByText('Draft outline')).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('button', { name: 'Conversation' }).click();
  await page.getByLabel('Your message').fill('Suggest one task');
  await page.getByRole('button', { name: 'Send' }).click();
  await page.getByRole('button', { name: 'Approve' }).click();
  await page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('button', { name: 'Tasks' }).click();
  await expect(page.getByText('Write draft')).toBeVisible();
  await page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('button', { name: 'Conversation' }).click();
  await page.getByLabel('Your message').fill('What else?');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('alert')).toContainText('ignored');
  await page.reload();
  await page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('button', { name: 'Conversation' }).click();
  await expect(page.getByText('Here is advice.')).toBeVisible();
  await expect(page.getByLabel('API Key', { exact: true })).toHaveValue('');
});

test('a local storage failure keeps the unsaved message for retry', async ({ page }) => {
  await onboard(page);
  await page.route('**/api/chat', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"text":"A useful answer","proposals":[]}' }));
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () { throw new DOMException('Storage full', 'QuotaExceededError'); };
  });
  await page.getByLabel('API Key', { exact: true }).fill('sk-test-secret');
  await page.getByLabel('Your message').fill('Help me plan');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('alert').first()).toContainText(/save/i);
  await expect(page.getByLabel('Your message')).toHaveValue('Help me plan');
});

test('custom providers send configured protocol and clear key when destination changes', async ({ page }) => {
  await onboard(page);
  const requests: Record<string, unknown>[] = [];
  await page.route('**/api/chat', async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"text":"Next step","proposals":[]}' });
  });
  const protocol = page.getByLabel('API protocol');
  const url = page.getByLabel('API URL (full endpoint)');
  const model = page.getByLabel('Model ID');
  const key = page.getByLabel('API Key', { exact: true });
  await key.fill('openai-key');
  await protocol.selectOption('openai_chat_completions');
  await expect(key).toHaveValue('');
  await expect(url).toHaveValue('https://api.deepseek.com/chat/completions');
  await expect(model).toHaveValue('deepseek-flash');
  await key.fill('deepseek-key');
  await url.fill('https://gateway.example.com/v1/chat/completions');
  await expect(key).toHaveValue('');
  await key.fill('gateway-key');
  await model.fill('my-model');
  await page.getByLabel('Your message').fill('Help');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('Next step')).toBeVisible();
  expect(requests[0]).toMatchObject({ provider: 'openai_chat_completions', apiUrl: 'https://gateway.example.com/v1/chat/completions', model: 'my-model' });
  await protocol.selectOption('anthropic_messages');
  await expect(key).toHaveValue('');
  await expect(model).toHaveValue('');
  await model.fill('claude-model');
  await key.fill('anthropic-key');
  await page.getByLabel('Your message').fill('Again');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1]).toMatchObject({ provider: 'anthropic_messages', apiUrl: 'https://api.anthropic.com/v1/messages', model: 'claude-model' });
  await page.reload();
  await page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('button', { name: 'Conversation' }).click();
  await expect(protocol).toHaveValue('openai_responses');
  await expect(key).toHaveValue('');
});

test('work and life agenda produce editable deliverables only after approval', async ({ page }) => {
  await page.goto('/app/');
  await page.getByLabel('My name').fill('Ada');
  await page.getByRole('button', { name: 'Save profile' }).click();
  const nav = page.getByRole('navigation', { name: 'Workspace navigation' });
  await nav.getByRole('button', { name: 'Goals' }).click();
  await page.getByLabel('Goal title').fill('Ship product');
  await page.getByLabel('Domain').selectOption('work');
  await page.getByRole('button', { name: 'Create goal' }).click();
  await expect(page.getByLabel('Goal title')).toHaveValue('');
  await page.getByLabel('Goal title').fill('Plan family trip');
  await page.getByLabel('Domain').selectOption('life');
  await page.getByRole('button', { name: 'Create goal' }).click();
  await expect(page.getByLabel('Goal title')).toHaveValue('');
  let calls = 0;
  await page.route('**/api/chat', route => {
    calls++;
    const payload = route.request().postDataJSON();
    expect(payload.context.selectedGoalId).toBe(calls === 1 ? payload.context.profile.goals.find((item: { title: string }) => item.title === 'Ship product').id : payload.context.profile.goals.find((item: { title: string }) => item.title === 'Plan family trip').id);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'Draft ready.', proposals: [], deliverable: { title: calls === 1 ? 'Project brief' : 'Trip plan', body: 'Draft content' } }) });
  });
  await nav.getByRole('button', { name: 'Overview' }).click();
  await page.getByRole('button', { name: 'Prepare work for Ship product' }).click();
  await page.getByLabel('API Key', { exact: true }).fill('test-key');
  await expect(page.getByLabel('Your message')).toHaveValue(/Ship product/);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByLabel('Deliverable title')).toHaveValue('Project brief');
  await page.getByLabel('Deliverable body').fill('Edited work brief');
  await page.getByRole('button', { name: 'Save deliverable' }).click();
  await nav.getByRole('button', { name: 'Deliverables' }).click();
  await expect(page.getByText('Edited work brief')).toBeVisible();
  await page.getByRole('button', { name: 'Edit deliverable' }).click();
  await page.getByLabel('Edit deliverable body').fill('Revised work brief');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Revised work brief')).toBeVisible();
  await nav.getByRole('button', { name: 'Overview' }).click();
  await page.getByRole('button', { name: 'Prepare life for Plan family trip' }).click();
  await page.getByRole('button', { name: 'Send' }).click();
  await page.getByRole('button', { name: 'Discard draft' }).click();
  await nav.getByRole('button', { name: 'Deliverables' }).click();
  await expect(page.getByText('Trip plan')).toHaveCount(0);
  await nav.getByRole('button', { name: 'Overview' }).click();
  await page.getByRole('button', { name: 'Prepare life for Plan family trip' }).click();
  await page.getByRole('button', { name: 'Send' }).click();
  await page.getByRole('button', { name: 'Save deliverable' }).click();
  await nav.getByRole('button', { name: 'Deliverables' }).click();
  await expect(page.getByRole('heading', { name: 'Trip plan' })).toBeVisible();
  await page.reload();
  await nav.getByRole('button', { name: 'Deliverables' }).click();
  await expect(page.getByText('Revised work brief')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Trip plan' })).toBeVisible();
  expect(calls).toBe(3);
});

test('failed deliverable save preserves the editable preview', async ({ page }) => {
  await page.goto('/app/');
  await page.getByLabel('My name').fill('Ada');
  await page.getByLabel('My goals').fill('Write weekly');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await page.route('**/api/chat', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'Ready', proposals: [], deliverable: { title: 'Brief', body: 'Keep this draft' } }) }));
  await page.getByRole('button', { name: 'Prepare other for Write weekly' }).click();
  await page.getByLabel('API Key', { exact: true }).fill('test-key');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByLabel('Deliverable body')).toHaveValue('Keep this draft');
  await page.evaluate(() => { IDBObjectStore.prototype.put = function () { throw new Error('Storage unavailable'); }; });
  await page.getByRole('button', { name: 'Save deliverable' }).click();
  await expect(page.getByRole('alert')).toContainText('Could not save');
  await expect(page.getByLabel('Deliverable body')).toHaveValue('Keep this draft');
});
