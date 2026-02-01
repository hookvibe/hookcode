import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Shared helpers for HookCode preview highlight request scripts. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SKILL_ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(SKILL_ROOT, '.env');

export function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '-h' || token === '--help') {
      args.help = true;
      continue;
    }
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = value;
    i += 1;
  }
  return args;
}

function parseEnv(content) {
  const env = {};
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const sanitized = trimmed.startsWith('export ') ? trimmed.slice(7) : trimmed;
    const index = sanitized.indexOf('=');
    if (index === -1) {
      continue;
    }
    const key = sanitized.slice(0, index).trim();
    let value = sanitized.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

async function readEnvFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return parseEnv(content);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

export async function loadEnv() {
  const fileEnv = await readEnvFile(ENV_PATH);
  return { ...fileEnv, ...process.env };
}

export function getEnv(env, key) {
  const value = env[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : undefined;
}

export function requireEnv(env, key) {
  const value = getEnv(env, key);
  if (!value) {
    throw new Error(`${key} is required. Set it in .env or the environment.`);
  }
  return value;
}

export function parseBoolean(value) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) {
    return false;
  }
  return undefined;
}

export function parseNumber(value) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return undefined;
  }
  return numeric;
}

export function buildUrl(baseUrl, inputPath) {
  if (!baseUrl) {
    throw new Error('HOOKCODE_API_BASE_URL is required when --base-url is not provided.');
  }
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const normalizedPath = inputPath.startsWith('/') ? inputPath.slice(1) : inputPath;
  return new URL(normalizedPath, normalizedBase);
}

export function buildAuthHeaders(pat, contentType) {
  if (!pat) {
    throw new Error('HOOKCODE_PAT is required. Set it in .env or the environment.');
  }
  const headers = new Headers({
    Accept: 'application/json',
    Authorization: `Bearer ${pat}`
  });
  if (contentType) {
    headers.set('Content-Type', contentType);
  }
  return headers;
}

function redactHeaders(headers) {
  const result = {};
  for (const [key, value] of headers.entries()) {
    if (key.toLowerCase() === 'authorization') {
      result[key] = 'Bearer ***';
      continue;
    }
    result[key] = value;
  }
  return result;
}

export async function sendRequest({ url, method, headers, body, dryRun }) {
  if (dryRun) {
    console.log('Dry run: request preview');
    console.log(`URL: ${url.toString()}`);
    console.log(`Method: ${method}`);
    console.log('Headers:', redactHeaders(headers));
    if (body) {
      console.log('Body:', body);
    }
    return;
  }

  const response = await fetch(url.toString(), { method, headers, body });
  const responseText = await response.text();
  const contentTypeHeader = response.headers.get('content-type') || '';

  console.log(`Status: ${response.status} ${response.statusText}`);

  if (responseText) {
    if (contentTypeHeader.includes('application/json')) {
      try {
        const parsed = JSON.parse(responseText);
        console.log(JSON.stringify(parsed, null, 2));
      } catch {
        console.log(responseText);
      }
    } else {
      console.log(responseText);
    }
  }

  if (!response.ok) {
    process.exitCode = 1;
  }
}
