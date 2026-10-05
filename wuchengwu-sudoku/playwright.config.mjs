// 手机视口 + 触摸模拟。默认起本地静态服务器测构建产物；
// 设置 BASE_URL（例如线上地址）时直接测远端页面。
import { defineConfig, devices } from '@playwright/test';

const live = process.env.BASE_URL;

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: live || 'http://127.0.0.1:4173/',
    ...devices['Pixel 5'],
    screenshot: 'only-on-failure',
    extraHTTPHeaders: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
  },
  projects: [{ name: 'mobile-chromium', use: { ...devices['Pixel 5'] } }],
  webServer: live
    ? undefined
    : {
        command: 'node tests/serve.mjs 4173',
        url: 'http://127.0.0.1:4173/',
        reuseExistingServer: true,
        timeout: 15_000,
      },
});
