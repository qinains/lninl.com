import { expect, test, type Page } from '@playwright/test';

async function onboard(page: Page, zh = false) {
  await page.goto(zh ? '/zh/app/' : '/app/');
  await page.getByLabel(zh ? '我的名字' : 'My name').fill('Ada');
  await page.getByRole('button', { name: zh ? '保存档案' : 'Save profile' }).click();
  await page.getByRole('navigation', { name: zh ? '工作台导航' : 'Workspace navigation' }).getByRole('button', { name: zh ? '对话' : 'Conversation' }).click();
}

test('invalid key is localized and is forgotten on reload', async ({ page }) => {
  await onboard(page, true);
  await page.route('**/api/chat', route => route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"invalid_key"}' }));
  await page.getByLabel('OpenAI API Key').fill('sk-test-secret');
  await page.getByLabel('你的消息').fill('你好');
  await page.getByRole('button', { name: '发送' }).click();
  await expect(page.getByRole('alert')).toContainText('API Key 无效');
  await expect(page.getByText('sk-test-secret')).toHaveCount(0);
  await page.reload();
  await page.getByRole('navigation', { name: '工作台导航' }).getByRole('button', { name: '对话' }).click();
  await expect(page.getByLabel('OpenAI API Key')).toHaveValue('');
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
  await page.getByLabel('OpenAI API Key').fill('sk-test-secret');
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
  await expect(page.getByLabel('OpenAI API Key')).toHaveValue('');
});

test('a local storage failure keeps the unsaved message for retry', async ({ page }) => {
  await onboard(page);
  await page.route('**/api/chat', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"text":"A useful answer","proposals":[]}' }));
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () { throw new DOMException('Storage full', 'QuotaExceededError'); };
  });
  await page.getByLabel('OpenAI API Key').fill('sk-test-secret');
  await page.getByLabel('Your message').fill('Help me plan');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('alert').first()).toContainText(/save/i);
  await expect(page.getByLabel('Your message')).toHaveValue('Help me plan');
});
