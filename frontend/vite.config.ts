import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const DEFAULT_PORT = 5173;

function parsePort(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) return undefined;
  return parsed;
}

export default defineConfig(({ mode }) => {
  const envDir = fileURLToPath(new URL('.', import.meta.url));
  const env = loadEnv(mode, envDir, '');
  const port = parsePort(env.HOOKCODE_FRONTEND_PORT) ?? DEFAULT_PORT;

  return {
    plugins: [react()],
    publicDir: fileURLToPath(new URL('../logo', import.meta.url)),
    server: {
      port
    }
  };
});
