const { spawnSync } = require('node:child_process');

const DEFAULT_LOCAL_DEV_DB_CONFIG = Object.freeze({
  containerName: 'hookcode-local-dev-db',
  volumeName: 'hookcode-local-dev-db-data',
  image: 'postgres:15-alpine',
  host: '127.0.0.1',
  port: '55432',
  user: 'hookcode',
  password: 'hookcode',
  database: 'hookcode_local'
});

function getLocalDevDbConfig(env = process.env) {
  return {
    containerName:
      String(env.HOOKCODE_LOCAL_DEV_DB_CONTAINER || DEFAULT_LOCAL_DEV_DB_CONFIG.containerName).trim() ||
      DEFAULT_LOCAL_DEV_DB_CONFIG.containerName,
    volumeName:
      String(env.HOOKCODE_LOCAL_DEV_DB_VOLUME || DEFAULT_LOCAL_DEV_DB_CONFIG.volumeName).trim() ||
      DEFAULT_LOCAL_DEV_DB_CONFIG.volumeName,
    image:
      String(env.HOOKCODE_LOCAL_DEV_DB_IMAGE || DEFAULT_LOCAL_DEV_DB_CONFIG.image).trim() ||
      DEFAULT_LOCAL_DEV_DB_CONFIG.image,
    host:
      String(env.HOOKCODE_LOCAL_DEV_DB_HOST || DEFAULT_LOCAL_DEV_DB_CONFIG.host).trim() ||
      DEFAULT_LOCAL_DEV_DB_CONFIG.host,
    port:
      String(env.HOOKCODE_LOCAL_DEV_DB_PORT || DEFAULT_LOCAL_DEV_DB_CONFIG.port).trim() ||
      DEFAULT_LOCAL_DEV_DB_CONFIG.port,
    user:
      String(env.HOOKCODE_LOCAL_DEV_DB_USER || DEFAULT_LOCAL_DEV_DB_CONFIG.user).trim() ||
      DEFAULT_LOCAL_DEV_DB_CONFIG.user,
    password:
      String(env.HOOKCODE_LOCAL_DEV_DB_PASSWORD || DEFAULT_LOCAL_DEV_DB_CONFIG.password).trim() ||
      DEFAULT_LOCAL_DEV_DB_CONFIG.password,
    database:
      String(env.HOOKCODE_LOCAL_DEV_DB_NAME || DEFAULT_LOCAL_DEV_DB_CONFIG.database).trim() ||
      DEFAULT_LOCAL_DEV_DB_CONFIG.database
  };
}

function buildLocalDevDatabaseUrl(config = getLocalDevDbConfig()) {
  const url = new URL('postgresql://localhost');
  url.hostname = config.host;
  url.port = config.port;
  url.username = config.user;
  url.password = config.password;
  url.pathname = `/${config.database}`;
  url.searchParams.set('schema', 'public');
  return url.toString();
}

// Keep the local DB entrypoint reproducible so backend/.env.example and `pnpm dev:db:local` always agree on the same container, port, volume, and credentials.
function buildLocalDevDbDockerArgs(config = getLocalDevDbConfig()) {
  return [
    'run',
    '-d',
    '--name',
    config.containerName,
    '--restart',
    'unless-stopped',
    '-e',
    `POSTGRES_DB=${config.database}`,
    '-e',
    `POSTGRES_USER=${config.user}`,
    '-e',
    `POSTGRES_PASSWORD=${config.password}`,
    '-p',
    `${config.host}:${config.port}:5432`,
    '-v',
    `${config.volumeName}:/var/lib/postgresql/data`,
    config.image
  ];
}

function parseContainerState(output = '') {
  const [name = '', state = ''] = String(output).trim().split(/\s+/, 2);
  if (!name) {
    return {
      exists: false,
      running: false
    };
  }
  return {
    exists: true,
    running: state === 'running'
  };
}

function runDocker(spawnSyncImpl, args) {
  return spawnSyncImpl('docker', args, {
    encoding: 'utf8'
  });
}

function ensureDockerAvailable(spawnSyncImpl) {
  const result = runDocker(spawnSyncImpl, ['info']);
  if (result.status === 0) return;

  const details = String(result.stderr || result.stdout || '').trim();
  throw new Error(
    `[dev:db:local] Docker daemon is not available. Start Docker first, then rerun this command.${details ? ` ${details}` : ''}`
  );
}

function runLocalDevDb({ env = process.env, spawnSyncImpl = spawnSync, stdout = process.stdout } = {}) {
  const config = getLocalDevDbConfig(env);
  ensureDockerAvailable(spawnSyncImpl);

  const inspectResult = runDocker(spawnSyncImpl, [
    'ps',
    '-a',
    '--filter',
    `name=^/${config.containerName}$`,
    '--format',
    '{{.Names}} {{.State}}'
  ]);
  const containerState = parseContainerState(inspectResult.stdout);

  if (!containerState.exists) {
    const createResult = runDocker(spawnSyncImpl, buildLocalDevDbDockerArgs(config));
    if (createResult.status !== 0) {
      throw new Error(
        String(
          createResult.stderr ||
            createResult.stdout ||
            '[dev:db:local] Failed to create local Postgres container.'
        ).trim()
      );
    }
  } else if (!containerState.running) {
    const startResult = runDocker(spawnSyncImpl, ['start', config.containerName]);
    if (startResult.status !== 0) {
      throw new Error(
        String(
          startResult.stderr ||
            startResult.stdout ||
            '[dev:db:local] Failed to start local Postgres container.'
        ).trim()
      );
    }
  }

  stdout.write(
    `[dev:db:local] Ready: ${config.containerName}\n` +
      `[dev:db:local] DATABASE_URL=${buildLocalDevDatabaseUrl(config)}\n`
  );
}

if (require.main === module) {
  try {
    runLocalDevDb();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

module.exports = {
  buildLocalDevDatabaseUrl,
  buildLocalDevDbDockerArgs,
  DEFAULT_LOCAL_DEV_DB_CONFIG,
  getLocalDevDbConfig,
  parseContainerState,
  runLocalDevDb
};
