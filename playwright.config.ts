import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Base URL configuration
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
const CI = process.env.CI === 'true';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: !CI,
  forbidOnly: !!CI,
  retries: CI ? 2 : 0,
  workers: CI ? 1 : undefined,
  
  // Timeouts for AI operations
  timeout: 90 * 1000, // 90 seconds per test
  expect: {
    timeout: 10 * 1000,
  },
  
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15 * 1000,
    navigationTimeout: 30 * 1000,
  },
  
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['iPhone 12 Pro'] },
    },
  ],
  
  // Web server configuration
  webServer: [
    {
      command: 'npm run server',
      url: 'http://localhost:3001',
      reuseExistingServer: !CI,
      timeout: 120 * 1000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        PORT: '3001',
        NODE_ENV: 'test',
        DATA_DIR: join(__dirname, 'test-data'),
      },
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !CI,
      timeout: 120 * 1000,
      stdout: 'pipe',
      stderr: 'pipe',
      // Wait for Vite to be ready - it serves on port 5173
      // The URL check will verify it's accessible
    },
  ],
});

