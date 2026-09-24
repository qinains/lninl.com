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
});
