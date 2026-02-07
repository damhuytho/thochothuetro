import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';

export default defineConfig({
  // Thay bằng domain thật
  site: 'https://thochothuetro.com',

  // Giữ nguyên là /
  base: '/',

  integrations: [sitemap()]
});