const buildDatabaseUrl = (env = process.env) => {
  if (env.DATABASE_URL) return env.DATABASE_URL;

  const host = env.DB_HOST || 'localhost';
  const port = Number(env.DB_PORT || 5432);
  const user = env.DB_USER || 'hookcode';
  const password = env.DB_PASSWORD || 'hookcode';
  const database = env.DB_NAME || 'hookcode';

  const url = new URL('postgresql://localhost');
  url.hostname = host;
  url.port = String(port);
  url.username = user;
  url.password = password;
  url.pathname = `/${database}`;
  url.searchParams.set('schema', 'public');
  return url.toString();
};

// Keep every local/backend Prisma entrypoint on the same DB_* fallback logic so local dev guards and Prisma CLI commands interpret source-mode database settings consistently.
const ensureDatabaseUrl = (env = process.env) => {
  if (!env.DATABASE_URL) {
    env.DATABASE_URL = buildDatabaseUrl(env);
  }
  return env;
};

module.exports = {
  buildDatabaseUrl,
  ensureDatabaseUrl
};
