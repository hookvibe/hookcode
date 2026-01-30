import { loadMcpServerConfig } from '../../mcp/config';

// Validate MCP config env parsing for backend proxy server. docs/en/developer/plans/z4xn4m8yue7jxh9jv1p2/task_plan.md z4xn4m8yue7jxh9jv1p2

const setEnv = (key: string, value: string | undefined) => {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
};

describe('loadMcpServerConfig', () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...envSnapshot };
  });

  test('prefers explicit MCP backend base URL when provided', () => {
    setEnv('HOOKCODE_MCP_BACKEND_BASE_URL', 'http://example.com/api/');
    const config = loadMcpServerConfig();
    expect(config.baseUrl).toBe('http://example.com/api');
  });

  test('falls back to admin tools base URL when MCP base URL is missing', () => {
    setEnv('HOOKCODE_MCP_BACKEND_BASE_URL', '');
    setEnv('ADMIN_TOOLS_API_BASE_URL', 'http://admin.example/api/');
    const config = loadMcpServerConfig();
    expect(config.baseUrl).toBe('http://admin.example/api');
  });

  test('uses host/port fallback when no base URL is configured', () => {
    setEnv('HOOKCODE_MCP_BACKEND_BASE_URL', '');
    setEnv('ADMIN_TOOLS_API_BASE_URL', '');
    setEnv('HOST', '0.0.0.0');
    setEnv('PORT', '5555');
    const config = loadMcpServerConfig();
    expect(config.baseUrl).toBe('http://0.0.0.0:5555/api');
  });

  test('parses auth header selection and flags', () => {
    setEnv('HOOKCODE_MCP_AUTH_HEADER', 'x-hookcode-token');
    setEnv('HOOKCODE_MCP_AUTH_REQUIRED', 'false');
    setEnv('HOOKCODE_MCP_ENABLE_JSON_RESPONSE', 'true');
    const config = loadMcpServerConfig();
    expect(config.authHeader).toBe('x-hookcode-token');
    expect(config.authRequired).toBe(false);
    expect(config.enableJsonResponse).toBe(true);
  });

  test('parses allowed hosts list', () => {
    setEnv('HOOKCODE_MCP_ALLOWED_HOSTS', 'localhost, 127.0.0.1');
    const config = loadMcpServerConfig();
    expect(config.allowedHosts).toEqual(['localhost', '127.0.0.1']);
  });
});
