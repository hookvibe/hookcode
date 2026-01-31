#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Provide PAT-authenticated debug requests from a Node script. docs/en/developer/plans/open-api-pat-skill-20260130/task_plan.md open-api-pat-skill-20260130

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SKILL_ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(SKILL_ROOT, '.env');

const HELP_TEXT = `Hookcode PAT API Debug

Usage:
  node scripts/pat_request.mjs --path /api/users/me
  node scripts/pat_request.mjs --method PATCH --path /api/users/me --body '{"displayName":"Name"}'

Options:
  --path /api/...            API path relative to base URL
  --url https://host/api/... Full URL override
  --method GET|POST|PATCH|PUT|DELETE
  --body '<json>'            Request body string (prefix @file to read)
  --raw                      Send body as plain text (skip JSON parsing)
  --query key=value          Repeat to add query params
  --header 'Name: Value'     Repeat to add headers
  --dry-run                  Print request without sending
  --help                     Show this help
`;

function parseArgs(argv) {
  const args = {
    headers: [],
    queries: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '-h' || token === '--help') {
      args.help = true;
      continue;
    }
    if (!token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    if (key === 'dry-run' || key === 'raw') {
      args[key] = true;
      continue;
    }
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }
    i += 1;
    if (key === 'header') {
      args.headers.push(value);
      continue;
    }
    if (key === 'query') {
      args.queries.push(value);
      continue;
    }
    args[key] = value;
  }

  return args;
}

// Parse simple KEY=VALUE env files without extra dependencies. docs/en/developer/plans/open-api-pat-skill-20260130/task_plan.md open-api-pat-skill-20260130
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

function parseHeaderInput(input) {
  const separatorIndex = input.includes(':') ? input.indexOf(':') : input.indexOf('=');
  if (separatorIndex === -1) {
    throw new Error(`Invalid header format: ${input}`);
  }
  const name = input.slice(0, separatorIndex).trim();
  const value = input.slice(separatorIndex + 1).trim();
  if (!name) {
    throw new Error(`Invalid header name: ${input}`);
  }
  return [name, value];
}

function applyQueryParams(url, queries) {
  for (const entry of queries) {
    const index = entry.indexOf('=');
    if (index === -1) {
      throw new Error(`Invalid query format: ${entry}`);
    }
    const key = entry.slice(0, index).trim();
    const value = entry.slice(index + 1).trim();
    if (key) {
      url.searchParams.append(key, value);
    }
  }
}

async function loadBody(rawBody, rawMode) {
  if (!rawBody) {
    return { body: undefined, contentType: undefined };
  }
  const value = rawBody.startsWith('@')
    ? await fs.readFile(path.resolve(process.cwd(), rawBody.slice(1)), 'utf8')
    : rawBody;

  if (rawMode) {
    return { body: value, contentType: 'text/plain' };
  }

  try {
    const parsed = JSON.parse(value);
    return { body: JSON.stringify(parsed), contentType: 'application/json' };
  } catch {
    return { body: value, contentType: 'text/plain' };
  }
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

function buildUrl(baseUrl, inputPath, inputUrl) {
  if (inputUrl) {
    return new URL(inputUrl);
  }
  if (!baseUrl) {
    throw new Error('HOOKCODE_API_BASE_URL is required when --url is not provided.');
  }
  if (!inputPath) {
    throw new Error('Provide --path or --url to select an endpoint.');
  }
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const normalizedPath = inputPath.startsWith('/') ? inputPath.slice(1) : inputPath;
  return new URL(normalizedPath, normalizedBase);
}

// Load env, build URL, attach PAT header, and dispatch the request. docs/en/developer/plans/open-api-pat-skill-20260130/task_plan.md open-api-pat-skill-20260130
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP_TEXT);
    return;
  }

  const fileEnv = await readEnvFile(ENV_PATH);
  const env = { ...fileEnv, ...process.env };
  const baseUrl = env.HOOKCODE_API_BASE_URL?.trim();
  const pat = env.HOOKCODE_PAT?.trim();

  if (!pat) {
    throw new Error('HOOKCODE_PAT is required. Set it in .env or the environment.');
  }

  const url = buildUrl(baseUrl, args.path, args.url);
  applyQueryParams(url, args.queries);

  const { body, contentType } = await loadBody(args.body, args.raw);
  const method = (args.method || (body ? 'POST' : 'GET')).toUpperCase();

  const headers = new Headers({
    Accept: 'application/json',
    Authorization: `Bearer ${pat}`,
  });
  if (contentType) {
    headers.set('Content-Type', contentType);
  }
  for (const headerInput of args.headers) {
    const [name, value] = parseHeaderInput(headerInput);
    headers.set(name, value);
  }

  if (args['dry-run']) {
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

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
