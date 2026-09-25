import { expect, test } from '@playwright/test';

for (const locale of ['en', 'zh'] as const) {
  const zh = locale === 'zh';
  const route = zh ? '/zh/app/' : '/app/';

  test(`${locale} workspace keeps explicit personal data and protects imports`, async ({ page }) => {
    await page.goto(route);
    const nav = page.getByRole('navigation', { name: zh ? '工作台导航' : 'Workspace navigation' });
    await expect(page.getByRole('heading', { name: zh ? '创建你的 Agent' : 'Create your agent' })).toBeVisible();
    await page.getByLabel(zh ? '我的名字' : 'My name').fill('Ada');
    await page.getByLabel(zh ? '我的目标' : 'My goals').fill(zh ? '每周写一篇文章' : 'Write one article each week');
    await page.getByRole('button', { name: zh ? '保存档案' : 'Save profile' }).click();
    await expect(page.getByText(zh ? '每周写一篇文章' : 'Write one article each week')).toBeVisible();
    await page.reload();
    await expect(page.getByText(zh ? '每周写一篇文章' : 'Write one article each week')).toBeVisible();

    await nav.getByRole('button', { name: zh ? '记忆' : 'Memories' }).click();
    await page.getByLabel(zh ? '新记忆' : 'New memory').fill(zh ? '我喜欢简短回答' : 'I prefer short answers');
    await page.getByRole('button', { name: zh ? '添加记忆' : 'Add memory' }).click();
    await expect(page.getByText(zh ? '我喜欢简短回答' : 'I prefer short answers')).toBeVisible();
    await page.getByRole('button', { name: zh ? '编辑记忆' : 'Edit memory' }).click();
    await page.getByLabel(zh ? '编辑记忆内容' : 'Edit memory text').fill(zh ? '我喜欢具体的回答' : 'I prefer concrete answers');
    await page.getByLabel(zh ? '编辑记忆领域' : 'Edit memory domain').selectOption('work');
    await page.getByRole('button', { name: zh ? '保存记忆' : 'Save memory' }).click();
    await expect(page.getByText(zh ? '我喜欢具体的回答' : 'I prefer concrete answers')).toBeVisible();

    await nav.getByRole('button', { name: zh ? '待办' : 'Tasks' }).click();
    await page.getByLabel(zh ? '新待办' : 'New task').fill(zh ? '写提纲' : 'Write outline');
    await page.getByRole('button', { name: zh ? '添加待办' : 'Add task' }).click();
    await expect(page.getByText(zh ? '写提纲' : 'Write outline')).toBeVisible();
    await page.getByRole('checkbox', { name: zh ? '写提纲' : 'Write outline' }).check();

    await nav.getByRole('button', { name: zh ? '数据' : 'Data' }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: zh ? '导出数据' : 'Export data' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('personal-agent-data.json');
    await page.getByLabel(zh ? '导入数据文件' : 'Import data file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{bad') });
    await expect(page.getByRole('alert')).toContainText(zh ? '无法导入' : 'Import failed');
    await page.getByRole('button', { name: zh ? '清空数据' : 'Clear data' }).click();
    await expect(page.getByRole('button', { name: zh ? '确认清空' : 'Confirm clear' })).toBeVisible();
    await page.getByRole('button', { name: zh ? '取消' : 'Cancel' }).click();
    await page.reload();
    await nav.getByRole('button', { name: zh ? '待办' : 'Tasks' }).click();
    await expect(page.getByRole('checkbox', { name: zh ? '写提纲' : 'Write outline' })).toBeChecked();
  });

  test(`${locale} preserves a goal action and check-in across reload`, async ({ page }) => {
    await page.goto(route);
    await page.getByLabel(zh ? '我的名字' : 'My name').fill('Ada');
    await page.getByRole('button', { name: zh ? '保存档案' : 'Save profile' }).click();
    await page.getByRole('navigation', { name: zh ? '工作台导航' : 'Workspace navigation' }).getByRole('button', { name: zh ? '目标' : 'Goals' }).click();
    await page.getByLabel(zh ? '目标名称' : 'Goal title').fill(zh ? '每周写作' : 'Write weekly');
    await page.getByRole('button', { name: zh ? '创建目标' : 'Create goal' }).click();
    await page.getByRole('button', { name: zh ? '编辑目标' : 'Edit goal' }).click();
    await page.getByLabel(zh ? '编辑当前阶段' : 'Edit current stage').fill(zh ? '完成第一篇' : 'First article');
    await page.getByRole('button', { name: zh ? '保存目标' : 'Save goal' }).click();
    await page.getByRole('button', { name: zh ? '回顾目标' : 'Check in' }).click();
    await page.getByLabel(zh ? '这次进展' : 'What happened').fill(zh ? '完成初稿' : 'Drafted article');
    await page.getByLabel(zh ? '下一步行动' : 'Next action').fill(zh ? '编辑初稿' : 'Edit draft');
    await page.getByRole('button', { name: zh ? '保存回顾' : 'Save check-in' }).click();
    await expect(page.getByText(zh ? '完成初稿' : 'Drafted article')).toBeVisible();
    await page.reload();
    await expect(page.getByText(zh ? '完成第一篇' : 'First article')).toBeVisible();
    await page.getByRole('navigation', { name: zh ? '工作台导航' : 'Workspace navigation' }).getByRole('button', { name: zh ? '目标' : 'Goals' }).click();
    await expect(page.getByText(zh ? '编辑初稿' : 'Edit draft')).toBeVisible();
    await expect(page.getByText(zh ? '完成初稿' : 'Drafted article')).toBeVisible();
  });
}

test('a failed check-in save keeps the draft', async ({ page }) => {
  await page.goto('/app/');
  await page.getByLabel('My name').fill('Ada');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('button', { name: 'Goals' }).click();
  await page.getByLabel('Goal title').fill('Write weekly');
  await page.getByRole('button', { name: 'Create goal' }).click();
  await page.getByRole('button', { name: 'Check in' }).click();
  await page.getByLabel('What happened').fill('Drafted two pages');
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (storeNames, mode, options) {
      if (mode === 'readwrite') throw new Error('Storage unavailable');
      return original.call(this, storeNames, mode, options);
    };
  });
  await page.getByRole('button', { name: 'Save check-in' }).click();
  await expect(page.getByRole('alert')).toContainText('Could not save check-in');
  await expect(page.getByLabel('What happened')).toHaveValue('Drafted two pages');
});

test('migrates a version-1 browser profile without losing its tasks', async ({ page }) => {
  await page.goto('/app/');
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('personal-agent', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('state', 'readwrite');
      tx.objectStore('state').put({
        schemaVersion: 1,
        profile: { name: 'Legacy Ada', about: 'Writer', preferences: 'Concise', goals: ['Publish weekly'] },
        memories: [],
        tasks: [{ id: 'legacy-task', title: 'Keep old task', notes: '', completed: false, createdAt: '2026-09-25T00:00:00.000Z', updatedAt: '2026-09-25T00:00:00.000Z' }],
        conversation: [],
      }, 'agent');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await expect(page.getByText('Publish weekly')).toBeVisible();
  await page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('button', { name: 'Tasks' }).click();
  await expect(page.getByRole('checkbox', { name: 'Keep old task' })).toBeVisible();
});
