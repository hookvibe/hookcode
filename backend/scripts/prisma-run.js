#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config();
} catch {
  // ignore
}

const buildDatabaseUrl = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT || 5432);
  const user = process.env.DB_USER || 'hookcode';
  const password = process.env.DB_PASSWORD || 'hookcode';
  const database = process.env.DB_NAME || 'hookcode';

  const url = new URL('postgresql://localhost');
  url.hostname = host;
  url.port = String(port);
  url.username = user;
  url.password = password;
  url.pathname = `/${database}`;
  url.searchParams.set('schema', 'public');
  return url.toString();
};

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = buildDatabaseUrl();
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/prisma-run.js <prisma args...>');
  process.exit(1);
}

const schemaFromEnv = String(process.env.HOOKCODE_PRISMA_SCHEMA_PATH ?? '').trim();
const hasSchemaArg = args.some((arg) => arg === '--schema' || String(arg).startsWith('--schema='));
const resolvedSchemaPath = schemaFromEnv
  ? path.isAbsolute(schemaFromEnv)
    ? schemaFromEnv
    : path.join(process.cwd(), schemaFromEnv)
  : null;
const argsWithSchema = resolvedSchemaPath && !hasSchemaArg ? [...args, '--schema', resolvedSchemaPath] : args;

const prismaBin = process.platform === 'win32'
  ? path.join(__dirname, '..', 'node_modules', '.bin', 'prisma.cmd')
  : path.join(__dirname, '..', 'node_modules', '.bin', 'prisma');

const result = spawnSync(prismaBin, argsWithSchema, {
  stdio: 'inherit',
  env: process.env
});

process.exit(typeof result.status === 'number' ? result.status : 1);
