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
}
