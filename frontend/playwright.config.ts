import { defineConfig, devices } from '@playwright/test'

// Сквозные тесты интерфейса.
//   npm run e2e                 — статическая версия (как на GitHub Pages): компьютер и iPhone
//   npm run e2e -- --project=server — версия с сервером FastAPI (временная база данных)
const STATIC_PORT = 5180
const SERVER_WEB_PORT = 5181
const API_PORT = 8799

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { trace: 'retain-on-failure', locale: 'ru-RU' },
  projects: [
    {
      name: 'desktop',
      testMatch: /static\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${STATIC_PORT}` },
    },
    {
      name: 'iphone',
      testMatch: /static\.spec\.ts/,
      use: { ...devices['iPhone 14'], baseURL: `http://localhost:${STATIC_PORT}` },
    },
    {
      name: 'server',
      testMatch: /server\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${SERVER_WEB_PORT}` },
    },
  ],
  webServer: [
    {
      command: `npx vite --mode static --port ${STATIC_PORT} --strictPort`,
      port: STATIC_PORT,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npx vite --port ${SERVER_WEB_PORT} --strictPort`,
      port: SERVER_WEB_PORT,
      reuseExistingServer: !process.env.CI,
      env: { API_TARGET: `http://127.0.0.1:${API_PORT}` },
    },
    {
      command: `node e2e/start-api.mjs ${API_PORT}`,
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      reuseExistingServer: false,
    },
  ],
})
