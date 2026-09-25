import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function page(path: string): string {
  return readFileSync(new URL(`../dist/${path}`, import.meta.url), 'utf8');
}

describe('indexable public pages', () => {
  const pages = [
    ['index.html', 'Personal AI Agent', 'https://lninl.com/', '/zh/'],
    ['zh/index.html', '个人 AI Agent', 'https://lninl.com/zh/', '/'],
    ['guide/personal-ai-agent/index.html', 'Personal AI Agent', 'https://lninl.com/guide/personal-ai-agent/', '/zh/guide/personal-ai-agent/'],
    ['zh/guide/personal-ai-agent/index.html', '个人 AI Agent', 'https://lninl.com/zh/guide/personal-ai-agent/', '/guide/personal-ai-agent/'],
  ] as const;

  for (const [path, phrase, canonical, alternate] of pages) {
    it(`${path} provides crawler-readable localized content`, () => {
      const html = page(path);
      expect(html).toContain(phrase);
      expect(html).toContain(`rel="canonical" href="${canonical}"`);
      expect(html).toContain('hreflang="en"');
      expect(html).toContain('hreflang="zh"');
      expect(html).toContain(`href="${alternate}"`);
      expect(html).not.toContain('name="robots" content="noindex"');
    });
  }

  it('describes the real continuous loop in both languages', () => {
    expect(page('index.html')).toContain('Goal → action → check-in');
    expect(page('zh/index.html')).toContain('目标 → 行动 → 回顾');
    expect(page('guide/personal-ai-agent/index.html')).toContain('check-ins');
    expect(page('zh/guide/personal-ai-agent/index.html')).toContain('回顾记录');
  });

  for (const path of ['app/index.html', 'zh/app/index.html']) {
    it(`${path} is excluded from indexing`, () => {
      expect(page(path)).toContain('name="robots" content="noindex"');
    });
  }

  it('sitemap lists public pages but not workspaces', () => {
    const sitemap = page('sitemap-0.xml');
    expect(sitemap).toContain('https://lninl.com/zh/guide/personal-ai-agent/');
    expect(sitemap).toContain('https://lninl.com/guide/personal-ai-agent/');
    expect(sitemap).not.toContain('/app/');
  });

  it('lets crawlers read workspace noindex rather than blocking the page in robots.txt', () => {
    const robots = page('robots.txt');
    expect(robots).not.toMatch(/Disallow:\s*\/(?:zh\/)?app\//);
    expect(page('app/index.html')).toContain('name="robots" content="noindex"');
    expect(page('zh/app/index.html')).toContain('name="robots" content="noindex"');
  });
});
