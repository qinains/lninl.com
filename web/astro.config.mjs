import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import svelte from '@astrojs/svelte';

export default defineConfig({
  site: 'https://lninl.com',
  integrations: [svelte(), sitemap({ filter: (url) => !new URL(url).pathname.includes('/app/') })],
});
