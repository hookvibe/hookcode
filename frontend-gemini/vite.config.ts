import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const DEFAULT_PORT = 5176;
const DEFAULT_BACKEND_HOST = '127.0.0.1';
const DEFAULT_BACKEND_PORT = 4000;

function parsePort(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) return undefined;
  return parsed;
}

function resolveBackendOriginFromApiBase(env: Record<string, string>): string {
  const apiBase = String(env.VITE_API_BASE_URL ?? '').trim();
  if (apiBase && apiBase.startsWith('http')) {
    try {
      const parsed = new URL(apiBase);
      const hostname = parsed.hostname === 'localhost' ? DEFAULT_BACKEND_HOST : parsed.hostname;
      return `${parsed.protocol}//${hostname}${parsed.port ? `:${parsed.port}` : ''}`;
    } catch {
      // fall through
    }
  }

  const port = parsePort(env.HOOKCODE_BACKEND_PORT) ?? DEFAULT_BACKEND_PORT;
  return `http://${DEFAULT_BACKEND_HOST}:${port}`;
}

export default defineConfig(({ mode }) => {
  const envDir = fileURLToPath(new URL('.', import.meta.url));
  const env = loadEnv(mode, envDir, '');
  const port = parsePort(env.HOOKCODE_FRONTEND_PORT) ?? DEFAULT_PORT;
  const backendOrigin = resolveBackendOriginFromApiBase(env);

  return {
    plugins: [react()],
    // Provide @ alias for custom UI modules after removing AntD. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    // Configure Vitest to run UI tests in a browser-like environment. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/tests/setup.ts'],
      css: true,
      restoreMocks: true,
      testTimeout: 15000,
      hookTimeout: 15000
    },
    publicDir: fileURLToPath(new URL('../logo', import.meta.url)),
    server: {
      port,
      proxy: {
        '/api': {
          target: backendOrigin,
          changeOrigin: true,
          secure: false,
          timeout: 0,
          proxyTimeout: 0
        }
      }
    }
  };
});
